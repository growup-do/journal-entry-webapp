// 仕訳の訂正モード・詳細検索・行の証憑／チェック／付箋（提案F）
//   仕訳一覧／元帳／参照パネルの行 → 伝票を訂正モードで開く。同じ伝票（伝票No・年月日が同じ）の行をまとめて表示し、
//   行の追加・挿入・削除・並べ替えを含めて同時に編集して登録する（依頼書 5.3.1）。
//   伝票訂正・伝票削除の対象を選ぶ一覧（VoucherPickerModal）と、削除の確認（DeleteVoucherModal。依頼書 6.4）もここに置く。
//   詳細検索は既存【検索条件】の14条件。

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { Field, Notice, btn, input, numInput, toInt, yen } from './ui';
import { ActButton, ActDivider, ComboField, EntryStyles, FieldLabel, FlagButtons, FundAccountLine, IssueList, ReadOnlyBanner, fieldState, fmtNum, focusId, hasError, hasWarn, judgeEntry, needsPartner, onEnter, partnerOf, scopeStyle, setPartner, toNum, useShortcuts, type Issue } from './EntryCommon';
import { SERVICES } from '../data';
import { FUSEN_COLORS, FUSEN_CYCLE, addVoucher, cycleFusen, deleteVoucher, getVouchers, moveVoucher, updateVoucher, useVouchers, type Fusen, type Voucher } from '../store/journalStore';
import { judgeTorihiki, TORIHIKI_COLOR } from '../lib/accounts';
import { canEdit, canReorder, editBlockReason, fusenLabel, useSession, isViewOnly } from '../store/session';
import type { MonthFilter } from '../types';

const BLUE = '#2c5f9e';
const PINK = '#b0426a';

/** 仕訳の種別 → 伝票の形式名 */
export const KIND_FORMAT: Record<Voucher['kind'], string> = { 伝票: '仕訳伝票形式', 特摘: '仕訳伝票形式（特殊摘要科目）', 単一: '単一形式', 振替: '振替伝票形式', 振単: '振替単一形式' };

/** 同じ伝票（伝票No と年月日が同じ）の行をまとめる */
export interface VoucherGroup { key: string; head: Voucher; rows: Voucher[]; total: number }
export const sameVoucher = (a: Voucher, b: Voucher) => a.no === b.no && a.date === b.date;
export function groupVouchers(list: Voucher[]): VoucherGroup[] {
  const map = new Map<string, VoucherGroup>();
  list.forEach((r) => {
    const key = r.date + '|' + r.no;
    const g = map.get(key);
    if (g) { g.rows.push(r); g.total += r.amount; } else map.set(key, { key, head: r, rows: [r], total: r.amount });
  });
  return [...map.values()];
}

/* ---------------- 行のフラグ（証憑・チェック・付箋） ---------------- */
export function FlagCell({ v, compact }: { v: Voucher; compact?: boolean }) {
  const s = useSession();
  const ok = canEdit(s);
  const why = ok ? '' : `（${editBlockReason(s)}）`;
  const dot: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: compact ? 20 : 24, height: compact ? 20 : 24, borderRadius: 6, border: '1px solid #dde4ea', background: '#fff', cursor: ok ? 'pointer' : 'not-allowed', fontSize: 10.5, fontWeight: 800, opacity: ok ? 1 : 0.7 };
  return (
    <div style={{ display: 'inline-flex', gap: 3 }} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <span title={ok ? '証憑 有／無（クリックで切替）' : '証憑 ' + (v.shohyo ? '有' : '無') + why} onClick={() => ok && updateVoucher(v.id, { shohyo: !v.shohyo })} style={{ ...dot, background: v.shohyo ? '#eaf5ef' : '#fff', color: v.shohyo ? '#1f7a52' : '#b3bcc5' }}>{v.shohyo ? '有' : '無'}</span>
      <span title={ok ? 'チェック（クリックで切替）' : 'チェック' + why} onClick={() => ok && updateVoucher(v.id, { check: !v.check })} style={{ ...dot, background: v.check ? '#22303c' : '#fff', color: v.check ? '#fff' : '#b3bcc5' }}>✓</span>
      <span title={ok ? `付箋：${fusenLabel(v.fusen)}（クリックで 赤→青→黄→緑→なし）` : `付箋：${fusenLabel(v.fusen)}${why}`} onClick={() => ok && cycleFusen(v.id)} style={{ ...dot, background: v.fusen ? FUSEN_COLORS[v.fusen] : '#fff', color: v.fusen ? '#fff' : '#b3bcc5' }}>■</span>
    </div>
  );
}

/* ---------------- 伝票削除の確認（依頼書 6.4） ---------------- */
export function DeleteVoucherModal({ rows, onClose, onDeleted, multi }: { rows: Voucher[] | null; onClose: () => void; onDeleted?: () => void; /** 一覧で複数行を選んで削除するとき（伝票単位ではなく行単位の案内にする） */ multi?: boolean }) {
  const s = useSession();
  const ok = canEdit(s);
  if (!rows || rows.length === 0) return null;
  const h = rows[0];
  const total = rows.reduce((a, r) => a + r.amount, 0);
  return (
    <Modal open onClose={onClose} width={multi ? 760 : 620} title={multi ? '選択した仕訳の削除' : '伝票削除の確認'} strict>
      <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span aria-hidden style={{ width: 40, height: 40, borderRadius: '50%', background: '#fdeee9', color: '#c0392b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, flex: 'none' }}>!</span>
          <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>
            {multi ? `選択した ${rows.length} 行の仕訳を削除します。` : '次の伝票を削除します。'}<b style={{ color: '#c0392b' }}>削除した{multi ? '仕訳' : '伝票'}は元に戻せません。</b><br />
            この伝票に付随する明細データ（決算附属明細書）や固定資産（減価償却）がある場合は、あわせて削除されます。
          </div>
        </div>
        <div style={{ border: '1px solid #f0cfc9', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', background: '#fff5f3', fontSize: 12.5, fontWeight: 700, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {multi ? <><span>選択 {rows.length} 行</span><span>伝票 {new Set(rows.map((r) => r.no)).size} 枚</span><span>{rows[0].date} 〜 {rows[rows.length - 1].date}</span></> : <><span>伝票No {h.no}</span><span>令和8年 {h.date.replace('/', '月')}日</span><span>{KIND_FORMAT[h.kind]}</span></>}<span style={{ marginLeft: 'auto' }}>{rows.length} 行　合計 {yen(total)} 円</span>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {rows.map((r, i) => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: multi ? '84px minmax(0,1fr)' : '28px minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr) 100px', gap: 8, padding: '7px 12px', borderTop: '1px solid #f6e3df', fontSize: 12.5, alignItems: 'center' }}>
                <span style={{ color: '#9aa5b1', fontSize: multi ? 11 : 12.5 }}>{multi ? `${r.date} ${r.seq}` : i + 1}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.kari}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.kashi}</span>
                <span style={{ color: '#7a8794', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.tekiyo}</span>
                <span style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{yen(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
        {!ok && <Notice tone="warn">{editBlockReason(s)}</Notice>}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <button type="button" className="ef-act" autoFocus onClick={onClose} style={btn()}>削除しないで戻る</button>
          <button type="button" className="ef-act" disabled={!ok} title={ok ? undefined : editBlockReason(s)} onClick={() => { rows.forEach((r) => { deleteVoucher(r.id); setPartner(r.id, ''); }); onDeleted?.(); onClose(); }} style={btn('#c0392b', true)}>{multi ? `選択した ${rows.length} 行を削除する` : `この伝票を削除する（${rows.length} 行）`}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- 伝票訂正・伝票削除の対象を選ぶ ---------------- */
export function VoucherPickerModal({ open, mode, onClose, onPick, accent }: { open: boolean; mode: '訂正' | '削除'; onClose: () => void; onPick: (group: VoucherGroup) => void; accent: string }) {
  const all = useVouchers();
  const [month, setMonth] = useState<MonthFilter>(null);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const groups = useMemo(() => {
    const kw = q.trim();
    return groupVouchers(all)
      .filter((g) => (month == null || g.head.date.split('/')[0] === month) && (!kw || g.head.no.includes(kw) || g.head.date.includes(kw) || String(g.total).includes(kw.replace(/,/g, '')) || g.rows.some((r) => [r.kari, r.kashi, r.tekiyo, r.gyosha ?? '', String(r.amount)].some((x) => x.includes(kw)))))
      .reverse();
  }, [all, month, q]);
  if (!open) return null;
  const cur = Math.min(hi, Math.max(0, groups.length - 1));
  const danger = mode === '削除';
  return (
    <Modal open onClose={onClose} width={860} title={<>{danger ? '伝票削除' : '伝票訂正'} <span style={{ fontSize: 12, color: '#7a8794', fontWeight: 500, marginLeft: 8 }}>登録済みの伝票から選びます</span></>}>
      <div className="ef-scope" style={{ ...scopeStyle(danger ? '#c0392b' : accent), padding: '12px 22px 18px', display: 'grid', gap: 10 }}>
        <EntryStyles />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <input
            className="ef-input"
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setHi(0); }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
              if (e.key === 'ArrowDown') { e.preventDefault(); setHi(Math.min(cur + 1, groups.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setHi(Math.max(cur - 1, 0)); }
              if (e.key === 'Enter' && groups[cur]) { e.preventDefault(); onPick(groups[cur]); }
            }}
            placeholder="伝票No・科目・摘要・業者・金額で絞り込み"
            autoComplete="off"
            style={{ ...input, width: 300 }}
          />
          <FiscalMonthTabs current={month} accent={accent} onSelect={(m) => { setMonth(m); setHi(0); }} withAll />
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7a8794' }}><b style={{ color: '#22303c' }}>{groups.length}</b> 伝票</span>
        </div>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '62px 76px 44px minmax(0,1fr) minmax(0,1fr) minmax(0,1.3fr) 110px', gap: 8, padding: '8px 12px', background: '#f6f8fa', fontSize: 10.5, fontWeight: 700, color: '#8290a0' }}>
            <div>月日</div><div>伝票No</div><div>行数</div><div>借方科目</div><div>貸方科目</div><div>摘要</div><div style={{ textAlign: 'right' }}>合計金額</div>
          </div>
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {groups.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#9aa5b1', fontSize: 12.5 }}>該当する伝票がありません。</div>}
            {groups.map((g, i) => {
              const on = i === cur;
              const multi = g.rows.length > 1;
              const kari = new Set(g.rows.map((r) => r.kari)), kashi = new Set(g.rows.map((r) => r.kashi));
              return (
                <div key={g.key} className="ef-pickrow" onMouseEnter={() => setHi(i)} onClick={() => onPick(g)} style={{ display: 'grid', gridTemplateColumns: '62px 76px 44px minmax(0,1fr) minmax(0,1fr) minmax(0,1.3fr) 110px', gap: 8, padding: '8px 12px', borderTop: '1px solid #f1f4f6', fontSize: 12.5, alignItems: 'center', background: on ? (danger ? '#fdeee9' : accent + '14') : 'transparent', boxShadow: on ? `inset 4px 0 0 ${danger ? '#c0392b' : accent}` : 'none' }}>
                  <div style={{ color: '#5b6773' }}>{g.head.date}</div>
                  <div style={{ fontVariantNumeric: 'tabular-nums' }}>{g.head.no}</div>
                  <div><span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 8, background: multi ? '#e8f0fb' : '#f1f4f6', color: multi ? '#2c5f9e' : '#7a8794' }}>{g.rows.length}行</span></div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{g.head.kari}{kari.size > 1 ? ` ほか${kari.size - 1}` : ''}</div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.head.kashi}{kashi.size > 1 ? ` ほか${kashi.size - 1}` : ''}</div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#7a8794' }}>{g.rows.map((r) => r.tekiyo).filter(Boolean).join('／')}</div>
                  <div style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{yen(g.total)}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11.5, color: '#7a8794' }}>↑↓ で選び Enter で{danger ? '削除の確認へ進みます（この時点では削除されません）' : '訂正画面を開きます'}。Esc で閉じます。</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="ef-act" onClick={onClose} style={btn()}>閉じる</button>
            <button type="button" className="ef-act" disabled={!groups[cur]} onClick={() => groups[cur] && onPick(groups[cur])} style={{ ...btn(danger ? '#c0392b' : accent, true), opacity: groups[cur] ? 1 : 0.5 }}>{danger ? '選んだ伝票の削除確認へ' : '選んだ伝票を訂正'}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- 伝票の訂正モード（同じ伝票の行を同時に編集） ---------------- */
interface EditRow { key: string; id: number | null; kari: string; kashi: string; tekiyo: string; gyosha: string; amount: string; shohyo: boolean; check: boolean; fusen: Fusen }
interface EditState { base: Voucher; ids: number[]; shared: boolean; multi: boolean; service: string; month: string; day: string; no: string; kari: string; kashi: string; aite: string; internal: boolean; cheque: string; spare1: string; spare2: string; rows: EditRow[] }
let rowKey = 0;
const newRow = (p?: Partial<EditRow>): EditRow => ({ key: 'n' + rowKey++, id: null, kari: '', kashi: '', tekiyo: '', gyosha: '', amount: '', shohyo: true, check: false, fusen: '', ...p });

/** 同じ伝票の行を、指定した順に共有ストア上で並べ替える（同一日の中の入換だけを使う） */
function applyOrder(ids: number[]) {
  for (let guard = 0; guard < 400; guard++) {
    const cur = getVouchers().filter((r) => ids.includes(r.id)).map((r) => r.id);
    const i = cur.findIndex((id, k) => id !== ids[k]);
    if (i < 0) break;
    if (!moveVoucher(ids[i], -1)) break;
  }
  // 追加した行が離れた位置にあるときは、直前の行のすぐ下まで寄せる
  for (let k = 1; k < ids.length; k++) {
    for (let guard = 0; guard < 400; guard++) {
      const list = getVouchers();
      const a = list.findIndex((r) => r.id === ids[k - 1]), b = list.findIndex((r) => r.id === ids[k]);
      if (a < 0 || b < 0 || b <= a + 1) break;
      if (!moveVoucher(ids[k], -1)) break;
    }
  }
}

export function EditVoucherModal({ voucher, onClose, accent, returnTo }: { voucher: Voucher | null; onClose: () => void; accent: string; returnTo: string }) {
  const all = useVouchers();
  const sess = useSession();
  const editable = canEdit(sess);
  const reason = editBlockReason(sess);
  const [st, setSt] = useState<EditState | null>(null);
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [msg, setMsg] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const [rowErr, setRowErr] = useState<Record<string, string>>({});
  const [delOpen, setDelOpen] = useState(false);

  if (!voucher && loadedId !== null) { setLoadedId(null); setSt(null); }
  if (voucher && voucher.id !== loadedId) {
    const group = all.filter((r) => sameVoucher(r, voucher));
    const rows = group.length ? group : [voucher];
    const transfer = voucher.kind === '振替' || voucher.kind === '振単';
    const shared = !transfer && rows.every((r) => r.kari === rows[0].kari && r.kashi === rows[0].kashi);
    const [m, d] = voucher.date.split('/');
    setSt({
      base: rows[0], ids: rows.map((r) => r.id), shared, multi: voucher.kind !== '単一' && voucher.kind !== '振単',
      service: rows[0].service, month: m ?? '', day: d ?? '', no: rows[0].no, kari: rows[0].kari, kashi: rows[0].kashi,
      aite: partnerOf(rows[0].id), internal: !!rows[0].internal, cheque: rows[0].cheque ?? '', spare1: rows[0].spare1 ?? '', spare2: rows[0].spare2 ?? '',
      rows: rows.map((r) => ({ key: 'v' + r.id, id: r.id, kari: r.kari, kashi: r.kashi, tekiyo: r.tekiyo, gyosha: r.gyosha ?? '', amount: String(r.amount), shohyo: r.shohyo, check: r.check, fusen: r.fusen })),
    });
    setLoadedId(voucher.id);
    setActive(0);
    setMsg(null);
    setRowErr({});
    setDelOpen(false);
  }

  const set = (p: Partial<EditState>) => { setSt((s) => (s ? { ...s, ...p } : s)); setMsg(null); };
  const setRow = (i: number, p: Partial<EditRow>) => { setSt((s) => (s ? { ...s, rows: s.rows.map((r, k) => (k === i ? { ...r, ...p } : r)) } : s)); setRowErr({}); setMsg(null); };
  const rowsN = st?.rows.length ?? 0;
  const act = Math.min(active, Math.max(0, rowsN - 1));
  const firstField = (i: number) => (st?.shared ? `ed-r${i}-tekiyo` : `ed-r${i}-kari`);
  const addRow = (at: number) => {
    if (!st || !editable || !st.multi) return;
    const src = st.rows[Math.min(at, st.rows.length - 1)];
    const next = [...st.rows];
    next.splice(at, 0, newRow({ shohyo: src?.shohyo ?? true }));
    setSt({ ...st, rows: next });
    setActive(at);
    setRowErr({});
    focusId(firstField(at));
  };
  const delRow = (i: number) => {
    if (!st || !editable || !st.multi) return;
    if (st.rows.length <= 1) { setMsg({ tone: 'error', text: '最後の1行は削除できません。伝票ごと削除する場合は「伝票削除」を使ってください。' }); return; }
    setSt({ ...st, rows: st.rows.filter((_, k) => k !== i) });
    const n = Math.max(0, Math.min(i, st.rows.length - 2));
    setActive(n);
    setRowErr({});
    focusId(firstField(n));
  };
  const moveRow = (i: number, dir: -1 | 1) => {
    if (!st || !editable) return;
    const j = i + dir;
    if (j < 0 || j >= st.rows.length) return;
    const next = [...st.rows];
    [next[i], next[j]] = [next[j], next[i]];
    setSt({ ...st, rows: next });
    setActive(j);
  };
  const moveGroup = (dir: -1 | 1) => {
    if (!st) return;
    const ids = getVouchers().filter((r) => st.ids.includes(r.id)).map((r) => r.id);
    const seq = dir === -1 ? ids : [...ids].reverse();
    let ok = seq.length > 0;
    for (const id of seq) if (!moveVoucher(id, dir)) { ok = false; break; }
    setMsg(ok ? { tone: 'info', text: `伝票の表示順を${dir === -1 ? '上' : '下'}へ入れ替えました。` } : { tone: 'error', text: '表示順の入換は、同じ日の伝票の中でのみ行えます。' });
  };

  const pairIssues: Issue[] = st && st.shared ? judgeEntry({ kari: st.kari, kashi: st.kashi, fundMode: '自動資金', internal: st.internal, aite: st.aite, division: st.service, amount: 0 }, sess.env) : [];
  const issuesOfRow = (r: EditRow): Issue[] => (st && !st.shared ? judgeEntry({ kari: r.kari, kashi: r.kashi, fundMode: '自動資金', internal: st.internal, aite: st.aite, division: st.service, amount: 0 }, sess.env) : []);
  const allIssues = st ? (st.shared ? pairIssues : st.rows.flatMap(issuesOfRow)) : [];
  const total = st ? st.rows.reduce((a, r) => a + toNum(r.amount), 0) : 0;
  const partner = !!st && (st.shared ? needsPartner({ kari: st.kari, kashi: st.kashi, internal: st.internal }) : st.internal || st.rows.some((r) => needsPartner({ kari: r.kari, kashi: r.kashi })));

  const save = (confirmed: boolean) => {
    if (!st || !editable) return;
    if (!st.month || !st.day) { setMsg({ tone: 'error', text: '年月日を入力してください。' }); focusId('ed-month'); return; }
    if (!st.no.trim()) { setMsg({ tone: 'error', text: '伝票Noを入力してください。' }); focusId('ed-no'); return; }
    if (st.shared && (!st.kari || !st.kashi)) { setMsg({ tone: 'error', text: '借方科目・貸方科目を入力してください。' }); focusId(st.kari ? 'ed-kashi' : 'ed-kari'); return; }
    const re: Record<string, string> = {};
    st.rows.forEach((r) => {
      if (!st.shared && (!r.kari || !r.kashi)) re[r.key] = '借方科目・貸方科目を入力してください。';
      else if (!toNum(r.amount)) re[r.key] = '金額を入力してください。';
    });
    if (Object.keys(re).length) {
      setRowErr(re);
      const i = st.rows.findIndex((r) => re[r.key]);
      setMsg({ tone: 'error', text: `${i + 1}行目：${re[st.rows[i].key]}` });
      focusId(re[st.rows[i].key].startsWith('金額') ? `ed-r${i}-amount` : firstField(i));
      return;
    }
    if (hasError(allIssues)) { setMsg({ tone: 'error', text: '登録できない仕訳があります。赤い表示の内容を確認してください。' }); return; }
    if (hasWarn(allIssues) && !confirmed) { setMsg({ tone: 'info', text: '確認が必要な内容があります。黄色の表示を確認し、「確認して登録」を押してください。' }); focusId('ed-confirm'); return; }
    const date = `${st.month}/${st.day}`;
    const keep = st.rows.filter((r) => r.id != null).map((r) => r.id as number);
    st.ids.filter((id) => !keep.includes(id)).forEach((id) => { deleteVoucher(id); setPartner(id, ''); });
    const ids: number[] = [];
    st.rows.forEach((r) => {
      const body = { date, service: st.service, kari: st.shared ? st.kari : r.kari, kashi: st.shared ? st.kashi : r.kashi, tekiyo: r.tekiyo, gyosha: r.gyosha || undefined, amount: toNum(r.amount), shohyo: r.shohyo, cheque: st.cheque.trim() || undefined, spare1: st.spare1 || undefined, spare2: st.spare2 || undefined, internal: partner || undefined };
      if (r.id != null) { updateVoucher(r.id, { ...body, no: st.no.trim(), check: r.check, fusen: r.fusen }); ids.push(r.id); }
      else { const nv = addVoucher({ ...body, kind: st.base.kind, seq: st.base.seq, no: st.no.trim() }); updateVoucher(nv.id, { check: r.check, fusen: r.fusen }); ids.push(nv.id); }
    });
    applyOrder(ids);
    ids.forEach((id) => setPartner(id, partner ? st.aite : ''));
    onClose();
  };

  const canRow = editable && !!st?.multi;
  useShortcuts(
    [
      { key: 'S', label: '伝票登録（訂正を保存）', group: '伝票の操作', run: () => save(false), disabled: !editable },
      { key: 'X', label: '伝票削除', group: '伝票の操作', run: () => setDelOpen(true), disabled: !editable },
      { key: 'N', label: '行追加', group: '行の操作', run: () => addRow(rowsN), disabled: !canRow },
      { key: 'I', label: '行挿入', group: '行の操作', run: () => addRow(act), disabled: !canRow },
      { key: 'D', label: '行削除', group: '行の操作', run: () => delRow(act), disabled: !canRow },
      { key: 'C', label: 'チェック', group: '行の操作', run: () => st && setRow(act, { check: !st.rows[act].check }), disabled: !editable },
      { key: 'F', label: '付箋', group: '行の操作', run: () => st && setRow(act, { fusen: FUSEN_CYCLE[(FUSEN_CYCLE.indexOf(st.rows[act].fusen) + 1) % FUSEN_CYCLE.length] }), disabled: !editable },
      { key: 'V', label: '証憑', group: '行の操作', run: () => st && setRow(act, { shohyo: !st.rows[act].shohyo }), disabled: !editable },
    ],
    'modal',
    !!voucher && !!st && !delOpen,
  );

  if (!voucher || !st) return null;
  const j = judgeTorihiki(st.shared ? st.kari : st.rows[act]?.kari ?? '', st.shared ? st.kashi : st.rows[act]?.kashi ?? '');
  const c = TORIHIKI_COLOR[j.kind];
  const ro = !editable;
  const viewOnly = isViewOnly(sess);
  const cell: CSSProperties = { ...input, padding: '7px 9px', fontSize: 13 };
  const GRID = st.shared ? '34px minmax(0,1.5fr) minmax(0,1fr) 120px 84px 132px' : '34px minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,1.2fr) minmax(0,.9fr) 112px 84px 132px';
  const afterHead = () => focusId(st.shared ? 'ed-kari' : firstField(0));
  const rowNext = (i: number) => (i + 1 < st.rows.length ? focusId(firstField(i + 1)) : focusId('ed-save'));
  const smallBtn: CSSProperties = { ...btn('#5b6773', false, true), padding: '3px 7px' };
  return (
    <Modal open onClose={onClose} width={st.shared ? 920 : 1080} title={<>{ro ? '伝票の参照' : '伝票の訂正'} <span style={{ fontSize: 12, color: '#7a8794', fontWeight: 500, marginLeft: 8 }}>Seq {st.base.seq}　伝票No {st.base.no}</span><span style={{ marginLeft: 10, padding: '2px 9px', borderRadius: 8, background: accent, color: '#fff', fontSize: 11.5, fontWeight: 800 }}>{KIND_FORMAT[st.base.kind]}</span></>} strict>
      <div className="ef-scope" style={scopeStyle(accent)}>
        <EntryStyles />
        <ReadOnlyBanner reason={reason} />
        <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 10px', borderRadius: 8, background: c.bg, color: c.fg, fontSize: 12, fontWeight: 800 }}>{j.kind}{j.reason ? `（${j.reason}）` : ''}</span>
            <span style={{ fontSize: 12, color: '#7a8794' }}>{st.multi ? `この伝票の ${st.rows.length} 行をまとめて編集します。` : '1伝票1行の形式です。'}</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#8290a0', fontWeight: 700 }}>伝票の表示順（同じ日の中）</span>
              <button type="button" className="ef-act" disabled={!canReorder(sess)} title={canReorder(sess) ? '同じ日の伝票の中で、この伝票を1つ上へ' : reason} onClick={() => moveGroup(-1)} style={btn('#5b6773', false, true)}>▲ 上へ</button>
              <button type="button" className="ef-act" disabled={!canReorder(sess)} title={canReorder(sess) ? '同じ日の伝票の中で、この伝票を1つ下へ' : reason} onClick={() => moveGroup(1)} style={btn('#5b6773', false, true)}>▼ 下へ</button>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: 12 }}>
            <div className="ef-field"><FieldLabel>区分</FieldLabel><ComboField id="ed-service" kind="service" value={st.service} onChange={(v) => set({ service: v || st.service })} onCommit={() => focusId('ed-month')} disabled={ro} /></div>
            <div className="ef-field">
              <FieldLabel>年月日</FieldLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#5b6773' }}>
                <span>令和8年</span>
                <input id="ed-month" className="ef-input" disabled={ro} value={st.month} onChange={(e) => set({ month: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })} onKeyDown={onEnter(() => focusId('ed-day'))} inputMode="numeric" style={{ ...cell, width: 44, textAlign: 'center', padding: '7px 2px' }} />
                <span>月</span>
                <input id="ed-day" className="ef-input" disabled={ro} value={st.day} onChange={(e) => set({ day: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })} onKeyDown={onEnter(() => focusId('ed-no'))} inputMode="numeric" style={{ ...cell, width: 44, textAlign: 'center', padding: '7px 2px' }} />
                <span>日</span>
              </div>
            </div>
            <div className="ef-field"><FieldLabel>伝票No</FieldLabel><input id="ed-no" className="ef-input" disabled={ro} value={st.no} onChange={(e) => set({ no: e.target.value })} onKeyDown={onEnter(afterHead)} style={cell} /></div>
          </div>

          {st.shared && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="ef-field">
                <FieldLabel color={BLUE}>借方科目（伝票につき1組）</FieldLabel>
                <ComboField id="ed-kari" kind="account" value={st.kari} onChange={(v) => set({ kari: v })} onCommit={(v) => focusId(needsPartner({ kari: v, kashi: '', internal: st.internal }) ? 'ed-aite' : 'ed-kashi')} placeholder="コード・科目名・フリガナ" disabled={ro} invalid={fieldState(pairIssues, 'kari', 'pair')} listWidth={380} />
                <FundAccountLine name={st.kari} other={st.kashi} mode="自動資金" />
              </div>
              <div className="ef-field">
                <FieldLabel color={PINK}>貸方科目（伝票につき1組）</FieldLabel>
                <ComboField id="ed-kashi" kind="account" value={st.kashi} onChange={(v) => set({ kashi: v })} onCommit={(v) => focusId(!st.aite && needsPartner({ kari: st.kari, kashi: v, internal: st.internal }) ? 'ed-aite' : firstField(0))} placeholder="コード・科目名・フリガナ" disabled={ro} invalid={fieldState(pairIssues, 'kashi', 'pair')} listWidth={380} />
                <FundAccountLine name={st.kashi} other={st.kari} mode="自動資金" />
              </div>
            </div>
          )}
          {partner && (
            <div className="ef-field" style={{ maxWidth: 360 }}>
              <FieldLabel color="#b45309">内部取引相手区分（内部取引科目のため必要）</FieldLabel>
              <ComboField id="ed-aite" kind="service" value={st.aite} onChange={(v) => set({ aite: v })} onCommit={() => focusId(st.shared ? (st.kashi ? firstField(0) : 'ed-kashi') : firstField(0))} placeholder="相手先の区分" disabled={ro} invalid={fieldState(allIssues, 'aite')} />
            </div>
          )}
          {st.shared && <IssueList issues={pairIssues} onConfirm={ro ? undefined : () => save(true)} confirmId="ed-confirm" />}

          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderBottom: '1px solid #eef2f5', background: '#fbfcfd', borderRadius: '10px 10px 0 0', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: '#8290a0', letterSpacing: '.05em' }}>行の操作</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: accent }}>対象：{act + 1}行目</span>
              {!viewOnly && <><ActButton label="行追加" k="N" accent={accent} disabled={!canRow} title={!editable ? reason : !st.multi ? '1伝票1行の形式のため行は追加できません' : '最後に1行追加'} onClick={() => addRow(st.rows.length)} />
              <ActButton label="行挿入" k="I" accent={accent} disabled={!canRow} title={!editable ? reason : !st.multi ? '1伝票1行の形式のため行は挿入できません' : `${act + 1}行目の上に1行挿入`} onClick={() => addRow(act)} />
              <ActButton label="行削除" k="D" accent={accent} disabled={!canRow} title={!editable ? reason : !st.multi ? '1伝票1行の形式のため行は削除できません' : `${act + 1}行目を削除`} onClick={() => delRow(act)} />
              <ActButton label="チェック" k="C" accent={accent} disabled={ro} title={ro ? reason : undefined} active={st.rows[act]?.check} onClick={() => setRow(act, { check: !st.rows[act].check })} />
              <ActButton label="付箋" k="F" accent={accent} disabled={ro} title={ro ? reason : '赤→青→黄→緑→なし'} active={!!st.rows[act]?.fusen} onClick={() => setRow(act, { fusen: FUSEN_CYCLE[(FUSEN_CYCLE.indexOf(st.rows[act].fusen) + 1) % FUSEN_CYCLE.length] })} />
              <ActButton label="証憑" k="V" accent={accent} disabled={ro} title={ro ? reason : '有／無'} active={st.rows[act]?.shohyo} onClick={() => setRow(act, { shohyo: !st.rows[act].shohyo })} /></>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '7px 10px', background: '#f6f8fa', fontSize: 10.5, fontWeight: 700, color: '#8290a0' }}>
              <div>行</div>
              {!st.shared && <div style={{ color: BLUE }}>借方科目</div>}
              {!st.shared && <div style={{ color: PINK }}>貸方科目</div>}
              <div>摘要</div><div>業者</div><div style={{ textAlign: 'right' }}>金額</div><div>証憑 ✓ 付箋</div><div>並べ替え／削除</div>
            </div>
            {st.rows.map((r, i) => {
              const ri = issuesOfRow(r);
              return (
                <div key={r.key} className="ef-row" onFocus={() => setActive(i)} style={{ borderTop: '1px solid #f1f4f6', padding: '7px 10px', background: i === act ? '#fbfdff' : 'transparent' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: '#9aa5b1' }}><span className="ef-rowno">{i + 1}{r.id == null && <span style={{ color: accent, fontWeight: 700 }}> 新</span>}</span><span className="ef-rownow" style={{ fontSize: 9.5, fontWeight: 800, color: '#fff', background: accent, borderRadius: 6, padding: '1px 4px' }}>入力中</span></div>
                    {!st.shared && <ComboField id={`ed-r${i}-kari`} kind="account" value={r.kari} onChange={(v) => setRow(i, { kari: v })} onCommit={() => focusId(`ed-r${i}-kashi`)} placeholder="借方科目" disabled={ro} invalid={fieldState(ri, 'kari', 'pair')} fontSize={13} padY={7} listWidth={380} />}
                    {!st.shared && <ComboField id={`ed-r${i}-kashi`} kind="account" value={r.kashi} onChange={(v) => setRow(i, { kashi: v })} onCommit={() => focusId(`ed-r${i}-tekiyo`)} placeholder="貸方科目" disabled={ro} invalid={fieldState(ri, 'kashi', 'pair')} fontSize={13} padY={7} listWidth={380} />}
                    <ComboField id={`ed-r${i}-tekiyo`} kind="summary" freeText value={r.tekiyo} onChange={(v) => setRow(i, { tekiyo: v })} onCommit={() => focusId(`ed-r${i}-gyosha`)} placeholder="摘要" disabled={ro} fontSize={13} padY={7} listWidth={340} />
                    <ComboField id={`ed-r${i}-gyosha`} kind="vendor" value={r.gyosha} onChange={(v) => setRow(i, { gyosha: v })} onCommit={() => focusId(`ed-r${i}-amount`)} placeholder="業者" disabled={ro} fontSize={13} padY={7} listWidth={300} />
                    <input id={`ed-r${i}-amount`} className="ef-input" disabled={ro} value={fmtNum(r.amount)} onChange={(e) => setRow(i, { amount: e.target.value.replace(/[^0-9]/g, '') })} onKeyDown={onEnter(() => rowNext(i))} inputMode="numeric" placeholder="0" style={{ ...numInput, padding: '7px 9px', fontWeight: 700, fontSize: 14, borderColor: rowErr[r.key]?.startsWith('金額') ? '#c0392b' : '#cfd8e0' }} />
                    {viewOnly ? <FlagCell v={{ ...voucher!, check: r.check, fusen: r.fusen, shohyo: r.shohyo }} compact /> : <FlagButtons shohyo={r.shohyo} check={r.check} fusen={r.fusen} disabled={ro} onChange={(p) => setRow(i, p)} />}
                    {!viewOnly && <div style={{ display: 'flex', gap: 3 }}>
                      <button type="button" className="ef-act" disabled={ro || i === 0} title="この行を1つ上へ" onClick={() => moveRow(i, -1)} style={smallBtn}>▲</button>
                      <button type="button" className="ef-act" disabled={ro || i === st.rows.length - 1} title="この行を1つ下へ" onClick={() => moveRow(i, 1)} style={smallBtn}>▼</button>
                      <button type="button" className="ef-act" disabled={!canRow} title={canRow ? 'この行を削除' : !editable ? reason : '1伝票1行の形式です'} onClick={() => delRow(i)} style={{ ...smallBtn, color: '#c0392b', marginLeft: 6 }}>行削除</button>
                    </div>}
                  </div>
                  {(rowErr[r.key] || ri.length > 0) && (
                    <div style={{ margin: '6px 0 2px 42px', display: 'grid', gap: 5 }}>
                      {rowErr[r.key] && <div role="alert" style={{ fontSize: 12, fontWeight: 700, color: '#a5281b' }}>× {rowErr[r.key]}</div>}
                      <IssueList issues={ri} compact />
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderTop: '2px solid #e2e8ee', background: '#fbfcfd', borderRadius: '0 0 10px 10px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#8290a0' }}>合計（{st.rows.length} 行）</span>
              <span style={{ marginLeft: 'auto', fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{yen(total)} <span style={{ fontSize: 12, fontWeight: 600, color: '#7a8794' }}>円</span></span>
            </div>
          </div>
          {!st.shared && hasWarn(allIssues) && !hasError(allIssues) && !ro && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button id="ed-confirm" type="button" className="ef-act" onClick={() => save(true)} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #b07d00', background: '#d99a00', color: '#fff', fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>確認して登録</button></div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="小切手No"><input className="ef-input" disabled={ro} value={st.cheque} onChange={(e) => set({ cheque: e.target.value })} style={cell} /></Field>
            <Field label="予備入力1（摘要予備）"><input className="ef-input" disabled={ro} value={st.spare1} onChange={(e) => set({ spare1: e.target.value })} style={cell} /></Field>
            <Field label="予備入力2（業者予備）"><input className="ef-input" disabled={ro} value={st.spare2} onChange={(e) => set({ spare2: e.target.value })} style={cell} /></Field>
          </div>

          {msg && <div role={msg.tone === 'error' ? 'alert' : 'status'} style={{ padding: '8px 12px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, background: msg.tone === 'error' ? '#fdeee9' : '#eef4fb', color: msg.tone === 'error' ? '#a5281b' : '#2c5f9e', border: '1px solid ' + (msg.tone === 'error' ? '#f0b9ae' : '#c9dcf2') }}>{msg.text}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {!viewOnly && <ActButton label="伝票削除" k="X" tone="danger" disabled={ro} title={ro ? reason : 'この伝票（全行）を削除します。確認画面を表示します'} onClick={() => setDelOpen(true)} />}
            {!viewOnly && <ActDivider />}
            <span style={{ fontSize: 11.5, color: '#9aa5b1' }}>{viewOnly ? '参照のみの権限のため、内容の表示だけができます。' : '削除は確認画面のあとに実行します。元に戻せません。'}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button type="button" className="ef-act" onClick={onClose} style={btn()}>戻る（{returnTo}へ）</button>
              {!viewOnly && <ActButton id="ed-save" label="伝票登録" k="S" tone="primary" accent={accent} disabled={ro} title={ro ? reason : '訂正した内容で、この伝票の全行を登録します'} onClick={() => save(false)} />}
            </div>
          </div>
        </div>
      </div>
      <DeleteVoucherModal rows={delOpen ? all.filter((r) => st.ids.includes(r.id)) : null} onClose={() => setDelOpen(false)} onDeleted={onClose} />
    </Modal>
  );
}

/* ---------------- 詳細検索 ---------------- */
export interface SearchCond {
  kari: string; kashi: string; amountMin: string; amountMax: string; beforeAlloc: boolean; tekiyoCode: string; tekiyo: string; gyosha: string;
  no: string; cheque: string; shohyo: '両方' | '有' | '無'; check: '両方' | '有' | '無'; normal: boolean; migrated: boolean; internalOnly: boolean;
  fusen: Set<Fusen>; special: boolean; dept: string;
}
export const EMPTY_COND: SearchCond = { kari: '', kashi: '', amountMin: '', amountMax: '', beforeAlloc: false, tekiyoCode: '', tekiyo: '', gyosha: '', no: '', cheque: '', shohyo: '両方', check: '両方', normal: true, migrated: true, internalOnly: false, fusen: new Set(), special: false, dept: '' };
export function condActive(c: SearchCond) { return !!(c.kari || c.kashi || c.amountMin || c.amountMax || c.tekiyoCode || c.tekiyo || c.gyosha || c.no || c.cheque || c.shohyo !== '両方' || c.check !== '両方' || !c.normal || !c.migrated || c.internalOnly || c.fusen.size || c.special || c.dept); }
export function applyCond(rows: Voucher[], c: SearchCond): Voucher[] {
  return rows.filter((r) => {
    if (c.kari && r.kari !== c.kari) return false;
    if (c.kashi && r.kashi !== c.kashi) return false;
    if (c.amountMin && r.amount < toInt(c.amountMin)) return false;
    if (c.amountMax && r.amount > toInt(c.amountMax)) return false;
    if (c.tekiyo && !r.tekiyo.includes(c.tekiyo)) return false;
    if (c.gyosha && r.gyosha !== c.gyosha) return false;
    if (c.no && !r.no.includes(c.no)) return false;
    if (c.cheque && !(r.cheque ?? '').includes(c.cheque)) return false;
    if (c.shohyo !== '両方' && r.shohyo !== (c.shohyo === '有')) return false;
    if (c.check !== '両方' && r.check !== (c.check === '有')) return false;
    if (!c.normal && !r.migrated) return false;
    if (!c.migrated && r.migrated) return false;
    if (c.internalOnly && !r.internal) return false;
    if (c.fusen.size && !c.fusen.has(r.fusen)) return false;
    if (c.special && r.amount < 100000) return false;
    if (c.dept && r.service !== c.dept) return false;
    return true;
  });
}
export function AdvancedSearchModal({ open, onClose, cond, onApply, accent }: { open: boolean; onClose: () => void; cond: SearchCond; onApply: (c: SearchCond) => void; accent: string }) {
  const [c, setC] = useState<SearchCond>(cond);
  const set = (p: Partial<SearchCond>) => setC({ ...c, ...p });
  const sel = (v: string, on: (x: string) => void, opts: string[], ph = '指定なし') => <select value={v} onChange={(e) => on(e.target.value)} style={input}><option value="">{ph}</option>{opts.map((o) => <option key={o}>{o}</option>)}</select>;
  const tri = (v: string, on: (x: '両方' | '有' | '無') => void) => <div style={{ display: 'flex', gap: 10, paddingTop: 8, fontSize: 13 }}>{(['両方', '有', '無'] as const).map((o) => <label key={o} style={{ display: 'flex', gap: 4 }}><input type="radio" checked={v === o} onChange={() => on(o)} />{o}</label>)}</div>;
  return (
    <Modal open={open} onClose={onClose} width={760} title="検索条件">
      <EntryStyles />
      <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field label="借方科目"><ComboField id="search-kari" kind="account" value={c.kari} onChange={(v) => set({ kari: v })} placeholder="コード・名称・フリガナで絞り込み" listWidth={360} padY={7} fontSize={13} /></Field>
          <Field label="貸方科目"><ComboField id="search-kashi" kind="account" value={c.kashi} onChange={(v) => set({ kashi: v })} placeholder="コード・名称・フリガナで絞り込み" listWidth={360} padY={7} fontSize={13} /></Field>
          <Field label="金額（範囲）"><div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input className="field-input" value={c.amountMin} onChange={(e) => set({ amountMin: e.target.value.replace(/[^0-9]/g, '') })} placeholder="下限" inputMode="numeric" style={numInput} />〜<input className="field-input" value={c.amountMax} onChange={(e) => set({ amountMax: e.target.value.replace(/[^0-9]/g, '') })} placeholder="上限" inputMode="numeric" style={numInput} /></div><label style={{ fontSize: 11.5, display: 'flex', gap: 4, marginTop: 4 }}><input type="checkbox" checked={c.beforeAlloc} onChange={(e) => set({ beforeAlloc: e.target.checked })} />按分前の金額で検索する</label></Field>
          <Field label="摘要コード"><input className="field-input" value={c.tekiyoCode} onChange={(e) => set({ tekiyoCode: e.target.value })} style={input} /></Field>
          <Field label="摘要文字（部分一致）"><input className="field-input ring" value={c.tekiyo} onChange={(e) => set({ tekiyo: e.target.value })} style={input} /></Field>
          <Field label="業者"><ComboField id="search-gyosha" kind="vendor" value={c.gyosha} onChange={(v) => set({ gyosha: v === '（なし）' ? '' : v })} placeholder="コード・名称・フリガナで絞り込み" listWidth={300} padY={7} fontSize={13} /></Field>
          <Field label="伝票No"><input className="field-input" value={c.no} onChange={(e) => set({ no: e.target.value })} style={input} /></Field>
          <Field label="小切手No"><input className="field-input" value={c.cheque} onChange={(e) => set({ cheque: e.target.value })} style={input} /></Field>
          <Field label="部門（親区分で起動時）">{sel(c.dept, (v) => set({ dept: v }), ['（親区分）チャイルド保育園', ...SERVICES])}</Field>
          <Field label="証憑">{tri(c.shohyo, (v) => set({ shohyo: v }))}</Field>
          <Field label="チェック">{tri(c.check, (v) => set({ check: v }))}</Field>
          <Field label="伝票種別"><div style={{ display: 'flex', gap: 10, paddingTop: 8, fontSize: 13 }}><label style={{ display: 'flex', gap: 4 }}><input type="checkbox" checked={c.normal} onChange={(e) => set({ normal: e.target.checked })} />通常伝票</label><label style={{ display: 'flex', gap: 4 }}><input type="checkbox" checked={c.migrated} onChange={(e) => set({ migrated: e.target.checked })} />移行伝票</label></div></Field>
          <Field label="付箋"><div style={{ display: 'flex', gap: 8, paddingTop: 8, fontSize: 13, flexWrap: 'wrap' }}>{FUSEN_CYCLE.map((f) => <label key={f || 'none'} style={{ display: 'flex', gap: 4, color: f ? FUSEN_COLORS[f] : '#5b6773' }}><input type="checkbox" checked={c.fusen.has(f)} onChange={(e) => { const n = new Set(c.fusen); if (e.target.checked) n.add(f); else n.delete(f); set({ fusen: n }); }} />{f ? fusenLabel(f) : '付箋なし'}</label>)}</div></Field>
          <Field label="内部取引"><label style={{ display: 'flex', gap: 4, paddingTop: 8, fontSize: 13 }}><input type="checkbox" checked={c.internalOnly} onChange={(e) => set({ internalOnly: e.target.checked })} />内部取引伝票のみ</label></Field>
          <Field label="特殊付箋"><label style={{ display: 'flex', gap: 4, paddingTop: 8, fontSize: 13 }}><input type="checkbox" checked={c.special} onChange={(e) => set({ special: e.target.checked })} />決算チェック（10万以上）</label></Field>
        </div>
        <Notice>複数の条件は AND で絞り込みます。「検索合計」が有効なとき、一致した金額の合計を画面右上に表示します。</Notice>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button type="button" onClick={() => setC({ ...EMPTY_COND, fusen: new Set() })} style={btn()}>条件をクリア</button>
          <div style={{ display: 'flex', gap: 8 }}><button type="button" onClick={onClose} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => { onApply(c); onClose(); }} style={btn(accent, true)}>OK</button></div>
        </div>
      </div>
    </Modal>
  );
}
