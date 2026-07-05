'use client';

// Ürün üretim akışını üst bantta gösteren aşama çubuğu (stepper).
// Her aşama: done (✓ yeşil) / active (● kırmızı) / pending (○ gri).
// Tıklanınca ilgili sekmeye geçer; son aşama (Yayın) takvime götürür.

export default function WorkflowBar({ steps, activeId, onStep }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((s, i) => {
          const isActive = s.id === activeId;
          const state = s.done ? 'done' : isActive ? 'active' : 'pending';
          const circle =
            state === 'done' ? 'bg-ok/15 border-ok text-ok'
            : state === 'active' ? 'bg-red border-red text-white'
            : 'bg-white border-slate-300 text-slate-500';
          const labelCls =
            state === 'done' ? 'text-ok'
            : state === 'active' ? 'text-navy font-semibold'
            : 'text-slate-500';
          return (
            <div key={s.id} className="flex items-center shrink-0">
              <button onClick={() => onStep(s)} className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-slate-50 transition" title={s.hint || s.label}>
                <span className={`h-6 w-6 rounded-full border flex items-center justify-center text-xs ${circle}`}>
                  {s.done ? '✓' : i + 1}
                </span>
                <span className={`text-xs whitespace-nowrap ${labelCls}`}>{s.label}</span>
              </button>
              {i < steps.length - 1 && (
                <span className={`mx-0.5 text-sm ${steps[i].done ? 'text-ok/50' : 'text-slate-300'}`}>→</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
