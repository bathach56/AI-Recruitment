$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$runtimeRoot = Join-Path $repoRoot '.local-run'
foreach ($name in @('web','ai')) {
    $pidFile = Join-Path $runtimeRoot ($name + '.pid')
    if (-not (Test-Path $pidFile)) { continue }
    $serviceId = [int](Get-Content -LiteralPath $pidFile -Raw).Trim()
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$serviceId"
    if (-not $process) { Write-Host "$name da dung."; continue }
    $expected = if ($name -eq 'web') { $process.CommandLine -match '\.local-run[/\\]web[/\\]webAI.dll' } else {
        $process.CommandLine -match 'uvicorn api:app' -and $process.ExecutablePath -eq (Join-Path $repoRoot 'backend test/.venv/Scripts/python.exe')
    }
    if (-not $expected) { throw "PID $serviceId khong con thuoc dich vu da khoi dong; khong dung tien trinh nay." }
    Stop-Process -Id $serviceId
    Write-Host "Da dung $name."
}
