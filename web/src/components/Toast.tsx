import type { Toast as ToastType } from '../hooks/useToast';

interface Props {
  toasts: ToastType[];
}

export default function Toast({ toasts }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} className="toast">{t.message}</div>
      ))}
    </div>
  );
}
