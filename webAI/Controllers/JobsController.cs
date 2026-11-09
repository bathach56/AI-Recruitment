using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using webAI.Data;

namespace webAI.Controllers;

[ApiController]
[Route("api/jobs")]
public class JobsController(RecruitmentDbContext db, ILogger<JobsController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        try
        {
            var jobs = await (from job in db.Jobs.AsNoTracking()
                              join company in db.Companies.AsNoTracking() on job.CompanyId equals company.Id
                              where job.Status == "Published" && job.Deadline >= DateTimeOffset.UtcNow
                              orderby job.CreatedAt descending
                              select new { job.Id, job.Title, job.City, job.District, job.Category, job.WorkMode,
                                  job.EmploymentType, job.Experience, job.SalaryMin, job.SalaryMax, job.Skills,
                                  job.Urgent, job.IsDemo, job.Vacancies, job.CreatedAt, job.Deadline,
                                  job.Description, job.Requirements, job.Benefits,
                                  company = new { company.Id, company.Name, company.Initials, company.Color, company.Industry, company.VerificationStatus } })
                              .Take(200).ToListAsync(ct);
            return Ok(jobs);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Cannot read recruitment jobs from SQL Server");
            return StatusCode(503, new { message = "Chưa kết nối được dữ liệu việc làm. Vui lòng thử lại sau." });
        }
    }
}
