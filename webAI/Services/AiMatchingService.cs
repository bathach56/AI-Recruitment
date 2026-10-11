using System.Net.Http.Json;
using System.Text.Json;
using webAI.Models;
namespace webAI.Services;
public class AiMatchingService : IAiMatchingService
{
    private readonly HttpClient _httpClient;
    public AiMatchingService(HttpClient httpClient, ILogger<AiMatchingService> logger, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _httpClient.BaseAddress ??= new Uri(configuration["AiService:BaseUrl"] ?? "http://127.0.0.1:8000");
        _httpClient.Timeout = TimeSpan.FromSeconds(60);
    }
    public async Task<bool> CheckAiServiceHealthAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            using var response = await _httpClient.GetAsync("/health", cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (HttpRequestException) { return false; }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested) { return false; }
    }
    public async Task<AiMatchingResponse> MatchAsync(AiMatchingRequest request, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.PostAsJsonAsync("/api/ai/match", request, cancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<AiMatchingResponse>(cancellationToken: cancellationToken)
            ?? throw new HttpRequestException("Empty AI response");
    }
    public async Task<JsonElement> MatchFileAsync(Stream stream, string filename, string requestJson, CancellationToken cancellationToken)
    {
        using var content = new MultipartFormDataContent();
        content.Add(new StreamContent(stream), "file", Path.GetFileName(filename));
        content.Add(new StringContent(requestJson), "request_json");
        using var response = await _httpClient.PostAsync("/api/ai/match-file", content, cancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cancellationToken);
    }
}
