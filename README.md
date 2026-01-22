# TurnSense 德扑助手

一个轻量的德州扑克胜率估算与入局建议工具。选择手牌、公共牌和对手人数后，使用蒙特卡洛模拟估算胜率，并给出“入局/退出”建议。

## 功能
- 选择手牌与公共牌，自动防重复
- 支持对手人数 1-8
- 蒙特卡洛胜率估算 + 阈值推荐
- PWA 离线缓存
- 可用 Capacitor 打包为 Android APK

## 使用说明
### 聊天界面（默认入口）
输入格式：
```
<手牌> [公共牌] <对手人数>
```
说明：
- 手牌固定 2 张，公共牌可选 3-5 张，对手人数 1-8
- 牌面写法：花色字母 + 点数
  - 花色：b=黑桃，r=红桃，f=方块，m=梅花
  - 点数：1-13 或 A/J/Q/K（大小写均可）
- 示例：
```
bArK 3
bArK f5f6f7 3
bArK f5f6f7m9 3
bArK f5f6f7m9b10 3
```
- 伪装展示：输入会拆成日常对话模板，结果以“入局/退出”话术回复，不直接暴露手牌/胜率

### 详细模式（原版界面）
- 进入：对方头像连续点击 3 次
- 操作：卡牌选择 + 结果面板

### 个性化
- 修改头像：点击头像上传并裁剪
- 修改备注：顶部昵称连续点击 3 次

## 本地运行
任意静态服务器即可：

```bash
python3 -m http.server 8080
```

然后访问 `http://localhost:8080/`。

## Android 打包（Capacitor）
需要 Node.js、JDK 21、Android SDK（platform-tools / platforms;android-36 / build-tools;36.0.0）。

```bash
npm install
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

输出 APK：
```
android/app/build/outputs/apk/debug/app-debug.apk
```

如果更改了前端代码，重复执行 `npm run build` 和 `npx cap sync android` 即可。

## 版本记录
- v1.0.1：修复 APK 键盘弹出导致页面上移，键盘弹出/收起时聊天自动滚动，移动端顶部间距优化
