using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace webAI.Models.Entities;

[Table("SKILLS")]
public class Skill
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int SkillId { get; set; }

    [Required]
    [MaxLength(100)]
    public string SkillName { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string NormalizedName { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Category { get; set; } = string.Empty; // "Programming_Languages", "Databases", "DevOps_and_Cloud", etc.

    public string? AliasesJson { get; set; } // JSON array of synonyms / aliases

    [Column(TypeName = "decimal(3, 2)")]
    public decimal DefaultWeight { get; set; } = 1.0m;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public virtual ICollection<JobSkill> JobSkills { get; set; } = new List<JobSkill>();
}
