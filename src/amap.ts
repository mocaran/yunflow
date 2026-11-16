import AMapLoader from '@amap/amap-jsapi-loader';

export type AMapApi = any;
export function getMapConfig() {
  if (import.meta.env.MODE === 'standalone') {
    return { key: import.meta.env.YUNFLOW_STANDALONE_AMAP_KEY || '', securityJsCode: '', serviceHost: '' };
  }
  const host = import.meta.env.VITE_AMAP_SECURITY_SERVICE_HOST?.trim().replace(/\/$/,'') || '';
  return { key: import.meta.env.VITE_AMAP_KEY?.trim() || '', securityJsCode: import.meta.env.VITE_AMAP_SECURITY_JS_CODE?.trim() || '', serviceHost: host ? (host.endsWith('/_AMapService') ? host : `${host}/_AMapService`) : '' };
}
let pending: Promise<AMapApi> | null = null;
export function loadAMap() {
  const cfg = getMapConfig();
  if (!cfg.key) return Promise.reject(new Error('尚未配置高德 Web 端 JS API Key'));
  if (import.meta.env.MODE !== 'standalone' && !cfg.securityJsCode && !cfg.serviceHost) return Promise.reject(new Error('尚未配置高德安全密钥或代理地址'));
  const globalWindow = window as Window & { _AMapSecurityConfig?: { securityJsCode?: string; serviceHost?: string } };
  if (cfg.serviceHost) globalWindow._AMapSecurityConfig = { serviceHost: cfg.serviceHost };
  else if (cfg.securityJsCode) globalWindow._AMapSecurityConfig = { securityJsCode: cfg.securityJsCode };
  pending ??= AMapLoader.load({ key: cfg.key, version: '2.0', plugins: ['AMap.Geolocation'] }).catch(error => { pending = null; throw error; });
  return pending;
}
