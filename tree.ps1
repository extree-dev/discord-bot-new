# tree.ps1 - простой показ структуры frontend
function Show-SimpleTree {
    param(
        [string]$Path = ".",
        [string]$Indent = ""
    )
    
    # Папки для исключения
    $exclude = @("node_modules", ".git", "dist")
    
    # Получаем элементы
    $items = Get-ChildItem -Path $Path | Where-Object { $exclude -notcontains $_.Name }
    
    if ($items.Count -eq 0) {
        Write-Host "${Indent}+-- (пусто)" -ForegroundColor DarkGray
        return
    }
    
    for ($i = 0; $i -lt $items.Count; $i++) {
        $item = $items[$i]
        $isLast = ($i -eq $items.Count - 1)
        
        # Простые символы вместо Unicode
        $branch = if ($isLast) { "+--" } else { "+--" }
        $space = if ($isLast) { "   " } else { "|  " }
        
        if ($item.PSIsContainer) {
            # Папка
            Write-Host "${Indent}${branch} [DIR] " -NoNewline
            Write-Host $item.Name -ForegroundColor Cyan
            
            # Рекурсивно показываем содержимое
            Show-SimpleTree -Path $item.FullName -Indent ($Indent + $space)
        } else {
            # Файл
            Write-Host "${Indent}${branch} [FILE] " -NoNewline
            
            # Цвет по расширению
            $color = switch ($item.Extension.ToLower()) {
                '.ts'   { 'DarkCyan' }
                '.tsx'  { 'DarkCyan' }
                '.js'   { 'Yellow' }
                '.jsx'  { 'Yellow' }
                '.json' { 'Green' }
                '.md'   { 'Blue' }
                '.ps1'  { 'Red' }
                '.env'  { 'DarkRed' }
                '.txt'  { 'Gray' }
                '.css'  { 'Magenta' }
                '.html' { 'DarkYellow' }
                default { 'White' }
            }
            
            Write-Host $item.Name -ForegroundColor $color
        }
    }
}

# Очищаем консоль
Clear-Host

# Заголовок
Write-Host "========================================" -ForegroundColor Green
Write-Host " Структура папки frontend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green
Write-Host "Путь: $(Get-Location)\frontend`n" -ForegroundColor Yellow

# Проверяем, существует ли папка frontend
$frontendPath = Join-Path (Get-Location) "frontend"
if (-not (Test-Path $frontendPath)) {
    Write-Host "ОШИБКА: Папка 'frontend' не найдена!" -ForegroundColor Red
    Write-Host "Убедитесь, что вы запускаете скрипт из корневой папки проекта." -ForegroundColor Yellow
} else {
    # Показываем структуру frontend
    Show-SimpleTree -Path "frontend"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Нажмите Enter для выхода..." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green

# Простая пауза
Read-Host