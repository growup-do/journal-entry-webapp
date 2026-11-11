// 月次試算：月の範囲指定の操作案（?page=range。確認メモ #143）
//   「何月から何月まで」を画面上で指定する操作を 4 案、実際に動く形で並べて比べた提案用ページ。案2（月タブのドラッグ・Shift＋クリック）に決定し、月タブ（FiscalMonthTabs）に反映した。
//   案1＝両端つまみのスライダー／案2＝月タブのドラッグ・Shift＋クリック（決定）／案3＝開始月・終了月のプルダウン／案4＝月別の棒グラフをドラッグ。ほかの 3 案は比べた経緯として残している。
//   各案に、選んだ範囲の表示と、その範囲で集計した小さな試算表（サンプル）を付ける。最後に比較表を載せる。四半期・上半期・年度累計などのボタンは設けない（確認メモ #143 への指示）。
//   月の並びは月タブ（FiscalMonthTabs）と同じ会計年度順に「初」を加えたもの（初・4〜12・1〜3・決）。金額・件数はすべて独自のサンプル。

import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as RKeyboardEvent, MouseEvent as RMouseEvent, PointerEvent as RPointerEvent, ReactNode } from 'react';
import { backToApp } from './Footer';

const GREEN = '#1f7a52';
/** 会計年度の月の並び（4月始まり）。初＝期首残高、決＝決算月 */
const MONTHS = ['初', '4', '5', '6', '7', '8', '9', '10', '11', '12', '1', '2', '3', '決'];
const LAST = MONTHS.length - 1;
/** 月の範囲（MONTHS の位置。両端を含む。開始 ≦ 終了） */
type Range = [number, number];
/** 各案の初期表示：6月〜9月 */
const INITIAL: Range = [3, 6];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const monthName = (i: number) => (i === 0 ? '期首' : i === LAST ? '決算' : `${MONTHS[i]}月`);
const rangeText = ([a, b]: Range) => (a === b ? monthName(a) : `${monthName(a)}〜${monthName(b)}`);
/** 範囲の長さ：「4か月」「期首＋3か月」など */
const spanText = ([a, b]: Range) => {
  const n = Math.min(b, LAST - 1) - Math.max(a, 1) + 1;
  return [...(a === 0 ? ['期首'] : []), ...(n > 0 ? [`${n}か月`] : []), ...(b === LAST ? ['決算'] : [])].join('＋');
};
const yen = (n: number) => (n < 0 ? '△' + Math.abs(n).toLocaleString('ja-JP') : n.toLocaleString('ja-JP'));
const sum = (xs: number[], from: number, to: number) => xs.slice(from, to + 1).reduce((s, v) => s + v, 0);

// ───── サンプルデータ（独自の値） ─────
/** 月ごとの増減の係数（4月〜3月） */
const WAVE = [1.0, 0.94, 1.08, 1.02, 0.9, 1.05, 0.97, 1.03, 1.22, 0.95, 0.92, 1.1];
const ACCOUNTS = [
  { name: '現金預金', open: 18_400_000, debit: 5_200_000, credit: 5_050_000 },
  { name: '事業未収金', open: 2_150_000, debit: 2_300_000, credit: 2_260_000 },
  { name: '未収補助金', open: 600_000, debit: 300_000, credit: 280_000 },
  { name: '立替金', open: 80_000, debit: 40_000, credit: 38_000 },
  { name: '前払費用', open: 240_000, debit: 60_000, credit: 62_000 },
];
const round = (v: number) => Math.round(v / 1000) * 1000;
/** 科目ごとの月別の借方・貸方（初＝期首残高を借方に、決＝決算整理の少額） */
const LEDGER = ACCOUNTS.map((ac, k) => ({
  name: ac.name,
  debit: MONTHS.map((_, i) => (i === 0 ? ac.open : i === LAST ? round(ac.debit * 0.05) : round(ac.debit * WAVE[(i - 1 + k * 2) % 12]))),
  credit: MONTHS.map((_, i) => (i === 0 ? 0 : i === LAST ? round(ac.credit * 0.04) : round(ac.credit * WAVE[(i + 4 + k * 3) % 12]))),
}));
/** 月別の仕訳件数（案4 の棒グラフ用） */
const COUNTS = [12, 148, 136, 152, 141, 129, 158, 144, 139, 171, 133, 127, 163, 26];
const COUNT_MAX = 200;

/** 範囲に応じた試算表の行（前月繰越＝開始月の前月末の残高） */
function trialRows([a, b]: Range) {
  return LEDGER.map((r) => {
    const carry = a === 0 ? 0 : sum(r.debit, 0, a - 1) - sum(r.credit, 0, a - 1);
    const debit = sum(r.debit, a, b);
    const credit = sum(r.credit, a, b);
    return { name: r.name, carry, debit, credit, balance: carry + debit - credit };
  });
}

// ───── 共通の小部品 ─────
const TH: CSSProperties = { padding: '6px 12px', background: '#f6f8fa', fontSize: 12, fontWeight: 700, color: '#8290a0', borderBottom: '1px solid #eef2f5', textAlign: 'left', whiteSpace: 'nowrap' };
const TD: CSSProperties = { padding: '5px 12px', fontSize: 14, borderBottom: '1px solid #f1f4f6', whiteSpace: 'nowrap' };
const NUM: CSSProperties = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const CARD: CSSProperties = { background: '#fff', border: '1px solid #dde4ea', borderRadius: 12, padding: '16px 18px', boxShadow: '0 4px 14px rgba(30,50,70,.05)' };
const H2: CSSProperties = { fontFamily: "'Zen Kaku Gothic New', sans-serif", fontSize: 17, margin: '0 0 6px' };
const headBtn: CSSProperties = { padding: '7px 14px', borderRadius: 8, border: '1px solid #cfd8e0', background: '#fff', color: '#22303c', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' };

/** 選択中の範囲の表示 */
function Readout({ range, extra }: { range: Range; extra?: ReactNode }) {
  return (
    <div data-range-readout aria-live="polite" style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#8290a0' }}>集計期間</span>
      <span style={{ fontSize: 12, color: '#7a8794' }}>令和8年度</span>
      <span style={{ fontSize: 20, fontWeight: 800, color: '#22303c' }}>{rangeText(range)}</span>
      <span style={{ fontSize: 14, color: '#5b6773' }}>（{spanText(range)}）</span>
      {extra && <span style={{ fontSize: 14, color: '#5b6773' }}>{extra}</span>}
    </div>
  );
}

/** 範囲に応じて変わる小さな試算表（サンプル） */
function MiniTrial({ range }: { range: Range }) {
  const rows = trialRows(range);
  const total = (k: 'carry' | 'debit' | 'credit' | 'balance') => rows.reduce((s, r) => s + r[k], 0);
  return (
    <div style={{ border: '1px solid #e6ecf1', borderRadius: 10, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={TH}>科目名</th>
            <th style={{ ...TH, textAlign: 'right' }}>前月繰越</th>
            <th style={{ ...TH, textAlign: 'right' }}>借方</th>
            <th style={{ ...TH, textAlign: 'right' }}>貸方</th>
            <th style={{ ...TH, textAlign: 'right' }}>残高</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} style={{ background: i % 2 ? '#f8fafc' : 'transparent' }}>
              <td style={TD}>{r.name}</td>
              <td style={NUM}>{yen(r.carry)}</td>
              <td style={NUM}>{yen(r.debit)}</td>
              <td style={NUM}>{yen(r.credit)}</td>
              <td style={NUM}>{yen(r.balance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#e9eef3' }}>
            <td style={{ ...TD, fontWeight: 700, borderBottom: 'none' }}>合計</td>
            {(['carry', 'debit', 'credit', 'balance'] as const).map((k) => <td key={k} style={{ ...NUM, fontWeight: 700, borderBottom: 'none' }}>{yen(total(k))}</td>)}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ───── 案1：両端つまみのスライダー ─────
type SliderPart = 'a' | 'b' | 'band';

function SliderPicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const [a, b] = value;
  const track = useRef<HTMLDivElement>(null);
  /** ドラッグ中の対象。either＝つまみが重なっていて、動かした向きで開始・終了のどちらかを決める */
  const drag = useRef<{ kind: SliderPart | 'either'; start: number; a: number; b: number } | null>(null);
  const pos = (i: number) => `${(i / LAST) * 100}%`;
  const idxAt = (x: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return clamp(Math.round(((x - r.left) / r.width) * LAST), 0, LAST);
  };
  const setA = (i: number) => { const n = clamp(i, 0, b); if (n !== a) onChange([n, b]); };
  const setB = (i: number) => { const n = clamp(i, a, LAST); if (n !== b) onChange([a, n]); };
  const focusPart = (p: SliderPart) => track.current?.querySelector<HTMLElement>(`[data-part="${p}"]`)?.focus();

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const part = (e.target as HTMLElement).closest<HTMLElement>('[data-part]')?.dataset.part as SliderPart | undefined;
    const i = idxAt(e.clientX);
    let kind: SliderPart | 'either';
    if (part === 'a' || part === 'b') kind = a === b ? 'either' : part;
    else if (part === 'band') kind = 'band';
    else {
      // 目盛り・月の名前をクリック：近いほうのつまみをその月へ
      kind = i < a ? 'a' : i > b ? 'b' : i - a < b - i ? 'a' : 'b';
      if (kind === 'a') setA(i); else setB(i);
    }
    drag.current = { kind, start: i, a, b };
    e.currentTarget.setPointerCapture(e.pointerId);
    focusPart(kind === 'either' ? (part as SliderPart) : kind);
  };
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const i = idxAt(e.clientX);
    if (d.kind === 'band') {
      // 月数を保ったまま前後にずらす
      const w = d.b - d.a;
      const na = clamp(d.a + i - d.start, 0, LAST - w);
      if (na !== a) onChange([na, na + w]);
      return;
    }
    if (d.kind === 'either') {
      if (i === d.a) return;
      d.kind = i < d.a ? 'a' : 'b';
      focusPart(d.kind);
    }
    if (d.kind === 'a') setA(i); else setB(i);
  };
  const up = () => { drag.current = null; };

  const key = (part: SliderPart) => (e: RKeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'PageUp' ? 3 : e.key === 'PageDown' ? -3 : 0;
    if (part === 'band') {
      if (!step) return;
      e.preventDefault();
      const w = b - a;
      const na = clamp(a + step, 0, LAST - w);
      if (na !== a) onChange([na, na + w]);
      return;
    }
    const cur = part === 'a' ? a : b;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? LAST : step ? cur + step : null;
    if (next == null) return;
    e.preventDefault();
    if (part === 'a') setA(next); else setB(next);
  };

  const thumb = (part: 'a' | 'b', i: number): CSSProperties => ({ position: 'absolute', left: pos(i), top: 2, width: 24, height: 24, marginLeft: -12, boxSizing: 'border-box', borderRadius: 12, background: '#fff', border: `3px solid ${GREEN}`, boxShadow: '0 2px 6px rgba(24,42,60,.25)', cursor: 'ew-resize', zIndex: part === 'b' ? 3 : 2 });
  const tag: CSSProperties = { position: 'absolute', top: -20, fontSize: 12, fontWeight: 700, color: '#5b6773', whiteSpace: 'nowrap', pointerEvents: 'none' };

  return (
    // mousedown の既定動作（文字の選択・フォーカスの移動）を止め、フォーカスは自前でつまみに当てる
    <div data-slider onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onMouseDown={(e: RMouseEvent) => e.preventDefault()} style={{ padding: '26px 46px 0', touchAction: 'none', userSelect: 'none' }}>
      <div ref={track} style={{ position: 'relative', height: 28 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 11, height: 6, borderRadius: 3, background: '#dfe6ec' }} />
        {MONTHS.map((m, i) => <span key={m} style={{ position: 'absolute', left: pos(i), top: 22, width: 2, height: 6, marginLeft: -1, background: i >= a && i <= b ? GREEN : '#c3ccd4' }} />)}
        <div
          data-part="band"
          className="rp-focus"
          role="button"
          tabIndex={a < b ? 0 : -1}
          aria-label={`範囲 ${rangeText(value)} を、月数を保ったまま前後にずらす（左右の矢印キー）`}
          title="つかんで動かすと、月数を保ったまま前後にずらせます"
          onKeyDown={key('band')}
          style={{ position: 'absolute', left: pos(a), width: `${((b - a) / LAST) * 100}%`, top: 9, height: 10, borderRadius: 5, background: GREEN, cursor: 'grab', zIndex: 1 }}
        />
        <span style={{ ...tag, left: pos(a), transform: 'translateX(-100%)', marginLeft: -4 }}>開始</span>
        <span style={{ ...tag, left: pos(b), marginLeft: 4 }}>終了</span>
        <div data-part="a" className="rp-focus" role="slider" tabIndex={0} aria-label="開始月" aria-valuemin={0} aria-valuemax={b} aria-valuenow={a} aria-valuetext={monthName(a)} onKeyDown={key('a')} style={thumb('a', a)} />
        <div data-part="b" className="rp-focus" role="slider" tabIndex={0} aria-label="終了月" aria-valuemin={a} aria-valuemax={LAST} aria-valuenow={b} aria-valuetext={monthName(b)} onKeyDown={key('b')} style={thumb('b', b)} />
      </div>
      <div style={{ position: 'relative', height: 26 }}>
        {MONTHS.map((m, i) => {
          const hi = i >= a && i <= b;
          return <span key={m} style={{ position: 'absolute', left: pos(i), top: 4, transform: 'translateX(-50%)', fontSize: 14, fontWeight: hi ? 700 : 500, color: hi ? GREEN : '#7a8794', cursor: 'pointer' }}>{m}</span>;
        })}
      </div>
    </div>
  );
}

// ───── 案2・案4 共通：起点と終点で範囲を持ち、ドラッグ／Shift＋クリック／矢印キーで動かす ─────
function useSpan(initial: Range) {
  /** 起点（クリックした月・ドラッグを始めた月）と終点（Shift＋クリックした月・ドラッグ中の月） */
  const [anchor, setAnchor] = useState(initial[0]);
  const [head, setHead] = useState(initial[1]);
  const set = (an: number, hd: number) => { setAnchor(an); setHead(hd); };
  const range: Range = [Math.min(anchor, head), Math.max(anchor, head)];
  return { anchor, head, range, set };
}
type Span = ReturnType<typeof useSpan>;

/** 月の並び（data-mi を持つボタンの列）に付ける操作。ボタンは itemProps、外枠は boxProps を展開して使う */
function useSpanHandlers(span: Span) {
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const idxFrom = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-mi]');
    return el && box.current?.contains(el) ? Number(el.dataset.mi) : null;
  };
  const focusAt = (i: number) => box.current?.querySelector<HTMLElement>(`[data-mi="${i}"]`)?.focus();
  const boxProps = {
    ref: box,
    onPointerDown: (e: RPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const i = idxFrom(e.clientX, e.clientY);
      if (i == null) return;
      // Shift＋クリック：起点はそのまま、終点だけ動かす
      span.set(e.shiftKey ? span.anchor : i, i);
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      focusAt(i);
    },
    onPointerMove: (e: RPointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const i = idxFrom(e.clientX, e.clientY);
      if (i != null && i !== span.head) { span.set(span.anchor, i); focusAt(i); }
    },
    onPointerUp: () => { dragging.current = false; },
    onPointerCancel: () => { dragging.current = false; },
    // mousedown の既定動作（文字の選択・フォーカスの移動）を止め、フォーカスは自前で月のボタンに当てる
    onMouseDown: (e: RMouseEvent) => e.preventDefault(),
    onKeyDown: (e: RKeyboardEvent<HTMLDivElement>) => {
      const next = e.key === 'ArrowRight' ? span.head + 1 : e.key === 'ArrowLeft' ? span.head - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? LAST : null;
      if (next == null) return;
      e.preventDefault();
      const n = clamp(next, 0, LAST);
      // 矢印＝1か月を移動、Shift＋矢印＝起点を残して範囲を伸び縮みさせる
      span.set(e.shiftKey ? span.anchor : n, n);
      focusAt(n);
    },
  };
  const itemProps = (i: number) => ({
    'data-mi': i,
    tabIndex: i === span.head ? 0 : -1,
    'aria-pressed': i >= span.range[0] && i <= span.range[1],
    // キーボードの Enter／Space（ポインターの操作は外枠の onPointerDown で処理済み）
    onClick: (e: RMouseEvent) => { if (e.detail === 0) span.set(e.shiftKey ? span.anchor : i, i); },
  });
  return { boxProps, itemProps };
}

/** 案2：月タブ（ドラッグ／Shift＋クリック） */
function MonthTabsPicker({ span }: { span: Span }) {
  const { boxProps, itemProps } = useSpanHandlers(span);
  const [a, b] = span.range;
  return (
    <div {...boxProps} role="group" aria-label="月（左右の矢印キーで移動、Shift＋矢印キーで範囲）" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', touchAction: 'pan-y', userSelect: 'none' }}>
      {MONTHS.map((m, i) => {
        const edge = i === a || i === b;
        const mid = i > a && i < b;
        return (
          <button
            key={m}
            type="button"
            className="chip rp-focus"
            {...itemProps(i)}
            aria-label={monthName(i)}
            title="クリックで1か月。ドラッグ、または Shift＋クリックで範囲"
            style={{ minWidth: 34, height: 30, padding: '0 10px', borderRadius: 6, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: edge ? GREEN : mid ? GREEN + '22' : '#fff', color: edge ? '#fff' : mid ? GREEN : '#5b6773', border: '1px solid ' + (edge || mid ? GREEN : '#d3dbe3') }}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}

/** 案4：月別の棒グラフ（仕訳件数）をドラッグ */
function BarPicker({ span }: { span: Span }) {
  const { boxProps, itemProps } = useSpanHandlers(span);
  const [a, b] = span.range;
  /** マウスを載せた月・フォーカスのある月（件数を出す） */
  const [hot, setHot] = useState<number | null>(null);
  const PLOT = 84;
  const LABEL_H = 24;
  return (
    <div style={{ position: 'relative', paddingLeft: 34 }}>
      {/* 目盛り線（100件・200件） */}
      {[100, 200].map((t) => (
        <div key={t} aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: LABEL_H + (t / COUNT_MAX) * PLOT, height: 0, borderTop: '1px solid #e6ecf1', pointerEvents: 'none' }}>
          <span style={{ position: 'absolute', left: 0, top: -9, fontSize: 12, color: '#9aa5b1', background: '#f8fafc', paddingRight: 4 }}>{t}件</span>
        </div>
      ))}
      <div {...boxProps} role="group" aria-label="月別の仕訳件数（左右の矢印キーで移動、Shift＋矢印キーで範囲）" style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${MONTHS.length}, minmax(0, 1fr))`, height: PLOT + LABEL_H + 18, touchAction: 'pan-y', userSelect: 'none', cursor: 'crosshair' }}>
        {MONTHS.map((m, i) => {
          const sel = i >= a && i <= b;
          const show = hot === i || i === a || i === b;
          return (
            <button
              key={m}
              type="button"
              className="rp-focus"
              {...itemProps(i)}
              aria-label={`${monthName(i)}　仕訳 ${COUNTS[i]} 件`}
              onPointerEnter={() => setHot(i)}
              onPointerLeave={() => setHot((h) => (h === i ? null : h))}
              onFocus={() => setHot(i)}
              onBlur={() => setHot((h) => (h === i ? null : h))}
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%', padding: 0, border: 'none', borderRadius: 0, background: sel ? GREEN + '14' : 'transparent', fontFamily: 'inherit', cursor: 'inherit' }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: '#22303c', lineHeight: '16px', visibility: show ? 'visible' : 'hidden', fontVariantNumeric: 'tabular-nums' }}>{COUNTS[i]}</span>
              <span style={{ width: 16, height: Math.max(2, (COUNTS[i] / COUNT_MAX) * PLOT), borderRadius: '4px 4px 0 0', background: sel ? GREEN : '#c3ccd4' }} />
              <span style={{ alignSelf: 'stretch', height: LABEL_H, boxSizing: 'border-box', borderTop: '1px solid #b7c2cc', fontSize: 14, fontWeight: sel ? 700 : 500, color: sel ? GREEN : '#7a8794', lineHeight: `${LABEL_H - 2}px` }}>{m}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 案3：開始月・終了月のプルダウン */
function SelectPicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const [a, b] = value;
  const sel: CSSProperties = { padding: '6px 8px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: '#fff', color: '#22303c', cursor: 'pointer' };
  const optLabel = (i: number) => (i === 0 ? '初（期首）' : i === LAST ? '決（決算）' : `${MONTHS[i]}月`);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 14, color: '#5b6773' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700 }}>開始月</span>
          {/* 開始月を終了月より後ろにしたら、終了月を開始月に合わせる */}
          <select className="rp-focus" data-range-from value={a} onChange={(e) => { const n = Number(e.target.value); onChange([n, Math.max(n, b)]); }} style={sel}>
            {MONTHS.map((m, i) => <option key={m} value={i}>{optLabel(i)}</option>)}
          </select>
        </label>
        <span>〜</span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700 }}>終了月</span>
          <select className="rp-focus" data-range-to value={b} onChange={(e) => { const n = Number(e.target.value); onChange([Math.min(a, n), n]); }} style={sel}>
            {MONTHS.map((m, i) => <option key={m} value={i}>{optLabel(i)}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

// ───── 案のカード ─────
interface CardProps {
  no: number;
  /** 決定した案（それ以外は「見送り」と表示する） */
  decided?: boolean;
  name: string;
  lead: string;
  range: Range;
  extra?: ReactNode;
  children: ReactNode;
  how: string;
  keys: string;
  good: string;
  care: string;
}

function ProposalCard({ no, decided, name, lead, range, extra, children, how, keys, good, care }: CardProps) {
  const dt: CSSProperties = { fontSize: 12, fontWeight: 700, color: '#8290a0', paddingTop: 2, whiteSpace: 'nowrap' };
  const dd: CSSProperties = { margin: 0, fontSize: 14, lineHeight: 1.65, color: '#22303c' };
  return (
    <article className="rp-card" id={`plan${no}`} data-plan={no} data-decided={decided || undefined} style={{ ...CARD, display: 'grid', gap: 12, alignContent: 'start', ...(decided ? { border: `2px solid ${GREEN}` } : {}) }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ padding: '2px 10px', borderRadius: 8, background: GREEN, color: '#fff', fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap' }}>案{no}</span>
          <h2 style={{ ...H2, margin: 0 }}>{name}</h2>
          {decided
            ? <span style={{ marginLeft: 'auto', padding: '2px 12px', borderRadius: 8, background: '#e3f3ea', color: GREEN, border: `1px solid ${GREEN}`, fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap' }}>この案に決定</span>
            : <span style={{ marginLeft: 'auto', padding: '2px 12px', borderRadius: 8, background: '#f1f4f7', color: '#7a8794', border: '1px solid #d3dbe3', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>見送り</span>}
        </div>
        <div style={{ fontSize: 14, color: '#5b6773', marginTop: 4 }}>{lead}</div>
      </div>
      {/* 操作する部分（高さをそろえて見比べやすく） */}
      <div style={{ background: '#f8fafc', border: '1px solid #e8edf2', borderRadius: 10, padding: '14px 16px', minHeight: 156, display: 'grid', alignContent: 'center' }}>{children}</div>
      <Readout range={range} extra={extra} />
      <MiniTrial range={range} />
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 14, rowGap: 6, margin: 0 }}>
        <dt style={dt}>操作</dt><dd style={dd}>{how}</dd>
        <dt style={dt}>キーボード</dt><dd style={dd}>{keys}</dd>
        <dt style={dt}>向いている場面</dt><dd style={dd}>{good}</dd>
        <dt style={dt}>気になる点</dt><dd style={dd}>{care}</dd>
      </dl>
    </article>
  );
}

/** 比較表（観点ごとに 4 案を横に並べる） */
const COMPARE: { point: string; cells: [string, string, string, string] }[] = [
  { point: '1か月だけを選ぶ', cells: ['2つのつまみを同じ月に重ねる', '月を1回クリック', 'プルダウン2回', '棒を1回クリック'] },
  { point: '好きな範囲を選ぶ', cells: ['つまみを1〜2回動かす', 'ドラッグ1回、またはクリック2回', 'プルダウン2回', 'ドラッグ1回'] },
  { point: '範囲をずらして見比べる', cells: ['帯をつかんで動かせる（月数はそのまま）', '選び直す', '選び直す', '選び直す'] },
  { point: '操作方法の気づきやすさ', cells: ['見れば分かる', '案内が必要（ドラッグ・Shift）', '見れば分かる', '案内が必要（ドラッグ）'] },
  { point: '画面で使う場所', cells: ['横いっぱいの1行（約70px）', 'いまの月タブのまま', '月タブとは別に1行', '約130px（表の行が3〜4行減る）'] },
  { point: 'いまの画面との違い', cells: ['月タブを置き換えるか、別に追加', '月タブにドラッグを足す（反映済み）', '「期間を指定」の中身を外に出す形', '新しい部品。棒に出す値の集計が必要'] },
];

export function RangeProposalPage() {
  const [slider, setSlider] = useState<Range>(INITIAL);
  const tabs = useSpan(INITIAL);
  const [select, setSelect] = useState<Range>(INITIAL);
  const bars = useSpan(INITIAL);
  const openTrial = () => {
    const q = new URLSearchParams();
    q.set('open', '月次試算');
    q.set('mode', 'form');
    window.location.assign(window.location.pathname + '?' + q.toString());
  };
  const cth: CSSProperties = { ...TH, fontSize: 14, padding: '8px 12px', whiteSpace: 'normal' };
  const ctd: CSSProperties = { ...TD, padding: '8px 12px', whiteSpace: 'normal', lineHeight: 1.5, verticalAlign: 'top' };

  return (
    <div style={{ minHeight: 'calc(100vh / var(--app-zoom, 1))', background: '#f3f5f7', fontFamily: "'Noto Sans JP', sans-serif", color: '#22303c' }}>
      <style>{`.rp-focus:focus-visible { outline: 2px solid ${GREEN}; outline-offset: 2px } @media print { .no-print { display: none !important } body { background: #fff } .rp-card { box-shadow: none !important; break-inside: avoid } }`}</style>
      {/* ヘッダー */}
      <header className="no-print" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid #dde4ea', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, background: GREEN, color: '#fff', borderRadius: 8, fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700 }}>会</span>
        <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 17 }}>月次試算　月の範囲指定の操作案</div>
        <span style={{ fontSize: 14, color: '#7a8794' }}>確認メモ #143 へのご提案（Web版プロトタイプ）</span>
        <span data-decision style={{ padding: '2px 12px', borderRadius: 8, background: '#e3f3ea', color: GREEN, border: `1px solid ${GREEN}`, fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap' }}>案2 に決定</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="rp-focus" onClick={openTrial} title="月次試算の画面を開きます。案2 の操作（月タブのドラッグ／Shift＋クリック）を実際の画面で試せます" style={headBtn}>月次試算で試す</button>
          <button type="button" className="rp-focus" onClick={() => window.print()} style={headBtn}>印刷／PDF保存</button>
          <button type="button" className="rp-focus" onClick={backToApp} style={{ ...headBtn, border: '1px solid ' + GREEN, background: GREEN, color: '#fff' }}>← システムに戻る</button>
        </div>
      </header>

      <div style={{ maxWidth: 1540, margin: '0 auto', padding: '20px 28px 60px' }}>
        {/* 前置き */}
        <div className="rp-card" style={{ ...CARD, marginBottom: 16, fontSize: 14, lineHeight: 1.75 }}>
          月次試算で「何月から何月まで」を画面上で指定する操作を 4 つの案で比べ、<b style={{ color: GREEN }}>案2（月タブをドラッグ／Shift＋クリック）に決定しました</b>。月次試算のほか、同じ月タブを使う画面（仕訳一覧・元帳・小口現金・預金出納・収入支出）に反映済みです。四半期・上半期・年度累計などのボタンは設けません。
          <div style={{ color: '#5b6773' }}>
            ほかの 3 案は、比べた経緯として残しています。どの案もこのページの上で実際に動かせます。月を選ぶと、すぐ下の「集計期間」と試算表（サンプル）がその範囲の金額に変わります。月の並びは「初（期首残高）・4月〜3月・決（決算）」です。日付の範囲（4/15〜6/30 など）は、これまでどおり月タブの右の「期間を指定」から選びます。
          </div>
        </div>

        {/* 4 案 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(620px, 1fr))', gap: 16 }}>
          <ProposalCard
            no={1}
            name="両端つまみのスライダー"
            lead="1本の線の上で、開始月と終了月のつまみを左右に動かします。"
            range={slider}
            how="左のつまみで開始月、右のつまみで終了月を動かします。緑の帯をつかむと、月数を保ったまま前後にずらせます。月の名前をクリックすると、近いほうのつまみがその月に移ります。"
            keys="Tab でつまみ（または帯）に移り、← → で1か月、PageUp／PageDown で3か月、Home／End で端まで動かします。"
            good="範囲を少しずつ広げたり縮めたりしながら、残高の動きを見比べたいとき。「3か月分のまま、月を1つずつずらす」見方ができます。"
            care="1か月だけを見るには、2つのつまみを同じ月に重ねる必要があり、月タブの1クリックより手数が増えます。つまみが小さいので、狙った月に止めるのに少し慣れが要ります。月タブと役割が重なるため、置き換えるか両方置くかを決める必要があります。"
          >
            <SliderPicker value={slider} onChange={setSlider} />
          </ProposalCard>

          <ProposalCard
            no={2}
            decided
            name="月タブをドラッグ／Shift＋クリック"
            lead="いまの月タブをそのまま使い、なぞるだけで範囲を選べるようにします。"
            range={tabs.range}
            how="月をクリックすると1か月。開始月から終了月までドラッグするか、開始月をクリックしてから終了月を Shift＋クリックすると範囲になります。"
            keys="Tab で月タブに移り、← → で月を移動、Shift＋← → で範囲を伸び縮みさせます。Home／End で端の月へ移ります。実際の画面では、← → を試算表の部の切替に使っているため、月タブは Tab で移って Enter で選び、Shift＋← → で範囲を伸び縮みさせます。"
            good="ふだんは1か月ずつ見て、ときどき範囲で見たいとき。見た目も場所もいまの月タブと同じなので、ほかの帳票の画面とも操作がそろいます。"
            care="ドラッグや Shift＋クリックで範囲を選べることが、画面を見ただけでは伝わりにくい操作です。実際の画面では、月タブの右に案内の一文を出し、月タブにツールチップを付けています。四半期などの決まった範囲も、毎回なぞって選ぶことになります。"
          >
            <div style={{ display: 'grid', gap: 8 }}>
              <MonthTabsPicker span={tabs} />
              <div style={{ fontSize: 12, color: '#8290a0' }}>クリックで1か月。ドラッグ、または Shift＋クリックで範囲を選べます。</div>
            </div>
          </ProposalCard>

          <ProposalCard
            no={3}
            name="開始月・終了月のプルダウン"
            lead="開始月と終了月を、それぞれプルダウンで選びます。"
            range={select}
            how="開始月と終了月をプルダウンで選びます。開始月を終了月より後ろにすると、終了月が開始月に合わせて動きます。"
            keys="Tab で順に移り、プルダウンは ↑ ↓ で選びます。"
            good="開始月と終了月を、文字で確かめながら決めたいとき。操作が見たままなので、説明がなくても使えます。"
            care="どの範囲でもプルダウンを2回開くことになり、手数が多めです。1か月だけを見るときも同じ操作が要ります。月タブとは別に1行使います。"
          >
            <SelectPicker value={select} onChange={setSelect} />
          </ProposalCard>

          <ProposalCard
            no={4}
            name="月別の棒グラフをドラッグ"
            lead="月ごとの仕訳件数の棒を見ながら、その上をなぞって範囲を選びます。"
            range={bars.range}
            extra={<>この範囲の仕訳 <b style={{ color: '#22303c' }}>{sum(COUNTS, bars.range[0], bars.range[1]).toLocaleString('ja-JP')}</b> 件</>}
            how="棒の上をドラッグすると範囲、クリックすると1か月を選びます（Shift＋クリックでも範囲にできます）。棒にマウスを載せると、その月の仕訳件数が出ます。"
            keys="Tab でグラフに移り、← → で月を移動、Shift＋← → で範囲を伸び縮みさせます。Home／End で端の月へ移ります。"
            good="取引の多い月・少ない月を見ながら範囲を決めたいとき。件数が極端に少ない月（入力がまだの月）にも気づきやすくなります。"
            care="高さを約130px使うので、1600×768 の画面では試算表の見える行が3〜4行減ります。棒に何を出すか（仕訳件数・発生額など）を決める必要があり、その集計のぶん表示に時間がかかる可能性があります。"
          >
            <BarPicker span={bars} />
          </ProposalCard>
        </div>

        {/* 比較表 */}
        <section style={{ marginTop: 26 }}>
          <h2 style={H2}>4 案の比較</h2>
          <div className="rp-card" style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ ...cth, width: 190 }}>比べる点</th>
                  {['案1　スライダー', '案2　月タブ（決定）', '案3　プルダウン', '案4　棒グラフ'].map((h) => <th key={h} style={{ ...cth, color: '#22303c' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((r, i) => (
                  <tr key={r.point} style={{ background: i % 2 ? '#f8fafc' : 'transparent' }}>
                    <td style={{ ...ctd, fontWeight: 700, color: '#5b6773' }}>{r.point}</td>
                    {r.cells.map((c, k) => <td key={k} style={ctd}>{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 12, color: '#9aa5b1', marginTop: 6 }}>※ どの案もキーボードだけで操作できます。</div>
        </section>

        <div style={{ fontSize: 12, color: '#9aa5b1', marginTop: 20, lineHeight: 1.7 }}>
          ※ 表示している金額・件数はすべてサンプルです。試算表の「前月繰越」は開始月の前月末の残高、「借方」「貸方」は範囲内の合計、「残高」は終了月の月末の残高です。「初」は期首残高を借方に計上した月として集計しています。<br />
          ※ 案2 は、月次試算と、同じ月タブを使う画面に反映済みです（右上の「月次試算で試す」で確認できます）。
        </div>
      </div>
    </div>
  );
}
