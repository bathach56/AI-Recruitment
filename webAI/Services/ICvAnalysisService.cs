using webAI.Models;

namespace webAI.Services;

public interface ICvAnalysisService
{
    Task<CvAnalysisResult> AnalyzeCvAsync(Stream fileStream, string fileName, long fileSize);
    Task<CvAnalysisResult?> GetResultAsync(string analysisId);
}
