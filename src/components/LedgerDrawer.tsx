// 元帳パネル（試算表・決算書・推移表からのドリルダウン。依頼書 5.4.1／7章1）
//   科目（月）の行を押すと、画面遷移せずに右側へ元帳を出す。押した行と残高を見たまま内訳を確認でき、別の行を押すと差し替わる。
//   長い期間の確認や印刷は「元帳の画面で開く」で全画面の元帳へ（そちらには「← 戻る」がある）。
//   幅が足りないとき（WIDE_NARROW 未満）は本文に重ねて表示する。

import { useEffect, useState } from 'react';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { ComboField, EntryStyles, scopeStyle } from './EntryCommon';
import { EditVoucherModal } from './VoucherEdit';
import { LedgerTable, WIDE_NARROW, WIDE_TAB_SPACE, ledgerLines } from './WidePanel';
import { displayName } from '../data';
import { useVouchers, type Voucher } from '../store/journalStore';
import { canEdit, setSession, useSession } from '../store/session';
import type { MonthFilter } from '../types';

export type LedgerKind = 'account' | 'fund' | 'vendor';
export interface LedgerDrawerTarget { account: string; month: MonthFilter; kind: LedgerKind; /** 呼び出し元の画面キー（全画面の元帳の「← 戻る」に使う） */ from: string }
export const LEDGER_DRAWER_WIDTH = 600;
const LEDGER_PAGE: Record<LedgerKind, string> = { account: '勘定元帳', fund: '資金元帳', vendor: '業者元帳' };

export interface LedgerDrawerState {
  target: LedgerDrawerTarget | null;
  collapsed: boolean;
  /** 行から開く（科目・月を差し替えて展開） */
  open: (t: LedgerDrawerTarget) => void;
  /** 開閉タブ（伝票入力の参照パネルと同じ動き） */
  toggle: () => void;
  /** 本文の右に並べて表示しているか（幅が足りないときは重ねる） */
  docked: boolean;
  /** 本文の右余白に加える幅（パネル＋開閉タブの分） */
  asideWidth: number;
  /** 行を押す前に開いたときの元帳の種類・呼び出し元 */
  defaultKind: LedgerKind;
  defaultFrom: string;
}
/** 元帳パネルの開閉状態。開閉タブは常に出し、行を押すとその科目・月で開く */
export function useLedgerDrawer(defaultFrom: string, defaultKind: LedgerKind = 'account'): LedgerDrawerState {
  const [target, setTarget] = useState<LedgerDrawerTarget | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [wide, setWide] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= WIDE_NARROW + 160));
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= WIDE_NARROW + 160);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const docked = !collapsed && wide;
  return { target, collapsed, open: (t) => { setTarget(t); setCollapsed(false); }, toggle: () => setCollapsed((c) => !c), docked, asideWidth: (docked ? LEDGER_DRAWER_WIDTH : 0) + (WIDE_TAB_SPACE - 28), defaultKind, defaultFrom };
}

export function LedgerDrawer({ state, accent, onNavigate }: { state: LedgerDrawerState; accent: string; onNavigate: (label: string) => void }) {
  const { target, collapsed, toggle } = state;
  const sess = useSession();
  const all = useVouchers();
  const editable = canEdit(sess);
  const [month, setMonth] = useState<MonthFilter>(target?.month ?? '8');
  const [account, setAccount] = useState(target?.account ?? '');
  const [edit, setEdit] = useState<Voucher | null>(null);
  const [top, setTop] = useState(102);
  // 行を押し直したら、その科目・月に差し替える
  useEffect(() => { if (target) { setMonth(target.month); setAccount(target.account); } }, [target]);
  // アプリバー＋ナビの高さに合わせる
  useEffect(() => {
    const measure = () => { const el = document.querySelector('[data-app-top]') ?? document.querySelector('header'); setTop(Math.round(el?.getBoundingClientRect().bottom ?? 102)); };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  // Esc でたたむ（伝票の訂正を開いているときは、そちらが先に閉じる）
  useEffect(() => {
    if (collapsed) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !edit && !document.querySelector('[data-modal-root]')) toggle(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [collapsed, edit, toggle]);
  const kind = target?.kind ?? state.defaultKind;
  const from = target?.from ?? state.defaultFrom;
  const vendor = kind === 'vendor';
  const page = LEDGER_PAGE[kind];
  const { lines } = ledgerLines(all, account, month, vendor);
  const total = lines.reduce((a, l) => a + l.d - l.c, 0);
  const openFull = () => {
    setSession({ ledgerTarget: { account, month: month ?? '8', from } });
    onNavigate(page);
  };
  const monthLabel = month == null ? '全月' : month === '決' ? '決算' : `${month}月`;
  return (
    <div className="ef-scope" style={scopeStyle(accent)}>
      <EntryStyles />
      <style>{`@keyframes ledger-drawer-in { from { transform: translateX(40px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
      {/* 開閉タブ：伝票入力の参照パネルと同じ。閉じているときは画面右端、開いているときはパネルの左外側。縦幅は両方の表記を重ねて同じにする */}
      <button type="button" className="ef-act" data-ledger-toggle aria-expanded={!collapsed} onClick={toggle} title={collapsed ? `${displayName(page)}をパネルで開く${account ? `（前回：${account}）` : ''}。表の行の「元帳」でも開きます` : '元帳パネルを折りたたむ（Esc）'} style={{ position: 'fixed', top: top + 12, right: collapsed ? 0 : `min(${LEDGER_DRAWER_WIDTH}px, 94vw)`, zIndex: 95, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 32, boxSizing: 'border-box', padding: '12px 0', background: '#fff', border: '1px solid #dde4ea', borderRight: 'none', borderRadius: '10px 0 0 10px', boxShadow: '-3px 3px 12px rgba(30,50,70,.14)', cursor: 'pointer', color: '#48565f', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, transition: 'right .28s ease' }}>
        <span aria-hidden>{collapsed ? '◀' : '▶'}</span>
        <span style={{ display: 'grid', justifyItems: 'center', alignItems: 'center' }}>
          <span aria-hidden={!collapsed} style={{ gridArea: '1 / 1', writingMode: 'vertical-rl', letterSpacing: '.1em', visibility: collapsed ? 'visible' : 'hidden' }}>元帳パネル</span>
          <span aria-hidden={collapsed} style={{ gridArea: '1 / 1', writingMode: 'vertical-rl', letterSpacing: '.1em', visibility: collapsed ? 'hidden' : 'visible' }}>たたむ</span>
        </span>
      </button>
      {!collapsed && (
      <aside data-ledger-drawer aria-label={`${displayName(page)}（パネル）`} style={{ position: 'fixed', top, right: 0, bottom: 0, width: LEDGER_DRAWER_WIDTH, maxWidth: '94vw', background: '#fff', borderLeft: '1px solid #dde4ea', boxShadow: '-10px 0 32px rgba(30,50,70,.14)', display: 'flex', flexDirection: 'column', zIndex: 90, animation: 'ledger-drawer-in .22s ease' }}>
        {/* 見出し：どの画面から、何の元帳か */}
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #eef2f5', flex: 'none', display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: '#8290a0' }}>{displayName(from)} <span style={{ margin: '0 4px' }}>›</span></span>
            <span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 15 }}>{displayName(page)}</span>
            <span style={{ fontSize: 11, color: '#8290a0' }}>{sess.fiscalYear}／{sess.division}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="ef-field" style={{ flex: '1 1 260px', minWidth: 0 }}>
              <ComboField id="ledger-drawer-acc" kind={vendor ? 'vendor' : 'account'} value={account} onChange={setAccount} placeholder={vendor ? 'コード・業者名で指定' : 'コード・科目名・フリガナで指定'} listWidth={380} fontSize={14.5} padY={8} />
            </div>
            <button type="button" className="ef-act" data-ledger-drawer-full onClick={openFull} title="全画面の元帳で開きます（長い期間の確認・印刷向き）。元帳の「← 戻る」でこの画面に戻れます" style={{ flex: 'none', padding: '8px 12px', borderRadius: 8, border: '1px solid ' + accent, background: '#fff', color: accent, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>元帳の画面で開く ›</button>
          </div>
          <FiscalMonthTabs current={month} accent={accent} onSelect={setMonth} withAll />
        </div>
        {/* 本体 */}
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {!account ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: '#9aa5b1', fontSize: 12.5, lineHeight: 1.8 }}>{vendor ? '業者' : '科目'}が選ばれていません。<br />表の行の「元帳」を押すか、上の入力欄にコード・名称を入力して指定してください。</div>
          ) : (
            <LedgerTable account={account} month={month} editable={editable} onEdit={setEdit} vendor={vendor} />
          )}
        </div>
        <div style={{ flex: 'none', padding: '8px 16px', borderTop: '1px solid #eef2f5', background: '#fbfcfd', fontSize: 11.5, color: '#8290a0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span><b style={{ color: '#22303c' }}>{monthLabel}</b>　{lines.length} 件　{vendor ? '支払' : '増減'} <b style={{ color: total < 0 ? '#c0392b' : '#22303c', fontVariantNumeric: 'tabular-nums' }}>{total.toLocaleString('ja-JP')}</b></span>
          <span style={{ marginLeft: 'auto' }}>別の行を押すと、その{vendor ? '業者' : '科目'}に差し替わります。行をダブルクリック、または「{editable ? '訂正' : '表示'}」で伝票を開きます</span>
        </div>
      </aside>
      )}
      <EditVoucherModal voucher={edit} onClose={() => setEdit(null)} accent={accent} returnTo={displayName(page)} />
    </div>
  );
}
