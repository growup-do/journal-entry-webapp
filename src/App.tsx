// 仕訳伝票入力 画面 — Webアプリ プロトタイプ
// 2つのUI案（フォーム型 / スプレッドシート型）をフルスクリーンで切り替えて確認できる。
// 各画面は独立した状態を持つ（採用案の意思決定用）。

import { useState } from 'react';
import { FormScreen } from './components/FormScreen';
import { SheetScreen } from './components/SheetScreen';

type ScreenKey = 'form' | 'sheet';

const TABS: { key: ScreenKey; label: string; hint: string; accent: string }[] = [
  { key: 'form', label: 'フォーム型', hint: '1件ずつ丁寧に入力', accent: '#1f7a52' },
  { key: 'sheet', label: 'スプレッドシート型', hint: '1行で連続入力＋検索', accent: '#2c5f9e' },
];

export default function App() {
  const [screen, setScreen] = useState<ScreenKey>('form');

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
          const on = screen === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setScreen(t.key)}
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

      {screen === 'form' ? <FormScreen /> : <SheetScreen />}
    </>
  );
}
