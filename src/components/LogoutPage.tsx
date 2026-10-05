// 終了（ログアウト）：確認 → 完了（再ログインへ）。
//   終了時にバックアップの有無は尋ねない（バックアップは「各種設定 › データのバックアップ」からすぐ実行でき、年度ごとの自動バックアップも行われる）。
//   プロトタイプでは認証がないため、再ログインはログイン画面へ戻る。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useSession } from '../store/session';

interface Props {
  accent: string;
  onNavigate: (label: string) => void;
  /** セッションを終了してログイン画面へ */
  onLogout: () => void;
}

export function LogoutPage({ accent, onNavigate, onLogout }: Props) {
  const s = useSession();
  const [done, setDone] = useState(false);
  const btn = (primary?: boolean): CSSProperties => ({ padding: '10px 24px', borderRadius: 9, border: primary ? 'none' : '1px solid #cfd8e0', background: primary ? accent : '#fff', color: primary ? '#fff' : '#5b6773', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });

  return (
    <main style={{ flex: 1, minWidth: 0, padding: 28, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div style={{ width: 520, marginTop: 32, background: '#fff', border: '1px solid #dde4ea', borderRadius: 16, boxShadow: '0 6px 26px rgba(30,50,70,.08)', padding: '30px 32px 26px' }}>
        {!done ? (
          <>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 20 }}>システムを終了しますか？</div>
            <p style={{ color: '#7a8794', fontSize: 13, lineHeight: 1.8, margin: '8px 0 6px' }}>入力途中の伝票は保存されません。登録済みのデータはそのまま残ります。</p>
            <div style={{ fontSize: 11.5, color: '#8290a0' }}>{s.divisionPath[0]}　{s.fiscalYear}　{s.division}</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button type="button" onClick={() => onNavigate('ホーム')} style={btn()}>キャンセル（戻る）</button>
              <button type="button" data-logout-go onClick={() => setDone(true)} style={btn(true)}>終了する</button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 14px', background: '#eaf5ef', color: '#1f7a52', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 20 }}>終了しました</div>
            <p style={{ color: '#7a8794', fontSize: 13, lineHeight: 1.8, margin: '10px 0 22px' }}>再度ご利用になる場合はログインしてください。</p>
            <button type="button" onClick={() => { setDone(false); onLogout(); }} style={btn(true)}>ログイン画面へ</button>
          </div>
        )}
      </div>
    </main>
  );
}
