using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using webAI.Data;

internal static class VietnameseScenario
{
    public static async Task ApplyAsync(string root)
    {
        const string cs="Server=(localdb)\\MSSQLLocalDB;Database=AIRecruitmentDb;Integrated Security=true;TrustServerCertificate=true";
        var data=Path.Combine(root,"webAI","App_Data");
        var scenario=JsonSerializer.Deserialize<Scenario>(File.ReadAllText(Path.Combine(root,"tools","DemoScenario","scenario.json")),new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        var backup=Path.Combine(data,"backups","viet-hoa-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss"));Directory.CreateDirectory(backup);
        await using(var connection=new SqlConnection(cs)){
            await connection.OpenAsync();await using var cmd=connection.CreateCommand();cmd.CommandTimeout=120;
            cmd.CommandText="BACKUP DATABASE [AIRecruitmentDb] TO DISK=@path WITH COPY_ONLY,CHECKSUM; RESTORE VERIFYONLY FROM DISK=@path WITH CHECKSUM;";
            cmd.Parameters.AddWithValue("@path",Path.Combine(backup,"AIRecruitmentDb.bak"));await cmd.ExecuteNonQueryAsync();
        }
        await using var db=new RecruitmentDbContext(new DbContextOptionsBuilder<RecruitmentDbContext>().UseSqlServer(cs).Options);
        var user=await db.Users.SingleAsync(u=>u.Email=="congty@recruitai.test");var main=await db.Companies.SingleAsync(c=>c.OwnerSubject==user.UserId.ToString());
        string[] oldTitles=["Backend Developer (.NET)","Frontend Developer (React / TypeScript)","Database Engineer (SQL Server)"];
        string[] oldCompanies=["Aurora Cloud","Sen Commerce","Cobalt Security","Mây Design","Bình Minh Media"];
        string[] oldExtraTitles=["Cloud DevOps Engineer","E-commerce Product Analyst","Security Operations Analyst","UI/UX Product Designer","Digital Marketing Specialist"];
        var jobs=new List<JobPosting>();var newKeys=new List<string>();
        await using var tx=await db.Database.BeginTransactionAsync();
        try{
            main.Name="Công nghệ Tuyển dụng Việt (kiểm thử)";main.Initials="TV";
            for(var i=0;i<3;i++){
                var title=scenario.Jobs[i].Title;var old=oldTitles[i];
                var job=await db.Jobs.SingleAsync(j=>j.CompanyId==main.Id&&(j.Title==old||j.Title==title));Update(job,scenario.Jobs[i]);jobs.Add(job);
            }
            for(var i=0;i<5;i++){
                var spec=scenario.Companies[i];var oldName=oldCompanies[i]+" (mẫu)";var name=spec.Name+" (mẫu)";
                var company=await db.Companies.SingleAsync(c=>c.IsDemo&&(c.Name==oldName||c.Name==name));company.Name=name;company.Initials=spec.Name[..2].ToUpperInvariant();company.Industry=spec.Industry;
                var oldTitle=oldExtraTitles[i];var job=await db.Jobs.SingleAsync(j=>j.CompanyId==company.Id&&(j.Title==oldTitle||j.Title==spec.Job.Title));Update(job,spec.Job);jobs.Add(job);
            }
            foreach(var spec in scenario.Candidates){
                var profile=await db.Candidates.SingleAsync(c=>c.Email==spec.Email);profile.DesiredTitle=spec.Role;profile.Summary=spec.Summary;
                var prefix=spec.Email.Split('@')[0];var file=Path.Combine(data,"scenario-cvs",prefix+".pdf");
                if(!File.Exists(file))throw new InvalidOperationException("Chưa tạo CV tiếng Việt: "+prefix);
                var resume=await db.Resumes.SingleAsync(r=>r.CandidateId==profile.Id&&(r.Name==prefix+".pdf"||r.Name=="Hồ sơ "+spec.Name+".pdf"));
                if(Path.GetFileName(resume.StorageKey)!=resume.StorageKey)throw new InvalidDataException("Khóa CV không hợp lệ.");
                var original=await db.Documents.AsNoTracking().SingleOrDefaultAsync(d=>d.StorageKey==resume.StorageKey);
                Directory.CreateDirectory(Path.Combine(backup,"documents"));
                var previous=original?.Data??await File.ReadAllBytesAsync(Path.Combine(data,"documents",resume.StorageKey));
                await File.WriteAllBytesAsync(Path.Combine(backup,"documents",resume.StorageKey),previous);
                // Version the file: archived AI evidence keeps the original bytes and key.
                var key=Guid.NewGuid().ToString("N")+".pdf";var bytes=await File.ReadAllBytesAsync(file);
                db.Documents.Add(new StoredDocument{StorageKey=key,Data=bytes,Sha256=Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes))});
                resume.StorageKey=key;resume.Name="Hồ sơ "+spec.Name+".pdf";resume.Size=new FileInfo(file).Length;resume.UpdatedAt=DateTimeOffset.UtcNow;
                var apps=await db.Applications.Where(a=>a.CandidateId==profile.Id).ToListAsync();
                foreach(var app in apps.Where(a=>a.CoverLetter.StartsWith("Hồ sơ giả lập để kiểm thử đối chiếu đúng nhóm ")))
                    app.CoverLetter="Hồ sơ giả lập để kiểm thử vị trí "+spec.Role.ToLowerInvariant()+".";
            }
            var ids=jobs.Select(j=>j.Id).ToArray();var batches=await db.CvReviewBatches.Where(b=>b.CompanyId==main.Id&&!b.Title.StartsWith("[Lưu trữ]")).ToListAsync();
            foreach(var batch in batches){var config=JsonSerializer.Deserialize<JsonElement>(batch.ConfigurationJson);if(config.TryGetProperty("job_id",out var id)&&ids.Contains(id.GetInt32()))batch.Title="[Lưu trữ] Kết quả trước khi Việt hóa — hồ sơ công việc số "+id.GetInt32();}
            await db.SaveChangesAsync();await tx.CommitAsync();
            Console.WriteLine($"Đã Việt hóa {jobs.Count} tin, 6 hồ sơ và 6 tên công ty. Giữ nguyên tài khoản, mật khẩu, ID, lượt ứng tuyển và phản hồi. Sao lưu đã xác minh: {backup}");
        }catch{await tx.RollbackAsync();throw;}
    }
    private static void Update(JobPosting job,JobSpec spec){job.Title=spec.Title;job.Description="DỮ LIỆU KIỂM THỬ ĐỒ ÁN — không phải tin tuyển dụng thực tế.\n"+spec.Description;job.Requirements=spec.Requirements;job.Benefits=spec.Benefits;job.Skills=spec.Skills;job.WorkMode=spec.WorkMode;job.Category=spec.Category;}
}
