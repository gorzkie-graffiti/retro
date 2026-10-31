$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw 'Node.js 20 or newer is required. Install it from https://nodejs.org/.'
}

$python = if (Get-Command py.exe -ErrorAction SilentlyContinue) { 'py.exe' } elseif (Get-Command python.exe -ErrorAction SilentlyContinue) { 'python.exe' } else { throw 'Python 3 is required. Install it from https://www.python.org/downloads/.' }
if (-not (Test-Path 'retro-pkp\node_modules')) { & npm.cmd --prefix retro-pkp ci; if ($LASTEXITCODE) { exit $LASTEXITCODE } }

Write-Host 'Starting the PKP Worker on http://127.0.0.1:8787 ...'
$worker = Start-Process -FilePath 'npx.cmd' -ArgumentList '--yes', 'wrangler', 'dev', '--port', '8787' -WorkingDirectory "$PSScriptRoot\retro-pkp" -PassThru
try {
  Start-Sleep -Seconds 2
  Write-Host 'Starting the site on http://127.0.0.1:8000 ...'
  if ($python -eq 'py.exe') { & py.exe -3 -m http.server 8000 --directory retro-pkp } else { & python.exe -m http.server 8000 --directory retro-pkp }
} finally {
  if (-not $worker.HasExited) { Stop-Process -Id $worker.Id -Force }
}
