// 仕訳伝票入力 画面 — Webアプリ プロトタイプ
// 2つのUI案（フォーム型 / スプレッドシート型）をフルスクリーンで切り替えて確認できる。
// メニューから画面（単一入力 / 伝票入力）を切り替え。各画面は独立した状態を持つ。
// ヘッダーの「照会」（元帳１／元帳２／残高照合）は通常の画面として開く。
// 右下の「確認メモ」でクライアントとの確認事項を画面上に貼れる（Firestore で共有）。

import { useState } from 'react';
import { FormScreen } from './components/FormScreen';
import { SheetScreen } from './components/SheetScreen';
import { MemoLayer } from './memo/MemoLayer';
import { SettlementAuditModal } from './components/SettlementAuditModal';
import { JournalCountModal } from './components/JournalCountModal';
import { CorporatePrintModal } from './components/CorporatePrintModal';
import type { JournalYear } from './components/HeaderTools';
import { DEFAULT_MENU } from './data';
import { LoginPage } from './components/LoginPage';
import { FeatureListPage } from './components/FeatureListPage';
import { LegalPage } from './components/LegalPage';

type Mode = 'form' | 'sheet';
/** ページ遷移ではなくモーダルで開くメニュー */
const MODAL_MENU = ['決算調査', '法人調査', '仕訳数', '法人印刷'];

/** 機能一覧（サイトマップ）からの「画面を開く」：?open=画面名&mode=form|sheet&year=prev
 *  読み込み時に1回だけ解釈し、URLは元に戻す（再描画で消えないようモジュール初期化時に処理） */
const BOOT = (() => {
  const p = new URLSearchParams(window.location.search);
  const open = p.get('open');
  if (!open) return null;
  const mode: Mode | null = p.get('mode') === 'sheet' ? 'sheet' : p.get('mode') === 'form' ? 'form' : null;
  try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ }
  return { open, mode, year: p.get('year') === 'prev' };
})();

const readSaved = (k: string) => { try { return sessionStorage.getItem(k) ?? ''; } catch { return ''; } };
const save = (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } };

const TABS: { key: Mode; label: string; hint: string; accent: string }[] = [
  { key: 'form', label: 'フォーム型', hint: '1件ずつ丁寧に入力', accent: '#1f7a52' },
  { key: 'sheet', label: 'スプレッドシート型', hint: '1行で連続入力＋検索', accent: '#2c5f9e' },
];

export default function App() {
  // 静的ページ（フッターから同じタブで開く）：機能一覧／利用規約／個人情報保護方針
  const params = new URLSearchParams(window.location.search);
  const staticPage = params.get('page');
  if (staticPage === 'features') return <FeatureListPage />;
  if (staticPage === 'terms') return <LegalPage />;
  const boot = BOOT;
  const bootPage = boot && boot.open !== 'ログイン' && !MODAL_MENU.includes(boot.open) ? boot.open : null;
  // ログイン状態（プロトタイプ：タブを閉じるまで保持）
  const [loggedIn, setLoggedIn] = useState<boolean>(() => {
    if (boot?.open === 'ログイン') {
      try { sessionStorage.removeItem('proto-logged-in'); } catch { /* ignore */ }
      return false;
    }
    if (boot) {
      // サイトマップから開いたときは、ログイン画面を挟まずに該当画面へ
      try { sessionStorage.setItem('proto-logged-in', '1'); } catch { /* ignore */ }
      return true;
    }
    try {
      return sessionStorage.getItem('proto-logged-in') === '1';
    } catch {
      return false;
    }
  });
  const login = () => {
    try { sessionStorage.setItem('proto-logged-in', '1'); } catch { /* ignore */ }
    setLoggedIn(true);
    setPage(DEFAULT_MENU);
  };
  const logout = () => {
    try { sessionStorage.removeItem('proto-logged-in'); } catch { /* ignore */ }
    setLoggedIn(false);
  };
  // 表示中のUI案・画面は sessionStorage に保持（静的ページから戻ったときに元の画面へ復帰）
  const [mode, setModeRaw] = useState<Mode>(() => (boot?.mode ?? (readSaved('proto-mode') === 'sheet' ? 'sheet' : 'form')) as Mode);
  const [page, setPageRaw] = useState<string>(() => bootPage ?? (readSaved('proto-page') || DEFAULT_MENU));
  const setMode = (m: Mode) => { setModeRaw(m); save('proto-mode', m); };
  const setPage = (p: string) => { setPageRaw(p); save('proto-page', p); };
  const [auditOpen, setAuditOpen] = useState(boot?.open === '決算調査' || boot?.open === '法人調査');
  const [countOpen, setCountOpen] = useState(boot?.open === '仕訳数');
  const [corpPrintOpen, setCorpPrintOpen] = useState(boot?.open === '法人印刷');
  // 仕訳の年（当年／前年）はアプリ全体で共有
  const [year, setYear] = useState<JournalYear>(boot?.year ? 'prev' : 'current');
  const screenKey = `${mode}:${page}`;

  // メニュー選択：決算調査はページ遷移ではなくモーダルで開く（既存システムと同じ）
  const selectMenu = (label: string) => {
    // 法人調査は決算調査と同じ内容（右上ボタンの要否は確認メモで確認中）
    if (label === '決算調査' || label === '法人調査') setAuditOpen(true);
    else if (label === '仕訳数') setCountOpen(true);
    else if (label === '法人印刷') setCorpPrintOpen(true);
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

  if (!loggedIn) {
    return (
      <>
        <LoginPage onLogin={login} />
        <MemoLayer screenKey="login" screenLabel={(k) => (k === 'login' ? 'ログイン画面' : screenLabel(k))} onNavigate={navigateTo} />
      </>
    );
  }

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

      <div>
        {mode === 'form' ? (
          <FormScreen page={page} onNavigate={selectMenu} year={year} onYear={setYear} onLogout={logout} />
        ) : (
          <SheetScreen page={page} onNavigate={selectMenu} year={year} onYear={setYear} onLogout={logout} />
        )}
      </div>
      <CorporatePrintModal open={corpPrintOpen} onClose={() => setCorpPrintOpen(false)} />

      <SettlementAuditModal open={auditOpen} onClose={() => setAuditOpen(false)} />
      <JournalCountModal open={countOpen} onClose={() => setCountOpen(false)} />

      <MemoLayer screenKey={screenKey} screenLabel={screenLabel} onNavigate={navigateTo} />
    </>
  );
}
