param([switch]$WebOnly, [switch]$SkipBuild, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$runtimeRoot = Join-Path $repoRoot '.local-run'
$webRoot = Join-Path $repoRoot 'webAI'
$aiRoot = Join-Path $repoRoot 'backend test'
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null

function Test-Endpoint([string]$Url) {
    try { $null = Invoke-RestMethod -Uri $Url -TimeoutSec 2; return $true } catch { return $false }
}
function Wait-Endpoint([string]$Url, [int]$Seconds) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    do { if (Test-Endpoint $Url) { return }; Start-Sleep -Milliseconds 500 } while ((Get-Date) -lt $deadline)
    throw "Dich vu chua san sang: $Url. Xem log trong .local-run."
}

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw 'Can cai .NET SDK theo webAI.csproj.' }
$runningWeb = Test-Endpoint 'http://localhost:5132/api/account/session'
if (-not $runningWeb) {
    if (Get-NetTCPConnection -State Listen -LocalPort 5132 -ErrorAction SilentlyContinue) { throw 'Cong 5132 dang bi chiem; khong tu dung tien trinh khac.' }
    if (-not $SkipBuild) {
        Push-Location $repoRoot
        try { dotnet build webAI/webAI.csproj -p:UseAppHost=false -o .local-run/web; if ($LASTEXITCODE -ne 0) { throw 'Bien dich web that bai.' } }
        finally { Pop-Location }
    }
    if (-not (Test-Path (Join-Path $runtimeRoot 'web/webAI.dll'))) { throw 'Chua co ban build. Chay lai khong dung -SkipBuild.' }
    $webProcess = Start-Process dotnet -ArgumentList '../.local-run/web/webAI.dll --urls http://localhost:5132 --environment Development' -WorkingDirectory $webRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeRoot 'web.stdout.log') -RedirectStandardError (Join-Path $runtimeRoot 'web.stderr.log')
    $webProcess.Id | Set-Content (Join-Path $runtimeRoot 'web.pid')
}
Wait-Endpoint 'http://localhost:5132/api/account/session' 60
if (-not $WebOnly) {
    try {
        if (-not (Test-Endpoint 'http://127.0.0.1:8000/health')) {
            if (Get-NetTCPConnection -State Listen -LocalPort 8000 -ErrorAction SilentlyContinue) { throw 'Cong 8000 dang bi chiem hoac AI chua san sang. Kiem tra log truoc khi thu lai.' }
            $pythonPath = Join-Path $aiRoot '.venv/Scripts/python.exe'
            if (-not (Test-Path $pythonPath)) { throw 'Chua co moi truong Python cua AI. Xem docs/CHAY_LOCAL.md.' }
            $aiProcess = Start-Process $pythonPath -ArgumentList '-m uvicorn api:app --host 127.0.0.1 --port 8000' -WorkingDirectory $aiRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeRoot 'ai.stdout.log') -RedirectStandardError (Join-Path $runtimeRoot 'ai.stderr.log')
            $aiProcess.Id | Set-Content (Join-Path $runtimeRoot 'ai.pid')
        }
        Wait-Endpoint 'http://127.0.0.1:8000/health' 90
        Write-Host 'AI san sang.'
    } catch { Write-Warning ("Web van dung duoc, chua xet CV moi duoc: " + $_.Exception.Message) }
}
Write-Host 'Mo web: http://localhost:5132'
Write-Host 'Log: .local-run | Dung: .\tools\Stop-Local.ps1'
if (-not $NoBrowser) { Start-Process 'http://localhost:5132' -WindowStyle Normal }
