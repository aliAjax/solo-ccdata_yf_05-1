import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export interface ToastMsg {
  id: number;
  text: string;
  kind: 'ok' | 'info' | 'warn';
}

export function ToastHost({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.kind === 'ok' ? <CheckCircle2 size={15} /> : t.kind === 'warn' ? <AlertTriangle size={15} /> : <Info size={15} />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
