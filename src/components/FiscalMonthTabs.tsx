// 会計年度の月タブ（既存システムの「4 5 6 … 3 決」に相当）
//   range／onRange を渡した画面では、月の範囲と日付の範囲（4/15〜6/30 など）も選べる（確認メモ #57／#58）。
//   月の範囲は、月タブのドラッグ、または Shift＋クリックで選ぶ（確認メモ #143 の案2 に決定）。
//   キーボードは Shift＋←→ で範囲を伸び縮みさせる（Shift なしの ←→ は試算表の部の切替などに使われているので、月タブでは扱わない。月の移動は Tab と Enter）。日付の範囲は「期間を指定」から。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as RKeyboardEvent, PointerEvent as RPointerEvent, ReactNode } from 'react';
import type { MonthFilter } from '../types';
import { useSession } from '../store/session';
import { FISCAL_MONTHS, monthRange, monthsIn, parseMD, periodLabel, type Period } from '../lib/period';
import { CalendarModal } from './SingleEntryTools';

export { FISCAL_MONTHS };

interface Props {
  current: MonthFilter;
  accent: string;
  onSelect: (m: MonthFilter) => void;
  /** 「全月」ボタンを付ける */
  withAll?: boolean;
  /** 選択中の期間（月の範囲・日付の範囲）。null＝月タブの単月 */
  range?: Period | null;
  /** 期間を変えたとき（null＝範囲を解除して単月に戻す）。渡すと範囲選択ができる */
  onRange?: (p: Period | null) => void;
  /** 月ボタン（〜「決」）の直後に並べる要素（小口現金の翌年度の予備月など。確認メモ #205） */
  after?: ReactNode;
}

/** 範囲に入れられる月（4〜3月）。「全月」「決」は範囲に入らない */
const isMonth = (v: MonthFilter | undefined): v is string => v != null && v !== '決' && FISCAL_MONTHS.includes(v);

export function FiscalMonthTabs({ current, accent, onSelect, withAll, range, onRange, after }: Props) {
  // 環境設定（全区分共通）「月範囲の選択で、期首から月を選択する」：期首〜選択月を帯で示す（依頼書 2.5）
  const fromStart = useSession().env.termFromStart;
  const curIdx = current == null || current === '決' ? -1 : FISCAL_MONTHS.indexOf(current);
  const [pickOpen, setPickOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [err, setErr] = useState('');
  /** カレンダーで選ぶ対象（開始日／終了日） */
  const [cal, setCal] = useState<'from' | 'to' | null>(null);
  const box = useRef<HTMLDivElement>(null);
  /** ドラッグ中の範囲（a＝押した月、b＝いまポインターのある月）。離したときに確定する */
  const [drag, setDrag] = useState<{ a: string; b: string } | null>(null);
  const dragRef = useRef<{ a: string; b: string } | null>(null);
  /** ドラッグで範囲を確定した直後のクリック（タッチ操作では押した月に click が届く）を無視する */
  const dragged = useRef(false);
  const stopDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => stopDrag.current?.(), []);

  const opts: { label: string; value: MonthFilter }[] = [
    ...(withAll ? [{ label: '全月', value: null as MonthFilter }] : []),
    ...FISCAL_MONTHS.map((m) => ({ label: m, value: m })),
  ];
  const focusTab = (label: string) => box.current?.querySelector<HTMLElement>(`[data-ft="${label}"]`)?.focus();
  const pick = (v: MonthFilter, shift: boolean) => {
    // Shift＋クリック：いま選んでいる月からクリックした月までの範囲
    if (onRange && shift && isMonth(v) && isMonth(current)) { onRange(v === current ? null : monthRange(current, v)); return; }
    onRange?.(null);
    onSelect(v);
  };

  // ドラッグ：押した月から離した月までを範囲にする。同じ月で離したときは、ふつうのクリック（1か月）として扱う
  const startDrag = (v: MonthFilter, e: RPointerEvent) => {
    if (!onRange || e.button !== 0 || e.shiftKey || !isMonth(v)) return;
    stopDrag.current?.();
    dragRef.current = { a: v, b: v };
    const monthAt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-ft]');
      const m = el && box.current?.contains(el) ? el.dataset.ft : undefined;
      return isMonth(m) ? m : null;
    };
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      const m = monthAt(ev.clientX, ev.clientY);
      if (!d || !m || m === d.b) return;
      dragRef.current = { a: d.a, b: m };
      setDrag(m === d.a ? null : dragRef.current);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      stopDrag.current = null;
      dragRef.current = null;
      setDrag(null);
    };
    const end = (ev: PointerEvent) => {
      const d = dragRef.current;
      stop();
      if (ev.type !== 'pointerup' || !d || d.a === d.b) return;
      dragged.current = true;
      window.setTimeout(() => { dragged.current = false; }, 0);
      // 起点の月を「選んでいる月」にしておく（続けて Shift＋クリック／Shift＋←→ で終わりの月だけ動かせる）
      onRange(monthRange(d.a, d.b));
      onSelect(d.a);
      focusTab(d.b);
    };
    stopDrag.current = stop;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  // キーボード：Shift＋←→ で（選んでいる月を起点に）範囲を伸び縮みさせる。Shift なしの ←→ は画面側（部の切替）に任せる
  const onKey = (label: string, e: RKeyboardEvent) => {
    if (!onRange || !e.shiftKey) return;
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    if (!isMonth(current) || !isMonth(label)) return;
    const months = FISCAL_MONTHS.filter(isMonth);
    const n = months[Math.min(months.length - 1, Math.max(0, months.indexOf(label) + step))];
    onRange(n === current ? null : monthRange(current, n));
    focusTab(n);
  };

  const openPick = () => {
    const base = range ?? (current && current !== '決' && FISCAL_MONTHS.includes(current) ? { from: `${current}/1`, to: `${current}/1` } : { from: '4/1', to: '3/31' });
    setFrom(base.from); setTo(base.to); setErr(''); setPickOpen(true);
  };
  const applyPick = () => {
    const f = parseMD(from), t = parseMD(to);
    if (!f || !t) { setErr('日付は「4/15」のように 月/日 で入力してください'); return; }
    const p: Period = { from: f, to: t };
    if (monthsIn(p).length === 0) { setErr('終了日は開始日より後にしてください'); return; }
    onRange?.(p); setPickOpen(false);
    // 月タブの選択は開始月に合わせる
    onSelect(f.split('/')[0]);
  };
  const inp: CSSProperties = { width: 72, padding: '5px 8px', border: '1px solid #cfd8e0', borderRadius: 7, fontSize: 14, fontFamily: 'inherit', textAlign: 'center' };
  // 範囲の表示：ドラッグ中はその範囲、それ以外は選択中の期間。両端の月を濃く、間の月を薄く塗る
  const ranged = !!drag || !!range;
  const selMonths = drag ? monthsIn(monthRange(drag.a, drag.b)) : range ? monthsIn(range) : [];
  return (
    <div ref={box} data-month-tabs data-dragging={drag ? '1' : undefined} style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', touchAction: onRange ? 'pan-y' : undefined }}>
      {opts.map((o) => {
        const on = ranged ? false : current === o.value;
        const inSel = ranged && o.value != null && selMonths.includes(o.value);
        const edge = inSel && (o.value === selMonths[0] || o.value === selMonths[selMonths.length - 1]);
        const inRange = !ranged && fromStart && !on && o.value != null && o.value !== '決' && curIdx > 0 && FISCAL_MONTHS.indexOf(o.value) < curIdx;
        const hi = inSel || inRange;
        const solid = on || edge;
        return (
          <button
            key={o.label}
            type="button"
            className="chip"
            data-ft={o.label}
            onPointerDown={(e) => startDrag(o.value, e)}
            onClick={(e) => { if (dragged.current) return; pick(o.value, e.shiftKey); }}
            onKeyDown={(e) => onKey(o.label, e)}
            aria-pressed={onRange ? on || inSel : undefined}
            title={inSel ? '選択中の期間に含まれる月（別の月をクリックすると1か月に戻ります）' : inRange ? '期首からの累計に含まれる月（環境設定「期首から月を選択する」）' : onRange && isMonth(o.value) ? 'クリックで1か月。ドラッグ、または Shift＋クリックで月の範囲（キーボードは ←→ で月を移動、Shift＋←→ で範囲）' : undefined}
            data-in-range={hi || undefined}
            data-edge={edge || undefined}
            style={{
              minWidth: 34,
              height: 30,
              padding: '0 10px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              background: solid ? accent : hi ? accent + '22' : '#fff',
              color: solid ? '#fff' : hi ? accent : '#5b6773',
              border: '1px solid ' + (solid || hi ? accent : '#d3dbe3'),
            }}
          >
            {o.label}
          </button>
        );
      })}
      {after}
      {onRange && (
        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <button type="button" className="chip" data-period-pick onClick={openPick} title="日付の範囲（4/15〜6/30 など）で集計期間を指定します。月の範囲は、月タブのドラッグ、または Shift＋クリックで選べます" style={{ height: 30, padding: '0 12px', borderRadius: 6, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: range ? accent : '#fff', color: range ? '#fff' : accent, border: '1px solid ' + accent }}>
            {range ? periodLabel(range).replace(/^令和\d+年 /, '') : '期間を指定'}
          </button>
          {range && <button type="button" className="chip" onClick={() => onRange(null)} title="期間の指定を解除して、月タブの1か月に戻します" style={{ height: 30, padding: '0 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: '#fff', color: '#5b6773', border: '1px solid #d3dbe3' }}>解除</button>}
          {pickOpen && (
            <div role="dialog" aria-label="集計期間の指定" data-period-dialog style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60, background: '#fff', border: '1px solid #dde4ea', borderRadius: 12, boxShadow: '0 12px 32px rgba(24,42,60,.18)', padding: 12, display: 'grid', gap: 8, minWidth: 300 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>集計期間の指定</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                <span style={{ color: '#7a8794' }}>令和8年</span>
                <input className="field-input" value={from} onChange={(e) => setFrom(e.target.value)} onClick={() => setCal('from')} placeholder="4/15" aria-label="開始日（月/日）" title="クリックでカレンダーから選べます" style={inp} />
                <span>〜</span>
                <input className="field-input" value={to} onChange={(e) => setTo(e.target.value)} onClick={() => setCal('to')} placeholder="6/30" aria-label="終了日（月/日）" title="クリックでカレンダーから選べます" style={inp} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) applyPick(); }} />
              </div>
              <div style={{ fontSize: 12, color: '#8290a0' }}>日付の欄をクリックするとカレンダーから選べます。日付の範囲は「4/15〜6/30」のように指定します。月の範囲は、月タブをドラッグするか、開始月をクリックしてから終了月を Shift＋クリックすると選べます。</div>
              {err && <div style={{ fontSize: 14, color: '#c0392b' }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button type="button" onClick={() => setPickOpen(false)} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #cfd8e0', background: '#fff', color: '#5b6773', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>キャンセル</button>
                <button type="button" data-period-apply onClick={applyPick} style={{ padding: '5px 14px', borderRadius: 7, border: '1px solid ' + accent, background: accent, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>この期間で集計</button>
              </div>
            </div>
          )}
          {cal && (() => { const v = parseMD(cal === 'from' ? from : to); const [cm, cd] = (v ?? `${current && current !== '決' ? current : '4'}/1`).split('/'); return (
            <CalendarModal open compact accent={accent} entries={[]} month={cm} day={cd} onClose={() => setCal(null)} onPick={(mm, dd) => { (cal === 'from' ? setFrom : setTo)(`${mm}/${dd}`); setErr(''); setCal(null); }} />
          ); })()}
        </span>
      )}
      {onRange && !range && <span data-range-hint title="月タブの上を、開始月から終了月までドラッグすると範囲になります。開始月をクリックしてから、終了月を Shift＋クリックしても選べます" style={{ alignSelf: 'center', fontSize: 12, color: '#8290a0', whiteSpace: 'nowrap', cursor: 'help' }}>月はドラッグで範囲を選べます</span>}
      {!range && fromStart && curIdx > 0 && <span data-from-start style={{ alignSelf: 'center', fontSize: 12, fontWeight: 700, color: accent, whiteSpace: 'nowrap' }} title="環境設定（全区分共通）「月範囲の選択で、期首から月を選択する」が有効です">4月〜{current}月の累計</span>}
    </div>
  );
}
