<#
.SYNOPSIS
    Собирает все исходные файлы проекта в один TXT.
.EXAMPLE
    .\collect-code.ps1
    .\collect-code.ps1 -Root "C:\Users\roman.gorbach\discord-bot-new"
    .\collect-code.ps1 -Output "C:\temp\all-code.txt"
#>
param(
    [string]$Root   = (Get-Location).Path,
    [string]$Output = (Join-Path (Get-Location).Path "all-code.txt"),
    [string[]]$IncludeExtensions = @(
        ".js",".jsx",".ts",".tsx",".mjs",".cjs",
        ".java",".kt",".groovy",
        ".json",".yml",".yaml",".toml",".xml",
        ".css",".scss",".sass",".less",
        ".html",".htm",
        ".md",".txt",
        ".sql",
        ".sh",".ps1",".bat",".cmd",
        ".dockerfile",".env",".properties",
        ".gitignore",".dockerignore",".prettierignore",".eslintignore"
    ),
    [string[]]$ExcludeDirs = @(
        "node_modules",".git",".idea",".vscode",
        "target","build","dist","out",".next",".nuxt",
        "coverage",".cache",".parcel-cache",
        "venv",".venv","__pycache__",
        "logs","tmp","temp"
    )
)

$ErrorActionPreference = "Stop"

# Разрешаем относительные пути
$Root   = (Resolve-Path $Root).Path
$Output = [System.IO.Path]::GetFullPath($Output)

if (-not (Test-Path $Root)) { throw "Root not found: $Root" }

Write-Host "Root:   $Root"   -ForegroundColor Cyan
Write-Host "Output: $Output" -ForegroundColor Cyan

# Собираем файлы
$files = Get-ChildItem -Path $Root -Recurse -File -Force |
    Where-Object {
        # исключаем каталоги
        $rel = $_.FullName.Substring($Root.Length).TrimStart('\','/')
        $parts = $rel -split '[\\/]'
        $skip = $false
        foreach ($d in $ExcludeDirs) {
            if ($parts -contains $d) { $skip = $true; break }
        }
        if ($skip) { return $false }

        # по расширению / имени
        $name = $_.Name
        $ext  = $_.Extension.ToLower()
        if ($IncludeExtensions -contains $ext) { return $true }
        if ($IncludeExtensions -contains $name.ToLower()) { return $true }  # .env, .gitignore, Dockerfile

        # файлы без расширения с известными именами
        $knownNames = @("Dockerfile","Makefile","Procfile","Caddyfile",".env",".env.example",".gitignore",".dockerignore")
        if ($knownNames -contains $name) { return $true }

        return $false
    } |
    Where-Object {
        # отсекаем бинарники по эвристике (первые байты)
        try {
            $fs = [System.IO.File]::OpenRead($_.FullName)
            $buf = New-Object byte[] 4096
            $n = $fs.Read($buf, 0, $buf.Length)
            $fs.Close()
            for ($i = 0; $i -lt $n; $i++) {
                if ($buf[$i] -eq 0) { return $false }  # NUL => бинарник
            }
            return $true
        } catch { return $false }
    } |
    Sort-Object FullName

Write-Host ("Files found: {0}" -f $files.Count) -ForegroundColor Green

# Пишем
$utf8 = New-Object System.Text.UTF8Encoding($false)  # без BOM
$sw = New-Object System.IO.StreamWriter($Output, $false, $utf8)
try {
    $sw.WriteLine("=" * 100)
    $sw.WriteLine("CODE COLLECTION")
    $sw.WriteLine("Root:    $Root")
    $sw.WriteLine("Created: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
    $sw.WriteLine("Files:   $($files.Count)")
    $sw.WriteLine("=" * 100)
    $sw.WriteLine()

    $i = 0
    foreach ($f in $files) {
        $i++
        $rel = $f.FullName.Substring($Root.Length).TrimStart('\','/')
        $sw.WriteLine("")
        $sw.WriteLine(("=" * 100))
        $sw.WriteLine(("FILE [{0}/{1}]: {2}" -f $i, $files.Count, $rel))
        $sw.WriteLine(("SIZE: {0} bytes" -f $f.Length))
        $sw.WriteLine(("=" * 100))
        try {
            $content = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8
            $sw.Write($content)
            if (-not $content.EndsWith("`n")) { $sw.WriteLine() }
        } catch {
            $sw.WriteLine("[ERROR reading file: $($_.Exception.Message)]")
        }
        $sw.WriteLine()
    }
} finally {
    $sw.Dispose()
}

Write-Host ("DONE: {0}" -f $Output) -ForegroundColor Green
Write-Host ("Size: {0:N2} MB" -f ((Get-Item $Output).Length / 1MB)) -ForegroundColor Green