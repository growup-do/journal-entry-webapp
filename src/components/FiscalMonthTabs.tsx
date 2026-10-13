// 会計年度の月タブ（既存システムの「4 5 6 … 3 決」に相当）
//   range／onRange を渡した画面では、月の範囲（Shift＋クリック、または「期間を指定」）と日付の範囲（4/15〜6/30 など）も選べる（確認メモ #57／#58）。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { MonthFilter } from '../types';
import { useSession } from '../store/session';
import { FISCAL_MONTHS, monthRange, monthsIn, parseMD, periodLabel, type Period } from '../lib/period';

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
}

export function FiscalMonthTabs({ current, accent, onSelect, withAll, range, onRange }: Props) {
  // 環境設定（全区分共通）「月範囲の選択で、期首から月を選択する」：期首〜選択月を帯で示す（依頼書 2.5）
  const fromStart = useSession().env.termFromStart;
  const curIdx = current == null || current === '決' ? -1 : FISCAL_MONTHS.indexOf(current);
  const rangeMonths = range ? monthsIn(range) : [];
  const [pickOpen, setPickOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [err, setErr] = useState('');
  const opts: { label: string; value: MonthFilter }[] = [
    ...(withAll ? [{ label: '全月', value: null as MonthFilter }] : []),
    ...FISCAL_MONTHS.map((m) => ({ label: m, value: m })),
  ];
  const pick = (v: MonthFilter, shift: boolean) => {
    // Shift＋クリック：いま選んでいる月からクリックした月までの範囲
    if (onRange && shift && v != null && v !== '決' && current != null && current !== '決') { onRange(monthRange(current, v)); return; }
    onRange?.(null);
    onSelect(v);
  };
  const openPick = () => {
    const base = range ?? (current && current !== '決' ? { from: `${current}/1`, to: `${current}/1` } : { from: '4/1', to: '3/31' });
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
  const inp: CSSProperties = { width: 72, padding: '5px 8px', border: '1px solid #cfd8e0', borderRadius: 7, fontSize: 12.5, fontFamily: 'inherit', textAlign: 'center' };
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {opts.map((o) => {
        const on = range ? false : current === o.value;
        const inSel = !!range && o.value != null && rangeMonths.includes(o.value);
        const inRange = !range && fromStart && !on && o.value != null && o.value !== '決' && curIdx > 0 && FISCAL_MONTHS.indexOf(o.value) < curIdx;
        const hi = inSel || inRange;
        return (
          <button
            key={o.label}
            type="button"
            className="chip"
            onClick={(e) => pick(o.value, e.shiftKey)}
            title={inSel ? '選択中の期間に含まれる月' : inRange ? '期首からの累計に含まれる月（環境設定「期首から月を選択する」）' : onRange && o.value != null && o.value !== '決' ? 'クリックで1か月。Shift＋クリックで、いま選んでいる月からこの月までの範囲' : undefined}
            data-in-range={hi || undefined}
            style={{
              minWidth: 30,
              height: 26,
              padding: '0 8px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              background: on ? accent : hi ? accent + '22' : '#fff',
              color: on ? '#fff' : hi ? accent : '#5b6773',
              border: '1px solid ' + (on || hi ? accent : '#d3dbe3'),
            }}
          >
            {o.label}
          </button>
        );
      })}
      {onRange && (
        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <button type="button" className="chip" data-period-pick onClick={openPick} title="月の範囲（4月〜7月など）や日付の範囲（4/15〜6/30 など）で集計期間を指定します" style={{ height: 26, padding: '0 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: range ? accent : '#fff', color: range ? '#fff' : accent, border: '1px solid ' + accent }}>
            {range ? periodLabel(range).replace(/^令和\d+年 /, '') : '期間を指定'}
          </button>
          {range && <button type="button" className="chip" onClick={() => onRange(null)} title="期間の指定を解除して、月タブの1か月に戻します" style={{ height: 26, padding: '0 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: '#fff', color: '#5b6773', border: '1px solid #d3dbe3' }}>解除</button>}
          {pickOpen && (
            <div role="dialog" aria-label="集計期間の指定" data-period-dialog style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60, background: '#fff', border: '1px solid #dde4ea', borderRadius: 12, boxShadow: '0 12px 32px rgba(24,42,60,.18)', padding: 12, display: 'grid', gap: 8, minWidth: 300 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>集計期間の指定</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {([['4', '6', '第1四半期'], ['7', '9', '第2四半期'], ['10', '12', '第3四半期'], ['1', '3', '第4四半期'], ['4', '9', '上半期'], ['10', '3', '下半期'], ['4', '3', '全期間']] as const).map(([a, b, l]) => (
                  <button key={l} type="button" onClick={() => { const p = monthRange(a, b); setFrom(p.from); setTo(p.to); setErr(''); }} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #d3dbe3', background: '#fff', color: '#5b6773', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{l}</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                <span style={{ color: '#7a8794' }}>令和8年</span>
                <input className="field-input" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="4/15" aria-label="開始日（月/日）" style={inp} />
                <span>〜</span>
                <input className="field-input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="6/30" aria-label="終了日（月/日）" style={inp} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) applyPick(); }} />
              </div>
              <div style={{ fontSize: 11, color: '#8290a0' }}>月の範囲は「4/1〜7/31」のように月初・月末で、日付の範囲は「4/15〜6/30」のように指定します。月タブは Shift＋クリックでも範囲を選べます。</div>
              {err && <div style={{ fontSize: 12, color: '#c0392b' }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button type="button" onClick={() => setPickOpen(false)} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #cfd8e0', background: '#fff', color: '#5b6773', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>キャンセル</button>
                <button type="button" data-period-apply onClick={applyPick} style={{ padding: '5px 14px', borderRadius: 7, border: '1px solid ' + accent, background: accent, color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>この期間で集計</button>
              </div>
            </div>
          )}
        </span>
      )}
      {!range && fromStart && curIdx > 0 && <span data-from-start style={{ alignSelf: 'center', fontSize: 11, fontWeight: 700, color: accent, whiteSpace: 'nowrap' }} title="環境設定（全区分共通）「月範囲の選択で、期首から月を選択する」が有効です">4月〜{current}月の累計</span>}
    </div>
  );
}
