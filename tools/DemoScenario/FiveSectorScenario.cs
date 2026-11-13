using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using webAI.Data;
using webAI.Models.Entities;

internal static class FiveSectorScenario
{
    // Explicitly destructive local fixture command; never invoked by web startup.
    public static async Task ResetAsync(string root)
    {
        var webRoot=Path.Combine(root,"webAI");var privateRoot=Path.Combine(webRoot,"App_Data");
        if(!File.Exists(Path.Combine(root,"AGENTS.md"))||!File.Exists(Path.Combine(webRoot,"webAI.csproj")))throw new ArgumentException("Không đúng thư mục dự án.");
        var jsonOptions=new JsonSerializerOptions(JsonSerializerDefaults.Web){WriteIndented=true};
        var scenario=JsonSerializer.Deserialize<FiveSectorData>(await File.ReadAllTextAsync(Path.Combine(root,"tools","DemoScenario","five-sectors.json")),jsonOptions)??throw new InvalidDataException("Thiếu bộ dữ liệu.");
        string[] expected=["Kinh doanh","Thiết kế","Công nghệ","Tiếp thị","Dữ liệu"];
        if(scenario.Candidates.Count!=5||!scenario.Candidates.Select(s=>s.Category).Order().SequenceEqual(expected.Order())||scenario.Candidates.SelectMany(s=>new[]{s.Email,s.CompanyEmail}).Distinct().Count()!=10)throw new InvalidDataException("Cần đúng 5 ngành và 10 email khác nhau.");
        var pdfs=new Dictionary<string,byte[]>();
        foreach(var s in scenario.Candidates){
            if(!System.Text.RegularExpressions.Regex.IsMatch(s.Group,"^[a-z]+$")||s.Description.Length<200||s.Requirements.Length<100||string.IsNullOrWhiteSpace(s.Skills))throw new InvalidDataException("Nội dung JD không đầy đủ.");
            var bytes=await File.ReadAllBytesAsync(Path.Combine(privateRoot,"five-sector-cvs",s.Group+".pdf"));
            if(bytes.Length<1000||!bytes.AsSpan().StartsWith("%PDF-"u8))throw new InvalidDataException("CV PDF không hợp lệ.");pdfs.Add(s.Group,bytes);
        }
        if(pdfs.Values.Select(b=>Convert.ToHexString(SHA256.HashData(b))).Distinct().Count()!=5)throw new InvalidDataException("CV bị trùng.");
        const string cs="Server=(localdb)\\MSSQLLocalDB;Database=AIRecruitmentDb;Integrated Security=true;TrustServerCertificate=true";
        await using var db=new RecruitmentDbContext(new DbContextOptionsBuilder<RecruitmentDbContext>().UseSqlServer(cs).Options);
        // Fail before any deletion if another schema has been connected accidentally.
        string[] allowed=["Applications","Candidates","Companies","CvReviewBatches","CvReviewItems","Documents","Jobs","Matches","Notifications","Resumes","SavedJobs","USERS","Verifications"];
        var tables=await db.Database.SqlQueryRaw<string>("SELECT name AS Value FROM sys.tables").ToListAsync();
        if(tables.Except(allowed,StringComparer.OrdinalIgnoreCase).Any())throw new InvalidOperationException("Database có bảng ngoài dự kiến; dừng để kiểm tra quan hệ trước khi xóa.");
        var backupPath=await DocumentStorageSetup.BackupAsync(db,webRoot);var backupRoot=Path.GetDirectoryName(backupPath)!;
        var before=new { users=await db.Users.CountAsync(),companies=await db.Companies.CountAsync(),jobs=await db.Jobs.CountAsync(),resumes=await db.Resumes.CountAsync(),applications=await db.Applications.CountAsync(),reviews=await db.CvReviewBatches.CountAsync(),documents=await db.Documents.CountAsync() };
        await File.WriteAllTextAsync(Path.Combine(backupRoot,"before-reset.json"),JsonSerializer.Serialize(before,jsonOptions));
        foreach(var name in new[]{"scenario-accounts.json","TEST_ACCOUNTS_LOCAL.md","five-sector-reset.json"}){var file=Path.Combine(privateRoot,name);if(File.Exists(file))File.Copy(file,Path.Combine(backupRoot,name));}
        var credentials=new List<LocalAccount>();var manifest=new List<object>();var hasher=new PasswordHasher<User>();
        await using var tx=await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        // Children first; no DROP, reseeding, identity reuse or schema changes.
        await db.CvReviewItems.ExecuteDeleteAsync();await db.CvReviewBatches.ExecuteDeleteAsync();
        await db.Matches.ExecuteDeleteAsync();await db.Notifications.ExecuteDeleteAsync();await db.SavedJobs.ExecuteDeleteAsync();await db.Applications.ExecuteDeleteAsync();
        await db.Resumes.ExecuteDeleteAsync();await db.Verifications.ExecuteDeleteAsync();await db.Candidates.ExecuteDeleteAsync();await db.Jobs.ExecuteDeleteAsync();await db.Companies.ExecuteDeleteAsync();await db.Users.ExecuteDeleteAsync();await db.Documents.ExecuteDeleteAsync();
        foreach(var spec in scenario.Candidates){
            // Same ASP.NET PasswordHasher as AccountService, in this one atomic transaction.
            User AddUser(string email,string role,string name){var password=(role=="Candidate"?"Cv!":"Cty!")+Convert.ToHexString(RandomNumberGenerator.GetBytes(8));var user=new User{Email=email,RoleName=role};user.PasswordHash=hasher.HashPassword(user,password);db.Users.Add(user);credentials.Add(new LocalAccount(email,password,name,spec.Group,role));return user;}
            var candidateUser=AddUser(spec.Email,"Candidate",spec.Name);var recruiterUser=AddUser(spec.CompanyEmail,"Recruiter",spec.CompanyName);await db.SaveChangesAsync();
            var candidate=new CandidateProfile{Subject=candidateUser.UserId.ToString(),Email=spec.Email,FullName=spec.Name,City=spec.City,DesiredTitle=spec.Role,Summary=spec.Summary};
            // Verified is a local test fixture, not real business verification. IsDemo=false enables application testing.
            var company=new Company{OwnerSubject=recruiterUser.UserId.ToString(),Name=spec.CompanyName,Initials=spec.Category[..1],Industry=spec.Category,Color=spec.Color,VerificationStatus="Verified",IsDemo=false};db.Candidates.Add(candidate);db.Companies.Add(company);await db.SaveChangesAsync();
            var key=Guid.NewGuid().ToString("N")+".pdf";var bytes=pdfs[spec.Group];var sha=Convert.ToHexString(SHA256.HashData(bytes));db.Documents.Add(new StoredDocument{StorageKey=key,Data=bytes,Sha256=sha});
            var resume=new Resume{CandidateId=candidate.Id,Name="Hồ sơ "+spec.Name+".pdf",StorageKey=key,ContentType="application/pdf",Size=bytes.Length,Content=string.Join("\n\n",spec.Name,spec.Email,spec.Role,spec.Summary,spec.Skills,spec.Experience,spec.Projects,spec.Education)};
            var job=new JobPosting{CompanyId=company.Id,Title=spec.Role,Category=spec.Category,City=spec.City,WorkMode="Tại văn phòng",Experience=(spec.Group=="tiepthi"?"1–2 năm":"2–4 năm"),SalaryMin=spec.SalaryMin,SalaryMax=spec.SalaryMax,Skills=spec.Skills,Description="DỮ LIỆU GIẢ LẬP KIỂM THỬ ĐỒ ÁN — không phải tin tuyển dụng thực tế.\n"+spec.Description,Requirements=spec.Requirements,Benefits=spec.Benefits,Status="Published",IsDemo=false,Vacancies=2,Deadline=DateTimeOffset.UtcNow.AddDays(90)};
            db.Resumes.Add(resume);db.Jobs.Add(job);await db.SaveChangesAsync();manifest.Add(new{sector=spec.Category,candidateEmail=spec.Email,companyEmail=spec.CompanyEmail,candidateId=candidate.Id,companyId=company.Id,jobId=job.Id,resumeId=resume.Id,pdfSha256=sha});
        }
        if(await db.Users.CountAsync()!=10||await db.Candidates.CountAsync()!=5||await db.Companies.CountAsync()!=5||await db.Jobs.CountAsync()!=5||await db.Resumes.CountAsync()!=5||await db.Documents.CountAsync()!=5||await db.Applications.AnyAsync()||await db.CvReviewBatches.AnyAsync())throw new InvalidOperationException("Số lượng dữ liệu sau tạo không khớp.");
        // Save credentials durably before SQL commit, so a crash cannot lose new passwords.
        var pending=Path.Combine(privateRoot,"five-sector-accounts.pending.json");await File.WriteAllTextAsync(pending,JsonSerializer.Serialize(credentials,jsonOptions));
        await tx.CommitAsync();File.Move(pending,Path.Combine(privateRoot,"scenario-accounts.json"),true);
        var report=new{createdAt=DateTimeOffset.Now,scenario.Version,backup=backupPath,users=10,candidates=5,companies=5,jobs=5,resumes=5,applications=0,entries=manifest};await File.WriteAllTextAsync(Path.Combine(privateRoot,"five-sector-reset.json"),JsonSerializer.Serialize(report,jsonOptions));
        var local=new StringBuilder("# Tài khoản kiểm thử cục bộ\n\nKhông đưa tệp này lên Git. Mật khẩu được băm trong SQL; bản rõ dưới đây chỉ để chủ dự án đăng nhập thử.\n\n| Vai trò | Ngành | Tên | Email | Mật khẩu |\n|---|---|---|---|---|\n");
        foreach(var a in credentials)local.AppendLine($"| {(a.Role=="Candidate"?"Ứng viên":"Công ty")} | {a.Group} | {a.Name} | {a.Email} | `{a.Password}` |");await File.WriteAllTextAsync(Path.Combine(privateRoot,"TEST_ACCOUNTS_LOCAL.md"),local.ToString());
        Console.WriteLine("Đã thay toàn bộ dữ liệu: 10 tài khoản, 5 công ty, 5 JD, 5 CV PDF. Chưa nộp CV, chưa có điểm AI.");Console.WriteLine("Sao lưu: "+backupPath);Console.WriteLine("Thông tin đăng nhập: "+Path.Combine(privateRoot,"TEST_ACCOUNTS_LOCAL.md"));
    }
    private record LocalAccount(string Email,string Password,string Name,string Group,string Role);
    private record FiveSectorData(string Version,List<Sector> Candidates);
    private record Sector(string Group,string Name,string Role,string City,string CompanyName,string Color,string Category,string Email,string CompanyEmail,string Summary,string Skills,string Experience,string Projects,string Education,string Description,string Requirements,string Benefits,decimal SalaryMin,decimal SalaryMax);
}
