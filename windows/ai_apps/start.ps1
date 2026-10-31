[CmdletBinding()]
param(
  [ValidateSet('bridge', 'api', 'web2api', 'ai-studio')]
  [string] $Use,
  [ValidateRange(1, 65535)]
  [int] $Port,
  [switch] $Build,
  [switch] $NoBridge
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location $root

function Import-DotEnv([string] $Path) {
  if (-not (Test-Path $Path)) { return }
  foreach ($line in Get-Content $Path) {
    $line = $line.Trim()
    if (-not $line -or $line.StartsWith('#')) { continue }
    $match = [regex]::Match($line, '^(?<key>[A-Za-z_][A-Za-z0-9_]*)=(?<value>.*)$')
    if ($match.Success) { [Environment]::SetEnvironmentVariable($match.Groups['key'].Value, $match.Groups['value'].Value, 'Process') }
  }
}

function Test-Listening([string] $Url) {
  try {
    $uri = [uri]$Url
    $client = [System.Net.Sockets.TcpClient]::new()
    $connection = $client.BeginConnect($uri.Host, $(if ($uri.IsDefaultPort) { if ($uri.Scheme -eq 'https') { 443 } else { 80 } } else { $uri.Port }), $null, $null)
    if (-not $connection.AsyncWaitHandle.WaitOne(400)) { $client.Close(); return $false }
    $client.EndConnect($connection); $client.Close(); return $true
  } catch { return $false }
}

Import-DotEnv "$root\.env"
if ($Use -eq 'web2api') { $Use = 'bridge' }
if ($Use -eq 'ai-studio') { $Use = 'api' }
if ($Use -eq 'api' -and -not $env:GEMINI_API_KEY) { throw 'start.ps1: --Use api needs GEMINI_API_KEY in .env. Copy .env.example to .env, add the key, then try again.' }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'start.ps1: npm was not found. Install Node.js 20 or newer.' }
if (-not (Test-Path "$root\node_modules")) { Write-Host 'Installing frontend dependencies...'; & npm.cmd install; if ($LASTEXITCODE) { exit $LASTEXITCODE } }

$bridgeUrl = if ($env:BRIDGE_URL) { $env:BRIDGE_URL.TrimEnd('/') } else { 'http://127.0.0.1:8081/v1' }
$bridgeProcess = $null
try {
  if ($Use -ne 'api' -and -not $NoBridge) {
    $uri = [uri]$bridgeUrl
    if (Test-Listening $bridgeUrl) { Write-Host "Bridge already listening at $bridgeUrl" }
    elseif ($uri.Host -notin @('127.0.0.1', 'localhost')) { Write-Host "Bridge URL is remote ($bridgeUrl); not starting a local copy." }
    elseif (-not (Test-Path "$root\gemini-web2api\gemini_web2api.py")) { Write-Warning 'gemini-web2api is missing, so the bridge was not started.' }
    else {
      $python = if (Get-Command py.exe -ErrorAction SilentlyContinue) { 'py.exe' } elseif (Get-Command python.exe -ErrorAction SilentlyContinue) { 'python.exe' } else { $null }
      if (-not $python) { Write-Warning 'Python was not found, so gemini-web2api was not started.' }
      else {
        $bridgePort = if ($uri.IsDefaultPort) { 8081 } else { $uri.Port }
        Write-Host "Starting gemini-web2api on port $bridgePort..."
        $arguments = if ($python -eq 'py.exe') { @('-3', 'gemini_web2api.py', '--port', "$bridgePort") } else { @('gemini_web2api.py', '--port', "$bridgePort") }
        $bridgeProcess = Start-Process -FilePath $python -ArgumentList $arguments -WorkingDirectory "$root\gemini-web2api" -RedirectStandardOutput "$root\gemini-web2api\bridge.log" -RedirectStandardError "$root\gemini-web2api\bridge-error.log" -PassThru
        $bridgeReady = $false
        for ($attempt = 1; $attempt -le 30; $attempt++) {
          if (Test-Listening $bridgeUrl) { $bridgeReady = $true; break }
          if ($bridgeProcess.HasExited) { break }
          Start-Sleep -Milliseconds 500
        }
        if ($bridgeReady) { Write-Host "Bridge ready at $bridgeUrl" } else { Write-Warning 'Bridge did not come up. See gemini-web2api\bridge.log; the web app will still start.' }
      }
    }
  }

  if ($Use -eq 'api') { $env:VITE_GEMINI_PROXY = '1'; $env:VITE_DEFAULT_PROVIDER = 'api'; Write-Host 'Backend: Google Gemini API (key from .env, added by the local proxy)' }
  elseif ($Use -eq 'bridge') { $env:VITE_GEMINI_PROXY = '0'; $env:VITE_DEFAULT_PROVIDER = 'bridge'; Write-Host "Backend: gemini-web2api bridge at $bridgeUrl" }
  else { Write-Host 'Backend: using the choice saved in the browser' }

  $vite = Join-Path $root 'node_modules\.bin\vite.cmd'
  if (-not (Test-Path $vite)) { throw 'start.ps1: Vite is missing. Run npm install first.' }
  $servePort = if ($Port) { $Port } elseif ($Build) { 4173 } else { 5173 }
  if ($Build) { Write-Host 'Building the production bundle...'; & npm.cmd run build; if ($LASTEXITCODE) { exit $LASTEXITCODE }; & $vite preview --port $servePort }
  else { Write-Host "Starting the dev server on http://127.0.0.1:$servePort/"; & $vite --port $servePort }
} finally {
  if ($bridgeProcess -and -not $bridgeProcess.HasExited) { Stop-Process -Id $bridgeProcess.Id -Force }
}
