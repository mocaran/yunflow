import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  if (mode !== 'standalone') return { plugins: [react()] };

  const production = loadEnv('production', process.cwd(), 'VITE_AMAP_KEY');
  const standalone = loadEnv(mode, process.cwd(), 'YUNFLOW_STANDALONE_AMAP_KEY');
  const mapKey = (standalone.YUNFLOW_STANDALONE_AMAP_KEY || production.VITE_AMAP_KEY || '').trim();
  if (!mapKey) throw new Error('请配置本地存储版的高德 Web 端 Key（YUNFLOW_STANDALONE_AMAP_KEY）');

  return {
    plugins: [react()],
    envPrefix: 'YUNFLOW_STANDALONE_PUBLIC_',
    define: { 'import.meta.env.YUNFLOW_STANDALONE_AMAP_KEY': JSON.stringify(mapKey) },
  };
});
