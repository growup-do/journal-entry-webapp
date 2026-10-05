// 参照パネル（現行「ワイド画面」の Web 版。依頼書 5.1.3）
//   伝票入力の横（または下）に、日記帳（当年／前年を切替）／元帳１／元帳２／残高照合 を切り替えて表示する。
//   当年／前年の切替と元帳１・２・残高照合は、以前はヘッダーにあったもの（ヘッダーからは外し、このパネルに集約）。
//   画面サイズによる機能の有無は設けず、幅が狭いときは折りたたんで重ねて表示する（3.3）。
//   選んだ表示・開閉・元帳の科目は localStorage に覚える。行のダブルクリック、または「訂正」ボタンで伝票の訂正を開く。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { PrevYearJournal } from './PrevYearJournal';
import { ComboField, EntryStyles, FieldLabel, scopeStyle } from './EntryCommon';
import { EditVoucherModal } from './VoucherEdit';
import { yen } from './ui';
import { BALANCE_ACCOUNTS } from '../data';
import { metaOf } from '../lib/accounts';
import { FUSEN_COLORS, useVouchers, type Voucher } from '../store/journalStore';
import { canEdit, useSession } from '../store/session';
import type { MonthFilter } from '../types';

export const WIDE_VIEWS = ['日記帳', '前年度日記帳', '元帳１', '元帳２', '残高照合'] as const;
export type WideView = (typeof WIDE_VIEWS)[number];
/** タブとして並べる表示。前年度日記帳は「日記帳」タブの中の 当年／前年 切替で開く */
const WIDE_TABS = ['日記帳', '元帳１', '元帳２', '残高照合'] as const;
/** この幅より狭いときは、横のパネルを折りたたんで重ねて表示する */
export const WIDE_NARROW = 1240;
export const WIDE_WIDTH = 440;
/** 開閉タブ（幅32px）の分として、本文の右側に空ける余白。本文の右余白の合計がこの値になるようにする（タブ32px＋すき間16px） */
export const WIDE_TAB_SPACE = 48;

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
const isView = (v: string | null): v is WideView => !!v && (WIDE_VIEWS as readonly string[]).includes(v);
/** 動作環境「ワイド画面設定」の初期表示画面 → パネルの表示 */
const viewOfEnv = (s: string): WideView => (/前年/.test(s) ? '前年度日記帳' : /２|2/.test(s) ? '元帳２' : /元帳/.test(s) ? '元帳１' : /残高/.test(s) ? '残高照合' : '日記帳');

export interface WidePanelState {
  storageKey: string;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  view: WideView;
  setView: (v: WideView) => void;
  narrow: boolean;
}
export function useWidePanel(storageKey: string, defaultCollapsed = false): WidePanelState {
  const sess = useSession();
  const [narrow, setNarrow] = useState(() => window.innerWidth < WIDE_NARROW);
  const [collapsed, setC] = useState(() => {
    const saved = read(storageKey + ':collapsed');
    if (window.innerWidth < WIDE_NARROW) return true;
    return saved == null ? defaultCollapsed : saved === '1';
  });
  const [view, setV] = useState<WideView>(() => { const saved = read(storageKey + ':view'); return isView(saved) ? saved : viewOfEnv(sess.env.wideInitial); });
  useEffect(() => {
    const h = () => {
      const n = window.innerWidth < WIDE_NARROW;
      setNarrow((prev) => {
        if (n && !prev) setC(true); // 狭くなったら折りたたむ（保存はしない）
        return n;
      });
    };
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return {
    storageKey,
    collapsed,
    setCollapsed: (c) => { setC(c); write(storageKey + ':collapsed', c ? '1' : '0'); },
    view,
    setView: (v) => { setV(v); write(storageKey + ':view', v); },
    narrow,
  };
}

interface Props {
  accent: string;
  /** side＝画面右に固定（仕訳伝票形式）／inline＝カードとして埋め込み（単一・振替） */
  layout: 'side' | 'inline';
  state: WidePanelState;
  /** side のときの上端（ヘッダーの高さ） */
  top?: number;
  /** 登録直後の行（強調表示） */
  highlightIds?: number[];
  /** 訂正画面の「戻る」に出す画面名 */
  returnTo: string;
  /** 残高照合の画面（通帳残高の入力）を開く */
  onNavigate?: (label: string) => void;
}

const TH: CSSProperties = { padding: '7px 8px', fontSize: 10.5, fontWeight: 700, color: '#8290a0', background: '#f6f8fa', borderBottom: '1px solid #e2e8ee', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1 };
const TD: CSSProperties = { padding: '7px 8px', fontSize: 12, borderBottom: '1px solid #f1f4f6', verticalAlign: 'middle' };
const NUM: CSSProperties = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
const clip: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

export function WidePanel({ accent, layout, state, top = 0, highlightIds, returnTo, onNavigate }: Props) {
  const all = useVouchers();
  const sess = useSession();
  const editable = canEdit(sess);
  const [month, setMonth] = useState<MonthFilter>('8');
  const [acc1, setAcc1] = useState(() => read(state.storageKey + ':ledger1') ?? sess.env.ledger1Init);
  const [acc2, setAcc2] = useState(() => read(state.storageKey + ':ledger2') ?? sess.env.ledger2Init);
  const [edit, setEdit] = useState<Voucher | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { view, collapsed, narrow } = state;

  // 登録直後は一覧の最下部（新しい行）を見せる
  const hiKey = (highlightIds ?? []).join(',');
  useEffect(() => {
    if (!hiKey) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [hiKey]);

  const slot = view === '元帳１' ? 1 : view === '元帳２' ? 2 : 0;
  const account = slot === 1 ? acc1 : slot === 2 ? acc2 : '';
  const setAccount = (v: string) => {
    if (slot === 1) { setAcc1(v); write(state.storageKey + ':ledger1', v); }
    if (slot === 2) { setAcc2(v); write(state.storageKey + ':ledger2', v); }
  };
  const inMonth = (r: Voucher) => month == null || r.date.split('/')[0] === month;
  const journal = all.filter(inMonth);
  const ledger = all.filter((r) => inMonth(r) && account && (r.kari === account || r.kashi === account));
  const carry = metaOf(account)?.cls === '現預金' ? 5_000_000 : 0;
  let bal = carry;
  const lines = ledger.map((r) => {
    const d = r.kari === account ? r.amount : 0;
    const c = r.kashi === account ? r.amount : 0;
    bal += d - c;
    return { r, d, c, bal, other: r.kari === account ? r.kashi : r.kari };
  });
  const isNew = (r: Voucher) => !!highlightIds?.includes(r.id);
  const editBtn = (r: Voucher) => (
    <button type="button" className="ef-act" data-menu="参照パネル:訂正" onClick={() => setEdit(r)} title={editable ? 'この伝票を訂正（行のダブルクリックでも開きます）' : 'この伝票の内容を表示（参照のみ）'} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #cfd8e0', background: '#fff', color: '#2c5f9e', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>{editable ? '訂正' : '表示'}</button>
  );
  const flags = (r: Voucher) => (
    <span style={{ display: 'inline-flex', gap: 2, marginLeft: 4, verticalAlign: 'middle' }}>
      {r.fusen && <span title={`付箋：${r.fusen}`} style={{ width: 9, height: 9, borderRadius: 2, background: FUSEN_COLORS[r.fusen], display: 'inline-block' }} />}
      {r.check && <span title="チェック" style={{ fontSize: 9.5, fontWeight: 900, color: '#22303c' }}>✓</span>}
      {!r.shohyo && <span title="証憑 無" style={{ fontSize: 9, fontWeight: 700, color: '#9aa5b1' }}>証無</span>}
    </span>
  );

  const body = (
    <>
      {/* 表示の切替 */}
      <div style={{ padding: '10px 14px 9px', borderBottom: '1px solid #eef2f5', flex: 'none', display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 15 }}>参照パネル</span>
          <span style={{ fontSize: 11, color: '#8290a0' }}>入力しながら帳簿を確認</span>
        </div>
        <div role="tablist" aria-label="参照パネルの表示" style={{ display: 'flex', gap: 3, flexWrap: 'wrap', padding: 3, background: '#e9eef2', borderRadius: 9 }}>
          {WIDE_TABS.map((v) => {
            const on = v === view || (v === '日記帳' && view === '前年度日記帳');
            return (
              <button key={v} type="button" role="tab" aria-selected={on} className="ef-act" data-menu={'参照パネル:' + v} onClick={() => { if (!on) state.setView(v); }} style={{ flex: '1 1 auto', padding: '5px 8px', borderRadius: 7, border: 'none', background: on ? accent : 'transparent', color: on ? '#fff' : '#48565f', fontSize: 12, fontWeight: on ? 800 : 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>{v}</button>
            );
          })}
        </div>
        {(view === '日記帳' || view === '前年度日記帳') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#8290a0' }}>仕訳</span>
            <div role="group" aria-label="当年／前年の切替" style={{ display: 'flex', gap: 2, padding: 2, background: '#f4f6f8', border: '1px solid #e2e8ee', borderRadius: 8 }}>
              {([['日記帳', '当年', '当年仕訳', accent], ['前年度日記帳', '前年', '前年仕訳', '#b7791f']] as const).map(([v, label, menu, color]) => {
                const on = view === v;
                return <button key={v} type="button" className="ef-act" data-menu={menu} aria-pressed={on} onClick={() => state.setView(v)} style={{ padding: '4px 14px', borderRadius: 6, border: '1px solid ' + (on ? color : 'transparent'), background: on ? color : 'transparent', color: on ? '#fff' : '#3d4a56', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</button>;
              })}
            </div>
            <span style={{ fontSize: 11, color: '#8290a0' }}>{view === '日記帳' ? sess.fiscalYear : '前年度（閲覧のみ）'}</span>
          </div>
        )}
        {(view === '日記帳' || slot > 0) && <FiscalMonthTabs current={month} accent={accent} onSelect={setMonth} withAll />}
        {slot > 0 && (
          <div className="ef-field">
            <FieldLabel>{view}の科目</FieldLabel>
            <ComboField id={`${state.storageKey}-acc${slot}`} kind="account" value={account} onChange={setAccount} placeholder="コード・科目名・フリガナで指定" listWidth={380} />
          </div>
        )}
      </div>

      {view === '前年度日記帳' ? (
        <PrevYearJournal accent={accent} compact />
      ) : view === '残高照合' ? (
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead><tr><th style={TH}>現預金科目</th><th style={{ ...TH, width: 44 }}>判定</th><th style={{ ...TH, textAlign: 'right' }}>通帳残高</th><th style={{ ...TH, textAlign: 'right' }}>システム残高</th><th style={{ ...TH, textAlign: 'right' }}>差額</th></tr></thead>
            <tbody>
              {BALANCE_ACCOUNTS.map((a) => {
                const ok = a.system === 0;
                return (
                  <tr key={a.name} style={{ background: ok ? 'transparent' : '#fff7f5' }}>
                    <td style={{ ...TD, fontWeight: 500 }}>{a.name}</td>
                    <td style={TD}><span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 6, background: ok ? '#e8f0fb' : '#c0392b', color: ok ? '#2c5f9e' : '#fff' }}>{ok ? 'OK' : 'NG'}</span></td>
                    <td style={NUM}>0</td>
                    <td style={NUM}>{yen(a.system)}</td>
                    <td style={{ ...NUM, fontWeight: 700, color: ok ? '#22303c' : '#c0392b' }}>{ok ? '0' : '-' + yen(a.system)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: '10px 14px', fontSize: 11.5, color: '#9aa5b1', lineHeight: 1.7, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>ここでは結果の確認だけができます。通帳残高の入力は「残高照合」の画面で行います。</span>
            {onNavigate && <button type="button" className="ef-act" data-menu="参照パネル:残高照合の画面を開く" onClick={() => onNavigate('残高照合')} style={{ flex: 'none', padding: '5px 10px', borderRadius: 7, border: '1px solid ' + accent, background: '#fff', color: accent, fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>残高照合の画面を開く</button>}
          </div>
        </div>
      ) : view === '日記帳' ? (
        <div ref={scrollRef} style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
            <thead><tr><th style={{ ...TH, width: 44 }}>月日</th><th style={TH}>借方科目 ／ 貸方科目</th><th style={TH}>摘要</th><th style={{ ...TH, width: 84, textAlign: 'right' }}>金額</th><th style={{ ...TH, width: 52 }} /></tr></thead>
            <tbody>
              {journal.length === 0 && <tr><td colSpan={5} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 30 }}>この月の仕訳はありません。</td></tr>}
              {journal.map((r) => (
                <tr key={r.id} onDoubleClick={() => setEdit(r)} title="ダブルクリックで伝票を開きます" style={{ background: isNew(r) ? '#fff2c9' : 'transparent', animation: isNew(r) ? 'rowin 1.8s ease' : 'none', cursor: 'default' }}>
                  <td style={{ ...TD, color: '#8895a3', fontSize: 11 }}>{r.date}</td>
                  <td style={TD}><div style={{ ...clip, fontWeight: 500 }}>{r.kari}</div><div style={{ ...clip, color: '#5b6773', fontSize: 11.5 }}>{r.kashi}</div></td>
                  <td style={TD}><div style={{ ...clip, color: '#7a8794', fontSize: 11.5 }}>{r.tekiyo}{flags(r)}</div><div style={{ ...clip, color: '#a3adb8', fontSize: 10.5 }}>No {r.no}{r.gyosha ? `　${r.gyosha}` : ''}</div></td>
                  <td style={{ ...NUM, fontWeight: 700 }}>{yen(r.amount)}</td>
                  <td style={{ ...TD, textAlign: 'right' }}>{editBtn(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={scrollRef} style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {!account ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: '#9aa5b1', fontSize: 12.5, lineHeight: 1.8 }}>科目が選ばれていません。<br />上の「{view}の科目」に、コード・科目名・フリガナを入力して指定してください。</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
              <thead><tr><th style={{ ...TH, width: 44 }}>月日</th><th style={TH}>相手科目 ／ 摘要</th><th style={{ ...TH, width: 74, textAlign: 'right' }}>借方</th><th style={{ ...TH, width: 74, textAlign: 'right' }}>貸方</th><th style={{ ...TH, width: 84, textAlign: 'right' }}>残高</th><th style={{ ...TH, width: 52 }} /></tr></thead>
              <tbody>
                <tr style={{ background: '#f8fafc' }}><td style={TD} colSpan={4}><span style={{ color: '#7a8794', fontWeight: 700, fontSize: 11.5 }}>繰越金額</span></td><td style={{ ...NUM, fontWeight: 700 }}>{yen(carry)}</td><td style={TD} /></tr>
                {lines.length === 0 && <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 30 }}>この月の仕訳はありません。</td></tr>}
                {lines.map((l) => (
                  <tr key={l.r.id} onDoubleClick={() => setEdit(l.r)} title="ダブルクリックで伝票を開きます" style={{ background: isNew(l.r) ? '#fff2c9' : 'transparent' }}>
                    <td style={{ ...TD, color: '#8895a3', fontSize: 11 }}>{l.r.date}</td>
                    <td style={TD}><div style={{ ...clip, fontWeight: 500 }}>{l.other}</div><div style={{ ...clip, color: '#7a8794', fontSize: 11 }}>{l.r.tekiyo}{flags(l.r)}</div></td>
                    <td style={NUM}>{l.d ? yen(l.d) : ''}</td>
                    <td style={NUM}>{l.c ? yen(l.c) : ''}</td>
                    <td style={{ ...NUM, fontWeight: 700, color: l.bal < 0 ? '#c0392b' : '#22303c' }}>{yen(l.bal)}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>{editBtn(l.r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {(view === '日記帳' || slot > 0) && (
        <div style={{ flex: 'none', padding: '7px 14px', borderTop: '1px solid #eef2f5', background: '#fbfcfd', fontSize: 11, color: '#8290a0', display: 'flex', gap: 10 }}>
          <span>{view === '日記帳' ? journal.length : lines.length} 件</span>
          <span style={{ marginLeft: 'auto' }}>行をダブルクリック、または「{editable ? '訂正' : '表示'}」で伝票を開きます</span>
        </div>
      )}
    </>
  );

  const modal = <EditVoucherModal voucher={edit} onClose={() => setEdit(null)} accent={accent} returnTo={returnTo} />;

  if (layout === 'inline') {
    return (
      <div className="ef-scope" style={{ ...scopeStyle(accent), background: '#fff', border: '1px solid #dde4ea', borderRadius: 14, boxShadow: '0 6px 26px rgba(30,50,70,.07)', overflow: 'hidden' }}>
        <EntryStyles />
        <button type="button" className="ef-act" data-menu="参照パネル:開閉" aria-expanded={!collapsed} onClick={() => state.setCollapsed(!collapsed)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 18px', border: 'none', background: collapsed ? '#fbfcfd' : '#f6f8fa', cursor: 'pointer', fontFamily: 'inherit', color: '#22303c', textAlign: 'left' }}>
          <span style={{ fontSize: 11, color: '#5b6773' }}>{collapsed ? '▶' : '▼'}</span>
          <span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 14.5 }}>参照パネル</span>
          <span style={{ fontSize: 11.5, color: '#7a8794' }}>日記帳（当年／前年）／元帳１／元帳２／残高照合{collapsed ? `（前回：${view}）` : ''}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: accent }}>{collapsed ? '開く' : 'たたむ'}</span>
        </button>
        {!collapsed && <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 460, borderTop: '1px solid #eef2f5' }}>{body}</div>}
        {modal}
      </div>
    );
  }

  return (
    <div className="ef-scope" style={scopeStyle(accent)}>
      <EntryStyles />
      {/* 開閉タブ：閉じているときは画面右端、開いているときはパネルの左外側に付く。縦幅はどちらも同じ（両方の表記を重ねて高さを決める） */}
      <button type="button" className="ef-act" data-menu={collapsed ? '参照パネル:開く' : '参照パネル:閉じる'} data-wide-toggle aria-expanded={!collapsed} onClick={() => state.setCollapsed(!collapsed)} title={collapsed ? '参照パネル（日記帳・元帳・残高照合）を開く' : '参照パネルを折りたたむ'} style={{ position: 'fixed', top: top + 12, right: collapsed ? 0 : `min(${WIDE_WIDTH}px, 94vw)`, zIndex: 95, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 32, boxSizing: 'border-box', padding: '12px 0', background: '#fff', border: '1px solid #dde4ea', borderRight: 'none', borderRadius: '10px 0 0 10px', boxShadow: '-3px 3px 12px rgba(30,50,70,.14)', cursor: 'pointer', color: '#48565f', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, transition: 'right .28s ease' }}>
        <span aria-hidden>{collapsed ? '◀' : '▶'}</span>
        <span style={{ display: 'grid', justifyItems: 'center', alignItems: 'center' }}>
          <span aria-hidden={!collapsed} style={{ gridArea: '1 / 1', writingMode: 'vertical-rl', letterSpacing: '.1em', visibility: collapsed ? 'visible' : 'hidden' }}>参照パネル（{view}）</span>
          <span aria-hidden={collapsed} style={{ gridArea: '1 / 1', writingMode: 'vertical-rl', letterSpacing: '.1em', visibility: collapsed ? 'hidden' : 'visible' }}>たたむ</span>
        </span>
      </button>
      <aside aria-label="参照パネル" aria-hidden={collapsed} style={{ position: 'fixed', top, right: 0, bottom: 0, width: WIDE_WIDTH, maxWidth: '94vw', background: '#fff', borderLeft: '1px solid #dde4ea', boxShadow: narrow ? '-14px 0 40px rgba(30,50,70,.22)' : '-8px 0 28px rgba(30,50,70,.07)', display: 'flex', flexDirection: 'column', zIndex: 90, transition: 'transform .28s ease', transform: collapsed ? `translateX(${WIDE_WIDTH + 20}px)` : 'translateX(0)', visibility: collapsed ? 'hidden' : 'visible' }}>
        {body}
      </aside>
      {modal}
    </div>
  );
}
