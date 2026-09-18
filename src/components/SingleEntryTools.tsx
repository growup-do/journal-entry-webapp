// 単一入力の機能ボタン（既存 F4 科目別残／F5 現預金残／F8 カレンダ）の中身。
//   科目別残高 … 表示月の科目ごとの 前月繰越／当月借方／当月貸方／残高（入力中の科目を先頭に）
//   現預金残高 … 現金・預金科目の当月入出金と残高、選んだ科目の日別推移
//   カレンダー … 入力月のカレンダー。日ごとの伝票件数・金額を表示し、クリックで入力行の「日」に反映
// ※ 既存システムのマニュアルにはこの3ボタンの詳細説明がないため、挙動は推定（_社内資料/要確認 参照）。

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { btn, input, lbl, yen } from './ui';
import { ACCOUNT_META, accountMatches, metaOf } from '../lib/accounts';
import type { JournalEntry } from '../types';

/** 会計年度内の月順（4〜3） */
const ORDER: string[] = ['4', '5', '6', '7', '8', '9', '10', '11', '12', '1', '2', '3'];
const monthIdx = (m: string) => ORDER.indexOf(m);
const monthOf = (e: JournalEntry) => e.date.split('/')[0] ?? '';
const dayOf = (e: JournalEntry) => parseInt(e.date.split('/')[1] ?? '0', 10);

/** 期首残高（貸借科目のサンプル値。損益科目は 0 から積み上げる） */
const OPENING: Record<string, number> = {
  '普通預金（保育園）': 9_630_000, '当座預金（保育園）': 155_800, '普通預金（本部）': 14_800, 小口現金: 26_500, 現金: 38_000,
  事業未収金: 1_200_000, 立替金: 12_000,
};
/** 借方残の科目か（資産・現預金・費用）。負債・収益は貸方残 */
const debitSide = (name: string) => { const c = metaOf(name)?.cls ?? '費用'; return c !== '負債' && c !== '収益'; };

interface Bal { name: string; cls: string; carry: number; kari: number; kashi: number; balance: number }
function balancesOf(entries: JournalEntry[], month: string): Bal[] {
  const mi = monthIdx(month);
  return ACCOUNT_META.map((a) => {
    let carry = OPENING[a.name] ?? 0;
    let kari = 0, kashi = 0;
    entries.forEach((e) => {
      const ei = monthIdx(monthOf(e));
      if (ei < 0) return;
      if (ei < mi) { if (e.kari === a.name) carry += debitSide(a.name) ? e.amount : -e.amount; if (e.kashi === a.name) carry += debitSide(a.name) ? -e.amount : e.amount; }
      if (ei === mi) { if (e.kari === a.name) kari += e.amount; if (e.kashi === a.name) kashi += e.amount; }
    });
    const balance = carry + (debitSide(a.name) ? kari - kashi : kashi - kari);
    return { name: a.name, cls: a.cls, carry, kari, kashi, balance };
  });
}

const TH: CSSProperties = { padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#8290a0', background: '#f6f8fa', borderBottom: '1px solid #e2e8ee', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0 };
const TD: CSSProperties = { padding: '7px 10px', fontSize: 12.5, borderBottom: '1px solid #f1f4f6', whiteSpace: 'nowrap' };
const NUM: CSSProperties = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const CLS_COLOR: Record<string, string> = { 現預金: '#2c5f9e', 資産: '#1f7a52', 負債: '#b45309', 費用: '#b0426a', 収益: '#6b3fb5' };

/* ---------------- 科目別残高 ---------------- */
export function AccountBalanceModal({ open, onClose, accent, entries, month, focus }: { open: boolean; onClose: () => void; accent: string; entries: JournalEntry[]; month: string; focus: string[] }) {
  const [q, setQ] = useState('');
  const [movedOnly, setMovedOnly] = useState(true);
  const rows = useMemo(() => balancesOf(entries, month), [entries, month]);
  const focused = focus.filter(Boolean);
  const list = rows
    .filter((r) => (!movedOnly || r.kari || r.kashi || focused.includes(r.name)) && (!q || accountMatches(r.name, q)))
    .sort((a, b) => Number(focused.includes(b.name)) - Number(focused.includes(a.name)));
  const t = list.reduce((a, r) => ({ kari: a.kari + r.kari, kashi: a.kashi + r.kashi }), { kari: 0, kashi: 0 });
  return (
    <Modal open={open} onClose={onClose} width={860} title={<>科目別残高 <span style={{ fontSize: 12, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>令和8年度 {month}月</span></>}>
      <div style={{ padding: '12px 22px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="科目名・コード・カナで絞り込み" autoComplete="off" style={{ ...input, width: 260 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#48565f' }}><input type="checkbox" checked={movedOnly} onChange={(e) => setMovedOnly(e.target.checked)} />当月に動きのある科目のみ</label>
          {focused.length > 0 && <span style={{ fontSize: 11.5, color: '#7a8794' }}>入力中の科目（<b style={{ color: accent }}>{focused.join('・')}</b>）を先頭に表示</span>}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7a8794' }}><b style={{ color: '#22303c' }}>{list.length}</b> 科目</span>
        </div>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'auto', maxHeight: 420 }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead><tr><th style={TH}>勘定科目</th><th style={{ ...TH, width: 60 }}>区分</th><th style={{ ...TH, textAlign: 'right' }}>前月繰越</th><th style={{ ...TH, textAlign: 'right' }}>当月借方</th><th style={{ ...TH, textAlign: 'right' }}>当月貸方</th><th style={{ ...TH, textAlign: 'right' }}>当月残高</th></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 30 }}>該当する科目がありません。</td></tr>}
              {list.map((r) => {
                const on = focused.includes(r.name);
                return (
                  <tr key={r.name} style={{ background: on ? accent + '14' : 'transparent' }}>
                    <td style={{ ...TD, fontWeight: on ? 700 : 500 }}>{on && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: accent, marginRight: 8, verticalAlign: 'middle' }} />}{r.name}<span style={{ fontSize: 10.5, color: '#9aa5b1', marginLeft: 6 }}>{metaOf(r.name)?.code}</span></td>
                    <td style={TD}><span style={{ fontSize: 10.5, fontWeight: 700, color: CLS_COLOR[r.cls] ?? '#5b6773' }}>{r.cls}</span></td>
                    <td style={{ ...NUM, color: '#7a8794' }}>{yen(r.carry)}</td>
                    <td style={NUM}>{r.kari ? yen(r.kari) : <span style={{ color: '#c3ccd4' }}>—</span>}</td>
                    <td style={NUM}>{r.kashi ? yen(r.kashi) : <span style={{ color: '#c3ccd4' }}>—</span>}</td>
                    <td style={{ ...NUM, fontWeight: 700, color: r.balance < 0 ? '#c0392b' : '#22303c' }}>{yen(r.balance)}</td>
                  </tr>
                );
              })}
            </tbody>
            {list.length > 0 && <tfoot><tr><td colSpan={3} style={{ ...TD, fontWeight: 700, background: '#f6f8fa', borderTop: '1px solid #e2e8ee' }}>合計（表示中の科目）</td><td style={{ ...NUM, fontWeight: 700, background: '#f6f8fa', borderTop: '1px solid #e2e8ee' }}>{yen(t.kari)}</td><td style={{ ...NUM, fontWeight: 700, background: '#f6f8fa', borderTop: '1px solid #e2e8ee' }}>{yen(t.kashi)}</td><td style={{ ...TD, background: '#f6f8fa', borderTop: '1px solid #e2e8ee' }} /></tr></tfoot>}
          </table>
        </div>
        <div style={{ fontSize: 11.5, color: '#9aa5b1', marginTop: 8 }}>残高は 貸借科目＝期首残高＋当月までの増減、損益科目＝当年度の累計（借方残／貸方残）。期首残高はサンプル値です。</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><button type="button" onClick={onClose} style={btn(accent, true)}>閉じる</button></div>
      </div>
    </Modal>
  );
}

/* ---------------- 現預金残高 ---------------- */
export function CashBalanceModal({ open, onClose, accent, entries, month, focus }: { open: boolean; onClose: () => void; accent: string; entries: JournalEntry[]; month: string; focus: string[] }) {
  const rows = useMemo(() => balancesOf(entries, month).filter((r) => r.cls === '現預金'), [entries, month]);
  const initial = focus.find((f) => rows.some((r) => r.name === f)) ?? rows.find((r) => r.kari || r.kashi)?.name ?? rows[0]?.name ?? '';
  const [sel, setSel] = useState(initial);
  const cur = rows.find((r) => r.name === sel) ?? rows[0];
  const daily = useMemo(() => {
    if (!cur) return [];
    const byDay = new Map<number, { in: number; out: number; n: number }>();
    entries.filter((e) => monthOf(e) === month && (e.kari === cur.name || e.kashi === cur.name)).forEach((e) => {
      const d = dayOf(e);
      const b = byDay.get(d) ?? { in: 0, out: 0, n: 0 };
      if (e.kari === cur.name) b.in += e.amount;
      if (e.kashi === cur.name) b.out += e.amount;
      b.n += 1;
      byDay.set(d, b);
    });
    let run = cur.carry;
    return [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([d, b]) => { run += b.in - b.out; return { day: d, ...b, balance: run }; });
  }, [entries, month, cur]);
  const total = rows.reduce((a, r) => a + r.balance, 0);
  return (
    <Modal open={open} onClose={onClose} width={900} title={<>現預金残高 <span style={{ fontSize: 12, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>令和8年度 {month}月</span></>}>
      <div style={{ padding: '12px 22px 18px', display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(360px, 1.2fr)', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}><span style={lbl}>現金・預金の残高</span><span style={{ marginLeft: 'auto', fontSize: 12, color: '#7a8794' }}>合計 <b style={{ color: '#22303c', fontVariantNumeric: 'tabular-nums' }}>{yen(total)}</b> 円</span></div>
          <div style={{ display: 'grid', gap: 8 }}>
            {rows.map((r) => {
              const on = cur?.name === r.name;
              return (
                <button key={r.name} type="button" onClick={() => setSel(r.name)} style={{ textAlign: 'left', border: '1px solid ' + (on ? accent : '#e2e8ee'), background: on ? accent + '0f' : '#fff', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit', color: '#22303c' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</span><span style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: r.balance < 0 ? '#c0392b' : '#22303c' }}>{yen(r.balance)}</span></div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#7a8794', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}><span>前月繰越 {yen(r.carry)}</span><span style={{ color: '#2c5f9e' }}>入金 {yen(r.kari)}</span><span style={{ color: '#b0426a' }}>出金 {yen(r.kashi)}</span></div>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <span style={lbl}>{cur?.name ?? '—'} の日別推移（{month}月）</span>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'auto', maxHeight: 380 }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead><tr><th style={{ ...TH, width: 56 }}>日</th><th style={{ ...TH, width: 50 }}>件数</th><th style={{ ...TH, textAlign: 'right' }}>入金</th><th style={{ ...TH, textAlign: 'right' }}>出金</th><th style={{ ...TH, textAlign: 'right' }}>残高</th></tr></thead>
              <tbody>
                <tr><td style={{ ...TD, color: '#7a8794' }} colSpan={4}>前月繰越</td><td style={{ ...NUM, color: '#7a8794' }}>{yen(cur?.carry ?? 0)}</td></tr>
                {daily.length === 0 && <tr><td colSpan={5} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 24 }}>当月の入出金はありません。</td></tr>}
                {daily.map((d) => (
                  <tr key={d.day}><td style={TD}>{month}/{d.day}</td><td style={{ ...TD, color: '#7a8794' }}>{d.n}</td><td style={{ ...NUM, color: '#2c5f9e' }}>{d.in ? yen(d.in) : ''}</td><td style={{ ...NUM, color: '#b0426a' }}>{d.out ? yen(d.out) : ''}</td><td style={{ ...NUM, fontWeight: 700, color: d.balance < 0 ? '#c0392b' : '#22303c' }}>{yen(d.balance)}</td></tr>
                ))}
              </tbody>
              {cur && <tfoot><tr><td colSpan={2} style={{ ...TD, fontWeight: 700, background: '#f6f8fa', borderTop: '1px solid #e2e8ee' }}>当月合計</td><td style={{ ...NUM, fontWeight: 700, background: '#f6f8fa', borderTop: '1px solid #e2e8ee', color: '#2c5f9e' }}>{yen(cur.kari)}</td><td style={{ ...NUM, fontWeight: 700, background: '#f6f8fa', borderTop: '1px solid #e2e8ee', color: '#b0426a' }}>{yen(cur.kashi)}</td><td style={{ ...NUM, fontWeight: 800, background: '#f6f8fa', borderTop: '1px solid #e2e8ee' }}>{yen(cur.balance)}</td></tr></tfoot>}
            </table>
          </div>
          <div style={{ fontSize: 11.5, color: '#9aa5b1', marginTop: 8 }}>通帳残高との突合は「残高照合」で行います。ここは入力中の伝票を含めた帳簿上の残高です。</div>
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={onClose} style={btn(accent, true)}>閉じる</button></div>
      </div>
    </Modal>
  );
}

/* ---------------- カレンダー ---------------- */
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
/** 令和8年度（2026/4〜2027/3）の祝日（年/月/日）※固定テーブル */
const HOLIDAYS = new Set(['2026/4/29', '2026/5/3', '2026/5/4', '2026/5/5', '2026/5/6', '2026/7/20', '2026/8/11', '2026/9/21', '2026/9/22', '2026/9/23', '2026/10/12', '2026/11/3', '2026/11/23', '2027/1/1', '2027/1/11', '2027/2/11', '2027/2/23', '2027/3/22']);
export const yearOfMonth = (m: string) => (parseInt(m, 10) >= 4 ? 2026 : 2027);

export function CalendarModal({ open, onClose, accent, entries, month, day, onPick }: { open: boolean; onClose: () => void; accent: string; entries: JournalEntry[]; month: string; day: string; onPick: (month: string, day: string) => void }) {
  const [view, setView] = useState(month || '8');
  const y = yearOfMonth(view);
  const m = parseInt(view, 10);
  const first = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const per = useMemo(() => {
    const map = new Map<number, { n: number; amt: number }>();
    entries.filter((e) => monthOf(e) === view).forEach((e) => { const d = dayOf(e); const b = map.get(d) ?? { n: 0, amt: 0 }; b.n += 1; b.amt += e.amount; map.set(d, b); });
    return map;
  }, [entries, view]);
  const vi = monthIdx(view);
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const isSel = (d: number) => view === month && String(d) === day;
  const monthTotal = [...per.values()].reduce((a, b) => ({ n: a.n + b.n, amt: a.amt + b.amt }), { n: 0, amt: 0 });
  return (
    <Modal open={open} onClose={onClose} width={640} title="カレンダー">
      <div style={{ padding: '12px 22px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button type="button" className="btn-outline" disabled={vi <= 0} onClick={() => setView(ORDER[vi - 1])} style={{ ...btn(), opacity: vi <= 0 ? 0.4 : 1 }}>‹ 前月</button>
          <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 17, flex: 1, textAlign: 'center' }}>令和{y - 2018}年 {m}月 <span style={{ fontSize: 11.5, fontWeight: 500, color: '#7a8794' }}>（{y}年）</span></div>
          <button type="button" className="btn-outline" disabled={vi >= ORDER.length - 1} onClick={() => setView(ORDER[vi + 1])} style={{ ...btn(), opacity: vi >= ORDER.length - 1 ? 0.4 : 1 }}>翌月 ›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {WEEK.map((w, i) => <div key={w} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: i === 0 ? '#c0392b' : i === 6 ? '#2c5f9e' : '#8290a0', padding: '4px 0' }}>{w}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={'e' + i} />;
            const dow = i % 7;
            const hol = HOLIDAYS.has(`${y}/${m}/${d}`);
            const info = per.get(d);
            const on = isSel(d);
            return (
              <button key={d} type="button" onClick={() => { onPick(view, String(d)); onClose(); }} title={`${m}/${d} を入力行の日付にする`} style={{ minHeight: 58, padding: '5px 6px', textAlign: 'left', border: '1px solid ' + (on ? accent : '#e2e8ee'), background: on ? accent + '14' : hol || dow === 0 ? '#fff7f5' : dow === 6 ? '#f5f8fc' : '#fff', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: hol || dow === 0 ? '#c0392b' : dow === 6 ? '#2c5f9e' : '#22303c' }}>{d}{hol && <span style={{ fontSize: 9.5, fontWeight: 600, marginLeft: 4 }}>祝</span>}</span>
                {info && <><span style={{ fontSize: 10.5, color: accent, fontWeight: 700 }}>{info.n}件</span><span style={{ fontSize: 10, color: '#7a8794', fontVariantNumeric: 'tabular-nums' }}>{yen(info.amt)}</span></>}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, fontSize: 11.5, color: '#7a8794' }}>
          <span>当月 <b style={{ color: '#22303c' }}>{monthTotal.n}</b> 件　<b style={{ color: '#22303c', fontVariantNumeric: 'tabular-nums' }}>{yen(monthTotal.amt)}</b> 円</span>
          <span style={{ marginLeft: 'auto' }}>日をクリックすると入力行の「月／日」に反映します</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><button type="button" onClick={onClose} style={btn()}>閉じる</button></div>
      </div>
    </Modal>
  );
}
