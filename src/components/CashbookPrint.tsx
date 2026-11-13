// 小口現金出納帳／預金出納帳の印刷の条件画面（確認メモ #235）
//   集計内訳表・仕訳伝票：「集計内訳表を印刷する明細を選んでください」。◉集計単位で選ぶ（期間・明細の一覧）／○月で選ぶ（集計した年月）
//   出納帳印刷：印刷ページ範囲指定／印刷ページの様式／用紙位置調整。［出納帳設定］［Excel出力］／［印刷］［プレビュー］［キャンセル］
//   印刷・Excel出力は ExportDialog（runExport）、プレビューは PreviewModal に渡す（CashbookPage 側で組み立てる）。
//   入力のあるモーダルなので、閉じるのは × と「キャンセル」だけ（Esc・外側のクリックでは閉じない）。

import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Modal } from './Modal';
import { TD, TH } from './ReportShell';

export type PrintRun = 'print' | 'preview' | 'excel';

/** 集計した単位（1 回の「集計」で集計した明細のまとまり） */
export interface AggUnit {
  id: number;
  /** 期間の表示（例：令和8年 8月1日〜8月19日） */
  period: string;
  /** 印刷の対象になる明細の件数 */
  count: number;
  /** 集計した年月（'YYYY/M'）。「月で選ぶ」で使う */
  at: string;
}

const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, lineHeight: 1.6, cursor: 'pointer' };
const box: CSSProperties = { border: '1px solid #e2e8ee', borderRadius: 10, padding: '10px 14px 12px' };
const boxHead: CSSProperties = { fontSize: 14, fontWeight: 700, color: '#3d4a57', marginBottom: 6 };
const txt: CSSProperties = { boxSizing: 'border-box', padding: '5px 8px', border: '1px solid #cfd8e0', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#22303c' };
const mkBtn = (accent: string) => (primary?: boolean, color?: string): CSSProperties => ({ padding: '8px 16px', borderRadius: 8, border: primary ? 'none' : '1px solid #cfd8e0', background: primary ? accent : '#fff', color: primary ? '#fff' : color ?? '#5b6773', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' });
/** 年度内の年月（'YYYY/M'。令和8年度＝2026年4月〜2027年3月） */
const FISCAL_YM = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map((m) => `${m >= 4 ? 2026 : 2027}/${m}`);
export const ymText = (ym: string) => { const [y, m] = ym.split('/').map(Number); return `令和${y - 2018}年 ${m}月`; };

// ---------------- 集計内訳表・仕訳伝票 ----------------

export function AggPrintDialog({ open, report, units, accent, onRun, onClose }: {
  open: boolean;
  /** 帳票名（集計内訳表／仕訳伝票） */
  report: string;
  units: AggUnit[];
  accent: string;
  onRun: (run: PrintRun, unitIds: number[], cond: string) => void;
  onClose: () => void;
}) {
  const btn = mkBtn(accent);
  const [mode, setMode] = useState<'unit' | 'month'>('unit');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [ym, setYm] = useState(FISCAL_YM[0]);
  useEffect(() => {
    if (!open) return;
    setMode('unit');
    // はじめは、いちばん新しい集計を選んでおく
    setSel(new Set(units.length ? [units[units.length - 1].id] : []));
    setYm(units.length ? units[units.length - 1].at : FISCAL_YM[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 開いたときだけ初期化する（units は開くたびに作り直されるため）
  }, [open]);
  const monthUnits = units.filter((u) => u.at === ym);
  const ids = mode === 'unit' ? units.filter((u) => sel.has(u.id)).map((u) => u.id) : monthUnits.map((u) => u.id);
  const cond = mode === 'unit' ? `集計単位：${units.filter((u) => sel.has(u.id)).map((u) => u.period).join('、')}` : `${ymText(ym)}に集計した明細`;
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ok = ids.length > 0;
  const run = (r: PrintRun) => { if (ok) onRun(r, ids, cond); };
  const yms = Array.from(new Set([...FISCAL_YM, ...units.map((u) => u.at)]));
  return (
    <Modal open={open} onClose={onClose} width={640} title={report}>
      <div data-agg-print={report} style={{ padding: '14px 22px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{report}を印刷する明細を選んでください</div>
          <button type="button" className="btn-outline" disabled={!ok} onClick={() => run('excel')} style={{ ...btn(false, '#1f7a52'), opacity: ok ? 1 : 0.5 }}>Excel出力</button>
        </div>
        <div style={{ ...box, marginBottom: 10 }}>
          <label style={row}><input type="radio" name="agg-print-mode" checked={mode === 'unit'} onChange={() => setMode('unit')} />集計単位で選ぶ</label>
          <div style={{ marginTop: 6, maxHeight: 220, overflow: 'auto', border: '1px solid #e2e8ee', borderRadius: 8, opacity: mode === 'unit' ? 1 : 0.5 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ ...TH, width: 36 }} /><th style={TH}>期間</th><th style={{ ...TH, width: 80, textAlign: 'right' }}>明細</th></tr></thead>
              <tbody>
                {units.map((u) => {
                  const on = sel.has(u.id);
                  return (
                    <tr key={u.id} onClick={() => { if (mode === 'unit') toggle(u.id); }} style={{ background: on && mode === 'unit' ? '#eef5fc' : 'transparent', cursor: mode === 'unit' ? 'pointer' : 'default' }}>
                      <td style={TD}><input type="checkbox" checked={on} disabled={mode !== 'unit'} readOnly aria-label={`${u.period} を印刷する`} /></td>
                      <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{u.period}</td>
                      <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{u.count} 件</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div style={box}>
          <label style={row}><input type="radio" name="agg-print-mode" checked={mode === 'month'} onChange={() => setMode('month')} />月で選ぶ</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, opacity: mode === 'month' ? 1 : 0.5, flexWrap: 'wrap' }}>
            <select aria-label="集計した年月" value={ym} disabled={mode !== 'month'} onChange={(e) => setYm(e.target.value)} style={{ ...txt, width: 150 }}>{yms.map((v) => <option key={v} value={v}>{ymText(v)}</option>)}</select>
            <span style={{ fontSize: 12, color: '#7a8794' }}>指定された月の一ヶ月間に集計した明細を印刷します。</span>
          </div>
          {mode === 'month' && monthUnits.length === 0 && <div style={{ marginTop: 6, fontSize: 12, color: '#c0392b' }}>{ymText(ym)}に集計した明細はありません。</div>}
          {mode === 'month' && monthUnits.length > 0 && <div style={{ marginTop: 6, fontSize: 12, color: '#5b6773' }}>対象：{monthUnits.length} 回の集計（明細 {monthUnits.reduce((a, u) => a + u.count, 0)} 件）</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <span data-tip={ok ? undefined : '印刷する明細を選ぶと押せます'} style={{ display: 'inline-flex' }}><button type="button" className="submit-btn" disabled={!ok} onClick={() => run('print')} style={{ ...btn(true), opacity: ok ? 1 : 0.5 }}>印刷</button></span>
          <button type="button" className="btn-outline" disabled={!ok} onClick={() => run('preview')} style={{ ...btn(), opacity: ok ? 1 : 0.5 }}>プレビュー</button>
          <button type="button" onClick={onClose} style={btn()}>キャンセル</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------- 出納帳印刷 ----------------

export const PAGE_STYLES = ['ページ番号のみ (1,2,3…)', '指定ページ番号と指定した最後のページ (1/5…)', '印刷番号と印刷枚数', '指定ページ番号と総ページ数', 'ページ番号を印刷しない'] as const;
export type PageStyle = (typeof PAGE_STYLES)[number];
export interface LedgerPrintOpts { all: boolean; from: number; to: number; style: PageStyle; left: number; top: number }
/** ページ番号の文字（page＝ページ番号、k＝印刷する何枚目か（1 始まり）、n＝印刷枚数、last＝指定した最後のページ、total＝総ページ数） */
export function pageLabel(style: PageStyle, page: number, k: number, n: number, last: number, total: number): string {
  if (style === PAGE_STYLES[0]) return String(page);
  if (style === PAGE_STYLES[1]) return `${page}/${last}`;
  if (style === PAGE_STYLES[2]) return `${k}/${n}`;
  if (style === PAGE_STYLES[3]) return `${page}/${total}`;
  return '';
}

export function LedgerPrintDialog({ open, report, pageCount, accent, onRun, onSettings, onClose }: {
  open: boolean;
  /** 帳票名（小口現金出納帳／預金出納帳） */
  report: string;
  /** 総ページ数（「改ページ」の行で区切ったページの数） */
  pageCount: number;
  accent: string;
  onRun: (run: PrintRun, o: LedgerPrintOpts) => void;
  /** ［出納帳設定］：小口の設定（預金の設定）の「印刷設定」を開く */
  onSettings: () => void;
  onClose: () => void;
}) {
  const btn = mkBtn(accent);
  const [all, setAll] = useState(true);
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('1');
  const [style, setStyle] = useState<PageStyle>(PAGE_STYLES[0]);
  const [left, setLeft] = useState('0');
  const [top, setTop] = useState('0');
  useEffect(() => { if (open) { setAll(true); setFrom('1'); setTo(String(pageCount)); } }, [open, pageCount]);
  const f = parseInt(from, 10) || 0;
  const t = parseInt(to, 10) || 0;
  const err = all ? '' : f < 1 || t < 1 ? 'ページを入力してください' : f > t ? '開始のページは、終わりのページ以下にしてください' : t > pageCount ? `ページは 1〜${pageCount} の範囲で指定してください` : '';
  const run = (r: PrintRun) => { if (!err) onRun(r, { all, from: all ? 1 : f, to: all ? pageCount : t, style, left: parseFloat(left) || 0, top: parseFloat(top) || 0 }); };
  const num = (v: string, set: (s: string) => void, label: string, w = 60, disabled = false) => (
    <input aria-label={label} inputMode="numeric" value={v} disabled={disabled} maxLength={3} onChange={(e) => set(e.target.value.replace(/[^0-9.]/g, ''))} style={{ ...txt, width: w, textAlign: 'right', background: disabled ? '#f3f6f9' : '#fff' }} />
  );
  const Sec = ({ title, children }: { title: string; children: ReactNode }) => <div style={box}><div style={boxHead}>{title}</div>{children}</div>;
  return (
    <Modal open={open} onClose={onClose} width={840} title="出納帳印刷">
      <div data-ledger-print style={{ padding: '14px 22px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{report}<span style={{ fontSize: 12, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>総ページ数 {pageCount}（「改ページ」の行でページを区切ります）</span></div>
          <button type="button" className="btn-outline" onClick={onSettings} title="印刷する欄・表題・捺印欄などの設定（小口の設定の「印刷設定」）" style={btn()}>出納帳設定</button>
          <button type="button" className="btn-outline" disabled={!!err} onClick={() => run('excel')} style={{ ...btn(false, '#1f7a52'), opacity: err ? 0.5 : 1 }}>Excel出力</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            {Sec({ title: '印刷ページ範囲指定', children: (
              <>
                <label style={row}><input type="radio" name="ledger-range" checked={all} onChange={() => setAll(true)} />すべて</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <label style={row}><input type="radio" name="ledger-range" checked={!all} onChange={() => setAll(false)} />ページ指定</label>
                  {num(from, setFrom, '開始ページ', 52, all)}<span style={{ fontSize: 14 }}>ページから</span>
                  {num(to, setTo, '終わりのページ', 52, all)}<span style={{ fontSize: 14 }}>ページまで</span>
                </div>
                {err && <div style={{ marginTop: 4, fontSize: 12, color: '#c0392b' }}>{err}</div>}
              </>
            ) })}
            {Sec({ title: '用紙位置調整', children: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 14 }}>
                <span>左余白</span>{num(left, setLeft, '左余白（ミリ）')}<span>ミリ</span>
                <span style={{ marginLeft: 12 }}>上余白</span>{num(top, setTop, '上余白（ミリ）')}<span>ミリ</span>
              </div>
            ) })}
          </div>
          {Sec({ title: '印刷ページの様式', children: (
            <>{PAGE_STYLES.map((s) => <label key={s} style={row}><input type="radio" name="ledger-style" checked={style === s} onChange={() => setStyle(s)} />{s}</label>)}</>
          ) })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button type="button" className="submit-btn" disabled={!!err} onClick={() => run('print')} style={{ ...btn(true), opacity: err ? 0.5 : 1 }}>印刷</button>
          <button type="button" className="btn-outline" disabled={!!err} onClick={() => run('preview')} style={{ ...btn(), opacity: err ? 0.5 : 1 }}>プレビュー</button>
          <button type="button" onClick={onClose} style={btn()}>キャンセル</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------- プレビューの中身（PreviewModal の children） ----------------

export interface SheetPage { header: string[]; rows: (string | number)[][]; label: string }

/** 帳票のページ（表・ページ番号・捺印欄）を縦に並べて描く。margin はミリ（1 ミリ ≒ 3.8px） */
export function SheetPages({ pages, meta, stamps, margin }: { pages: SheetPage[]; meta?: string; stamps?: string[] | null; margin?: { left: number; top: number } }) {
  const ml = (margin?.left ?? 0) * 3.8;
  const mt = (margin?.top ?? 0) * 3.8;
  return (
    <div style={{ paddingLeft: ml, paddingTop: mt }}>
      {meta && <div style={{ textAlign: 'center', fontSize: 12, color: '#5b6773', marginBottom: 10 }}>{meta}</div>}
      {pages.map((p, i) => (
        <div key={i} style={{ marginBottom: 18 }}>
          {i > 0 && <div style={{ borderTop: '1px dashed #9aa5b1', margin: '0 0 12px', textAlign: 'center', fontSize: 10, color: '#9aa5b1' }}>（ページの区切り）</div>}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead><tr>{p.header.map((h, k) => <th key={k} style={{ border: '1px solid #9aa5b1', padding: 3, background: '#eef2f6', textAlign: typeof p.rows[0]?.[k] === 'number' ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
            <tbody>{p.rows.map((r, k) => <tr key={k}>{r.map((v, j) => <td key={j} style={{ border: '1px solid #9aa5b1', padding: 3, textAlign: typeof v === 'number' ? 'right' : 'left', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{typeof v === 'number' ? (v ? v.toLocaleString('ja-JP') : '') : v}</td>)}</tr>)}</tbody>
          </table>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ display: 'flex', gap: 3 }}>
              {stamps && stamps.map((s, k) => <span key={k} style={{ width: 44, height: 44, border: '1px solid #9aa5b1', display: 'inline-flex', alignItems: 'flex-start', justifyContent: 'center', fontSize: 9, color: '#5b6773', paddingTop: 2, boxSizing: 'border-box' }}>{s}</span>)}
            </span>
            <span style={{ fontSize: 11, color: '#5b6773' }}>{p.label ? `- ${p.label} -` : ''}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
