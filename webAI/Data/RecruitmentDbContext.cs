using Microsoft.EntityFrameworkCore;

namespace webAI.Data;

public class RecruitmentDbContext(DbContextOptions<RecruitmentDbContext> options) : DbContext(options)
{
    public DbSet<webAI.Models.Entities.User> Users => Set<webAI.Models.Entities.User>();
    public DbSet<CvReviewBatch> CvReviewBatches => Set<CvReviewBatch>();
    public DbSet<CvReviewItem> CvReviewItems => Set<CvReviewItem>();
    public DbSet<JobPosting> Jobs => Set<JobPosting>();
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<CandidateProfile> Candidates => Set<CandidateProfile>();
    public DbSet<Resume> Resumes => Set<Resume>();
    public DbSet<JobApplication> Applications => Set<JobApplication>();
    public DbSet<SavedJob> SavedJobs => Set<SavedJob>();
    public DbSet<ApplicationMatch> Matches => Set<ApplicationMatch>();
    public DbSet<RecruitmentNotification> Notifications => Set<RecruitmentNotification>();
    public DbSet<CompanyVerification> Verifications => Set<CompanyVerification>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<CvReviewBatch>().HasOne<Company>().WithMany().HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<CvReviewItem>().HasOne<CvReviewBatch>().WithMany().HasForeignKey(x => x.BatchId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<CvReviewBatch>().Property(x => x.Title).HasMaxLength(500);
        model.Entity<CvReviewBatch>().Property(x => x.ConfigurationJson).HasColumnType("nvarchar(max)");
        model.Entity<CvReviewItem>().Property(x => x.Name).HasMaxLength(500);
        model.Entity<CvReviewItem>().Property(x => x.Email).HasMaxLength(150);
        model.Entity<CvReviewItem>().Property(x => x.FileName).HasMaxLength(500);
        model.Entity<CvReviewItem>().Property(x => x.Error).HasMaxLength(1000);
        model.Entity<CvReviewItem>().Property(x => x.CvText).HasColumnType("nvarchar(max)");
        model.Entity<CvReviewItem>().Property(x => x.ResultJson).HasColumnType("nvarchar(max)");
        // These legacy navigation models belong to the old schema, not this context.
        model.Ignore<webAI.Models.Entities.Candidate>();
        model.Ignore<webAI.Models.Entities.Recruiter>();
        model.Ignore<webAI.Models.Entities.Job>();
        model.Ignore<webAI.Models.Entities.JobSkill>();
        model.Ignore<webAI.Models.Entities.Skill>();
        model.Ignore<webAI.Models.Entities.Cv>();
        model.Ignore<webAI.Models.Entities.Application>();
        model.Ignore<webAI.Models.Entities.MatchingResult>();
        model.Entity<webAI.Models.Entities.User>().Ignore(x => x.Candidate).Ignore(x => x.Recruiter);
        model.Entity<webAI.Models.Entities.User>().HasIndex(x => x.Email).IsUnique();
        model.Entity<webAI.Models.Entities.User>().Property(x => x.PasswordHash).HasMaxLength(450);
        model.Entity<JobPosting>().HasOne<Company>().WithMany().HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<CandidateProfile>().HasIndex(x => x.Subject).IsUnique();
        model.Entity<Company>().HasIndex(x => x.OwnerSubject);
        model.Entity<Resume>().HasOne<CandidateProfile>().WithMany().HasForeignKey(x => x.CandidateId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<SavedJob>().HasKey(x => new { x.CandidateId, x.JobId });
        model.Entity<SavedJob>().HasOne<CandidateProfile>().WithMany().HasForeignKey(x => x.CandidateId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<SavedJob>().HasOne<JobPosting>().WithMany().HasForeignKey(x => x.JobId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<JobApplication>().HasIndex(x => new { x.CandidateId, x.JobId }).IsUnique();
        model.Entity<JobApplication>().HasOne<CandidateProfile>().WithMany().HasForeignKey(x => x.CandidateId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<JobApplication>().HasOne<JobPosting>().WithMany().HasForeignKey(x => x.JobId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<JobApplication>().HasOne<Resume>().WithMany().HasForeignKey(x => x.ResumeId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<ApplicationMatch>().HasIndex(x => x.ApplicationId).IsUnique();
        model.Entity<ApplicationMatch>().HasOne<JobApplication>().WithMany().HasForeignKey(x => x.ApplicationId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<ApplicationMatch>().ToTable(t => t.HasCheckConstraint("CK_Match_Score", "[OverallScore] IS NULL OR ([OverallScore] >= 0 AND [OverallScore] <= 100)"));
        model.Entity<CompanyVerification>().HasOne<Company>().WithMany().HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<JobPosting>().Property(x => x.SalaryMin).HasPrecision(12, 2);
        model.Entity<JobPosting>().Property(x => x.SalaryMax).HasPrecision(12, 2);
        foreach (var type in model.Model.GetEntityTypes())
            foreach (var property in type.GetProperties().Where(p => p.ClrType == typeof(string) && p.GetMaxLength() == null && p.GetColumnType() != "nvarchar(max)"))
                property.SetMaxLength(property.Name is "Description" or "Requirements" or "Benefits" or "Content" or "EvidenceJson" ? 16000 : 450);
    }
}

public class Company
{
    public int Id { get; set; }
    public string OwnerSubject { get; set; } = "";
    public string Name { get; set; } = "";
    public string Initials { get; set; } = "";
    public string Color { get; set; } = "blue";
    public string Industry { get; set; } = "";
    public string TaxCode { get; set; } = "";
    public string Website { get; set; } = "";
    public string VerificationStatus { get; set; } = "Pending";
    public bool IsDemo { get; set; }
}
public class JobPosting
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string Title { get; set; } = "";
    public string City { get; set; } = "";
    public string District { get; set; } = "";
    public string Category { get; set; } = "";
    public string WorkMode { get; set; } = "Tại văn phòng";
    public string EmploymentType { get; set; } = "Toàn thời gian";
    public string Experience { get; set; } = "";
    public decimal? SalaryMin { get; set; }
    public decimal? SalaryMax { get; set; }
    public string Skills { get; set; } = "";
    public string Description { get; set; } = "";
    public string Requirements { get; set; } = "";
    public string Benefits { get; set; } = "";
    public string Status { get; set; } = "Published";
    public bool Urgent { get; set; }
    public bool IsDemo { get; set; }
    public int Vacancies { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset Deadline { get; set; }
}
public class CandidateProfile
{
    public int Id { get; set; }
    public string Subject { get; set; } = "";
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string City { get; set; } = "";
    public string DesiredTitle { get; set; } = "";
    public string Summary { get; set; } = "";
}
public class Resume
{
    public int Id { get; set; }
    public int CandidateId { get; set; }
    public string Name { get; set; } = "";
    public string StorageKey { get; set; } = "";
    public string Content { get; set; } = "";
    public string ContentType { get; set; } = "";
    public long Size { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public class JobApplication
{
    public int Id { get; set; }
    public int CandidateId { get; set; }
    public int JobId { get; set; }
    public int ResumeId { get; set; }
    public string Status { get; set; } = "Submitted";
    public string CoverLetter { get; set; } = "";
    public DateTimeOffset SubmittedAt { get; set; } = DateTimeOffset.UtcNow;
}
public class SavedJob { public int CandidateId { get; set; } public int JobId { get; set; } }
public class ApplicationMatch
{
    public int Id { get; set; }
    public int ApplicationId { get; set; }
    public double? OverallScore { get; set; }
    public string Model { get; set; } = "Hybrid";
    public string Status { get; set; } = "Pending";
    public string EvidenceJson { get; set; } = "";
    public DateTimeOffset? AnalyzedAt { get; set; }
}
public class RecruitmentNotification
{
    public int Id { get; set; }
    public string RecipientSubject { get; set; } = "";
    public int? ApplicationId { get; set; }
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public string Channel { get; set; } = "Web";
    public string DeliveryStatus { get; set; } = "Pending";
    public DateTimeOffset? ReadAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public class CompanyVerification
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string DocumentStorageKey { get; set; } = "";
    public string Status { get; set; } = "Pending";
    public DateTimeOffset SubmittedAt { get; set; } = DateTimeOffset.UtcNow;
}
