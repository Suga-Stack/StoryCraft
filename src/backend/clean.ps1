Write-Host "Cleaning up the project..."
Write-Host ""

# 1. Delete the database file
if (Test-Path "db.sqlite3") {
    Remove-Item "db.sqlite3"
    Write-Host "Database file deleted."
} else {
    Write-Host "Database file (db.sqlite3) not found."
}
Write-Host ""

# 2. Clean up migration files
Write-Host "Cleaning migration files..."
$apps = @("game", "gameworks", "interactions", "stories", "tags", "users")

foreach ($app in $apps) {
    $migrationsPath = "$app\migrations"
    if (Test-Path $migrationsPath) {
        Write-Host "Cleaning migrations in '$app\'..."
        
        # 获取 migrations 文件夹下的所有内容（不包括 __init__.py）
        $itemsToDelete = Get-ChildItem $migrationsPath | Where-Object { 
            $_.Name -ne "__init__.py" 
        }
        
        foreach ($item in $itemsToDelete) {
            Write-Host "  Deleting $($item.Name)"
            if ($item.PSIsContainer) {
                # 如果是文件夹，递归删除
                Remove-Item $item.FullName -Recurse -Force
            } else {
                # 如果是文件，直接删除
                Remove-Item $item.FullName -Force
            }
        }
    } else {
        Write-Host "Migrations folder not found in '$app\'."
    }
}

Write-Host ""
Write-Host "Cleanup complete."
Write-Host "You can now run 'python manage.py makemigrations' and 'python manage.py migrate'"
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")