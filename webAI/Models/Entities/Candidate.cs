using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace webAI.Models.Entities;

[Table("CANDIDATES")]
public class Candidate
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int CandidateId { get; set; }

    [Required]
    public int UserId { get; set; }

    [Required]
    [MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? Phone { get; set; }

    [MaxLength(100)]
    public string? TargetTitle { get; set; }

    [Column(TypeName = "decimal(3, 1)")]
    public decimal YearsOfExperience { get; set; } = 0.0m;

    public string? Summary { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey("UserId")]
    public virtual User? User { get; set; }

    public virtual ICollection<Cv> Cvs { get; set; } = new List<Cv>();
    public virtual ICollection<Application> Applications { get; set; } = new List<Application>();
}
