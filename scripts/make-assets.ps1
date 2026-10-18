param(
  [string]$Source = (Join-Path $PSScriptRoot '..\brand\logo-source.jpg'),
  [string]$OutDir = (Join-Path $PSScriptRoot '..\app\public')
)

Add-Type -AssemblyName System.Drawing

$Source = (Resolve-Path $Source).Path
$src = [System.Drawing.Image]::FromFile($Source)

$markSide = 440
$markCx = 626
$markCy = 362
$mx = [int]($markCx - $markSide / 2)
$my = [int]($markCy - $markSide / 2)

$cropRect = New-Object System.Drawing.Rectangle($mx, $my, $markSide, $markSide)
$mark = New-Object System.Drawing.Bitmap($markSide, $markSide)
$g = [System.Drawing.Graphics]::FromImage($mark)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $markSide, $markSide)), $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

function Save-Square {
  param([System.Drawing.Bitmap]$Bmp, [int]$Size, [string]$Path)
  $out = New-Object System.Drawing.Bitmap($Size, $Size)
  $g2 = [System.Drawing.Graphics]::FromImage($out)
  $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g2.DrawImage($Bmp, 0, 0, $Size, $Size)
  $g2.Dispose()
  $out.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $out.Dispose()
}

Save-Square -Bmp $mark -Size 256 -Path (Join-Path $OutDir 'logo-mark.png')
Save-Square -Bmp $mark -Size 128 -Path (Join-Path $OutDir 'favicon.png')
Save-Square -Bmp $mark -Size 180 -Path (Join-Path $OutDir 'apple-touch-icon.png')

$fw = 1000
$fh = [int]($src.Height * ($fw / $src.Width))
$full = New-Object System.Drawing.Bitmap($fw, $fh)
$g3 = [System.Drawing.Graphics]::FromImage($full)
$g3.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g3.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g3.DrawImage($src, 0, 0, $fw, $fh)
$g3.Dispose()
$jpgCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]88)
$full.Save((Join-Path $OutDir 'logo-full.jpg'), $jpgCodec, $encParams)
$full.Dispose()

$mark.Dispose()
$src.Dispose()

Get-ChildItem $OutDir -Filter '*.*' | Where-Object { $_.Name -in @('logo-mark.png', 'favicon.png', 'apple-touch-icon.png', 'logo-full.jpg') } | ForEach-Object {
  "{0}  {1:N1} KB" -f $_.Name, ($_.Length / 1KB)
}
