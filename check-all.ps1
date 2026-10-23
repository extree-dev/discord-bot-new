<#
.SYNOPSIS
  Прогоняет все проверки (mvn compile/test-compile/test, npm typecheck/build/lint,
  npm format:check) и сохраняет полный вывод в check-all-report.txt.

.EXAMPLE
  .\check-all.ps1

.EXAMPLE
  .\check-all.ps1 -Out my-report.txt

.NOTES
  Не меняет исходники. Только читает и запускает команды.
  Соответствует CI-пайплайну: если тут зелёное — и в CI должно быть зелёное.
#>

param(
    [string]$Out = "check-all-report.txt"
)

$ErrorActionPreference = "Continue"

$root   = (Get-Location).Path
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
$head   = (& git rev-parse --short HEAD 2>$null)
$when   = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"

if (Test-Path $Out) { Remove-Item $Out -Force }

$utf8 = New-Object System.Text.UTF8Encoding($false)
$writer = New-Object System.IO.StreamWriter((Join-Path $root $Out), $false, $utf8)

$results = New-Object System.Collections.Generic.List[object]
$startAll = [System.Diagnostics.Stopwatch]::StartNew()

function Write-Both {
    param([string]$Text, [string]$Color = "White")
    $writer.WriteLine($Text)
    Write-Host $Text -ForegroundColor $Color
}

function Run-Step {
    param(
        [string]$Name,
        [string]$WorkDir,
        [string]$Command,
        [string[]]$Arguments
    )

    $writer.WriteLine("")
    $writer.WriteLine("================================================================")
    $writer.WriteLine("STEP: $Name")
    $writer.WriteLine("DIR:  $WorkDir")
    $writer.WriteLine("CMD:  $Command $($Arguments -join ' ')")
    $writer.WriteLine("================================================================")

    Write-Host ""
    Write-Host "▶ $Name" -ForegroundColor Yellow

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $output = ""
    $exit = -1

    Push-Location $WorkDir
    try {
        $output = & $Command @Arguments 2>&1 | Out-String
        $exit = $LASTEXITCODE
    } catch {
        $output = "ОШИБКА ЗАПУСКА: $_"
        $exit = 127
    } finally {
        Pop-Location
    }
    $sw.Stop()

    $writer.WriteLine($output)
    $writer.WriteLine("")
    $writer.WriteLine("EXIT CODE: $exit")
    $writer.WriteLine("DURATION:  $([int]$sw.Elapsed.TotalSeconds) сек")

    $status = if ($exit -eq 0) { "OK" } else { "FAIL" }
    $color  = if ($exit -eq 0) { "Green" } else { "Red" }
    Write-Host "  → $status  ($([int]$sw.Elapsed.TotalSeconds) сек)" -ForegroundColor $color

    $results.Add([pscustomobject]@{
        Name    = $Name
        Status  = $status
        Seconds = [int]$sw.Elapsed.TotalSeconds
        Exit    = $exit
    })
}

# ---------- HEADER ----------
Write-Both "================================================================" "Cyan"
Write-Both "  CHECK-ALL REPORT" "Cyan"
Write-Both "================================================================" "Cyan"
Write-Both "  Repo:   $root"
Write-Both "  Branch: $branch"
Write-Both "  HEAD:   $head"
Write-Both "  When:   $when"
Write-Both "  OS:     $([System.Environment]::OSVersion.VersionString)"
Write-Both "  PS:     $($PSVersionTable.PSVersion)"
Write-Both "================================================================" "Cyan"

# ---------- TOOLCHAIN ----------
Write-Both ""
Write-Both "=== TOOLCHAIN ===" "Magenta"
try { $j = (& java -version 2>&1 | Select-Object -First 1); Write-Both "  java:  $j" } catch { Write-Both "  java:  (not found)" }
try { $m = (& mvn -v 2>&1 | Select-Object -First 1); Write-Both "  mvn:   $m" } catch { Write-Both "  mvn:   (not found)" }
try { $n = (& node --version 2>&1); Write-Both "  node:  $n" } catch { Write-Both "  node:  (not found)" }
try { $np = (& npm --version 2>&1); Write-Both "  npm:   $np" } catch { Write-Both "  npm:   (not found)" }

# ---------- BACKEND ----------
Write-Both ""
Write-Both "=== BACKEND ===" "Magenta"

if (Test-Path "stats-backend-java\pom.xml") {
    Run-Step "mvn compile"      "stats-backend-java" "mvn" @("-B","-q","compile")
    Run-Step "mvn test-compile" "stats-backend-java" "mvn" @("-B","-q","test-compile")
    Run-Step "mvn test"         "stats-backend-java" "mvn" @("-B","-q","test")
} else {
    Write-Both "  ! stats-backend-java\pom.xml не найден — пропускаю backend" "Yellow"
}

# ---------- FRONTEND ----------
Write-Both ""
Write-Both "=== FRONTEND ===" "Magenta"

if (Test-Path "stats-frontend\package.json") {
    Run-Step "npm typecheck" "stats-frontend" "npm" @("run","typecheck")
    Run-Step "npm build"     "stats-frontend" "npm" @("run","build")
    Run-Step "npm lint"      "stats-frontend" "npm" @("run","lint","--","--max-warnings","999")
} else {
    Write-Both "  ! stats-frontend\package.json не найден — пропускаю frontend" "Yellow"
}

# ---------- FORMAT (Prettier — глобальный, как в CI) ----------
Write-Both ""
Write-Both "=== FORMAT (Prettier) ===" "Magenta"

if (Test-Path "package.json") {
    Run-Step "npm format:check" "." "npm" @("run","format:check")
} else {
    Write-Both "  ! package.json не найден в корне — пропускаю format:check" "Yellow"
}

# ---------- GIT STATUS ----------
Write-Both ""
Write-Both "=== GIT STATUS ===" "Magenta"
$writer.WriteLine((& git status --short 2>&1 | Out-String))

# ---------- GIT DIFF STAT ----------
Write-Both ""
Write-Both "=== GIT DIFF --stat ===" "Magenta"
$writer.WriteLine((& git diff --stat 2>&1 | Out-String))

# ---------- SUMMARY ----------
$startAll.Stop()

Write-Both ""
Write-Both "================================================================" "Cyan"
Write-Both "  SUMMARY" "Cyan"
Write-Both "================================================================" "Cyan"

$failed = @()
foreach ($r in $results) {
    $color = if ($r.Status -eq "OK") { "Green" } else { "Red" }
    Write-Both ("  [{0,-4}] {1,-20} {2,4} сек" -f $r.Status, $r.Name, $r.Seconds) $color
    if ($r.Status -ne "OK") { $failed += $r }
}

Write-Both ""
Write-Both "  Total: $([int]$startAll.Elapsed.TotalSeconds) сек"

if ($failed.Count -eq 0) {
    Write-Both ""
    Write-Both "  ✅ ВСЁ ЗЕЛЁНОЕ — можно коммитить" "Green"
} else {
    Write-Both ""
    Write-Both "  ❌ УПАЛО $($failed.Count) проверок: $($failed.Name -join ', ')" "Red"
    Write-Both "  Детали — в STEP-блоках выше в этом файле."
}

$writer.WriteLine("")
$writer.WriteLine("================================================================")
$writer.WriteLine("  END OF REPORT")
$writer.WriteLine("================================================================")
$writer.Close()

Write-Host ""
Write-Host "📄 Отчёт: $root\$Out ($((Get-Item (Join-Path $root $Out)).Length) bytes)" -ForegroundColor Cyan
Write-Host ""