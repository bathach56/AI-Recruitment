using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace webAI.Models.Entities;

[Table("CVS")]
public class Cv
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int CvId { get; set; }

    [Required]
    public int CandidateId { get; set; }

    [Required]
    [MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    [Required]
    [MaxLength(500)]
    public string FilePath { get; set; } = string.Empty;

    public long FileSizeBytes { get; set; }

    [MaxLength(20)]
    public string FileExtension { get; set; } = ".pdf"; // ".pdf", ".docx"

    public string? RawText { get; set; }

    public string? DetectedSkillsJson { get; set; }

    [Column(TypeName = "decimal(3, 1)")]
    public decimal EstimatedExperienceYears { get; set; } = 0.0m;

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey("CandidateId")]
    public virtual Candidate? Candidate { get; set; }

    public virtual ICollection<Application> Applications { get; set; } = new List<Application>();
    public virtual ICollection<MatchingResult> MatchingResults { get; set; } = new List<MatchingResult>();
}
