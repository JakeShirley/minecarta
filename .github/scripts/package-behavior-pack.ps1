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
$sharedConstantsPath = Join-Path $repoRoot "packages/shared/src/constants/index.ts"
$outputDir = Join-Path $repoRoot $OutputPath
$manifestPath = Join-Path $behaviorPackPath "manifest.json"

Write-Host "Packaging behavior pack..."
Write-Host "  Source: $behaviorPackPath"
Write-Host "  Output: $outputDir"

# Update manifest version if provided
if ($Version -and $Version -ne "") {
    Write-Host "  Version: $Version"
    
    # Validate semantic version format (e.g., "1.2.3" or "1.2.3-beta")
    $versionParts = $Version -split '\.'
    if ($versionParts.Length -ge 3) {
        # Remove any prerelease suffix for the version string
        $cleanVersion = $Version -replace '-.*$', ''
        
        # Read and update manifest.json
        $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
        $manifest.header.version = $cleanVersion
        $manifest.modules[0].version = $cleanVersion
        
        # Write back with proper formatting
        $manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding UTF8
        Write-Host "  Updated manifest.json version to `"$cleanVersion`""

        # Update PROTOCOL_VERSION in shared constants
        if (Test-Path $sharedConstantsPath) {
            $constantsContent = Get-Content $sharedConstantsPath -Raw
            $updatedContent = $constantsContent -replace "export const PROTOCOL_VERSION = '[^']+';", "export const PROTOCOL_VERSION = '$cleanVersion';"
            Set-Content $sharedConstantsPath -Value $updatedContent -Encoding UTF8 -NoNewline
            Write-Host "  Updated PROTOCOL_VERSION to `"$cleanVersion`""
            
            # Rebuild all packages so changes propagate
            # This is necessary because the initial build happened before version was known
            Write-Host "  Rebuilding packages with updated version..."
            Push-Location $repoRoot
            try {
                pnpm build
                Write-Host "  All packages rebuilt successfully"
            }
            finally {
                Pop-Location
            }
        }
        else {
            Write-Warning "Shared constants file not found: $sharedConstantsPath"
        }
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
