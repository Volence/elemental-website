# Install OW Bot Service as a Windows Service via NSSM
# Run as Administrator after server-setup.ps1 and filling in .env

$ErrorActionPreference = "Stop"

$ServiceName = "OWBotService"
$BotDir = "C:\ow-bot-service"
$PythonExe = "$BotDir\.venv\Scripts\python.exe"
$MainScript = "$BotDir\main.py"
$LogsDir = "$BotDir\logs"

Write-Host "=== Installing $ServiceName ===" -ForegroundColor Cyan

# Verify prerequisites
if (!(Test-Path $PythonExe)) {
    Write-Error "Python venv not found at $PythonExe. Run server-setup.ps1 first."
    exit 1
}
if (!(Test-Path $MainScript)) {
    Write-Error "main.py not found at $MainScript. Clone the repo to $BotDir first."
    exit 1
}
if (!(Test-Path "$BotDir\.env")) {
    Write-Error ".env not found. Copy .env.example to .env and fill in values."
    exit 1
}

# Ensure logs directory
New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null

# Remove existing service if present
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing $ServiceName service..."
    nssm stop $ServiceName 2>$null
    nssm remove $ServiceName confirm
}

# Install
Write-Host "Installing service..."
nssm install $ServiceName $PythonExe $MainScript
nssm set $ServiceName AppDirectory $BotDir
nssm set $ServiceName AppStdout "$LogsDir\stdout.log"
nssm set $ServiceName AppStderr "$LogsDir\stderr.log"
nssm set $ServiceName AppRotateFiles 1
nssm set $ServiceName AppRotateSeconds 86400
nssm set $ServiceName AppRotateBytes 10485760
nssm set $ServiceName AppEnvironmentExtra "PYTHONUNBUFFERED=1"

# Set to auto-start and start now
nssm set $ServiceName Start SERVICE_AUTO_START
nssm set $ServiceName AppRestartDelay 5000

Write-Host "Starting service..."
nssm start $ServiceName

$status = (Get-Service -Name $ServiceName).Status
Write-Host "`n$ServiceName is $status" -ForegroundColor $(if ($status -eq "Running") { "Green" } else { "Red" })

Write-Host @"

Service installed at: $BotDir
Logs at: $LogsDir\stdout.log, $LogsDir\stderr.log
Log rotation: daily or 10MB, whichever comes first

Useful commands:
  nssm status $ServiceName
  nssm restart $ServiceName
  nssm stop $ServiceName
  nssm edit $ServiceName        # GUI config editor

"@ -ForegroundColor Gray
