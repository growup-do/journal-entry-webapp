// 小口の設定／預金の設定（確認メモ #210）
//   現行の「システムの保守関連 › ユーザー設定」（［色の設定］［印刷設定］の子画面を含む）の内容を、1 つのダイアログのタブにまとめた。
//   タブ：ユーザーオプション／印刷設定／色の設定（現行の画面名「集計済明細行の色分け指定」）
//   閉じるのは「登録」「キャンセル」と × だけ（Esc・外側のクリックでは閉じない）。
//   設定値は出納帳の画面（CashbookPage）で使う。画面の動作に反映できないもの（用紙の選択、フォントサイズ自動調整など）は値を保持するだけ。

import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Modal } from './Modal';
import { Tabs } from './ui';

export type CashbookPrefKind = 'petty' | 'bank';

/** 出納帳画面デザイン（入金欄の位置と罫線の色） */
export const LEDGER_DESIGNS = [
  { id: 'left-brown', label: '入金欄左側・茶色罫線' },
  { id: 'left-two', label: '入金欄左側・２色刷罫線' },
  { id: 'right-brown', label: '入金欄右側・茶色罫線' },
  { id: 'right-two', label: '入金欄右側・２色刷罫線' },
] as const;
export type LedgerDesign = (typeof LEDGER_DESIGNS)[number]['id'];

/** 集計伝票形式 */
export const SLIP_FORMS = ['単一式', '仕訳伝票…摘要を列記する', '仕訳伝票…摘要をまとめる', '振替伝票…摘要を列記する', '振替伝票…摘要をまとめる', '振替単一…摘要を列記する', '振替単一…摘要をまとめる'] as const;
export type SlipForm = (typeof SLIP_FORMS)[number];

export const SLIP_PAPERS = ['A4白紙へ罫線付出力', 'A5白紙へ罫線付出力', '専用帳票へ出力（縦二票）'] as const;
export const LEDGER_PAPERS = ['A4白紙へ罫線付出力', '専用帳票へ出力'] as const;
/** 色の数の上限（現行の「集計済明細行の色分け指定」と同じ） */
export const AGG_COLOR_MAX = 24;
/** 集計済明細行の色の既定（落ち着いた淡色。1 番目は従来の集計済みの色） */
export const AGG_COLORS_DEFAULT = ['#fff8c4', '#e2f1d9', '#dceaf7', '#f8e1ea', '#ebe2f7', '#fde6d2', '#dbf1ee', '#efeadb'];

export interface CashbookPrefs {
  // ---- ユーザーオプション ----
  design: LedgerDesign;
  tekiyoCodeCol: boolean;
  partnerCol: boolean;
  taxCol: boolean;
  /** 特殊行の文字 */
  labels: { subtotal: string; carry: string; close: string; pageBreak: string; pageCarry: string };
  slipForm: SlipForm;
  /** 入金行を伝票（集計内訳表）にする */
  inRowSlip: boolean;
  skipYm: boolean;
  skipIn: boolean;
  noAccWarn: boolean;
  autoPageCarry: boolean;
  gannen: boolean;
  /** エクスポートオプション */
  expOneSlip: boolean;
  expDate: boolean;
  // ---- 印刷設定 ----
  print: {
    slipPaper: (typeof SLIP_PAPERS)[number];
    slipStamp: boolean;
    /** 仕訳伝票の捺印欄の文字（1〜5。5＝担当者） */
    slipStamps: string[];
    /** 振替伝票・振替単一の捺印欄の文字（1〜4。4＝担当者） */
    transferStamps: string[];
    accCode: boolean;
    tekiyoCode: boolean;
    partner: boolean;
    partnerCode: boolean;
    tax: boolean;
    ledgerPaper: (typeof LEDGER_PAPERS)[number];
    /** 表題設定：suffix＝科目名に文字列を付加／fixed＝表題を指定する */
    titleMode: 'suffix' | 'fixed';
    titleSuffix: string;
    titleFixed: string;
    ledgerStamp: boolean;
    /** 出納帳の捺印欄の文字（1〜4。4＝担当者） */
    ledgerStamps: string[];
    fontAuto: boolean;
    era: boolean;
  };
  // ---- 色の設定 ----
  colors: string[];
}

export const prefsTitle = (kind: CashbookPrefKind) => (kind === 'petty' ? '小口の設定' : '預金の設定');
export const ledgerName = (kind: CashbookPrefKind) => (kind === 'petty' ? '小口現金出納帳' : '預金出納帳');

export function defaultPrefs(kind: CashbookPrefKind): CashbookPrefs {
  return {
    design: 'left-brown',
    tekiyoCodeCol: false,
    partnerCol: false,
    taxCol: false,
    labels: { subtotal: '小計', carry: '前期繰越', close: '〆', pageBreak: '改頁', pageCarry: '前頁繰越' },
    slipForm: '仕訳伝票…摘要をまとめる',
    inRowSlip: false,
    skipYm: false,
    skipIn: false,
    noAccWarn: false,
    autoPageCarry: false,
    gannen: true,
    expOneSlip: false,
    expDate: false,
    print: {
      slipPaper: 'A4白紙へ罫線付出力',
      slipStamp: true,
      slipStamps: ['', '', '', '', '担当者'],
      transferStamps: ['', '', '', '担当者'],
      accCode: false,
      tekiyoCode: false,
      partner: false,
      partnerCode: false,
      tax: false,
      ledgerPaper: 'A4白紙へ罫線付出力',
      titleMode: 'fixed',
      titleSuffix: '出納帳',
      titleFixed: ledgerName(kind),
      ledgerStamp: false,
      ledgerStamps: ['', '', '', '担当者'],
      fontAuto: false,
      era: false,
    },
    colors: [...AGG_COLORS_DEFAULT],
  };
}

/** 設定の保管（画面を移っても残す。本番ではユーザーごとにサーバーへ保存する） */
const store: Partial<Record<CashbookPrefKind, CashbookPrefs>> = {};
export const loadPrefs = (kind: CashbookPrefKind): CashbookPrefs => store[kind] ?? defaultPrefs(kind);
export const savePrefs = (kind: CashbookPrefKind, p: CashbookPrefs) => { store[kind] = p; };

/** 入金欄を右側に置くデザインか */
export const inRightOf = (p: CashbookPrefs) => p.design.startsWith('right');
/** 罫線の色（茶色罫線／２色刷罫線。２色刷は入金欄を青、出金欄を赤の罫線にする） */
export function ruleColors(p: CashbookPrefs): { base: string; inLine: string; outLine: string } {
  if (p.design.endsWith('brown')) return { base: '#e6d3bf', inLine: '#e6d3bf', outLine: '#e6d3bf' };
  return { base: '#e3e9ef', inLine: '#b9cde8', outLine: '#eec3cb' };
}
/** 集計伝票形式の種類（仕訳／振替／振替単一／単一式）と、摘要をまとめるか */
export function slipFormOf(f: SlipForm): { kind: '単一式' | '仕訳伝票' | '振替伝票' | '振替単一'; merge: boolean } {
  if (f === '単一式') return { kind: '単一式', merge: false };
  const kind = f.startsWith('仕訳') ? '仕訳伝票' : f.startsWith('振替単一') ? '振替単一' : '振替伝票';
  return { kind, merge: f.endsWith('まとめる') };
}
/** 出納帳の表題（表題設定に合わせる）。科目名は小口現金なら「小口現金」、預金出納なら預金科目 */
export const ledgerTitleOf = (p: CashbookPrefs, accountName: string) => (p.print.titleMode === 'suffix' ? `${accountName}${p.print.titleSuffix}` : p.print.titleFixed || accountName);

// ---------------- ダイアログ ----------------

export type PrefsTab = 'ユーザーオプション' | '印刷設定' | '色の設定';
const TABS: PrefsTab[] = ['ユーザーオプション', '印刷設定', '色の設定'];

interface Props {
  open: boolean;
  kind: CashbookPrefKind;
  /** 開いたときのタブ（出納帳印刷の［出納帳設定］からは「印刷設定」） */
  tab: PrefsTab;
  prefs: CashbookPrefs;
  /** 消費税の処理方式が通常モード以外か（そのときは消費税欄のチェックがなくても欄を出す） */
  taxEntry: boolean;
  accent: string;
  onSave: (p: CashbookPrefs) => void;
  onClose: () => void;
}

const box: CSSProperties = { border: '1px solid #e2e8ee', borderRadius: 10, padding: '10px 14px 12px', background: '#fff' };
const boxHead: CSSProperties = { fontSize: 14, fontWeight: 700, color: '#3d4a57', marginBottom: 8 };
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, lineHeight: 1.4, padding: '1px 0', cursor: 'pointer' };
const txt: CSSProperties = { boxSizing: 'border-box', padding: '5px 8px', border: '1px solid #cfd8e0', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#22303c' };
const note: CSSProperties = { fontSize: 12, color: '#7a8794', lineHeight: 1.6 };

function Section({ title, children, style }: { title: string; children: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...box, ...style }}><div style={boxHead}>{title}</div>{children}</div>;
}
function Check({ on, onChange, children, disabled }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return <label style={{ ...row, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'pointer' }}><input type="checkbox" checked={on} disabled={disabled} onChange={() => onChange(!on)} />{children}</label>;
}
function Radio<T extends string>({ name, value, cur, onChange, children }: { name: string; value: T; cur: T; onChange: (v: T) => void; children: ReactNode }) {
  return <label style={row}><input type="radio" name={name} checked={cur === value} onChange={() => onChange(value)} />{children}</label>;
}
/** 捺印欄の文字（番号つきの入力欄を横に並べる） */
function StampInputs({ values, onChange, disabled, label }: { values: string[]; onChange: (v: string[]) => void; disabled?: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', opacity: disabled ? 0.5 : 1 }}>
      <span style={{ fontSize: 12, color: '#5b6773', minWidth: 64 }}>{label}</span>
      {values.map((v, i) => (
        <label key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, color: '#7a8794' }}>
          {i + 1}
          <input aria-label={`${label} 捺印欄${i + 1}の文字`} value={v} disabled={disabled} maxLength={6} onChange={(e) => onChange(values.map((x, k) => (k === i ? e.target.value : x)))} style={{ ...txt, width: 54, padding: '4px 5px', fontSize: 12 }} />
        </label>
      ))}
    </div>
  );
}

export function CashbookSettingsDialog({ open, kind, tab, prefs, taxEntry, accent, onSave, onClose }: Props) {
  const [d, setD] = useState<CashbookPrefs>(prefs);
  const [cur, setCur] = useState<PrefsTab>(tab);
  useEffect(() => { if (open) { setD(prefs); setCur(tab); } }, [open, prefs, tab]);
  const set = (p: Partial<CashbookPrefs>) => setD((x) => ({ ...x, ...p }));
  const setPrint = (p: Partial<CashbookPrefs['print']>) => setD((x) => ({ ...x, print: { ...x.print, ...p } }));
  const setLabel = (p: Partial<CashbookPrefs['labels']>) => setD((x) => ({ ...x, labels: { ...x.labels, ...p } }));
  const btn = (primary?: boolean): CSSProperties => ({ padding: '8px 16px', borderRadius: 8, border: primary ? 'none' : '1px solid #cfd8e0', background: primary ? accent : '#fff', color: primary ? '#fff' : '#5b6773', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const accName = kind === 'petty' ? '小口現金' : '（預金科目）';
  const LABELS: [keyof CashbookPrefs['labels'], string][] = [['subtotal', '小計'], ['carry', '前期繰越'], ['close', '締切線'], ['pageBreak', '改ページ'], ['pageCarry', '前頁繰越']];
  const sampleRows = [0, 1, 2, 3, 4, 5];

  return (
    <Modal open={open} onClose={onClose} width={1000} title={prefsTitle(kind)}>
      <div data-cashbook-prefs={kind}>
        <Tabs items={TABS} current={cur} onChange={(v) => setCur(v as PrefsTab)} accent={accent} small />
        <div style={{ padding: '12px 22px 4px', minHeight: 520 }}>
          {cur === 'ユーザーオプション' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
              <div style={{ display: 'grid', gap: 12 }}>
                <Section title="出納帳画面デザイン">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
                    {LEDGER_DESIGNS.map((o) => <Radio key={o.id} name="cb-design" value={o.id} cur={d.design} onChange={(v) => set({ design: v })}>{o.label}</Radio>)}
                  </div>
                  <div style={{ ...note, marginTop: 4 }}>２色刷罫線は、入金欄を青、出金欄を赤の罫線で表示します。</div>
                </Section>
                <Section title="欄の設定">
                  <Check on={d.tekiyoCodeCol} onChange={(v) => set({ tekiyoCodeCol: v })}>摘要コード欄を設ける</Check>
                  <Check on={d.partnerCol} onChange={(v) => set({ partnerCol: v })}>取引先欄を設ける</Check>
                  <Check on={d.taxCol} onChange={(v) => set({ taxCol: v })}>消費税欄を設ける</Check>
                  {taxEntry && <div style={note}>消費税の処理方式が「通常モード」以外のため、チェックがなくても消費税欄を表示します。</div>}
                </Section>
                <Section title="特殊行の文字">
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', gap: '6px 10px', alignItems: 'center', fontSize: 14 }}>
                    {LABELS.map(([k, l]) => [
                      <label key={`${k}-l`} htmlFor={`cbp-${k}`} style={{ color: '#5b6773', whiteSpace: 'nowrap' }}>{l}</label>,
                      <input key={`${k}-i`} id={`cbp-${k}`} value={d.labels[k]} maxLength={8} onChange={(e) => setLabel({ [k]: e.target.value })} style={{ ...txt, width: '100%' }} />,
                    ])}
                  </div>
                </Section>
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                <Section title="集計伝票形式">
                  {SLIP_FORMS.map((f) => <Radio key={f} name="cb-slipform" value={f} cur={d.slipForm} onChange={(v) => set({ slipForm: v })}>{f}</Radio>)}
                </Section>
                <Section title="動作設定">
                  <Check on={d.inRowSlip} onChange={(v) => set({ inRowSlip: v })}>入金行を伝票（集計内訳表）にする</Check>
                  <Check on={d.skipYm} onChange={(v) => set({ skipYm: v })}>年月スキップする</Check>
                  <Check on={d.skipIn} onChange={(v) => set({ skipIn: v })}>入金額欄をスキップする</Check>
                  <Check on={d.noAccWarn} onChange={(v) => set({ noAccWarn: v })}>勘定科目の警告ダイアログを出さない</Check>
                  <Check on={d.autoPageCarry} onChange={(v) => set({ autoPageCarry: v })}>前頁繰越行の自動挿入を有効にする</Check>
                  <Check on={d.gannen} onChange={(v) => set({ gannen: v })}>和暦の1年を元年と表記する</Check>
                </Section>
                <Section title="エクスポートオプション">
                  <Check on={d.expOneSlip} onChange={(v) => set({ expOneSlip: v })}>一明細を一伝票としてエクスポートする</Check>
                  <Check on={d.expDate} onChange={(v) => set({ expDate: v })}>伝票の摘要欄に明細の日付を挿入する</Check>
                </Section>
              </div>
            </div>
          )}

          {cur === '印刷設定' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
              <div style={{ display: 'grid', gap: 12 }}>
                <Section title="伝票印刷の用紙選択">
                  {SLIP_PAPERS.map((p) => <Radio key={p} name="cb-slippaper" value={p} cur={d.print.slipPaper} onChange={(v) => setPrint({ slipPaper: v })}>{p}</Radio>)}
                </Section>
                <Section title="伝票の捺印欄">
                  <Check on={d.print.slipStamp} onChange={(v) => setPrint({ slipStamp: v })}>捺印欄を印刷する</Check>
                  <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
                    <StampInputs label="仕訳伝票" values={d.print.slipStamps} disabled={!d.print.slipStamp} onChange={(v) => setPrint({ slipStamps: v })} />
                    <StampInputs label="振替・振単" values={d.print.transferStamps} disabled={!d.print.slipStamp} onChange={(v) => setPrint({ transferStamps: v })} />
                  </div>
                  <div style={{ ...note, marginTop: 6 }}>捺印欄の文字は、左から順に印刷します（空欄の枠は文字なしで印刷します）。</div>
                </Section>
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                <Section title="出納帳印刷">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
                    <Check on={d.print.accCode} onChange={(v) => setPrint({ accCode: v })}>科目コードを印刷する</Check>
                    <Check on={d.print.tekiyoCode} onChange={(v) => setPrint({ tekiyoCode: v })}>摘要コードを印刷する</Check>
                    <Check on={d.print.partner} onChange={(v) => setPrint({ partner: v })}>取引先名を印刷する</Check>
                    <Check on={d.print.partnerCode} onChange={(v) => setPrint({ partnerCode: v })}>取引先コードを印刷する</Check>
                    <Check on={d.print.tax} onChange={(v) => setPrint({ tax: v })}>消費税額を印刷する</Check>
                  </div>
                  <div style={{ borderTop: '1px solid #eef2f5', marginTop: 8, paddingTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#7a8794', marginBottom: 2 }}>出納帳の用紙選択</div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {LEDGER_PAPERS.map((p) => <Radio key={p} name="cb-ledgerpaper" value={p} cur={d.print.ledgerPaper} onChange={(v) => setPrint({ ledgerPaper: v })}>{p}</Radio>)}
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #eef2f5', marginTop: 8, paddingTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#7a8794', marginBottom: 2 }}>表題設定</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Radio name="cb-title" value="suffix" cur={d.print.titleMode} onChange={(v) => setPrint({ titleMode: v })}>科目名に文字列を付加</Radio>
                      <input aria-label="科目名に付加する文字列" value={d.print.titleSuffix} disabled={d.print.titleMode !== 'suffix'} maxLength={12} onChange={(e) => setPrint({ titleSuffix: e.target.value })} style={{ ...txt, width: 140, opacity: d.print.titleMode === 'suffix' ? 1 : 0.5 }} />
                      <span style={note}>例：{accName}{d.print.titleSuffix}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                      <Radio name="cb-title" value="fixed" cur={d.print.titleMode} onChange={(v) => setPrint({ titleMode: v })}>表題を指定する</Radio>
                      <input aria-label="表題" value={d.print.titleFixed} disabled={d.print.titleMode !== 'fixed'} maxLength={20} onChange={(e) => setPrint({ titleFixed: e.target.value })} style={{ ...txt, width: 220, opacity: d.print.titleMode === 'fixed' ? 1 : 0.5 }} />
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #eef2f5', marginTop: 8, paddingTop: 8 }}>
                    <Check on={d.print.ledgerStamp} onChange={(v) => setPrint({ ledgerStamp: v })}>捺印欄を印刷する</Check>
                    <div style={{ marginTop: 4 }}><StampInputs label="出納帳" values={d.print.ledgerStamps} disabled={!d.print.ledgerStamp} onChange={(v) => setPrint({ ledgerStamps: v })} /></div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 6 }}>
                      <Check on={d.print.fontAuto} onChange={(v) => setPrint({ fontAuto: v })}>フォントサイズ自動調整</Check>
                      <Check on={d.print.era} onChange={(v) => setPrint({ era: v })}>元号を印字する</Check>
                    </div>
                  </div>
                </Section>
              </div>
            </div>
          )}

          {cur === '色の設定' && (
            <div data-agg-colors style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 16, alignItems: 'start' }}>
              <Section title="集計済明細行の色分け指定">
                <div style={{ ...note, marginBottom: 10 }}>集計した明細行の背景色です。集計するごとに 1 番目の色から順に使い、最後の色まで使うと 1 番目に戻ります（{AGG_COLOR_MAX} 色まで）。</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
                  {d.colors.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', border: '1px solid #e2e8ee', borderRadius: 8 }}>
                      <span style={{ fontSize: 12, color: '#7a8794', width: 16, textAlign: 'right' }}>{i + 1}</span>
                      <input type="color" aria-label={`${i + 1}番目の色`} value={c} onChange={(e) => set({ colors: d.colors.map((x, k) => (k === i ? e.target.value : x)) })} style={{ width: 34, height: 26, padding: 0, border: '1px solid #cfd8e0', borderRadius: 4, background: '#fff', cursor: 'pointer' }} />
                      <button type="button" title="この色を外す" aria-label={`${i + 1}番目の色を外す`} disabled={d.colors.length <= 1} onClick={() => set({ colors: d.colors.filter((_, k) => k !== i) })} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: d.colors.length <= 1 ? '#c3ccd4' : '#8290a0', fontSize: 14, cursor: d.colors.length <= 1 ? 'default' : 'pointer', padding: 0 }}>×</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                  <button type="button" className="btn-outline" disabled={d.colors.length >= AGG_COLOR_MAX} onClick={() => set({ colors: [...d.colors, AGG_COLORS_DEFAULT[d.colors.length % AGG_COLORS_DEFAULT.length]] })} style={{ ...btn(), padding: '6px 12px', opacity: d.colors.length >= AGG_COLOR_MAX ? 0.5 : 1 }}>＋ 色を追加</button>
                  <button type="button" className="btn-outline" onClick={() => set({ colors: [...AGG_COLORS_DEFAULT] })} style={{ ...btn(), padding: '6px 12px' }}>既定の色に戻す</button>
                  <span style={{ ...note, marginLeft: 'auto' }}>{d.colors.length} / {AGG_COLOR_MAX} 色</span>
                </div>
              </Section>
              <Section title="表示の例">
                <div style={{ border: '1px solid #e2e8ee', borderRadius: 8, overflow: 'hidden', fontSize: 12 }}>
                  {sampleRows.map((n) => (
                    <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', borderBottom: '1px solid #eef2f5', background: d.colors[Math.floor(n / 2) % d.colors.length] }}>
                      <span>{Math.floor(n / 2) + 1}回目の集計の明細</span><span style={{ color: '#7a8794' }}>{Math.floor(n / 2) + 1} 番目の色</span>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '10px 22px 16px' }}>
          <span style={{ ...note, marginRight: 'auto' }}>現行の「システムの保守関連 › ユーザー設定」（色の設定・印刷設定を含む）と同じ項目です。</span>
          <button type="button" className="submit-btn" onClick={() => onSave(d)} style={btn(true)}>登録</button>
          <button type="button" onClick={onClose} style={btn()}>キャンセル</button>
        </div>
      </div>
    </Modal>
  );
}
