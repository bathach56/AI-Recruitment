param(
    [string]$RecruiterEmail = 'congty@recruitai.test',
    [string]$ConnectionString = 'Server=(localdb)\MSSQLLocalDB;Database=AIRecruitmentDb;Integrated Security=true;TrustServerCertificate=true'
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$sampleRoot = Join-Path $projectRoot 'data/sample_cvs'
$documentRoot = Join-Path $projectRoot 'webAI/App_Data/documents'
$manifest = Get-Content -LiteralPath (Join-Path $sampleRoot 'sample_cvs_manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$samples = @($manifest | Select-Object -First 10)
if ($samples.Count -ne 10) { throw 'Expected ten sample CVs in the repository manifest.' }
foreach ($sample in $samples) {
    if ([IO.Path]::GetFileName($sample.file_name) -ne $sample.file_name) { throw 'Invalid sample filename.' }
    if (!(Test-Path -LiteralPath (Join-Path $sampleRoot $sample.file_name))) { throw "Missing sample: $($sample.file_name)" }
}
[IO.Directory]::CreateDirectory($documentRoot) | Out-Null
$connection = New-Object System.Data.SqlClient.SqlConnection $ConnectionString
$connection.Open()
$transaction = $connection.BeginTransaction([Data.IsolationLevel]::Serializable)
function Query([string]$Sql, [hashtable]$Parameters) {
    $command = $connection.CreateCommand()
    $command.Transaction = $transaction
    $command.CommandText = $Sql
    foreach ($key in $Parameters.Keys) { [void]$command.Parameters.AddWithValue('@' + $key, $Parameters[$key]) }
    try { return $command.ExecuteScalar() } finally { $command.Dispose() }
}
try {
    $companyId = Query 'SELECT c.Id FROM Companies c JOIN USERS u ON c.OwnerSubject=CONVERT(nvarchar(450),u.UserId) WHERE u.Email=@email AND u.RoleName=N''Recruiter''' @{email=$RecruiterEmail}
    if (!$companyId) { throw 'Recruiter company not found. No accounts or companies were created.' }
    $title = '[Mau] Software Developer - ho so demo'
    $jobId = Query 'SELECT Id FROM Jobs WHERE CompanyId=@company AND Title=@title AND IsDemo=1' @{company=$companyId;title=$title}
    if (!$jobId) {
        $jobId = Query @'
INSERT INTO Jobs (CompanyId,Title,City,District,Category,WorkMode,EmploymentType,Experience,SalaryMin,SalaryMax,Skills,Description,Requirements,Benefits,Status,Urgent,IsDemo,Vacancies,CreatedAt,Deadline)
OUTPUT INSERTED.Id VALUES (@company,@title,N'Hồ Chí Minh',N'',N'Công nghệ',N'Hybrid',N'Toàn thời gian',N'1-5 năm',NULL,NULL,N'C#,SQL,Git',N'DỮ LIỆU MINH HỌA: dùng để xem và thử quản lý 10 CV mẫu. Không phải tin tuyển dụng thực tế.',N'Lập trình phần mềm, làm việc với cơ sở dữ liệu và Git.',N'Tin mẫu cho đồ án.',N'Draft',0,1,1,SYSDATETIMEOFFSET(),DATEADD(day,30,SYSDATETIMEOFFSET()))
'@ @{company=$companyId;title=$title}
    }
    $created = 0
    foreach ($sample in $samples) {
        $subject = "demo-recruiter-inbox-v1-$companyId-$($sample.id)"
        $candidateId = Query 'SELECT Id FROM Candidates WHERE Subject=@subject' @{subject=$subject}
        if (!$candidateId) {
            $candidateId = Query @'
INSERT INTO Candidates (Subject,FullName,Email,Phone,City,DesiredTitle,Summary)
OUTPUT INSERTED.Id VALUES (@subject,@name,@email,N'',N'Hồ Chí Minh',@role,@summary)
'@ @{subject=$subject;name=('[Mẫu] '+$sample.candidate_name);email=($sample.id.ToLowerInvariant()+'@demo.example.test');role=$sample.target_role;summary=('Hồ sơ minh họa, không phải ứng viên thật. '+$sample.summary)}
        }
        $resumeId = Query 'SELECT Id FROM Resumes WHERE CandidateId=@candidate AND Name=@name' @{candidate=$candidateId;name=$sample.file_name}
        if (!$resumeId) {
            $sourcePath = Join-Path $sampleRoot $sample.file_name
            $key = [Guid]::NewGuid().ToString('N') + '.docx'
            Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $documentRoot $key)
            $resumeId = Query @'
INSERT INTO Resumes (CandidateId,Name,StorageKey,Content,ContentType,Size,UpdatedAt)
OUTPUT INSERTED.Id VALUES (@candidate,@name,@key,N'Dữ liệu CV minh họa từ data/sample_cvs.',N'application/vnd.openxmlformats-officedocument.wordprocessingml.document',@size,SYSDATETIMEOFFSET())
'@ @{candidate=$candidateId;name=$sample.file_name;key=$key;size=(Get-Item -LiteralPath $sourcePath).Length}
        }
        $applicationId = Query 'SELECT Id FROM Applications WHERE CandidateId=@candidate AND JobId=@job' @{candidate=$candidateId;job=$jobId}
        if (!$applicationId) {
            [void](Query @'
INSERT INTO Applications (CandidateId,JobId,ResumeId,Status,CoverLetter,SubmittedAt)
OUTPUT INSERTED.Id VALUES (@candidate,@job,@resume,N'Submitted',N'HỒ SƠ MẪU: dữ liệu minh họa lấy từ bộ CV có sẵn trong dự án. Chưa chạy AI, chưa có điểm đối chiếu. Không phải lượt ứng tuyển thật.',SYSDATETIMEOFFSET())
'@ @{candidate=$candidateId;job=$jobId;resume=$resumeId})
            $created++
        }
    }
    $count = Query 'SELECT COUNT(*) FROM Applications WHERE JobId=@job' @{job=$jobId}
    if ($count -ne 10) { throw "Expected 10 demo applications, found $count." }
    $transaction.Commit()
    Write-Output "Demo inbox ready: $count applications ($created newly created), company $companyId, draft demo job $jobId. No AI scores added."
} catch {
    $transaction.Rollback()
    throw
} finally { $transaction.Dispose(); $connection.Dispose() }
