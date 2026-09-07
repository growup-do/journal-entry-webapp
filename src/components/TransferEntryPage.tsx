// 振替入力（既存「振替伝票」の再現）
//   開いた直後に既存システムと同じ注意（複数行にわたる内部取引には非対応）を表示。
//   1伝票＝最大5行。各行：借方金額／借方科目（資金科目は自動）／貸方科目（資金科目は自動）／貸方金額／摘要。
//   借方合計＝貸方合計で登録可。登録した行は下の当年仕訳一覧に入る。

import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AssistField } from './AssistField';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { Modal } from './Modal';
import { NOT_IMPL, ToastView, useToast } from './Toast';
import { makeSheetSeed } from '../data';
import { useAssist } from '../hooks/useAssist';
import { applyMonth, fmtAmount } from '../lib/format';
import type { JournalEntry, MonthFilter } from '../types';

const PINK = '#b0426a';
const PINK_RGB = '176,66,106';
const BLUE = '#2c5f9e';
const BLUE_RGB = '44,95,158';
const ROW_COUNT = 5;
const ALERT_KEY = 'transfer-alert-hidden';

interface Row {
  kariAmt: string;
  kari: string;
  kashi: string;
  kashiAmt: string;
  tekiyo: string;
}
const emptyRow = (): Row => ({ kariAmt: '', kari: '', kashi: '', kashiAmt: '', tekiyo: '' });
const toNum = (s: string) => parseInt(s.replace(/[^0-9]/g, ''), 10) || 0;

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  accentRgb: string;
  /** 振替単一：1行のみ・注意ダイアログなし */
  single?: boolean;
}

export function TransferEntryPage({ variant, accent, accentRgb, single }: Props) {
  const rowCount = single ? 1 : ROW_COUNT;
  const title = single ? '振替単一' : '振替伝票';
  const [alertOpen, setAlertOpen] = useState(() => {
    if (single) return false;
    try {
      return localStorage.getItem(ALERT_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [dontShow, setDontShow] = useState(false);
  const [service, setService] = useState('001 本部');
  const [month, setMonth] = useState('8');
  const [day, setDay] = useState('5');
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: rowCount }, emptyRow));
  const [shohyo, setShohyo] = useState(true);
  const [cheque, setCheque] = useState('');
  const [err, setErr] = useState('');
  const [journal, setJournal] = useState<JournalEntry[]>(() => makeSheetSeed());
  const [monthFilter, setMonthFilter] = useState<MonthFilter>('8');
  const [lastIds, setLastIds] = useState<number[]>([]);
  const nextId = useRef(1);
  const assist = useAssist();
  const toast = useToast();

  const closeAlert = () => {
    if (dontShow) {
      try {
        localStorage.setItem(ALERT_KEY, '1');
      } catch {
        /* ignore */
      }
    }
    setAlertOpen(false);
  };

  const setRow = (i: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
    setErr('');
  };
  const pick = (val: string) => {
    const v = val === '（なし）' ? '' : val;
    const [kind, idx, side] = assist.key.split(':');
    if (kind === 'service') setService(v);
    if (kind === 'row') setRow(Number(idx), side === 'kari' ? { kari: v } : { kashi: v });
    assist.close();
  };

  const kariTotal = rows.reduce((a, r) => a + toNum(r.kariAmt), 0);
  const kashiTotal = rows.reduce((a, r) => a + toNum(r.kashiAmt), 0);
  const balanced = kariTotal > 0 && kariTotal === kashiTotal;

  const submit = () => {
    const used = rows.filter((r) => r.kari || r.kashi || toNum(r.kariAmt) || toNum(r.kashiAmt));
    if (used.length === 0) return setErr('借方・貸方の科目と金額を入力してください。');
    if (used.some((r) => !r.kari && !r.kashi)) return setErr('科目が未選択の行があります。');
    if (!balanced) return setErr(`借方合計と貸方合計が一致していません（差額 ${Math.abs(kariTotal - kashiTotal).toLocaleString('ja-JP')} 円）。`);
    const ids: number[] = [];
    const entries: JournalEntry[] = used.map((r) => {
      const id = nextId.current++;
      ids.push(id);
      return { id, date: `${month}/${day}`, kari: r.kari || '諸口', kashi: r.kashi || '諸口', tekiyo: r.tekiyo, amount: toNum(r.kariAmt) || toNum(r.kashiAmt), shohyo, cheque: cheque || undefined };
    });
    setJournal((j) => [...j, ...entries]);
    setLastIds(ids);
    setRows(Array.from({ length: rowCount }, emptyRow));
    setCheque('');
    setErr('');
    setMonthFilter((mf) => (mf != null && mf !== month ? month : mf));
    toast.show(`${title}を登録しました（${entries.length}行）`);
    setTimeout(() => {
      const el = document.getElementById('journal-scroll');
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  };

  const list = applyMonth(journal, monthFilter);
  const isSheet = variant === 'sheet';

  const fieldBtn: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    background: '#fff',
    border: '1px solid #cfd8e0',
    borderRadius: 8,
    fontSize: 13.5,
    fontFamily: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
    color: 'inherit',
  };
  const input: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    border: '1px solid #cfd8e0',
    borderRadius: 8,
    fontSize: 13.5,
    fontFamily: 'inherit',
    outline: 'none',
    color: '#22303c',
    background: '#fff',
    minWidth: 0,
  };
  const amt: CSSProperties = { ...input, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' };
  const colLabel: CSSProperties = { fontSize: 10.5, fontWeight: 700, color: '#8290a0', marginBottom: 6, display: 'block' };
  const GRID = '32px 140px minmax(0,1fr) minmax(0,1fr) 140px';
  const assistProps = (key: string) => ({
    open: assist.isOpen(key),
    groups: assist.groups,
    query: assist.query,
    empty: assist.empty,
    onInput: assist.setQuery,
    onPick: pick,
  });

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <ToastView msg={toast.msg} />

      {/* 既存システムと同じ注意ダイアログ */}
      <Modal open={alertOpen} onClose={closeAlert} width={520} strict>
        <div style={{ padding: '26px 28px 22px' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: '#fff3cd', color: '#b7791f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>!</span>
            <div>
              <div style={{ fontSize: 12, color: '#8290a0', fontWeight: 700, marginBottom: 4 }}>振替式の内部取引伝票入力についてのご確認</div>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.6 }}>振替伝票は複数行にわたる内部取引の仕訳に対応しておりません</div>
              <div style={{ fontSize: 13, color: '#48565f', lineHeight: 1.7, marginTop: 8 }}>振替式単一、もしくは振替式で１行の伝票入力であれば登録が可能です。</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#5b6773', cursor: 'pointer' }}>
              <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
              今後、このメッセージを表示しない
            </label>
            <button type="button" onClick={closeAlert} style={{ padding: '9px 32px', background: accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
              OK
            </button>
          </div>
        </div>
      </Modal>

      <div style={{ width: '100%', maxWidth: isSheet ? 'none' : 1280, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* 伝票 */}
        <div style={{ background: '#fff', border: '1px solid #dde4ea', borderRadius: isSheet ? 14 : 16, boxShadow: '0 6px 26px rgba(30,50,70,.07)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, padding: '18px 22px 14px', borderBottom: '2px solid #28323c', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: isSheet ? 17 : 21, letterSpacing: '.04em' }}>
                {title} <span style={{ fontSize: 12.5, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>チャイルド保育園　拠点区分</span>
              </div>
              <div style={{ color: '#7a8794', fontSize: 12, marginTop: 4 }}>{single ? '1行の振替伝票です（内部取引にも使えます）。' : `1伝票に最大${ROW_COUNT}行。`}借方合計と貸方合計が一致すると登録できます。</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flex: 'none' }}>
              <div style={{ width: 170 }}>
                <span style={colLabel}>サービス区分</span>
                <AssistField value={service} placeholder="選択" onOpen={() => assist.open('service', 'service')} accent={accent} accentRgb={accentRgb} buttonStyle={fieldBtn} panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', minWidth: 220, zIndex: 60 }} {...assistProps('service')} />
              </div>
              <div>
                <span style={colLabel}>年月日</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13.5, color: '#5b6773', height: 36 }}>
                  <span>令和8年</span>
                  <input className="field-input" value={month} onChange={(e) => setMonth(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} inputMode="numeric" style={{ ...input, width: 40, padding: '8px 2px', textAlign: 'center' }} />
                  <span>月</span>
                  <input className="field-input" value={day} onChange={(e) => setDay(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} inputMode="numeric" style={{ ...input, width: 40, padding: '8px 2px', textAlign: 'center' }} />
                  <span>日</span>
                </div>
              </div>
              <div>
                <span style={colLabel}>伝票No</span>
                <div style={{ height: 36, display: 'flex', alignItems: 'center', padding: '0 12px', background: '#f5f7f9', border: '1px solid #e2e8ee', borderRadius: 8, fontSize: 13, color: '#9aa5b1' }}>自動採番</div>
              </div>
            </div>
          </div>

          {/* 行見出し */}
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '9px 22px', background: '#f6f8fa', fontSize: 10.5, fontWeight: 700, color: '#8290a0', borderBottom: '1px solid #eef2f5' }}>
            <div>#</div>
            <div style={{ textAlign: 'right', color: BLUE }}>借方 金額</div>
            <div style={{ color: BLUE }}>借方科目 <span style={{ color: '#b3bcc5', fontWeight: 500 }}>／ 資金科目（自動）／ 摘要</span></div>
            <div style={{ color: PINK }}>貸方科目 <span style={{ color: '#b3bcc5', fontWeight: 500 }}>／ 資金科目（自動）</span></div>
            <div style={{ textAlign: 'right', color: PINK }}>貸方 金額</div>
          </div>

          {rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '10px 22px', borderBottom: '1px solid #f1f4f6', alignItems: 'start' }}>
              <div style={{ color: '#9aa5b1', fontSize: 12, paddingTop: 10 }}>{i + 1}</div>
              <input className="field-input ring" value={fmtAmount(r.kariAmt)} onChange={(e) => setRow(i, { kariAmt: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" placeholder="0" style={amt} />
              <div>
                <AssistField value={r.kari} placeholder="借方科目を選択" onOpen={() => assist.open(`row:${i}:kari`, 'account')} accent={BLUE} accentRgb={BLUE_RGB} buttonStyle={fieldBtn} panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', minWidth: 260, zIndex: 60 }} {...assistProps(`row:${i}:kari`)} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 5 }}>
                  <span style={{ fontSize: 10.5, color: '#b3bcc5', flex: 'none' }}>資金科目：自動</span>
                  <input className="field-input" value={r.tekiyo} onChange={(e) => setRow(i, { tekiyo: e.target.value })} placeholder="摘要（任意）" autoComplete="off" style={{ ...input, padding: '4px 8px', fontSize: 12 }} />
                </div>
              </div>
              <div>
                <AssistField value={r.kashi} placeholder="貸方科目を選択" onOpen={() => assist.open(`row:${i}:kashi`, 'account')} accent={PINK} accentRgb={PINK_RGB} buttonStyle={fieldBtn} panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', minWidth: 260, zIndex: 60 }} {...assistProps(`row:${i}:kashi`)} />
                <div style={{ fontSize: 10.5, color: '#b3bcc5', marginTop: 5, lineHeight: '24px' }}>資金科目：自動</div>
              </div>
              <input className="field-input ring" value={fmtAmount(r.kashiAmt)} onChange={(e) => setRow(i, { kashiAmt: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" placeholder="0" style={amt} />
            </div>
          ))}

          {/* 合計・登録 */}
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '12px 22px', background: '#fbfcfd', alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8290a0' }}>合計</div>
            <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 16, color: BLUE, fontVariantNumeric: 'tabular-nums' }}>{kariTotal.toLocaleString('ja-JP')}</div>
            <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: balanced ? '#eaf5ef' : '#fdeee9', color: balanced ? '#1f7a52' : '#c0392b' }}>
                {balanced ? '貸借一致' : `差額 ${Math.abs(kariTotal - kashiTotal).toLocaleString('ja-JP')}`}
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5b6773' }}>
                証憑
                <button type="button" className="chip" onClick={() => setShohyo((s) => !s)} style={{ height: 28, padding: '0 12px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: shohyo ? '#eaf5ef' : '#fff', color: shohyo ? '#1f7a52' : '#9aa5b1', border: '1px solid ' + (shohyo ? '#bfe0cf' : '#cfd8e0') }}>
                  {shohyo ? '有' : '無'}
                </button>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5b6773' }}>
                小切手No
                <input className="field-input" value={cheque} onChange={(e) => setCheque(e.target.value)} placeholder="任意" autoComplete="off" style={{ ...input, width: 110, padding: '5px 8px', fontSize: 12 }} />
              </label>
              <span style={{ fontSize: 12, color: '#9aa5b1' }}>Seq No：自動</span>
              <span style={{ color: '#c0392b', fontSize: 12.5, fontWeight: 500 }}>{err}</span>
            </div>
            <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 16, color: PINK, fontVariantNumeric: 'tabular-nums' }}>{kashiTotal.toLocaleString('ja-JP')}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '4px 22px 16px' }}>
            <button type="button" className="btn-outline" onClick={() => toast.show(NOT_IMPL)} style={{ padding: '9px 16px', border: '1px solid #cfd8e0', borderRadius: 8, background: '#fff', color: '#5b6773', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
              区分選択
            </button>
            <button type="button" className="submit-btn" onClick={submit} style={{ padding: '9px 28px', background: accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', boxShadow: `0 3px 12px rgba(${accentRgb},.24)` }}>
              {title}を登録
            </button>
          </div>
        </div>

        {/* 当年仕訳一覧（既存の右側リストに相当） */}
        <div style={{ background: '#fff', border: '1px solid #dde4ea', borderRadius: isSheet ? 14 : 16, boxShadow: '0 6px 26px rgba(30,50,70,.07)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px', borderBottom: '1px solid #eef2f5' }}>
            <span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 15 }}>当年仕訳</span>
            <FiscalMonthTabs current={monthFilter} accent={accent} onSelect={setMonthFilter} withAll />
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8895a3' }}><b style={{ color: '#22303c' }}>{list.length}</b> 件</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '60px minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,1.4fr) 120px', gap: 14, padding: '9px 22px', background: '#f6f8fa', fontSize: 10.5, fontWeight: 700, color: '#8290a0', borderBottom: '1px solid #eef2f5' }}>
            <div>月日</div>
            <div>借方科目</div>
            <div>貸方科目</div>
            <div>摘要</div>
            <div style={{ textAlign: 'right' }}>金額</div>
          </div>
          <div id="journal-scroll" style={{ overflowY: 'auto', maxHeight: 320 }}>
            {list.length === 0 && <div style={{ padding: '32px 22px', textAlign: 'center', color: '#9aa5b1', fontSize: 13 }}>この月の仕訳はありません。</div>}
            {list.map((e) => {
              const isNew = lastIds.includes(e.id);
              return (
                <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '60px minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,1.4fr) 120px', gap: 14, padding: '9px 22px', borderBottom: '1px solid #f1f4f6', fontSize: 12.5, alignItems: 'center', background: isNew ? '#fff2c9' : 'transparent', animation: isNew ? 'rowin 1.8s ease' : 'none' }}>
                  <div style={{ color: '#8895a3', fontSize: 12 }}>{e.date}</div>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.kari}</div>
                  <div style={{ color: '#48565f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.kashi}</div>
                  <div style={{ color: '#7a8794', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.tekiyo}</div>
                  <div style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{e.amount.toLocaleString('ja-JP')}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
