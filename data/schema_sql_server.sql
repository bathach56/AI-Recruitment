-- ============================================================================
-- RECRUITAI SYSTEM - SQL SERVER DATABASE SCHEMA DDL
-- Đề tài: Hệ thống Tuyển dụng Thông minh & So khớp Hồ sơ CV với Job Description
-- Nhóm: 2 sinh viên (Thành viên 1: Backend/DB & Thành viên 2: AI/Frontend/Research)
-- ============================================================================

-- 1. BẢNG USERS (Xác thực và phân quyền 3 vai trò)
CREATE TABLE USERS (
    UserId INT IDENTITY(1,1) PRIMARY KEY,
    Email NVARCHAR(150) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(MAX) NOT NULL,
    RoleName NVARCHAR(50) NOT NULL CHECK (RoleName IN ('Candidate', 'Recruiter', 'Admin')),
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    LastLoginAt DATETIME2 NULL
);
CREATE INDEX IX_USERS_Email ON USERS(Email);

-- 2. BẢNG CANDIDATES (Hồ sơ ứng viên)
CREATE TABLE CANDIDATES (
    CandidateId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL UNIQUE,
    FullName NVARCHAR(150) NOT NULL,
    Phone VARCHAR(20) NULL,
    TargetTitle NVARCHAR(100) NULL,
    YearsOfExperience DECIMAL(3,1) NOT NULL DEFAULT 0.0,
    Summary NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_CANDIDATES_USERS FOREIGN KEY (UserId) REFERENCES USERS(UserId) ON DELETE CASCADE
);

-- 3. BẢNG RECRUITERS (Hồ sơ nhà tuyển dụng / doanh nghiệp)
CREATE TABLE RECRUITERS (
    RecruiterId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL UNIQUE,
    CompanyName NVARCHAR(150) NOT NULL,
    Position NVARCHAR(100) NULL,
    CompanyWebsite NVARCHAR(200) NULL,
    CompanyLocation NVARCHAR(200) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_RECRUITERS_USERS FOREIGN KEY (UserId) REFERENCES USERS(UserId) ON DELETE CASCADE
);

-- 4. BẢNG JOBS (Tin tuyển dụng / Job Description)
CREATE TABLE JOBS (
    JobId INT IDENTITY(1,1) PRIMARY KEY,
    RecruiterId INT NOT NULL,
    Title NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NOT NULL,
    Responsibilities NVARCHAR(MAX) NULL,
    Requirements NVARCHAR(MAX) NULL,
    SalaryRange NVARCHAR(100) NULL,
    JobType NVARCHAR(50) NOT NULL DEFAULT 'Full-time',
    MinExperienceRequired DECIMAL(3,1) NOT NULL DEFAULT 0.0,
    Status NVARCHAR(50) NOT NULL DEFAULT 'Active' CHECK (Status IN ('Active', 'Closed', 'Draft')),
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NULL,
    CONSTRAINT FK_JOBS_RECRUITERS FOREIGN KEY (RecruiterId) REFERENCES RECRUITERS(RecruiterId) ON DELETE CASCADE
);
CREATE INDEX IX_JOBS_Status ON JOBS(Status);

-- 5. BẢNG CVS (Metadata hồ sơ đính kèm và trích xuất text)
CREATE TABLE CVS (
    CvId INT IDENTITY(1,1) PRIMARY KEY,
    CandidateId INT NOT NULL,
    FileName NVARCHAR(255) NOT NULL,
    FilePath NVARCHAR(500) NOT NULL,
    FileSizeBytes BIGINT NOT NULL,
    FileExtension VARCHAR(20) NOT NULL DEFAULT '.pdf',
    RawText NVARCHAR(MAX) NULL,
    DetectedSkillsJson NVARCHAR(MAX) NULL,
    EstimatedExperienceYears DECIMAL(3,1) NOT NULL DEFAULT 0.0,
    UploadedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_CVS_CANDIDATES FOREIGN KEY (CandidateId) REFERENCES CANDIDATES(CandidateId) ON DELETE CASCADE
);

-- 6. BẢNG SKILLS (Từ điển kỹ năng chuẩn hóa - Skill Taxonomy & Ontology)
CREATE TABLE SKILLS (
    SkillId INT IDENTITY(1,1) PRIMARY KEY,
    SkillName NVARCHAR(100) NOT NULL,
    NormalizedName VARCHAR(100) NOT NULL UNIQUE,
    Category NVARCHAR(50) NOT NULL,
    AliasesJson NVARCHAR(MAX) NULL,
    DefaultWeight DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);
CREATE INDEX IX_SKILLS_NormalizedName ON SKILLS(NormalizedName);
CREATE INDEX IX_SKILLS_Category ON SKILLS(Category);

-- 7. BẢNG JOB_SKILLS (Liên kết N-N: Kỹ năng yêu cầu cho từng công việc)
CREATE TABLE JOB_SKILLS (
    JobId INT NOT NULL,
    SkillId INT NOT NULL,
    IsRequired BIT NOT NULL DEFAULT 1, -- 1: Must-have, 0: Nice-to-have
    MinYearsExperience DECIMAL(3,1) NOT NULL DEFAULT 0.0,
    CONSTRAINT PK_JOB_SKILLS PRIMARY KEY (JobId, SkillId),
    CONSTRAINT FK_JOB_SKILLS_JOBS FOREIGN KEY (JobId) REFERENCES JOBS(JobId) ON DELETE CASCADE,
    CONSTRAINT FK_JOB_SKILLS_SKILLS FOREIGN KEY (SkillId) REFERENCES SKILLS(SkillId) ON DELETE CASCADE
);

-- 8. BẢNG APPLICATIONS (Nộp hồ sơ ứng tuyển)
CREATE TABLE APPLICATIONS (
    ApplicationId INT IDENTITY(1,1) PRIMARY KEY,
    JobId INT NOT NULL,
    CandidateId INT NOT NULL,
    CvId INT NOT NULL,
    Status NVARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (Status IN ('Pending', 'Shortlisted', 'Rejected', 'Interviewed')),
    RecruiterNotes NVARCHAR(MAX) NULL,
    AppliedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    StatusUpdatedAt DATETIME2 NULL,
    CONSTRAINT FK_APPLICATIONS_JOBS FOREIGN KEY (JobId) REFERENCES JOBS(JobId),
    CONSTRAINT FK_APPLICATIONS_CANDIDATES FOREIGN KEY (CandidateId) REFERENCES CANDIDATES(CandidateId),
    CONSTRAINT FK_APPLICATIONS_CVS FOREIGN KEY (CvId) REFERENCES CVS(CvId)
);
CREATE INDEX IX_APPLICATIONS_JobId ON APPLICATIONS(JobId);
CREATE INDEX IX_APPLICATIONS_CandidateId ON APPLICATIONS(CandidateId);

-- 9. BẢNG MATCHING_RESULTS (Kết quả so khớp AI Đa tầng & Explainable AI)
CREATE TABLE MATCHING_RESULTS (
    MatchingId BIGINT IDENTITY(1,1) PRIMARY KEY,
    CvId INT NOT NULL,
    JobId INT NOT NULL,
    ModelType VARCHAR(30) NOT NULL DEFAULT 'Hybrid', -- 'TF-IDF', 'Sentence-BERT', 'Hybrid'
    OverallScore DECIMAL(5,2) NOT NULL,
    SemanticScore DECIMAL(5,2) NULL,
    SkillScore DECIMAL(5,2) NULL,
    ExperienceScore DECIMAL(5,2) NULL,
    MatchedSkillsJson NVARCHAR(MAX) NULL,
    MissingSkillsJson NVARCHAR(MAX) NULL,
    BonusSkillsJson NVARCHAR(MAX) NULL,
    ExperienceYearsFound DECIMAL(3,1) NULL,
    AiExplanation NVARCHAR(MAX) NULL,
    ProcessingTimeMs INT NOT NULL,
    AnalyzedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_MATCHING_RESULTS_CVS FOREIGN KEY (CvId) REFERENCES CVS(CvId) ON DELETE CASCADE,
    CONSTRAINT FK_MATCHING_RESULTS_JOBS FOREIGN KEY (JobId) REFERENCES JOBS(JobId) ON DELETE CASCADE
);
CREATE INDEX IX_MATCHING_RESULTS_CvId_JobId ON MATCHING_RESULTS(CvId, JobId);
CREATE INDEX IX_MATCHING_RESULTS_OverallScore ON MATCHING_RESULTS(OverallScore DESC);

-- ============================================================================
-- DỮ LIỆU SEED MẪU BAN ĐẦU CHO BẢNG SKILLS (Top kỹ năng chuẩn hóa)
-- ============================================================================
INSERT INTO SKILLS (SkillName, NormalizedName, Category, AliasesJson, DefaultWeight) VALUES
('C#', 'csharp', 'Programming_Languages', '["c#", "c-sharp", "c sharp", "csharp"]', 1.5),
('Java', 'java', 'Programming_Languages', '["java", "core java", "java 8", "java 11", "java 17"]', 1.5),
('Python', 'python', 'Programming_Languages', '["python", "python 3", "python3", "py"]', 1.5),
('JavaScript', 'javascript', 'Programming_Languages', '["javascript", "js", "ecmascript", "es6"]', 1.2),
('TypeScript', 'typescript', 'Programming_Languages', '["typescript", "ts"]', 1.2),
('ASP.NET Core', 'aspnet_core', 'Frameworks_and_Libraries', '["asp.net", "asp.net core", ".net core", "dotnet core", ".net 8", ".net 10"]', 1.5),
('Spring Boot', 'spring_boot', 'Frameworks_and_Libraries', '["spring boot", "spring framework", "spring mvc"]', 1.5),
('React', 'react', 'Frameworks_and_Libraries', '["react", "react.js", "reactjs", "react native"]', 1.3),
('SQL Server', 'sql_server', 'Databases_and_Storage', '["sql server", "ms sql", "mssql", "microsoft sql server", "t-sql"]', 1.4),
('PostgreSQL', 'postgresql', 'Databases_and_Storage', '["postgresql", "postgres", "psql"]', 1.3),
('Docker', 'docker', 'DevOps_and_Cloud', '["docker", "container", "docker-compose"]', 1.2),
('Kubernetes', 'kubernetes', 'DevOps_and_Cloud', '["kubernetes", "k8s"]', 1.3),
('Machine Learning', 'machine_learning', 'AI_and_Data_Science', '["machine learning", "ml"]', 1.5),
('RESTful API', 'rest_api', 'Architecture_and_Design', '["rest", "restful", "rest api", "web api"]', 1.2),
('Teamwork', 'teamwork', 'Soft_Skills', '["teamwork", "collaboration", "làm việc nhóm"]', 1.0);
