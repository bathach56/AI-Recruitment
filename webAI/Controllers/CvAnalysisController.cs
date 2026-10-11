using Microsoft.AspNetCore.Mvc;
using webAI.Models;
using webAI.Services;

namespace webAI.Controllers;

[ApiController]
[Route("api/cv")]
public class CvAnalysisController : ControllerBase
{
    private readonly ICvAnalysisService _cvAnalysisService;

    public CvAnalysisController(ICvAnalysisService cvAnalysisService)
    {
        _cvAnalysisService = cvAnalysisService;
    }

    [HttpPost("upload")]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new CvUploadResponse { Success = false, Error = "Vui lòng chọn một tệp hợp lệ." });
        }

        if (file.Length > 10 * 1024 * 1024) // 10MB
        {
            return BadRequest(new CvUploadResponse { Success = false, Error = "Kích thước tệp vượt quá 10MB." });
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (extension != ".pdf" && extension != ".docx")
        {
            return BadRequest(new CvUploadResponse { Success = false, Error = "Chỉ chấp nhận các tệp định dạng .pdf hoặc .docx." });
        }

        using var stream = file.OpenReadStream();
        var result = await _cvAnalysisService.AnalyzeCvAsync(stream, file.FileName, file.Length);

        return Ok(new CvUploadResponse
        {
            Success = true,
            AnalysisId = result.Id
        });
    }

    [HttpGet("result/{id}")]
    public async Task<IActionResult> GetResult(string id)
    {
        var result = await _cvAnalysisService.GetResultAsync(id);
        if (result == null)
        {
            return NotFound();
        }

        return Ok(result);
    }
}
