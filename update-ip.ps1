# 自动更新 config.js 中的局域网 IP（启动服务.bat 每次启动时调用，小程序真机预览用）
# 取当前"有默认网关"的网卡 IPv4（即正在上网的那块网卡）；找不到则不改动 config.js
$ErrorActionPreference = 'SilentlyContinue'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $root 'config.js'

$ip = (Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.IPv4Address -ne $null } | Select-Object -First 1).IPv4Address.IPAddress
if (-not $ip) {
    Write-Host '[update-ip] 未找到有效局域网 IP，config.js 保持不变'
    exit 0
}

$content = [System.IO.File]::ReadAllText($configPath, [System.Text.Encoding]::UTF8)
$pattern = "baseUrl: 'http://[^']+:3000'"
$replacement = "baseUrl: 'http://$ip`:3000'"
if ($content -match $pattern) {
    $newContent = [regex]::Replace($content, $pattern, $replacement)
    [System.IO.File]::WriteAllText($configPath, $newContent, [System.Text.Encoding]::UTF8)
    Write-Host "[update-ip] config.js 已更新为 http://$ip`:3000"
} else {
    Write-Host '[update-ip] config.js 中未找到 baseUrl 行，跳过更新'
}

# 同步把正确 IP 写入供后端启动脚本读取（后端图片地址必须用与小程序一致的 IP，否则手机无法加载图片）
$dataDir = 'D:\elderly-care-data'
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir | Out-Null
}
[System.IO.File]::WriteAllText("$dataDir\lan-ip.txt", $ip, [System.Text.Encoding]::ASCII)
Write-Host "[update-ip] 后端 IP 已写入 $dataDir\lan-ip.txt"
