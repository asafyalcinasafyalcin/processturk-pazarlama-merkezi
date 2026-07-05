'use client';

import { useEffect } from 'react';

// Service worker'ı kaydeder (offline kabuk + PWA yüklenebilirlik). Push mimari HAZIR
// ama gerçek abonelik sonraki fazda — burada yalnız register.
export default function PWARegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // Dev'de HMR ile çakışmasın: yalnız production'da veya explicit izinle kaydet.
    if (process.env.NODE_ENV !== 'production') return;
    const onLoad = () => navigator.serviceWorker.register('/sw.js').catch(() => { /* sessiz */ });
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);
  return null;
}
