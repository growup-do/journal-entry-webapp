// 伝票入力（4形式）で共通に使う部品（依頼書 5.3.1〜5.3.6／6.2／6.4／6.5）
//   ・形式の切替（仕訳伝票形式／単一形式／振替伝票形式／振替単一形式）… FormatSwitcher
//   ・入力欄の中で候補を絞り込むオートコンプリート（コード・名称・フリガナ）… ComboField
//   ・入力位置の明示（太枠＋背景色＋「入力中」マーク）… EntryStyles／FieldLabel
//   ・登録できない仕訳（エラー）と、確認して続行できる警告の判定と表示 … judgeEntry／IssueList
//   ・機能ボタン（性質ごとのグループ）とショートカット（Alt＋英字。フォーカス位置に依存しない）… ActionGroup／ActButton／useShortcuts
//   ・参照のみ／親区分・合算区分で起動したときの帯 … ReadOnlyBanner

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { Modal } from './Modal';
import { btn } from './ui';
import { ACCOUNTS, SERVICES, SUMMARIES, VENDORS, displayName } from '../data';
import { ACCOUNT_META, budgetSample, judgeTorihiki, metaOf, toKatakana } from '../lib/accounts';
import type { EnvSettings } from '../store/session';

/* ------------------------------------------------------------------ */
/* 形式                                                                */
/* ------------------------------------------------------------------ */
export const ENTRY_FORMATS = ['伝票入力', '単一入力', '振替入力', '振替単一'] as const;
export type EntryFormat = (typeof ENTRY_FORMATS)[number];
export const FORMAT_NOTE: Record<EntryFormat, string> = {
  伝票入力: '1枚の伝票に複数行。借方・貸方の科目は伝票につき1組',
  単一入力: '1伝票＝1行',
  振替入力: '行ごとに借方・貸方の科目と金額（複数行）',
  振替単一: '振替伝票形式の1伝票1行版',
};
/** 仕訳の種別（共有ストアの kind）との対応 */
export const FORMAT_KIND: Record<EntryFormat, '伝票' | '単一' | '振替' | '振単'> = { 伝票入力: '伝票', 単一入力: '単一', 振替入力: '振替', 振替単一: '振単' };

/* ------------------------------------------------------------------ */
/* スタイル（入力位置の明示・ボタン・キー表示）                          */
/* ------------------------------------------------------------------ */
const CSS = `
.ef-input { transition: background .1s, border-color .1s; }
.ef-input:focus { outline: 3px solid var(--ef-accent, #1f7a52) !important; outline-offset: 1px; background: #fff8d6 !important; border-color: var(--ef-accent, #1f7a52) !important; }
.ef-box { transition: background .1s, border-color .1s; }
.ef-box:focus-within { outline: 3px solid var(--ef-accent, #1f7a52); outline-offset: 1px; background: #fff8d6 !important; border-color: var(--ef-accent, #1f7a52) !important; }
.ef-bare { outline: none !important; background: transparent !important; }
.ef-now { display: none; margin-left: 6px; padding: 1px 7px; border-radius: 8px; background: var(--ef-accent, #1f7a52); color: #fff; font-size: 10px; font-weight: 800; letter-spacing: .06em; vertical-align: 1px; }
.ef-row { transition: background .1s; }
.ef-row:focus-within { background: #fffdf0 !important; box-shadow: inset 4px 0 0 var(--ef-accent, #1f7a52); }
.ef-rownow { display: none; }
.ef-row:focus-within .ef-rownow { display: inline-block; }
.ef-row:focus-within .ef-rowno { display: none; }
.ef-kbd { display: inline-block; margin-left: 6px; padding: 0 5px; border: 1px solid currentColor; border-radius: 4px; font-size: 9.5px; font-weight: 700; line-height: 15px; opacity: .7; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: nowrap; }
.ef-act { transition: filter .12s, border-color .12s, box-shadow .12s; }
.ef-act:hover:not(:disabled) { filter: brightness(.96); box-shadow: 0 0 0 3px rgba(40,60,80,.08); }
.ef-act:focus-visible { outline: 3px solid var(--ef-accent, #1f7a52); outline-offset: 2px; }
/* 内部取引スイッチ：Enter 送りで止まったとき、入力欄と同じ太枠＋黄色の下地で分かるようにする */
[data-menu="内部取引"]:focus { outline: 3px solid var(--ef-accent, #1f7a52) !important; outline-offset: 1px; background: #fff8d6 !important; border-radius: 8px; }
.ef-act:disabled { cursor: not-allowed; opacity: .45; }
.ef-cand { cursor: pointer; }
.ef-pickrow { cursor: pointer; }
.ef-pickrow:hover { background: #f4f7fa; }
.ef-pickrow:focus { outline: 3px solid var(--ef-accent, #1f7a52); outline-offset: -3px; background: #fff8d6; }
@media (max-width: 1100px) { .ef-hide-narrow { display: none !important; } }
`;
export function EntryStyles() {
  return <style>{CSS}</style>;
}
/** アクセント色の CSS 変数を付けるラッパー用スタイル */
export const scopeStyle = (accent: string): CSSProperties => ({ '--ef-accent': accent } as CSSProperties);

/** 入力欄の見出し（入力位置は太枠と背景色で示す。「入力中」マークは廃止） */
export function FieldLabel({ children, color, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return (
    <span className="ef-label" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: color ?? '#8290a0', marginBottom: 6, letterSpacing: '.03em', whiteSpace: 'nowrap', ...style }}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Enter 送り（IME 変換確定の Enter は無視）                             */
/* ------------------------------------------------------------------ */
export const isIme = (e: ReactKeyboardEvent) => e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229;
export function onEnter(fn: () => void) {
  return (e: ReactKeyboardEvent) => {
    if (e.key !== 'Enter' || e.altKey) return;
    if (isIme(e)) return;
    e.preventDefault();
    fn();
  };
}
export const focusId = (id: string) =>
  window.setTimeout(() => {
    const el = document.getElementById(id);
    if (!el) return;
    el.focus();
    if (el instanceof HTMLInputElement) el.select();
  }, 0);
export const toNum = (s: string) => parseInt(String(s).replace(/[^0-9]/g, ''), 10) || 0;
export const fmtNum = (s: string) => {
  const n = parseInt(String(s).replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? '' : n.toLocaleString('ja-JP');
};

/* ------------------------------------------------------------------ */
/* 候補（科目・業者・摘要・区分）                                        */
/* ------------------------------------------------------------------ */
export type ComboKind = 'account' | 'vendor' | 'summary' | 'service';
export interface Candidate { value: string; code: string; kana: string; group?: string }

/** サンプルの科目マスターにない科目（既存の仕訳・内部取引・連動確認の確認用） */
const EXTRA_ACCOUNTS: Candidate[] = [
  { value: '手数料', code: '5290', kana: 'テスウリョウ', group: '事業費' },
  { value: '減価償却費', code: '5310', kana: 'ゲンカショウキャクヒ', group: '事業費' },
  { value: '寄附金収益', code: '4210', kana: 'キフキンシュウエキ', group: '事業収益' },
  { value: '健康保険', code: '5122', kana: 'ケンコウホケン', group: '特殊摘要科目' },
  { value: '厚生年金', code: '5123', kana: 'コウセイネンキン', group: '特殊摘要科目' },
  { value: '住民税', code: '2150', kana: 'ジュウミンゼイ', group: '特殊摘要科目' },
  { value: '拠点区分間繰入金費用', code: '6110', kana: 'キョテンクブンカンクリイレキンヒヨウ', group: '内部取引' },
  { value: '拠点区分間繰入金収益', code: '6120', kana: 'キョテンクブンカンクリイレキンシュウエキ', group: '内部取引' },
  { value: 'サービス区分間繰入金費用', code: '6210', kana: 'サービスクブンカンクリイレキンヒヨウ', group: '内部取引' },
  { value: 'サービス区分間繰入金収益', code: '6220', kana: 'サービスクブンカンクリイレキンシュウエキ', group: '内部取引' },
];
const VENDOR_KANA: Record<string, string> = { 東京電力: 'トウキョウデンリョク', ＮＴＴ東日本: 'エヌティティヒガシニホン', 中央リース: 'チュウオウリース', みどり商店: 'ミドリショウテン', 市役所: 'シヤクショ', 保護者: 'ホゴシャ' };
const SUMMARY_KANA: Record<string, string> = { 健康保険: 'ケンコウホケン', 厚生年金: 'コウセイネンキン', 法定福利費: 'ホウテイフクリヒ', 職員俸給: 'ショクインホウキュウ', '委託費ー８月分': 'イタクヒ', 電話料金: 'デンワリョウキン', 'ガス代ー７月分': 'ガスダイ', '副食費ー保護者より': 'フクショクヒ', コピー代: 'コピーダイ', 夏祭り用品: 'ナツマツリヨウヒン', 振込手数料: 'フリコミテスウリョウ' };
const SERVICE_KANA: Record<string, string> = { '001': 'ホンブ', '002': 'ホイクジギョウ', '003': 'コソダテシエン', '004': 'イチジアズカリ', '005': 'チイキシエン' };

const CANDIDATES: Record<ComboKind, Candidate[]> = {
  account: [
    ...ACCOUNTS.flatMap((g) => g.items.map((name) => { const m = ACCOUNT_META.find((x) => x.name === name); return { value: name, code: m?.code ?? '', kana: m?.kana ?? '', group: g.group }; })),
    ...EXTRA_ACCOUNTS.filter((x) => !ACCOUNTS.some((g) => g.items.includes(x.value))),
  ],
  vendor: VENDORS.filter((v) => v !== '（なし）').map((v, i) => ({ value: v, code: String(101 + i), kana: VENDOR_KANA[v] ?? '' })),
  summary: SUMMARIES.map((v, i) => ({ value: v, code: String(i + 1).padStart(2, '0'), kana: SUMMARY_KANA[v] ?? '' })),
  service: SERVICES.map((v) => ({ value: v, code: v.split(' ')[0] ?? '', kana: SERVICE_KANA[v.split(' ')[0] ?? ''] ?? '' })),
};
export const candidatesOf = (kind: ComboKind) => CANDIDATES[kind];
export const codeOf = (kind: ComboKind, value: string) => CANDIDATES[kind].find((c) => c.value === value)?.code ?? '';
/** 区分は「001 本部」の形で保持しているので、候補の表示名からはコードを外す */
const nameOf = (kind: ComboKind, c: Candidate) => (kind === 'service' ? c.value.replace(/^\d+\s*/, '') : c.value);

/** 半角カナ・全角数字をそろえる */
const norm = (s: string) => s.normalize('NFKC').trim();
/** コード（前方一致）・名称（部分一致）・フリガナ（前方一致。ひらがな／半角カナ可）のいずれかで絞り込む */
export function filterCandidates(list: Candidate[], query: string): Candidate[] {
  const q = norm(query);
  if (!q) return list;
  const kana = toKatakana(q);
  if (/^\d+$/.test(q)) return list.filter((c) => c.code.startsWith(q) || c.value.includes(q));
  return list.filter((c) => c.value.includes(q) || c.value.includes(query.trim()) || (c.kana && c.kana.startsWith(kana)));
}

/* ------------------------------------------------------------------ */
/* オートコンプリート入力欄（依頼書 5.3.5）                              */
/* ------------------------------------------------------------------ */
interface ComboProps {
  id: string;
  kind: ComboKind;
  value: string;
  onChange: (v: string) => void;
  /** Enter で確定したとき（次の項目へ送る） */
  onCommit?: (v: string) => void;
  placeholder?: string;
  /** 候補以外の文字も入力できる（摘要） */
  freeText?: boolean;
  /** 候補を入力欄の上に出す（画面下部の入力行用） */
  dropUp?: boolean;
  disabled?: boolean;
  invalid?: 'error' | 'warn';
  /** 入力欄の直下に出すメッセージ（エラーの内容） */
  message?: string;
  fontSize?: number;
  padY?: number;
  listWidth?: number;
  onFocusField?: () => void;
  title?: string;
}

export function ComboField({ id, kind, value, onChange, onCommit, placeholder, freeText, dropUp, disabled, invalid, message, fontSize = 13.5, padY = 9, listWidth, onFocusField, title }: ComboProps) {
  const all = useMemo(() => candidatesOf(kind), [kind]);
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const [miss, setMiss] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const list = useMemo(() => (open ? filterCandidates(all, dirty ? text : '') : []), [open, all, dirty, text]);
  const shown = editing ? text : value;
  const cur = all.find((c) => c.value === value);

  // 「候補を開く」ショートカット（Alt+J）から呼ばれる
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const h = () => { setOpen(true); setHi((x) => (x < 0 ? 0 : x)); };
    el.addEventListener('combo-open', h);
    return () => el.removeEventListener('combo-open', h);
  }, []);
  // ハイライト行が見えるように候補リスト内だけをスクロール
  useEffect(() => {
    const box = listRef.current;
    if (!open || hi < 0 || !box) return;
    const el = box.querySelector<HTMLElement>(`[data-i="${hi}"]`);
    if (!el) return;
    if (el.offsetTop < box.scrollTop) box.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = el.offsetTop + el.offsetHeight - box.clientHeight;
  }, [open, hi]);

  const match = (t: string): string | null => {
    const q = norm(t);
    if (!q) return '';
    const exact = all.find((c) => c.value === t.trim() || c.value === q || c.code === q);
    if (exact) return exact.value;
    const f = filterCandidates(all, t);
    return f.length === 1 ? f[0].value : null;
  };
  const resolve = (): string | null => {
    if (open && hi >= 0 && list[hi]) return list[hi].value;
    if (!dirty) return value;
    if (freeText) {
      const q = norm(text);
      const byCode = /^\d+$/.test(q) ? all.find((c) => c.code === q || c.code === q.padStart(2, '0')) : undefined;
      return byCode ? byCode.value : text;
    }
    return match(text);
  };
  const settle = (v: string) => {
    onChange(v);
    setText(v);
    setDirty(false);
    setOpen(false);
    setHi(-1);
    setMiss(false);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (isIme(e)) return;
    if (e.altKey) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); setHi(Math.max(0, dirty ? 0 : all.findIndex((c) => c.value === value))); return; }
      setHi((x) => Math.min(x + 1, list.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      if (!open) return;
      e.preventDefault();
      setHi((x) => Math.max(x - 1, freeText ? -1 : 0));
      return;
    }
    if (e.key === 'Escape') {
      if (!open) return;
      // 候補だけを閉じる（モーダルは閉じない）
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopPropagation();
      setOpen(false);
      setHi(-1);
      setMiss(false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = resolve();
      if (v == null) { setMiss(true); setOpen(true); return; }
      settle(v);
      onCommit?.(v);
    }
  };

  const border = invalid === 'error' ? '#c0392b' : invalid === 'warn' ? '#d9a400' : '#cfd8e0';
  return (
    <div className="ef-combo" data-tip={disabled && title ? title : undefined} style={{ flex: '1 1 auto', minWidth: 0, width: '100%' }}>
    <div className="ef-box" data-combo title={disabled ? undefined : title} style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box', border: '1px solid ' + border, borderRadius: 8, background: disabled ? '#f5f7f9' : invalid === 'error' ? '#fdeee9' : '#fff', minWidth: 0 }}>
      {cur?.code && !editing && <span style={{ flex: 'none', marginLeft: 8, padding: '1px 6px', borderRadius: 5, background: '#eef2f6', color: '#5b6773', fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{cur.code}</span>}
      <input
        id={id}
        ref={inputRef}
        className="ef-bare"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-invalid={invalid === 'error' || undefined}
        autoComplete="off"
        disabled={disabled}
        value={kind === 'service' && !editing ? value.replace(/^\d+\s*/, '') : shown}
        placeholder={placeholder}
        onFocus={(e) => { setEditing(true); setText(value); setDirty(false); e.currentTarget.select(); onFocusField?.(); }}
        onBlur={() => {
          if (dirty && !freeText) {
            const v = match(text);
            if (v != null && v !== value) onChange(v);
          }
          setEditing(false); setOpen(false); setDirty(false); setHi(-1); setMiss(false);
        }}
        onChange={(e) => {
          const t = e.target.value;
          setText(t); setDirty(true); setOpen(true); setMiss(false);
          setHi(freeText ? -1 : 0);
          if (freeText) onChange(t);
        }}
        onClick={() => !disabled && setOpen(true)}
        onKeyDown={onKeyDown}
        style={{ flex: 1, minWidth: 0, width: '100%', border: 'none', padding: `${padY}px 8px ${padY}px 9px`, fontSize, fontFamily: 'inherit', color: '#22303c' }}
      />
      <button type="button" tabIndex={-1} aria-label="候補を開く" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); if (disabled) return; inputRef.current?.focus(); setOpen((o) => !o); }} style={{ flex: 'none', width: 24, alignSelf: 'stretch', border: 'none', background: 'transparent', color: '#9aa5b1', fontSize: 9, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit' }}>▼</button>
      {open && !disabled && (
        <div onMouseDown={(e) => e.preventDefault()} style={{ position: 'absolute', [dropUp ? 'bottom' : 'top']: 'calc(100% + 6px)', left: 0, minWidth: '100%', width: listWidth, zIndex: 80, background: '#fff', border: '1px solid #d3dce4', borderRadius: 10, boxShadow: '0 14px 36px rgba(24,42,62,.2)', overflow: 'hidden', textAlign: 'left' }}>
          <div ref={listRef} role="listbox" style={{ position: 'relative', maxHeight: 236, overflowY: 'auto', padding: '4px 0' }}>
            {list.map((c, i) => {
              const on = i === hi;
              return (
                <div key={c.value} data-i={i} role="option" aria-selected={on} className="ef-cand" onMouseEnter={() => setHi(i)} onClick={() => { settle(c.value); onCommit?.(c.value); }} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '7px 12px', background: on ? 'var(--ef-accent, #1f7a52)' : 'transparent', color: on ? '#fff' : '#283641', fontSize: 13.5, lineHeight: 1.3, whiteSpace: 'nowrap' }}>
                  <span style={{ flex: 'none', minWidth: 38, fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', opacity: on ? 0.95 : 0.6 }}>{c.code}</span>
                  <span style={{ fontWeight: c.value === value ? 700 : 500 }}>{nameOf(kind, c)}</span>
                  {c.kana && <span style={{ fontSize: 10.5, opacity: on ? 0.85 : 0.5 }}>{c.kana}</span>}
                  {c.group && <span style={{ marginLeft: 'auto', paddingLeft: 12, fontSize: 10.5, opacity: on ? 0.85 : 0.5 }}>{c.group}</span>}
                </div>
              );
            })}
            {list.length === 0 && <div style={{ padding: '12px 14px', fontSize: 12.5, color: miss ? '#c0392b' : '#9aa5b1' }}>{freeText ? '候補はありません（入力した文字のまま登録できます）' : '該当する候補がありません。コード・名称・フリガナを確認してください'}</div>}
          </div>
          <div style={{ padding: '5px 12px', borderTop: '1px solid #eef2f5', background: '#fafcfd', fontSize: 10.5, color: '#8290a0', whiteSpace: 'nowrap' }}>
            コード・名称・フリガナで絞り込み　↑↓ 選択　Enter 決定　Esc 閉じる
          </div>
        </div>
      )}
    </div>
    {message && <div className="ef-msg" role="alert" data-field-msg style={{ marginTop: 4, fontSize: 11.5, fontWeight: 700, color: '#a5281b', lineHeight: 1.45 }}>{message}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 登録できない仕訳／確認して続行できる警告（依頼書 5.3.2）              */
/* ------------------------------------------------------------------ */
export type FundMode = '自動資金' | '強制資金';
export const FUND_MODES: FundMode[] = ['自動資金', '強制資金'];
export const FUND_MODE_NOTE: Record<FundMode, string> = {
  自動資金: '科目から資金科目を自動で決めます（通常）',
  強制資金: '資金取引として扱い、資金収支計算書に反映します',
};
export const isInternalAccount = (name: string) => /区分間/.test(name);

/** 決算附属明細書への連動（伝票入力時の監視） */
export const WATCHED: { key: string; label: string; test: RegExp }[] = [
  { key: 'kifu', label: '寄附金収益明細書', test: /寄附/ },
  { key: 'hojo', label: '補助金事業等収益明細書', test: /補助金/ },
  { key: 'kihon', label: '基本金明細書', test: /基本金/ },
  { key: 'kurii', label: '事業区分間及び拠点区分間繰入金明細書', test: /繰入/ },
];
export function watchedStatement(kari: string, kashi: string) { return WATCHED.find((w) => w.test.test(kari) || w.test.test(kashi)) ?? null; }
/** 減価償却へ連動する科目（固定資産） */
export const isDepreciationAccount = (name: string) => /器具及び備品|建物|構築物|車輌|車両|機械及び装置/.test(name);

export type IssueLevel = 'error' | 'warn';
export type IssueField = 'kari' | 'kashi' | 'aite' | 'pair';
export interface Issue { level: IssueLevel; code: string; title: string; detail: string; field: IssueField }

export interface JudgeInput {
  kari: string;
  kashi: string;
  amount?: number;
  fundMode: FundMode;
  /** 「内部取引」ボタンで内部取引として指定した */
  internal?: boolean;
  /** 内部取引相手区分 */
  aite?: string;
  /** 入力中の区分 */
  division?: string;
}
export const needsPartner = (x: Pick<JudgeInput, 'kari' | 'kashi' | 'internal'>) => !!x.internal || isInternalAccount(x.kari) || isInternalAccount(x.kashi);

/** 借方・貸方の組み合わせを判定し、エラー（登録不可）と警告（確認して登録可）を返す */
export function judgeEntry(x: JudgeInput, env: EnvSettings): Issue[] {
  const out: Issue[] = [];
  const { kari, kashi } = x;
  if (!kari || !kashi) return out;
  if (kari === kashi) out.push({ level: 'error', code: 'same', title: '借方と貸方が同じ科目です', detail: '同じ科目どうしの仕訳は登録できません。どちらかの科目を変更してください。', field: 'kashi' });

  // 内部取引
  const ik = isInternalAccount(kari), is = isInternalAccount(kashi);
  if (needsPartner(x)) {
    if (ik !== is && (ik || is) && !env.oneSideInternal) {
      out.push({ level: 'error', code: 'oneside', title: `${ik ? '借方' : '貸方'}だけが内部取引科目です`, detail: `${ik ? '貸方' : '借方'}にも内部取引科目を指定してください（片側のみの内部取引は、動作環境で許可した場合だけ登録できます）。`, field: ik ? 'kashi' : 'kari' });
    }
    if (!x.aite) out.push({ level: 'error', code: 'aite', title: '内部取引相手区分が未入力です', detail: '内部取引科目を使う仕訳は、相手先の区分を指定してください。', field: 'aite' });
    else if (x.division && x.aite === x.division) out.push({ level: 'error', code: 'aite-same', title: '内部取引相手区分が入力中の区分と同じです', detail: '相手区分には、取引の相手先となる別の区分を指定してください。', field: 'aite' });
  }

  // 資金モードと科目の整合
  const ca = metaOf(kari)?.cls, cb = metaOf(kashi)?.cls;
  if (x.fundMode === '強制資金' && ca === '現預金' && cb === '現預金') {
    out.push({ level: 'error', code: 'force', title: '強制資金モードでは登録できない組み合わせです', detail: '現金・預金どうしの振替は資金の増減がないため、強制資金にはできません。', field: 'pair' });
  }

  // 貸借の組み合わせ
  if (!needsPartner(x) && x.fundMode !== '強制資金') {
    const j = judgeTorihiki(kari, kashi, false);
    if (j.kind === '要確認' && j.reason === '誤伝票') {
      out.push({ level: 'error', code: 'pair', title: 'この借方・貸方の組み合わせは登録できません', detail: ca === '収益' ? '収益の科目が借方、現金・預金が貸方になっています。借方と貸方が逆になっていないか確認してください。' : '現金・預金が借方、費用の科目が貸方になっています。借方と貸方が逆になっていないか確認してください。', field: 'pair' });
    }
    if (j.kind === '要確認' && j.reason === '費用間' && env.confirmExpense) out.push({ level: 'warn', code: 'expense', title: '費用科目から費用科目への振替です', detail: '科目の付け替えなど、意図した仕訳であれば確認のうえ登録できます。', field: 'pair' });
    if (j.kind === '要確認' && j.reason === '収益間' && env.confirmIncome) out.push({ level: 'warn', code: 'income', title: '収益科目から収益科目への振替です', detail: '科目の付け替えなど、意図した仕訳であれば確認のうえ登録できます。', field: 'pair' });
  }

  // 予算超過
  if (env.budgetCheck) {
    ([['kari', kari], ['kashi', kashi]] as const).forEach(([field, name]) => {
      const b = budgetSample(name);
      if (!b) return;
      const rate = ((b.actual + (x.amount ?? 0)) / b.budget) * 100;
      if (rate >= env.budgetThreshold) out.push({ level: 'warn', code: 'budget-' + field, title: `予算の警告：${name}`, detail: `この伝票を登録すると達成率が ${rate.toFixed(1)}% になります（しきい値 ${env.budgetThreshold}%）。`, field });
    });
  }

  // 連動（減価償却・決算附属明細書）
  if (isDepreciationAccount(kari) || isDepreciationAccount(kashi)) out.push({ level: 'warn', code: 'dep', title: '減価償却への連動があります', detail: '登録すると、続けて固定資産の登録画面が開きます。', field: isDepreciationAccount(kari) ? 'kari' : 'kashi' });
  const w = watchedStatement(kari, kashi);
  if (w) out.push({ level: 'warn', code: 'stmt', title: `${w.label}への連動があります`, detail: '登録すると、続けて明細書への登録画面が開きます。', field: w.test.test(kari) ? 'kari' : 'kashi' });
  return out;
}
export const hasError = (list: Issue[]) => list.some((i) => i.level === 'error');
export const hasWarn = (list: Issue[]) => list.some((i) => i.level === 'warn');
/** 入力欄の直下に出すエラー文（最初のエラーの見出し） */
export const fieldMessage = (list: Issue[], ...fields: IssueField[]): string | undefined => list.find((i) => i.level === 'error' && fields.includes(i.field))?.title;
/** 入力欄の枠色（ComboField の invalid） */
export const fieldState = (list: Issue[], ...fields: IssueField[]): 'error' | 'warn' | undefined =>
  list.some((i) => i.level === 'error' && fields.includes(i.field)) ? 'error' : list.some((i) => i.level === 'warn' && fields.includes(i.field)) ? 'warn' : undefined;

const TONE = {
  error: { bg: '#fdeee9', bd: '#f0b9ae', fg: '#a5281b', icon: '×', tag: 'エラー（登録できません）' },
  warn: { bg: '#fff6dd', bd: '#ecd08a', fg: '#7a5600', icon: '!', tag: '確認（確認して登録できます）' },
};
/** 入力中の行・科目の近くに出すメッセージ。エラー＝赤、確認して続行できる警告＝黄 */
export function IssueList({ issues, onConfirm, confirmDisabled, compact, confirmId }: { issues: Issue[]; onConfirm?: () => void; confirmDisabled?: string; compact?: boolean; confirmId?: string }) {
  if (issues.length === 0) return null;
  const errors = issues.filter((i) => i.level === 'error');
  const warns = issues.filter((i) => i.level === 'warn');
  const block = (level: IssueLevel, list: Issue[]) => {
    if (list.length === 0) return null;
    const t = TONE[level];
    return (
      <div role={level === 'error' ? 'alert' : 'status'} style={{ border: '1px solid ' + t.bd, borderLeft: '5px solid ' + t.fg, background: t.bg, borderRadius: 9, padding: compact ? '7px 10px' : '9px 12px', color: t.fg, fontSize: 12.5, lineHeight: 1.6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span aria-hidden style={{ flex: 'none', width: 18, height: 18, borderRadius: '50%', background: t.fg, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>{t.icon}</span>
          <span style={{ fontWeight: 800, fontSize: 11.5, letterSpacing: '.03em' }}>{t.tag}</span>
          {level === 'warn' && errors.length === 0 && onConfirm && (
            <button id={confirmId} type="button" className="ef-act" disabled={!!confirmDisabled} title={confirmDisabled || '内容を確認したうえで、このまま登録します'} onClick={onConfirm} style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 7, border: '1px solid #b07d00', background: '#d99a00', color: '#fff', fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>確認して登録</button>
          )}
        </div>
        <ul style={{ margin: '4px 0 0', paddingLeft: 26 }}>
          {list.map((i) => (
            <li key={i.code}><b>{i.title}</b>{!compact && <span style={{ fontWeight: 400 }}>　{i.detail}</span>}</li>
          ))}
        </ul>
      </div>
    );
  };
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {block('error', errors)}
      {block('warn', warns)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 機能ボタンとショートカット（依頼書 5.3.3／5.3.6／6.2）                */
/* ------------------------------------------------------------------ */
export function Kbd({ k }: { k: string }) {
  return <span className="ef-kbd" aria-hidden>{k}</span>;
}
interface ActProps {
  label: ReactNode;
  /** Alt と組み合わせる英数字（例 'S'） */
  k?: string;
  onClick: () => void;
  tone?: 'primary' | 'danger' | 'normal';
  accent?: string;
  disabled?: boolean;
  /** 無効の理由・補足（ツールチップ） */
  title?: string;
  active?: boolean;
  id?: string;
  menu?: string;
}
export function ActButton({ label, k, onClick, tone = 'normal', accent = '#1f7a52', disabled, title, active, id, menu }: ActProps) {
  const c = tone === 'danger' ? '#c0392b' : tone === 'primary' ? accent : '#48565f';
  const solid = tone === 'primary';
  const tip = [title, k ? `ショートカット：Alt+${k}` : ''].filter(Boolean).join('　');
  return (
    <span data-tip={disabled && title ? title : undefined} style={{ display: 'inline-flex' }}>
    <button id={id} type="button" className="ef-act" data-menu={menu ?? (typeof label === 'string' ? label : undefined)} disabled={disabled} aria-pressed={active} title={disabled ? undefined : tip} onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', padding: solid ? '8px 16px' : '6px 10px', borderRadius: 8, border: '1px solid ' + (solid ? c : tone === 'danger' ? '#e6b3ab' : active ? accent : '#cfd8e0'), background: solid ? c : active ? accent + '18' : '#fff', color: solid ? '#fff' : active ? accent : c, fontSize: solid ? 13.5 : 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: solid ? '0 3px 10px rgba(30,50,70,.18)' : 'none' }}>
      {label}
    </button>
    </span>
  );
}
export function ActionGroup({ caption, note, children, danger }: { caption: string; note?: ReactNode; children: ReactNode; danger?: boolean }) {
  return (
    <div role="group" aria-label={caption} style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 10px 9px', border: '1px solid ' + (danger ? '#f0cfc9' : '#e2e8ee'), borderRadius: 10, background: danger ? '#fffafa' : '#fbfcfd', minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: '#8290a0', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{caption}{note && <span style={{ fontWeight: 600, marginLeft: 8, color: '#5b6773', letterSpacing: 0 }}>{note}</span>}</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>
    </div>
  );
}
/** 隣のボタンと視覚的に分ける区切り（依頼書 6.4：伝票削除など） */
export function ActDivider() {
  return <span aria-hidden style={{ width: 1, alignSelf: 'stretch', background: '#e0c4bf', margin: '0 6px' }} />;
}

export interface Shortcut {
  /** Alt と同時に押すキー（英字は大文字、数字は '1'〜'9'） */
  key: string;
  label: string;
  group: string;
  run: () => void;
  disabled?: boolean;
}
/** Alt＋英数字のショートカット。フォーカス位置に関係なく同じキーで同じ機能が動く。
 *  scope='page' はモーダル表示中は無効、scope='modal' は enabled のときだけ有効。IME 変換中は無視。 */
export function useShortcuts(list: Shortcut[], scope: 'page' | 'modal' = 'page', enabled = true) {
  const ref = useRef(list);
  ref.current = list;
  useEffect(() => {
    if (!enabled) return;
    const h = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.isComposing || e.keyCode === 229) return;
      if (scope === 'page' && document.querySelector('[data-modal-root]')) return;
      const k = e.code.startsWith('Key') ? e.code.slice(3) : e.code.startsWith('Digit') ? e.code.slice(5) : '';
      if (!k) return;
      const hit = ref.current.find((s) => s.key === k);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      if (hit.disabled) return;
      hit.run();
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [scope, enabled]);
}
/** フォーカス中の入力欄（科目・摘要・業者）の候補一覧を開く */
export function openCandidatesOfFocused(): boolean {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement && el.getAttribute('role') === 'combobox') {
    el.dispatchEvent(new Event('combo-open'));
    return true;
  }
  return false;
}

/** キーボード操作一覧（ヘルプ） */
export function ShortcutHelpModal({ open, onClose, shortcuts, formatName, enterOrder }: { open: boolean; onClose: () => void; shortcuts: Shortcut[]; formatName: string; enterOrder: string }) {
  const groups = Array.from(new Set(shortcuts.map((s) => s.group)));
  const row: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '4px 0', borderBottom: '1px dashed #eef2f5', fontSize: 12.5 };
  const key: CSSProperties = { flex: 'none', padding: '1px 7px', border: '1px solid #b9c4cf', borderBottomWidth: 2, borderRadius: 5, background: '#f6f8fa', fontSize: 11, fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', color: '#3d4a56', whiteSpace: 'nowrap' };
  return (
    <Modal open={open} onClose={onClose} width={780} title={<>キーボード操作一覧 <span style={{ fontSize: 12, color: '#7a8794', fontWeight: 500, marginLeft: 8 }}>{formatName}</span></>}>
      <div style={{ padding: '12px 22px 18px', display: 'grid', gap: 14 }}>
        <div style={{ padding: '10px 12px', background: '#f3f6f9', border: '1px solid #dde4ea', borderRadius: 10, fontSize: 12.5, lineHeight: 1.8, color: '#48565f' }}>
          マウスを使わずに伝票登録まで操作できます。ショートカットは<b>どの入力欄にいても同じキーで同じ機能</b>が動きます（カーソル位置で機能は変わりません）。
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px 22px' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#8290a0', marginBottom: 4 }}>入力欄の移動・候補の選択</div>
            <div style={row}><span>次の項目へ</span><span style={key}>Enter</span></div>
            <div style={row}><span>前の項目へ</span><span style={key}>Shift+Tab</span></div>
            <div style={row}><span>候補を絞り込む</span><span style={{ fontSize: 11.5, color: '#7a8794' }}>コード・名称・フリガナを入力</span></div>
            <div style={row}><span>候補を選ぶ</span><span style={key}>↑ ↓</span></div>
            <div style={row}><span>候補を決定して次へ</span><span style={key}>Enter</span></div>
            <div style={row}><span>候補を閉じる</span><span style={key}>Esc</span></div>
            <div style={{ fontSize: 11.5, color: '#7a8794', marginTop: 6, lineHeight: 1.7 }}>Enter の順序：{enterOrder}</div>
          </div>
          {groups.map((g) => (
            <div key={g}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#8290a0', marginBottom: 4 }}>{g}</div>
              {shortcuts.filter((s) => s.group === g).map((s) => (
                <div key={s.key + s.label} style={{ ...row, opacity: s.disabled ? 0.45 : 1 }}><span>{s.label}</span><span style={key}>Alt+{s.key}</span></div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" className="ef-act" autoFocus onClick={onClose} style={btn()}>閉じる</button></div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 形式の切替（依頼書 5.3.1／6.5）                                       */
/* ------------------------------------------------------------------ */
export function FormatSwitcher({ current, onSwitch, accent, right }: { current: EntryFormat; /** 未指定のときは切替を出さず、現在の形式だけ表示 */ onSwitch?: (k: EntryFormat) => void; accent: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 22px', borderBottom: '1px solid #e2e8ee', background: '#f6f8fa' }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: '#8290a0', letterSpacing: '.05em', flex: 'none' }}>伝票の形式</span>
      {onSwitch ? (
        <div role="tablist" aria-label="伝票の形式" style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 3, padding: 3, border: '1px solid #cfd8e0', borderRadius: 11, background: '#e9eef2' }}>
          {ENTRY_FORMATS.map((k) => {
            const on = k === current;
            return (
              <button key={k} type="button" role="tab" aria-selected={on} className="ef-act" data-menu={'形式:' + k} title={FORMAT_NOTE[k]} onClick={() => { if (!on) onSwitch(k); }} style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 13px', borderRadius: 8, border: 'none', background: on ? accent : 'transparent', color: on ? '#fff' : '#48565f', fontSize: 13, fontWeight: on ? 800 : 600, fontFamily: 'inherit', cursor: on ? 'default' : 'pointer', whiteSpace: 'nowrap', boxShadow: on ? '0 2px 8px rgba(30,50,70,.2)' : 'none' }}>
                {on && <span aria-hidden style={{ marginRight: 5, fontSize: 11 }}>●</span>}
                {displayName(k)}
              </button>
            );
          })}
        </div>
      ) : (
        <span style={{ padding: '6px 14px', borderRadius: 8, background: accent, color: '#fff', fontSize: 13, fontWeight: 800 }}>{displayName(current)}</span>
      )}
      <span className="ef-hide-narrow" style={{ fontSize: 11.5, color: '#7a8794' }}>{FORMAT_NOTE[current]}</span>
      {right && <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>{right}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 権限（依頼書 2.1-7／付録A）                                          */
/* ------------------------------------------------------------------ */
export function ReadOnlyBanner({ reason }: { reason: string }) {
  if (!reason) return null;
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 22px', background: '#eef2f6', borderBottom: '1px solid #d5dde5', color: '#3d4a56', fontSize: 12.5 }}>
      <span style={{ flex: 'none', padding: '2px 9px', borderRadius: 8, background: '#5b6773', color: '#fff', fontSize: 11, fontWeight: 800 }}>参照のみ</span>
      <span><b>{reason}</b>　伝票の登録・訂正・削除と行の操作はできません（操作ボタンは表示されません）。参照（残高・問合せ・印刷）は利用できます。</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 小さな確認ダイアログ（伝票中止・形式切替）                            */
/* ------------------------------------------------------------------ */
export function ConfirmModal({ open, title, children, okLabel, cancelLabel = '入力に戻る', danger, onOk, onClose, accent }: { open: boolean; title: string; children: ReactNode; okLabel: string; cancelLabel?: string; danger?: boolean; onOk: () => void; onClose: () => void; accent: string }) {
  return (
    <Modal open={open} onClose={onClose} width={480} title={title} strict>
      <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="ef-act" autoFocus onClick={onClose} style={btn()}>{cancelLabel}</button>
          <button type="button" className="ef-act" onClick={onOk} style={btn(danger ? '#c0392b' : accent, true)}>{okLabel}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 資金科目の自動表示（科目欄のすぐ下）                                  */
/* ------------------------------------------------------------------ */
export function fundLabelOf(name: string, other: string, mode: FundMode): { text: string; tone: 'on' | 'off' } {
  if (!name) return { text: '科目を選ぶと表示します', tone: 'off' };
  const m = metaOf(name), o = metaOf(other);
  if (!m) return { text: mode === '強制資金' ? '（強制資金）' : '—', tone: mode === '強制資金' ? 'on' : 'off' };
  if (m.cls === '現預金') return { text: '支払資金（現金・預金）', tone: 'on' };
  if (m.cls === '費用' || m.cls === '収益') {
    if (mode === '強制資金' || !other || o?.cls === '現預金') return { text: m.fund, tone: 'on' };
    return { text: `${m.fund}（相手が資金科目のとき）`, tone: 'off' };
  }
  return { text: mode === '強制資金' ? '（強制資金）' : '—（資金の増減なし）', tone: mode === '強制資金' ? 'on' : 'off' };
}
export function FundAccountLine({ name, other, mode }: { name: string; other: string; mode: FundMode }) {
  const f = fundLabelOf(name, other, mode);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, fontSize: 11.5, minHeight: 20, minWidth: 0 }}>
      <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, color: '#8290a0' }}>資金科目</span>
      <span style={{ color: f.tone === 'on' ? '#0e6b7a' : '#8290a0', fontWeight: f.tone === 'on' ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.text}</span>
      {mode !== '自動資金' && <span style={{ flex: 'none', padding: '1px 6px', borderRadius: 6, background: '#efe6fb', color: '#6b3fb5', fontSize: 10, fontWeight: 800 }}>{mode}</span>}
    </div>
  );
}

/** チェック・付箋・証憑の表示（一覧画面の FlagCell と同じ見た目。入力中の行用にローカル状態を切り替える） */
export type FusenColor = '' | '赤' | '青' | '黄' | '緑';
const FUSEN_HEX: Record<Exclude<FusenColor, ''>, string> = { 赤: '#c0392b', 青: '#2c5f9e', 黄: '#d9a400', 緑: '#1f7a52' };
export const nextFusen = (f: FusenColor): FusenColor => (['', '赤', '青', '黄', '緑'] as FusenColor[])[((['', '赤', '青', '黄', '緑'] as FusenColor[]).indexOf(f) + 1) % 5];
export function FlagButtons({ shohyo, check, fusen, onChange, disabled, showShohyo = true }: { shohyo: boolean; check: boolean; fusen: FusenColor; onChange: (p: Partial<{ shohyo: boolean; check: boolean; fusen: FusenColor }>) => void; disabled?: boolean; showShohyo?: boolean }) {
  const dot: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, border: '1px solid #dde4ea', background: '#fff', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 10.5, fontWeight: 800, fontFamily: 'inherit', padding: 0 };
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {showShohyo && <button type="button" tabIndex={-1} disabled={disabled} title="証憑 有／無" onClick={() => onChange({ shohyo: !shohyo })} style={{ ...dot, background: shohyo ? '#eaf5ef' : '#fff', color: shohyo ? '#1f7a52' : '#b3bcc5' }}>{shohyo ? '有' : '無'}</button>}
      <button type="button" tabIndex={-1} disabled={disabled} title="チェック" onClick={() => onChange({ check: !check })} style={{ ...dot, background: check ? '#22303c' : '#fff', color: check ? '#fff' : '#b3bcc5' }}>✓</button>
      <button type="button" tabIndex={-1} disabled={disabled} title={`付箋：${fusen || 'なし'}（赤→青→黄→緑→なし）`} onClick={() => onChange({ fusen: nextFusen(fusen) })} style={{ ...dot, background: fusen ? FUSEN_HEX[fusen] : '#fff', color: fusen ? '#fff' : '#b3bcc5' }}>■</button>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 内部取引相手区分の保持（プロトタイプ用。共有ストアに項目がないため、仕訳 id ごとに覚えておく） */
/* ------------------------------------------------------------------ */
const PARTNERS = new Map<number, string>();
export const setPartner = (id: number, aite: string) => { if (aite) PARTNERS.set(id, aite); else PARTNERS.delete(id); };
export const partnerOf = (id: number) => PARTNERS.get(id) ?? '';

/* ------------------------------------------------------------------ */
/* 紙の伝票風の見た目（4形式共通）                                       */
/*   既存システムの伝票用紙（白地・緑の罫線・薄緑のラベル欄）に寄せるための「皮」。 */
/*   入力欄・ボタン・フォーカスの強調・エラー表示などの動きは変えない。     */
/* ------------------------------------------------------------------ */
export const PAPER = {
  /** 外枠 */
  frame: '#3b4a43',
  /** 太い罫線 */
  line: '#6f9a7e',
  /** 細い罫線 */
  lineSoft: '#9dbfa8',
  /** ラベル欄の塗り */
  fill: '#e9f3ec',
  /** 資金行などの薄い帯 */
  band: '#f3f8f4',
  /** ラベル・見出しの文字色 */
  ink: '#2a5d44',
  /** 用紙の表題 */
  title: '#1f4d38',
} as const;

const PAPER_CSS = `
.pp-sheet { position: relative; background: #fff; border: 1.5px solid ${PAPER.frame}; box-shadow: 0 1px 0 #cfd8d2, 0 10px 26px rgba(30,50,70,.12); }
.pp-title { font-family: 'Zen Kaku Gothic New', 'Noto Sans JP', sans-serif; font-weight: 700; font-size: 21px; letter-spacing: 0; color: #22303c; line-height: 1.3; white-space: nowrap; }
.pp-division { font-family: 'Zen Kaku Gothic New', 'Noto Sans JP', sans-serif; font-weight: 600; font-size: 14px; letter-spacing: 0; color: ${PAPER.ink}; white-space: nowrap; }
/* 罫線は「隙間を線色で塗る」方式。表＝pp-table（行の並び）、行＝pp-row（セルの並び） */
.pp-table { display: grid; gap: 1px; background: ${PAPER.lineSoft}; border: 1px solid ${PAPER.line}; min-width: 0; }
.pp-row { display: grid; gap: 1px; background: ${PAPER.lineSoft}; min-width: 0; }
.pp-cell { background: #fff; min-width: 0; padding: 6px 8px; display: flex; align-items: center; gap: 6px; box-sizing: border-box; }
.pp-cell.pp-col { flex-direction: column; align-items: stretch; justify-content: center; gap: 0; }
.pp-cell.pp-right { justify-content: flex-end; }
.pp-cell.pp-center { justify-content: center; }
.pp-lab { background: ${PAPER.fill}; color: ${PAPER.ink}; font-size: 10.5px; font-weight: 700; letter-spacing: .06em; padding: 3px 8px; display: flex; align-items: center; justify-content: center; text-align: center; white-space: nowrap; line-height: 1.3; min-width: 0; box-sizing: border-box; }
.pp-lab.pp-left { justify-content: flex-start; }
.pp-lab small { font-size: 9.5px; font-weight: 600; letter-spacing: .04em; opacity: .75; }
.pp-lab .pp-sub { display: block; font-size: 9.5px; font-weight: 600; letter-spacing: .02em; opacity: .75; }
.pp-band { background: ${PAPER.band}; }
.pp-cell.pp-empty { min-height: 40px; }
.pp-num { font-variant-numeric: tabular-nums; }
/* 入力中の行：セルを薄い黄色に、先頭セルに緑の帯（EntryStyles の .ef-row と同じ合図） */
.pp-row:focus-within > .pp-cell { background: #fffdf0; }
.pp-row:focus-within > .pp-cell:first-child { box-shadow: inset 4px 0 0 var(--ef-accent, #1f7a52); }
.pp-row:focus-within .ef-rownow { display: inline-block; }
.pp-row:focus-within .ef-rowno { display: none; }
/* 用紙の中の素の入力欄（枠は罫線に任せ、フォーカス時だけ EntryStyles の太枠が付く） */
/* 入力欄は用紙の罫線とは別に、必ず枠付きの白い箱にする（入力する欄と、自動表示の欄を見分けられるように） */
.pp-input { border: 1px solid #b7c6bd; border-radius: 5px; background: #fff; font-family: inherit; color: #22303c; box-sizing: border-box; min-width: 0; min-height: 32px; padding: 4px 8px; box-shadow: inset 0 1px 0 rgba(0,0,0,.02); }
.pp-input:hover:not(:disabled) { border-color: #7fa38e; }
.pp-input:disabled { color: #7a8794; background: #f1f4f6; border-style: dashed; }
/* 自動表示・読み取り専用の欄：白い枠の中にグレーの箱を置くと入力欄に見えるため、枠（セル）そのものをグレーにする */
.pp-ro { display: inline-flex; align-items: center; min-height: 32px; padding: 4px 2px; color: #5b6773; font-size: 13px; }
.pp-ro small { font-size: 10px; color: #9aa5b1; margin-left: 6px; }
.pp-ro.pp-ro-s { min-height: 24px; padding: 2px 2px; font-size: 12px; }
.pp-ro.pp-ro-fill { display: flex; width: 100%; box-sizing: border-box; min-width: 0; }
.pp-cell.pp-auto, .pp-val.pp-auto, .pp-cell:has(> .pp-ro), .pp-val:has(> .pp-ro),
.pp-row:focus-within > .pp-cell.pp-auto, .pp-row:focus-within > .pp-cell:has(> .pp-ro) { background: #eceff2; }
.pp-input::placeholder { color: #b3bcc5; }
/* 下段の Seq No／チェック／証憑／小切手No の並び */
.pp-foot { display: flex; align-items: stretch; min-width: 0; min-height: 40px; }
.pp-foot > .pp-lab { border-right: 1px solid ${PAPER.lineSoft}; flex: none; padding: 3px 9px; }
.pp-foot > .pp-val { display: flex; align-items: center; gap: 6px; padding: 3px 10px; border-right: 1px solid ${PAPER.lineSoft}; min-width: 0; font-size: 12.5px; color: #22303c; }
.pp-foot > .pp-val:last-child { border-right: none; }
.pp-foot > .pp-val.pp-grow { flex: 1 1 auto; }
.pp-toggle { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 26px; padding: 0 8px; border: 1px solid ${PAPER.lineSoft}; border-radius: 4px; background: #fff; font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; color: #22303c; }
.pp-toggle:disabled { cursor: not-allowed; opacity: .55; }
.pp-toggle.pp-on { background: ${PAPER.fill}; color: ${PAPER.ink}; border-color: ${PAPER.line}; }
.pp-toggle:focus-visible { outline: 3px solid var(--ef-accent, #1f7a52); outline-offset: 1px; }
`;
/** 紙の伝票風スタイル（EntryStyles と一緒に置く） */
export function PaperStyles() {
  return <style>{PAPER_CSS}</style>;
}

/** 用紙の表題（「仕 訳 伝 票」など）。右端に定型仕訳ボタンなどを置ける */
export function PaperTitle({ title, division, badge, right, children }: { title: string; division: string; badge?: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', minWidth: 0 }}>
        <span className="pp-title">{title}</span>
        <span className="pp-division">{division}</span>
        {badge}
      </div>
      {children}
      {right && <div style={{ marginLeft: 'auto', flex: 'none' }}>{right}</div>}
    </div>
  );
}

/** 「令和 ［8］年 ［月］月 ［日］日」の枠付きセル。month／day には既存の入力欄をそのまま渡す */
export function PaperDate({ month, day, year = '8', label = '年月日' }: { month: ReactNode; day: ReactNode; year?: string; label?: string }) {
  const cell: CSSProperties = { padding: '2px 4px', justifyContent: 'center' };
  return (
    <div className="pp-row" style={{ gridTemplateColumns: 'auto auto auto auto auto auto auto auto', border: `1px solid ${PAPER.line}`, display: 'inline-grid', verticalAlign: 'middle' }}>
      <div className="pp-lab"><span>{label}</span></div>
      <div className="pp-cell pp-auto" style={{ ...cell, padding: '2px 10px', fontSize: 14, color: '#5b6773' }}>令和</div>
      <div className="pp-cell" style={{ ...cell, padding: '2px 10px' }}><span className="pp-ro pp-num" title="会計年度は、画面上部の「会計期間」で切り替えます" style={{ fontSize: 14, fontWeight: 700, color: '#22303c' }}>{year}</span></div>
      <div className="pp-lab">年</div>
      <div className="pp-cell" style={cell}>{month}</div>
      <div className="pp-lab">月</div>
      <div className="pp-cell" style={cell}>{day}</div>
      <div className="pp-lab">日</div>
    </div>
  );
}

/** 用紙の中のラベル付き小さな枠（拠点区分・伝票No など） */
export function PaperBox({ label, children, width, grow, muted }: { label: ReactNode; children: ReactNode; width?: number | string; grow?: boolean; /** 入力できない状態（グレーで表示） */ muted?: boolean }) {
  return (
    <div className="pp-row" style={{ gridTemplateColumns: 'auto minmax(0,1fr)', border: `1px solid ${PAPER.line}`, display: 'inline-grid', width, flex: grow ? '1 1 auto' : 'none', minWidth: 0 }}>
      <div className="pp-lab">{label}</div>
      <div className="pp-cell" style={{ padding: '2px 8px', minHeight: 38, fontSize: 13.5, background: muted ? '#eceff2' : undefined }}>{children}</div>
    </div>
  );
}

/** 有／無・☐／☑ などの小さな切替（下段の チェック／証憑 用。tabIndex=-1 でEnter送りの順序には入らない） */
export function PaperToggle({ on, onLabel, offLabel, onChange, disabled, title }: { on: boolean; onLabel: string; offLabel: string; onChange: (v: boolean) => void; disabled?: boolean; title?: string }) {
  return (
    <button type="button" tabIndex={-1} className={'pp-toggle' + (on ? ' pp-on' : '')} disabled={disabled} aria-pressed={on} title={disabled ? undefined : title} data-tip={disabled && title ? title : undefined} onClick={() => onChange(!on)}>
      {on ? onLabel : offLabel}
    </button>
  );
}

/** 下段「Seq No ｜ チェック ｜ 証憑 ｜ 小切手No」。各値は画面ごとの状態をそのまま渡す */
export function PaperFootItems({ seq, check, shohyo, cheque, note }: { seq: ReactNode; check: ReactNode; shohyo: ReactNode; /** 小切手No（表示項目で有効なときだけ渡す） */ cheque?: ReactNode; note?: ReactNode }) {
  return (
    <div className="pp-foot" style={{ width: '100%' }}>
      <span className="pp-lab">Seq No</span>
      <span className="pp-val pp-num" style={{ minWidth: 52 }}><span className="pp-ro pp-ro-s">{seq}</span></span>
      <span className="pp-lab">チェック</span>
      <span className="pp-val">{check}</span>
      <span className="pp-lab">証憑</span>
      <span className={'pp-val' + (cheque === undefined && !note ? ' pp-grow' : '')}>{shohyo}</span>
      {cheque !== undefined && (
        <>
          <span className="pp-lab">小切手No</span>
          <span className={'pp-val' + (note ? '' : ' pp-grow')}>{cheque}</span>
        </>
      )}
      {note && <span className="pp-val pp-grow" style={{ fontSize: 12, color: '#5b6773', whiteSpace: 'nowrap', overflow: 'hidden' }}>{note}</span>}
    </div>
  );
}
