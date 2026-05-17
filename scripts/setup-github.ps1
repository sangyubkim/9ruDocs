# 9ruDocs — Git 초기화 + GitHub 원격 저장소 생성
# 사용법 (PowerShell):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-github.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\setup-github.ps1 -RepoName "9ruDocs" -Private

param(
  [string]$RepoName = "9ruDocs",
  [switch]$Private = $true,
  [string]$Description = "9ruDocs blog MVP - Expo mobile + Node API"
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root
Write-Host "Project: $Root" -ForegroundColor Cyan

function Find-Git {
  $candidates = @(
    "git",
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files\Git\bin\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
  )
  foreach ($c in $candidates) {
    if ($c -eq "git") {
      $cmd = Get-Command git -ErrorAction SilentlyContinue
      if ($cmd) { return $cmd.Source }
    } elseif (Test-Path $c) { return $c }
  }
  return $null
}

function Find-Gh {
  $cmd = Get-Command gh -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  if (Test-Path "C:\Program Files\GitHub CLI\gh.exe") {
    return "C:\Program Files\GitHub CLI\gh.exe"
  }
  return $null
}

$git = Find-Git
if (-not $git) {
  Write-Host ""
  Write-Host "Git이 설치되어 있지 않습니다." -ForegroundColor Red
  Write-Host "1) https://git-scm.com/download/win 에서 Git for Windows 설치"
  Write-Host "2) 터미널을 새로 연 뒤 이 스크립트를 다시 실행"
  Write-Host ""
  Write-Host "또는 GitHub Desktop: https://desktop.github.com"
  exit 1
}

Write-Host "Git: $git" -ForegroundColor Green

if (-not (Test-Path ".git")) {
  & $git init
  & $git branch -M main
  Write-Host "git init 완료" -ForegroundColor Green
} else {
  Write-Host "이미 Git 저장소입니다." -ForegroundColor Yellow
}

& $git add -A
$status = & $git status --porcelain
if (-not $status) {
  Write-Host "커밋할 변경 사항이 없습니다." -ForegroundColor Yellow
} else {
  & $git commit -m @"
Initial commit: 9ruDocs blog MVP

- Expo mobile (capture, steps, AI edit, WordPress publish)
- Node API (health, blog generate, WordPress proxy)
- Windows start scripts
"@
  Write-Host "커밋 완료" -ForegroundColor Green
}

$gh = Find-Gh
if (-not $gh) {
  Write-Host ""
  Write-Host "GitHub CLI(gh)가 없습니다. 수동으로 원격 저장소를 연결하세요:" -ForegroundColor Yellow
  Write-Host "  1) https://github.com/new 에서 '$RepoName' 저장소 생성 (README 추가 안 함)"
  Write-Host "  2) 아래 명령 실행:"
  Write-Host "     git remote add origin https://github.com/YOUR_USER/$RepoName.git"
  Write-Host "     git push -u origin main"
  Write-Host ""
  Write-Host "gh 설치: https://cli.github.com"
  exit 0
}

$auth = & $gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "GitHub 로그인이 필요합니다. 실행:" -ForegroundColor Yellow
  Write-Host "  gh auth login"
  exit 1
}

$remote = & $git remote get-url origin 2>$null
if ($remote) {
  Write-Host "원격 origin 이미 있음: $remote" -ForegroundColor Yellow
  & $git push -u origin main
} else {
  $visibility = if ($Private) { "--private" } else { "--public" }
  & $gh repo create $RepoName $visibility --source=. --remote=origin --description=$Description --push
}

Write-Host ""
Write-Host "완료!" -ForegroundColor Green
& $gh repo view --web 2>$null
