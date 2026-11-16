# YunFlow

地点是记忆的容器，地图是记忆的入口。云流是一款私人记忆地图：可以在高德地图任意位置创建地点，也可以直接点击地图上已有的地点写记忆。一个地点可保存多条独立、可回溯日期的记忆，地图标记显示数量。

公开网址：<https://yunflow-memory-map.thinmerit.chatgpt.site>。账户名支持中文，密码至少 8 个字符。“本机账户”无需网络即可注册和登录，密码经加盐哈希保存在当前设备，地点与记忆按账户隔离，但不会自动跨设备同步；“云端账户”需连接服务端，联网后可同步。新建本机账户时会复制当前访客数据；云端账户与访客数据分开，可通过 JSON 备份迁移。

## 本地运行

需要 Node.js 20.19+ 或 22.12+：

```bash
npm install
cp .env.example .env
npm run dev
```

Windows PowerShell 使用 `Copy-Item .env.example .env`。`npm run test` 运行核心逻辑测试，`npm run typecheck` 检查类型，`npm run build` 构建网页。源码的账户接口以同源 `/api` 为入口；单独运行 Vite 开发服务器时需要可用的同源后端，或使用已部署的公开站点测试账户功能。

## 高德地图

在[高德开放平台](https://lbs.amap.com/)申请 Web 端（JS API）Key 和安全密钥，并设置合法使用域名。本地 `.env` 填写 `VITE_AMAP_KEY` 与仅用于本地调试的 `VITE_AMAP_SECURITY_JS_CODE`。公开部署将后者留空，在 `VITE_AMAP_SECURITY_SERVICE_HOST` 配置官方支持的安全代理。真实密钥不得进入 Git 或 `VITE_` 公开构建变量。

搜索高德已有地点还需要**另建一把“Web 服务”类型 Key**，配置为部署服务端的 `AMAP_WEB_SERVICE_KEY` 环境变量。Web 端（JS API）Key 调用 Web 服务接口会返回 `USERKEY_PLAT_NOMATCH`（10009）；两种 Key 不能互换。地点搜索经云流服务端调用高德 POI 接口，不把 Web 服务 Key 放进网页或 APK。未配置时，私人地点与记忆的本地搜索仍可使用，界面会明确提示高德搜索尚未配置。只运行本地 Vite 开发服务器时 `/api/place-search` 不存在，可通过已部署站点测试该功能。

应用使用高德 JS API 2.0 标准街道图。点击已有 POI 只打开预览，不写入私人数据；按“收藏地点”后才生成自己的地点和记忆入口。收藏与自创地点可选择符号和六种颜色，地图标记视觉尺寸为 18 CSS 像素。每个收藏地点按收藏时的地图层级设置标记的最小显示层级，缩小至更远时隐藏；自创地点默认比创建时多显示约两级。高德底图没有向应用提供逐个 POI 标签的实时显隐状态，因此这是一种近似匹配；可在“编辑地点”里微调 11–19 级的隐藏阈值。其他位置可通过“标记地点”选点。手机长按仅在选点模式生效。地点坐标按 **GCJ-02** 保存。地图需联网；地图不可用时，可使用“离线记录”先写地点名称和记忆正文，联网后在地图上定位。已保存的地点和记忆仍可从搜索中查看、编辑。

顶部书本按钮打开归档面板，其中“全部地点”集中列出自创与收藏地点，“全部笔记”按事件日期列出记录。点击地点条目或笔记的“查看地点”会定位并打开对应的地图地点。

## 账户、备份与离线

云端账户由服务端保存加盐密码哈希及按账户隔离的记录。本机账户单独存放在当前设备 IndexedDB，密码以 PBKDF2 加盐哈希保存，不能用于另一台设备登录；需要跨设备迁移时导出和导入 JSON。网页和 Android APK 均在本机 IndexedDB 缓存地点和记忆；Android 云端登录令牌先写入应用本地存储，并尽力备份到 Capacitor Preferences；云端请求优先使用 WebView 网络，连接失败时改试 Capacitor 原生 HTTP，两条路径均有超时。离线时可启动已安装的应用并写记录，恢复网络后云端账户自动同步。待定位的离线记忆仅在当前设备保存，完成地图选点后才进入云端同步。退出账户不会清除该设备的本机缓存。请妥善保管密码并定期导出 JSON 备份。

设置面板可导出或恢复完整 JSON。恢复前校验格式、日期、坐标和地点关联，并在数据库事务中写入。登录账户恢复备份后，联网同步会用备份内容替换该账户在服务端的记录；操作前请确认备份正确。账户间不会自动合并。访客模式仍仅保存在当前设备。

## Android APK

离线版介绍见[云流单机版](README-单机版.md)。用 `npm run android:sync:standalone` 同步单机资源，再在 `android/` 中运行 `.\gradlew.bat :app:assembleRelease -PyunflowStandalone`。使用 Android 构建工具对输出的 APK 对齐并签名后即可安装。向联网版构建前请重新执行 `npm run android:sync`。

Android 工程在 `android/`，使用 Capacitor 包装已构建的前端资源。需要 Android SDK、JDK 21 和 Android 构建工具：

```powershell
npm run android:sync
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
cd android
.\gradlew.bat assembleDebug
```

调试 APK 输出到 `android/app/build/outputs/apk/debug/app-debug.apk`，当前版本为 1.7.3（versionCode 11）；工作区另有 `云流-Yunflow-Android-安装包.apk`。公开下载地址为 <https://yunflow-memory-map.thinmerit.chatgpt.site/Yunflow-Android-debug.apk>，可用于个人测试。正式分发需要生成并签署 release APK，并核对高德 Key 对 Android WebView 的合法使用配置。应用资源随 APK 打包，断网可启动并使用本机离线记录；高德底图和跨设备同步仍需网络。账户面板底部有“检查更新”，会比较当前构建号与站点发布版本；APK 发现新版后可打开安装包地址，安装步骤仍由 Android 系统完成。网页发现新版可刷新到新版本。

## iPhone / iPad

用 iPhone 的 Safari 打开 <https://yunflow-memory-map.thinmerit.chatgpt.site>，等待页面加载完成，然后点 Safari 的分享按钮，选择“添加到主屏幕”。主屏幕上的“云流”可像应用一样打开。首次联网打开时，Service Worker 会缓存页面、脚本和样式；之后断网仍可启动、查看本机已有记忆，并用“离线记录”写下新内容。地图底图与账户同步仍需网络。Safari 的网站数据被清除或系统回收时，本机数据可能消失，建议定期导出备份。

仓库另有 `ios/` Capacitor 原生工程源码。生成可安装的 IPA、签名和真机验证需要 macOS、Xcode 与 Apple 开发者签名；当前交付的 iOS 可用版本是主屏幕网页应用，**不是已签名 IPA**。

## 部署与中国大陆网络

前端由 Vite 自行打包，不依赖 Google Fonts、境外图片 CDN 或境外身份认证。当前公开站点和账户 API 托管在同一服务上，**尚未验证中国大陆普通网络对该域名的首次可达性**。iOS 主屏幕应用需要先联网打开网站并完成缓存，之后离线记录不依赖该网络连接。Android 安装包则不需要首次访问网站。若要保障中国大陆首次安装和线上同步，应将前端与账户 API 部署到大陆可访问的 HTTPS 服务，配置合规域名、高德 Key 白名单及安全代理，并按要求办理备案；发布前应在大陆实机网络测试。不得绕过高德接口授权。

## 数据与验证

Dexie schema 当前版本为 3，包含 `places`、`memories`、`settings`、`tombstones`、`drafts`。地点和记忆以稳定 UUID 关联，删除地点会处理关联记忆，同步通过删除记录防止旧设备复活已删除内容。备份格式为 `version: 1`。

已运行核心业务自动化测试、TypeScript 检查、网页生产构建和 Android APK 构建。以 Android WebView 的 `https://localhost` 来源对公开 API 进行了预检、中文账户注册、登录及账户读取测试，均成功；APK 的 v2 签名校验通过。状态栏避让和启动图资源已打包，但真实 OPPO 设备上的显示效果、离线持久化、地图 POI 点击和触控交互仍需安装 APK 后实测。

## 图片、搜索与定位

每条记忆可附最多九张图片，**不重新编码、不降低画质**；原始文件作为独立附件保存在 IndexedDB，单张上限 50 MB。云端账户将图片作为独立文件存入 R2，地点与记忆元数据仍存入 D1，避免大图超过同步请求限制；首次同步原图可能较慢并消耗流量。JSON v2 备份包含原图，文件体积可能很大；旧版 v1 备份仍能导入。部署时 `.openai/hosting.json` 的 R2 绑定名为 `BUCKET`。搜索框同时查私人地点、记忆文字及高德地点；高德搜索需要网络和服务端 Web 服务 Key。启动后会请求定位权限，成功时以蓝点显示当前位置并将地图移到此处；权限被拒绝或定位失败时继续使用上次地图视野。Android 安装包声明粗略与精确定位权限。



