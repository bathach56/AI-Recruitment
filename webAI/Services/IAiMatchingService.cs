using webAI.Models;

namespace webAI.Services;

public interface IAiMatchingService
{
    Task<AiMatchingResponse> MatchAsync(AiMatchingRequest request, CancellationToken cancellationToken = default);
    Task<System.Text.Json.JsonElement> MatchFileAsync(Stream stream, string filename, string requestJson, CancellationToken cancellationToken);
    Task<bool> CheckAiServiceHealthAsync(CancellationToken cancellationToken = default);
}

