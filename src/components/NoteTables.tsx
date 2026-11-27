// 計算書類に対する注記の「表」（現行の注記設定画面の［表挿入］［表編集］と同じ構成。確認メモ #390）
//   表挿入：挿入する表の選択画面（7種類）→ 本文のカーソル位置に目印「@@表1@@」を入れる。表の中身はこの目印の位置に印刷する。
//   表編集：注記表 設定画面（7つの表をタブで切り替え）。行の 上へ移動／下へ移動／編集／行追加／行削除／全行削除／プレビュー（表7はプレビューなし）。
//   行追加：追加する行の位置（選択行の上／最後の行の下）と行の種別を選び、種別ごとの入力画面で作る。
//     表1・表4：通常行／通常行【勘定科目 指定】／通常行【固定資産 指定】／合計行、表2・表3・表5・表6：通常行／合計行、表7：通常行だけ。
//     通常行は、金額の列ごとに 勘定科目（複数）・金額の種類・マイナスにする・加算額 を指定する。表7は12列すべて文字で入力する。
//   科目・固定資産の一覧はサンプル。閉じるのは ×・キャンセル・OK などのボタンだけ（Esc・外側のクリックでは閉じない）。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { Tabs, btn, input, HelpTip } from './ui';
import { ACCOUNTS } from '../data';

export type NoteRowKind = '通常行' | '勘定科目指定' | '固定資産指定' | '合計行';
export interface NoteAmount { accts: string[]; amtKind: string; minus: boolean; add: string }
export interface NoteRow { kind: NoteRowKind; label: string; amounts?: NoteAmount[]; accts?: string[]; assets?: string[]; texts?: string[] }
export type NoteTables = Record<number, NoteRow[]>;

const ASSET_ACCTS = ACCOUNTS.filter((g) => ['現金及び預金', '事業未収金', '固定資産'].includes(g.group)).flatMap((g) => g.items);
const FIXED = ACCOUNTS.find((g) => g.group === '固定資産')?.items ?? [];
/** 負債科目（サンプルの科目マスタに負債がないため、表3だけ一覧を持つ） */
const DEBT_ACCTS = ['短期運営資金借入金', '事業未払金', '1年以内返済予定設備資金借入金', '設備資金借入金', '長期運営資金借入金'];
/** 減価償却に登録した固定資産（サンプル） */
const FIXED_ASSETS: { acct: string; code: string; name: string; date: string }[] = [
  { acct: '建物', code: '0001', name: '園舎', date: '2010/04/01' },
  { acct: '建物', code: '0002', name: '園舎（増築）', date: '2018/09/01' },
  { acct: '器具及び備品', code: '0101', name: '遊具一式', date: '2021/03/15' },
  { acct: '器具及び備品', code: '0102', name: '給食室の厨房機器', date: '2023/06/01' },
  { acct: 'ソフトウェア', code: '0201', name: '保育業務ソフト', date: '2024/04/01' },
];

/** 7種類の表（列見出しは現行と同じ） */
export const NOTE_TABLE_DEFS: { no: number; name: string; cols: string[]; kinds: NoteRowKind[]; accts: string[] }[] = [
  { no: 1, name: '基本財産の増減', cols: ['基本財産の種類', '前期末残高', '当期増加額', '当期減少額', '当期末残高'], kinds: ['通常行', '勘定科目指定', '固定資産指定', '合計行'], accts: ['土地', '建物'] },
  { no: 2, name: '担保に供されている資産', cols: ['種類', '金額'], kinds: ['通常行', '合計行'], accts: ASSET_ACCTS },
  { no: 3, name: '担保している債務', cols: ['種類', '金額'], kinds: ['通常行', '合計行'], accts: DEBT_ACCTS },
  { no: 4, name: '有形固定資産', cols: ['種類', '取得価額', '減価償却累計額', '当期末残高'], kinds: ['通常行', '勘定科目指定', '固定資産指定', '合計行'], accts: FIXED },
  { no: 5, name: '債権', cols: ['種類', '債権額', '徴収不能引当金の当期末残高', '債権の当期末残高'], kinds: ['通常行', '合計行'], accts: ASSET_ACCTS },
  { no: 6, name: '満期保有目的の債券', cols: ['種類及び銘柄', '帳簿価額', '時価', '評価損益'], kinds: ['通常行', '合計行'], accts: ASSET_ACCTS },
  { no: 7, name: '関連当事者との取引', cols: ['種類', '法人等の名称', '住所', '資産総額', '事業の内容及び職業', '議決権の所有割合', '役員の兼務等', '事実上の関係', '取引の内容', '取引金額', '科目', '期末残高'], kinds: ['通常行'], accts: [] },
];
const KIND_INFO: Record<NoteRowKind, { label: string; note: string }> = {
  通常行: { label: '通常行', note: '会計データもしくは手入力で金額を印刷する行' },
  勘定科目指定: { label: '通常行【勘定科目 指定】', note: '減価償却のデータで金額を印刷する行（科目に設定した固定資産）' },
  固定資産指定: { label: '通常行【固定資産 指定】', note: '減価償却のデータで金額を印刷する行（選んだ固定資産）' },
  合計行: { label: '合計行', note: '通常行の金額を集計する行' },
};
const AMOUNT_KINDS = ['当年度決算額', '前年度決算額', '増減', '増加', '減少'];
export const noteMarker = (no: number) => `@@表${no}@@`;

const note: CSSProperties = { fontSize: 12, color: '#8290a0', lineHeight: 1.6 };
const TH: CSSProperties = { position: 'sticky', top: 0, background: '#f3f6f9', padding: '6px 8px', fontSize: 12, textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8ee' };
const TD: CSSProperties = { padding: '5px 8px', fontSize: 14, borderBottom: '1px solid #f1f4f6', verticalAlign: 'top' };

/* ---------------- 挿入する表の選択画面 ---------------- */
export function NoteTablePickDialog({ accent, onPick, onCancel }: { accent: string; onPick: (no: number) => void; onCancel: () => void }) {
  return (
    <Modal open onClose={onCancel} width={600} title="挿入する表の選択画面">
      <div data-note-table-pick style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><HelpTip text={['本文のカーソルの位置に、表の目印（例 @@表1@@）が入ります', '表の中身は［表編集］で作り、目印の位置に印刷します']} /></div>
        {/* 現行と同じく、左の列に表1〜3、右の列に表4〜7 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'start' }}>
          {[NOTE_TABLE_DEFS.slice(0, 3), NOTE_TABLE_DEFS.slice(3)].map((col, c) => (
            <div key={c} style={{ display: 'grid', gap: 8 }}>
              {col.map((t) => (
                <button key={t.no} type="button" data-note-table={t.no} onClick={() => onPick(t.no)} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #cfd8e0', background: '#fff', textAlign: 'left', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', color: '#22303c' }}>
                  <span style={{ color: accent, marginRight: 6 }}>表{t.no}.</span>{t.name}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={onCancel} style={btn()}>キャンセル</button></div>
      </div>
    </Modal>
  );
}

/** 行の金額欄の見え方（設定の要約） */
function amountSummary(a?: NoteAmount): string {
  if (!a) return '';
  const parts = [a.accts.length ? `${a.accts.slice(0, 2).join('・')}${a.accts.length > 2 ? ` ほか${a.accts.length - 2}科目` : ''}` : '', a.accts.length ? a.amtKind : '', a.minus ? 'マイナス' : '', Number(a.add) ? `加算 ${Number(a.add).toLocaleString('ja-JP')}` : ''].filter(Boolean);
  return parts.join('／') || '—';
}

/* ---------------- 注記表 設定画面 ---------------- */
export function NoteTablesDialog({ value, accent, initial = 1, onOk, onCancel }: { value: NoteTables; accent: string; initial?: number; onOk: (v: NoteTables) => void; onCancel: () => void }) {
  const [tables, setTables] = useState<NoteTables>(() => JSON.parse(JSON.stringify(value)));
  const [tab, setTab] = useState(initial);
  const [sel, setSel] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<{ at: number; row: NoteRow; isNew: boolean } | null>(null);
  const [preview, setPreview] = useState(false);
  const def = NOTE_TABLE_DEFS[tab - 1];
  const rows = tables[tab] ?? [];
  const setRows = (r: NoteRow[]) => setTables({ ...tables, [tab]: r });
  const move = (d: -1 | 1) => { if (sel == null) return; const j = sel + d; if (j < 0 || j >= rows.length) return; const r = [...rows]; [r[sel], r[j]] = [r[j], r[sel]]; setRows(r); setSel(j); };
  const blank = (kind: NoteRowKind): NoteRow => kind === '合計行' ? { kind, label: '合計' } : tab === 7 ? { kind, label: '', texts: def.cols.map(() => '') } : kind === '通常行' ? { kind, label: '', amounts: def.cols.slice(1).map(() => ({ accts: [], amtKind: '当年度決算額', minus: false, add: '0' })) } : { kind, label: '', accts: [], assets: [] };
  const tabBtn = (label: string, on: () => void, disabled = false, danger = false) => <button type="button" disabled={disabled} onClick={on} style={{ ...btn(danger ? '#c0392b' : '#5b6773', false, true), opacity: disabled ? 0.45 : 1, cursor: disabled ? 'default' : 'pointer' }}>{label}</button>;
  return (
    <Modal open onClose={onCancel} width={980} title="注記表 設定画面">
      <div data-note-tables style={{ display: 'grid' }}>
        <div style={{ padding: '0 14px', overflowX: 'auto' }}><Tabs items={NOTE_TABLE_DEFS.map((t) => `表${t.no}.${t.name}`)} current={`表${tab}.${def.name}`} onChange={(v) => { setTab(Number(v.match(/^表(\d)/)?.[1] ?? 1)); setSel(null); }} accent={accent} small /></div>
        <div style={{ padding: '12px 22px 18px', display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {tabBtn('上へ移動', () => move(-1), sel == null || sel === 0)}
            {tabBtn('下へ移動', () => move(1), sel == null || sel === rows.length - 1)}
            {tabBtn('編集', () => sel != null && setEdit({ at: sel, row: JSON.parse(JSON.stringify(rows[sel])), isNew: false }), sel == null)}
            {tabBtn('行追加', () => setAdding(true))}
            {tabBtn('行削除', () => { if (sel == null) return; setRows(rows.filter((_, i) => i !== sel)); setSel(null); }, sel == null, true)}
            {tabBtn('全行削除', () => { setRows([]); setSel(null); }, rows.length === 0, true)}
            {tab !== 7 && tabBtn('プレビュー', () => setPreview(true), rows.length === 0)}
            <span style={{ marginLeft: 'auto' }}><HelpTip text={['行をクリックして選び、上の操作を使います', '行をダブルクリックしても編集できます']} /></span>
          </div>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 8, maxHeight: 340, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ ...TH, width: 36 }}>行</th><th style={{ ...TH, width: 150 }}>行の種別</th>{def.cols.map((c) => <th key={c} style={TH}>{c}</th>)}</tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={def.cols.length + 2} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: '24px 8px' }}>行がありません。</td></tr>}
                {rows.map((r, i) => (
                  <tr key={i} data-note-row={i + 1} onClick={() => setSel(i)} onDoubleClick={() => setEdit({ at: i, row: JSON.parse(JSON.stringify(r)), isNew: false })} style={{ cursor: 'pointer', background: sel === i ? '#e9f5ef' : r.kind === '合計行' ? '#f7f9fa' : '#fff' }}>
                    <td style={{ ...TD, color: '#8290a0', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</td>
                    <td style={{ ...TD, fontSize: 12, color: '#5b6773', whiteSpace: 'nowrap' }}>{KIND_INFO[r.kind].label}</td>
                    {tab === 7
                      ? def.cols.map((_, k) => <td key={k} style={TD}>{r.texts?.[k] || ''}</td>)
                      : <>
                          <td style={{ ...TD, fontWeight: r.kind === '合計行' ? 700 : 400 }}>{r.label || '（種類なし）'}</td>
                          {def.cols.slice(1).map((_, k) => <td key={k} style={{ ...TD, fontSize: 12, color: '#48565f' }}>{r.kind === '合計行' ? '通常行の合計' : r.kind === '通常行' ? amountSummary(r.amounts?.[k]) : r.kind === '勘定科目指定' ? `${(r.accts ?? []).join('・') || '科目なし'} の固定資産` : `固定資産 ${(r.assets ?? []).length} 件`}</td>)}
                        </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onCancel} style={btn()}>キャンセル</button>
            <button type="button" className="submit-btn" onClick={() => onOk(tables)} style={btn(accent, true)}>OK</button>
          </div>
        </div>
      </div>
      {adding && <RowKindDialog def={def} sel={sel} count={rows.length} accent={accent} onCancel={() => setAdding(false)} onPick={(kind, above) => { setAdding(false); setEdit({ at: above && sel != null ? sel : rows.length, row: blank(kind), isNew: true }); }} />}
      {edit && <RowEditDialog def={def} row={edit.row} accent={accent} onCancel={() => setEdit(null)} onOk={(row) => { const r = [...rows]; if (edit.isNew) r.splice(edit.at, 0, row); else r[edit.at] = row; setRows(r); setSel(edit.at); setEdit(null); }} />}
      {preview && (
        <Modal open onClose={() => setPreview(false)} width={760} title={`プレビュー　表${def.no}.${def.name}`}>
          <div data-note-preview style={{ padding: '14px 22px 18px', display: 'grid', gap: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #22303c' }}>
              <thead><tr>{def.cols.map((c) => <th key={c} style={{ border: '1px solid #22303c', padding: '6px 8px', fontSize: 12, background: '#f3f6f9' }}>{c}</th>)}</tr></thead>
              <tbody>{rows.map((r, i) => <tr key={i}><td style={{ border: '1px solid #22303c', padding: '5px 8px', fontSize: 14, fontWeight: r.kind === '合計行' ? 700 : 400 }}>{r.label}</td>{def.cols.slice(1).map((_, k) => <td key={k} style={{ border: '1px solid #22303c', padding: '5px 8px', fontSize: 14, textAlign: 'right', color: '#8290a0' }}>×××</td>)}</tr>)}</tbody>
            </table>
            <div style={note}>金額は印刷するときに会計データから集計します。</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={() => setPreview(false)} style={btn()}>閉じる</button></div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

/* ---------------- 追加したい行の種別選択画面 ---------------- */
function RowKindDialog({ def, sel, count, accent, onPick, onCancel }: { def: (typeof NOTE_TABLE_DEFS)[number]; sel: number | null; count: number; accent: string; onPick: (k: NoteRowKind, above: boolean) => void; onCancel: () => void }) {
  const [above, setAbove] = useState(sel != null);
  return (
    <Modal open onClose={onCancel} width={560} title="追加したい行の種別選択画面">
      <div data-note-row-kind style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        <fieldset style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: '6px 14px 10px', margin: 0 }}>
          <legend style={{ fontSize: 12, fontWeight: 800, color: '#5b6773', padding: '0 6px' }}>追加する行の位置</legend>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 14 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: sel == null ? 0.5 : 1 }}><input type="radio" checked={above} disabled={sel == null} onChange={() => setAbove(true)} style={{ accentColor: accent }} />選択行の上（{sel == null ? '－' : sel + 1} 行目）</label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={!above} onChange={() => setAbove(false)} style={{ accentColor: accent }} />最後の行の下（{count + 1} 行目）</label>
          </div>
        </fieldset>
        <div style={{ display: 'grid', gap: 8 }}>
          {def.kinds.map((k) => (
            <button key={k} type="button" data-note-row-kind-pick={k} onClick={() => onPick(k, above)} style={{ display: 'grid', gap: 2, padding: '10px 14px', borderRadius: 10, border: '1px solid #cfd8e0', background: '#fff', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}>
              <b style={{ fontSize: 14, color: '#22303c' }}>{KIND_INFO[k].label}</b>
              <span style={{ fontSize: 12, color: '#7a8794' }}>{def.no === 7 ? '文字で入力する行' : KIND_INFO[k].note}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={onCancel} style={btn()}>キャンセル</button></div>
      </div>
    </Modal>
  );
}

/** チェック付きの科目一覧（複数選択） */
function AcctChecks({ list, value, onChange, accent, height = 132 }: { list: string[]; value: string[]; onChange: (v: string[]) => void; accent: string; height?: number }) {
  return (
    <div style={{ border: '1px solid #e2e8ee', borderRadius: 8, maxHeight: height, overflowY: 'auto', padding: '4px 8px', background: '#fff' }}>
      {list.map((a) => <label key={a} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14, padding: '2px 0', cursor: 'pointer' }}><input type="checkbox" checked={value.includes(a)} onChange={() => onChange(value.includes(a) ? value.filter((x) => x !== a) : [...value, a])} style={{ accentColor: accent }} />{a}</label>)}
    </div>
  );
}

/* ---------------- 行の入力画面（種別ごと） ---------------- */
function RowEditDialog({ def, row, accent, onOk, onCancel }: { def: (typeof NOTE_TABLE_DEFS)[number]; row: NoteRow; accent: string; onOk: (r: NoteRow) => void; onCancel: () => void }) {
  const [r, setR] = useState<NoteRow>(row);
  const title = def.no === 7 ? '行追加画面' : row.kind === '合計行' ? '合計行画面' : row.kind === '通常行' ? '通常行作成（会計勘定科目から作成）' : '通常行作成（減価償却のデータから作成）';
  const labelField = (
    <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, color: '#5b6773' }}>{def.cols[0]}
      <input className="field-input" data-note-label value={r.label} onChange={(e) => setR({ ...r, label: e.target.value })} style={input} />
    </label>
  );
  const putAmt = (k: number, p: Partial<NoteAmount>) => setR({ ...r, amounts: (r.amounts ?? []).map((a, i) => (i === k ? { ...a, ...p } : a)) });
  const assetsOf = (accts: string[]) => FIXED_ASSETS.filter((x) => accts.includes(x.acct));
  return (
    <Modal open onClose={onCancel} width={def.no === 7 || row.kind === '通常行' ? 860 : 600} title={title}>
      <div data-note-row-edit={row.kind} style={{ padding: '14px 22px 18px', display: 'grid', gap: 12, maxHeight: '72vh', overflowY: 'auto' }}>
        {def.no === 7 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {def.cols.map((c, k) => (
              <label key={c} style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, color: '#5b6773' }}>{c}
                <input className="field-input" value={r.texts?.[k] ?? ''} onChange={(e) => setR({ ...r, texts: (r.texts ?? def.cols.map(() => '')).map((x, i) => (i === k ? e.target.value : x)) })} style={input} />
              </label>
            ))}
          </div>
        ) : row.kind === '合計行' ? labelField : row.kind === '通常行' ? (
          <>
            {labelField}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(def.cols.length - 1, 2)}, minmax(0,1fr))`, gap: 10 }}>
              {def.cols.slice(1).map((c, k) => {
                const a = r.amounts?.[k] ?? { accts: [], amtKind: '当年度決算額', minus: false, add: '0' };
                return (
                  <fieldset key={c} data-note-amount={c} style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: '6px 12px 12px', margin: 0, display: 'grid', gap: 8, minWidth: 0 }}>
                    <legend style={{ fontSize: 12, fontWeight: 800, color: '#5b6773', padding: '0 6px' }}>{c}</legend>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#5b6773' }}>勘定科目</div>
                    <AcctChecks list={def.accts} value={a.accts} onChange={(v) => putAmt(k, { accts: v })} accent={accent} />
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#5b6773' }}>金額の種類<select value={a.amtKind} onChange={(e) => putAmt(k, { amtKind: e.target.value })} style={{ ...input, width: 'auto', padding: '4px 8px' }}>{AMOUNT_KINDS.map((x) => <option key={x}>{x}</option>)}</select></label>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={a.minus} onChange={() => putAmt(k, { minus: !a.minus })} style={{ accentColor: accent }} />勘定科目の金額をマイナスにする</label>
                    </div>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#5b6773' }}>加算額<input className="field-input" inputMode="numeric" value={a.add} onChange={(e) => putAmt(k, { add: e.target.value.replace(/[^0-9-]/g, '') })} style={{ ...input, width: 140, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} /><HelpTip text="手入力の金額はここに入れます。科目の金額に足して印刷します" /></label>
                  </fieldset>
                );
              })}
            </div>
          </>
        ) : row.kind === '勘定科目指定' ? (
          <>
            {labelField}
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>印刷時に、選んだ勘定科目の固定資産の金額が加算されます。</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><div style={{ fontSize: 12, fontWeight: 700, color: '#5b6773', marginBottom: 4 }}>勘定科目選択</div><AcctChecks list={def.accts} value={r.accts ?? []} onChange={(v) => setR({ ...r, accts: v })} accent={accent} height={180} /></div>
              <div><div style={{ fontSize: 12, fontWeight: 700, color: '#5b6773', marginBottom: 4 }}>条件に該当する減価データ</div>
                <div style={{ border: '1px solid #e2e8ee', borderRadius: 8, height: 180, overflowY: 'auto', padding: '4px 8px', fontSize: 14, background: '#f9fafb' }}>{assetsOf(r.accts ?? []).map((x) => <div key={x.code} style={{ padding: '2px 0' }}>[{x.code}] {x.name}</div>)}{assetsOf(r.accts ?? []).length === 0 && <div style={{ color: '#9aa5b1', padding: '6px 0' }}>該当する固定資産はありません。</div>}</div>
              </div>
            </div>
          </>
        ) : (
          <>
            {labelField}
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>金額を加算する固定資産にチェックを付けてください。</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#5b6773' }}>固定資産選択</div>
            <div style={{ border: '1px solid #e2e8ee', borderRadius: 8, maxHeight: 220, overflowY: 'auto', padding: '4px 8px' }}>
              {Array.from(new Set(FIXED_ASSETS.filter((x) => def.accts.includes(x.acct)).map((x) => x.acct))).map((acct) => (
                <div key={acct} style={{ padding: '3px 0' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#5b6773' }}>{acct}</div>
                  {FIXED_ASSETS.filter((x) => x.acct === acct).map((x) => { const on = (r.assets ?? []).includes(x.code); return <label key={x.code} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14, padding: '2px 0 2px 14px', cursor: 'pointer' }}><input type="checkbox" checked={on} onChange={() => setR({ ...r, assets: on ? (r.assets ?? []).filter((c) => c !== x.code) : [...(r.assets ?? []), x.code] })} style={{ accentColor: accent }} />[{x.code}] {x.name} <span style={{ color: '#8290a0', fontSize: 12 }}>&lt;{x.date}&gt;</span></label>; })}
                </div>
              ))}
            </div>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onCancel} style={btn()}>キャンセル</button>
          <button type="button" className="submit-btn" data-note-row-ok onClick={() => onOk(r)} style={btn(accent, true)}>OK</button>
        </div>
      </div>
    </Modal>
  );
}
