import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = { appId: 'com.yunflow.memory', appName: 'YunFlow', webDir: 'dist', android: { allowMixedContent: false }, plugins: { SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover', style: 'DARK' } } };
export default config;
