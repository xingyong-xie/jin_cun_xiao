@echo off
chcp 65001 >nul
title 进销存管理系统 - 停止服务

echo 正在停止进销存管理系统服务...

:: 查找并终止 node 进程（仅限本应用）
for /f "tokens=2" %%p in ('tasklist /fi "imagename eq node.exe" /fo list ^| find "PID"') do (
    wmic process where "ProcessId=%%p and CommandLine like '%%jin_xiao_cun%%'" get ProcessId 2>nul | find "%%p" >nul
    if not errorlevel 1 (
        taskkill /pid %%p /f >nul 2>&1
        echo 已停止进程 PID: %%p
    )
)

echo.
echo 服务已停止
timeout /t 3 >nul
