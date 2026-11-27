// 減価償却：帳票印刷の条件画面と詳細設定（確認メモ #251）
//   現行「減価償却オプションシステム」の印刷条件画面（出力先）と［詳細設定］の内容を、1 つのダイアログにまとめる。
//   流れはほかの帳票と同じ「出力先（基本条件つき）と詳細設定のタブ」（PrintSteps。確認事項「印刷の画面遷移の統一」）。
//   見た目は会計の印刷（PrintFlow）と同じにする（確認メモ #422）：題名「〇〇 の印刷」、出力先のタブに基本条件（印刷範囲・集計期間）、
//   詳細設定のタブは「この帳票の詳細設定」の枠の中に、会計と同じ見出しの枠（フォント・罫線・印刷位置調整も同じ並び）を並べる。
//   「償却方法の印字設定」は現行のアップデートで追加された項目（固定資産管理台帳（新会計版）と固定資産管理台帳のみ）。
//   設定は帳票ごとに覚え、次に開いたときも引き継ぐ（実行したときに保存。キャンセルでは保存しない）。

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Modal } from './Modal';
import { PrintSteps, type OutKind } from './PrintSteps';
import { ScopeBlock, SpinField } from './PrintCenter';
import { MM_SPIN } from './printCatalog';
import { btn as uiBtn } from './ui';

const btnS = (c: string) => uiBtn(c, false, true);

/** 実行の種類：出力先（プリンター／PDF／Excel／CSV）またはプレビュー */
export type DepOutput = OutKind | 'preview';
export type DepValues = Record<string, string | boolean>;

/** 償却方法の印字設定（確認メモ #251） */
export const METHOD_PRINT = ['旧償却方法を「定額法」、新償却方法を「改正定額法」と表示する。', '旧償却方法を「定額法」、新償却方法を「改正定額法」と表示する。（改正償却後も定額法）', '旧償却方法を「旧定額法」、新償却方法を「定額法」と表示する。'];
const METHOD_NOTES = ['※旧定額法の資産が改正償却された場合は「改正定額法」と表示されます。', '※旧定額法の資産が改正償却された場合も「定額法」と表示されます。', '※旧定額法の資産が改正償却された場合も「旧定額法」と表示されます。'];
/** 選択肢の表示名（2 つめは 1 つめと同じ文で、注意書きだけが違う） */
const methodLabel = (o: string) => o.replace('（改正償却後も定額法）', '');

/** 台帳の「償却方法」の列に印字する名前 */
export function printMethod(method: string, opt: string | boolean | undefined): string {
  const i = Math.max(0, METHOD_PRINT.indexOf(String(opt ?? METHOD_PRINT[0])));
  if (method.startsWith('旧定額法')) return i === 2 ? '旧定額法' : '定額法';
  if (method === '定額法') return i === 2 ? '定額法' : '改正定額法';
  return method;
}

type F =
  | { t: 'radio'; key: string; label: string; options: string[]; def: string; disabled?: boolean; notes?: string[]; wide?: boolean; text?: { when: string; key: string; placeholder: string } }
  | { t: 'checks'; label: string; items: { key: string; label: string; def: boolean; num?: { key: string; label: string; def: number } }[]; wide?: boolean }
  | { t: 'text'; key: string; label: string; def: string }
  | { t: 'period' }
  | { t: 'range'; key: string; label: string; def: boolean; fields: string[] }
  | { t: 'number'; key: string; label: string; def: number; unit: string }
  /** タックシールの印刷開始位置：1枚12区切りのシール用紙の表と番号から選ぶ（確認メモ #446） */
  | { t: 'seal'; key: string; label: string; def: number; cols: number; rows: number };

const ORDER: F = { t: 'radio', key: 'order', label: '固定資産の印刷順序', options: ['資産コード順', '取得日付順'], def: '取得日付順' };
const MULTI: F = { t: 'radio', key: 'multi', label: '複数固定資産の印字方法', options: ['まとめて印字', '格別に列記印字'], def: 'まとめて印字', disabled: true };
/** 一覧表（取得・除却・売却・移管(元)・移管(先)）は「複数固定資産の印字方法」を選べる（確認メモ #441〜#445） */
const MULTI_ON: F = { ...MULTI, disabled: false } as F;
/** 当期変更情報一覧表の印刷順序は3つから選ぶ（確認メモ #434） */
const ORDER3: F = { t: 'radio', key: 'order', label: '固定資産の印刷順序', options: ['入力コード順', '固定資産名称順', '取得年月日順'], def: '取得年月日順' };
/** 当期変更情報一覧表の印刷タイプ選択（現行：固定資産別／変更内容別。確認メモ #433） */
const PRINT_TYPE: F = { t: 'radio', key: 'ptype', label: '印刷タイプ選択', options: ['固定資産別', '変更内容別'], def: '固定資産別' };
const PAGE_ITEM = { key: 'page', label: 'ページ番号を印刷する', def: true, num: { key: 'pageStart', label: '開始番号', def: 1 } };
const DATE_ITEM = { key: 'date', label: '印刷時の日付を印刷する', def: false };
const CORP_ITEM = { key: 'corp', label: '法人名を印刷する', def: true };
const DATA: F = { t: 'radio', key: 'data', label: 'データ印字の選択', options: ['集計単位で印刷', '固定資産単位で印刷'], def: '集計単位で印刷' };
const METHOD: F = { t: 'radio', key: 'method', label: '償却方法の印字設定', options: METHOD_PRINT, def: METHOD_PRINT[0], notes: METHOD_NOTES, wide: true };
const title = (name: string): F => ({ t: 'text', key: 'title', label: '印刷様式（タイトル）', def: name.replace(/\(/g, '（').replace(/\)/g, '）') });
const NOTICE: F = { t: 'radio', key: 'notice', label: '通知文の印刷', options: ['通知文をそのまま印刷', '何も印刷しない', '手入力文字を印刷'], def: '通知文をそのまま印刷', text: { when: '手入力文字を印刷', key: 'noticeText', placeholder: '印刷する文字（手入力文字設定）' } };
const PERIOD: F = { t: 'period' };
const checksA = (color: boolean, extra: { key: string; label: string; def: boolean }[] = []): F => ({
  t: 'checks', label: '印刷する内容', wide: true, items: [
    { key: 'zero', label: '0データを印刷しない', def: false },
    { key: 'shade', label: '費目行を網掛け太字にする', def: true },
    { key: 'seal', label: '捺印欄を印刷する', def: false },
    { key: 'corp', label: '法人名を印刷する', def: true },
    { key: 'page', label: 'ページ番号を印刷する', def: true, num: { key: 'pageStart', label: '開始番号', def: 1 } },
    { key: 'date', label: '印刷時の日付を印刷する', def: false },
    { key: 'hideDisposed', label: '除却した物件を表示しない', def: false },
    { key: 'colorLine', label: '罫線をカラー印刷する', def: color },
    ...extra,
  ],
});
const range = (fields: string[], label = 'コード範囲指定'): F => ({ t: 'range', key: 'range', label, def: true, fields });

/** 帳票ごとの詳細設定（現行の［詳細設定］の枠の並び） */
function sectionsOf(name: string): F[] {
  const n = name.replace(/\(/g, '（').replace(/\)/g, '）');
  if (n.startsWith('基本財産及びその他の固定資産')) return [DATA, ORDER, MULTI, title(name), NOTICE, PERIOD, checksA(true, [{ key: 'besshi', label: '「別紙3⑧」の文字を印刷する', def: true }])];
  if (n === '固定資産管理台帳（新会計版）') return [DATA, ORDER, MULTI, title(name), NOTICE, PERIOD, METHOD, checksA(true)];
  if (n === '固定資産管理台帳') return [ORDER, { t: 'radio', key: 'kind', label: '資産種類名', options: ['印刷しない', '印刷する'], def: '印刷しない' }, { t: 'radio', key: 'months', label: '償却月数', options: ['当年度のみ', '累計'], def: '累計' }, title(name), { t: 'radio', key: 'foot', label: '脚注の入力', options: ['何も印刷しない', '手入力文字を印刷'], def: '何も印刷しない', text: { when: '手入力文字を印刷', key: 'footText', placeholder: '脚注に印刷する文字' } }, range(['区分', '資産コード']), PERIOD, METHOD, checksA(false)];
  if (n === '個別固定資産管理台帳') return [range(['資産コード'], '資産コード範囲指定'), title(name), { t: 'checks', label: '印刷する内容', items: [{ key: 'page', label: 'ページ番号を印刷する', def: true }, { key: 'date', label: '印刷時の日付を印刷する', def: false }] }];
  // 現行の詳細設定の並び：印刷タイプ選択・印刷順序・ページ番号（開始番号）と日付・タイトル（確認メモ #433〜#435）
  if (n === '当期変更情報一覧表') return [PRINT_TYPE, ORDER3, { t: 'checks', label: '印刷する内容', items: [PAGE_ITEM, DATE_ITEM] }, title(name)];
  if (n === '固定資産タックシール') return [{ t: 'checks', label: '印刷項目', items: [{ key: 'tCode', label: '資産コード', def: true }, { key: 'tCost', label: '取得価額', def: true }, { key: 'tDate', label: '印刷年月日', def: true }] }, { t: 'checks', label: '印刷する物件', items: [{ key: 'tSkip', label: '除却/売却固定資産は印字しない', def: false }] }, { t: 'seal', key: 'start', label: '印刷開始指定', def: 1, cols: 2, rows: 6 }, range(['資産コード'])];
  if (n === '備品一覧表（1）') return [range(['備品コード']), { t: 'checks', label: '改ページ設定', items: [{ key: 'brk', label: '科目ごとに改ページする', def: false }] }, title(name), { t: 'checks', label: '印刷する内容', items: [CORP_ITEM, PAGE_ITEM] }];
  if (n === '備品一覧表（2）') return [range(['備品コード']), { t: 'radio', key: 'order', label: '備品の印刷順序', options: ['備品コード順', '取得日付順'], def: '備品コード順' }, { t: 'checks', label: '合計欄の印刷', items: [{ key: 'total', label: '合計欄を印刷する', def: true }] }, title(name), { t: 'checks', label: '印刷する内容', items: [CORP_ITEM, PAGE_ITEM] }];
  if (n === '固定資産管理台帳（施設設備管理用）') return [range(['資産コード']), { t: 'checks', label: '印刷する内容', items: [PAGE_ITEM, DATE_ITEM] }];
  if (n === '除却固定資産一覧表') return [DATA, ORDER, MULTI_ON, title(name), { t: 'checks', label: '除却参考仕訳', items: [{ key: 'ref', label: '除却参考仕訳を印刷する', def: false }] }, checksA(true)];
  if (n === '売却固定資産一覧表') return [DATA, ORDER, MULTI_ON, title(name), { t: 'checks', label: '売却参考仕訳', items: [{ key: 'ref', label: '売却参考仕訳を印刷する', def: false }] }, checksA(true)];
  // 取得／移管（元）／移管（先）：新会計版から「通知文の印刷」と「集計期間」を除いた構成
  return [DATA, ORDER, MULTI_ON, title(name), checksA(true)];
}

const SIZES = Array.from({ length: 11 }, (_, i) => String(i + 4));
const LINES = ['細線', '通常', '太線'];
/** フォントの書体（確認メモ #426） */
const FACES = ['ＭＳ ゴシック', 'ＭＳ 明朝', 'ＭＳ Ｐゴシック', 'ＭＳ Ｐ明朝'];
/** 罫線の設定（個別固定資産管理台帳は内部と外周だけ。確認メモ #431） */
const norm = (name: string) => name.replace(/\(/g, '（').replace(/\)/g, '）');
const lineRowsOf = (name: string): [string, string][] => (['個別固定資産管理台帳', '当期変更情報一覧表'].includes(norm(name)) ? [['lIn', '内部'], ['lOuter', '外周']] : [['lIn', '内部'], ['lBranch', '分岐'], ['lOuter', '外周']]);
/** フォント：各名称・項目名・金額ごと（#426）。タックシールと当期変更情報一覧表はフォントとサイズの1組（#447・#448） */
const fontRowsOf = (name: string): [string, string][] => (['固定資産タックシール', '当期変更情報一覧表'].includes(norm(name)) ? [['fName', '']] : [['fName', '各名称'], ['fItem', '項目名'], ['fAmt', '金額']]);
const COMMON_DEF: DepValues = { fName: '7', fItem: '6', fAmt: '5', fNameFace: 'ＭＳ ゴシック', fItemFace: 'ＭＳ ゴシック', fAmtFace: 'ＭＳ ゴシック', lIn: '細線', lBranch: '細線', lOuter: '細線', offUp: '0', offRight: '0' };
function defaultsOf(name: string): DepValues {
  const v: DepValues = { ...COMMON_DEF, periodOn: false, periodFrom: '令和8年4月', periodTo: '令和9年3月' };
  // 当期変更情報一覧表のフォントは ＭＳ ゴシック 6（現行の標準値）
  if (norm(name) === '当期変更情報一覧表') v.fName = '6';
  sectionsOf(name).forEach((f) => {
    if (f.t === 'radio') { v[f.key] = f.def; if (f.text) v[f.text.key] = ''; }
    if (f.t === 'text') v[f.key] = f.def;
    if (f.t === 'number' || f.t === 'seal') v[f.key] = String(f.def);
    if (f.t === 'range') { v[f.key] = f.def; f.fields.forEach((x) => { v[f.key + x + 'From'] = ''; v[f.key + x + 'To'] = ''; }); }
    if (f.t === 'checks') f.items.forEach((it) => { v[it.key] = it.def; if (it.num) v[it.num.key] = String(it.num.def); });
  });
  return v;
}
/** 帳票ごとの設定（開き直しても前回の設定を引き継ぐ） */
const SAVED = new Map<string, { values: DepValues; output: OutKind }>();

/** 会計の印刷（DetailSections）と同じ見た目の枠・見出し（確認メモ #422） */
const SEC: CSSProperties = { border: '1px solid #e2e8ee', borderRadius: 10, padding: '4px 12px 12px', margin: 0, minWidth: 0, background: '#fff' };
const LEGEND: CSSProperties = { fontSize: 12, fontWeight: 800, color: '#5b6773', padding: '0 6px', letterSpacing: '.04em' };
const SUB: CSSProperties = { fontSize: 12, fontWeight: 700, color: '#8290a0' };
const IN: CSSProperties = { boxSizing: 'border-box', padding: '6px 8px', border: '1px solid #cfd8e0', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#22303c' };
const ROW: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 14, lineHeight: 1.5, cursor: 'pointer' };

export function DepPrintModal({ name, accent, onRun, onClose }: { name: string; accent: string; onRun: (values: DepValues, output: DepOutput) => void; onClose: () => void }) {
  const title2 = name.replace(/\(/g, '（').replace(/\)/g, '）');
  return (
    <Modal open onClose={onClose} width={880} title={<>{title2} の印刷 <span style={{ fontSize: 12, color: '#7a8794', fontWeight: 500, marginLeft: 8 }}>減価償却</span></>}>
      <DepPrintPanel name={name} accent={accent} onRun={onRun} onClose={onClose} />
    </Modal>
  );
}

/** 印刷画面の中身（出力先と詳細設定のタブ）。減価償却のダイアログと、帳票の印刷の別紙（⑧ 固定資産の明細書）で共通。設定も帳票の名前ごとに共有する（確認メモ #425） */
export function DepPrintPanel({ name, accent, onRun, onClose }: { name: string; accent: string; onRun: (values: DepValues, output: DepOutput) => void; onClose?: () => void }) {
  const saved = SAVED.get(name);
  const [v, setV] = useState<DepValues>(() => ({ ...defaultsOf(name), ...(saved?.values ?? {}) }));
  const [output, setOutput] = useState<OutKind>(saved?.output ?? 'print');
  const set = (k: string, x: string | boolean) => setV((s) => ({ ...s, [k]: x }));
  const all = sectionsOf(name);
  /** 基本条件（出力先と同じ画面に置く）：印刷範囲と集計期間。会計の印刷の「期間・区分」に相当 */
  const basicOf = all.filter((f) => f.t === 'range' || f.t === 'period');
  const sections = all.filter((f) => f.t !== 'range' && f.t !== 'period');
  const run = (o: DepOutput) => { SAVED.set(name, { values: v, output }); onRun(v, o); };
  const title2 = name.replace(/\(/g, '（').replace(/\)/g, '）');
  const onCount = all.reduce((n, f) => n + (f.t === 'checks' ? f.items.filter((it) => !!v[it.key]).length : 0), 0);

  const sec = (key: string, label: string, body: ReactNode, wide?: boolean) => (
    <fieldset key={key} data-detail-section={label} style={{ ...SEC, gridColumn: wide ? '1 / -1' : undefined }}>
      <legend style={LEGEND}>{label}</legend>
      <div style={{ display: 'grid', gap: 9 }}>{body}</div>
    </fieldset>
  );
  const field = (f: F, i: number): ReactNode => {
    if (f.t === 'radio') {
      const cur = String(v[f.key]);
      return sec(f.key + i, f.label, (
        <>
          {f.disabled && <span style={SUB}>この帳票では変更できません</span>}
          <div role="radiogroup" aria-label={f.label} style={{ display: 'flex', gap: '2px 14px', flexWrap: 'wrap', flexDirection: f.notes ? 'column' : 'row' }}>
            {f.options.map((o, k) => (
              <label key={o} style={{ ...ROW, color: f.disabled ? '#9aa5b1' : '#22303c', cursor: f.disabled ? 'default' : 'pointer' }}>
                <input type="radio" checked={cur === o} disabled={f.disabled} onChange={() => set(f.key, o)} style={{ marginTop: 4, accentColor: accent }} />
                <span>{f.key === 'method' ? methodLabel(o) : o}{f.notes && <span style={{ display: 'block', fontSize: 12, color: '#7a8794' }}>{f.notes[k]}</span>}</span>
              </label>
            ))}
          </div>
          {f.text && cur === f.text.when && <input className="field-input" value={String(v[f.text.key] ?? '')} onChange={(e) => set(f.text!.key, e.target.value)} placeholder={f.text.placeholder} style={{ ...IN, width: '100%' }} />}
        </>
      ), f.wide);
    }
    if (f.t === 'checks') return sec('c' + i, f.label, (
      <div style={{ display: 'grid', gridTemplateColumns: f.wide ? 'repeat(auto-fill, minmax(260px, 1fr))' : '1fr', gap: '7px 16px' }}>
        {f.items.map((it) => (
          <div key={it.key} style={{ display: 'grid', gap: 4 }}>
            <label style={ROW}><input type="checkbox" checked={!!v[it.key]} onChange={(e) => set(it.key, e.target.checked)} style={{ marginTop: 4, accentColor: accent }} />{it.label}</label>
            {/* 付随する項目は親の項目の下に字下げして置く（会計の印刷と同じ） */}
            {it.num && <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, paddingLeft: 20, color: v[it.key] ? '#22303c' : '#9aa5b1' }}>{it.num.label}<input className="field-input" value={String(v[it.num.key])} disabled={!v[it.key]} onChange={(e) => set(it.num!.key, e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} inputMode="numeric" style={{ ...IN, width: 80, textAlign: 'right', opacity: v[it.key] ? 1 : 0.55 }} /></label>}
          </div>
        ))}
      </div>
    ), f.wide);
    if (f.t === 'text') return sec(f.key, f.label, <input className="field-input" value={String(v[f.key])} onChange={(e) => set(f.key, e.target.value)} style={{ ...IN, width: '100%' }} />);
    if (f.t === 'seal') {
      const cur = Number(v[f.key]) || 1;
      return sec(f.key, f.label, (
        <div data-seal-start style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div role="radiogroup" aria-label="印刷を始めるシールの番号" style={{ display: 'grid', gridTemplateColumns: `repeat(${f.cols}, 52px)`, gap: 3, padding: 6, border: '1px solid #cfd8e0', borderRadius: 6, background: '#f6f8fa' }}>
            {Array.from({ length: f.cols * f.rows }, (_, i) => i + 1).map((no) => {
              const on = no === cur; const skip = no < cur;
              return <button key={no} type="button" role="radio" aria-checked={on} data-seal={no} onClick={() => set(f.key, String(no))} title={`${no} 番のシールから印刷します`} style={{ height: 26, border: '1px solid ' + (on ? accent : '#d3dbe3'), borderRadius: 4, background: on ? accent : skip ? '#e9edf1' : '#fff', color: on ? '#fff' : skip ? '#9aa5b1' : '#22303c', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}>{no}</button>;
            })}
          </div>
          <div style={{ display: 'grid', gap: 6, fontSize: 14, color: '#3d4a56', lineHeight: 1.6 }}>
            <span>1枚 {f.cols * f.rows} 区切りのシール用紙です。印刷を始めるシールの番号を選びます。</span>
            <span><b>{cur} 番</b>から印刷します{cur > 1 ? `（1〜${cur - 1} 番は使用済みとして空けます）` : ''}。</span>
          </div>
        </div>
      ), true);
    }
    if (f.t === 'number') return sec(f.key, f.label, <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}><input className="field-input" value={String(v[f.key])} onChange={(e) => set(f.key, e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} inputMode="numeric" style={{ ...IN, width: 80, textAlign: 'right' }} />{f.unit}</div>);
    return null;
  };
  /** 基本条件の項目（見出しは会計の印刷の基本条件と同じ小見出し） */
  const basicField = (f: F): ReactNode => {
    if (f.t === 'period') return (
      <div key="period" data-dep-period style={{ display: 'grid', gap: 6 }}>
        <span style={SUB}>集計期間</span>
        <label style={ROW}><input type="checkbox" checked={!!v.periodOn} onChange={(e) => set('periodOn', e.target.checked)} style={{ marginTop: 4, accentColor: accent }} />集計期間を設定する</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, paddingLeft: 20, opacity: v.periodOn ? 1 : 0.55 }}>
          <input className="field-input" value={String(v.periodFrom)} disabled={!v.periodOn} onChange={(e) => set('periodFrom', e.target.value)} aria-label="開始年月" style={{ ...IN, width: 140 }} />〜
          <input className="field-input" value={String(v.periodTo)} disabled={!v.periodOn} onChange={(e) => set('periodTo', e.target.value)} aria-label="終了年月" style={{ ...IN, width: 140 }} />
        </div>
      </div>
    );
    if (f.t !== 'range') return null;
    return (
      <div key={f.key} data-dep-range style={{ display: 'grid', gap: 6 }}>
        <span style={SUB}>印刷範囲</span>
        <label style={ROW}><input type="checkbox" checked={!!v[f.key]} onChange={(e) => set(f.key, e.target.checked)} style={{ marginTop: 4, accentColor: accent }} />{f.label}</label>
        {f.fields.map((x) => (
          <div key={x} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, paddingLeft: 20, opacity: v[f.key] ? 1 : 0.55 }}>
            <span style={{ width: 80, flex: 'none', fontSize: 14, color: '#5b6773' }}>{x}</span>
            <input className="field-input" value={String(v[f.key + x + 'From'])} disabled={!v[f.key]} onChange={(e) => set(f.key + x + 'From', e.target.value)} placeholder="先頭から" style={{ ...IN, width: 180 }} />〜
            <input className="field-input" value={String(v[f.key + x + 'To'])} disabled={!v[f.key]} onChange={(e) => set(f.key + x + 'To', e.target.value)} placeholder="最後まで" style={{ ...IN, width: 180 }} />
          </div>
        ))}
      </div>
    );
  };
  const sel = (k: string, opts: string[], label: string) => (
    <label key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 90px', alignItems: 'center', gap: 8, fontSize: 14 }}>{label}<select value={String(v[k])} onChange={(e) => set(k, e.target.value)} style={IN}>{opts.map((o) => <option key={o}>{o}</option>)}</select></label>
  );

  return (
      <div data-dep-print>
        <PrintSteps
          accent={accent}
          detailSummary={`印刷項目 ${onCount} 件`}
          dest={output}
          onDest={setOutput}
          onPreview={() => run('preview')}
          onRun={() => run(output)}
          onClose={onClose}
          basic={basicOf.length ? <ScopeBlock title="基本条件" desc="印刷する範囲と集計期間です。"><div data-print-basic style={{ display: 'grid', gap: 14 }}>{basicOf.map(basicField)}</div></ScopeBlock> : undefined}
          detail={
            <ScopeBlock kind="帳票個別" title="この帳票の詳細設定" desc={`「${title2}」の印刷だけに反映されます。次に開いたときも引き継ぎます。`} right={<button type="button" data-dep-print-reset onClick={(e) => { e.stopPropagation(); setV(defaultsOf(name)); }} title="この帳票の詳細設定を標準値に戻します" style={{ ...btnS('#5b6773'), whiteSpace: 'nowrap' }}>標準に戻す</button>}>
              <div data-detail-sections style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10, alignItems: 'start' }}>
                {sections.map(field)}
                {sec('font', 'フォント', <>{fontRowsOf(name).map(([k, l]) => (
                  <div key={k} data-dep-font={k} style={{ display: 'grid', gridTemplateColumns: l ? '56px minmax(0,1fr) 64px auto' : 'minmax(0,1fr) 64px auto', alignItems: 'center', gap: 6, fontSize: 14 }}>
                    {l && <span style={{ color: '#5b6773', fontWeight: 700 }}>{l}</span>}
                    <select aria-label={`${l || '文字'}のフォント`} value={String(v[k + 'Face'])} onChange={(e) => set(k + 'Face', e.target.value)} style={{ ...IN, minWidth: 0 }}>{FACES.map((o) => <option key={o}>{o}</option>)}</select>
                    <select aria-label={`${l || '文字'}の文字サイズ`} value={String(v[k])} onChange={(e) => set(k, e.target.value)} style={IN}>{SIZES.map((o) => <option key={o}>{o}</option>)}</select>
                    <span style={{ fontSize: 12, color: '#8290a0' }}>pt</span>
                  </div>
                ))}</>)}
                {sec('line', '罫線', <>{lineRowsOf(name).map(([k, l]) => sel(k, LINES, l))}</>)}
                {/* 印刷位置調整：会計の帳票と同じく、自由入力と▲▼で 1mm ずつ増減するスピンボタンを横に並べる（確認メモ #457・#460） */}
                {sec('pos', '印刷位置調整', (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 9 }}>
                    {([['offUp', '上方向への移動量'], ['offRight', '右方向への移動量']] as const).map(([k, l]) => (
                      <div key={k} data-dep-pos={k} style={{ display: 'grid', gap: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#8290a0' }}>{l}</span>
                        <SpinField value={String(v[k])} {...MM_SPIN} width={64} label={l} onChange={(x) => set(k, x)} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </ScopeBlock>
          }
        />
      </div>
  );
}
