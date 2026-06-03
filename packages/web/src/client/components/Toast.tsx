import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastType = 'error' | 'success' | 'info';

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastApi = {
  /** エラートーストを表示する（操作はブロックしない） */
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 3500;

const TYPE_CLASS: Record<ToastType, string> = {
  error: 'bg-red-600 text-white',
  success: 'bg-emerald-600 text-white',
  info: 'bg-slate-800 text-white dark:bg-slate-700',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => remove(id), AUTO_DISMISS_MS);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      error: (m) => push('error', m),
      success: (m) => push('success', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* コンテナは pointer-events:none で操作を一切ブロックしない。FAB（bottom:1.5rem, 高さ3.5rem）の上に重ねる。 */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: '6rem',
          zIndex: 60,
          pointerEvents: 'none',
        }}
        className="flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            onClick={() => remove(t.id)}
            style={{ pointerEvents: 'auto' }}
            className={`max-w-sm w-fit rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg cursor-pointer ${TYPE_CLASS[t.type]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
