@echo off
chcp 65001 >nul
title 进销存管理系统 - 安装部署

echo ============================================
echo     进销存管理系统 - 安装部署脚本
echo ============================================
echo.

:: 检查管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [警告] 建议以管理员身份运行此脚本
    echo.
)

:: 检查 Node.js 是否已安装
echo [1/5] 检查 Node.js 环境...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [错误] 未检测到 Node.js，正在尝试安装...
    echo.
    echo 请手动安装 Node.js LTS 版本：
    echo   1. 访问 https://nodejs.org/
    echo   2. 下载 LTS 版本安装包
    echo   3. 安装时勾选 "Add to PATH"
    echo   4. 安装完成后重新运行此脚本
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo [OK] Node.js 版本: %NODE_VER%
echo.

:: 检查 npm 是否可用
echo [2/5] 检查 npm 环境...
npm --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [错误] npm 不可用，请重新安装 Node.js
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('npm --version') do set NPM_VER=%%v
echo [OK] npm 版本: %NPM_VER%
echo.

:: 安装后端依赖
echo [3/5] 安装后端依赖...
cd /d "%~dp0..\server"
call npm install --production
if %errorLevel% neq 0 (
    echo [错误] 后端依赖安装失败
    pause
    exit /b 1
)
echo [OK] 后端依赖安装完成
echo.

:: 安装前端依赖并构建
echo [4/5] 安装前端依赖并构建...
cd /d "%~dp0..\client"
call npm install
if %errorLevel% neq 0 (
    echo [错误] 前端依赖安装失败
    pause
    exit /b 1
)
echo [OK] 前端依赖安装完成

echo.
echo 正在构建前端...
call npx vite build
if %errorLevel% neq 0 (
    echo [错误] 前端构建失败
    pause
    exit /b 1
)
echo [OK] 前端构建完成
echo.

:: 创建数据目录
echo [5/5] 初始化数据目录...
if not exist "%~dp0..\server\data" (
    mkdir "%~dp0..\server\data"
    echo [OK] 数据目录已创建
) else (
    echo [OK] 数据目录已存在
)
echo.

echo ============================================
echo     安装部署完成！
echo ============================================
echo.
echo 启动方式：
echo   方式一：双击 start.bat 启动服务
echo   方式二：运行 install-service.bat 注册为 Windows 服务（开机自启）
echo.
echo 访问地址：http://localhost:3001
echo 默认管理员账户：admin / admin123
echo.
pause
