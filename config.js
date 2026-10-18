// 服务器地址配置
// 部署到云端后，只需修改 production.baseUrl 为你的域名
module.exports = {
  // 本地开发环境（电脑+手机同一局域网时使用）
  local: {
    // 局域网IP，手机访问用这个（每次启动服务.bat会自动更新此IP）
    baseUrl: 'http://10.159.202.115:3000'
  },
  // 云端生产环境（部署到服务器后启用）
  production: {
    // 上传到云端后，把下面改成你的服务器域名，例如：
    // baseUrl: 'https://api.example.com'
    baseUrl: ''  // 留空表示未启用，填写后自动生效
  }
}
