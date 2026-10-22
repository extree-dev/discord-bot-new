<#
.SYNOPSIS
    Проверка статуса миграции stats-backend (Node) -> stats-backend-java (Java).
    Только читает, ничего не меняет. Печатает отчёт с ✅/❌ по каждому пункту.
.EXAMPLE
    .\check-java-migration.ps1
    .\check-java-migration.ps1 -SkipLocalRun
#>
param(
    [string]$Root = "C:\Users\roman.gorbach\discord-bot-new",
    [switch]$SkipLocalRun
)

$ErrorActionPreference = "Continue"
$ok = 0; $fail = 0; $warn = 0

function Write-Section($title) {
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host " $title" -ForegroundColor Cyan
    Write-Host ("=" * 70) -ForegroundColor Cyan
}

function Test-Item($label, [scriptblock]$check) {
    try {
        $result = & $check
        if ($result -eq $true) {
            Write-Host "  [OK]   $label" -ForegroundColor Green
            $script:ok++
        } elseif ($result -eq "warn") {
            Write-Host "  [WARN] $label" -ForegroundColor Yellow
            $script:warn++
        } else {
            Write-Host "  [FAIL] $label" -ForegroundColor Red
            $script:fail++
        }
    } catch {
        Write-Host "  [FAIL] $label ($($_.Exception.Message))" -ForegroundColor Red
        $script:fail++
    }
}

if (-not (Test-Path $Root)) {
    Write-Host "Root not found: $Root" -ForegroundColor Red
    exit 1
}
Push-Location $Root

# ---------- 1. Java-код ----------
Write-Section "1. Java-код (stats-backend-java/)"

Test-Item "Каталог stats-backend-java существует" {
    Test-Path "stats-backend-java\pom.xml"
}
Test-Item "Spring Boot 3.x в pom.xml" {
    (Get-Content "stats-backend-java\pom.xml" -Raw) -match "<version>3\.3\.\d+</version>"
}
Test-Item "Flyway в pom.xml" {
    (Get-Content "stats-backend-java\pom.xml" -Raw) -match "flyway-core"
}
Test-Item "Riot-порты (RiotOAuth.java, RiotApi.java)" {
    (Test-Path "stats-backend-java\src\main\java\tech\extree\stats\application\port\out\RiotOAuth.java") -and
    (Test-Path "stats-backend-java\src\main\java\tech\extree\stats\application\port\out\RiotApi.java")
}
Test-Item "Riot-адаптеры (RiotOAuthAdapter.java, RiotApiAdapter.java)" {
    (Test-Path "stats-backend-java\src\main\java\tech\extree\stats\adapter\out\riot\RiotOAuthAdapter.java") -and
    (Test-Path "stats-backend-java\src\main\java\tech\extree\stats\adapter\out\riot\RiotApiAdapter.java")
}
Test-Item "Riot-контроллеры (RiotAuthController, RiotLookupController)" {
    (Test-Path "stats-backend-java\src\main\java\tech\extree\stats\adapter\in\web\RiotAuthController.java") -and
    (Test-Path "stats-backend-java\src\main\java\tech\extree\stats\adapter\in\web\RiotLookupController.java")
}
Test-Item "Riot-тесты (RiotAuthServiceTest, RiotLookupServiceTest, ValidationTest)" {
    (Test-Path "stats-backend-java\src\test\java\tech\extree\stats\application\service\RiotAuthServiceTest.java") -and
    (Test-Path "stats-backend-java\src\test\java\tech\extree\stats\application\service\RiotLookupServiceTest.java") -and
    (Test-Path "stats-backend-java\src\test\java\tech\extree\stats\application\ValidationTest.java")
}
Test-Item "Flyway-миграция V1__init.sql" {
    Test-Path "stats-backend-java\src\main\resources\db\migration\V1__init.sql"
}
Test-Item "Dockerfile для Java (stats-backend-java/Dockerfile)" {
    Test-Path "stats-backend-java\Dockerfile"
}

# ---------- 2. Инфраструктура ----------
Write-Section "2. Инфраструктура (docker-compose.yml, Caddyfile, .env.example)"

Test-Item "docker-compose.yml: сервис stats-backend-java присутствует" {
    (Get-Content "docker-compose.yml" -Raw) -match "stats-backend-java:"
}
Test-Item "docker-compose.yml: сервис stats-backend (Node) УДАЛЁН" {
    if ((Get-Content "docker-compose.yml" -Raw) -match "^\s+stats-backend:") { $false } else { $true }
}
Test-Item "web/Caddyfile: stats.extree.tech проксирует на stats-backend-java:8081" {
    $caddy = Get-Content "web/Caddyfile" -Raw
    # ищем блок stats.extree.tech и в нём reverse_proxy stats-backend-java:8081
    $block = [regex]::Match($caddy, 'stats\.extree\.tech\s*\{[\s\S]*?\n\}').Value
    $block -match "reverse_proxy stats-backend-java:8081"
}
Test-Item "web/Caddyfile: stats.extree.tech НЕ проксирует на stats-backend:3000" {
    $caddy = Get-Content "web/Caddyfile" -Raw
    $block = [regex]::Match($caddy, 'stats\.extree\.tech\s*\{[\s\S]*?\n\}').Value
    -not ($block -match "reverse_proxy stats-backend:3000")
}
Test-Item ".env.example: содержит DATABASE_URL_JDBC" {
    (Get-Content ".env.example" -Raw) -match "DATABASE_URL_JDBC"
}
Test-Item ".env.example: содержит STATS_BACKEND_JAVA_PORT" {
    (Get-Content ".env.example" -Raw) -match "STATS_BACKEND_JAVA_PORT"
}
Test-Item "deploy.yml упоминает stats-backend-java (или не мешает)" {
    $deploy = Get-Content ".github\workflows\deploy.yml" -Raw
    ($deploy -match "stats-backend-java") -or ($deploy -match "docker compose up")
}

# ---------- 3. Node-код (что ещё удалять) ----------
Write-Section "3. Node-код (stats-backend/) — то, что ещё не удалено"

Test-Item "stats-backend/ ещё существует (это ожидаемо до коммита 6)" {
    if (Test-Path "stats-backend") { "warn" } else { $true }
}
Test-Item "stats-backend/server.js ещё существует (это ожидаемо до коммита 6)" {
    if (Test-Path "stats-backend\server.js") { "warn" } else { $true }
}
Test-Item "test/riotOAuth.test.js ещё существует (это ожидаемо до коммита 6)" {
    if (Test-Path "test\riotOAuth.test.js") { "warn" } else { $true }
}
Test-Item "test/statsAuth.test.js ещё существует (это ожидаемо до коммита 6)" {
    if (Test-Path "test\statsAuth.test.js") { "warn" } else { $true }
}

# ---------- 4. Git-статус ----------
Write-Section "4. Git-статус ветки"

Push-Location $Root
$branch = (git rev-parse --abbrev-ref HEAD 2>$null)
Write-Host "  Текущая ветка: $branch" -ForegroundColor Gray

Test-Item "Ветка не main (работа идёт в feature-ветке)" {
    $branch -ne "main" -and $branch -ne "master"
}
Test-Item "Нет незакоммиченных изменений в stats-backend-java/" {
    $status = git status --porcelain -- "stats-backend-java/" 2>$null
    if ([string]::IsNullOrWhiteSpace($status)) { $true } else {
        Write-Host "    Изменения:" -ForegroundColor DarkYellow
        $status -split "`n" | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
        $false
    }
}
Test-Item "Нет незакоммиченных изменений в docker-compose.yml / Caddyfile / .env.example" {
    $status = git status --porcelain -- "docker-compose.yml" "web/Caddyfile" ".env.example" "CHANGELOG.md" 2>$null
    if ([string]::IsNullOrWhiteSpace($status)) { $true } else {
        Write-Host "    Изменения:" -ForegroundColor DarkYellow
        $status -split "`n" | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
        $false
    }
}
Test-Item "Последние 8 коммитов в ветке" {
    Write-Host "    " -NoNewline
    git log --oneline -8 2>$null | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
    $true
}
Pop-Location

# ---------- 5. Сборка и тесты Java ----------
Write-Section "5. Java: сборка и тесты (mvn -B verify)"

$mvn = Get-Command mvn -ErrorAction SilentlyContinue
if (-not $mvn) {
    Write-Host "  [SKIP] mvn не найден в PATH — пропускаю сборку" -ForegroundColor Yellow
    $script:warn++
} else {
    Push-Location "stats-backend-java"
    Write-Host "  Запускаю mvn -B verify (может занять 20-30 сек)..." -ForegroundColor Gray
    $out = & mvn -B verify 2>&1 | Out-String
    $buildOk = $out -match "BUILD SUCCESS"
    $testsLine = [regex]::Match($out, "Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)").Value
    Pop-Location

    if ($buildOk) {
        Write-Host "  [OK]   mvn -B verify: BUILD SUCCESS" -ForegroundColor Green
        $script:ok++
        if ($testsLine) {
            Write-Host "         $testsLine" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "  [FAIL] mvn -B verify: BUILD FAILURE" -ForegroundColor Red
        Write-Host "         Последние 20 строк:" -ForegroundColor DarkRed
        ($out -split "`n" | Select-Object -Last 20) | ForEach-Object { Write-Host "         $_" -ForegroundColor DarkRed }
        $script:fail++
    }
}

# ---------- 6. Локальный запуск (опционально) ----------
if (-not $SkipLocalRun) {
    Write-Section "6. Локальный запуск (bэкенд 8081, фронтенд 5173)"

    Test-Item "Порт 8081 (Java) слушает" {
        $conn = Test-NetConnection -ComputerName localhost -Port 8081 -WarningAction SilentlyContinue
        $conn.TcpTestSucceeded
    }
    Test-Item "Порт 5173 (Vite) слушает" {
        $conn = Test-NetConnection -ComputerName localhost -Port 5173 -WarningAction SilentlyContinue
        $conn.TcpTestSucceeded
    }
    Test-Item "http://localhost:8081/api/session отвечает 200" {
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:8081/api/session" -UseBasicParsing -TimeoutSec 3
            Write-Host "    Ответ: $($r.StatusCode) $($r.Content)" -ForegroundColor DarkGray
            $r.StatusCode -eq 200
        } catch { $false }
    }
    Test-Item "http://localhost:8081/auth/riot/login отвечает 302 (RIOT_CLIENT_ID пуст)" {
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:8081/auth/riot/login" -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 3 -ErrorAction SilentlyContinue
            # PowerShell считает 3xx ошибкой при MaximumRedirection 0 — ловим и смотрим Location
            $false
        } catch {
            $resp = $_.Exception.Response
            if ($resp -and $resp.StatusCode -eq 302) {
                $loc = $resp.Headers["Location"]
                Write-Host "    Location: $loc" -ForegroundColor DarkGray
                $loc -match "auth_error=1"
            } else { $false }
        }
    }
    Test-Item "http://localhost:8081/api/riot/lookup (невалидный ID) → 400 invalid_riot_id" {
        try {
            $body = '{"riotId":"bad"}'
            $r = Invoke-WebRequest -Uri "http://localhost:8081/api/riot/lookup" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            $r.StatusCode -eq 400 -and $r.Content -match "invalid_riot_id"
        } catch {
            $resp = $_.Exception.Response
            if ($resp) {
                $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
                $content = $sr.ReadToEnd()
                $sr.Close()
                Write-Host "    Ответ: $([int]$resp.StatusCode) $content" -ForegroundColor DarkGray
                ([int]$resp.StatusCode -eq 400) -and ($content -match "invalid_riot_id")
            } else { $false }
        }
    }
}

# ---------- Итог ----------
Write-Section "ИТОГ"

$total = $ok + $fail + $warn
Write-Host ""
Write-Host "  Проверено: $total" -ForegroundColor Gray
Write-Host "  OK:        $ok" -ForegroundColor Green
Write-Host "  WARN:      $warn" -ForegroundColor Yellow
Write-Host "  FAIL:      $fail" -ForegroundColor Red
Write-Host ""

if ($fail -eq 0 -and $warn -eq 0) {
    Write-Host "  🎉 Переход на Java полностью завершён." -ForegroundColor Green
    Write-Host "     (Node-код удалён, инфра на Java, тесты зелёные.)" -ForegroundColor Green
} elseif ($fail -eq 0) {
    Write-Host "  ⚠️  Переход не завершён: есть предупреждения (WARN)." -ForegroundColor Yellow
    Write-Host "     Обычно это значит: Node-код ещё не удалён (коммит 6), либо" -ForegroundColor Yellow
    Write-Host "     тесты Riot/Dockerfile ещё не закоммичены (коммиты 3-4)." -ForegroundColor Yellow
} else {
    Write-Host "  ❌ Переход не завершён: есть ошибки (FAIL)." -ForegroundColor Red
    Write-Host "     Смотрите разделы выше — там точные причины." -ForegroundColor Red
}

Write-Host ""
Write-Host "Подсказка: '.\check-java-migration.ps1 -SkipLocalRun' — без проверки локальных портов." -ForegroundColor DarkGray
Write-Host ""

Pop-Location