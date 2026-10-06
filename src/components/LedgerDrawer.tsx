// 元帳パネル（試算表・決算書・推移表からのドリルダウン。依頼書 5.4.1／7章1）
//   科目（月）の行を押すと、画面遷移せずに右側へ元帳を出す。押した行と残高を見たまま内訳を確認でき、別の行を押すと差し替わる。
//   長い期間の確認や印刷は「元帳の画面で開く」で全画面の元帳へ（そちらには「← 戻る」がある）。
//   幅が足りないとき（WIDE_NARROW 未満）は本文に重ねて表示する。

import { useEffect, useState } from 'react';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { ComboField, EntryStyles, scopeStyle } from './EntryCommon';
import { EditVoucherModal } from './VoucherEdit';
import { LedgerTable, WIDE_NARROW, ledgerLines } from './WidePanel';
import { displayName } from '../data';
import { useVouchers, type Voucher } from '../store/journalStore';
import { canEdit, setSession, useSession } from '../store/session';
import type { MonthFilter } from '../types';

export type LedgerKind = 'account' | 'fund' | 'vendor';
export interface LedgerDrawerTarget { account: string; month: MonthFilter; kind: LedgerKind; /** 呼び出し元の画面キー（全画面の元帳の「← 戻る」に使う） */ from: string }
export const LEDGER_DRAWER_WIDTH = 600;
const LEDGER_PAGE: Record<LedgerKind, string> = { account: '勘定元帳', fund: '資金元帳', vendor: '業者元帳' };

/** 元帳パネルの開閉状態。docked＝本文の横に並べて表示（幅が足りないときは重ねる） */
export function useLedgerDrawer() {
  const [target, setTarget] = useState<LedgerDrawerTarget | null>(null);
  const [wide, setWide] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= WIDE_NARROW + 160));
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= WIDE_NARROW + 160);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return { target, open: (t: LedgerDrawerTarget) => setTarget(t), close: () => setTarget(null), docked: !!target && wide, asideWidth: target && wide ? LEDGER_DRAWER_WIDTH : 0 };
}

export function LedgerDrawer({ target, onClose, accent, onNavigate }: { target: LedgerDrawerTarget | null; onClose: () => void; accent: string; onNavigate: (label: string) => void }) {
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
  }, [target]);
  // Esc で閉じる（伝票の訂正を開いているときは、そちらが先に閉じる）
  useEffect(() => {
    if (!target) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !edit && !document.querySelector('[data-modal-root]')) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [target, edit, onClose]);
  if (!target) return null;
  const vendor = target.kind === 'vendor';
  const page = LEDGER_PAGE[target.kind];
  const { lines } = ledgerLines(all, account, month, vendor);
  const total = lines.reduce((a, l) => a + l.d - l.c, 0);
  const openFull = () => {
    setSession({ ledgerTarget: { account, month: month ?? '8', from: target.from } });
    onClose();
    onNavigate(page);
  };
  const monthLabel = month == null ? '全月' : month === '決' ? '決算' : `${month}月`;
  return (
    <div className="ef-scope" style={scopeStyle(accent)}>
      <EntryStyles />
      <aside data-ledger-drawer aria-label={`${displayName(page)}（パネル）`} style={{ position: 'fixed', top, right: 0, bottom: 0, width: LEDGER_DRAWER_WIDTH, maxWidth: '94vw', background: '#fff', borderLeft: '1px solid #dde4ea', boxShadow: '-10px 0 32px rgba(30,50,70,.14)', display: 'flex', flexDirection: 'column', zIndex: 90, animation: 'ledger-drawer-in .22s ease' }}>
        <style>{`@keyframes ledger-drawer-in { from { transform: translateX(40px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
        {/* 見出し：どの画面から、何の元帳か */}
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #eef2f5', flex: 'none', display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: '#8290a0' }}>{displayName(target.from)} <span style={{ margin: '0 4px' }}>›</span></span>
            <span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 15 }}>{displayName(page)}</span>
            <span style={{ fontSize: 11, color: '#8290a0' }}>{sess.fiscalYear}／{sess.division}</span>
            <button type="button" className="ef-act" data-ledger-drawer-close onClick={onClose} title="元帳パネルを閉じる（Esc）" style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 7, border: '1px solid #cfd8e0', background: '#fff', color: '#5b6773', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>閉じる ×</button>
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
            <div style={{ padding: '36px 16px', textAlign: 'center', color: '#9aa5b1', fontSize: 12.5, lineHeight: 1.8 }}>{vendor ? '業者' : '科目'}が選ばれていません。<br />上の入力欄に、コード・名称を入力して指定してください。</div>
          ) : (
            <LedgerTable account={account} month={month} editable={editable} onEdit={setEdit} vendor={vendor} />
          )}
        </div>
        <div style={{ flex: 'none', padding: '8px 16px', borderTop: '1px solid #eef2f5', background: '#fbfcfd', fontSize: 11.5, color: '#8290a0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span><b style={{ color: '#22303c' }}>{monthLabel}</b>　{lines.length} 件　{vendor ? '支払' : '増減'} <b style={{ color: total < 0 ? '#c0392b' : '#22303c', fontVariantNumeric: 'tabular-nums' }}>{total.toLocaleString('ja-JP')}</b></span>
          <span style={{ marginLeft: 'auto' }}>別の行を押すと、その{vendor ? '業者' : '科目'}に差し替わります。行をダブルクリック、または「{editable ? '訂正' : '表示'}」で伝票を開きます</span>
        </div>
      </aside>
      <EditVoucherModal voucher={edit} onClose={() => setEdit(null)} accent={accent} returnTo={displayName(page)} />
    </div>
  );
}
