using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace webAI.Models.Entities;

[Table("RECRUITERS")]
public class Recruiter
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int RecruiterId { get; set; }

    [Required]
    public int UserId { get; set; }

    [Required]
    [MaxLength(150)]
    public string CompanyName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Position { get; set; }

    [MaxLength(200)]
    public string? CompanyWebsite { get; set; }

    [MaxLength(200)]
    public string? CompanyLocation { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey("UserId")]
    public virtual User? User { get; set; }

    public virtual ICollection<Job> Jobs { get; set; } = new List<Job>();
}
