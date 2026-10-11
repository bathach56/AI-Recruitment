namespace webAI.Models;

public class CvAnalysisResult
{
    public string Id { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public DateTime AnalyzedAt { get; set; }
    public int OverallScore { get; set; }
    public int LayoutScore { get; set; }
    public int ContentScore { get; set; }
    public int KeywordScore { get; set; }
    public int ExperienceScore { get; set; }
    public string OverallRating { get; set; } = string.Empty; // "Xuất sắc", "Tốt", "Khá", "Trung bình", "Cần cải thiện"
    public List<CvSuggestion> Suggestions { get; set; } = new();
}

public class CvSuggestion
{
    public string Category { get; set; } = string.Empty; // "content", "layout", "keyword", "experience"
    public string Icon { get; set; } = string.Empty; // emoji icon
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}
