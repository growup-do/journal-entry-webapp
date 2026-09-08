// 右ドロワー：元帳１／元帳２（科目を指定して仕訳と残高を照会）、残高照合（通帳残高とシステム残高の突合）
// どの画面の上にも重ねて表示できる（既存システムの右側パネルに相当）。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { AssistField } from './AssistField';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { NOT_IMPL, ToastView, useToast } from './Toast';
import { BALANCE_ACCOUNTS, JOURNAL_ROWS } from '../data';
import { useAssist } from '../hooks/useAssist';
import type { MonthFilter } from '../types';
import type { DrawerKind } from './HeaderTools';

export const DRAWER_W = 420;
const yen = (n: number) => n.toLocaleString('ja-JP');
const CARRY = 1_000_000;

interface Props {
  kind: Exclude<DrawerKind, null>;
  accent: string;
  accentRgb: string;
  onClose: () => void;
}

export function RightDrawer({ kind, accent, accentRgb, onClose }: Props) {
  const title = kind === 'ledger1' ? '元帳１' : kind === 'ledger2' ? '元帳２' : '残高照合';
  return (
    <aside style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: DRAWER_W, background: '#fff', borderLeft: '1px solid #dde4ea', boxShadow: '-8px 0 28px rgba(30,50,70,.12)', zIndex: 150, display: 'flex', flexDirection: 'column', fontFamily: "'Noto Sans JP', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #eef2f5' }}>
        <span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16 }}>{title}</span>
        <span style={{ fontSize: 11.5, color: '#8895a3' }}>令和8年度</span>
        <button type="button" onClick={onClose} title="閉じる" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', fontSize: 20, color: '#8290a0', cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>
      {kind === 'balance' ? <BalanceCheck accent={accent} /> : <LedgerSlot key={kind} slot={kind} accent={accent} accentRgb={accentRgb} />}
    </aside>
  );
}

/* ---- 元帳スロット（元帳１・２で独立した状態を持つ） ---- */
function LedgerSlot({ slot, accent, accentRgb }: { slot: 'ledger1' | 'ledger2'; accent: string; accentRgb: string }) {
  const [account, setAccount] = useState(slot === 'ledger1' ? '普通預金（保育園）' : '');
  const [month, setMonth] = useState<MonthFilter>('8');
  const assist = useAssist();
  const rows = JOURNAL_ROWS.filter((r) => account && (r.kari === account || r.kashi === account) && (month == null || r.date.split('/')[0] === month));
  let bal = CARRY;
  const lines = rows.map((r) => {
    const d = r.kari === account ? r.amount : 0;
    const c = r.kashi === account ? r.amount : 0;
    bal += d - c;
    return { r, d, c, bal, other: r.kari === account ? r.kashi : r.kari };
  });
  const fieldBtn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: '#fff', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', color: 'inherit' };
  return (
    <>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #eef2f5', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <AssistField
              value={account}
              placeholder="<<科目未選択>>"
              open={assist.isOpen('acc')}
              onOpen={() => assist.open('acc', 'account')}
              accent={accent}
              accentRgb={accentRgb}
              buttonStyle={fieldBtn}
              panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', zIndex: 60 }}
              groups={assist.groups}
              query={assist.query}
              empty={assist.empty}
              onInput={assist.setQuery}
              onPick={(v) => {
                setAccount(v);
                assist.close();
              }}
            />
          </div>
          <button type="button" className="btn-outline" onClick={() => assist.open('acc', 'account')} style={{ padding: '8px 12px', border: '1px solid #cfd8e0', borderRadius: 8, background: '#fff', color: '#5b6773', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>科目検索</button>
        </div>
        <FiscalMonthTabs current={month} accent={accent} onSelect={setMonth} withAll />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) 78px 78px', gap: 6, padding: '8px 16px', background: '#f6f8fa', fontSize: 10.5, fontWeight: 700, color: '#8290a0', borderBottom: '1px solid #eef2f5' }}>
        <div>月日</div><div>科目／摘要</div><div style={{ textAlign: 'right' }}>借方／貸方</div><div style={{ textAlign: 'right' }}>残高</div>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {!account && <div style={{ padding: '36px 16px', textAlign: 'center', color: '#9aa5b1', fontSize: 12.5 }}>科目を選択してください。</div>}
        {account && (
          <div style={{ display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) 78px 78px', gap: 6, padding: '8px 16px', borderBottom: '1px solid #f1f4f6', fontSize: 12, background: '#fbfcfd' }}>
            <div /><div style={{ color: '#7a8794', fontWeight: 700 }}>繰越金額</div><div /><div style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{yen(CARRY)}</div>
          </div>
        )}
        {account && lines.length === 0 && <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9aa5b1', fontSize: 12.5 }}>この月の仕訳はありません。</div>}
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) 78px 78px', gap: 6, padding: '8px 16px', borderBottom: '1px solid #f1f4f6', fontSize: 12, alignItems: 'center' }}>
            <div style={{ color: '#8895a3', fontSize: 11 }}>{l.r.date}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.other}</div>
              <div style={{ fontSize: 10.5, color: '#9aa5b1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.r.tekiyo}</div>
            </div>
            <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: l.d ? '#2c5f9e' : '#b0426a' }}>{l.d ? yen(l.d) : '△' + yen(l.c)}</div>
            <div style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{yen(l.bal)}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---- 残高照合 ---- */
function BalanceCheck({ accent }: { accent: string }) {
  const [book, setBook] = useState<number[]>(() => BALANCE_ACCOUNTS.map(() => 0));
  const [editing, setEditing] = useState(false);
  const toast = useToast();
  const set = (i: number, v: string) => setBook((b) => b.map((x, k) => (k === i ? parseInt(v.replace(/[^0-9]/g, ''), 10) || 0 : x)));
  const btn = (on?: boolean): CSSProperties => ({ padding: '7px 12px', border: '1px solid ' + (on ? accent : '#cfd8e0'), borderRadius: 8, background: on ? accent : '#fff', color: on ? '#fff' : '#5b6773', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const ngCount = BALANCE_ACCOUNTS.filter((a, i) => book[i] !== a.system).length;
  return (
    <>
      <ToastView msg={toast.msg} />
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #eef2f5', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: ngCount ? '#c0392b' : '#1f7a52', fontWeight: 700 }}>{ngCount ? `不一致 ${ngCount} 件` : 'すべて一致'}</span>
        <button type="button" className="btn-outline" onClick={() => setEditing((e) => !e)} style={{ ...btn(editing), marginLeft: 'auto' }}>{editing ? '設定を終了' : '通帳残高の設定'}</button>
        <button type="button" className="btn-outline" onClick={() => toast.show(NOT_IMPL)} style={btn()}>印刷</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 40px 96px 96px 90px', gap: 6, padding: '8px 16px', background: '#f6f8fa', fontSize: 10.5, fontWeight: 700, color: '#8290a0', borderBottom: '1px solid #eef2f5' }}>
        <div>現預金科目</div><div /><div style={{ textAlign: 'right' }}>通帳残高</div><div style={{ textAlign: 'right' }}>システム残高</div><div style={{ textAlign: 'right' }}>差額</div>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {BALANCE_ACCOUNTS.map((a, i) => {
          const ok = book[i] === a.system;
          return (
            <div key={a.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 40px 96px 96px 90px', gap: 6, padding: '9px 16px', borderBottom: '1px solid #f1f4f6', fontSize: 12, alignItems: 'center', background: ok ? 'transparent' : '#fdeee9' }}>
              <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
              <div><span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: ok ? '#e8f0fb' : '#c0392b', color: ok ? '#2c5f9e' : '#fff' }}>{ok ? 'OK' : 'NG'}</span></div>
              <div style={{ textAlign: 'right' }}>
                {editing ? (
                  <input className="field-input" value={yen(book[i])} onChange={(e) => set(i, e.target.value)} inputMode="numeric" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'right', padding: '4px 6px', border: '1px solid #cfd8e0', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
                ) : (
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{yen(book[i])}</span>
                )}
              </div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{yen(a.system)}</div>
              <div style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: ok ? '#22303c' : '#c0392b' }}>{book[i] - a.system < 0 ? '-' : ''}{yen(Math.abs(book[i] - a.system))}</div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: '10px 16px', borderTop: '1px solid #eef2f5', fontSize: 11, color: '#9aa5b1', lineHeight: 1.6 }}>「通帳残高の設定」で通帳の残高を入力すると、システム残高と突合して OK／NG を表示します。</div>
    </>
  );
}
