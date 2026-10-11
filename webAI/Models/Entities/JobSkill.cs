using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace webAI.Models.Entities;

[Table("JOB_SKILLS")]
public class JobSkill
{
    [Key, Column(Order = 0)]
    public int JobId { get; set; }

    [Key, Column(Order = 1)]
    public int SkillId { get; set; }

    public bool IsRequired { get; set; } = true; // true: Must-have, false: Nice-to-have

    [Column(TypeName = "decimal(3, 1)")]
    public decimal MinYearsExperience { get; set; } = 0.0m;

    // Navigation properties
    [ForeignKey("JobId")]
    public virtual Job? Job { get; set; }

    [ForeignKey("SkillId")]
    public virtual Skill? Skill { get; set; }
}
