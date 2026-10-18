@echo off
chcp 65001 >nul
echo ============================================
echo   智慧互助养老平台 - 管理后台启动
echo ============================================
echo.
echo 请确认后端服务已在运行（端口3000，双击"启动服务.bat"可启动）
echo.
REM 5秒后用 Microsoft Edge 打开（不依赖系统默认浏览器，避免被夸克等其他浏览器接管）
start "" cmd /c "timeout /t 5 /nobreak >nul && start msedge http://localhost:5173"
echo 正在启动管理后台服务，浏览器即将自动打开...
echo 登录账号: 13900139000  密码: 13900139000hhL.
echo.
cd /d "%~dp0admin-web"
npm run dev
pause
