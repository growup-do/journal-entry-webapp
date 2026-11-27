// 収支分析表の設定・編集（確認メモ #465。現行：印刷 › 収支分析表 ›［設定］「収支分析表の設定」）
//   1行ごとに、左（収入側）と右（支出側）の科目名称・金額の決定方法・背景色・文字色・集計する資金科目、
//   3つ目の欄（差引過△不足）の決め方を設定する。計算式は L2（収入の2行目）・R1（支出の1行目）で書く。
//   ［設定読込］［設定書込］は収支分析表ファイル（.csb）を読み書きする。
//   設定は法人全体で1つ（印刷の詳細設定タブとは別）。プロトタイプなので画面を読み込み直すと既定に戻る。

import { useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import { HelpTip, btn, input } from './ui';

export type SideMethod = '資金科目指定' | '元帳表示による伝票選択' | '金額手入力' | '空白設定' | string;
export const LEFT_METHODS = ['資金科目指定', '元帳表示による伝票選択', '金額手入力', '空白設定', '特質Ａ', '特質Ｄ', '特質Ｇ', '特質Ｊ'];
export const RIGHT_METHODS = ['資金科目指定', '元帳表示による伝票選択', '金額手入力', '空白設定', '特質Ｂ', '特質Ｅ', '特質Ｈ', '特質Ｋ', '特質Ｍ'];
export const DIFF_METHODS = ['', '金額手入力', '空白設定', '特質Ｃ', '特質Ｆ', '特質Ｉ', '特質Ｌ', '計算式'];

export interface Side { name: string; method: SideMethod; amount: string; bg: string; fg: string; funds: string[] }
export interface AnalysisRow { left: Side; right: Side; diff: string; diffAmount: string; formula: string }

/** 資金科目の一覧（字下げで階層を表す。total＝合計行） */
interface FundLine { name: string; depth: number; total?: boolean }
const L = (name: string, depth = 1): FundLine => ({ name, depth });
const T = (name: string): FundLine => ({ name, depth: 0, total: true });
export const INCOME_FUNDS: FundLine[] = [
  L('保育事業収入', 0), L('委託費収入'), L('利用者等利用料収入'), L('その他の事業収入'), L('補助金事業収入', 2), L('受託事業収入', 2), L('その他の事業収入', 2),
  L('借入金利息補助金収入', 0), L('経常経費寄附金収入', 0), L('受取利息配当金収入', 0), L('その他の収入', 0), L('受入研修費収入'), L('利用者等外給食費収入'), L('雑収入'),
  T('事業活動収入計(1)'),
  L('施設整備等補助金収入', 0), L('施設整備等補助金収入'), L('設備資金借入金元金償還補助金収入'), L('施設整備等寄附金収入', 0), L('設備資金借入金収入', 0), L('固定資産売却収入', 0), L('その他の施設整備等による収入', 0),
  T('施設整備等収入計(4)'),
  L('長期運営資金借入金元金償還寄附金収入', 0), L('長期運営資金借入金収入', 0), L('積立資産取崩収入', 0), L('人件費積立資産取崩収入'), L('修繕積立資産取崩収入'), L('備品等購入積立資産取崩収入'), L('保育所施設・設備整備積立資産取崩収入'),
  L('事業区分間繰入金収入', 0), L('拠点区分間繰入金収入', 0), L('その他の活動による収入', 0),
  T('その他の活動収入計(7)'),
];
export const EXPENSE_FUNDS: FundLine[] = [
  L('人件費支出', 0), L('職員給料支出'), L('職員俸給', 2), L('職員諸手当', 2), L('職員賞与支出'), L('非常勤職員給与支出'), L('派遣職員費支出'), L('退職給付支出'), L('法定福利費支出'),
  L('事業費支出', 0), L('給食費支出'), L('保健衛生費支出'), L('保育材料費支出'), L('水道光熱費支出'), L('燃料費支出'), L('消耗器具備品費支出'), L('保険料支出'), L('賃借料支出'), L('車輌費支出'), L('雑支出'),
  L('事務費支出', 0), L('福利厚生費支出'), L('職員被服費支出'), L('旅費交通費支出'), L('研修研究費支出'), L('事務消耗品費支出'), L('印刷製本費支出'), L('通信運搬費支出'), L('会議費支出'), L('広報費支出'), L('業務委託費支出'), L('手数料支出'), L('土地・建物賃借料支出'), L('租税公課支出'), L('保守料支出'),
  L('支払利息支出', 0), L('その他の支出', 0),
  T('事業活動支出計(2)'),
  L('設備資金借入金元金償還支出', 0), L('固定資産取得支出', 0), L('建物取得支出'), L('器具及び備品取得支出'), L('ソフトウェア取得支出'), L('その他の施設整備等による支出', 0),
  T('施設整備等支出計(5)'),
  L('長期運営資金借入金元金償還支出', 0), L('積立資産支出', 0), L('人件費積立資産支出'), L('修繕積立資産支出'), L('備品等購入積立資産支出'), L('保育所施設・設備整備積立資産支出'),
  L('事業区分間繰入金支出', 0), L('拠点区分間繰入金支出', 0), L('その他の活動による支出', 0),
  T('その他の活動支出計(8)'),
];

const side = (name: string, funds: string[], method: SideMethod = '資金科目指定'): Side => ({ name, method, amount: '', bg: '', fg: '#000000', funds });
const blank = (): Side => side('', [], '資金科目指定');
export const newRow = (): AnalysisRow => ({ left: blank(), right: blank(), diff: '', diffAmount: '', formula: '' });
/** 既定の行（例） */
const DEFAULT_ROWS = (): AnalysisRow[] => [
  { left: side('委託費収入', ['委託費収入']), right: side('人件費支出', ['人件費支出']), diff: '', diffAmount: '', formula: '' },
  { left: side('その他の事業収入', ['利用者等利用料収入', 'その他の事業収入']), right: side('事業費支出', ['事業費支出']), diff: '', diffAmount: '', formula: '' },
  { left: side('その他の収入', ['経常経費寄附金収入', '受取利息配当金収入', 'その他の収入']), right: side('事務費支出', ['事務費支出']), diff: '', diffAmount: '', formula: '' },
  { left: { ...side('事業活動収入計', [], '空白設定'), bg: '#fff3c4' }, right: { ...side('積立資産支出', ['積立資産支出']), bg: '#fff3c4' }, diff: '計算式', diffAmount: '', formula: 'L1+L2+L3-R1-R2-R3-R4' },
];

/* ---------- 法人全体で1つの設定 ---------- */
let rowsStore: AnalysisRow[] = DEFAULT_ROWS();
const subs = new Set<() => void>();
export const getAnalysisRows = () => rowsStore;
const setAnalysisRows = (r: AnalysisRow[]) => { rowsStore = r; subs.forEach((f) => f()); };
export const useAnalysisRows = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => rowsStore);
const clone = (r: AnalysisRow[]): AnalysisRow[] => r.map((x) => ({ ...x, left: { ...x.left, funds: [...x.left.funds] }, right: { ...x.right, funds: [...x.right.funds] } }));

/* ---------- 金額（プレビュー・印刷用の見本） ---------- */
const amountOfFund = (name: string) => { let h = 11; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return (h % 9000) * 1000 + 500000; };
const toNum = (s: string) => Number(s.replace(/[^0-9-]/g, '')) || 0;
const sideAmount = (s: Side): number | '' => (s.method === '資金科目指定' ? s.funds.reduce((a, f) => a + amountOfFund(f), 0) : s.method === '金額手入力' ? toNum(s.amount) : s.method === '空白設定' ? '' : 0);
/** 計算式（L2-R1 など）を、各行の金額で計算する */
const evalFormula = (f: string, rows: AnalysisRow[]): number | '' => {
  const expr = f.toUpperCase().replace(/\s/g, '');
  if (!expr || !/^[LR0-9+\-()]+$/.test(expr)) return '';
  const val = (side: string, n: number) => { const r = rows[n - 1]; const v = r ? sideAmount(side === 'L' ? r.left : r.right) : 0; return typeof v === 'number' ? v : 0; };
  try { return Function(`return (${expr.replace(/([LR])(\d+)/g, (_, s, n) => String(val(s, Number(n))))})`)() as number; } catch { return ''; }
};
/** 収支分析表の表データ（行の設定どおり） */
export function analysisTable(thousand = true): { header: string[]; rows: (string | number)[][] } {
  const rows = getAnalysisRows();
  const k = (v: number | '') => (v === '' ? '' : thousand ? Math.round(v / 1000) : v);
  const unit = thousand ? '金額　千円' : '金額　円';
  return {
    header: ['収入科目', unit, '支出科目', unit, '差引過△不足'],
    rows: rows.map((r) => [r.left.name, k(sideAmount(r.left)), r.right.name, k(sideAmount(r.right)), k(r.diff === '計算式' ? evalFormula(r.formula, rows) : r.diff === '金額手入力' ? toNum(r.diffAmount) : r.diff === '' || r.diff === '空白設定' ? '' : 0)]),
  };
}

/* ---------- 画面 ---------- */
export function ShushiBunsekiSetup({ accent, toast }: { accent: string; toast: (m: string) => void }) {
  const saved = useAnalysisRows();
  const [d, setD] = useState<AnalysisRow[]>(() => clone(saved));
  const [sel, setSel] = useState<number | null>(() => (saved.length ? 0 : null));
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const cur = sel != null ? d[sel] : null;
  const put = (i: number, r: AnalysisRow) => setD((x) => x.map((y, k) => (k === i ? r : y)));
  const putSide = (key: 'left' | 'right', patch: Partial<Side>) => { if (sel == null || !cur) return; put(sel, { ...cur, [key]: { ...cur[key], ...patch } }); };

  const th: CSSProperties = { padding: '6px 8px', fontSize: 12, fontWeight: 700, color: '#5b6773', background: '#f6f8fa', borderBottom: '1px solid #e2e8ee', textAlign: 'left', whiteSpace: 'nowrap' };
  const td: CSSProperties = { padding: '5px 8px', borderBottom: '1px solid #f1f4f6', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  const lbl: CSSProperties = { fontSize: 12, fontWeight: 700, color: '#5b6773', display: 'block', marginBottom: 4 };
  const field: CSSProperties = { ...input, padding: '6px 10px' };
  const diffLabel = (r: AnalysisRow) => r.diff === '' ? '' : r.diff;

  const sideEditor = (key: 'left' | 'right') => {
    const s = cur?.[key];
    const off = !s;
    const methods = key === 'left' ? LEFT_METHODS : RIGHT_METHODS;
    const funds = key === 'left' ? INCOME_FUNDS : EXPENSE_FUNDS;
    const fundOn = !!s && s.method === '資金科目指定';
    return (
      <div data-analysis-side={key} style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: '10px 12px', display: 'grid', gap: 8, alignContent: 'start', opacity: off ? 0.55 : 1, minWidth: 0 }}>
        <b style={{ fontSize: 14 }}>{key === 'left' ? '収入側' : '支出側'}</b>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
          <div><span style={lbl}>収支分析表　科目名称</span><input className="field-input" data-analysis-name={key} disabled={off} value={s?.name ?? ''} onChange={(e) => putSide(key, { name: e.target.value })} style={field} /></div>
          <div><span style={lbl}>金額の決定方法</span><select data-analysis-method={key} disabled={off} value={s?.method ?? methods[0]} onChange={(e) => putSide(key, { method: e.target.value })} style={field}>{methods.map((o) => <option key={o}>{o}</option>)}</select></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 14 }}>
          {s?.method === '金額手入力' && <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>金額<input className="field-input" data-analysis-amount={key} inputMode="numeric" value={s.amount} onChange={(e) => putSide(key, { amount: e.target.value.replace(/[^0-9,-]/g, '') })} style={{ ...field, width: 140, textAlign: 'right' }} />円</label>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>背景色<input type="color" aria-label={`${key === 'left' ? '収入側' : '支出側'}の背景色`} disabled={off} value={s?.bg || '#ffffff'} onChange={(e) => putSide(key, { bg: e.target.value })} style={{ width: 36, height: 26, padding: 0, border: '1px solid #cfd8e0', borderRadius: 4 }} />
            {s?.bg && <button type="button" onClick={() => putSide(key, { bg: '' })} style={btn('#5b6773', false, true)}>無色</button>}</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>文字色<input type="color" aria-label={`${key === 'left' ? '収入側' : '支出側'}の文字色`} disabled={off} value={s?.fg || '#000000'} onChange={(e) => putSide(key, { fg: e.target.value })} style={{ width: 36, height: 26, padding: 0, border: '1px solid #cfd8e0', borderRadius: 4 }} /></label>
        </div>
        <div data-analysis-funds={key} style={{ border: '1px solid #e2e8ee', borderRadius: 8, maxHeight: 180, overflowY: 'auto', background: fundOn ? '#fff' : '#f5f7f9' }}>
          {funds.map((f, i) => {
            const on = !!s?.funds.includes(f.name);
            return (
              <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', paddingLeft: 8 + f.depth * 16, fontSize: 14, fontWeight: f.total ? 700 : 400, color: fundOn ? '#22303c' : '#9aa5b1', background: f.total ? '#f6f8fa' : undefined, cursor: fundOn ? 'pointer' : 'default' }}>
                <input type="checkbox" disabled={!fundOn} checked={on} onChange={() => s && putSide(key, { funds: on ? s.funds.filter((x) => x !== f.name) : [...s.funds, f.name] })} style={{ margin: 0 }} />{f.name}
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  const exportFile = () => {
    const blob = new Blob([JSON.stringify({ kind: '収支分析表', rows: d }, null, 2)], { type: 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '収支分析表.csb'; a.click(); URL.revokeObjectURL(a.href);
    toast('収支分析表.csb に書き出しました');
  };
  const importFile = async (file: File) => {
    try {
      const o = JSON.parse(await file.text()) as { kind?: string; rows?: AnalysisRow[] };
      if (o.kind !== '収支分析表' || !Array.isArray(o.rows)) throw new Error();
      setD(clone(o.rows)); setSel(o.rows.length ? 0 : null);
      toast(`「${file.name}」を読み込みました（${o.rows.length} 行）。決定で確定します`);
    } catch { toast('収支分析表ファイルとして読み込めませんでした'); }
  };

  return (
    <div data-analysis-setup style={{ display: 'grid', gap: 10 }}>
      {/* 行の一覧 */}
      <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup><col style={{ width: 44 }} /><col /><col style={{ width: 150 }} /><col /><col style={{ width: 150 }} /><col style={{ width: 150 }} /></colgroup>
            <thead style={{ position: 'sticky', top: 0 }}><tr><th style={{ ...th, textAlign: 'right' }}>行</th><th style={th}>科目（収入側）</th><th style={th}>金額</th><th style={th}>科目（支出側）</th><th style={th}>金額</th><th style={th}>金額</th></tr></thead>
            <tbody>
              {d.map((r, i) => (
                <tr key={i} data-analysis-row={i + 1} onClick={() => setSel(i)} style={{ cursor: 'pointer', outline: sel === i ? `2px solid ${accent}` : undefined, outlineOffset: -2 }}>
                  <td style={{ ...td, textAlign: 'right', color: '#8290a0', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</td>
                  <td style={{ ...td, background: r.left.bg || undefined, color: r.left.fg || undefined }}>{r.left.name}</td>
                  <td style={{ ...td, color: '#5b6773' }}>{r.left.method}</td>
                  <td style={{ ...td, background: r.right.bg || undefined, color: r.right.fg || undefined }}>{r.right.name}</td>
                  <td style={{ ...td, color: '#5b6773' }}>{r.right.method}</td>
                  <td style={{ ...td, color: '#5b6773' }}>{diffLabel(r)}</td>
                </tr>
              ))}
              {d.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#9aa5b1', padding: 18 }}>行がありません。</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" data-analysis-insert disabled={sel == null} onClick={() => { if (sel == null) return; setD((x) => [...x.slice(0, sel), newRow(), ...x.slice(sel)]); }} style={{ ...btn('#5b6773', false, true), opacity: sel == null ? 0.5 : 1 }}>行挿入</button>
        <button type="button" data-analysis-add onClick={() => { setD((x) => [...x, newRow()]); setSel(d.length); }} style={btn(accent, false, true)}>行追加</button>
        <button type="button" data-analysis-del disabled={sel == null} onClick={() => { if (sel == null) return; setD((x) => x.filter((_, k) => k !== sel)); setSel(d.length > 1 ? Math.max(0, sel - 1) : null); }} style={{ ...btn('#c0392b', false, true), opacity: sel == null ? 0.5 : 1 }}>行削除</button>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button type="button" data-analysis-read onClick={() => fileRef.current?.click()} style={btn('#5b6773', false, true)}>設定読込</button>
          <button type="button" data-analysis-write onClick={exportFile} style={btn('#5b6773', false, true)}>設定書込</button>
          <input ref={fileRef} type="file" accept=".csb" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
        </span>
      </div>

      {/* 選んだ行の編集 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 220px', gap: 10, alignItems: 'start' }}>
        {sideEditor('left')}
        {sideEditor('right')}
        <div data-analysis-diff style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: '10px 12px', display: 'grid', gap: 8, opacity: cur ? 1 : 0.55 }}>
          <b style={{ fontSize: 14 }}>差引過△不足</b>
          <div><span style={lbl}>金額の決定方法</span><select data-analysis-diff-method disabled={!cur} value={cur?.diff ?? ''} onChange={(e) => sel != null && cur && put(sel, { ...cur, diff: e.target.value })} style={field}>{DIFF_METHODS.map((o) => <option key={o} value={o}>{o || '（空白）'}</option>)}</select></div>
          {cur?.diff === '金額手入力' && <div><span style={lbl}>金額（円）</span><input className="field-input" inputMode="numeric" value={cur.diffAmount} onChange={(e) => sel != null && put(sel, { ...cur, diffAmount: e.target.value.replace(/[^0-9,-]/g, '') })} style={{ ...field, textAlign: 'right' }} /></div>}
          {cur?.diff === '計算式' && <div><span style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 4 }}>計算式<HelpTip text={['収入の２行目は L2、支出の１行目は R1 と入力します', '入力例：L2-R1']} /></span><input className="field-input" data-analysis-formula value={cur.formula} onChange={(e) => sel != null && put(sel, { ...cur, formula: e.target.value.toUpperCase() })} placeholder="L2-R1" style={field} /></div>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        {dirty && <span data-analysis-dirty style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: '#fff7e6', color: '#8a5a00' }}>決定で変更内容を確定してください。</span>}
        <button type="button" data-analysis-cancel disabled={!dirty} onClick={() => { setD(clone(saved)); setSel(saved.length ? 0 : null); toast('変更を取り消しました'); }} style={{ ...btn(), opacity: dirty ? 1 : 0.45 }}>中止</button>
        <button type="button" className="submit-btn" data-analysis-save disabled={!dirty} onClick={() => { setAnalysisRows(clone(d)); toast(`収支分析表の設定を保存しました（${d.length} 行）`); }} style={{ ...btn(accent, true), opacity: dirty ? 1 : 0.45 }}>決定</button>
      </div>
    </div>
  );
}
