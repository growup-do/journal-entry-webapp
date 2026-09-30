// オプション連携機能の入口（依頼書 5.1.4）
//   OptionGate … 導入済みならオプション画面を表示、未導入なら導入のご案内を表示する。
//   本体との行き来が分かるよう、オプション画面の上部に「本体の機能ではなく別売オプション」であることと戻り導線を示す。

import type { ReactNode } from 'react';
import { SUPPORT_URL } from './SettingsMenu';
import { btn } from './ui';
import { displayName } from '../data';
import { useSession } from '../store/session';

const GUIDE: Record<string, { lead: string; points: string[] }> = {
  小口現金: { lead: '小口現金の入出金を出納帳形式で記帳し、集計して会計へ連動します。', points: ['出納帳形式での記帳', '科目別の集計', '会計への連動'] },
  減価償却: { lead: '固定資産の登録から減価償却費の計算、決算伝票の作成までを行います。', points: ['固定資産・備品の台帳', '償却計算と決算伝票', '明細書・管理台帳の印刷'] },
  預金出納: { lead: '預金口座ごとの入出金を記帳し、通帳残高と照合します。', points: ['口座ごとの出納帳', '銀行データの取込', '通帳残高との照合'] },
  収入支出: { lead: '収入・支出の伺い書（調書）を作成し、決裁後に伝票へ連動します。', points: ['収入調書・支出調書の作成', '決裁欄の印刷', '伝票への連動'] },
  電子印: { lead: '伺い書や伝票に電子印を押印し、承認の流れを画面上で完結します。', points: ['承認者ごとの電子印', '押印履歴の確認', '伺い書との連携'] },
};

/** 導入済みオプションの画面上部に出す帯（本体機能と区別し、戻り導線を示す） */
export function OptionBar({ label, accent, onNavigate }: { label: string; accent: string; onNavigate: (l: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 28px', background: '#fbf7ee', borderBottom: '1px solid #efe3c8', fontSize: 12, color: '#7a6a3a' }}>
      <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 8, background: '#f4e3b5', color: '#8a6d00' }}>別売オプション</span>
      <span><b>{displayName(label)}</b> は会計本体とは別のオプション機能です。</span>
      <button type="button" className="btn-outline" onClick={() => onNavigate('伝票入力')} style={{ ...btn(accent, false, true), marginLeft: 'auto' }}>← 会計本体（伝票入力）へ戻る</button>
    </div>
  );
}

export function OptionGate({ label, accent, onNavigate, children }: { label: string; accent: string; onNavigate: (l: string) => void; children: ReactNode }) {
  const s = useSession();
  if (s.options[label]) return <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}><OptionBar label={label} accent={accent} onNavigate={onNavigate} />{children}</div>;
  const g = GUIDE[label] ?? { lead: '', points: [] };
  return (
    <main style={{ flex: 1, minWidth: 0, padding: 28, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div style={{ width: 560, marginTop: 24, background: '#fff', border: '1px solid #dde4ea', borderRadius: 16, boxShadow: '0 6px 26px rgba(30,50,70,.07)', padding: '28px 32px' }}>
        <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 10, background: '#fff7e6', color: '#b7791f' }}>未導入のオプション</span>
        <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 22, marginTop: 12 }}>{displayName(label)}</div>
        <p style={{ color: '#5b6773', fontSize: 13.5, lineHeight: 1.9, margin: '8px 0 14px' }}>{g.lead}</p>
        <ul style={{ margin: 0, paddingLeft: 20, color: '#48565f', fontSize: 13, lineHeight: 2 }}>{g.points.map((p) => <li key={p}>{p}</li>)}</ul>
        <div style={{ marginTop: 18, padding: '12px 14px', background: '#f6f8fa', borderRadius: 10, fontSize: 12.5, color: '#5b6773', lineHeight: 1.8 }}>このオプションはご契約いただくと利用できます。導入のご相談はサポートサイト、または担当者までお問い合わせください。</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button type="button" className="submit-btn" onClick={() => window.open(SUPPORT_URL, '_blank', 'noopener')} style={btn(accent, true)}>導入について問い合わせる ↗</button>
          <button type="button" onClick={() => onNavigate('ホーム')} style={btn()}>ホームへ戻る</button>
        </div>
      </div>
    </main>
  );
}
