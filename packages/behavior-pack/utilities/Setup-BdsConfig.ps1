<#
.SYNOPSIS
    Sets up MineCarta configuration files for Bedrock Dedicated Server.

.DESCRIPTION
    This script creates the variables.json and secrets.json configuration files
    for the MineCarta Sync behavior pack in the BDS config directory.
    
    The script determines the BDS root by navigating up from its location
    (inside the behavior pack) to find the parent of behavior_packs or
    development_behavior_packs.

.PARAMETER ServerUrl
    The URL of the MineCarta map server. Required.

.PARAMETER AuthToken
    The authentication token for server communication. Required.

.PARAMETER PlayerUpdateInterval
    Interval in ticks between player position updates. Default: 20 (1 second)

.PARAMETER TimeSyncInterval
    Interval in ticks between world time syncs. Default: 1200 (1 minute)

.PARAMETER LogLevel
    Log level for the behavior pack. Valid values: debug, info, warning, error, none.
    Default: warning

.PARAMETER SendPlayerStats
    Whether to send player stats with position updates. Default: true

.PARAMETER Force
    Overwrite existing configuration files without prompting.

.EXAMPLE
    .\Setup-BdsConfig.ps1 -ServerUrl "http://myserver:3000" -AuthToken "my-secret-token"
    Creates config files with the specified server URL and auth token.

.EXAMPLE
    .\Setup-BdsConfig.ps1 -ServerUrl "http://myserver:3000" -AuthToken "my-secret-token" -Force
    Overwrites existing config files without prompting.

.EXAMPLE
    .\Setup-BdsConfig.ps1 -ServerUrl "http://myserver:3000" -AuthToken "my-secret-token" -LogLevel "debug"
    Creates config files with debug logging enabled.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, HelpMessage = "URL of the MineCarta map server")]
    [string]$ServerUrl,
    
    [Parameter(Mandatory = $true, HelpMessage = "Authentication token for server communication")]
    [string]$AuthToken,
    
    [int]$PlayerUpdateInterval = 20,
    [int]$TimeSyncInterval = 1200,
    [ValidateSet("debug", "info", "warning", "error", "none")]
    [string]$LogLevel = "warning",
    [bool]$SendPlayerStats = $true,
    [switch]$Force
)

# Determine pack root directory (parent of utilities folder)
$ScriptDir = $PSScriptRoot
$PackRoot = $ScriptDir

# Read manifest.json to get module UUID and dependencies
$ManifestPath = Join-Path $PackRoot "manifest.json"
if (-not (Test-Path $ManifestPath)) {
    Write-Error "Could not find manifest.json at $ManifestPath"
    exit 1
}

$Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json

# Get module UUID from manifest (first script module)
$ScriptModule = $Manifest.modules | Where-Object { $_.type -eq "script" } | Select-Object -First 1
if (-not $ScriptModule) {
    Write-Error "Could not find script module in manifest.json"
    exit 1
}
$ModuleUUID = $ScriptModule.uuid

# Get allowed modules from manifest dependencies
$AllowedModules = @($Manifest.dependencies | ForEach-Object { $_.module_name })
Write-Host "Found $($AllowedModules.Count) module dependencies in manifest.json" -ForegroundColor Cyan

# Determine BDS root by navigating up from script location
$ScriptDir = $PSScriptRoot
$BdsRoot = $null

# Walk up the directory tree to find BDS root
$CurrentDir = $ScriptDir
for ($i = 0; $i -lt 10; $i++) {
    $ParentDir = Split-Path -Parent $CurrentDir
    if (-not $ParentDir) {
        break
    }
    
    $ParentName = Split-Path -Leaf $ParentDir
    if ($ParentName -eq "behavior_packs" -or $ParentName -eq "development_behavior_packs") {
        $BdsRoot = Split-Path -Parent $ParentDir
        break
    }
    
    $CurrentDir = $ParentDir
}

if (-not $BdsRoot) {
    Write-Error "Could not determine BDS root directory. This script should be run from within a behavior pack installed in BDS."
    Write-Error "Expected to find 'behavior_packs' or 'development_behavior_packs' in parent path."
    exit 1
}

Write-Host "BDS root detected: $BdsRoot" -ForegroundColor Cyan

# Create config directory for this pack
$ConfigDir = Join-Path $BdsRoot "config" $ModuleUUID

if (-not (Test-Path $ConfigDir)) {
    Write-Host "Creating config directory: $ConfigDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
}

# Create default config directory for permissions
$DefaultConfigDir = Join-Path $BdsRoot "config" "default"

if (-not (Test-Path $DefaultConfigDir)) {
    Write-Host "Creating default config directory: $DefaultConfigDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $DefaultConfigDir -Force | Out-Null
}

# Define configuration files
$VariablesPath = Join-Path $ConfigDir "variables.json"
$SecretsPath = Join-Path $ConfigDir "secrets.json"
$PermissionsPath = Join-Path $ConfigDir "permissions.json"

# Variables configuration (non-sensitive settings)
$Variables = @{
    serverUrl = $ServerUrl
    playerUpdateInterval = $PlayerUpdateInterval
    timeSyncInterval = $TimeSyncInterval
    logLevel = $LogLevel
    sendPlayerStats = $SendPlayerStats
}

# Secrets configuration (sensitive settings)
$Secrets = @{
    authToken = $AuthToken
}

# Permissions configuration (allowed modules read from manifest.json dependencies)
$Permissions = @{
    allowed_modules = $AllowedModules
}

# Helper function to write config file
function Write-ConfigFile {
    param(
        [string]$Path,
        [hashtable]$Content,
        [string]$Description
    )
    
    $Exists = Test-Path $Path
    
    if ($Exists -and -not $Force) {
        $Response = Read-Host "$Description file already exists at $Path. Overwrite? (y/N)"
        if ($Response -ne "y" -and $Response -ne "Y") {
            Write-Host "Skipping $Description file." -ForegroundColor Yellow
            return
        }
    }
    
    $Json = $Content | ConvertTo-Json -Depth 10
    Set-Content -Path $Path -Value $Json -Encoding UTF8
    
    if ($Exists) {
        Write-Host "Updated $Description file: $Path" -ForegroundColor Green
    } else {
        Write-Host "Created $Description file: $Path" -ForegroundColor Green
    }
}

# Write configuration files
Write-ConfigFile -Path $VariablesPath -Content $Variables -Description "Variables"
Write-ConfigFile -Path $SecretsPath -Content $Secrets -Description "Secrets"
Write-ConfigFile -Path $PermissionsPath -Content $Permissions -Description "Permissions"

Write-Host ""
Write-Host "Configuration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Configuration values:" -ForegroundColor Cyan
Write-Host "  Server URL:             $ServerUrl"
Write-Host "  Player Update Interval: $PlayerUpdateInterval ticks"
Write-Host "  Time Sync Interval:     $TimeSyncInterval ticks"
Write-Host "  Log Level:              $LogLevel"
Write-Host "  Send Player Stats:      $SendPlayerStats"
Write-Host ""
Write-Host "Files created:" -ForegroundColor Cyan
Write-Host "  Variables:    $VariablesPath"
Write-Host "  Secrets:      $SecretsPath"
Write-Host "  Permissions:  $PermissionsPath"
Write-Host ""
Write-Host "Remember to restart BDS for changes to take effect." -ForegroundColor Yellow
