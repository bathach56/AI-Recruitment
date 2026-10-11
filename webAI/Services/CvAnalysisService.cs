using System.Collections.Concurrent;
using webAI.Models;

namespace webAI.Services;

public class CvAnalysisService : ICvAnalysisService
{
    private readonly ConcurrentDictionary<string, CvAnalysisResult> _results = new();
    private readonly Random _random = new();

    public async Task<CvAnalysisResult> AnalyzeCvAsync(Stream fileStream, string fileName, long fileSize)
    {
        var id = Guid.NewGuid().ToString();
        await Task.Delay(2000); // Simulate AI processing

        int overallScore = _random.Next(55, 93);
        int layoutScore = _random.Next(60, 96);
        int contentScore = _random.Next(50, 91);
        int keywordScore = _random.Next(45, 86);
        int experienceScore = _random.Next(55, 96);

        string overallRating;
        if (overallScore >= 90) overallRating = "Xuất sắc";
        else if (overallScore >= 80) overallRating = "Tốt";
        else if (overallScore >= 70) overallRating = "Khá";
        else if (overallScore >= 60) overallRating = "Trung bình";
        else overallRating = "Cần cải thiện";

        var suggestions = new List<CvSuggestion>();

        if (keywordScore < 70)
        {
            suggestions.Add(new CvSuggestion { Category = "keyword", Icon = "✍️", Title = "Tối ưu hóa từ khóa ATS", Description = "Thêm các từ khóa chuyên ngành liên quan đến phát triển phần mềm và công nghệ cụ thể" });
        }
        if (contentScore < 75)
        {
            suggestions.Add(new CvSuggestion { Category = "content", Icon = "💡", Title = "Làm rõ trách nhiệm chính", Description = "Nêu rõ các thành tựu và kết quả định lượng trong từng vị trí" });
        }
        if (layoutScore < 80)
        {
            suggestions.Add(new CvSuggestion { Category = "layout", Icon = "🔧", Title = "Điều chỉnh định dạng", Description = "Đảm bảo tính nhất quán về phông chữ và căn lề toàn bộ văn bản" });
        }
        if (experienceScore < 75)
        {
            suggestions.Add(new CvSuggestion { Category = "experience", Icon = "📈", Title = "Bổ sung kinh nghiệm", Description = "Thêm chi tiết về dự án và vai trò cụ thể để tăng tính thuyết phục" });
        }
        
        suggestions.Add(new CvSuggestion { Category = "content", Icon = "🔍", Title = "Tăng cường nội dung 'Tóm tắt'", Description = "Kết hợp các kỹ năng cốt lõi và mục tiêu nghề nghiệp rõ ràng hơn" });
        suggestions.Add(new CvSuggestion { Category = "keyword", Icon = "📝", Title = "Thêm kỹ năng mềm", Description = "Bổ sung các kỹ năng mềm như giao tiếp, làm việc nhóm, giải quyết vấn đề" });

        var result = new CvAnalysisResult
        {
            Id = id,
            FileName = fileName,
            FileSize = fileSize,
            AnalyzedAt = DateTime.UtcNow,
            OverallScore = overallScore,
            LayoutScore = layoutScore,
            ContentScore = contentScore,
            KeywordScore = keywordScore,
            ExperienceScore = experienceScore,
            OverallRating = overallRating,
            Suggestions = suggestions
        };

        _results.TryAdd(id, result);

        return result;
    }

    public Task<CvAnalysisResult?> GetResultAsync(string analysisId)
    {
        if (_results.TryGetValue(analysisId, out var result))
        {
            return Task.FromResult<CvAnalysisResult?>(result);
        }
        return Task.FromResult<CvAnalysisResult?>(null);
    }
}
