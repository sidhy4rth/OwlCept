<#
.SYNOPSIS
  Sets OwlCept's extension policy for Google Chrome and Microsoft Edge on this PC.

.DESCRIPTION
  Writes the values the extension reads from chrome.storage.managed. Any value set
  here overrides the user's choice and shows as locked in the extension. Run as
  administrator: as a Group Policy startup script, an Intune platform script, or by hand.

  It does not install the extension. To force-install it, see docs/DEPLOY.md.

.EXAMPLE
  .\Set-OwlCeptPolicy.ps1 -Mode smart -TrustedSites docs.college.edu.in,github.com -HelpDeskWhatsApp 919800000000 -AllowCopyAnyway $false

.EXAMPLE
  .\Set-OwlCeptPolicy.ps1 -Remove
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [ValidateSet('audit', 'smart', 'strict')] [string] $Mode,
  [ValidateSet('auto', 'en', 'hi', 'kn')] [string] $Language,
  [string[]] $TrustedSites,
  [ValidatePattern('^\+?\d{6,20}$')] [string] $HelpDeskWhatsApp,
  [Nullable[bool]] $AllowCopyAnyway,
  [Nullable[bool]] $ReportLures,
  [string] $DeviceLabel,
  [ValidateSet('Chrome', 'Edge')] [string[]] $Browsers = @('Chrome', 'Edge'),
  [string] $ExtensionId = 'jjkhmdbenclipofjaeeblabpmjdcibpi',
  [switch] $Remove
)

$ErrorActionPreference = 'Stop'
$roots = @{
  Chrome = 'HKLM:\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions'
  Edge   = 'HKLM:\SOFTWARE\Policies\Microsoft\Edge\3rdparty\extensions'
}

foreach ($browser in $Browsers) {
  $key = Join-Path $roots[$browser] "$ExtensionId\policy"

  if ($Remove) {
    if ((Test-Path $key) -and $PSCmdlet.ShouldProcess($key, 'Remove OwlCept policy')) { Remove-Item $key -Recurse -Force }
    Write-Output "${browser}: OwlCept policy removed"
    continue
  }

  if ($PSCmdlet.ShouldProcess($key, 'Write OwlCept policy')) {
    New-Item -Path $key -Force | Out-Null
    if ($Mode)             { Set-ItemProperty -Path $key -Name mode -Value $Mode -Type String }
    if ($Language)         { Set-ItemProperty -Path $key -Name lang -Value $Language -Type String }
    if ($HelpDeskWhatsApp) { Set-ItemProperty -Path $key -Name contact -Value ($HelpDeskWhatsApp -replace '\D', '') -Type String }
    if ($DeviceLabel)      { Set-ItemProperty -Path $key -Name deviceLabel -Value $DeviceLabel -Type String }
    if ($null -ne $AllowCopyAnyway) { Set-ItemProperty -Path $key -Name allowCopyAnyway -Value ([int]$AllowCopyAnyway) -Type DWord }
    if ($null -ne $ReportLures)     { Set-ItemProperty -Path $key -Name reportLures -Value ([int]$ReportLures) -Type DWord }
    if ($PSBoundParameters.ContainsKey('TrustedSites')) {
      # Browsers read a list policy as a subkey with values named 1, 2, 3, ...
      $list = Join-Path $key 'trustedSites'
      if (Test-Path $list) { Remove-Item $list -Recurse -Force }
      New-Item -Path $list -Force | Out-Null
      $i = 1
      foreach ($site in $TrustedSites | Where-Object { $_ -match '^[A-Za-z0-9.-]+$' }) {
        Set-ItemProperty -Path $list -Name "$i" -Value $site.ToLowerInvariant() -Type String
        $i++
      }
    }
    Write-Output "${browser}: OwlCept policy written to $key"
  }
}
Write-Output 'Restart the browser, or open chrome://policy (edge://policy) and click "Reload policies".'
