# 云流 Yunflow · 本地存储版

在高德地图上选点、收藏地点，按日期记录文字和照片。地点、记忆和本机账户存储在设备上，可通过 JSON 备份迁移。

底图直接从高德加载，需要连接 Wi‑Fi 或移动数据。搜索框可搜索本机地点和记忆。断网时仍可查看、编辑记录和新建地点。

适用于 Android 7.0 及以上。若已安装云流单机版 1.7.1，可直接覆盖安装并保留记录。

**[下载 Android APK](https://github.com/mocaran/yunflow/releases/latest)**

## 技术栈

React + TypeScript + Vite；地图用高德 JS API（`@amap/amap-jsapi-loader`）；本地数据用 Dexie（IndexedDB）；用 Capacitor 打包成 Android 应用（WebView 套壳，原生侧只负责定位与文件）。

## 源码结构

| 路径 | 说明 |
| --- | --- |
| `src/` | 应用源码（React 组件、数据层、地图与记忆逻辑） |
| `public/` | 静态资源 |
| `android/` | Capacitor 生成的 Android 工程（`com.yunflow.memory.standalone`） |
| `ios/` | Capacitor 生成的 iOS 工程 |
| `scripts/` | 构建脚本（PWA 构建、Android 资源裁剪） |
| `DEVELOPMENT.md` | 开发说明（原 README） |

## 从源码构建

```bash
npm install
npm run dev           # 浏览器里调试
npm run build         # 构建 Web 产物
npm run android:sync  # 构建并同步进 android/（单机版：npm run android:sync:standalone）
cd android && gradlew assembleRelease
```

地图需要高德 key：把 `.env.example` 复制成 `.env`，填好 `VITE_AMAP_KEY` 与 `VITE_AMAP_SECURITY_JS_CODE`。`.env` 已被 `.gitignore` 忽略，不会进仓库。

> 提示：Web 端高德 key 一定会被打进 APK，任何人都能从安装包里提取。建议在高德控制台为该 key 配置来源白名单并定期轮换。

## License

本项目以 [MIT](LICENSE) 许可发布。
