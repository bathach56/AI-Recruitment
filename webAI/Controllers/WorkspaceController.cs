using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.IO.Compression;
using System.Text.Json;
using System.Xml;
using System.Xml.Linq;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using webAI.Data;
using webAI.Services;

namespace webAI.Controllers;

[ApiController, Route("api/workspace"), Authorize, AutoValidateAntiforgeryToken]
public class WorkspaceController(RecruitmentDbContext db, PrivateDocumentStore files) : ControllerBase
{
    private string Subject => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    private Task<CandidateProfile> Candidate() => db.Candidates.SingleAsync(x => x.Subject == Subject);
    private Task<Company> Company() => db.Companies.SingleAsync(x => x.OwnerSubject == Subject);

    [HttpGet("profile"), Authorize(Roles = "Candidate")]
    public async Task<IActionResult> Profile() => Ok(await Candidate());

    [HttpPut("profile"), Authorize(Roles = "Candidate")]
    public async Task<IActionResult> SaveProfile(ProfileRequest request)
    {
        var profile = await Candidate();
        profile.FullName = request.FullName.Trim(); profile.Email = request.Email.Trim();
        profile.Phone = request.Phone; profile.City = request.City; profile.DesiredTitle = request.DesiredTitle;
        profile.Summary = request.Summary;
        await db.SaveChangesAsync(); return Ok(profile);
    }

    [HttpGet("resumes"), Authorize(Roles = "Candidate")]
    public async Task<IActionResult> Resumes()
    {
        var candidate = await Candidate();
        return Ok(await db.Resumes.Where(x => x.CandidateId == candidate.Id)
            .Select(x => new { x.Id, x.Name, x.Size, x.UpdatedAt }).ToListAsync());
    }

    [HttpPost("resumes"), Authorize(Roles = "Candidate"), RequestSizeLimit(12 * 1024 * 1024)]
    public async Task<IActionResult> UploadResume(IFormFile file)
    {
        var candidate = await Candidate();
        string key;
        try { key = await files.SaveAsync(file); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        var resume = new Resume { CandidateId = candidate.Id, Name = Path.GetFileName(file.FileName), StorageKey = key,
            ContentType = key.EndsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document", Size = file.Length };
        db.Resumes.Add(resume);
        try { await db.SaveChangesAsync(); }
        catch { System.IO.File.Delete(files.PathFor(key)); throw; }
        return Ok(new { resume.Id, resume.Name });
    }

    [HttpGet("resumes/{id:int}"), Authorize(Roles = "Candidate,Recruiter")]
    public async Task<IActionResult> DownloadResume(int id, [FromQuery] bool inline = false)
    {
        var resume = await db.Resumes.FindAsync(id);
        if (resume == null) return NotFound();
        var owner = await db.Candidates.AnyAsync(x => x.Id == resume.CandidateId && x.Subject == Subject);
        var recruiter = User.IsInRole("Recruiter") && await (
            from a in db.Applications join j in db.Jobs on a.JobId equals j.Id
            join c in db.Companies on j.CompanyId equals c.Id
            where a.ResumeId == id && c.OwnerSubject == Subject select a.Id).AnyAsync();
        if (!owner && !recruiter) return NotFound();
        if (!System.IO.File.Exists(files.PathFor(resume.StorageKey))) return NotFound();
        return inline && resume.ContentType == "application/pdf"
            ? PhysicalFile(files.PathFor(resume.StorageKey), resume.ContentType, enableRangeProcessing: true)
            : PhysicalFile(files.PathFor(resume.StorageKey), resume.ContentType, resume.Name);
    }

    [HttpGet("resumes/{id:int}/preview"), Authorize(Roles = "Candidate,Recruiter")]
    public async Task<IActionResult> PreviewResume(int id)
    {
        var allowed = await DownloadResume(id);
        if (allowed is not PhysicalFileResult document) return allowed;
        if (document.ContentType == "application/pdf") return Ok(new { kind = "pdf", url = $"/api/workspace/resumes/{id}?inline=true" });
        try {
            using var zip = ZipFile.OpenRead(document.FileName);
            var entry = zip.GetEntry("word/document.xml");
            if (entry == null || entry.Length > 50 * 1024 * 1024) return BadRequest(new { message = "Không đọc được tài liệu DOCX." });
            using var stream = entry.Open();
            using var reader = XmlReader.Create(stream, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 50 * 1024 * 1024 });
            var xml = XDocument.Load(reader); XNamespace w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
            var text = string.Join("\n", xml.Descendants(w + "body").Descendants(w + "p").Select(p => string.Concat(p.Descendants(w + "t").Select(t => t.Value))));
            if (string.IsNullOrWhiteSpace(text)) return BadRequest(new { message = "DOCX không có văn bản đọc được. Tải tệp gốc để xem hình ảnh hoặc nội dung đặc biệt." });
            return Ok(new { kind = "text", text, note = "Nội dung văn bản DOCX; tải tệp gốc để xem đầy đủ định dạng, hình ảnh và bố cục." });
        } catch (Exception ex) when (ex is InvalidDataException or XmlException or IOException) {
            return BadRequest(new { message = "Không đọc được CV. Bạn có thể tải tệp gốc để kiểm tra." });
        }
    }

    [HttpGet("saved"), Authorize(Roles = "Candidate")]
    public async Task<IActionResult> Saved()
    {
        var candidate = await Candidate();
        return Ok(await (from s in db.SavedJobs join j in db.Jobs on s.JobId equals j.Id
            where s.CandidateId == candidate.Id select new { j.Id, j.Title, j.City }).ToListAsync());
    }

    [HttpPost("saved/{jobId:int}"), Authorize(Roles = "Candidate")]
    public async Task<IActionResult> SaveJob(int jobId)
    {
        if (!await db.Jobs.AnyAsync(x => x.Id == jobId && x.Status == "Published")) return NotFound();
        var candidate = await Candidate();
        if (!await db.SavedJobs.AnyAsync(x => x.CandidateId == candidate.Id && x.JobId == jobId)) {
            db.SavedJobs.Add(new SavedJob { CandidateId = candidate.Id, JobId = jobId });
            try { await db.SaveChangesAsync(); }
            catch (DbUpdateException ex) when (ex.InnerException is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 })
            { return Ok(new { message = "Tin đã được lưu trước đó." }); }
        }
        return Ok();
    }

    [HttpDelete("saved/{jobId:int}"), Authorize(Roles = "Candidate")]
    public async Task<IActionResult> Unsave(int jobId)
    {
        var candidate = await Candidate();
        await db.SavedJobs.Where(x => x.CandidateId == candidate.Id && x.JobId == jobId).ExecuteDeleteAsync();
        return Ok();
    }

    [HttpPost("jobs/{jobId:int}/applications"), Authorize(Roles = "Candidate")]
    public async Task<IActionResult> Apply(int jobId, ApplyRequest request)
    {
        var job = await db.Jobs.FindAsync(jobId);
        if (job == null || job.Status != "Published" || job.Deadline < DateTimeOffset.UtcNow) return BadRequest(new { message = "Tin không còn nhận hồ sơ." });
        if (job.IsDemo) return BadRequest(new { message = "Tin minh họa không nhận ứng tuyển." });
        var candidate = await Candidate();
        if (!await db.Resumes.AnyAsync(x => x.Id == request.ResumeId && x.CandidateId == candidate.Id)) return BadRequest(new { message = "Vui lòng chọn CV của bạn." });
        if (await db.Applications.AnyAsync(x => x.JobId == jobId && x.CandidateId == candidate.Id)) return Conflict(new { message = "Bạn đã ứng tuyển tin này." });
        db.Applications.Add(new JobApplication { JobId = jobId, CandidateId = candidate.Id, ResumeId = request.ResumeId, CoverLetter = request.CoverLetter });
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException ex) when (ex.InnerException is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 }) { return Conflict(new { message = "Bạn đã ứng tuyển tin này." }); }
        return Ok();
    }

    [HttpGet("applications")]
    public async Task<IActionResult> Applications([FromQuery] int? jobId = null)
    {
        if (User.IsInRole("Candidate")) {
            var candidate = await Candidate();
            return Ok(await (from a in db.Applications join j in db.Jobs on a.JobId equals j.Id
                join employer in db.Companies on j.CompanyId equals employer.Id
                where a.CandidateId == candidate.Id && (jobId == null || j.Id == jobId) orderby a.SubmittedAt descending
                select new { a.Id, jobId = j.Id, j.Title, a.Status, a.SubmittedAt, a.ResumeId, companyName = employer.Name, j.City }).ToListAsync());
        }
        if (!User.IsInRole("Recruiter")) return Forbid();
        var company = await Company();
        if (jobId.HasValue && !await db.Jobs.AnyAsync(j => j.Id == jobId && j.CompanyId == company.Id)) return NotFound();
        return Ok(await (from a in db.Applications join j in db.Jobs on a.JobId equals j.Id
            join c in db.Candidates on a.CandidateId equals c.Id
            where j.CompanyId == company.Id && (jobId == null || j.Id == jobId) orderby a.SubmittedAt descending
            select new { a.Id, jobId = j.Id, j.Title, c.FullName, c.Email, a.ResumeId, a.Status, a.CoverLetter, a.SubmittedAt }).ToListAsync());
    }

    [HttpGet("applications/{id:int}"), Authorize(Roles = "Candidate")]
    public async Task<IActionResult> ApplicationDetail(int id)
    {
        var candidate = await Candidate();
        var application = await (from a in db.Applications join j in db.Jobs on a.JobId equals j.Id
            join company in db.Companies on j.CompanyId equals company.Id join r in db.Resumes on a.ResumeId equals r.Id
            where a.Id == id && a.CandidateId == candidate.Id
            select new { a.Id, a.JobId, j.Title, a.Status, a.SubmittedAt, a.CoverLetter, a.ResumeId,
                candidate.FullName, candidate.Email, resumeName = r.Name,
                company = new { company.Id, company.Name, company.Industry, company.Website },
                job = new { j.City, j.District, j.WorkMode, j.EmploymentType, j.Experience, j.SalaryMin, j.SalaryMax, j.Description, j.Requirements, j.Benefits, j.Deadline, j.Status }
            }).SingleOrDefaultAsync();
        if (application == null) return NotFound();
        var responses = await db.Notifications.Where(n => n.ApplicationId == id && n.RecipientSubject == Subject)
            .OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id)
            .Select(n => new { n.Id, n.Title, n.Content, n.CreatedAt, n.ReadAt }).ToListAsync();
        return Ok(new { application, responses });
    }

    [HttpGet("applications/assessments"), Authorize(Roles = "Recruiter")]
    public async Task<IActionResult> Assessments()
    {
        var company = await Company();
        var applications = await (from a in db.Applications join j in db.Jobs on a.JobId equals j.Id
            join r in db.Resumes on a.ResumeId equals r.Id where j.CompanyId == company.Id
            select new { a.Id, a.JobId, r.StorageKey }).ToListAsync();
        var keys = applications.Select(a => a.StorageKey).ToArray();
        var reviews = await (from i in db.CvReviewItems.AsNoTracking() join b in db.CvReviewBatches on i.BatchId equals b.Id
            where b.CompanyId == company.Id && i.Source == "Application" && keys.Contains(i.StorageKey) && (i.State == "Complete" || i.State == "Incomplete")
            orderby i.AnalyzedAt descending, b.CreatedAt descending, i.Id descending
            select new { item = i, b.Model, b.ConfigurationJson }).ToListAsync();
        var matched = reviews.Select(r => new { review = r, jobId = JsonSerializer.Deserialize<JsonElement>(r.ConfigurationJson).TryGetProperty("job_id", out var id) ? id.GetInt32() : 0 }).ToList();
        return Ok(applications.Select(a => {
            var found = matched.FirstOrDefault(r => r.jobId == a.JobId && r.review.item.StorageKey == a.StorageKey)?.review;
            return new { applicationId = a.Id, assessment = found == null ? null : new {
                found.item.BatchId, found.Model, found.item.State, found.item.Score, found.item.SemanticScore, found.item.SkillScore, found.item.ExperienceScore, found.item.AnalyzedAt,
                result = JsonSerializer.Deserialize<JsonElement>(found.item.ResultJson) } };
        }));
    }

    [HttpPost("applications/responses/batch"), Authorize(Roles = "Recruiter")]
    public async Task<IActionResult> RespondBatch(BatchResponseRequest request)
    {
        if (request.Status is not ("Offered" or "Rejected") || request.ApplicationIds.Count is < 1 or > 100 || request.ApplicationIds.Any(id => id < 1))
            return BadRequest(new { message = "Chọn từ 1 đến 100 hồ sơ và kết quả tuyển dụng hợp lệ." });
        var ids = request.ApplicationIds.Distinct().ToArray(); var company = await Company();
        var recipients = await (from a in db.Applications join j in db.Jobs on a.JobId equals j.Id
            join c in db.Candidates on a.CandidateId equals c.Id
            where ids.Contains(a.Id) && j.CompanyId == company.Id select new { application = a, c.Subject }).ToListAsync();
        if (recipients.Count != ids.Length) return NotFound(new { message = "Có hồ sơ không thuộc công ty của bạn; chưa gửi phản hồi nào." });
        foreach (var recipient in recipients) {
            recipient.application.Status = request.Status;
            db.Notifications.Add(new RecruitmentNotification { RecipientSubject = recipient.Subject, ApplicationId = recipient.application.Id,
                Title = request.Title.Trim(), Content = request.Content.Trim(), DeliveryStatus = "Sent" });
        }
        // EF saves all statuses and messages in a single transaction.
        await db.SaveChangesAsync(); return Ok(new { sent = recipients.Count });
    }

    [HttpGet("company"), Authorize(Roles = "Recruiter")]
    public async Task<IActionResult> GetCompany() => Ok(await Company());

    [HttpPut("company"), Authorize(Roles = "Recruiter")]
    public async Task<IActionResult> SaveCompany(CompanyRequest request)
    {
        var company = await Company();
        if (company.Name != request.Name || company.TaxCode != request.TaxCode) company.VerificationStatus = "Pending";
        company.Name = request.Name; company.TaxCode = request.TaxCode; company.Website = request.Website;
        await db.SaveChangesAsync(); return Ok(company);
    }

    [HttpPost("company/verification"), Authorize(Roles = "Recruiter"), RequestSizeLimit(12 * 1024 * 1024)]
    public async Task<IActionResult> Verification(IFormFile file)
    {
        var company = await Company();
        string key;
        try { key = await files.SaveAsync(file, true); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        db.Verifications.Add(new CompanyVerification { CompanyId = company.Id, DocumentStorageKey = key });
        company.VerificationStatus = "Pending";
        try { await db.SaveChangesAsync(); }
        catch { System.IO.File.Delete(files.PathFor(key)); throw; }
        return Ok(new { message = "Đã gửi hồ sơ, chờ duyệt." });
    }

    [HttpGet("jobs"), Authorize(Roles = "Recruiter")]
    public async Task<IActionResult> OwnJobs()
    {
        var company = await Company();
        return Ok(await db.Jobs.Where(x => x.CompanyId == company.Id).OrderByDescending(x => x.CreatedAt).ToListAsync());
    }

    [HttpPost("jobs"), Authorize(Roles = "Recruiter")]
    public async Task<IActionResult> CreateJob(JobRequest request)
    {
        var company = await Company();
        if (request.SalaryMin > request.SalaryMax) return BadRequest(new { message = "Khoảng lương không hợp lệ." });
        if (request.Deadline < DateTimeOffset.UtcNow) return BadRequest(new { message = "Hạn nộp phải ở tương lai." });
        if (request.Publish && company.VerificationStatus != "Verified") return StatusCode(403, new { message = "Doanh nghiệp cần được xác minh trước khi đăng công khai. Bạn có thể lưu bản nháp." });
        var job = new JobPosting { CompanyId = company.Id, Title = request.Title, City = request.City, District = request.District,
            WorkMode = request.WorkMode, Experience = request.Experience, SalaryMin = request.SalaryMin, SalaryMax = request.SalaryMax,
            Vacancies = request.Vacancies, Deadline = request.Deadline, Skills = request.Skills, Description = request.Description,
            Requirements = request.Requirements, Benefits = request.Benefits, Urgent = request.Urgent, Category = request.Category,
            Status = request.Publish ? "Published" : "Draft" };
        db.Jobs.Add(job); await db.SaveChangesAsync(); return Ok(new { job.Id, job.Status });
    }

    [HttpPut("jobs/{id:int}/status"), Authorize(Roles = "Recruiter")]
    public async Task<IActionResult> JobStatus(int id, StatusRequest request)
    {
        var company = await Company();
        var job = await db.Jobs.SingleOrDefaultAsync(x => x.Id == id && x.CompanyId == company.Id);
        if (job == null) return NotFound();
        if (request.Status is not ("Published" or "Closed" or "Draft")) return BadRequest();
        if (request.Status == "Published" && (company.VerificationStatus != "Verified" || job.Deadline < DateTimeOffset.UtcNow))
            return BadRequest(new { message = "Cần xác minh doanh nghiệp và hạn nộp còn hiệu lực." });
        job.Status = request.Status; await db.SaveChangesAsync(); return Ok();
    }

    [HttpPut("applications/{id:int}/status"), Authorize(Roles = "Recruiter")]
    public async Task<IActionResult> ApplicationStatus(int id, StatusRequest request)
    {
        if (request.Status is not ("Reviewing" or "Interview" or "Offered" or "Rejected")) return BadRequest();
        var company = await Company();
        var application = await (from a in db.Applications join j in db.Jobs on a.JobId equals j.Id
            where a.Id == id && j.CompanyId == company.Id select a).SingleOrDefaultAsync();
        if (application == null) return NotFound();
        application.Status = request.Status;
        var candidate = await db.Candidates.FindAsync(application.CandidateId);
        var statusLabel = request.Status switch { "Reviewing" => "Đang xem xét", "Interview" => "Mời phỏng vấn", "Offered" => "Trúng tuyển", "Rejected" => "Không trúng tuyển", _ => request.Status };
        db.Notifications.Add(new RecruitmentNotification { RecipientSubject = candidate!.Subject, ApplicationId = id,
            Title = "Cập nhật hồ sơ ứng tuyển", Content = $"Trạng thái hồ sơ: {statusLabel}", DeliveryStatus = "Sent" });
        await db.SaveChangesAsync(); return Ok();
    }

    [HttpGet("notifications")]
    public async Task<IActionResult> Notifications() => Ok(await (
        from n in db.Notifications
        join a in db.Applications on n.ApplicationId equals (int?)a.Id into applications
        from a in applications.DefaultIfEmpty()
        join j in db.Jobs on a.JobId equals j.Id into jobs
        from j in jobs.DefaultIfEmpty()
        join company in db.Companies on j.CompanyId equals company.Id into companies
        from company in companies.DefaultIfEmpty()
        where n.RecipientSubject == Subject
        orderby n.CreatedAt descending, n.Id descending
        select new { n.Id, n.Title, n.ApplicationId, n.CreatedAt, n.ReadAt,
            companyName = company.Name, jobTitle = j.Title, applicationStatus = a.Status }).ToListAsync());

    [HttpPost("notifications/{id:int}/read")]
    public async Task<IActionResult> ReadNotification(int id)
    {
        var notification = await db.Notifications.SingleOrDefaultAsync(x => x.Id == id && x.RecipientSubject == Subject);
        if (notification == null) return NotFound();
        notification.ReadAt ??= DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return Ok();
    }

    [HttpPost("notifications/read-all")]
    public async Task<IActionResult> ReadAllNotifications()
    {
        await db.Notifications.Where(x => x.RecipientSubject == Subject && x.ReadAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.ReadAt, DateTimeOffset.UtcNow));
        return Ok();
    }

    [HttpGet("applications/{id:int}/responses"), Authorize(Roles = "Recruiter")]
    public async Task<IActionResult> Responses(int id)
    {
        var company = await Company();
        if (!await db.Applications.AnyAsync(a => a.Id == id && db.Jobs.Any(j => j.Id == a.JobId && j.CompanyId == company.Id))) return NotFound();
        return Ok(await db.Notifications.Where(n => n.ApplicationId == id)
            .OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id)
            .Select(n => new { n.Id, n.Title, n.Content, n.CreatedAt, n.ReadAt }).ToListAsync());
    }

    [HttpPost("applications/{id:int}/responses"), Authorize(Roles = "Recruiter")]
    public async Task<IActionResult> Respond(int id, ResponseRequest request)
    {
        var company = await Company();
        var recipient = await (from a in db.Applications join j in db.Jobs on a.JobId equals j.Id
            join c in db.Candidates on a.CandidateId equals c.Id
            where a.Id == id && j.CompanyId == company.Id select c.Subject).SingleOrDefaultAsync();
        if (recipient == null) return NotFound();
        db.Notifications.Add(new RecruitmentNotification { RecipientSubject = recipient, ApplicationId = id,
            Title = request.Title, Content = request.Content, DeliveryStatus = "Sent" });
        await db.SaveChangesAsync(); return Ok();
    }
}

public class ProfileRequest
{
    [Required, StringLength(150)] public string FullName { get; set; } = "";
    [Required, EmailAddress, StringLength(150)] public string Email { get; set; } = "";
    [StringLength(30)] public string Phone { get; set; } = "";
    [StringLength(150)] public string City { get; set; } = "";
    [StringLength(200)] public string DesiredTitle { get; set; } = "";
    [StringLength(450)] public string Summary { get; set; } = "";
}
public class CompanyRequest
{
    [Required, StringLength(200)] public string Name { get; set; } = "";
    [StringLength(30)] public string TaxCode { get; set; } = "";
    [StringLength(300)] public string Website { get; set; } = "";
}
public class ApplyRequest
{
    [Range(1, int.MaxValue)] public int ResumeId { get; set; }
    [StringLength(450)] public string CoverLetter { get; set; } = "";
}
public class StatusRequest { [Required] public string Status { get; set; } = ""; }
public class ResponseRequest
{
    [Required, StringLength(200)] public string Title { get; set; } = "";
    [Required, StringLength(12000)] public string Content { get; set; } = "";
}
public class BatchResponseRequest : ResponseRequest
{
    [Required] public List<int> ApplicationIds { get; set; } = [];
    [Required] public string Status { get; set; } = "";
}
public class JobRequest
{
    [Required, StringLength(200)] public string Title { get; set; } = "";
    [Required, StringLength(150)] public string City { get; set; } = "";
    [StringLength(150)] public string District { get; set; } = "";
    [StringLength(150)] public string Category { get; set; } = "Công nghệ";
    [StringLength(150)] public string WorkMode { get; set; } = "Tại văn phòng";
    [StringLength(150)] public string Experience { get; set; } = "";
    [Range(0,1000)] public decimal? SalaryMin { get; set; }
    [Range(0,1000)] public decimal? SalaryMax { get; set; }
    [Range(1,10000)] public int Vacancies { get; set; } = 1;
    public DateTimeOffset Deadline { get; set; }
    [StringLength(450)] public string Skills { get; set; } = "";
    [Required, StringLength(12000)] public string Description { get; set; } = "";
    [Required, StringLength(12000)] public string Requirements { get; set; } = "";
    [StringLength(12000)] public string Benefits { get; set; } = "";
    public bool Urgent { get; set; }
    public bool Publish { get; set; }
}
