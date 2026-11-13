// 減価償却：帳票印刷の条件画面と詳細設定（確認メモ #251）
//   現行「減価償却オプションシステム」の印刷条件画面（出力先）と［詳細設定］の内容を、1 つのダイアログにまとめる。
//   流れはほかの帳票と同じ「1. 詳細設定 → 2. 出力先 → 3. 印刷／プレビュー」（PrintSteps。確認事項「印刷の画面遷移の統一」）。
//   詳細設定の左：その帳票の設定（帳票ごとに項目が違う）／右：全帳票に共通のフォント・罫線・印刷位置調整。
//   「償却方法の印字設定」は現行のアップデートで追加された項目（固定資産管理台帳（新会計版）と固定資産管理台帳のみ）。
//   設定は帳票ごとに覚え、次に開いたときも引き継ぐ（実行したときに保存。キャンセルでは保存しない）。

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Modal } from './Modal';
import { PrintSteps, type OutKind } from './PrintSteps';

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
  | { t: 'number'; key: string; label: string; def: number; unit: string };

const ORDER: F = { t: 'radio', key: 'order', label: '固定資産の印刷順序', options: ['資産コード順', '取得日付順'], def: '取得日付順' };
const MULTI: F = { t: 'radio', key: 'multi', label: '複数固定資産の印字方法', options: ['まとめて印字', '格別に列記印字'], def: 'まとめて印字', disabled: true };
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
  if (n === '固定資産管理台帳') return [ORDER, MULTI, { t: 'radio', key: 'kind', label: '資産種類名', options: ['印刷しない', '印刷する'], def: '印刷しない' }, { t: 'radio', key: 'months', label: '償却月数', options: ['当年度のみ', '累計'], def: '累計' }, title(name), { t: 'radio', key: 'foot', label: '脚注の入力', options: ['何も印刷しない', '手入力文字を印刷'], def: '何も印刷しない', text: { when: '手入力文字を印刷', key: 'footText', placeholder: '脚注に印刷する文字' } }, range(['区分', '資産コード']), PERIOD, METHOD, checksA(false)];
  if (n === '個別固定資産管理台帳') return [range(['資産コード'], '資産コード範囲指定'), title(name), { t: 'checks', label: '印刷する内容', items: [{ key: 'redeem', label: '償還補助金の入金額の経年印刷', def: true }, { key: 'page', label: 'ページ番号を印刷する', def: true }, { key: 'date', label: '印刷時の日付を印刷する', def: false }] }];
  if (n === '当期変更情報一覧表') return [ORDER, title(name)];
  if (n === '固定資産タックシール') return [{ t: 'checks', label: '印刷項目', items: [{ key: 'tCode', label: '資産コード', def: true }, { key: 'tCost', label: '取得価額', def: true }, { key: 'tDate', label: '印刷年月日', def: true }] }, { t: 'checks', label: '印刷する物件', items: [{ key: 'tSkip', label: '除却/売却固定資産は印字しない', def: false }] }, { t: 'number', key: 'start', label: '印刷開始指定（シートの何枚目から）', def: 1, unit: '枚目から' }, range(['資産コード'])];
  if (n === '備品一覧表（1）') return [range(['備品コード']), { t: 'checks', label: '改ページ設定', items: [{ key: 'brk', label: '科目ごとに改ページする', def: false }] }, title(name)];
  if (n === '備品一覧表（2）') return [{ t: 'radio', key: 'order', label: '備品の印刷順序', options: ['備品コード順', '取得日付順'], def: '備品コード順' }, { t: 'checks', label: '合計欄の印刷', items: [{ key: 'total', label: '合計欄を印刷する', def: true }] }, title(name)];
  if (n === '固定資産管理台帳（施設設備管理用）') return [range(['資産コード'])];
  if (n === '除却固定資産一覧表') return [DATA, ORDER, MULTI, title(name), { t: 'checks', label: '除却参考仕訳', items: [{ key: 'ref', label: '除却参考仕訳を印刷する', def: false }] }, checksA(true)];
  if (n === '売却固定資産一覧表') return [DATA, ORDER, MULTI, title(name), { t: 'checks', label: '売却参考仕訳', items: [{ key: 'ref', label: '売却参考仕訳を印刷する', def: false }] }, checksA(true)];
  // 取得／移管（元）／移管（先）：新会計版から「通知文の印刷」と「集計期間」を除いた構成
  return [DATA, ORDER, MULTI, title(name), checksA(true)];
}

const SIZES = Array.from({ length: 11 }, (_, i) => String(i + 4));
const LINES = ['細線', '通常', '太線'];
const COMMON_DEF: DepValues = { fName: '7', fItem: '6', fAmt: '5', lIn: '細線', lBranch: '細線', lOuter: '細線', offUp: '0', offRight: '0' };
function defaultsOf(name: string): DepValues {
  const v: DepValues = { ...COMMON_DEF, periodOn: false, periodFrom: '令和8年4月', periodTo: '令和9年3月' };
  sectionsOf(name).forEach((f) => {
    if (f.t === 'radio') { v[f.key] = f.def; if (f.text) v[f.text.key] = ''; }
    if (f.t === 'text') v[f.key] = f.def;
    if (f.t === 'number') v[f.key] = String(f.def);
    if (f.t === 'range') { v[f.key] = f.def; f.fields.forEach((x) => { v[f.key + x + 'From'] = ''; v[f.key + x + 'To'] = ''; }); }
    if (f.t === 'checks') f.items.forEach((it) => { v[it.key] = it.def; if (it.num) v[it.num.key] = String(it.num.def); });
  });
  return v;
}
/** 帳票ごとの設定（開き直しても前回の設定を引き継ぐ） */
const SAVED = new Map<string, { values: DepValues; output: OutKind }>();

const LBL: CSSProperties = { fontSize: 12, fontWeight: 700, color: '#8290a0', marginBottom: 6, display: 'block' };
const BOX: CSSProperties = { border: '1px solid #e2e8ee', borderRadius: 10, padding: '10px 12px', background: '#fff', minWidth: 0 };
const IN: CSSProperties = { boxSizing: 'border-box', padding: '5px 8px', border: '1px solid #cfd8e0', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#22303c' };
const ROW: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 14, lineHeight: 1.45, cursor: 'pointer' };

export function DepPrintModal({ name, accent, onRun, onClose }: { name: string; accent: string; onRun: (values: DepValues, output: DepOutput) => void; onClose: () => void }) {
  const saved = SAVED.get(name);
  const [v, setV] = useState<DepValues>(() => ({ ...defaultsOf(name), ...(saved?.values ?? {}) }));
  const [output, setOutput] = useState<OutKind>(saved?.output ?? 'print');
  const set = (k: string, x: string | boolean) => setV((s) => ({ ...s, [k]: x }));
  const sections = sectionsOf(name);
  const run = (o: DepOutput) => { SAVED.set(name, { values: v, output }); onRun(v, o); };
  const btn = (solid = false): CSSProperties => ({ padding: '8px 16px', borderRadius: 8, border: '1px solid ' + (solid ? accent : '#cfd8e0'), background: solid ? accent : '#fff', color: solid ? '#fff' : '#22303c', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });

  const box = (key: string, label: string, body: ReactNode, wide?: boolean) => <div key={key} style={{ ...BOX, gridColumn: wide ? '1 / -1' : undefined }}><span style={LBL}>{label}</span>{body}</div>;
  const field = (f: F, i: number): ReactNode => {
    if (f.t === 'radio') {
      const cur = String(v[f.key]);
      return box(f.key + i, f.label + (f.disabled ? '（この帳票では変更できません）' : ''), (
        <div style={{ display: 'grid', gap: 5 }}>
          {f.options.map((o, k) => (
            <label key={o} style={{ ...ROW, color: f.disabled ? '#9aa5b1' : '#22303c', cursor: f.disabled ? 'default' : 'pointer' }}>
              <input type="radio" checked={cur === o} disabled={f.disabled} onChange={() => set(f.key, o)} style={{ marginTop: 3 }} />
              <span>{f.key === 'method' ? methodLabel(o) : o}{f.notes && <span style={{ display: 'block', fontSize: 12, color: '#7a8794' }}>{f.notes[k]}</span>}</span>
            </label>
          ))}
          {f.text && cur === f.text.when && <input className="field-input" value={String(v[f.text.key] ?? '')} onChange={(e) => set(f.text!.key, e.target.value)} placeholder={f.text.placeholder} style={{ ...IN, width: '100%' }} />}
        </div>
      ), f.wide);
    }
    if (f.t === 'checks') return box('c' + i, f.label, (
      <div style={{ display: 'grid', gridTemplateColumns: f.wide ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: '5px 14px' }}>
        {f.items.map((it) => (
          <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <label style={ROW}><input type="checkbox" checked={!!v[it.key]} onChange={(e) => set(it.key, e.target.checked)} style={{ marginTop: 3 }} />{it.label}</label>
            {it.num && <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#5b6773' }}>{it.num.label}<input className="field-input" value={String(v[it.num.key])} disabled={!v[it.key]} onChange={(e) => set(it.num!.key, e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} inputMode="numeric" style={{ ...IN, width: 56, textAlign: 'right' }} /></label>}
          </div>
        ))}
      </div>
    ), f.wide);
    if (f.t === 'text') return box(f.key, f.label, <input className="field-input" value={String(v[f.key])} onChange={(e) => set(f.key, e.target.value)} style={{ ...IN, width: '100%' }} />);
    if (f.t === 'number') return box(f.key, f.label, <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}><input className="field-input" value={String(v[f.key])} onChange={(e) => set(f.key, e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} inputMode="numeric" style={{ ...IN, width: 64, textAlign: 'right' }} />{f.unit}</div>);
    if (f.t === 'period') return box('period', '集計期間', (
      <div style={{ display: 'grid', gap: 6 }}>
        <label style={ROW}><input type="checkbox" checked={!!v.periodOn} onChange={(e) => set('periodOn', e.target.checked)} style={{ marginTop: 3 }} />集計期間を設定する</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, opacity: v.periodOn ? 1 : 0.5 }}>
          <input className="field-input" value={String(v.periodFrom)} disabled={!v.periodOn} onChange={(e) => set('periodFrom', e.target.value)} aria-label="開始年月" style={{ ...IN, width: 120 }} />〜
          <input className="field-input" value={String(v.periodTo)} disabled={!v.periodOn} onChange={(e) => set('periodTo', e.target.value)} aria-label="終了年月" style={{ ...IN, width: 120 }} />
        </div>
      </div>
    ));
    // 印刷範囲
    return box(f.key, '印刷範囲', (
      <div style={{ display: 'grid', gap: 6 }}>
        <label style={ROW}><input type="checkbox" checked={!!v[f.key]} onChange={(e) => set(f.key, e.target.checked)} style={{ marginTop: 3 }} />{f.label}</label>
        {f.fields.map((x) => (
          <div key={x} style={{ display: 'grid', gridTemplateColumns: '72px 1fr auto 1fr', alignItems: 'center', gap: 6, fontSize: 14, opacity: v[f.key] ? 1 : 0.5 }}>
            <span style={{ fontSize: 12, color: '#5b6773' }}>{x}</span>
            <input className="field-input" value={String(v[f.key + x + 'From'])} disabled={!v[f.key]} onChange={(e) => set(f.key + x + 'From', e.target.value)} placeholder="先頭から" style={{ ...IN, width: '100%' }} />〜
            <input className="field-input" value={String(v[f.key + x + 'To'])} disabled={!v[f.key]} onChange={(e) => set(f.key + x + 'To', e.target.value)} placeholder="最後まで" style={{ ...IN, width: '100%' }} />
          </div>
        ))}
      </div>
    ));
  };
  const sel = (k: string, opts: string[], label: string) => (
    <label style={{ display: 'grid', gridTemplateColumns: '1fr 86px', alignItems: 'center', gap: 8, fontSize: 14 }}>{label}<select value={String(v[k])} onChange={(e) => set(k, e.target.value)} style={IN}>{opts.map((o) => <option key={o}>{o}</option>)}</select></label>
  );

  return (
    <Modal open onClose={onClose} width={1180} title={`印刷：${name.replace(/\(/g, '（').replace(/\)/g, '）')}`} style={{ maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div data-dep-print style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <PrintSteps
          accent={accent}
          detailSummary="この帳票だけの設定と、全帳票共通のフォント・罫線・印刷位置"
          dest={output}
          onDest={setOutput}
          confirm={[['帳票', name.replace(/\(/g, '（').replace(/\)/g, '）')], ['タイトル', String(v.title ?? '')], ['フォント・罫線', `各名称 ${v.fName}／項目名 ${v.fItem}／金額 ${v.fAmt}・罫線 ${v.lIn}`], ['印刷位置調整', `上 ${v.offUp} mm／右 ${v.offRight} mm`]].filter(([, x]) => x) as [string, string][]}
          onPreview={() => run('preview')}
          onRun={() => run(output)}
          onClose={onClose}
          detail={<div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 14 }}>
        {/* 左：この帳票の詳細設定 */}
        <div style={{ minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>この帳票の設定<span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: '#7a8794' }}>この帳票だけの設定です。次に開いたときも引き継ぎます。</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, alignItems: 'start' }}>{sections.map(field)}</div>
        </div>
        {/* 右：全帳票共通のフォント・罫線・印刷位置 */}
        <div style={{ minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {box('font', 'フォント（ＭＳ ゴシック）', <div style={{ display: 'grid', gap: 6 }}>{sel('fName', SIZES, '各名称')}{sel('fItem', SIZES, '項目名')}{sel('fAmt', SIZES, '金額')}</div>)}
          {box('line', '罫線', <div style={{ display: 'grid', gap: 6 }}>{sel('lIn', LINES, '内部')}{sel('lBranch', LINES, '分岐')}{sel('lOuter', LINES, '外周')}</div>)}
          {box('pos', '印刷位置調整（mm）', (
            <div style={{ display: 'grid', gap: 6 }}>
              {([['offUp', '上方向への移動量'], ['offRight', '右方向への移動量']] as const).map(([k, l]) => (
                <label key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 86px', alignItems: 'center', gap: 8, fontSize: 14 }}>{l}<input className="field-input" value={String(v[k])} onChange={(e) => set(k, e.target.value.replace(/[^0-9.-]/g, '').slice(0, 5))} inputMode="decimal" style={{ ...IN, textAlign: 'right' }} /></label>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" className="btn-outline" data-dep-print-reset onClick={() => setV(defaultsOf(name))} style={btn()}>リセット</button>
        <span style={{ fontSize: 12, color: '#7a8794' }}>標準値がセットされます。</span>
      </div>
          </div>}
        />
      </div>
    </Modal>
  );
}
