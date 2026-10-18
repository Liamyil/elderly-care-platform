/**
 * 互助员档案数据（手动维护）
 *
 * 使用方法：后续补充真实资料时，只改这个文件。
 * - avatar:  头像路径（如 '/images/helpers/li.png'），留空显示占位头像
 * - gender:  性别（男/女），留空不显示
 * - age:     年龄，留空不显示
 * - bio:     个人简介（一句话），留空不显示
 * - tags:    服务特长标签数组（如 ['陪诊', '助餐']），留空不显示
 */
const HELPER_PROFILES = {
  '李叔叔': { avatar: '', gender: '', age: '', bio: '', tags: [] },
  '王秀兰': { avatar: '', gender: '', age: '', bio: '', tags: [] },
  '张建国': { avatar: '', gender: '', age: '', bio: '', tags: [] }
}

module.exports = {
  HELPER_PROFILES: HELPER_PROFILES
}
