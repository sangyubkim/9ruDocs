$node = $null
foreach ($p in @(
  "C:\Program Files\nodejs\node.exe",
  "$env:LOCALAPPDATA\Programs\node\node.exe",
  "$env:ProgramFiles\nodejs\node.exe"
)) {
  if (Test-Path $p) { $node = $p; break }
}
if (-not $node) {
  $cursorNode = "$env:LOCALAPPDATA\Programs\cursor\resources\app\resources\helpers\node.exe"
  if (Test-Path $cursorNode) { $node = $cursorNode }
}
if (-not $node) {
  Write-Error "Node.js를 찾을 수 없습니다. https://nodejs.org 에서 LTS를 설치하세요."
  exit 1
}
Set-Location $PSScriptRoot\..
& $node apps/api/server.mjs
