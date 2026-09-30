// 終了（ログアウト）：終了時のバックアップ選択 → 完了（再ログインへ）。依頼書 2.3「終了」／5.2.1／図19【データのバックアップ】
//   影響のある操作なので、バックアップの有無を選んでから終了する流れにする。プロトタイプでは認証がないため、再ログインはログイン画面へ戻る。

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useSession } from '../store/session';

interface Props {
  accent: string;
  onNavigate: (label: string) => void;
  /** セッションを終了してログイン画面へ */
  onLogout: () => void;
}

type Step = 'choose' | 'backup' | 'done';

export function LogoutPage({ accent, onNavigate, onLogout }: Props) {
  const s = useSession();
  const [step, setStep] = useState<Step>('choose');
  const [choice, setChoice] = useState<'backup' | 'skip'>('backup');
  const [progress, setProgress] = useState(0);
  const [didBackup, setDidBackup] = useState(false);
  useEffect(() => {
    if (step !== 'backup') return;
    const t0 = Date.now();
    const id = window.setInterval(() => {
      const p = Math.min(100, Math.round((Date.now() - t0) / 14));
      setProgress(p);
      if (p >= 100) { window.clearInterval(id); setDidBackup(true); setStep('done'); }
    }, 80);
    return () => window.clearInterval(id);
  }, [step]);

  const btn = (primary?: boolean, color = accent): CSSProperties => ({ padding: '10px 24px', borderRadius: 9, border: primary ? 'none' : '1px solid #cfd8e0', background: primary ? color : '#fff', color: primary ? '#fff' : '#5b6773', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const opt = (on: boolean): CSSProperties => ({ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: '12px 14px', border: '1.5px solid ' + (on ? accent : '#e2e8ee'), background: on ? accent + '0d' : '#fff', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit', width: '100%', color: '#22303c' });
  const go = () => { if (choice === 'backup') { setProgress(0); setStep('backup'); } else { setDidBackup(false); setStep('done'); } };

  return (
    <main style={{ flex: 1, minWidth: 0, padding: 28, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div style={{ width: 520, marginTop: 32, background: '#fff', border: '1px solid #dde4ea', borderRadius: 16, boxShadow: '0 6px 26px rgba(30,50,70,.08)', padding: '30px 32px 26px' }}>
        {step === 'choose' && (
          <>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 20 }}>システムを終了します</div>
            <p style={{ color: '#7a8794', fontSize: 13, lineHeight: 1.8, margin: '8px 0 16px' }}>終了する前に、データのバックアップを取るかどうかを選んでください。入力途中の伝票は保存されません。</p>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8290a0', marginBottom: 6 }}>対象：{s.divisionPath[0]}　{s.fiscalYear}</div>
            <div style={{ display: 'grid', gap: 8 }}>
              <button type="button" onClick={() => setChoice('backup')} style={opt(choice === 'backup')}>
                <input type="radio" readOnly checked={choice === 'backup'} style={{ marginTop: 3 }} />
                <span><span style={{ fontSize: 14, fontWeight: 700 }}>バックアップして終了する（推奨）</span><br /><span style={{ fontSize: 12, color: '#7a8794' }}>保存先：サーバーのバックアップ領域（{s.divisionPath[0]}）。保存先は「各種設定 › データのバックアップ」で変更できます。</span></span>
              </button>
              <button type="button" onClick={() => setChoice('skip')} style={opt(choice === 'skip')}>
                <input type="radio" readOnly checked={choice === 'skip'} style={{ marginTop: 3 }} />
                <span><span style={{ fontSize: 14, fontWeight: 700 }}>バックアップせずに終了する</span><br /><span style={{ fontSize: 12, color: '#b7791f' }}>前回のバックアップ：令和8年9月28日 17:42。それ以降の入力は復元できなくなります。</span></span>
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" onClick={() => onNavigate('ホーム')} style={btn()}>キャンセル（戻る）</button>
              <button type="button" onClick={go} style={btn(true, choice === 'backup' ? accent : '#c0392b')}>{choice === 'backup' ? 'バックアップして終了' : '終了する'}</button>
            </div>
          </>
        )}
        {step === 'backup' && (
          <>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 20 }}>バックアップしています…</div>
            <p style={{ color: '#7a8794', fontSize: 13, margin: '8px 0 16px' }}>完了するまで画面を閉じないでください。</p>
            <div style={{ height: 10, background: '#eef2f5', borderRadius: 5, overflow: 'hidden' }}><div style={{ width: `${progress}%`, height: '100%', background: accent, transition: 'width .08s' }} /></div>
            <div style={{ fontSize: 12, color: '#7a8794', marginTop: 8, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{progress}%</div>
          </>
        )}
        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 14px', background: '#eaf5ef', color: '#1f7a52', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 20 }}>終了しました</div>
            <p style={{ color: '#7a8794', fontSize: 13, lineHeight: 1.8, margin: '10px 0 22px' }}>{didBackup ? 'バックアップを保存しました。' : 'バックアップは行っていません。'}<br />再度ご利用になる場合はログインしてください。</p>
            <button type="button" onClick={() => { setStep('choose'); onLogout(); }} style={btn(true)}>ログイン画面へ</button>
          </div>
        )}
      </div>
    </main>
  );
}
