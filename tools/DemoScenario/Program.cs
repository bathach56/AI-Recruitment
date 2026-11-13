using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using webAI.Data;
using webAI.Services;

// Explicit local fixture reset, never called by web startup. No passwords in source.
if (args.Length == 3 && args[0] == "--reset-five-sectors" && args[2] == "--confirm-reset") { await FiveSectorScenario.ResetAsync(Path.GetFullPath(args[1])); return; }
if (args.Length == 2 && args[0] == "--localize-vietnamese") { await VietnameseScenario.ApplyAsync(Path.GetFullPath(args[1])); return; }
if (args.Length != 2 || args[0] != "--replace-demo-data") throw new ArgumentException("Dùng --replace-demo-data hoặc --localize-vietnamese <repository-root>.");
var root = Path.GetFullPath(args[1]);
var privateRoot = Path.Combine(root,"webAI","App_Data");
var stamp=DateTime.UtcNow.ToString("yyyyMMdd-HHmmss");
var backup=Path.Combine(privateRoot,"backups",stamp);
Directory.CreateDirectory(backup);
const string cs="Server=(localdb)\\MSSQLLocalDB;Database=AIRecruitmentDb;Integrated Security=true;TrustServerCertificate=true";
await using(var connection=new SqlConnection(cs)){
 await connection.OpenAsync();
 await using var command=connection.CreateCommand();
 command.CommandText="BACKUP DATABASE [AIRecruitmentDb] TO DISK=@path WITH COPY_ONLY, CHECKSUM; RESTORE VERIFYONLY FROM DISK=@path WITH CHECKSUM;";
 command.Parameters.AddWithValue("@path",Path.Combine(backup,"AIRecruitmentDb.bak"));command.CommandTimeout=120;await command.ExecuteNonQueryAsync();
}
var documents=Path.Combine(privateRoot,"documents");
if(Directory.Exists(documents)){
 Directory.CreateDirectory(Path.Combine(backup,"documents"));
 foreach(var file in Directory.GetFiles(documents))File.Copy(file,Path.Combine(backup,"documents",Path.GetFileName(file)));
}
await using var db=new RecruitmentDbContext(new DbContextOptionsBuilder<RecruitmentDbContext>().UseSqlServer(cs).Options);
var owner=await db.Users.SingleAsync(u=>u.Email=="congty@recruitai.test");
var company=await db.Companies.SingleAsync(c=>c.OwnerSubject==owner.UserId.ToString());
var scenario=JsonSerializer.Deserialize<Scenario>(File.ReadAllText(Path.Combine(root,"tools","DemoScenario","scenario.json")),new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
var oldCompanies=await db.Companies.Where(c=>c.IsDemo).Select(c=>c.Id).ToArrayAsync();
var oldJobs=await db.Jobs.Where(j=>j.IsDemo||(j.CompanyId==company.Id&&j.Title=="Bản nháp kiểm tra tài khoản")).Select(j=>j.Id).ToArrayAsync();
var oldUsers=await db.Users.Where(u=>u.Email=="ungvien@recruitai.test").Select(u=>u.UserId.ToString()).ToArrayAsync();
var oldCandidates=await db.Candidates.Where(c=>oldUsers.Contains(c.Subject)||c.Subject.StartsWith("demo-recruiter-inbox-v1-")).Select(c=>c.Id).ToArrayAsync();
if(await db.Users.AnyAsync(u=>scenario.Candidates.Select(c=>c.Email).Contains(u.Email)))throw new InvalidOperationException("New scenario accounts already exist; refusing duplicate/reset of new accounts.");
Console.WriteLine($"Backup verified: {backup}. Replacing {oldCompanies.Length} old demo companies, {oldJobs.Length} fixture jobs, {oldCandidates.Length} old candidate profiles.");
await using var transaction=await db.Database.BeginTransactionAsync();
var appIds=await db.Applications.Where(a=>oldJobs.Contains(a.JobId)||oldCandidates.Contains(a.CandidateId)).Select(a=>a.Id).ToArrayAsync();
var batches=await db.CvReviewBatches.ToListAsync();
var batchIds=batches.Where(b=>oldCompanies.Contains(b.CompanyId)||
 (b.CompanyId==company.Id&&(b.Title.StartsWith("[Kiểm thử")||oldJobs.Contains(JsonSerializer.Deserialize<JsonElement>(b.ConfigurationJson).TryGetProperty("job_id",out var id)?id.GetInt32():0))))
 .Select(b=>b.Id).ToArray();
await db.CvReviewItems.Where(i=>batchIds.Contains(i.BatchId)).ExecuteDeleteAsync();
await db.CvReviewBatches.Where(b=>batchIds.Contains(b.Id)).ExecuteDeleteAsync();
await db.Matches.Where(m=>appIds.Contains(m.ApplicationId)).ExecuteDeleteAsync();
await db.Notifications.Where(n=>(n.ApplicationId!=null&&appIds.Contains(n.ApplicationId.Value))||oldUsers.Contains(n.RecipientSubject)).ExecuteDeleteAsync();
await db.Applications.Where(a=>appIds.Contains(a.Id)).ExecuteDeleteAsync();
await db.SavedJobs.Where(s=>oldJobs.Contains(s.JobId)||oldCandidates.Contains(s.CandidateId)).ExecuteDeleteAsync();
await db.Resumes.Where(r=>oldCandidates.Contains(r.CandidateId)).ExecuteDeleteAsync();
await db.Candidates.Where(c=>oldCandidates.Contains(c.Id)).ExecuteDeleteAsync();
await db.Jobs.Where(j=>oldJobs.Contains(j.Id)).ExecuteDeleteAsync();
await db.Verifications.Where(v=>oldCompanies.Contains(v.CompanyId)).ExecuteDeleteAsync();
await db.Companies.Where(c=>oldCompanies.Contains(c.Id)).ExecuteDeleteAsync();
await db.Users.Where(u=>u.Email=="ungvien@recruitai.test").ExecuteDeleteAsync();
company.Name="RecruitAI Engineering Lab (kiểm thử)";company.Initials="RE";company.Industry="Công nghệ phần mềm";
// Fixture approval is scoped to this explicitly run local scenario, not a production verification flow.
company.VerificationStatus="Verified";
await db.SaveChangesAsync();
foreach(var spec in scenario.Jobs)db.Jobs.Add(MakeJob(company.Id,spec,false));
foreach(var spec in scenario.Companies){
 var extra=new Company{Name=spec.Name+" (mẫu)",Initials=spec.Name[..2].ToUpperInvariant(),Industry=spec.Industry,IsDemo=true,Color=spec.Color};
 db.Companies.Add(extra);await db.SaveChangesAsync();db.Jobs.Add(MakeJob(extra.Id,spec.Job,true));
}
await db.SaveChangesAsync();await transaction.CommitAsync();
// AccountService uses the same PasswordHasher and profile creation as real registration.
var accounts=new AccountService(db);var credentials=new List<object>();
foreach(var candidate in scenario.Candidates){
 var password="Cv!"+Convert.ToHexString(RandomNumberGenerator.GetBytes(10));
 var user=await accounts.RegisterAsync(candidate.Email,password,candidate.Name,"Candidate")??throw new InvalidOperationException("Duplicate candidate");
 var profile=await db.Candidates.SingleAsync(c=>c.Subject==user.UserId.ToString());
 profile.DesiredTitle=candidate.Role;profile.City=candidate.City;profile.Summary=candidate.Summary;
 await db.SaveChangesAsync();
 credentials.Add(new{candidate.Email,password,candidate.Name,candidate.Group});
}
var credentialPath=Path.Combine(privateRoot,"scenario-accounts.json");
File.WriteAllText(credentialPath,JsonSerializer.Serialize(credentials,new JsonSerializerOptions{WriteIndented=true}));
Console.WriteLine($"Created 6 candidate accounts, 3 main jobs and 5 additional company jobs. Credentials: {credentialPath}");

static JobPosting MakeJob(int companyId,JobSpec s,bool demo)=>new(){CompanyId=companyId,Title=s.Title,City=s.City,Category=s.Category,WorkMode=s.WorkMode,Experience=s.Experience,SalaryMin=s.SalaryMin,SalaryMax=s.SalaryMax,Skills=s.Skills,Description="DỮ LIỆU KIỂM THỬ ĐỒ ÁN — không phải tin tuyển dụng thực tế.\n"+s.Description,Requirements=s.Requirements,Benefits=s.Benefits,IsDemo=demo,Status="Published",Vacancies=2,Deadline=DateTimeOffset.UtcNow.AddDays(90)};
record Scenario(List<CandidateSpec> Candidates,List<JobSpec> Jobs,List<CompanySpec> Companies);
record CandidateSpec(string Email,string Name,string Group,string Role,string City,string Summary,string Skills,string Experience,string Projects,string Education);
record CompanySpec(string Name,string Industry,string Color,JobSpec Job);
record JobSpec(string Title,string City,string Category,string WorkMode,string Experience,decimal SalaryMin,decimal SalaryMax,string Skills,string Description,string Requirements,string Benefits);
