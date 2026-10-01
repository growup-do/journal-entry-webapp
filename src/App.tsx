// 仕訳伝票入力 画面 — Webアプリ プロトタイプ
// 2つのUI案（フォーム型 / スプレッドシート型）をフルスクリーンで切り替えて確認できる。
// メニューから画面（単一入力 / 伝票入力）を切り替え。各画面は独立した状態を持つ。
// ヘッダーの「照会」（元帳１／元帳２／残高照合）は通常の画面として開く。
// 右下の「確認メモ」でクライアントとの確認事項を画面上に貼れる（Firestore で共有）。

import { useState } from 'react';
import { FormScreen } from './components/FormScreen';
import { MemoLayer } from './memo/MemoLayer';
import { getSession, setSession, useSession } from './store/session';
import { SettlementAuditModal } from './components/SettlementAuditModal';
import { JournalCountModal } from './components/JournalCountModal';
import { CorporatePrintModal } from './components/CorporatePrintModal';
import type { JournalYear } from './components/HeaderTools';
import { DEFAULT_MENU } from './data';
import { LoginPage } from './components/LoginPage';
import { FeatureListPage } from './components/FeatureListPage';
import { LegalPage } from './components/LegalPage';
import { FlowMapPage } from './components/FlowMapPage';

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
  if (staticPage === 'flow') return <FlowMapPage />;
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
  // モーダル（決算調査／仕訳数／法人印刷）を開いている間は、確認メモをそのモーダルの画面として扱う
  const screenKey = auditOpen ? `${mode}:決算調査` : countOpen ? `${mode}:仕訳数` : corpPrintOpen ? `${mode}:法人印刷` : `${mode}:${page}`;

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
    if (!p) return;
    if (p === '決算調査') setAuditOpen(true);
    else if (p === '仕訳数') setCountOpen(true);
    else if (p === '法人印刷') setCorpPrintOpen(true);
    else setPage(p);
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
      <RoleSwitchBar />
      <CorporatePrintModal open={corpPrintOpen} onClose={() => setCorpPrintOpen(false)} />

      <SettlementAuditModal open={auditOpen} onClose={() => setAuditOpen(false)} onNavigate={(p) => { setAuditOpen(false); setPage(p); }} />
      <JournalCountModal open={countOpen} onClose={() => setCountOpen(false)} />

      <MemoLayer screenKey={screenKey} screenLabel={screenLabel} onNavigate={navigateTo} />
    </>
  );
}

/** プロトタイプ用：権限の切替バー（画面下中央）。参照のみ権限のときの見え方（訂正・削除・入換の無効表示）を確認するための仕掛けで、本番の画面要素ではない */
function RoleSwitchBar() {
  const s = useSession();
  const ROLES: { key: typeof s.role; label: string; hint: string; accent: string }[] = [
    { key: '入力可', label: '入力権限', hint: '伝票の入力・訂正・削除ができる', accent: '#1f7a52' },
    { key: '参照のみ', label: '参照のみ権限', hint: '閲覧のみ（訂正・削除・入換は無効表示）', accent: '#b7791f' },
  ];
  return (
    <div title="プロトタイプ用：利用者権限の表示確認" style={{ position: 'fixed', left: '50%', bottom: 18, transform: 'translateX(-50%)', zIndex: 200, display: 'flex', alignItems: 'center', gap: 4, padding: 4, background: '#fff', border: '1px solid #dde4ea', borderRadius: 12, boxShadow: '0 6px 22px rgba(30,50,70,.16)' }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8290a0', padding: '0 6px 0 8px', letterSpacing: '.03em' }}>権限の表示確認</span>
      {ROLES.map((r) => {
        const on = s.role === r.key;
        return (
          <button key={r.key} type="button" onClick={() => setSession({ role: r.key })} title={r.hint} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '7px 16px', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', background: on ? r.accent : 'transparent', color: on ? '#fff' : '#5b6773', transition: 'background .12s, color .12s' }}>
            <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{r.label}</span>
            <span style={{ fontSize: 10.5, opacity: on ? 0.85 : 0.7 }}>{r.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
