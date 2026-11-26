// 印刷の詳細設定から開く小さな画面（Windows の現行画面で項目を確認。確認メモ #314・#338・#339・#342・#343・#345・#346）
//   ・印刷書式設定 … 仕訳日記帳（フォントだけ）、試算表・予算管理表（印刷幅＋科目名・金額）、予算書（印刷幅＋科目名・金額・摘要）
//   ・内訳書－印刷書式 … 予算内訳表（用紙・印刷幅・用紙方向・ヘッダーなど4行のフォント）
//   ・表示区分選択 … 予算内訳表の「印刷区分を指定する」（No ごとに区分・小計・内部取引消去・合計・計算式を選び、印刷用列名を変えられる。1ページの区分数ごとに色を変える）
//   ・摘要 … 予算書の科目ごとの備考（使えない文字は入力できない）
//   ・科目毎の表示設定 … 印刷位置の「科目毎に指定」で使う（科目ごとに表示する／しない）
//   入力画面なので、Esc や背景のクリックでは閉じない（Modal の既定）。

import { useId, useState } from 'react';
import { Modal } from './Modal';
import { btn, input, HelpTip } from './ui';
import { ACCOUNTS } from '../data';
import { ACCOUNT_META } from '../lib/accounts';
/** 資金科目の一覧（科目設定の［資金科目］。確認メモ #366） */
export const FUND_GROUPS: { group: string; items: string[] }[] = [
  { group: '事業活動による収入', items: [...new Set(ACCOUNT_META.filter((m) => m.cls === '収益' && m.fund).map((m) => m.fund))] },
  { group: '事業活動による支出', items: [...new Set(ACCOUNT_META.filter((m) => m.cls === '費用' && m.fund).map((m) => m.fund))] },
];

/** 書体（現行はパソコンに入っているフォントの一覧） */
export const FORMAT_FACES = ['ＭＳ 明朝', 'ＭＳ Ｐ明朝', 'ＭＳ ゴシック', 'ＭＳ Ｐゴシック', '游明朝', '游ゴシック', 'メイリオ', 'BIZ UD明朝', 'BIZ UDゴシック', 'Noto Serif JP', 'Noto Sans JP'];
const FORMAT_SIZES = ['4', '5', '6', '7', '8', '9', '10', '11', '12', '14', '16', '18', '20', '22', '24', '26', '28', '36', '48', '72'];
const STD_FONT: [string, string] = ['ＭＳ 明朝', '9'];

const box = { border: '1px solid #e2e8ee', borderRadius: 10, padding: '4px 14px 14px', margin: 0, display: 'grid', gap: 10 } as const;
const legend = { fontSize: 12, fontWeight: 800, color: '#5b6773', padding: '0 6px' } as const;
const note = { fontSize: 12, color: '#8290a0', lineHeight: 1.6 } as const;
const mmInput = (v: string, on: (v: string) => void, label: string) => <input className="field-input" aria-label={label} value={v} onChange={(e) => on(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" style={{ ...input, width: 80, padding: '6px 8px', textAlign: 'right' }} />;

function FontRow({ label, value, onChange, listId }: { label: string; value: [string, string]; onChange: (v: [string, string]) => void; listId: string }) {
  return (
    <div data-format-row={label} style={{ display: 'grid', gridTemplateColumns: '210px 1fr 96px', gap: 8, alignItems: 'center' }}>
      <span style={{ fontSize: 14 }}>{label}のフォントとサイズ</span>
      <select aria-label={`${label}の書体`} value={value[0]} onChange={(e) => onChange([e.target.value, value[1]])} style={{ ...input, padding: '6px 8px' }}>{FORMAT_FACES.map((o) => <option key={o}>{o}</option>)}</select>
      <input className="field-input" aria-label={`${label}のサイズ`} list={listId} value={value[1]} onChange={(e) => onChange([value[0], e.target.value.replace(/[^0-9.]/g, '')])} inputMode="decimal" style={{ ...input, padding: '6px 8px', textAlign: 'right' }} />
    </div>
  );
}
function Foot({ accent, onReset, onCancel, onOk }: { accent: string; onReset: () => void; onCancel: () => void; onOk: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button type="button" data-format-reset onClick={onReset} style={btn()}>リセット</button>
      <span style={note}>設定を標準に戻します。</span>
      <span style={{ flex: 1 }} />
      <button type="button" onClick={onCancel} style={btn()}>キャンセル</button>
      <button type="button" className="submit-btn" onClick={onOk} style={btn(accent, true)}>OK</button>
    </div>
  );
}

/* ---------------- 印刷書式設定 ---------------- */
export type FmtRow = 'name' | 'amount' | 'remark';
const ROW_LABEL: Record<FmtRow, string> = { name: '科目名', amount: '金額', remark: '摘要' };
export interface FormatSpec { widths?: [string, string]; rows: FmtRow[] }
export interface PrintFormat { widths?: [string, string]; fonts: Partial<Record<FmtRow, [string, string]>> }
export const stdFormat = (spec: FormatSpec): PrintFormat => ({ widths: spec.widths ? [...spec.widths] : undefined, fonts: Object.fromEntries(spec.rows.map((r) => [r, [...STD_FONT]])) });
export const formatSummary = (spec: FormatSpec, f: PrintFormat) => [f.widths ? `印刷幅 科目名 ${f.widths[0]}mm／金額 ${f.widths[1]}mm` : '', spec.rows.map((r) => `${ROW_LABEL[r]} ${(f.fonts[r] ?? STD_FONT).join(' ')}`).join('／')].filter(Boolean).join('・');

export function FormatDialog({ spec, value, accent, onCancel, onOk }: { spec: FormatSpec; value: PrintFormat; accent: string; onCancel: () => void; onOk: (f: PrintFormat) => void }) {
  const [f, setF] = useState<PrintFormat>(value);
  const listId = useId() + 'sizes';
  return (
    <Modal open onClose={onCancel} width={640} title="印刷書式設定">
      <div data-format-dialog style={{ padding: '14px 22px 18px', display: 'grid', gap: 14 }}>
        {f.widths && (
          <fieldset style={box}>
            <legend style={legend}>印刷幅</legend>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 14 }}>
              科目名{mmInput(f.widths[0], (v) => setF({ ...f, widths: [v, f.widths![1]] }), '印刷幅 科目名（mm）')}mm
              <span style={{ width: 12 }} />金額{mmInput(f.widths[1], (v) => setF({ ...f, widths: [f.widths![0], v] }), '印刷幅 金額（mm）')}mm
            </div>
          </fieldset>
        )}
        <fieldset style={box}>
          <legend style={legend}>フォント</legend>
          {spec.rows.map((r) => <FontRow key={r} label={ROW_LABEL[r]} value={f.fonts[r] ?? STD_FONT} onChange={(v) => setF({ ...f, fonts: { ...f.fonts, [r]: v } })} listId={listId} />)}
          <datalist id={listId}>{FORMAT_SIZES.map((o) => <option key={o} value={o} />)}</datalist>
          <div style={note}>サイズは一覧から選ぶか、数字を直接入力します。</div>
        </fieldset>
        <Foot accent={accent} onReset={() => setF(stdFormat(spec))} onCancel={onCancel} onOk={() => onOk({ widths: f.widths ? [f.widths[0] || spec.widths![0], f.widths[1] || spec.widths![1]] : undefined, fonts: Object.fromEntries(spec.rows.map((r) => { const v = f.fonts[r] ?? STD_FONT; return [r, [v[0], v[1] || '9']]; })) })} />
      </div>
    </Modal>
  );
}

/* ---------------- 内訳書－印刷書式（予算内訳表） ---------------- */
export interface InnerPrintFormat { paper: string; widths: [string, string]; orient: '縦' | '横'; header: [string, string]; headerItem: [string, string]; name: [string, string]; amount: [string, string] }
export const STD_INNER_PRINT: InnerPrintFormat = { paper: 'A4', widths: ['75', '22'], orient: '縦', header: [...STD_FONT], headerItem: [...STD_FONT], name: [...STD_FONT], amount: [...STD_FONT] };
export function InnerFormatDialog({ value, accent, onCancel, onOk, std = STD_INNER_PRINT }: { value: InnerPrintFormat; accent: string; onCancel: () => void; onOk: (f: InnerPrintFormat) => void; /** リセットで戻す標準 */ std?: InnerPrintFormat }) {
  const [f, setF] = useState(value);
  const listId = useId() + 'sizes';
  return (
    <Modal open onClose={onCancel} width={660} title="内訳書－印刷書式">
      <div data-inner-format-dialog style={{ padding: '14px 22px 18px', display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <fieldset style={box}>
            <legend style={legend}>用紙サイズ・用紙方向</legend>
            <select aria-label="用紙サイズ" value={f.paper} onChange={(e) => setF({ ...f, paper: e.target.value })} style={{ ...input, padding: '6px 8px' }}>{['A4', 'A3（A3対応プリンタのみ）'].map((o) => <option key={o}>{o}</option>)}</select>
            <div role="radiogroup" aria-label="用紙方向" style={{ display: 'flex', gap: 14, fontSize: 14 }}>{(['縦', '横'] as const).map((o) => <label key={o} style={{ display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}><input type="radio" checked={f.orient === o} onChange={() => setF({ ...f, orient: o })} />{o}</label>)}</div>
          </fieldset>
          <fieldset style={box}>
            <legend style={legend}>印刷幅</legend>
            <div style={{ display: 'grid', gap: 6, fontSize: 14 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>科目名{mmInput(f.widths[0], (v) => setF({ ...f, widths: [v, f.widths[1]] }), '印刷幅 科目名（mm）')}mm</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>金額　{mmInput(f.widths[1], (v) => setF({ ...f, widths: [f.widths[0], v] }), '印刷幅 金額（mm）')}mm</span>
            </div>
          </fieldset>
        </div>
        <fieldset style={box}>
          <legend style={legend}>フォント</legend>
          {([['header', 'ヘッダー'], ['headerItem', 'ヘッダー項目名'], ['name', '科目名'], ['amount', '金額']] as const).map(([k, l]) => <FontRow key={k} label={l} value={f[k]} onChange={(v) => setF({ ...f, [k]: v })} listId={listId} />)}
          <datalist id={listId}>{FORMAT_SIZES.map((o) => <option key={o} value={o} />)}</datalist>
        </fieldset>
        <Foot accent={accent} onReset={() => setF({ ...std, widths: [...std.widths] as [string, string] })} onCancel={onCancel} onOk={() => onOk(f)} />
      </div>
    </Modal>
  );
}

/* ---------------- 表示区分選択（予算内訳表の印刷区分） ----------------
 * 現行の「合算テーブル」と「内部取引消去対応」の2つの方式を、内部取引消去対応をもとに1つにまとめた（確認メモ #380／#388）。
 * 行ごとに 区分／小計／内部取引消去／合計／計算式 を選び、印刷用列名（列の見出し）を変えられる。
 * 計算式は現行の合算テーブルと同じく行の No で指定する（例 1+3）。誤りのメッセージも現行の文言に合わせた。 */
const AREA_ROWS = 30;
/** 区分のほかに置ける行 */
export const AREA_SPECIAL = ['小計', '内部取引消去', '合計', '計算式'] as const;
export interface AreaRow { div: string; name: string; formula: string }
/** 以前の形（区分名だけの配列）も読めるようにする */
export const toAreaRows = (v: (AreaRow | string)[] | undefined): AreaRow[] => (v ?? []).map((x) => (typeof x === 'string' ? { div: x, name: '', formula: '' } : x));
/** 計算式の誤り（なければ空文字） */
export function areaFormulaError(rows: AreaRow[]): string {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.div !== '計算式') continue;
    const no = i + 1;
    const f = r.formula.replace(/[＋]/g, '+').replace(/[－−ー]/g, '-').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\s/g, '');
    if (!f) return `${no}行目の計算式が未入力です。`;
    if (!/^\d+([+-]\d+)*$/.test(f)) return `${no}行目の計算式は、行の No と ＋・－ で入力してください（例 1+3）。`;
    const refs = f.split(/[+-]/).map(Number);
    if (refs.includes(no)) return `${no}行目の計算式に自分自身の行番号が含まれています。修正してください。`;
    const bad = refs.find((n) => n < 1 || n > rows.length || !rows[n - 1].div);
    if (bad != null) return `${no}行目の計算式の ${bad} 行目は空行です。修正してください。`;
  }
  return '';
}
export function AreaPickDialog({ value, divisions, perPage, accent, onCancel, onOk }: { value: (AreaRow | string)[]; divisions: string[]; perPage: number; accent: string; onCancel: () => void; onOk: (v: AreaRow[]) => void }) {
  const [rows, setRows] = useState<AreaRow[]>(() => { const v = toAreaRows(value); return Array.from({ length: AREA_ROWS }, (_, i) => v[i] ?? { div: '', name: '', formula: '' }); });
  const [err, setErr] = useState('');
  const per = Math.max(1, perPage);
  const put = (i: number, p: Partial<AreaRow>) => { setRows(rows.map((x, k) => (k === i ? { ...x, ...p } : x))); setErr(''); };
  const th = { position: 'sticky', top: 0, background: '#f3f6f9', padding: '6px 10px', fontSize: 12, textAlign: 'left', zIndex: 1 } as const;
  const ok = () => { const e = areaFormulaError(rows); if (e) { setErr(e); return; } onOk(rows); };
  return (
    <Modal open onClose={onCancel} width={820} title="表示区分選択">
      <div data-area-dialog style={{ padding: '14px 22px 18px', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>内訳表に表示する区分を設定してください。<HelpTip text={['No の順に左から印刷します。色の切れ目が 1 ページの区切りです', '区分のほか、小計・内部取引消去・合計・計算式の行を置けます', '計算式は行の No で指定します。例 1+3 は 1 行目と 3 行目を足した金額です', '印刷用列名を入れると、その名前で列の見出しを印刷します。空欄のときは区分名で印刷します', '空行は詰めずに空欄で印刷します']} /></div>
        <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid #e2e8ee', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...th, textAlign: 'right', width: 48 }}>No</th><th style={{ ...th, width: '34%' }}>区分名</th><th style={th}>印刷用列名</th><th style={{ ...th, width: '22%' }}>計算式</th></tr></thead>
            <tbody>{rows.map((r, i) => {
              const fx = r.div === '計算式';
              return (
                <tr key={i} data-area-row={i + 1} style={{ background: Math.floor(i / per) % 2 ? '#fff8e1' : '#f4efff' }}>
                  <td style={{ padding: '3px 10px', textAlign: 'right', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</td>
                  <td style={{ padding: '3px 6px' }}><select aria-label={`No ${i + 1} の区分`} value={r.div} onChange={(e) => put(i, { div: e.target.value, ...(e.target.value === '計算式' ? {} : { formula: '' }) })} style={{ ...input, padding: '4px 8px', background: '#fff' }}><option value="">（空行）</option>{divisions.map((d) => <option key={d}>{d}</option>)}{AREA_SPECIAL.map((d) => <option key={d}>{d}</option>)}</select></td>
                  <td style={{ padding: '3px 6px' }}><input className="field-input" data-area-name={i + 1} aria-label={`No ${i + 1} の印刷用列名`} value={r.name} disabled={!r.div} onChange={(e) => put(i, { name: e.target.value })} placeholder={r.div ? (r.div.split(' ').slice(1).join(' ') || r.div) : ''} style={{ ...input, padding: '4px 8px', background: r.div ? '#fff' : '#f3f5f7' }} /></td>
                  <td style={{ padding: '3px 6px' }}><input className="field-input" data-area-formula={i + 1} aria-label={`No ${i + 1} の計算式`} value={r.formula} disabled={!fx} onChange={(e) => put(i, { formula: e.target.value })} placeholder={fx ? '例 1+3' : ''} style={{ ...input, padding: '4px 8px', background: fx ? '#fff' : '#f3f5f7', fontVariantNumeric: 'tabular-nums' }} /></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        {err && <div role="alert" data-area-error style={{ fontSize: 14, fontWeight: 700, color: '#c0392b' }}>{err}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={note}>1ページに表示可能な区分数：{per}</span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onCancel} style={btn()}>キャンセル</button>
          <button type="button" className="submit-btn" onClick={ok} style={btn(accent, true)}>OK</button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- 摘要（予算書の科目ごとの備考） ---------------- */
const BAD_CHARS = /[&/?:*"><|]/g;
export function RemarkDialog({ title, column = '備考', value, accent, onCancel, onOk }: { title: string; /** 入力欄の見出し（備考・摘要） */ column?: string; value: Record<string, string>; accent: string; onCancel: () => void; onOk: (v: Record<string, string>) => void }) {
  const [v, setV] = useState(value);
  return (
    <Modal open onClose={onCancel} width={680} title={title}>
      <div data-remark-dialog style={{ padding: '14px 22px 18px', display: 'grid', gap: 10 }}>
        <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid #e2e8ee', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ position: 'sticky', top: 0, background: '#f3f6f9', padding: '6px 10px', fontSize: 12, textAlign: 'left', width: '42%' }}>科目名</th><th style={{ position: 'sticky', top: 0, background: '#f3f6f9', padding: '6px 10px', fontSize: 12, textAlign: 'left' }}>{column}</th></tr></thead>
            <tbody>{ACCOUNTS.flatMap((g) => [
              <tr key={'g:' + g.group} style={{ background: '#e8f4fb' }}><td style={{ padding: '5px 10px', fontSize: 14, fontWeight: 700 }}>{g.group}</td><td style={{ padding: '3px 10px' }}><input className="field-input" aria-label={`${g.group}の備考`} value={v[g.group] ?? ''} onChange={(e) => setV({ ...v, [g.group]: e.target.value.replace(BAD_CHARS, '') })} style={{ ...input, padding: '4px 8px' }} /></td></tr>,
              ...g.items.map((a) => <tr key={a}><td style={{ padding: '5px 10px 5px 26px', fontSize: 14 }}>{a}</td><td style={{ padding: '3px 10px' }}><input className="field-input" aria-label={`${a}の備考`} value={v[a] ?? ''} onChange={(e) => setV({ ...v, [a]: e.target.value.replace(BAD_CHARS, '') })} style={{ ...input, padding: '4px 8px' }} /></td></tr>),
            ])}</tbody>
          </table>
        </div>
        <div style={note}>次に示す文字は備考に使用できません（入力しても入りません）。&amp; / ? : * &quot; &gt; &lt; |</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onCancel} style={btn()}>キャンセル</button>
          <button type="button" className="submit-btn" onClick={() => onOk(Object.fromEntries(Object.entries(v).filter(([, x]) => x.trim())))} style={btn(accent, true)}>OK</button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- 科目毎の表示設定 ---------------- */
export function DisplaySettingDialog({ value, accent, onCancel, onOk, title = '科目毎の表示設定', groups = ACCOUNTS, help: helpText }: { value: Record<string, boolean>; accent: string; onCancel: () => void; onOk: (v: Record<string, boolean>) => void; /** 科目設定（勘定科目・資金科目）でも使う。確認メモ #366 */ title?: string; groups?: { group: string; items: string[] }[]; help?: string }) {
  const [v, setV] = useState(value);
  const on = (k: string) => v[k] !== false;
  const [help, setHelp] = useState(false);
  return (
    <Modal open onClose={onCancel} width={520} title={title}>
      <div data-display-dialog style={{ padding: '14px 22px 18px', display: 'grid', gap: 10 }}>
        <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid #e2e8ee', borderRadius: 8, padding: '6px 10px' }}>
          {groups.map((g) => (
            <div key={g.group}>
              <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 14, fontWeight: 700, padding: '3px 0', cursor: 'pointer' }}><input type="checkbox" checked={on(g.group)} onChange={() => setV({ ...v, [g.group]: !on(g.group) })} style={{ accentColor: accent }} />{g.group}</label>
              {g.items.map((a) => <label key={a} style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 14, padding: '3px 0 3px 22px', cursor: 'pointer' }}><input type="checkbox" checked={on(a)} onChange={() => setV({ ...v, [a]: !on(a) })} style={{ accentColor: accent }} />{a}</label>)}
            </div>
          ))}
        </div>
        {help && <div style={{ ...note, padding: '8px 10px', background: '#f6f8fa', borderRadius: 8 }}>{helpText ?? <>印刷位置で「科目毎に指定」を選んだとき、チェックを付けた項目・科目だけを印刷します。チェックを外した科目は、帳票に行を出しません（金額は上の項目の合計に含めたままです）。</>}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={() => setHelp(!help)} style={btn()}>説明</button>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onCancel} style={btn()}>キャンセル</button>
          <button type="button" className="submit-btn" onClick={() => onOk(v)} style={btn(accent, true)}>OK</button>
        </div>
      </div>
    </Modal>
  );
}
