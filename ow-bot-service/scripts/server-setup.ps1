# GigaGPU Server Initial Setup Script
# Run as Administrator after first RDP login and SSH is enabled.
#
# Prerequisites (user does manually):
#   1. First RDP login to confirm server works
#   2. Enable OpenSSH Server:
#      Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
#      Start-Service sshd
#      Set-Service -Name sshd -StartupType Automatic
#   3. Set up SSH key auth, share server IP
#
# After this script: user logs into Battle.net and installs OW.

$ErrorActionPreference = "Stop"

Write-Host "=== GigaGPU Server Setup ===" -ForegroundColor Cyan

# ── Chocolatey ──
Write-Host "`n[1/7] Installing Chocolatey..." -ForegroundColor Yellow
if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    refreshenv
} else {
    Write-Host "  Chocolatey already installed" -ForegroundColor Green
}

# ── Python ──
Write-Host "`n[2/7] Installing Python 3.12..." -ForegroundColor Yellow
choco install python312 -y --no-progress
refreshenv

# ── NVIDIA Drivers ──
Write-Host "`n[3/7] Installing NVIDIA drivers..." -ForegroundColor Yellow
# Check if already installed
$nvidiaInstalled = Get-WmiObject Win32_VideoController | Where-Object { $_.Name -match "NVIDIA" }
if ($nvidiaInstalled) {
    Write-Host "  NVIDIA drivers already detected: $($nvidiaInstalled.Name)" -ForegroundColor Green
} else {
    Write-Host "  Installing via Chocolatey (game-ready drivers)..."
    choco install nvidia-display-driver -y --no-progress
}

# ── Tailscale ──
Write-Host "`n[4/7] Installing Tailscale..." -ForegroundColor Yellow
choco install tailscale -y --no-progress
Write-Host "  Run 'tailscale up' after install to authenticate" -ForegroundColor Gray

# ── NSSM (for Windows Service management) ──
Write-Host "`n[5/7] Installing NSSM..." -ForegroundColor Yellow
choco install nssm -y --no-progress

# ── Git ──
Write-Host "`n[6/7] Installing Git..." -ForegroundColor Yellow
choco install git -y --no-progress
refreshenv

# ── Bot Service Setup ──
Write-Host "`n[7/7] Setting up OW Bot Service..." -ForegroundColor Yellow
$botDir = "C:\ow-bot-service"
$logsDir = "$botDir\logs"

if (!(Test-Path $botDir)) {
    Write-Host "  Creating $botDir..."
    New-Item -ItemType Directory -Path $botDir -Force | Out-Null
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

# Create virtual environment
Write-Host "  Creating Python virtual environment..."
python -m venv "$botDir\.venv"
& "$botDir\.venv\Scripts\pip.exe" install --upgrade pip

# If the repo is cloned, install dependencies
if (Test-Path "$botDir\requirements.txt") {
    Write-Host "  Installing Python dependencies..."
    & "$botDir\.venv\Scripts\pip.exe" install -r "$botDir\requirements.txt"
}

# Create Workshop log directory if it doesn't exist
$workshopDir = "$env:USERPROFILE\Documents\Overwatch\Workshop"
if (!(Test-Path $workshopDir)) {
    New-Item -ItemType Directory -Path $workshopDir -Force | Out-Null
    Write-Host "  Created Workshop log directory: $workshopDir"
}

# ── Windows Settings ──
Write-Host "`nConfiguring Windows settings..." -ForegroundColor Yellow

# Disable Windows Update auto-restart
Write-Host "  Disabling auto-restart for Windows Update..."
$auPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU"
if (!(Test-Path $auPath)) { New-Item -Path $auPath -Force | Out-Null }
Set-ItemProperty -Path $auPath -Name "NoAutoRebootWithLoggedOnUsers" -Value 1 -Type DWord

# Disable sleep/hibernation
Write-Host "  Disabling sleep and hibernation..."
powercfg -change -standby-timeout-ac 0
powercfg -change -hibernate-timeout-ac 0
powercfg /hibernate off

# High performance power plan
Write-Host "  Setting high performance power plan..."
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c

Write-Host "`n=== Setup Complete ===" -ForegroundColor Green
Write-Host @"

Next steps:
  1. Run 'tailscale up' to connect to Tailnet
  2. Clone the bot service repo to C:\ow-bot-service
  3. Copy .env.example to .env and fill in values
  4. Run scripts\install-service.ps1 to install as Windows Service
  5. RDP in and log into Battle.net, install OW, enable 'Keep me logged in'
  6. Capture screen templates for UI automation

"@ -ForegroundColor Gray
