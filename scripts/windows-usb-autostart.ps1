#requires -version 5.1
$ErrorActionPreference = "Stop"

$PollSeconds = 2
$ProjectFolderName = "MassiveArchive"
$MarkerFileName = ".massivearchive-usb"
$script:RunningProcess = $null
$script:RunningProject = $null

function Find-MassiveArchive {
    Get-CimInstance Win32_LogicalDisk -Filter "DriveType = 2" |
        ForEach-Object {
            $root = $_.DeviceID + "\"
            $project = Join-Path $root $ProjectFolderName
            if ((Test-Path (Join-Path $project $MarkerFileName)) -and
                (Test-Path (Join-Path $project "package.json")) -and
                (Test-Path (Join-Path $project "server.js"))) {
                $project
            }
        }
}

function Start-MassiveArchive {
    param([string]$ProjectPath)

    $npmCommand = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
    if (-not $npmCommand) {
        Write-Host "[MassiveArchive] npm tidak ditemukan. Pastikan Node.js sudah terpasang."
        return
    }

    Write-Host "[MassiveArchive] Menjalankan npm start dari: $ProjectPath"
    $script:RunningProject = $ProjectPath
    $script:RunningProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/d", "/c", "npm start" -WorkingDirectory $ProjectPath -PassThru
}

while ($true) {
    try {
        $project = Find-MassiveArchive | Select-Object -First 1

        if ($script:RunningProcess -and $script:RunningProcess.HasExited) {
            $script:RunningProcess = $null
            $script:RunningProject = $null
        }

        if ($project -and -not $script:RunningProcess) {
            Start-MassiveArchive -ProjectPath $project
        }
    }
    catch {
        Write-Host "[MassiveArchive] $($_.Exception.Message)"
    }

    Start-Sleep -Seconds $PollSeconds
}
