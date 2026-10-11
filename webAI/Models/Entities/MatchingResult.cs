using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace webAI.Models.Entities;

[Table("MATCHING_RESULTS")]
public class MatchingResult
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long MatchingId { get; set; }

    [Required]
    public int CvId { get; set; }

    [Required]
    public int JobId { get; set; }

    [Required]
    [MaxLength(30)]
    public string ModelType { get; set; } = "Hybrid"; // "TF-IDF", "Sentence-BERT", "Hybrid"

    [Column(TypeName = "decimal(5, 2)")]
    public decimal OverallScore { get; set; }

    [Column(TypeName = "decimal(5, 2)")]
    public decimal? SemanticScore { get; set; }

    [Column(TypeName = "decimal(5, 2)")]
    public decimal? SkillScore { get; set; }

    [Column(TypeName = "decimal(5, 2)")]
    public decimal? ExperienceScore { get; set; }

    public string? MatchedSkillsJson { get; set; }

    public string? MissingSkillsJson { get; set; }

    public string? BonusSkillsJson { get; set; }

    [Column(TypeName = "decimal(3, 1)")]
    public decimal? ExperienceYearsFound { get; set; }

    public string? AiExplanation { get; set; }

    public int ProcessingTimeMs { get; set; }

    public DateTime AnalyzedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey("CvId")]
    public virtual Cv? Cv { get; set; }

    [ForeignKey("JobId")]
    public virtual Job? Job { get; set; }
}
