@echo off
chcp 65001 >nul
title 进销存管理系统 - 数据库恢复

echo ============================================
echo     数据库恢复
echo ============================================
echo.

set "BACKUP_DIR=%~dp0..\backups"
set "DB_FILE=%~dp0..\server\data\jin_xiao_cun.db"

:: 检查备份目录
if not exist "%BACKUP_DIR%" (
    echo [错误] 备份目录不存在，没有可恢复的备份
    pause
    exit /b 1
)

:: 列出可用备份
echo 可用备份列表:
echo.
set "COUNT=0"
for /f "delims=" %%f in ('dir /b /o-d "%BACKUP_DIR%\*.db"') do (
    set /a COUNT+=1
    echo   !COUNT!. %%f
)

if %COUNT% equ 0 (
    echo [错误] 没有找到备份文件
    pause
    exit /b 1
)

echo.
set /p "BACKUP_NAME=请输入备份文件名: "

set "BACKUP_FILE=%BACKUP_DIR%\%BACKUP_NAME%"
if not exist "%BACKUP_FILE%" (
    echo [错误] 备份文件不存在: %BACKUP_FILE%
    pause
    exit /b 1
)

echo.
echo [警告] 恢复操作将覆盖当前数据库！
set /p "CONFIRM=确认恢复？(y/N): "
if /i not "%CONFIRM%"=="y" (
    echo 已取消
    pause
    exit /b 0
)

:: 停止服务
echo 正在停止服务...
taskkill /f /im node.exe /fi "WINDOWTITLE eq 进销存管理系统*" >nul 2>&1
timeout /t 2 >nul

:: 恢复数据库
copy "%BACKUP_FILE%" "%DB_FILE%" >nul
if %errorLevel% equ 0 (
    echo [OK] 数据库恢复成功
) else (
    echo [错误] 数据库恢复失败
)

echo.
echo 请重新启动服务: start.bat
echo.
pause
