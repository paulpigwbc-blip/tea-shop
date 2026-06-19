Add-Type -AssemblyName System.Drawing

$size = 81
$gray = [System.Drawing.Color]::FromArgb(153, 153, 153)
$green = [System.Drawing.Color]::FromArgb(123, 175, 138)
$outDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$s = [double]($size / 24.0)

function P([double]$x, [double]$y) {
  return New-Object System.Drawing.PointF(([float]($x * $s)), ([float]($y * $s)))
}

function Draw-Icon([string]$name, $color) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)
  $pen = New-Object System.Drawing.Pen($color, 3.0)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  switch ($name) {
    "home" {
      $pts1 = @( (P 3 10.5), (P 12 3), (P 21 10.5) )
      $g.DrawLines($pen, $pts1)
      $pts2 = @( (P 5 9.5), (P 5 20), (P 19 20), (P 19 9.5) )
      $g.DrawLines($pen, $pts2)
    }
    "category" {
      $path = New-Object System.Drawing.Drawing2D.GraphicsPath
      $xs = @(3.5, 13.5, 3.5, 13.5)
      $ys = @(3.5, 3.5, 13.5, 13.5)
      for ($i = 0; $i -lt 4; $i++) {
        $rect = New-Object System.Drawing.RectangleF(([float]($xs[$i] * $s)), ([float]($ys[$i] * $s)), ([float](7 * $s)), ([float](7 * $s)))
        $path.AddRectangle($rect)
      }
      $g.DrawPath($pen, $path)
    }
    "cart" {
      $g.DrawEllipse($pen, ([float](8 * $s)), ([float](19 * $s)), ([float](2 * $s)), ([float](2 * $s)))
      $g.DrawEllipse($pen, ([float](17 * $s)), ([float](19 * $s)), ([float](2 * $s)), ([float](2 * $s)))
      $pts = @( (P 2 3), (P 4.5 3), (P 7.3 15.5), (P 19.1 15.5), (P 20.9 7.5), (P 6 7.5) )
      $g.DrawLines($pen, $pts)
    }
    "contact" {
      $path = New-Object System.Drawing.Drawing2D.GraphicsPath
      $path.AddBezier((P 20.5 11.5), (P 20.5 15.6), (P 16.7 19), (P 12 19))
      $path.AddBezier((P 12 19), (P 10.7 19), (P 9.5 18.7), (P 8.4 18.2))
      $path.AddLine((P 8.4 18.2), (P 4 19.5))
      $path.AddLine((P 4 19.5), (P 5.2 16.3))
      $path.AddBezier((P 5.2 16.3), (P 4.3 15.2), (P 3.5 13.4), (P 3.5 11.5))
      $path.AddBezier((P 3.5 11.5), (P 3.5 7.4), (P 7.3 4), (P 12 4))
      $path.AddBezier((P 12 4), (P 16.7 4), (P 20.5 7.4), (P 20.5 11.5))
      $g.DrawPath($pen, $path)
    }
    "user" {
      $g.DrawEllipse($pen, ([float](8 * $s)), ([float](4 * $s)), ([float](8 * $s)), ([float](8 * $s)))
      $path = New-Object System.Drawing.Drawing2D.GraphicsPath
      $path.AddBezier((P 4 21), (P 4 16.6), (P 7.6 14), (P 12 14))
      $path.AddBezier((P 12 14), (P 16.4 14), (P 20 16.6), (P 20 21))
      $g.DrawPath($pen, $path)
    }
  }

  $g.Dispose()
  return $bmp
}

$icons = @("home", "category", "cart", "contact", "user")

foreach ($icon in $icons) {
  $bmp = Draw-Icon $icon $gray
  $file = Join-Path $outDir "tab-$icon.png"
  $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $fsize = (Get-Item $file).Length
  Write-Host "Saved: tab-$icon.png ($fsize bytes)"
}

foreach ($icon in $icons) {
  $bmp = Draw-Icon $icon $green
  $file = Join-Path $outDir "tab-$icon-active.png"
  $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $fsize = (Get-Item $file).Length
  Write-Host "Saved: tab-$icon-active.png ($fsize bytes)"
}

Write-Host "Done! All 10 PNG icons generated."
