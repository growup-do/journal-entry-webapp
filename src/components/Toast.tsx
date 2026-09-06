// 画面下部の一時メッセージ（プロトタイプで未実装の操作の案内などに使用）

import { useCallback, useRef, useState } from 'react';

export function useToast() {
  const [msg, setMsg] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(''), 2400);
  }, []);
  return { msg, show };
}

export const NOT_IMPL = 'この操作はプロトタイプでは動作しません（本番で実装）';

export function ToastView({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 84,
        transform: 'translateX(-50%)',
        zIndex: 270,
        background: '#22303c',
        color: '#fff',
        padding: '9px 16px',
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 600,
        boxShadow: '0 8px 24px rgba(0,0,0,.25)',
        whiteSpace: 'nowrap',
      }}
    >
      {msg}
    </div>
  );
}
