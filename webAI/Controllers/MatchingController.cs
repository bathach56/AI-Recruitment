using Microsoft.AspNetCore.Authorization;
﻿using Microsoft.AspNetCore.Mvc;
using webAI.Models;
using webAI.Services;
namespace webAI.Controllers;
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class MatchingController : ControllerBase
{
    private readonly IAiMatchingService _service;
    private readonly ILogger<MatchingController> _logger;
    public MatchingController(IAiMatchingService service, ILogger<MatchingController> logger)
    { _service = service; _logger = logger; }
    [HttpGet("health")]
    [Authorize(Roles = "Recruiter,Admin")]
    public async Task<IActionResult> GetHealth(CancellationToken ct)
    {
        var ready = await _service.CheckAiServiceHealthAsync(ct);
        // The client has left; do not report an AI outage for an abandoned probe.
        if (ct.IsCancellationRequested) return new EmptyResult();
        return StatusCode(ready ? 200 : 503, new { ai_service_connected = ready });
    }
    [HttpPost("analyze")]
    [Authorize(Roles = "Recruiter")]
    [RequestSizeLimit(1_000_000)]
    public Task<IActionResult> Analyze([FromBody] AiMatchingRequest request, CancellationToken ct)
        => Execute(async () => (object)await _service.MatchAsync(request, ct), ct);
    [HttpPost("analyze-file")]
    [Authorize(Roles = "Recruiter")]
    [RequestSizeLimit(12 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 12 * 1024 * 1024)]
    public async Task<IActionResult> AnalyzeFile(IFormFile file, [FromForm(Name = "request_json")] string requestJson, CancellationToken ct)
    {
        if (file == null || file.Length == 0) return BadRequest(new { success = false, message = "Tệp không có nội dung." });
        if (file.Length > 10 * 1024 * 1024) return StatusCode(413);
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".pdf" && ext != ".docx") return StatusCode(415);
        if (requestJson.Length > 150000) return BadRequest(new { success = false, message = "Nội dung yêu cầu vượt quá giới hạn cho phép." });
        using var stream = file.OpenReadStream();
        return await Execute(async () => (object)await _service.MatchFileAsync(stream, file.FileName, requestJson, ct), ct);
    }
    private async Task<IActionResult> Execute(Func<Task<object>> action, CancellationToken ct)
    {
        try { return Ok(await action()); }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "AI service request failed");
            var upstream = (int?)ex.StatusCode;
            var code = upstream is 400 or 413 or 415 or 422 ? upstream.Value : 503;
            return StatusCode(code, new { success = false, message = code == 503 ? "Dịch vụ AI chưa sẵn sàng; không tạo điểm thay thế." : "Dữ liệu phân tích AI chưa hợp lệ." });
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        { return StatusCode(504, new { success = false, message = "Dịch vụ AI phản hồi quá thời gian chờ." }); }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Matching failed");
            return StatusCode(500, new { success = false, message = "Không thực hiện được đối chiếu CV." });
        }
    }
}
