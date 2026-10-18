@echo off
chcp 65001 >nul
title Claude Code (Force deepseek-flash)

rem 1. 清空旧的残留配置
set "ANTHROPIC_BASE_URL="
set "ANTHROPIC_AUTH_TOKEN="
set "ANTHROPIC_MODEL="
set "ANTHROPIC_DEFAULT_OPUS_MODEL="
set "ANTHROPIC_DEFAULT_SONNET_MODEL="
set "ANTHROPIC_DEFAULT_HAIKU_MODEL="
set "CLAUDE_CODE_SUBAGENT_MODEL="

rem 2. 写入 DeepSeek 强制配置
set "ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic"
set "ANTHROPIC_AUTH_TOKEN=1b56b082-b339-4a9e-ae12-703e4ea0ccb8"
set "ANTHROPIC_MODEL=deepseek-flash[1m]"
set "ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-flash[1m]"
set "ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-flash[1m]"
set "ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-flash"
set "CLAUDE_CODE_SUBAGENT_MODEL=deepseek-flash"

rem 3. 自动进入项目目录
cd /d "d:\智慧互助养老平台整体实现方案"

echo 正在强制使用 deepseek-flash 模型启动 Claude Code...
echo.

rem 4. 强行覆盖模型参数启动
claude --model "deepseek-flash[1m]"
pause