# AION 루트 CA(MyRootCA.pem)를 이 PC의 "신뢰할 수 있는 루트 인증 기관"에 등록합니다.
# Chrome, Edge, 시스템 앱은 경고 없이 https://aion.com 등을 신뢰합니다.
# Firefox는 자체 인증서 저장소를 쓰므로, 별도로 인증서 가져오기 필요할 수 있습니다.
#
# 사용법: PowerShell을 "관리자 권한으로 실행"한 뒤:
#   .\install-aion-root-ca.ps1
#   또는
#   .\install-aion-root-ca.ps1 -PemPath "C:\path\to\MyRootCA.pem"
#
# GPO로 배포: 컴퓨터 구성 → 정책 → Windows 설정 → 보안 설정 → 공개 키 정책
#   → 신뢰할 수 있는 루트 인증 기관 → 우클릭 → 가져오기 → MyRootCA.pem 선택

param(
    [string]$PemPath = $null
)

$ErrorActionPreference = "Stop"

if (-not $PemPath) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $PemPath = Join-Path (Split-Path -Parent $scriptDir) "MyRootCA.pem"
}

if (-not (Test-Path $PemPath)) {
    Write-Host "오류: MyRootCA.pem을 찾을 수 없습니다. 다음 위치를 확인하세요: $PemPath" -ForegroundColor Red
    Write-Host "또는 -PemPath 로 경로를 지정하세요. 예: .\install-aion-root-ca.ps1 -PemPath 'C:\certs\MyRootCA.pem'" -ForegroundColor Yellow
    exit 1
}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "관리자 권한이 필요합니다. PowerShell을 '관리자 권한으로 실행'한 뒤 다시 시도하세요." -ForegroundColor Red
    exit 1
}

try {
    certutil.exe -addstore -f "Root" $PemPath
    Write-Host "등록 완료: AION 루트 CA가 이 컴퓨터의 신뢰할 수 있는 루트 인증 기관에 추가되었습니다." -ForegroundColor Green
    Write-Host "Chrome/Edge는 브라우저를 다시 연 뒤 https://aion.com 에 접속하면 경고 없이 열립니다." -ForegroundColor Cyan
} catch {
    Write-Host "등록 실패: $_" -ForegroundColor Red
    exit 1
}
