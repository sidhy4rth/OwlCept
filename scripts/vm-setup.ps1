# One-time setup for the OwlCept Windows dev VM. Run in an ADMIN PowerShell:
#   powershell -ExecutionPolicy Bypass -File Z:\scripts\vm-setup.ps1
# It enables SSH (key-only, for the Mac that hosts this VM), and installs the
# .NET 8 SDK, Git and Node.js so the agent can be built and tested here.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$MacKey = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPPg3as452fZFNyhb7QgPjv5Y9zFyh7WbrvK4LZONXQa owlcept-vm-dev'

function Step($n, $text) { Write-Host "`n[$n/5] $text" -ForegroundColor Cyan }

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'Please run this from an ADMIN PowerShell (right-click Start > Terminal (Admin)).' -ForegroundColor Red
  exit 1
}

Step 1 'OpenSSH server'
$cap = Get-WindowsCapability -Online -Name 'OpenSSH.Server*' | Select-Object -First 1
if ($cap.State -ne 'Installed') { Add-WindowsCapability -Online -Name $cap.Name | Out-Null }
Set-Service sshd -StartupType Automatic
Start-Service sshd
if (-not (Get-NetFirewallRule -Name 'OwlCept-SSH' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -Name 'OwlCept-SSH' -DisplayName 'OpenSSH (OwlCept dev VM)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 -Profile Any | Out-Null
}
New-ItemProperty -Path 'HKLM:\SOFTWARE\OpenSSH' -Name DefaultShell -Value "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -PropertyType String -Force | Out-Null

Step 2 'Allow only the Mac key (no passwords)'
$keys = "$env:ProgramData\ssh\administrators_authorized_keys"
Set-Content -Path $keys -Value $MacKey -Encoding ascii
icacls $keys /inheritance:r /grant 'Administrators:F' /grant 'SYSTEM:F' | Out-Null
$cfg = "$env:ProgramData\ssh\sshd_config"
(Get-Content $cfg) -replace '^#?PasswordAuthentication .*', 'PasswordAuthentication no' | Set-Content $cfg -Encoding ascii
Restart-Service sshd

Step 3 '.NET 8 SDK'
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
  $installer = Join-Path $env:TEMP 'dotnet-install.ps1'
  Invoke-WebRequest -Uri 'https://dot.net/v1/dotnet-install.ps1' -OutFile $installer
  & $installer -Channel 8.0 -InstallDir "$env:ProgramFiles\dotnet"
  [Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'Machine') + ";$env:ProgramFiles\dotnet", 'Machine')
}

Step 4 'Git and Node.js'
if (Get-Command winget -ErrorAction SilentlyContinue) {
  winget install --id Git.Git -e --silent --accept-source-agreements --accept-package-agreements
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
} else {
  Write-Host 'winget not available yet; skipping Git and Node (not needed to build the agent).' -ForegroundColor Yellow
}

Step 5 'Address for the Mac'
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' } | Select-Object -First 1).IPAddress
Write-Host "`nDone. Tell Claude:  Windows ready, IP $ip, user $env:USERNAME" -ForegroundColor Green
