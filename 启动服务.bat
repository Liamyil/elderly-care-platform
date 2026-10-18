@echo off
chcp 65001 >nul
REM ====================================
REM Smart Elderly Care Platform - Start Script
REM 每次启动：停旧后端 → mvn clean package 重新打包 → 启动新 jar
REM ====================================

echo 正在更新IP配置...
powershell -ExecutionPolicy Bypass -File "%~dp0update-ip.ps1"

REM 读取正确 IP 作为后端图片地址（与小程序 config.js 保持一致，否则手机加载不了图片）
if exist "D:\elderly-care-data\lan-ip.txt" (
    set /p LAN_IP=<D:\elderly-care-data\lan-ip.txt
    set BASE_URL=http://%LAN_IP%:3000
    echo [启动] 后端图片地址 = %BASE_URL%
)

REM 1. 停止旧后端：按端口3000找PID并强制结束（防止旧 jar 继续占用端口）
echo.
echo [1/4] 正在停止旧后端进程...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo 发现旧进程 PID=%%p，正在结束...
    taskkill /F /PID %%p >nul 2>nul
)
timeout /t 2 /nobreak >nul

REM 2. 启动 MySQL
echo [2/4] 正在启动 MySQL...
net start MySQL80 2>nul

REM 3. 重新打包后端（跳过测试，首次约 1-3 分钟）
echo.
echo [3/4] 正在重新打包后端（mvn clean package -DskipTests）...
where mvn >nul 2>nul
if errorlevel 1 (
    echo [错误] 未找到 mvn 命令，请确认 Maven 已安装并加入 PATH
    pause
    exit /b 1
)
cd /d "%~dp0backend-java"
call mvn clean package -DskipTests
if errorlevel 1 (
    echo.
    echo [错误] 打包失败，请查看上方 mvn 输出
    cd /d "%~dp0"
    pause
    exit /b 1
)
if not exist "target\elderly-care-backend-1.0.0.jar" (
    echo [错误] 未找到 target\elderly-care-backend-1.0.0.jar，打包可能失败
    cd /d "%~dp0"
    pause
    exit /b 1
)
echo [打包完成] target\elderly-care-backend-1.0.0.jar

REM 4. 打开微信开发者工具
start "" "D:\微信开发者工具\微信web开发者工具\wechatdevtools.exe"

REM 5. 启动后端服务（SpringBoot 版，端口3000，UTF-8编码避免中文乱码）
echo [4/4] 正在启动后端服务（端口3000）...
start "Backend Service" cmd /k "chcp 65001 >nul && java -Dfile.encoding=UTF-8 -Dsun.stdout.encoding=UTF-8 -Dsun.stderr.encoding=UTF-8 -jar target\elderly-care-backend-1.0.0.jar"

cd /d "%~dp0"
echo.
echo [完成] 后端已在新窗口启动，请留意初始化日志（建表/内置超管）
timeout /t 3 /nobreak >nul
exit /b 0
