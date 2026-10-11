using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace webAI.Models.Entities;

[Table("JOBS")]
public class Job
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int JobId { get; set; }

    [Required]
    public int RecruiterId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Description { get; set; } = string.Empty;

    public string? Responsibilities { get; set; }

    public string? Requirements { get; set; }

    [MaxLength(100)]
    public string? SalaryRange { get; set; }

    [MaxLength(50)]
    public string? JobType { get; set; } = "Full-time";

    [Column(TypeName = "decimal(3, 1)")]
    public decimal MinExperienceRequired { get; set; } = 0.0m;

    [MaxLength(50)]
    public string Status { get; set; } = "Active"; // "Active", "Closed", "Draft"

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    [ForeignKey("RecruiterId")]
    public virtual Recruiter? Recruiter { get; set; }

    public virtual ICollection<JobSkill> JobSkills { get; set; } = new List<JobSkill>();
    public virtual ICollection<Application> Applications { get; set; } = new List<Application>();
    public virtual ICollection<MatchingResult> MatchingResults { get; set; } = new List<MatchingResult>();
}
