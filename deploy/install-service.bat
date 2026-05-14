@echo off
chcp 65001 >nul
title 进销存管理系统 - 注册 Windows 服务

echo ============================================
echo     注册为 Windows 服务（开机自启）
echo ============================================
echo.

:: 检查管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [错误] 请以管理员身份运行此脚本
    echo 右键点击此文件 -^> "以管理员身份运行"
    pause
    exit /b 1
)

:: 检查是否已构建
if not exist "%~dp0..\client\dist\index.html" (
    echo [错误] 前端未构建，请先运行 setup.bat
    pause
    exit /b 1
)

:: 安装 node-windows
echo [1/3] 安装 node-windows 服务管理工具...
cd /d "%~dp0..\server"
call npm install node-windows --save
if %errorLevel% neq 0 (
    echo [错误] node-windows 安装失败
    pause
    exit /b 1
)
echo.

:: 生成服务注册脚本
echo [2/3] 生成服务配置...
cd /d "%~dp0..\server"

:: 获取项目绝对路径
set "PROJECT_DIR=%~dp0.."

:: 创建 daemon 脚本
(
echo const Service = require^('node-windows'^).Service;
echo.
echo const svc = new Service^({
echo   name: 'JinXiaoCun',
echo   description: '进销存管理系统',
echo   script: require^('path'^).join^(__dirname, 'index.js'^),
echo   env: [
echo     { name: 'PORT', value: '3001' }
echo   ],
echo   nodeOptions: [
echo     '--harmony',
echo     '--max_old_space_size=4096'
echo   ]
echo });
echo.
echo svc.on^('install', function^(^) {
echo   svc.start^(^);
echo   console.log^('服务安装并启动成功'^);
echo });
echo.
echo svc.on^('alreadyinstalled', function^(^) {
echo   console.log^('服务已存在，如需重新安装请先运行 uninstall-service.bat'^);
echo });
echo.
echo svc.on^('error', function^(err^) {
echo   console.error^('服务安装失败:', err.message^);
echo });
echo.
echo svc.install^(^);
) > daemon.js

echo [OK] 服务配置已生成
echo.

:: 注册服务
echo [3/3] 注册 Windows 服务...
echo.
echo 服务名称: JinXiaoCun
echo 服务描述: 进销存管理系统
echo 服务端口: 3001
echo.

node daemon.js

echo.
echo ============================================
echo 注册完成后，服务将开机自启动
echo.
echo 管理方式：
echo   - 停止服务：运行 uninstall-service.bat 或在"服务"管理器中操作
echo   - 查看服务：Win+R 输入 services.msc 查找 JinXiaoCun
echo   - 访问地址：http://localhost:3001
echo ============================================
echo.
pause
