using System.IO.Compression;
using System.Security.Claims;
using System.Text;
using System.Xml;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using webAI.Controllers;
using webAI.Data;
using webAI.Services;

int checks = 0;
void Check(bool condition, string label) { if (!condition) throw new Exception(label); checks++; }
byte[] Docx(string body) {
    using var data = new MemoryStream();
    using (var zip = new ZipArchive(data, ZipArchiveMode.Create, true)) {
        using (var writer = new StreamWriter(zip.CreateEntry("[Content_Types].xml").Open())) writer.Write("<Types/>");
        using (var writer = new StreamWriter(zip.CreateEntry("word/document.xml").Open())) writer.Write(body);
    }
    return data.ToArray();
}
string Wrap(string content) => "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>" + content + "</w:body></w:document>";
void Reject(byte[] doc, string label) {
    try { DocxPreviewText.Read(doc); throw new Exception(label); }
    catch (Exception ex) when (ex is InvalidDataException or XmlException) { checks++; }
}
Check(DocxPreviewText.Read(Docx(Wrap("<w:p><w:r><w:t>Hồ sơ </w:t></w:r><w:r><w:t>Việt</w:t></w:r></w:p><w:p/><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Bảng</w:t></w:r></w:p></w:tc></w:tr></w:tbl>"))) == "Hồ sơ Việt\n\nBảng", "Ordinary runs, empty paragraph or table order changed");
var nested = Docx(Wrap("<w:p><w:p><w:r><w:t>nested</w:t></w:r></w:p></w:p>"));
Check(DocxPreviewText.Read(nested) == "\nnested", "Nested paragraph text was duplicated");
var textBox = Docx(Wrap("<w:p><w:r><w:t>Trước</w:t></w:r><w:r><w:drawing><w:txbxContent><w:p><w:r><w:t>Hộp văn bản</w:t></w:r></w:p></w:txbxContent></w:drawing></w:r><w:r><w:t>Sau</w:t></w:r></w:p>"));
Check(DocxPreviewText.Read(textBox) == "Trước\nHộp văn bảnSau", "Text box content lost or duplicated");
var excessiveDepth = Docx(Wrap(string.Concat(Enumerable.Repeat("<w:p>", 130)) + "<w:r><w:t>deep</w:t></w:r>" + string.Concat(Enumerable.Repeat("</w:p>", 130))));
Reject(Docx(Wrap(string.Concat(Enumerable.Repeat("<w:r>", 130)) + string.Concat(Enumerable.Repeat("</w:r>", 130)))), "Excessive depth accepted");
Check(DocxPreviewText.Read(Docx(Wrap("<w:p><w:r><w:t>" + new string('a', DocxPreviewText.MaxCharacters) + "</w:t></w:r></w:p>"))).Length == DocxPreviewText.MaxCharacters, "Exact preview limit rejected");
Reject(Docx(Wrap("<w:p><w:r><w:t>" + new string('a', DocxPreviewText.MaxCharacters + 1) + "</w:t></w:r></w:p>")), "Oversized text accepted");
Reject(Docx(Wrap("<w:p><w:r><w:t>" + new string('a', DocxPreviewText.MaxCharacters) + "</w:t></w:r></w:p><w:p/>")), "Separator bypassed preview budget");
Reject(Docx("<!DOCTYPE document [<!ENTITY test 'entity'>]>" + Wrap("<w:p><w:r><w:t>&test;</w:t></w:r></w:p>")), "DTD accepted");
Reject(Docx("<broken>"), "Malformed XML accepted");

var options = new DbContextOptionsBuilder<RecruitmentDbContext>().UseSqlServer("Server=(localdb)\\MSSQLLocalDB;Database=AIRecruitmentDb;Integrated Security=true;TrustServerCertificate=true").Options;
IConfiguration Budget(long count, long bytes) => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> {
    ["DocumentStorage:MaxDocuments"] = count.ToString(), ["DocumentStorage:MaxTotalBytes"] = bytes.ToString()
}).Build();
var pdf = Encoding.ASCII.GetBytes("%PDF-1.4\nSecurity quota fixture\n%%EOF");
IFormFile Upload(byte[] value, string name = "security.pdf") => new FormFile(new MemoryStream(value), 0, value.Length, "file", name);
await using var db = new RecruitmentDbContext(options);
var initialCount = await db.Documents.LongCountAsync();
var initialBytes = await db.Documents.SumAsync(d => (long)d.Data.Length);
await using (var transaction = await db.Database.BeginTransactionAsync()) {
    var store = new PrivateDocumentStore(db, Budget(initialCount + 1, initialBytes + pdf.Length));
    var key = await store.SaveAsync(Upload(pdf));
    Check(await db.Documents.AnyAsync(d => d.StorageKey == key), "Exact quota boundary failed");
    try { await store.SaveAsync(Upload(pdf)); throw new Exception("Cumulative quota bypass"); } catch (ArgumentException) { checks++; }
    Check(db.Database.CurrentTransaction == transaction, "Caller transaction was replaced");
    await store.RemoveAsync(key);
    key = await store.SaveAsync(Upload(pdf));
    Check(await db.Documents.AnyAsync(d => d.StorageKey == key), "Capacity not restored after removal");
    await store.RemoveAsync(key);
    var byteStore = new PrivateDocumentStore(db, Budget(initialCount + 10, initialBytes + pdf.Length - 1));
    try { await byteStore.SaveAsync(Upload(pdf)); throw new Exception("Byte quota bypass"); } catch (ArgumentException) { checks++; }
    try { await store.SaveAsync(Upload([1,2,3])); throw new Exception("Invalid PDF accepted"); } catch (ArgumentException) { checks++; }

    // An old malformed DOCX must also be safe to preview, regardless of upload validation.
    var candidate = await db.Candidates.FirstAsync();
    var legacyKey = Guid.NewGuid().ToString("N") + ".docx";
    db.Documents.Add(new StoredDocument { StorageKey = legacyKey, Data = excessiveDepth });
    var resume = new Resume { CandidateId = candidate.Id, Name = "legacy.docx", StorageKey = legacyKey,
        ContentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document", Size = nested.Length };
    db.Resumes.Add(resume); await db.SaveChangesAsync();
    var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, candidate.Subject), new Claim(ClaimTypes.Role,"Candidate")], "fixture"));
    var workspace = new WorkspaceController(db, store) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = principal } } };
    Check(await workspace.PreviewResume(resume.Id) is BadRequestObjectResult, "Candidate preview accepted nested DOCX");
    var company = await db.Companies.FirstAsync();
    var batch = new CvReviewBatch { CompanyId = company.Id, Title = "Security rollback fixture" };
    var item = new CvReviewItem { BatchId = batch.Id, Name = "Fixture", FileName = "legacy.docx", StorageKey = legacyKey, Source = "Upload" };
    db.CvReviewBatches.Add(batch); db.CvReviewItems.Add(item); await db.SaveChangesAsync();
    var queue = new CvReviewQueue(db);
    var reviews = new CvReviewsController(db, null!, queue) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext {
        User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, company.OwnerSubject), new Claim(ClaimTypes.Role,"Recruiter")], "fixture")) } } };
    Check(await reviews.Preview(batch.Id, item.Id) is BadRequestObjectResult, "Recruiter preview accepted nested DOCX");
    await transaction.RollbackAsync();
}
db.ChangeTracker.Clear();
Check(await db.Documents.LongCountAsync() == initialCount, "Rollback changed stored document count");

// Separate connections race for the same final slot: SQL must serialize admission.
var concurrentBudget = Budget(initialCount + 1, initialBytes + 2 * pdf.Length);
var accepted = new System.Collections.Concurrent.ConcurrentBag<string>();
try {
    var results = await Task.WhenAll(Enumerable.Range(0,2).Select(async _ => {
        await using var connection = new RecruitmentDbContext(options);
        try { var key = await new PrivateDocumentStore(connection, concurrentBudget).SaveAsync(Upload(pdf)); accepted.Add(key); return true; }
        catch (ArgumentException) { return false; }
    }));
    Check(results.Count(x => x) == 1, "Concurrent uploads bypassed the last available slot");
} finally {
    foreach (var key in accepted) await db.Documents.Where(d => d.StorageKey == key).ExecuteDeleteAsync();
}
Check(await db.Documents.LongCountAsync() == initialCount && await db.Documents.SumAsync(d => (long)d.Data.Length) == initialBytes, "Security checks left document data behind");
Console.WriteLine($"Security checks passed: {checks}; test transaction rolled back and concurrent fixtures removed.");
