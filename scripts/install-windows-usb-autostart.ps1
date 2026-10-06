#requires -version 5.1
$ErrorActionPreference = "Stop"

$installDir = Join-Path $env:LOCALAPPDATA "MassiveArchive"
$watcherSource = Join-Path $PSScriptRoot "windows-usb-autostart.ps1"
$watcherTarget = Join-Path $installDir "windows-usb-autostart.ps1"
$taskName = "MassiveArchive USB Auto Start"

if (-not (Test-Path $watcherSource)) {
    throw "File windows-usb-autostart.ps1 tidak ditemukan."
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "Node.js/npm belum ditemukan. Pasang Node.js terlebih dahulu."
}

New-Item -ItemType Directory -Path $installDir -Force | Out-Null
Copy-Item $watcherSource $watcherTarget -Force

$ps = (Get-Command powershell.exe).Source
$action = New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$watcherTarget`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Description "Mencari flashdisk MassiveArchive dan menjalankan npm start secara otomatis." -Force | Out-Null

Start-Process powershell.exe -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-File","`"$watcherTarget`""

Write-Host ""
Write-Host "Selesai."
Write-Host "Setelah ini, pasang flashdisk yang berisi folder MassiveArchive."
Write-Host "Watcher akan mencari drive USB dan menjalankan npm start otomatis."
