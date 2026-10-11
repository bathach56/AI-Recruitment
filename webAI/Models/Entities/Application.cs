using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace webAI.Models.Entities;

[Table("APPLICATIONS")]
public class Application
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int ApplicationId { get; set; }

    [Required]
    public int JobId { get; set; }

    [Required]
    public int CandidateId { get; set; }

    [Required]
    public int CvId { get; set; }

    [MaxLength(50)]
    public string Status { get; set; } = "Pending"; // "Pending", "Shortlisted", "Rejected", "Interviewed"

    public string? RecruiterNotes { get; set; }

    public DateTime AppliedAt { get; set; } = DateTime.UtcNow;

    public DateTime? StatusUpdatedAt { get; set; }

    // Navigation properties
    [ForeignKey("JobId")]
    public virtual Job? Job { get; set; }

    [ForeignKey("CandidateId")]
    public virtual Candidate? Candidate { get; set; }

    [ForeignKey("CvId")]
    public virtual Cv? Cv { get; set; }
}
