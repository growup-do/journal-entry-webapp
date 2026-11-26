// 年月日の入力（確認メモ #280）：和暦（プルダウン）＋ 年・月・日 の入力欄 ＋ カレンダーから選ぶボタン。
//   値は「令和8年 4月 1日」の形の文字列でやりとりする（入力途中は「令和年 月 日」のように欠けた形になる）。
//   減価償却の年月日の欄はすべてこの部品を使う。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';

export const ERAS = ['令和', '平成', '昭和'] as const;
type Era = (typeof ERAS)[number];
/** 和暦の元年の西暦（元年＝この年＋1） */
const ERA_BASE: Record<Era, number> = { 令和: 2018, 平成: 1988, 昭和: 1925 };
/** 元号の始まり（この日から） */
const ERA_START: [Era, number][] = [['令和', Date.UTC(2019, 4, 1)], ['平成', Date.UTC(1989, 0, 8)], ['昭和', Date.UTC(1926, 11, 25)]];

export interface WarekiParts { era: Era; y: string; m: string; d: string }
export function parseWareki(v: string): WarekiParts {
  const m = /(昭和|平成|令和)?\s*(元|\d*)\s*年?\s*(\d*)\s*月?\s*(\d*)\s*日?/.exec(v ?? '');
  return { era: (m?.[1] as Era) || '令和', y: m?.[2] === '元' ? '1' : m?.[2] ?? '', m: m?.[3] ?? '', d: m?.[4] ?? '' };
}
export function formatWareki(p: WarekiParts): string {
  // 何も入れていないときは空。元号だけ変えたときは、その元号を残す
  if (!p.y && !p.m && !p.d && p.era === '令和') return '';
  return `${p.era}${p.y}年${p.m.padStart(2, ' ')}月${p.d.padStart(2, ' ')}日`;
}
/** 年・月・日がそろった正しい日付か */
export const isWarekiComplete = (v: string) => !!toDate(parseWareki(v));
const toDate = (p: WarekiParts): Date | null => {
  const y = Number(p.y), m = Number(p.m), d = Number(p.d);
  if (!y || !m || !d) return null;
  const dt = new Date(ERA_BASE[p.era] + y, m - 1, d);
  return dt.getMonth() === m - 1 ? dt : null;
};
const fromDate = (dt: Date): WarekiParts => {
  const t = Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const era = (ERA_START.find(([, s]) => t >= s)?.[0] ?? '昭和') as Era;
  return { era, y: String(dt.getFullYear() - ERA_BASE[era]), m: String(dt.getMonth() + 1), d: String(dt.getDate()) };
};

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

/** カレンダーから日付を選ぶ（和暦の年・月を選んで移動できる） */
function WarekiCalendar({ value, onPick, onClose, accent }: { value: WarekiParts; onPick: (p: WarekiParts) => void; onClose: () => void; accent: string }) {
  const init = toDate(value) ?? new Date();
  const [ym, setYm] = useState({ y: init.getFullYear(), m: init.getMonth() });
  const sel = toDate(value);
  const head = fromDate(new Date(ym.y, ym.m, 1));
  const first = new Date(ym.y, ym.m, 1).getDay();
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const shift = (n: number) => setYm((s) => { const d = new Date(s.y, s.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const today = new Date();
  const sel2: CSSProperties = { padding: '5px 6px', border: '1px solid #cfd8e0', borderRadius: 7, fontSize: 14, fontFamily: 'inherit', background: '#fff' };
  const nav: CSSProperties = { width: 32, height: 32, border: '1px solid #cfd8e0', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 16, color: '#48565f' };
  return (
    <Modal open onClose={onClose} width={360} title="日付を選ぶ">
      <div data-wareki-calendar style={{ padding: '10px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <button type="button" aria-label="前の月" onClick={() => shift(-1)} style={nav}>‹</button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 14 }}>
            <select aria-label="元号" value={head.era} onChange={(e) => { const era = e.target.value as Era; setYm((s) => ({ ...s, y: ERA_BASE[era] + 1 })); }} style={sel2}>{ERAS.map((e) => <option key={e}>{e}</option>)}</select>
            <select aria-label="年" value={head.y} onChange={(e) => setYm((s) => ({ ...s, y: ERA_BASE[head.era] + Number(e.target.value) }))} style={sel2}>
              {Array.from({ length: head.era === '昭和' ? 64 : head.era === '平成' ? 31 : today.getFullYear() - ERA_BASE.令和 + 3 }, (_, i) => i + 1).map((n) => <option key={n} value={String(n)}>{n === 1 ? '元' : n}</option>)}
            </select>年
            <select aria-label="月" value={ym.m} onChange={(e) => setYm((s) => ({ ...s, m: Number(e.target.value) }))} style={sel2}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}</select>月
          </div>
          <button type="button" aria-label="次の月" onClick={() => shift(1)} style={nav}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {WEEK.map((w, i) => <div key={w} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: i === 0 ? '#c0392b' : i === 6 ? '#2c5f9e' : '#8290a0', padding: '3px 0' }}>{w}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={'e' + i} />;
            const on = !!sel && sel.getFullYear() === ym.y && sel.getMonth() === ym.m && sel.getDate() === d;
            const isToday = today.getFullYear() === ym.y && today.getMonth() === ym.m && today.getDate() === d;
            const dow = i % 7;
            return (
              <button key={d} type="button" data-cal-day={d} onClick={() => { onPick(fromDate(new Date(ym.y, ym.m, d))); onClose(); }} style={{ height: 34, border: '1px solid ' + (on ? accent : isToday ? '#e6c36a' : '#eef2f5'), borderRadius: 7, background: on ? accent : isToday ? '#fffbea' : '#fff', color: on ? '#fff' : dow === 0 ? '#c0392b' : dow === 6 ? '#2c5f9e' : '#22303c', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{d}</button>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <button type="button" onClick={() => { onPick(fromDate(today)); onClose(); }} style={{ padding: '5px 12px', border: '1px solid #cfd8e0', borderRadius: 7, background: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', color: '#48565f' }}>今日</button>
          <button type="button" onClick={onClose} style={{ padding: '5px 12px', border: '1px solid #cfd8e0', borderRadius: 7, background: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', color: '#48565f' }}>閉じる</button>
        </div>
      </div>
    </Modal>
  );
}

/** 和暦の年月日の入力欄。Enter で次の欄へ進む画面では、元号・年・月・日がそれぞれ1つの欄として進む */
export function WarekiDate({ value, onChange, disabled, accent = '#1f7a52', tone, title, dataAttr }: { value: string; onChange: (v: string) => void; disabled?: boolean; accent?: string; /** 'start'＝償却開始年月日（黄色の枠） */ tone?: 'start'; title?: string; /** 識別用の data 属性名（例：data-dep-start） */ dataAttr?: string }) {
  const p = parseWareki(value);
  const [cal, setCal] = useState(false);
  const set = (patch: Partial<WarekiParts>) => onChange(formatWareki({ ...p, ...patch }));
  const digits = (s: string, n: number) => s.replace(/[^0-9]/g, '').slice(0, n);
  const bg = disabled ? '#f5f7f9' : tone === 'start' ? '#fffbea' : '#fff';
  const bd = tone === 'start' ? '#e6c36a' : '#cfd8e0';
  const box: CSSProperties = { boxSizing: 'border-box', height: 31, padding: '4px 5px', border: '1px solid ' + bd, borderRadius: 7, fontSize: 14, fontFamily: 'inherit', background: bg, color: '#22303c', outline: 'none', fontVariantNumeric: 'tabular-nums' };
  const num = (w: number): CSSProperties => ({ ...box, width: w, textAlign: 'right' });
  const unit: CSSProperties = { fontSize: 13, color: disabled ? '#b3bcc5' : '#48565f', flex: 'none' };
  const attrs = dataAttr ? { [dataAttr]: '' } : {};
  return (
    // 幅が足りないとき（固定資産の登録で一覧パネルを開いたときなど）は、年の後ろで改行する
    <span data-wareki {...attrs} title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px 3px', flexWrap: 'wrap', maxWidth: '100%' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flex: 'none' }}>
      <select aria-label="元号" value={p.era} disabled={disabled} onChange={(e) => set({ era: e.target.value as Era })} style={{ ...box, width: 62, padding: '4px 2px' }}>{ERAS.map((e) => <option key={e}>{e}</option>)}</select>
      <input className="field-input" aria-label="年" value={p.y} disabled={disabled} onChange={(e) => set({ y: digits(e.target.value, 2) })} inputMode="numeric" style={num(34)} /><span style={unit}>年</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flex: 'none' }}>
      <input className="field-input" aria-label="月" value={p.m.trim()} disabled={disabled} onChange={(e) => set({ m: digits(e.target.value, 2) })} inputMode="numeric" style={num(30)} /><span style={unit}>月</span>
      <input className="field-input" aria-label="日" value={p.d.trim()} disabled={disabled} onChange={(e) => set({ d: digits(e.target.value, 2) })} inputMode="numeric" style={num(30)} /><span style={unit}>日</span>
      <button type="button" aria-label="カレンダーから選ぶ" title="カレンダーから選ぶ" data-wareki-cal disabled={disabled} onClick={() => setCal(true)} style={{ ...box, width: 30, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? '#b3bcc5' : accent, background: disabled ? '#f5f7f9' : '#fff', borderColor: '#cfd8e0', flex: 'none' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
      </button>
      </span>
      {cal && <WarekiCalendar value={p} accent={accent} onClose={() => setCal(false)} onPick={(np) => onChange(formatWareki(np))} />}
    </span>
  );
}
