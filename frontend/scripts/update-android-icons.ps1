# Update Android launcher icons from resources/android/icon.png
# Usage: Run this script from any location. It will write into frontend/android/app/src/main/res/mipmap-*

$src = "D:\homework\softwork\StoryCraft\frontend\resources\android\icon.png"
$resRoot = "D:\homework\softwork\StoryCraft\frontend\android\app\src\main\res"
$magick = "magick"  # assumes ImageMagick is in PATH; otherwise set full path to magick.exe

$densityMap = @{
    mdpi = 48
    hdpi = 72
    xhdpi = 96
    xxhdpi = 144
    xxxhdpi = 192
}

if (-not (Test-Path $src)) {
    Write-Error "Source icon not found: $src"
    exit 1
}

foreach ($dpi in $densityMap.Keys) {
    $size = $densityMap[$dpi]
    $mipmapDir = Join-Path $resRoot ("mipmap-" + $dpi)
    if (-not (Test-Path $mipmapDir)) {
        Write-Host "Skipping missing directory: $mipmapDir"
        continue
    }

    $outLegacy = Join-Path $mipmapDir "ic_launcher.png"
    $outForeground = Join-Path $mipmapDir "ic_launcher_foreground.png"
    $outRound = Join-Path $mipmapDir "ic_launcher_round.png"

    # Prefer to resize if ImageMagick available
    $magickAvailable = $false
    try {
        $null = & $magick -version 2>$null
        $magickAvailable = $true
    } catch {
        $magickAvailable = $false
    }

    if ($magickAvailable) {
        & $magick $src -background none -resize ${size}x${size} $outLegacy
        & $magick $src -background none -resize ${size}x${size} $outForeground
        & $magick $src -background none -resize ${size}x${size} $outRound
        Write-Host "Wrote resized icons to $mipmapDir (size ${size}x${size})"
    } else {
        Copy-Item $src $outLegacy -Force
        Copy-Item $src $outForeground -Force
        Copy-Item $src $outRound -Force
        Write-Host "Copied source icon to $mipmapDir (magick not available)"
    }
}

Write-Host "Done. You can now run 'npx cap copy android' and rebuild the Android project."