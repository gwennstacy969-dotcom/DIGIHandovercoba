
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile((Resolve-Path "frontend\assets\user_target_logo.png").Path)

Write-Host "Width: $($img.Width), Height: $($img.Height)"

# Find non-white pixels
$minX = 9999; $maxX = 0; $minY = 9999; $maxY = 0

for ($x = 0; $x -lt $img.Width; $x++) {
    for ($y = 0; $y -lt $img.Height; $y++) {
        $c = $img.GetPixel($x, $y)
        # Not white / light background
        if ($c.R -lt 240 -or $c.G -lt 240 -or $c.B -lt 240) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

Write-Host "Logo bbox in crop: x=$minX..$maxX, y=$minY..$maxY"

# Let's crop just the logo cleanly with transparent or white background
$w = $maxX - $minX + 1
$h = $maxY - $minY + 1
$rect = New-Object System.Drawing.Rectangle($minX, $minY, $w, $h)
$logoCrop = $img.Clone($rect, $img.PixelFormat)
$out = (Resolve-Path "frontend\assets").Path + "\exact_digihandover_logo.png"
$logoCrop.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved exact_digihandover_logo.png ($w x $h)"

$logoCrop.Dispose()
$img.Dispose()
