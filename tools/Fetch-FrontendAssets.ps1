$ErrorActionPreference='Stop'
$repoRoot=Split-Path $PSScriptRoot -Parent
$vendorRoot=Join-Path $repoRoot 'webAI/wwwroot/vendor'
New-Item -ItemType Directory -Path $vendorRoot -Force|Out-Null
$assets=@(
 @{Url='https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';Path='bootstrap/bootstrap.min.css'},
 @{Url='https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js';Path='bootstrap/bootstrap.bundle.min.js'},
 @{Url='https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/LICENSE';Path='bootstrap/LICENSE'},
 @{Url='https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css';Path='bootstrap-icons/bootstrap-icons.min.css'},
 @{Url='https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff2';Path='bootstrap-icons/fonts/bootstrap-icons.woff2'},
 @{Url='https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff';Path='bootstrap-icons/fonts/bootstrap-icons.woff'},
 @{Url='https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/LICENSE';Path='bootstrap-icons/LICENSE'},
 @{Url='https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/OFL.txt';Path='be-vietnam-pro/OFL.txt'}
)
foreach($asset in $assets){$target=Join-Path $vendorRoot $asset.Path;New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force|Out-Null;Invoke-WebRequest -UseBasicParsing -Uri $asset.Url -OutFile $target}
$fontCssUrl='https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;450;500;550;600;650;700;750;800&display=swap'
$css=(Invoke-WebRequest -UseBasicParsing -Uri $fontCssUrl -UserAgent 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36').Content
$fontUrls=[regex]::Matches($css,'url\((https://[^)]+)\)')|ForEach-Object {$_.Groups[1].Value}|Select-Object -Unique
if(-not $fontUrls){throw 'Khong tim thay tep font trong CSS nguon.'}
foreach($url in $fontUrls){$name=[IO.Path]::GetFileName(([Uri]$url).AbsolutePath);$target=Join-Path $vendorRoot ('be-vietnam-pro/'+$name);Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $target;$css=$css.Replace($url,'/vendor/be-vietnam-pro/'+$name);$assets+=@{Url=$url;Path='be-vietnam-pro/'+$name}}
[IO.File]::WriteAllText((Join-Path $vendorRoot 'be-vietnam-pro/fonts.css'),$css,[Text.UTF8Encoding]::new($false))
$manifest=@{Bootstrap='5.3.3';BootstrapIcons='1.11.3';FontCssSource=$fontCssUrl;Files=@($assets|ForEach-Object {@{Path=$_.Path;Source=$_.Url;Sha256=(Get-FileHash -Algorithm SHA256 (Join-Path $vendorRoot $_.Path)).Hash}})}
[IO.File]::WriteAllText((Join-Path $vendorRoot 'manifest.json'),($manifest|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
Write-Output "Da tai tai nguyen giao dien local va giay phep: $($assets.Count) tep."
