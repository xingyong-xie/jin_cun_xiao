@echo off
chcp 65001 >nul
title 进销存管理系统

echo ============================================
echo     进销存管理系统 - 启动服务
echo ============================================
echo.

:: 检查是否已构建
if not exist "%~dp0..\client\dist\index.html" (
    echo [错误] 前端未构建，请先运行 setup.bat
    pause
    exit /b 1
)

:: 设置端口（默认 3001，可通过环境变量修改）
if not defined PORT set PORT=3001

echo 启动中...
echo 访问地址: http://localhost:%PORT%
echo 默认账户: admin / admin123
echo.
echo 按 Ctrl+C 停止服务
echo.

cd /d "%~dp0..\server"
node index.js
