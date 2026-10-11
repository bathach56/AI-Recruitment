using System.Text.Json.Serialization;

namespace webAI.Models;

public class MatchWeights
{
    [JsonPropertyName("semantic_weight")]
    public double SemanticWeight { get; set; } = 0.50;

    [JsonPropertyName("skill_weight")]
    public double SkillWeight { get; set; } = 0.30;

    [JsonPropertyName("experience_weight")]
    public double ExperienceWeight { get; set; } = 0.20;
}

public class AiMatchingRequest
{
    [JsonPropertyName("cv_id")]
    public int CvId { get; set; }

    [JsonPropertyName("cv_text")]
    public string CvText { get; set; } = string.Empty;

    [JsonPropertyName("cv_skills")]
    public List<string> CvSkills { get; set; } = new();

    [JsonPropertyName("cv_experience_years")]
    public double? CvExperienceYears { get; set; }

    [JsonPropertyName("job_id")]
    public int JobId { get; set; }

    [JsonPropertyName("job_title")]
    public string JobTitle { get; set; } = string.Empty;

    [JsonPropertyName("job_description")]
    public string JobDescription { get; set; } = string.Empty;

    [JsonPropertyName("required_skills")]
    public List<string> RequiredSkills { get; set; } = new();

    [JsonPropertyName("nice_to_have_skills")]
    public List<string> NiceToHaveSkills { get; set; } = new();

    [JsonPropertyName("job_experience_years_required")]
    public double? JobExperienceYearsRequired { get; set; }

    [JsonPropertyName("model_type")]
    public string ModelType { get; set; } = "Hybrid"; // "TF-IDF", "Sentence-BERT", "Hybrid"

    [JsonPropertyName("weights")]
    public MatchWeights Weights { get; set; } = new();
}

public class SkillItem
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("normalized")]
    public string Normalized { get; set; } = string.Empty;

    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty; // "Required", "Nice-to-have", "Bonus"
}

public class SkillGapAnalysis
{
    [JsonPropertyName("skill_score")]
    public double? SkillScore { get; set; }

    [JsonPropertyName("matched_skills")]
    public List<SkillItem> MatchedSkills { get; set; } = new();

    [JsonPropertyName("missing_skills")]
    public List<SkillItem> MissingSkills { get; set; } = new();

    [JsonPropertyName("bonus_skills")]
    public List<SkillItem> BonusSkills { get; set; } = new();

    [JsonPropertyName("coverage_percentage")]
    public double CoveragePercentage { get; set; }
}

public class ExperienceAnalysis
{
    [JsonPropertyName("experience_score")]
    public double? ExperienceScore { get; set; }

    [JsonPropertyName("years_found")]
    public double YearsFound { get; set; }

    [JsonPropertyName("years_required")]
    public double YearsRequired { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("experience_gap")]
    public double ExperienceGap { get; set; }
}

public class ScoreBreakdown
{
    [JsonPropertyName("semantic_score")]
    public double? SemanticScore { get; set; }

    [JsonPropertyName("skill_score")]
    public double? SkillScore { get; set; }

    [JsonPropertyName("experience_score")]
    public double? ExperienceScore { get; set; }
}

public class AiRecommendation
{
    [JsonPropertyName("decision_badge")]
    public string DecisionBadge { get; set; } = string.Empty;

    [JsonPropertyName("badge_color")]
    public string BadgeColor { get; set; } = "primary";

    [JsonPropertyName("summary")]
    public string Summary { get; set; } = string.Empty;
}

public class AiMatchingResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }
    [JsonExtensionData]
    public Dictionary<string, System.Text.Json.JsonElement> AdditionalData { get; set; } = new();

    [JsonPropertyName("cv_id")]
    public int CvId { get; set; }

    [JsonPropertyName("job_id")]
    public int JobId { get; set; }

    [JsonPropertyName("model_used")]
    public string ModelUsed { get; set; } = "Hybrid";

    [JsonPropertyName("overall_score")]
    public double? OverallScore { get; set; }

    [JsonPropertyName("breakdown")]
    public ScoreBreakdown Breakdown { get; set; } = new();

    [JsonPropertyName("skill_analysis")]
    public SkillGapAnalysis? SkillAnalysis { get; set; }

    [JsonPropertyName("experience_analysis")]
    public ExperienceAnalysis? ExperienceAnalysis { get; set; }

    [JsonPropertyName("ai_recommendation")]
    public AiRecommendation? AiRecommendation { get; set; }

    [JsonPropertyName("processing_time_ms")]
    public double ProcessingTimeMs { get; set; }
}


