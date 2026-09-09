// ログアウト：確認 → 完了（再ログインへ）。プロトタイプでは認証がないため、再ログインはホームへ戻る。

import { useState } from 'react';
import type { CSSProperties } from 'react';

interface Props {
  accent: string;
  onNavigate: (label: string) => void;
}

export function LogoutPage({ accent, onNavigate }: Props) {
  const [done, setDone] = useState(false);
  const btn = (primary?: boolean): CSSProperties => ({ padding: '10px 24px', borderRadius: 9, border: primary ? 'none' : '1px solid #cfd8e0', background: primary ? accent : '#fff', color: primary ? '#fff' : '#5b6773', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  return (
    <main style={{ flex: 1, minWidth: 0, padding: 28, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div style={{ width: 460, marginTop: 40, background: '#fff', border: '1px solid #dde4ea', borderRadius: 16, boxShadow: '0 6px 26px rgba(30,50,70,.08)', padding: '32px 32px 28px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 14px', background: done ? '#eaf5ef' : '#f4f6f8', color: done ? '#1f7a52' : '#5b6773', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {done ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M13 4h6v16h-6" /></svg>
          )}
        </div>
        {done ? (
          <>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 20 }}>ログアウトしました</div>
            <p style={{ color: '#7a8794', fontSize: 13, lineHeight: 1.8, margin: '10px 0 22px' }}>ご利用ありがとうございました。<br />再度ご利用になる場合はログインしてください。</p>
            <button type="button" onClick={() => { setDone(false); onNavigate('ホーム'); }} style={btn(true)}>ログイン画面へ</button>
            <div style={{ fontSize: 11, color: '#9aa5b1', marginTop: 12 }}>※ プロトタイプではログイン機能がないため、ホームに戻ります</div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 20 }}>ログアウトしますか？</div>
            <p style={{ color: '#7a8794', fontSize: 13, lineHeight: 1.8, margin: '10px 0 22px' }}>入力途中の伝票は保存されません。<br />保存してからログアウトしてください。</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button type="button" onClick={() => onNavigate('ホーム')} style={btn()}>キャンセル</button>
              <button type="button" onClick={() => setDone(true)} style={{ ...btn(true), background: '#c0392b' }}>ログアウト</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
