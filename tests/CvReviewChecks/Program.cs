using System.IO.Compression;
using System.Text.Json;
using System.Xml.Linq;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using webAI.Data;
using webAI.Models;
using webAI.Services;
using webAI.Controllers;

void Check(bool value,string message){if(!value)throw new Exception(message);}
using(var client=new HttpClient(new MultipartFilenameHandler())) {
    var ai=new AiMatchingService(client,NullLogger<AiMatchingService>.Instance,new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build());
    using var stream=new MemoryStream([1,2,3]);
    await ai.MatchFileAsync(stream,"Hồ sơ ứng viên.pdf","{}",CancellationToken.None);
}
var content=new string('x',6000)+" C# SQL Server";
var bytes=ReviewWorkbook.Write(ReviewWorkbook.ImportHeaders,[new object?[]{"Ứng viên kiểm thử","sample@example.test",content}]);
using(var zip=new ZipArchive(new MemoryStream(bytes))) {
    Check(zip.GetEntry("[Content_Types].xml")!=null,"Not an XLSX package");
    foreach(var entry in zip.Entries.Where(e=>e.Name.EndsWith("xml")||e.Name.EndsWith("rels"))){using var stream=entry.Open();XDocument.Load(stream);}
}
using var uploadStream=new MemoryStream(bytes);
var rows=await ReviewWorkbook.ReadAsync(new FormFile(uploadStream,0,bytes.Length,"file","sample.xlsx"));
Check(rows.Count==1&&rows[0].Name=="Ứng viên kiểm thử"&&rows[0].CvText==content,"Workbook Unicode/text roundtrip failed");
using(var bad=new MemoryStream()) {
    bad.Write(bytes);using(var zip=new ZipArchive(bad,ZipArchiveMode.Update,true)) {
        var entry=zip.GetEntry("xl/worksheets/sheet1.xml")!;XDocument sheet;using(var stream=entry.Open())sheet=XDocument.Load(stream);entry.Delete();XNamespace ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        sheet.Descendants(ns+"c").Single(c=>(string?)c.Attribute("r")=="C2").Add(new XElement(ns+"f","1+1"));using var output=zip.CreateEntry("xl/worksheets/sheet1.xml").Open();sheet.Save(output);
    }
    bad.Position=0;try{await ReviewWorkbook.ReadAsync(new FormFile(bad,0,bad.Length,"file","formulas.xlsx"));throw new Exception("Imported executable formula");}catch(ArgumentException){}
}
var oversizedRows=ReviewWorkbook.Write(ReviewWorkbook.ImportHeaders,Enumerable.Range(0,51).Select(i=>new object?[]{"Fixture", "", "Sample CV text"}).ToList());
using(var stream=new MemoryStream(oversizedRows)){try{await ReviewWorkbook.ReadAsync(new FormFile(stream,0,stream.Length,"file","too-many.xlsx"));throw new Exception("Imported more than 50 rows");}catch(ArgumentException){}}
var export=ReviewWorkbook.Write(["Name","Score"],[new object?[]{"=HYPERLINK(\"https://invalid\")",0},new object?[]{"Missing",null}]);
using(var zip=new ZipArchive(new MemoryStream(export))) {using var stream=zip.GetEntry("xl/worksheets/sheet1.xml")!.Open();var sheet=XDocument.Load(stream);XNamespace ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";Check(!sheet.Descendants(ns+"f").Any(),"Formula injection");Check(sheet.Descendants(ns+"c").Single(c=>(string?)c.Attribute("r")=="B2").Element(ns+"v")!.Value=="0","Lost zero score");Check(!sheet.Descendants(ns+"c").Single(c=>(string?)c.Attribute("r")=="B3").Elements().Any(),"Null score became zero");}
// Test scores below are isolated fixtures in a transaction which is rolled back.
var options=new DbContextOptionsBuilder<RecruitmentDbContext>().UseSqlServer("Server=(localdb)\\MSSQLLocalDB;Database=AIRecruitmentDb;Integrated Security=true;TrustServerCertificate=true").Options;
await using var db=new RecruitmentDbContext(options);await using var transaction=await db.Database.BeginTransactionAsync();
try {
    var company=await (from c in db.Companies join u in db.Users on c.OwnerSubject equals u.UserId.ToString() where u.RoleName=="Recruiter"&&u.IsActive orderby c.Id select c.Id).FirstAsync();
    var postedJob=await db.Jobs.Where(j=>j.CompanyId==company).OrderBy(j=>j.Id).FirstAsync();
    var applicationIds=await db.Applications.Where(a=>a.JobId==postedJob.Id).Select(a=>a.Id).Take(2).ToListAsync();
    while(applicationIds.Count<2){
        var fixtureToken=Guid.NewGuid().ToString("N");var candidate=new CandidateProfile{Subject="rollback-fixture-"+fixtureToken,Email=fixtureToken+"@example.test",FullName="Rollback fixture"};db.Candidates.Add(candidate);await db.SaveChangesAsync();
        var source=await db.Resumes.AsNoTracking().Where(r=>r.ContentType=="application/pdf").FirstAsync();var resume=new Resume{CandidateId=candidate.Id,Name="Rollback fixture.pdf",StorageKey=source.StorageKey,ContentType=source.ContentType,Size=source.Size};db.Resumes.Add(resume);await db.SaveChangesAsync();
        var application=new JobApplication{CandidateId=candidate.Id,ResumeId=resume.Id,JobId=postedJob.Id};db.Applications.Add(application);await db.SaveChangesAsync();applicationIds.Add(application.Id);
    }
    var fake=new FixtureAi();var store=new PrivateDocumentStore(db);var service=new CvReviewService(db,store,fake,NullLogger<CvReviewService>.Instance);
    var request=new ReviewCreateRequest{JobId=postedJob.Id,Configuration=new AiMatchingRequest{JobTitle="FORGED CLIENT TITLE",JobDescription="FORGED CLIENT JD",RequiredSkills=["FORGED"],JobExperienceYearsRequired=99,ModelType="TF-IDF"},ApplicationIds=applicationIds,ExternalRows=[new ExternalCvRow{Name="Fixture only",CvText=content}]};
    var batch=await service.CreateAsync(company,request,new FormFileCollection());
    var frozen=JsonSerializer.Deserialize<AiMatchingRequest>((await db.CvReviewBatches.AsNoTracking().SingleAsync(b=>b.Id==batch.Id)).ConfigurationJson,CvReviewService.Json)!;
    Check(frozen.JobId==postedJob.Id&&frozen.JobTitle==postedJob.Title&&frozen.JobDescription.Contains(postedJob.Description)&&!frozen.JobDescription.Contains("FORGED")&&!frozen.RequiredSkills.Contains("FORGED"),"Client replaced authoritative posted JD");
    Check(frozen.JobExperienceYearsRequired==CvReviewService.MinimumYears(postedJob.Experience),"Experience not from stored job");
    Check(CvReviewService.MinimumYears("2–4 năm")==2&&CvReviewService.MinimumYears("Không yêu cầu")==0&&CvReviewService.MinimumYears("Thực tập sinh")==null,"Experience interpretation fabricated years");
    var items=await db.CvReviewItems.Where(i=>i.BatchId==batch.Id).OrderBy(i=>i.Id).ToListAsync();Check(items.Count==3,"Selection lost");
    Check(await service.AnalyzeAsync(batch.Id,items[0].Id,company+100000,CancellationToken.None)==null,"Cross-company analysis allowed");
    var first=await service.AnalyzeAsync(batch.Id,items[0].Id,company,CancellationToken.None);Check(first!.State=="Complete"&&first.Score==0,"Genuine zero not persisted");
    await service.AnalyzeAsync(batch.Id,items[0].Id,company,CancellationToken.None);Check(fake.Calls==1,"Completed item recomputed");
    var second=await service.AnalyzeAsync(batch.Id,items[1].Id,company,CancellationToken.None);Check(second!.Score==82,"Fixture response not persisted");
    fake.Fail=true;var failed=await service.AnalyzeAsync(batch.Id,items[2].Id,company,CancellationToken.None);Check(failed!.State=="Error"&&failed.Score==null&&failed.ResultJson=="","Failure invented score");
    fake.Fail=false;var retried=await service.AnalyzeAsync(batch.Id,items[2].Id,company,CancellationToken.None);Check(retried!.State=="Complete","Retry failed");
    db.ChangeTracker.Clear();var reloaded=await db.CvReviewItems.Where(i=>i.BatchId==batch.Id).ToListAsync();Check(reloaded.All(i=>i.State=="Complete"),"Results not re-readable");Check(reloaded.Single(i=>i.Source=="ExcelOrText").CvText==content,"Stored CV text truncated");
    var anotherJob=new JobPosting{CompanyId=company,Title="TRANSACTION TEST JD",Description=new string('j',2000),Requirements="Stored requirement",Skills="C#, SQL Server",Experience="2–4 năm",Status="Draft",Deadline=DateTimeOffset.UtcNow.AddDays(1)};db.Jobs.Add(anotherJob);await db.SaveChangesAsync();
    try{await service.CreateAsync(company,new ReviewCreateRequest{JobId=anotherJob.Id,ApplicationIds=applicationIds},new FormFileCollection());throw new Exception("Applications from a different job accepted");}catch(ArgumentException){}
    var textOnly=await service.CreateAsync(company,new ReviewCreateRequest{JobId=anotherJob.Id,ExternalRows=[new ExternalCvRow{Name="Text only fixture",CvText=content}]},new FormFileCollection());
    Check(await db.CvReviewItems.CountAsync(i=>i.BatchId==textOnly.Id)==1,"External-only selection failed");
    Check((await db.CvReviewBatches.AsNoTracking().SingleAsync(b=>b.Id==textOnly.Id)).ConfigurationJson.Length>2000,"Long stored JD truncated");
    anotherJob.Description="Job changed after the review started";await db.SaveChangesAsync();Check((await db.CvReviewBatches.AsNoTracking().SingleAsync(b=>b.Id==textOnly.Id)).ConfigurationJson.Contains(new string('j',2000)),"Saved JD changed retroactively");
    var owner=await db.Companies.Where(c=>c.Id==company).Select(c=>c.OwnerSubject).SingleAsync();
    var controller=new CvReviewsController(db,service,new CvReviewQueue(db)){ControllerContext=new ControllerContext{HttpContext=new DefaultHttpContext{User=new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,owner)],"test"))}}};
    using(var excel=new MemoryStream(bytes)){var preview=(OkObjectResult)await controller.Import(new FormFile(excel,0,bytes.Length,"file","sample.xlsx"));Check(((List<ExternalCvRow>)preview.Value!).Count==1,"Positive Excel import preview failed");}
    var detail=(OkObjectResult)await controller.Detail(batch.Id,sort:"desc");var json=JsonSerializer.SerializeToElement(detail.Value,CvReviewService.Json);
    var previewPdf=(OkObjectResult)await controller.Preview(batch.Id,items[0].Id);Check(JsonSerializer.SerializeToElement(previewPdf.Value,CvReviewService.Json).GetProperty("kind").GetString()=="pdf","Stored review PDF preview unavailable");
    var originalDocument=(FileContentResult)await controller.Document(batch.Id,items[0].Id,true);Check(originalDocument.ContentType=="application/pdf"&&originalDocument.FileContents.AsSpan().StartsWith("%PDF-"u8),"Review download not original PDF");
    var textItem=items.Single(i=>i.Source=="ExcelOrText");var textPreview=(OkObjectResult)await controller.Preview(batch.Id,textItem.Id);Check(JsonSerializer.SerializeToElement(textPreview.Value,CvReviewService.Json).GetProperty("text").GetString()==content,"External text preview did not use saved CV");
    Check(await controller.Document(batch.Id,textItem.Id) is NotFoundResult,"Text CV invented original file");
    Check(await controller.Preview(textOnly.Id,items[0].Id) is NotFoundResult,"Item from another batch leaked");
    var searchResult=(OkObjectResult)await controller.List(q:"TRANSACTION TEST JD");var searchJson=JsonSerializer.SerializeToElement(searchResult.Value,CvReviewService.Json);Check(searchJson.EnumerateArray().All(b=>b.GetProperty("title").GetString()!.Contains("TRANSACTION TEST JD")),"Batch title filter ignored");
    Check(await controller.List(from:DateTimeOffset.UtcNow.AddDays(1),to:DateTimeOffset.UtcNow) is BadRequestObjectResult,"Invalid batch date range accepted");
    Check(json.GetProperty("items")[0].GetProperty("score").GetDouble()==82,"Descending score order incorrect");
    var filtered=(OkObjectResult)await controller.Detail(batch.Id,min:1);Check(JsonSerializer.SerializeToElement(filtered.Value,CvReviewService.Json).GetProperty("items").GetArrayLength()==2,"Score filter incorrect");
    var workbook=(FileContentResult)await controller.Export(batch.Id,min:1);using(var package=new ZipArchive(new MemoryStream(workbook.FileContents))){using var stream=package.GetEntry("xl/worksheets/sheet1.xml")!.Open();XNamespace ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";Check(XDocument.Load(stream).Descendants(ns+"row").Count()==3,"Excel export did not use the displayed filter");}
    var other=new Company{OwnerSubject="transaction-test-only",Name="Transaction company"};db.Companies.Add(other);await db.SaveChangesAsync();
    var searchBatch=new CvReviewBatch{CompanyId=company,Title="Đợt đối chiếu Thiết kế Dữ liệu",Model="TF-IDF",ConfigurationJson=batch.ConfigurationJson};db.CvReviewBatches.Add(searchBatch);var searchItem=new CvReviewItem{BatchId=searchBatch.Id,Name="ĐỖ Nguyễn Ánh",Email="anh@example.test",Source="ExcelOrText",CvText=content,State="Complete",Score=42};db.CvReviewItems.Add(searchItem);await db.SaveChangesAsync();
    foreach(var query in new[]{"dot doi chieu thiet ke du lieu","ĐỢT ĐỐI CHIẾU THIẾT KẾ DỮ LIỆU","Đợt đối chiếu Thiết kế Dữ liệu".Normalize(System.Text.NormalizationForm.FormD)}){
        var found=(OkObjectResult)await controller.List(q:query);Check(JsonSerializer.SerializeToElement(found.Value,CvReviewService.Json).EnumerateArray().Any(b=>b.GetProperty("id").GetGuid()==searchBatch.Id),"Unaccented batch search failed: "+query);
    }
    foreach(var query in new[]{"do nguyen anh","ĐỖ NGUYỄN ÁNH","Đỗ Nguyễn Ánh".Normalize(System.Text.NormalizationForm.FormD),"ANH@EXAMPLE.TEST"}){
        var found=(OkObjectResult)await controller.Detail(searchBatch.Id,q:query);Check(JsonSerializer.SerializeToElement(found.Value,CvReviewService.Json).GetProperty("items").GetArrayLength()==1,"Unaccented CV search failed: "+query);
    }
    using(var package=new ZipArchive(new MemoryStream(((FileContentResult)await controller.Export(searchBatch.Id,q:"do nguyen anh")).FileContents))){using var stream=package.GetEntry("xl/worksheets/sheet1.xml")!.Open();XNamespace ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";Check(XDocument.Load(stream).Descendants(ns+"row").Count()==2,"Unaccented export did not match displayed filter");}
    Console.WriteLine("PASS: SQL accent-insensitive title/name/email search, capital Đ, combining Unicode and Excel filter consistency (rollback).");
    using(var docx=new MemoryStream()){
        using(var package=new ZipArchive(docx,ZipArchiveMode.Create,true)){
            using(var writer=new StreamWriter(package.CreateEntry("[Content_Types].xml").Open()))writer.Write("<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"/>");
            using(var writer=new StreamWriter(package.CreateEntry("word/document.xml").Open()))writer.Write("<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>CV tiếng Việt kiểm thử DOCX</w:t></w:r></w:p></w:body></w:document>");
        }
        docx.Position=0;var key=await store.SaveAsync(new FormFile(docx,0,docx.Length,"file","fixture.docx"));var fixture=new CvReviewItem{BatchId=batch.Id,Name="DOCX fixture",Source="Upload",FileName="fixture.docx",StorageKey=key};db.CvReviewItems.Add(fixture);await db.SaveChangesAsync();
        var preview=(OkObjectResult)await controller.Preview(batch.Id,fixture.Id);Check(JsonSerializer.SerializeToElement(preview.Value,CvReviewService.Json).GetProperty("text").GetString()=="CV tiếng Việt kiểm thử DOCX","DOCX preview corrupted Vietnamese text");
        Check(((FileContentResult)await controller.Document(batch.Id,fixture.Id)).ContentType.Contains("wordprocessingml"),"DOCX original not downloadable");
        var application=await db.Applications.SingleAsync(a=>a.Id==applicationIds[0]);var resume=await db.Resumes.SingleAsync(r=>r.Id==application.ResumeId);var originalKey=resume.StorageKey;resume.StorageKey=key;await db.SaveChangesAsync();
        var frozenDocument=(FileContentResult)await controller.Document(batch.Id,items[0].Id,true);Check(frozenDocument.FileContents.SequenceEqual(originalDocument.FileContents),"Review preview followed candidate CV replacement instead of frozen file");resume.StorageKey=originalKey;await db.SaveChangesAsync();
    }
    Check(await controller.List(to:DateTimeOffset.UtcNow.AddDays(-2)) is OkObjectResult oldList&&JsonSerializer.SerializeToElement(oldList.Value,CvReviewService.Json).EnumerateArray().All(b=>b.GetProperty("createdAt").GetDateTimeOffset()<DateTimeOffset.UtcNow.AddDays(-2)),"Batch date filter ignored");
    controller.ControllerContext.HttpContext.User=new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,other.OwnerSubject)],"test"));
    Check(await controller.Detail(batch.Id) is NotFoundResult,"Cross-company detail allowed");Check(await controller.Export(batch.Id) is NotFoundResult,"Cross-company export allowed");
    Check(await controller.Preview(batch.Id,items[0].Id) is NotFoundResult,"Cross-company preview allowed");Check(await controller.Document(batch.Id,items[0].Id) is NotFoundResult,"Cross-company document allowed");
    Console.WriteLine("PASS: Review PDF/DOCX/text preview, frozen document after CV replacement, batch/date filters and foreign-company document denial (rollback).");
    try{await service.CreateAsync(other.Id,new ReviewCreateRequest{JobId=postedJob.Id,ApplicationIds=applicationIds},new FormFileCollection());throw new Exception("Cross-company selection accepted");}catch(ArgumentException){}
    // Verify the user's 30 / 50 / 20 scenario without leaving demo data behind.
    var scopeJobs=new[]{"Backend","Frontend","Database"}.Select(title=>new JobPosting{CompanyId=company,Title="TRANSACTION "+title,Description=title+" developer JD",Status="Draft",Deadline=DateTimeOffset.UtcNow.AddDays(1)}).ToArray();
    var foreignJob=new JobPosting{CompanyId=other.Id,Title=scopeJobs[0].Title,Description="Other company's JD",Status="Draft",Deadline=DateTimeOffset.UtcNow.AddDays(1)};
    db.Jobs.AddRange(scopeJobs);db.Jobs.Add(foreignJob);await db.SaveChangesAsync();
    var marker=Guid.NewGuid().ToString("N");var candidates=Enumerable.Range(0,50).Select(i=>new CandidateProfile{Subject=$"scope-test-{marker}-{i}",FullName=$"Transaction fixture {i}",Email=$"fixture{i}@example.test"}).ToArray();db.Candidates.AddRange(candidates);await db.SaveChangesAsync();
    var resumes=candidates.Select(c=>new Resume{CandidateId=c.Id,Name="Scope test only.docx",StorageKey="transaction-only-not-a-real-file.docx"}).ToArray();db.Resumes.AddRange(resumes);await db.SaveChangesAsync();
    var expectedCounts=new[]{30,50,20};
    for(var j=0;j<scopeJobs.Length;j++)for(var i=0;i<expectedCounts[j];i++)db.Applications.Add(new JobApplication{CandidateId=candidates[i].Id,ResumeId=resumes[i].Id,JobId=scopeJobs[j].Id});
    var foreignApplication=new JobApplication{CandidateId=candidates[0].Id,ResumeId=resumes[0].Id,JobId=foreignJob.Id};db.Applications.Add(foreignApplication);await db.SaveChangesAsync();
    var inbox=new WorkspaceController(db,store){ControllerContext=new ControllerContext{HttpContext=new DefaultHttpContext{User=new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,owner),new Claim(ClaimTypes.Role,"Recruiter")],"test"))}}};
    for(var j=0;j<scopeJobs.Length;j++){
        var response=(OkObjectResult)await inbox.Applications(scopeJobs[j].Id);var itemsJson=JsonSerializer.SerializeToElement(response.Value,CvReviewService.Json);
        Check(itemsJson.GetArrayLength()==expectedCounts[j],$"Expected {expectedCounts[j]} for {scopeJobs[j].Title}");
        Check(itemsJson.EnumerateArray().All(i=>i.GetProperty("jobId").GetInt32()==scopeJobs[j].Id),"Mixed applications across jobs");
    }
    Check(await inbox.Applications(foreignJob.Id) is NotFoundResult,"Another company's job can be queried");
    var allOwn=(OkObjectResult)await inbox.Applications();Check(!JsonSerializer.SerializeToElement(allOwn.Value,CvReviewService.Json).EnumerateArray().Any(i=>i.GetProperty("jobId").GetInt32()==foreignJob.Id),"Unfiltered inbox leaks another company");
    var backendIds=await db.Applications.Where(a=>a.JobId==scopeJobs[0].Id).Select(a=>a.Id).ToListAsync();
    Check(await inbox.Respond(foreignApplication.Id,new ResponseRequest{Title="Fixture",Content="Must not send"}) is NotFoundResult,"Cross-company feedback allowed");
    Check(await inbox.Responses(foreignApplication.Id) is NotFoundResult,"Cross-company feedback history allowed");
    var responseId=backendIds[0];
    Check(await inbox.RespondBatch(new BatchResponseRequest{ApplicationIds=[responseId,foreignApplication.Id],Status="Rejected",Title="Fixture",Content="No recipient must receive this"}) is NotFoundObjectResult,"Mixed-company batch accepted");
    Check(!await db.Notifications.AnyAsync(n=>n.ApplicationId==responseId),"Mixed-company batch partially sent");
    Check(await inbox.RespondBatch(new BatchResponseRequest{ApplicationIds=[responseId],Status="Admin",Title="Fixture",Content="No"}) is BadRequestObjectResult,"Invalid outcome accepted");
    Check(await inbox.Respond(responseId,new ResponseRequest{Title="Transaction invitation",Content="Interview details fixture"}) is OkResult,"Feedback creation failed");
    var historyJson=JsonSerializer.SerializeToElement(((OkObjectResult)await inbox.Responses(responseId)).Value,CvReviewService.Json);
    Check(historyJson.GetArrayLength()==1&&historyJson[0].GetProperty("content").GetString()=="Interview details fixture","Feedback history not persisted");
    var responseSubject=await db.Applications.Where(a=>a.Id==responseId).Join(db.Candidates,a=>a.CandidateId,c=>c.Id,(a,c)=>c.Subject).SingleAsync();
    inbox.ControllerContext.HttpContext.User=new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,responseSubject),new Claim(ClaimTypes.Role,"Candidate")],"test"));
    var candidateNotifications=JsonSerializer.SerializeToElement(((OkObjectResult)await inbox.Notifications()).Value,CvReviewService.Json);
    Check(candidateNotifications.GetArrayLength()==1&&candidateNotifications[0].GetProperty("title").GetString()=="Transaction invitation","Candidate cannot receive feedback");
    inbox.ControllerContext.HttpContext.User=new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,owner),new Claim(ClaimTypes.Role,"Recruiter")],"test"));
    var batchFeedback=(OkObjectResult)await inbox.RespondBatch(new BatchResponseRequest{ApplicationIds=[responseId,backendIds[1],responseId],Status="Rejected",Title="Transaction batch",Content="Common message fixture"});
    Check(JsonSerializer.SerializeToElement(batchFeedback.Value,CvReviewService.Json).GetProperty("sent").GetInt32()==2,"Batch duplicated recipients");
    Check(await db.Notifications.CountAsync(n=>n.Title=="Transaction batch")==2,"Batch notifications were not persisted");
    Check(await db.Applications.CountAsync(a=>new[]{responseId,backendIds[1]}.Contains(a.Id)&&a.Status=="Rejected")==2,"Batch status update failed");
    inbox.ControllerContext.HttpContext.User=new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,responseSubject),new Claim(ClaimTypes.Role,"Candidate")],"test"));
    var candidateDetail=JsonSerializer.SerializeToElement(((OkObjectResult)await inbox.ApplicationDetail(responseId)).Value,CvReviewService.Json);
    Check(candidateDetail.GetProperty("application").GetProperty("company").GetProperty("id").GetInt32()==company,"Candidate detail mixed company");
    Check(candidateDetail.GetProperty("application").GetProperty("status").GetString()=="Rejected","Candidate detail lost result");
    Check(candidateDetail.GetProperty("responses").EnumerateArray().Any(n=>n.GetProperty("content").GetString()=="Common message fixture"),"Candidate detail lost response body");
    Check(await inbox.ApplicationDetail(backendIds[1]) is NotFoundResult,"Candidate saw another candidate's application");
    var notices=JsonSerializer.SerializeToElement(((OkObjectResult)await inbox.Notifications()).Value,CvReviewService.Json);
    Check(notices.EnumerateArray().All(n=>n.GetProperty("applicationId").GetInt32()==responseId&&!n.TryGetProperty("content",out _)),"Notification must link to own application without full body");
    Check(notices[0].GetProperty("companyName").GetString()==(await db.Companies.FindAsync(company))!.Name,"Notification lost company identity");
    var otherNotification=await db.Notifications.FirstAsync(n=>n.ApplicationId==backendIds[1]);
    Check(await inbox.ReadNotification(otherNotification.Id) is NotFoundResult,"Candidate marked another candidate's notification read");
    var legacySubject="legacy-fixture-"+Guid.NewGuid().ToString("N");db.Notifications.Add(new RecruitmentNotification{RecipientSubject=legacySubject,Title="System fixture",Content="No application"});await db.SaveChangesAsync();
    inbox.ControllerContext.HttpContext.User=new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,legacySubject)],"test"));
    var legacyNotices=JsonSerializer.SerializeToElement(((OkObjectResult)await inbox.Notifications()).Value,CvReviewService.Json);
    Check(legacyNotices[0].GetProperty("companyName").ValueKind==JsonValueKind.Null,"Legacy notification without application failed");
    inbox.ControllerContext.HttpContext.User=new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,owner),new Claim(ClaimTypes.Role,"Recruiter")],"test"));
    Console.WriteLine("PASS: Candidate application details, company/result/reply, notification links and owner isolation (rollback).");
    var realResume=await db.Resumes.FindAsync((await db.Applications.FindAsync(applicationIds[0]))!.ResumeId);
    Check(await inbox.PreviewResume(realResume!.Id) is OkObjectResult,"Private PDF preview failed");
    Check(await inbox.DownloadResume(realResume.Id,true) is FileContentResult{FileDownloadName:""},"Inline PDF is still an attachment");
    inbox.ControllerContext.HttpContext.User=new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,other.OwnerSubject),new Claim(ClaimTypes.Role,"Recruiter")],"test"));
    Check(await inbox.PreviewResume(realResume.Id) is NotFoundResult,"Foreign company preview allowed");
    inbox.ControllerContext.HttpContext.User=new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,owner),new Claim(ClaimTypes.Role,"Recruiter")],"test"));
    var fixtureDocx=await File.ReadAllBytesAsync("data/sample_cvs/CV_LeHoangLong_Fresher_DotNet.docx");
    using(var docxStream=new MemoryStream(fixtureDocx)){
        var docxKey=await store.SaveAsync(new FormFile(docxStream,0,fixtureDocx.Length,"file","fixture-preview.docx"));
        try{
            var app=await db.Applications.FindAsync(responseId);var oldResumeId=app!.ResumeId;
            var docxResume=new Resume{CandidateId=app.CandidateId,StorageKey=docxKey,Name="fixture-preview.docx",ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document"};db.Resumes.Add(docxResume);await db.SaveChangesAsync();
            app.ResumeId=docxResume.Id;await db.SaveChangesAsync();
            var previewJson=JsonSerializer.SerializeToElement(((OkObjectResult)await inbox.PreviewResume(docxResume.Id)).Value,CvReviewService.Json);
            Check(previewJson.GetProperty("kind").GetString()=="text"&&previewJson.GetProperty("text").GetString()!.Length>100,"DOCX preview extraction failed");
            app.ResumeId=oldResumeId;await db.SaveChangesAsync();
        }finally{await store.RemoveAsync(docxKey);}
    }
    var scopedResume=await db.Resumes.SingleAsync(r=>r.Id==resumes[0].Id);
    var configJson=JsonSerializer.Serialize(new AiMatchingRequest{JobId=scopeJobs[0].Id,ModelType="Hybrid"},CvReviewService.Json);
    var assessmentBatch=new CvReviewBatch{CompanyId=company,ConfigurationJson=configJson,Model="Hybrid"};db.CvReviewBatches.Add(assessmentBatch);
    db.CvReviewItems.Add(new CvReviewItem{BatchId=assessmentBatch.Id,Source="Application",StorageKey=scopedResume.StorageKey,State="Complete",Score=42,ResultJson="{}",AnalyzedAt=DateTimeOffset.UtcNow});
    await db.SaveChangesAsync();
    var assessmentRows=JsonSerializer.SerializeToElement(((OkObjectResult)await inbox.Assessments()).Value,CvReviewService.Json);
    Check(assessmentRows.EnumerateArray().Single(a=>a.GetProperty("applicationId").GetInt32()==responseId).GetProperty("assessment").GetProperty("score").GetDouble()==42,"Assessment did not match CV/JD");
    Check(assessmentRows.EnumerateArray().Where(a=>a.GetProperty("applicationId").GetInt32()!=responseId&&new[]{scopeJobs[1].Id,scopeJobs[2].Id}.Contains((db.Applications.Find(a.GetProperty("applicationId").GetInt32()))!.JobId)).All(a=>a.GetProperty("assessment").ValueKind==JsonValueKind.Null),"Assessment leaked across JDs");
    Console.WriteLine("PASS: Feedback persistence, candidate notification and company isolation (transaction rollback).");
    var backendBatch=await service.CreateAsync(company,new ReviewCreateRequest{JobId=scopeJobs[0].Id,ApplicationIds=backendIds},new FormFileCollection());Check(await db.CvReviewItems.CountAsync(i=>i.BatchId==backendBatch.Id)==30,"Select-all Backend did not preserve its 30 applications");
    var frontendApplication=await db.Applications.FirstAsync(a=>a.JobId==scopeJobs[1].Id);
    foreach(var wrongId in new[]{frontendApplication.Id,foreignApplication.Id}){
        try{await service.CreateAsync(company,new ReviewCreateRequest{JobId=scopeJobs[0].Id,ApplicationIds=[wrongId]},new FormFileCollection());throw new Exception("Cross-job or cross-company CV accepted");}catch(ArgumentException){}
    }
    Console.WriteLine("PASS: Backend 30, Frontend 50, Database 20; foreign job blocked; select-all and analysis ownership checked (transaction rollback).");
    // New job categories survive persistence; invalid values are rejected.
    inbox.ControllerContext.HttpContext.User=new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,owner),new Claim(ClaimTypes.Role,"Recruiter")],"test"));
    var categoryRequest=new JobRequest{Title="Kiểm tra ngành thiết kế",City="Hà Nội",Category="Thiết kế",Description="Mô tả kiểm thử",Requirements="Yêu cầu kiểm thử",Experience="2 - 4 năm",Deadline=DateTimeOffset.UtcNow.AddDays(1)};
    var categoryResult=JsonSerializer.SerializeToElement(((OkObjectResult)await inbox.CreateJob(categoryRequest)).Value,CvReviewService.Json);
    var categoryJob=await db.Jobs.FindAsync(categoryResult.GetProperty("id").GetInt32());
    Check(categoryJob!.Category=="Thiết kế"&&categoryJob.Experience=="2–4 năm","Category or normalized experience was lost");
    var editRequest=new JobRequest{Title="Bản nháp đã cập nhật",City="Đà Nẵng",Category="Thiết kế",Description="JD sửa trong giao dịch kiểm thử",Requirements="Yêu cầu kiểm thử",Deadline=DateTimeOffset.UtcNow.AddDays(2),SalaryMin=10,SalaryMax=20};
    Check(await inbox.UpdateJob(categoryJob.Id,editRequest) is OkObjectResult,"Own unused draft edit failed");
    Check(categoryJob.Title==editRequest.Title&&categoryJob.City=="Đà Nẵng","Draft edit fields did not persist");
    var lockedSnapshot=new CvReviewBatch{CompanyId=company,Title="Immutable JD snapshot",Model="TF-IDF",ConfigurationJson=JsonSerializer.Serialize(new AiMatchingRequest{JobId=categoryJob.Id,JobDescription=categoryJob.Description},CvReviewService.Json)};
    db.CvReviewBatches.Add(lockedSnapshot);await db.SaveChangesAsync();var frozenJson=lockedSnapshot.ConfigurationJson;
    Check(await inbox.UpdateJob(categoryJob.Id,editRequest) is ConflictObjectResult,"Editing a previously analyzed JD was allowed");
    Check(lockedSnapshot.ConfigurationJson==frozenJson,"Historical review configuration changed");
    var copyRequest=new JobRequest{Title=categoryJob.Title,City=categoryJob.City,Category=categoryJob.Category,Description=categoryJob.Description,Requirements=categoryJob.Requirements,Deadline=DateTimeOffset.UtcNow.AddDays(3)};
    var copyResult=JsonSerializer.SerializeToElement(((OkObjectResult)await inbox.CreateJob(copyRequest)).Value,CvReviewService.Json);
    var copied=await db.Jobs.SingleAsync(j=>j.Id==copyResult.GetProperty("id").GetInt32());
    Check(copied.Id!=categoryJob.Id&&copied.Status=="Draft"&&copied.Description==categoryJob.Description&&copied.CompanyId==categoryJob.CompanyId,"Copy did not create an independent owned draft");
    Check(!await db.Applications.AnyAsync(a=>a.JobId==copied.Id)&&lockedSnapshot.ConfigurationJson==frozenJson,"Copy changed old applications or AI snapshot");
    Check(await inbox.UpdateJob(postedJob.Id,editRequest) is ConflictObjectResult,"Editing a published JD with applications was allowed");
    inbox.ControllerContext.HttpContext.User=new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,other.OwnerSubject),new Claim(ClaimTypes.Role,"Recruiter")],"test"));
    Check(await inbox.OwnJob(categoryJob.Id) is NotFoundResult&&await inbox.UpdateJob(categoryJob.Id,editRequest) is NotFoundResult,"Cross-company draft access allowed");
    inbox.ControllerContext.HttpContext.User=new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,owner),new Claim(ClaimTypes.Role,"Recruiter")],"test"));
    Console.WriteLine("PASS: Draft editing, immutable analyzed/published JD and cross-company edit isolation (rollback).");
    categoryRequest.Category="INVALID";Check(await inbox.CreateJob(categoryRequest) is BadRequestObjectResult,"Invalid category accepted");
    var publicController=new JobsController(db,NullLogger<JobsController>.Instance){ControllerContext=new ControllerContext{HttpContext=new DefaultHttpContext()}};
    Check(await publicController.Detail(categoryJob.Id,CancellationToken.None) is NotFoundObjectResult,"Guest read draft job");
    categoryJob.Status="Closed";await db.SaveChangesAsync();
    var closed=JsonSerializer.SerializeToElement(((OkObjectResult)await publicController.Detail(categoryJob.Id,CancellationToken.None)).Value,CvReviewService.Json);
    Check(closed.GetProperty("id").GetInt32()==categoryJob.Id&&!closed.GetProperty("canApply").GetBoolean(),"Closed job detail disappeared or still allowed applications");
    categoryJob.Status="Published";categoryJob.Deadline=DateTimeOffset.UtcNow.AddDays(-1);await db.SaveChangesAsync();
    var expired=JsonSerializer.SerializeToElement(((OkObjectResult)await publicController.Detail(categoryJob.Id,CancellationToken.None)).Value,CvReviewService.Json);
    Check(!expired.GetProperty("canApply").GetBoolean(),"Expired job allowed applications");
    for(var index=0;index<201;index++)db.Jobs.Add(new JobPosting{CompanyId=company,Title="Kiểm tra phân trang "+index,Status="Published",Deadline=DateTimeOffset.UtcNow.AddDays(1)});
    await db.SaveChangesAsync();
    var allJobs=JsonSerializer.SerializeToElement(((OkObjectResult)await publicController.List(CancellationToken.None)).Value,CvReviewService.Json);
    Check(allJobs.GetArrayLength()>200,"Public jobs silently truncated at 200");
    Check(await publicController.Detail(postedJob.Id,CancellationToken.None) is OkObjectResult,"Older job detail unavailable beyond latest 200");
    Check(await db.Documents.AnyAsync(d=>d.StorageKey==realResume.StorageKey),"Existing resume bytes were not migrated to SQL");
    Check((await store.ReadAsync(realResume.StorageKey))!.Length>0,"SQL document read is empty");
    Console.WriteLine("PASS: SQL documents, category/experience persistence, closed/expired/draft details, and more than 200 jobs (rollback).");
    var queuedBatch=await service.CreateAsync(company,new ReviewCreateRequest{JobId=postedJob.Id,Configuration=new AiMatchingRequest{ModelType="TF-IDF"},ExternalRows=[new ExternalCvRow{Name="Queue fixture",CvText=content}]},new FormFileCollection());
    var queue=new CvReviewQueue(db);
    Check(!await queue.EnqueueAsync(queuedBatch.Id,company+100000)&&!await queue.PauseAsync(queuedBatch.Id,company+100000),"Foreign queue control allowed");
    Check(await queue.EnqueueAsync(queuedBatch.Id,company),"Own queue rejected");
    Check(await queue.PauseAsync(queuedBatch.Id,company),"Own pause rejected");
    db.ChangeTracker.Clear();Check((await db.CvReviewBatches.AsNoTracking().SingleAsync(b=>b.Id==queuedBatch.Id)).QueueState=="Paused","Pause was not persisted");
    var queuedItem=await db.CvReviewItems.SingleAsync(i=>i.BatchId==queuedBatch.Id);queuedItem.State="Running";queuedItem.AnalyzedAt=DateTimeOffset.UtcNow;await db.SaveChangesAsync();
    try{await service.AnalyzeAsync(queuedBatch.Id,queuedItem.Id,company,CancellationToken.None);throw new Exception("Active lease was stolen");}catch(InvalidOperationException){}
    queuedItem.AnalyzedAt=DateTimeOffset.UtcNow.AddMinutes(-6);await db.SaveChangesAsync();
    var recoveredLease=await service.AnalyzeAsync(queuedBatch.Id,queuedItem.Id,company,CancellationToken.None);Check(recoveredLease!.State=="Complete","Expired worker lease did not recover");
    var beforeCalls=fake.Calls;await service.AnalyzeAsync(queuedBatch.Id,queuedItem.Id,company,CancellationToken.None);Check(fake.Calls==beforeCalls,"Completed item was recomputed");
    queuedItem.State="Error";queuedItem.Score=null;await db.SaveChangesAsync();db.ChangeTracker.Clear();await queue.EnqueueAsync(queuedBatch.Id,company);
    Check((await db.CvReviewItems.AsNoTracking().SingleAsync(i=>i.Id==queuedItem.Id)).State=="Queued","Error was not queued for explicit retry");
    Console.WriteLine("PASS: Queue ownership, pause persistence, live/stale leases, retry and completed-item idempotency (rollback).");
} finally {await transaction.RollbackAsync();}
Console.WriteLine("PASS: XLSX structure, Unicode/long text, formula safety, zero/null distinction; SQL ownership, persisted configuration/results, idempotency, error and retry. Fixture scores rolled back.");

class MultipartFilenameHandler:HttpMessageHandler {
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct) {
        var body=await request.Content!.ReadAsStringAsync(ct);
        if(!body.Contains("filename=cv.pdf")&&!body.Contains("filename=\"cv.pdf\""))throw new Exception("Unicode filename obscured the parser extension");
        return new HttpResponseMessage(System.Net.HttpStatusCode.OK){Content=new StringContent("{}",System.Text.Encoding.UTF8,"application/json")};
    }
}
class FixtureAi:IAiMatchingService {
    public int Calls;public bool Fail;
    public Task<bool> CheckAiServiceHealthAsync(CancellationToken ct=default)=>Task.FromResult(true);
    public Task<JsonElement> MatchFileAsync(Stream stream,string name,string json,CancellationToken ct){if(Fail)throw new HttpRequestException("fixture outage");var score=Calls++==0?0:82;return Task.FromResult(JsonSerializer.SerializeToElement(new{success=true,model_used="TF-IDF",status="computed",overall_score=score,breakdown=new{semantic_score=score}}));}
    public Task<AiMatchingResponse> MatchAsync(AiMatchingRequest request,CancellationToken ct=default){if(Fail)throw new HttpRequestException("fixture outage");return Task.FromResult(new AiMatchingResponse{Success=true,ModelUsed="TF-IDF",OverallScore=82,Breakdown=new ScoreBreakdown{SemanticScore=82},AdditionalData=new(){["status"]=JsonSerializer.SerializeToElement("computed")}});}
}
class TestEnvironment:IWebHostEnvironment {
    public string ContentRootPath{get;set;}=Path.GetFullPath("webAI");public string WebRootPath{get;set;}="";public IFileProvider WebRootFileProvider{get;set;}=new NullFileProvider();public IFileProvider ContentRootFileProvider{get;set;}=new NullFileProvider();public string ApplicationName{get;set;}="Checks";public string EnvironmentName{get;set;}="Development";
}
