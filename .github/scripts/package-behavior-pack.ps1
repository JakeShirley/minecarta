# Package the Minecraft behavior pack into a .mcpack file
# .mcpack is the standard Minecraft add-on format (essentially a zip file)

param(
    [string]$OutputPath = "dist",
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent (Split-Path -Parent $scriptRoot)
$behaviorPackPath = Join-Path $repoRoot "packages/behavior-pack"
$outputDir = Join-Path $repoRoot $OutputPath
$manifestPath = Join-Path $behaviorPackPath "manifest.json"

Write-Host "Packaging behavior pack..."
Write-Host "  Source: $behaviorPackPath"
Write-Host "  Output: $outputDir"

# Update manifest version if provided
if ($Version -and $Version -ne "") {
    Write-Host "  Version: $Version"
    
    # Parse semantic version (e.g., "1.2.3" -> [1, 2, 3])
    $versionParts = $Version -split '\.'
    if ($versionParts.Length -ge 3) {
        $major = [int]$versionParts[0]
        $minor = [int]$versionParts[1]
        $patch = [int]$versionParts[2] -replace '-.*$', '' # Remove any prerelease suffix
        
        # Read and update manifest.json
        $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
        $manifest.header.version = @($major, $minor, $patch)
        $manifest.modules[0].version = @($major, $minor, $patch)
        
        # Write back with proper formatting
        $manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding UTF8
        Write-Host "  Updated manifest.json version to [$major, $minor, $patch]"
    }
    else {
        Write-Warning "Invalid version format: $Version (expected x.y.z)"
    }
}

# Create output directory if it doesn't exist
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Define the files to include in the pack
$filesToInclude = @(
    "manifest.json",
    "scripts/index.js"
)

# Verify all required files exist
foreach ($file in $filesToInclude) {
    $filePath = Join-Path $behaviorPackPath $file
    if (-not (Test-Path $filePath)) {
        Write-Error "Required file not found: $filePath"
        exit 1
    }
}

# Create a temporary directory for staging (cross-platform: use TEMP on Windows, TMPDIR or /tmp on Linux/macOS)
$tempDir = if ($env:TEMP) { $env:TEMP } elseif ($env:TMPDIR) { $env:TMPDIR } else { "/tmp" }
$stagingDir = Join-Path $tempDir "minecarta-behavior-pack-$(Get-Random)"
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

try {
    # Copy files to staging directory
    foreach ($file in $filesToInclude) {
        $sourcePath = Join-Path $behaviorPackPath $file
        $destPath = Join-Path $stagingDir $file
        $destDir = Split-Path -Parent $destPath
        
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        
        Copy-Item -Path $sourcePath -Destination $destPath
        Write-Host "  Added: $file"
    }

    # Create the .mcpack file (zip archive)
    $packFileName = "MineCarta-BehaviorPack.mcpack"
    $packPath = Join-Path $outputDir $packFileName
    
    # Remove existing pack if it exists
    if (Test-Path $packPath) {
        Remove-Item $packPath -Force
    }

    # Create zip archive
    Compress-Archive -Path "$stagingDir/*" -DestinationPath $packPath -Force
    
    Write-Host ""
    Write-Host "Successfully created: $packPath"
    Write-Host "Pack contents:"
    Get-ChildItem -Path $stagingDir -Recurse | ForEach-Object {
        $relativePath = $_.FullName.Substring($stagingDir.Length + 1)
        Write-Host "  - $relativePath"
    }
}
finally {
    # Clean up staging directory
    if (Test-Path $stagingDir) {
        Remove-Item -Path $stagingDir -Recurse -Force
    }
}
