// cloudbase_auth - Auth function for environment sharing
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  console.log('[cloudbase_auth] event:', event)
  console.log('[cloudbase_auth] wxContext:', wxContext)
  console.log('[cloudbase_auth] FROM_APPID:', wxContext.FROM_APPID)
  console.log('[cloudbase_auth] FROM_OPENID:', wxContext.FROM_OPENID)
  console.log('[cloudbase_auth] FROM_UNIONID:', wxContext.FROM_UNIONID)

  // DEBUG: 记录访问者的 OPENID 到控制台日志
  console.log('=== ADMIN ACCESS OPENID ===', wxContext.FROM_OPENID)

  return {
    errCode: 0,
    errMsg: '',
    auth: JSON.stringify({
      // 自定义安全规则
      // admin 小程序可以访问 tea-shop 的云开发资源
      role: 'admin'
    })
  }
}