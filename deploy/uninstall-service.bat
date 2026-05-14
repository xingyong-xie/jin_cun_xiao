@echo off
chcp 65001 >nul
title 进销存管理系统 - 卸载 Windows 服务

echo ============================================
echo     卸载 Windows 服务
echo ============================================
echo.

:: 检查管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [错误] 请以管理员身份运行此脚本
    pause
    exit /b 1
)

cd /d "%~dp0..\server"

if not exist "daemon.js" (
    echo [错误] 未找到服务配置，服务可能未注册
    pause
    exit /b 1
)

:: 创建卸载脚本
(
echo const Service = require^('node-windows'^).Service;
echo.
echo const svc = new Service^({
echo   name: 'JinXiaoCun',
echo   script: require^('path'^).join^(__dirname, 'index.js'^)
echo });
echo.
echo svc.on^('uninstall', function^(^) {
echo   console.log^('服务卸载成功'^);
echo });
echo.
echo svc.on^('error', function^(err^) {
echo   console.error^('服务卸载失败:', err.message^);
echo });
echo.
echo svc.uninstall^(^);
) > uninstall-daemon.js

echo 正在卸载服务...
node uninstall-daemon.js

echo.
del /q uninstall-daemon.js 2>nul

echo 服务已卸载
echo.
pause
