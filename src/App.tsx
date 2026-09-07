// 仕訳伝票入力 画面 — Webアプリ プロトタイプ
// 2つのUI案（フォーム型 / スプレッドシート型）をフルスクリーンで切り替えて確認できる。
// メニューから画面（単一入力 / 伝票入力）を切り替え。各画面は独立した状態を持つ。
// 右下の「確認メモ」でクライアントとの確認事項を画面上に貼れる（Firestore で共有）。

import { useState } from 'react';
import { FormScreen } from './components/FormScreen';
import { SheetScreen } from './components/SheetScreen';
import { MemoLayer } from './memo/MemoLayer';
import { SettlementAuditModal } from './components/SettlementAuditModal';
import { JournalCountModal } from './components/JournalCountModal';
import { DEFAULT_MENU } from './data';

type Mode = 'form' | 'sheet';

const TABS: { key: Mode; label: string; hint: string; accent: string }[] = [
  { key: 'form', label: 'フォーム型', hint: '1件ずつ丁寧に入力', accent: '#1f7a52' },
  { key: 'sheet', label: 'スプレッドシート型', hint: '1行で連続入力＋検索', accent: '#2c5f9e' },
];

export default function App() {
  const [mode, setMode] = useState<Mode>('form');
  const [page, setPage] = useState<string>(DEFAULT_MENU);
  const [auditOpen, setAuditOpen] = useState(false);
  const [countOpen, setCountOpen] = useState(false);
  const screenKey = `${mode}:${page}`;

  // メニュー選択：決算調査はページ遷移ではなくモーダルで開く（既存システムと同じ）
  const selectMenu = (label: string) => {
    if (label === '決算調査') setAuditOpen(true);
    else if (label === '仕訳数') setCountOpen(true);
    else setPage(label);
  };

  const screenLabel = (key: string) => {
    const [m, p] = key.split(':');
    return `${TABS.find((t) => t.key === m)?.label ?? m}／${p ?? ''}`;
  };
  const navigateTo = (key: string) => {
    const [m, p] = key.split(':');
    if (m === 'form' || m === 'sheet') setMode(m);
    if (p) setPage(p);
  };

  return (
    <>
      {/* 画面切替バー（プロトタイプ比較用。本番では単一画面に置換） */}
      <div
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 18,
          transform: 'translateX(-50%)',
          zIndex: 200,
          display: 'flex',
          gap: 4,
          padding: 4,
          background: '#fff',
          border: '1px solid #dde4ea',
          borderRadius: 12,
          boxShadow: '0 6px 22px rgba(30,50,70,.16)',
        }}
      >
        {TABS.map((t) => {
          const on = mode === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setMode(t.key)}
              title={t.hint}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 1,
                padding: '7px 16px',
                border: 'none',
                borderRadius: 9,
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: on ? t.accent : 'transparent',
                color: on ? '#fff' : '#5b6773',
                transition: 'background .12s, color .12s',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{t.label}</span>
              <span style={{ fontSize: 10.5, opacity: on ? 0.85 : 0.7 }}>{t.hint}</span>
            </button>
          );
        })}
      </div>

      {mode === 'form' ? <FormScreen page={page} onNavigate={selectMenu} /> : <SheetScreen page={page} onNavigate={selectMenu} />}

      <SettlementAuditModal open={auditOpen} onClose={() => setAuditOpen(false)} />
      <JournalCountModal open={countOpen} onClose={() => setCountOpen(false)} />

      <MemoLayer screenKey={screenKey} screenLabel={screenLabel} onNavigate={navigateTo} />
    </>
  );
}
