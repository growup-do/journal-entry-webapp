// 仕訳伝票入力 画面 — Webアプリ プロトタイプ
// 2つのUI案（フォーム型 / スプレッドシート型）をフルスクリーンで切り替えて確認できる。
// メニューから画面（単一入力 / 伝票入力）を切り替え。各画面は独立した状態を持つ。
// ヘッダーの「照会」（元帳１／元帳２／残高照合）は通常の画面として開く。
// 右下の「確認メモ」でクライアントとの確認事項を画面上に貼れる（Firestore で共有）。

import { useState } from 'react';
import { FormScreen } from './components/FormScreen';
import { MemoLayer } from './memo/MemoLayer';
import { getSession } from './store/session';
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

/** 機能一覧（サイトマップ）からの「画面を開く」：?open=画面名&year=prev（mode は互換のため無視）
 *  読み込み時に1回だけ解釈し、URLは元に戻す（再描画で消えないようモジュール初期化時に処理） */
const BOOT = (() => {
  const p = new URLSearchParams(window.location.search);
  const open = p.get('open');
  if (!open) return null;
  try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ }
  return { open, year: p.get('year') === 'prev' };
})();

const readSaved = (k: string) => { try { return sessionStorage.getItem(k) ?? ''; } catch { return ''; } };
const save = (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } };

/** 静的ページ（機能一覧）のメモ画面キー。アプリ内から遷移するときは ?page=features を開く */
const FEATURES_KEY = 'static:features';
const labelOf = (key: string) => {
  if (key === 'login') return 'ログイン画面';
  if (key === FEATURES_KEY) return '機能一覧（サイトマップ）';
  const p = key.split(':')[1];
  return p ?? key;
};

export default function App() {
  // 静的ページ（フッターから同じタブで開く）：機能一覧／利用規約／個人情報保護方針
  const params = new URLSearchParams(window.location.search);
  const staticPage = params.get('page');
  if (staticPage === 'features') {
    return (
      <>
        <FeatureListPage />
        <MemoLayer screenKey={FEATURES_KEY} screenLabel={labelOf} onNavigate={(key) => { if (key === FEATURES_KEY) return; const [m, pg] = key.split(':'); window.location.href = key === 'login' ? '?open=ログイン' : `?open=${encodeURIComponent(pg ?? '')}&mode=${m}`; }} />
      </>
    );
  }
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
    // 起動時は区分・年度の選択を先に表示し、その後は設定された初期画面（ホーム／伝票入力）へ
    try { sessionStorage.setItem('proto-pick-division', '1'); } catch { /* ignore */ }
    setLoggedIn(true);
    setPage(getSession().startScreen ?? DEFAULT_MENU);
  };
  const logout = () => {
    try { sessionStorage.removeItem('proto-logged-in'); } catch { /* ignore */ }
    setLoggedIn(false);
  };
  // 表示中のUI案・画面は sessionStorage に保持（静的ページから戻ったときに元の画面へ復帰）
  // 画面構成はフォーム型のみ（スプレッドシート型の案は廃止。メモの画面キーは互換のため 'form:' を維持）
  const mode: Mode = 'form';
  const [page, setPageRaw] = useState<string>(() => bootPage ?? (readSaved('proto-page') || DEFAULT_MENU));
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

  const screenLabel = labelOf;
  const navigateTo = (key: string) => {
    if (key === FEATURES_KEY) { window.location.href = '?page=features'; return; }
    const p = key.split(':')[1];
    if (p) setPage(p);
  };

  if (!loggedIn) {
    return (
      <>
        <LoginPage onLogin={login} />
        <MemoLayer screenKey="login" screenLabel={screenLabel} onNavigate={navigateTo} />
      </>
    );
  }

  return (
    <>
      <FormScreen page={page} onNavigate={selectMenu} year={year} onYear={setYear} onLogout={logout} />
      <CorporatePrintModal open={corpPrintOpen} onClose={() => setCorpPrintOpen(false)} />

      <SettlementAuditModal open={auditOpen} onClose={() => setAuditOpen(false)} onNavigate={(p) => { setAuditOpen(false); setPage(p); }} />
      <JournalCountModal open={countOpen} onClose={() => setCountOpen(false)} />

      <MemoLayer screenKey={screenKey} screenLabel={screenLabel} onNavigate={navigateTo} />
    </>
  );
}
