@echo off
chcp 65001 >nul
title 进销存管理系统 - 数据库备份

echo ============================================
echo     数据库备份
echo ============================================
echo.

:: 设置备份目录
set "BACKUP_DIR=%~dp0..\backups"
set "TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "DB_FILE=%~dp0..\server\data\jin_xiao_cun.db"

:: 检查数据库文件是否存在
if not exist "%DB_FILE%" (
    echo [错误] 数据库文件不存在: %DB_FILE%
    pause
    exit /b 1
)

:: 创建备份目录
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: 执行备份
set "BACKUP_FILE=%BACKUP_DIR%\jin_xiao_cun_%TIMESTAMP%.db"
copy "%DB_FILE%" "%BACKUP_FILE%" >nul

if %errorLevel% equ 0 (
    echo [OK] 备份成功
    echo 备份文件: %BACKUP_FILE%
    echo.
) else (
    echo [错误] 备份失败
)

:: 清理超过30天的备份
echo 清理30天前的旧备份...
forfiles /p "%BACKUP_DIR%" /m "*.db" /d -30 /c "cmd /c del @path" 2>nul
echo [OK] 清理完成
echo.
pause
