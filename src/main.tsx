import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
if ((window as any).Capacitor?.getPlatform?.() === 'android') document.documentElement.classList.add('native-android');
if ('serviceWorker' in navigator && !(window as any).Capacitor?.isNativePlatform?.()) window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => {}); });
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
