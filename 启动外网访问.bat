@echo off
chcp 65001 >nul
title 外网访问通道 - 周总演示
echo ================================================
echo   智慧互助养老平台 - 外网访问通道
echo.
echo   本窗口必须保持开启，周总才能访问！
echo   公网地址在下方日志里（trycloudflare.com 开头）
echo   关闭本窗口 = 立即断开外网访问
echo ================================================
echo.
"C:\Users\yi\cloudflared\cloudflared.exe" tunnel --url http://localhost:5173 --no-autoupdate
pause
