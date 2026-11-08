using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using webAI.Models;
using webAI.Services;

namespace webAI.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class ChatController(RecruitmentChatService chat, ILogger<ChatController> logger) : ControllerBase
{
    [HttpPost]
    [Consumes("application/json")]
    [RequestSizeLimit(128 * 1024)]
    [EnableRateLimiting("chat")]
    public async Task<IActionResult> Send(ChatRequest request, CancellationToken ct)
    {
        var host = Request.Host.Host.Trim('[', ']');
        if (HttpContext.Connection.RemoteIpAddress is not { } remote || !IPAddress.IsLoopback(remote)
            || !(host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
                || (IPAddress.TryParse(host, out var address) && IPAddress.IsLoopback(address))))
            return StatusCode(403, new { message = "Trợ lý chỉ khả dụng trên máy chạy ứng dụng." });

        if (request.Messages is not { Length: >= 1 and <= 9 } messages || messages.Length % 2 == 0)
            return BadRequest(new { message = "Hội thoại cần kết thúc bằng câu hỏi và có tối đa 9 tin nhắn." });

        var history = new List<ChatMessage>(messages.Length);
        for (var index = 0; index < messages.Length; index++)
        {
            var role = index % 2 == 0 ? "user" : "assistant";
            var limit = role == "user" ? 1200 : 4000;
            if (messages[index] is not { } message || message.Role != role
                || string.IsNullOrWhiteSpace(message.Content) || message.Content.Length > limit)
                return BadRequest(new { message = "Vai trò hoặc nội dung tin nhắn không hợp lệ." });
            history.Add(new ChatMessage(role, message.Content.Trim()));
        }

        if (!chat.IsConfigured)
            return StatusCode(503, new { message = "Trợ lý AI chưa được cấu hình trên máy chủ." });

        try
        {
            return Ok(new { reply = await chat.ReplyAsync(history, ct) });
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return StatusCode(504, new { message = "Trợ lý phản hồi quá thời gian. Vui lòng thử lại." });
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning("Chat provider request failed with status {Status}.", ex.StatusCode);
            return StatusCode(503, new { message = "Không kết nối được với trợ lý AI. Vui lòng thử lại." });
        }
        catch (JsonException)
        {
            logger.LogWarning("Chat provider returned an invalid response.");
            return StatusCode(502, new { message = "Trợ lý AI trả về phản hồi không hợp lệ. Vui lòng thử lại." });
        }
    }
}
