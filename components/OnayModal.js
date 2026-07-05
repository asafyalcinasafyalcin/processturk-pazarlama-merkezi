'use client';

import { useState, useCallback } from 'react';

/**
 * Marka-uyumlu (native confirm DEĞİL) para-harcatan işlem onay modalı.
 * Kredi/maliyet + seçili tier'ı gösterir; kullanıcı bilinçli onaylar (para güvenliği).
 *
 * Kullanım:
 *   const [onayModal, onayIste] = useOnayModal();
 *   ...
 *   const ok = await onayIste({
 *     baslik: 'Görsel üret', mesaj: '...',
 *     tier: 'Premium', kredi: 0.03, maliyet: '~$0.05', onayLabel: 'Üret (kredi yakar)',
 *   });
 *   if (!ok) return;
 *   ...
 *   return (<>{onayModal} ...</>);
 */
export function useOnayModal() {
  const [state, setState] = useState(null); // { ...opts, resolve } | null

  const onayIste = useCallback((opts) => new Promise((resolve) => {
    setState({ ...opts, resolve });
  }), []);

  const kapat = useCallback((sonuc) => {
    setState((s) => { s?.resolve?.(sonuc); return null; });
  }, []);

  const modal = state ? (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]"
      onClick={() => kapat(false)}
      role="dialog" aria-modal="true"
    >
      <div className="card p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-3">
          <span className="pill pill-amber shrink-0 mt-0.5">Kredi</span>
          <h2 className="font-head font-bold text-lg leading-snug">{state.baslik || 'Onay gerekiyor'}</h2>
        </div>

        {state.mesaj && (
          <p className="text-sm text-slate-600 whitespace-pre-line mb-4">{state.mesaj}</p>
        )}

        {/* Tier + kredi/maliyet özeti — bilinçli para kararı */}
        {(state.tier || state.kredi != null || state.maliyet) && (
          <div className="rounded-xl border border-line bg-slate-50 p-3 text-sm mb-4 space-y-1">
            {state.tier && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Kalite</span>
                <span className="font-semibold">{state.tier}</span>
              </div>
            )}
            {state.kredi != null && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Kalan kredi</span>
                <span className="num font-semibold">{state.kredi}</span>
              </div>
            )}
            {state.maliyet && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tahmini maliyet</span>
                <span className="num font-semibold text-amber">{state.maliyet}</span>
              </div>
            )}
          </div>
        )}

        {state.ipucu && <p className="text-[11px] text-slate-500 mb-4">{state.ipucu}</p>}

        <div className="flex items-center justify-end gap-2 flex-wrap">
          <button className="btn btn-ghost text-sm" onClick={() => kapat(false)}>Vazgeç</button>
          <button className="btn btn-primary text-sm" onClick={() => kapat(true)} autoFocus>
            {state.onayLabel || 'Onayla'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return [modal, onayIste];
}
