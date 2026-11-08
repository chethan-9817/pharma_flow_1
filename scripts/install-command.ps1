<#
  Makes the "pharmaflow" command available from any folder, in any new PowerShell or
  Command Prompt window, by adding this project folder to your USER Path.

    .\scripts\install-command.ps1            add the command (safe to run twice)
    .\scripts\install-command.ps1 -Remove    take it away again

  Only your user Path is changed (no administrator rights needed). Existing entries are kept as they are.
  Open a NEW terminal window afterwards; windows that were already open will not see the change.
  Keep this file ASCII-only.
#>
param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$folder = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

# Read the raw value so entries such as %USERPROFILE%\bin are not flattened.
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
$raw = [string]$key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
$parts = @($raw -split ';' | Where-Object { $_ -ne '' })
$present = $parts | Where-Object { $_.TrimEnd('\') -ieq $folder.TrimEnd('\') }

if ($Remove) {
  if (-not $present) { Write-Host 'The pharmaflow command was not installed. Nothing to remove.'; $key.Close(); exit 0 }
  $parts = @($parts | Where-Object { $_.TrimEnd('\') -ine $folder.TrimEnd('\') })
  $message = 'Removed. Open a new terminal window for the change to take effect.'
} else {
  if ($present) { Write-Host "Already installed: $folder is on your user Path."; $key.Close(); exit 0 }
  $parts = $parts + $folder
  $message = "Installed. Open a NEW PowerShell or Command Prompt window and type:  pharmaflow"
}

$key.SetValue('Path', ($parts -join ';'), [Microsoft.Win32.RegistryValueKind]::ExpandString)
$key.Close()

# Tell Windows the environment changed, so newly opened terminals pick it up without signing out.
Add-Type -Namespace PharmaFlow -Name Native -MemberDefinition @'
[DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
'@
$result = [UIntPtr]::Zero
[void][PharmaFlow.Native]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$result)

Write-Host $message -ForegroundColor Green
