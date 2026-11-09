using Microsoft.EntityFrameworkCore;

namespace webAI.Data;

public class CvReviewBatch
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int CompanyId { get; set; }
    public string Title { get; set; } = "";
    public string Model { get; set; } = "";
    public string ConfigurationJson { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public class CvReviewItem
{
    public int Id { get; set; }
    public Guid BatchId { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Source { get; set; } = "";
    public string FileName { get; set; } = "";
    public string StorageKey { get; set; } = "";
    public string CvText { get; set; } = "";
    public string State { get; set; } = "Queued";
    public string Error { get; set; } = "";
    public string ResultJson { get; set; } = "";
    public double? Score { get; set; }
    public double? SemanticScore { get; set; }
    public double? SkillScore { get; set; }
    public double? ExperienceScore { get; set; }
    public DateTimeOffset? AnalyzedAt { get; set; }
}
public static class CvReviewSetup
{
    // Additive setup: this database predates EF migrations; do not recreate it.
    public static Task InitializeAsync(RecruitmentDbContext db) => db.Database.ExecuteSqlRawAsync("""
        IF OBJECT_ID(N'dbo.CvReviewBatches',N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.CvReviewBatches (
                Id uniqueidentifier NOT NULL PRIMARY KEY, CompanyId int NOT NULL REFERENCES dbo.Companies(Id),
                Title nvarchar(500) NOT NULL, Model nvarchar(50) NOT NULL, ConfigurationJson nvarchar(max) NOT NULL,
                CreatedAt datetimeoffset NOT NULL);
            CREATE INDEX IX_CvReviewBatches_CompanyId ON dbo.CvReviewBatches(CompanyId);
        END;
        IF OBJECT_ID(N'dbo.CvReviewItems',N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.CvReviewItems (
                Id int IDENTITY PRIMARY KEY, BatchId uniqueidentifier NOT NULL REFERENCES dbo.CvReviewBatches(Id),
                Name nvarchar(500) NOT NULL, Email nvarchar(150) NOT NULL, Source nvarchar(50) NOT NULL,
                FileName nvarchar(500) NOT NULL, StorageKey nvarchar(450) NOT NULL, CvText nvarchar(max) NOT NULL,
                State nvarchar(50) NOT NULL, Error nvarchar(1000) NOT NULL, ResultJson nvarchar(max) NOT NULL,
                Score float NULL, SemanticScore float NULL, SkillScore float NULL, ExperienceScore float NULL,
                AnalyzedAt datetimeoffset NULL,
                CONSTRAINT CK_CvReviewItems_Score CHECK (Score IS NULL OR (Score>=0 AND Score<=100)));
            CREATE INDEX IX_CvReviewItems_BatchId ON dbo.CvReviewItems(BatchId);
        END;
        """);
}
