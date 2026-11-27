// 仕訳の訂正モード・詳細検索・行の証憑／チェック／付箋（提案F）
//   仕訳一覧／元帳／参照パネルの行 → 伝票を訂正モードで開く。同じ伝票（伝票No・年月日が同じ）の行をまとめて表示し、
//   行の追加・挿入・削除・並べ替えを含めて同時に編集して登録する（依頼書 5.3.1）。
//   伝票訂正・伝票削除の対象を選ぶ一覧（VoucherPickerModal）と、削除の確認（DeleteVoucherModal。依頼書 6.4）もここに置く。
//   詳細検索は既存【検索条件】の14条件。

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { Field, Notice, btn, input, numInput, toInt, yen, HelpTip } from './ui';
import { ActButton, ActDivider, ComboField, ConfirmModal, EntryMonthNote, EntryStyles, FieldLabel, FlagButtons, FundAccountLine, IssueList, ReadOnlyBanner, fieldState, fmtNum, focusId, hasError, hasWarn, judgeEntry, needsPartner, onEnter, parseEntryMonth, entryYearOf, partnerOf, scopeStyle, setPartner, toNum, useShortcuts, type Issue, FusenTab } from './EntryCommon';
import { SERVICES } from '../data';
import { InternalSwitch, statementItems, useStatementFlow } from './EntryExtras';
import { CalendarModal } from './SingleEntryTools';
import { FUSEN_COLORS, FUSEN_CYCLE, addVoucher, cycleFusen, deleteVoucher, getVouchers, moveVoucher, setVoucherFlags, updateVoucher, useVouchers, type Fusen, type Voucher } from '../store/journalStore';
import { judgeTorihiki, TORIHIKI_COLOR } from '../lib/accounts';
import { TAX_OPTS, taxAmountOf, taxDefaultOf } from '../lib/transferTax';
import { canEdit, editBlockReason, fusenLabel, useSession, isViewOnly } from '../store/session';
import { canEnterVoucher, entryBlockReason } from '../lib/entryDivision';
import { matchPeriod, type Period } from '../lib/period';
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

/* ---------------- 伝票のフラグ（証憑・チェック・付箋。伝票1枚につき1つ：同じ伝票の全行に反映） ---------------- */
export function FlagCell({ v, compact }: { v: Voucher; compact?: boolean }) {
  const s = useSession();
  const ok = canEdit(s);
  const why = ok ? '' : `（${editBlockReason(s)}）`;
  const dot: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: compact ? 20 : 24, height: compact ? 20 : 24, borderRadius: 6, border: '1px solid #dde4ea', background: '#fff', cursor: ok ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 800, opacity: ok ? 1 : 0.7 };
  return (
    <div style={{ display: 'inline-flex', gap: 3 }} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <span title={ok ? '証憑 有／無（クリックで切替）' : '証憑 ' + (v.shohyo ? '有' : '無') + why} onClick={() => ok && setVoucherFlags(v.id, { shohyo: !v.shohyo })} style={{ ...dot, background: v.shohyo ? '#eaf5ef' : '#fff', color: v.shohyo ? '#1f7a52' : '#b3bcc5' }}>{v.shohyo ? '有' : '無'}</span>
      <span title={ok ? 'チェック（クリックで切替）' : 'チェック' + why} onClick={() => ok && setVoucherFlags(v.id, { check: !v.check })} style={{ ...dot, background: v.check ? '#22303c' : '#fff', color: v.check ? '#fff' : '#b3bcc5' }}>✓</span>
      <span title={ok ? `付箋：${fusenLabel(v.fusen)}（クリックで 赤→青→黄→緑→なし）` : `付箋：${fusenLabel(v.fusen)}${why}`} onClick={() => ok && cycleFusen(v.id)} style={{ ...dot, background: v.fusen ? FUSEN_COLORS[v.fusen] : '#fff', color: v.fusen ? '#fff' : '#b3bcc5' }}>■</span>
    </div>
  );
}

/* ---------------- 伝票削除の確認（依頼書 6.4） ---------------- */
export function DeleteVoucherModal({ rows, onClose, onDeleted, onCancel, multi, entry }: { rows: Voucher[] | null; onClose: () => void; onDeleted?: () => void; /** 「削除しないで戻る」と ×。前の画面（削除する伝票の選択など）へ戻す。確認メモ #262 */ onCancel?: () => void; /** 一覧で複数行を選んで削除するとき（伝票単位ではなく行単位の案内にする） */ multi?: boolean; /** 伝票入力の画面から開いたとき（親区分で起動中でも、配下の入力区分の伝票を削除できる。確認メモ #182） */ entry?: boolean }) {
  const s = useSession();
  const ok = entry ? canEnterVoucher(s) : canEdit(s);
  const blockReason = entry ? entryBlockReason(s) : editBlockReason(s);
  if (!rows || rows.length === 0) return null;
  const h = rows[0];
  const total = rows.reduce((a, r) => a + r.amount, 0);
  return (
    <Modal open onClose={onCancel ?? onClose} width={multi ? 760 : 620} title={multi ? '選択した仕訳の削除' : '伝票削除の確認'} strict>
      <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span aria-hidden style={{ width: 40, height: 40, borderRadius: '50%', background: '#fdeee9', color: '#c0392b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, flex: 'none' }}>!</span>
          <div style={{ fontSize: 14, lineHeight: 1.8 }}>
            {multi ? `選択した ${rows.length} 行の仕訳を削除します。` : '次の伝票を削除します。'}<b style={{ color: '#c0392b' }}>削除した{multi ? '仕訳' : '伝票'}は元に戻せません。</b><br />
            この伝票に付随する明細データ（決算附属明細書）や固定資産（減価償却）がある場合は、あわせて削除されます。
          </div>
        </div>
        <div style={{ border: '1px solid #f0cfc9', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', background: '#fff5f3', fontSize: 14, fontWeight: 700, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {multi ? <><span>選択 {rows.length} 行</span><span>伝票 {new Set(rows.map((r) => r.no)).size} 枚</span><span>{rows[0].date} 〜 {rows[rows.length - 1].date}</span></> : <><span>伝票No {h.no}</span><span>令和8年 {h.date.replace('/', '月')}日</span><span>{KIND_FORMAT[h.kind]}</span></>}<span style={{ marginLeft: 'auto' }}>{rows.length} 行　合計 {yen(total)} 円</span>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {rows.map((r, i) => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: multi ? '84px minmax(0,1fr)' : '28px minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr) 100px', gap: 8, padding: '7px 12px', borderTop: '1px solid #f6e3df', fontSize: 14, alignItems: 'center' }}>
                <span style={{ color: '#9aa5b1', fontSize: multi ? 12 : 14 }}>{multi ? `${r.date} ${r.seq}` : i + 1}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.kari}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.kashi}</span>
                <span style={{ color: '#7a8794', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.tekiyo}</span>
                <span style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{yen(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
        {!ok && <Notice tone="warn">{blockReason}</Notice>}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <button type="button" className="ef-act" data-delete-back autoFocus onClick={onCancel ?? onClose} style={btn()}>削除しないで戻る</button>
          <button type="button" className="ef-act" disabled={!ok} title={ok ? undefined : blockReason} onClick={() => { rows.forEach((r) => { deleteVoucher(r.id); setPartner(r.id, ''); }); onDeleted?.(); onClose(); }} style={btn('#c0392b', true)}>{multi ? `選択した ${rows.length} 行を削除する` : `この伝票を削除する（${rows.length} 行）`}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- 伝票訂正・伝票削除の対象を選ぶ ---------------- */
export function VoucherPickerModal({ open, mode, onClose, onPick, accent }: { open: boolean; mode: '訂正' | '削除'; onClose: () => void; onPick: (group: VoucherGroup) => void; accent: string }) {
  const all = useVouchers(true);
  const [month, setMonth] = useState<MonthFilter>(null);
  // 月の範囲（会計月の「全月」から端の月を外したとき・月タブのドラッグ）。あれば month より優先
  const [range, setRange] = useState<Period | null>(null);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const groups = useMemo(() => {
    const kw = q.trim();
    return groupVouchers(all)
      .filter((g) => matchPeriod(g.head.date, month, range) && (!kw || g.head.no.includes(kw) || g.head.date.includes(kw) || String(g.total).includes(kw.replace(/,/g, '')) || g.rows.some((r) => [r.kari, r.kashi, r.tekiyo, r.gyosha ?? '', String(r.amount)].some((x) => x.includes(kw)))))
      .reverse();
  }, [all, month, range, q]);
  if (!open) return null;
  const cur = Math.min(hi, Math.max(0, groups.length - 1));
  const danger = mode === '削除';
  return (
    <Modal open onClose={onClose} width={860} title={<>{danger ? '伝票削除' : '伝票訂正'} <span style={{ fontSize: 14, color: '#7a8794', fontWeight: 500, marginLeft: 8 }}>登録済みの伝票から選びます</span></>}>
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
            placeholder="伝票No・科目・摘要・取引先・金額で絞り込み"
            autoComplete="off"
            style={{ ...input, width: 300 }}
          />
          <FiscalMonthTabs current={month} accent={accent} onSelect={(m) => { setMonth(m); setHi(0); }} withAll range={range} onRange={(r) => { setRange(r); setHi(0); }} pickRange={false} />
          <span style={{ marginLeft: 'auto', fontSize: 14, color: '#7a8794' }}><b style={{ color: '#22303c' }}>{groups.length}</b> 伝票</span>
        </div>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '62px 76px 44px minmax(0,1fr) minmax(0,1fr) minmax(0,1.3fr) 110px', gap: 8, padding: '8px 12px', background: '#f6f8fa', fontSize: 12, fontWeight: 700, color: '#8290a0' }}>
            <div>月日</div><div>伝票No</div><div>行数</div><div>借方科目</div><div>貸方科目</div><div>摘要</div><div style={{ textAlign: 'right' }}>合計金額</div>
          </div>
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {groups.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#9aa5b1', fontSize: 14 }}>該当する伝票がありません。</div>}
            {groups.map((g, i) => {
              const on = i === cur;
              const multi = g.rows.length > 1;
              const kari = new Set(g.rows.map((r) => r.kari)), kashi = new Set(g.rows.map((r) => r.kashi));
              return (
                <div key={g.key} className="ef-pickrow" onMouseEnter={() => setHi(i)} onClick={() => onPick(g)} style={{ display: 'grid', gridTemplateColumns: '62px 76px 44px minmax(0,1fr) minmax(0,1fr) minmax(0,1.3fr) 110px', gap: 8, padding: '8px 12px', borderTop: '1px solid #f1f4f6', fontSize: 14, alignItems: 'center', background: on ? (danger ? '#fdeee9' : accent + '14') : 'transparent', boxShadow: on ? `inset 4px 0 0 ${danger ? '#c0392b' : accent}` : 'none' }}>
                  <div style={{ color: '#5b6773' }}>{g.head.date}</div>
                  <div style={{ fontVariantNumeric: 'tabular-nums' }}>{g.head.no}</div>
                  <div><span style={{ fontSize: 12, fontWeight: 700, padding: '1px 7px', borderRadius: 8, background: multi ? '#e8f0fb' : '#f1f4f6', color: multi ? '#2c5f9e' : '#7a8794' }}>{g.rows.length}行</span></div>
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
          <HelpTip text={['↑↓ で伝票を選びます', danger ? 'Enter で削除の確認へ進みます（この時点では削除されません）' : 'Enter で訂正画面を開きます', 'Esc で閉じます']} />
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
interface EditRow {
  key: string; id: number | null; kari: string; kashi: string; tekiyo: string; gyosha: string;
  /** 金額。振替伝票形式では借方金額 */
  amount: string;
  /** 振替伝票形式：貸方金額（借方金額と別に入力する。確認メモ #199） */
  kashiAmount: string;
  /** 予備入力1・予備入力2 は行ごとに持つ（確認メモ #198） */
  spare1: string; spare2: string;
  /** 振替伝票形式・振替単一形式：貸借それぞれの税区分（空＝科目からの既定）と税額（未指定＝自動計算）。確認メモ #199／#200 */
  kariTax: string; kashiTax: string; kariTaxAmt?: string; kashiTaxAmt?: string;
  /** 振替単一形式：行ごとの内部取引と相手区分（確認メモ #195） */
  internal: boolean; aite: string;
}
/** 証憑・チェック・付箋は伝票1枚につき1つ（確認メモ #47） */
interface EditFlags { shohyo: boolean; check: boolean; fusen: Fusen }
interface EditState { base: Voucher; ids: number[]; shared: boolean; multi: boolean; service: string; month: string; day: string; no: string; kari: string; kashi: string; aite: string; internal: boolean; cheque: string; flags: EditFlags; rows: EditRow[] }
let rowKey = 0;
const newRow = (p?: Partial<EditRow>): EditRow => ({ key: 'n' + rowKey++, id: null, kari: '', kashi: '', tekiyo: '', gyosha: '', amount: '', kashiAmount: '', spare1: '', spare2: '', kariTax: '', kashiTax: '', internal: false, aite: '', ...p });
/** 何も入力していない行 */
const blankRow = (r: EditRow) => !r.kari && !r.kashi && !r.tekiyo.trim() && !r.gyosha && !toNum(r.amount) && !toNum(r.kashiAmount) && !r.spare1 && !r.spare2;
/** 登録済みの行 → 編集用の行 */
const toEditRow = (r: Voucher): EditRow => {
  // 振替伝票形式は、行の借方金額と貸方金額を別々に持つ（未指定の伝票は amount を両方に使う）
  const ka = r.kind === '振替' ? r.kariAmount ?? r.amount : r.amount;
  const sa = r.kind === '振替' ? r.kashiAmount ?? r.amount : r.amount;
  // 登録済みの税額が自動計算と同じなら、手入力ではないものとして扱う（金額を直すと税額も計算し直す）
  const manual = (tax: string | undefined, account: string, base: number, amt?: number) => (amt != null && amt !== taxAmountOf(tax || taxDefaultOf(account), base) ? String(amt) : undefined);
  return {
    key: 'v' + r.id, id: r.id, kari: r.kari, kashi: r.kashi, tekiyo: r.tekiyo, gyosha: r.gyosha ?? '', amount: String(ka), kashiAmount: String(sa),
    spare1: r.spare1 ?? '', spare2: r.spare2 ?? '',
    kariTax: r.kariTax ?? '', kashiTax: r.kashiTax ?? '', kariTaxAmt: manual(r.kariTax, r.kari, ka, r.kariTaxAmt), kashiTaxAmt: manual(r.kashiTax, r.kashi, sa, r.kashiTaxAmt),
    internal: !!r.internal, aite: partnerOf(r.id),
  };
};

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

export function EditVoucherModal({ voucher, onClose, accent, returnTo, entry }: { voucher: Voucher | null; onClose: () => void; accent: string; returnTo: string; /** 伝票入力の画面から開いたとき（親区分で起動中でも、配下の入力区分の伝票を訂正できる。確認メモ #182） */ entry?: boolean }) {
  const all = useVouchers(true);
  const sess = useSession();
  const editable = entry ? canEnterVoucher(sess) : canEdit(sess);
  const reason = entry ? entryBlockReason(sess) : editBlockReason(sess);
  const [st, setSt] = useState<EditState | null>(null);
  const st0 = st;
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [msg, setMsg] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  // 明細書に連動する科目の伝票は、訂正を登録したあと入力画面と同じく明細書への登録画面を開き、終わったら閉じる（確認メモ #458）
  const stmt = useStatementFlow(accent, () => {}, onClose);
  const [rowErr, setRowErr] = useState<Record<string, string>>({});
  const [delOpen, setDelOpen] = useState(false);
  /** 内部取引の欄を出しているか（入力画面と同じく［内部取引］ボタンで出す。確認メモ #393） */
  const [inOpen, setInOpen] = useState(false);
  /** 前の伝票／次の伝票へ移動したとき、その伝票の id（確認メモ #263） */
  const [navId, setNavId] = useState<number | null>(null);
  /** 訂正中の内容に変更があるか（移動の前に破棄の確認を出す） */
  const [dirty, setDirty] = useState(false);
  const [askNav, setAskNav] = useState<number | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  /** 前後の伝票の並び（伝票の登録順。同じ伝票の行は1つにまとめる） */
  const groups = useMemo(() => groupVouchers(all), [all]);

  if (!voucher && navId !== null) setNavId(null);
  const target = (navId != null ? all.find((r) => r.id === navId) : undefined) ?? voucher;
  if (!target && loadedId !== null) { setLoadedId(null); setSt(null); }
  if (target && target.id !== loadedId) {
    const group = all.filter((r) => sameVoucher(r, target));
    const rows = group.length ? group : [target];
    const transfer = target.kind === '振替' || target.kind === '振単';
    const shared = !transfer && rows.every((r) => r.kari === rows[0].kari && r.kashi === rows[0].kashi);
    const [m, d] = target.date.split('/');
    // 決算月は月欄に 99、翌年度の予備月は 13〜15 で表示する（確認メモ #269）
    const mm = rows[0].term === '決算' ? '99' : rows[0].term === '予備' ? String(parseInt(m, 10) + 9) : m ?? '';
    setSt({
      // 振替単一形式は、1枚の伝票に複数行を持てる（確認メモ #195）。1伝票1行なのは単一形式だけ
      base: rows[0], ids: rows.map((r) => r.id), shared, multi: target.kind !== '単一',
      service: rows[0].service, month: mm, day: d ?? '', no: rows[0].no, kari: rows[0].kari, kashi: rows[0].kashi,
      aite: partnerOf(rows[0].id), internal: !!rows[0].internal, cheque: rows[0].cheque ?? '',
      flags: { shohyo: rows[0].shohyo, check: rows[0].check, fusen: rows[0].fusen },
      rows: rows.map(toEditRow),
    });
    setLoadedId(target.id);
    setActive(0);
    setMsg(null);
    setRowErr({});
    setDelOpen(false);
    setInOpen(false);
    setDirty(false);
  }

  const set = (p: Partial<EditState>) => { setSt((s) => (s ? { ...s, ...p } : s)); setMsg(null); setDirty(true); };
  const setFlags = (p: Partial<EditFlags>) => { setSt((s) => (s ? { ...s, flags: { ...s.flags, ...p } } : s)); setMsg(null); setDirty(true); };
  const setRow = (i: number, p: Partial<EditRow>) => { setSt((s) => (s ? { ...s, rows: s.rows.map((r, k) => (k === i ? { ...r, ...p } : r)) } : s)); setRowErr({}); setMsg(null); setDirty(true); };
  /** 前の伝票／次の伝票（確認メモ #263：表示順の入替から変更） */
  const gi = st ? groups.findIndex((g) => g.rows.some((r) => st.ids.includes(r.id))) : -1;
  const prevG = gi > 0 ? groups[gi - 1] : undefined;
  const nextG = gi >= 0 && gi < groups.length - 1 ? groups[gi + 1] : undefined;
  const goNav = (id: number, force = false) => {
    if (dirty && !force && editable) { setAskNav(id); return; }
    setAskNav(null);
    setNavId(id);
  };
  const rowsN = st?.rows.length ?? 0;
  const act = Math.min(active, Math.max(0, rowsN - 1));
  /** 振替伝票形式：行に借方金額と貸方金額を持つ（確認メモ #199） */
  const isTr = st?.base.kind === '振替';
  /** 振替単一形式：金額は行に1つ。内部取引と相手区分は行ごと */
  const isTs = st?.base.kind === '振単';
  /** 税区分・税額を貸借それぞれに出す（振替伝票形式・振替単一形式。入力画面と同じく消費税対応の法人のみ。確認メモ #199／#200） */
  const taxOn = (isTr || isTs) && sess.taxEntry;
  const firstField = (i: number) => (st?.shared ? `ed-r${i}-tekiyo` : isTr ? `ed-r${i}-amount` : `ed-r${i}-kari`);
  const addRow = (at: number) => {
    if (!st || !editable || !st.multi) return;
    const next = [...st.rows];
    next.splice(at, 0, newRow());
    setSt({ ...st, rows: next });
    setDirty(true);
    setActive(at);
    setRowErr({});
    focusId(firstField(at));
  };
  const delRow = (i: number) => {
    if (!st || !editable || !st.multi) return;
    if (st.rows.length <= 1) { setMsg({ tone: 'error', text: '最後の1行は削除できません。伝票ごと削除する場合は「伝票削除」を使ってください。' }); return; }
    setSt({ ...st, rows: st.rows.filter((_, k) => k !== i) });
    setDirty(true);
    const n = Math.max(0, Math.min(i, st.rows.length - 2));
    setActive(n);
    setRowErr({});
    focusId(firstField(n));
  };

  const pairIssues: Issue[] = st && st.shared ? judgeEntry({ kari: st.kari, kashi: st.kashi, fundMode: '自動資金', internal: st.internal, aite: st.aite, division: st.service, amount: 0 }, sess.env) : [];
  // 振替単一形式は、内部取引と相手区分を行ごとに判定する
  const issuesOfRow = (r: EditRow): Issue[] => (st && !st.shared ? judgeEntry({ kari: r.kari, kashi: r.kashi, fundMode: '自動資金', internal: isTs ? r.internal : st.internal, aite: isTs ? r.aite : st.aite, division: st.service, amount: 0 }, sess.env) : []);
  const allIssues = st ? (st.shared ? pairIssues : st.rows.flatMap(issuesOfRow)) : [];
  const total = st ? st.rows.reduce((a, r) => a + toNum(r.amount), 0) : 0;
  /** 振替伝票形式の貸方合計（借方合計は total） */
  const kashiTotal = st ? st.rows.reduce((a, r) => a + toNum(r.kashiAmount), 0) : 0;
  /** 行ごとの内部取引（振替単一形式）：スイッチがオン、または内部取引科目を使っている行 */
  const rowPartnerOf = (r: EditRow) => needsPartner({ kari: r.kari, kashi: r.kashi, internal: r.internal });
  /** 伝票に1つの内部取引相手区分（振替単一形式は行ごとに持つので対象外） */
  const partner = !!st && !isTs && (st.shared ? needsPartner({ kari: st.kari, kashi: st.kashi, internal: st.internal }) : st.internal || st.rows.some((r) => needsPartner({ kari: r.kari, kashi: r.kashi })));
  /** 内部取引科目を使っているため、内部取引をオフにできない */
  const internalLocked = !!st && !isTs && (st.shared ? needsPartner({ kari: st.kari, kashi: st.kashi }) : st.rows.some((r) => needsPartner({ kari: r.kari, kashi: r.kashi })));
  /** 内部取引の欄：［内部取引］で出したとき、または内部取引の伝票のときに出す（振替単一形式は行ごとなので対象外。確認メモ #393） */
  const internalShown = !isTs && (inOpen || partner);
  const toggleInternal = () => { if (internalLocked) return; if (internalShown) { setInOpen(false); if (st?.internal) set({ internal: false, aite: '' }); } else setInOpen(true); };
  /** 税区分（空＝科目からの既定）と、税額の基礎になる金額（借方は借方金額、貸方は貸方金額。振替単一形式は行の金額） */
  const taxKindOf = (r: EditRow, side: 'kari' | 'kashi') => (side === 'kari' ? r.kariTax || taxDefaultOf(r.kari) : r.kashiTax || taxDefaultOf(r.kashi));
  const taxBase = (r: EditRow, side: 'kari' | 'kashi') => toNum(side === 'kashi' && isTr ? r.kashiAmount : r.amount);

  const save = (confirmed: boolean) => {
    if (!st0 || !editable) return;
    // 金額欄の Enter で追加したまま何も入力していない行は、登録の対象にしない（確認メモ #264）
    const kept = st0.rows.filter((r) => r.id != null || !blankRow(r));
    const st: EditState = { ...st0, rows: kept.length ? kept : st0.rows.slice(0, 1) };
    if (!st.month || !st.day) { setMsg({ tone: 'error', text: '年月日を入力してください。' }); focusId('ed-month'); return; }
    // 月は 1〜12、決算月は 99、翌年度の予備月は 13〜15（確認メモ #269）
    const em = parseEntryMonth(st.month);
    const dd = parseInt(st.day, 10);
    if (!em.ok) { setMsg({ tone: 'error', text: '月は 1〜12 で入力してください（決算月は 99、翌年度の予備月は 13〜15）。' }); focusId('ed-month'); return; }
    if (!(dd >= 1 && dd <= 31)) { setMsg({ tone: 'error', text: '日を正しく入力してください。' }); focusId('ed-day'); return; }
    if (!st.no.trim()) { setMsg({ tone: 'error', text: '伝票Noを入力してください。' }); focusId('ed-no'); return; }
    if (st.shared && (!st.kari || !st.kashi)) { setMsg({ tone: 'error', text: '借方科目・貸方科目を入力してください。' }); focusId(st.kari ? 'ed-kashi' : 'ed-kari'); return; }
    const re: Record<string, string> = {};
    st.rows.forEach((r) => {
      if (!st.shared && (!r.kari || !r.kashi)) re[r.key] = '借方科目・貸方科目を入力してください。';
      // 振替伝票形式は、借方金額・貸方金額のどちらかが入っていればよい（行単位では貸借の金額が異なることがある）
      else if (isTr ? !toNum(r.amount) && !toNum(r.kashiAmount) : !toNum(r.amount)) re[r.key] = isTr ? '金額（借方金額または貸方金額）を入力してください。' : '金額を入力してください。';
    });
    if (Object.keys(re).length) {
      setRowErr(re);
      const i = st.rows.findIndex((r) => re[r.key]);
      setMsg({ tone: 'error', text: `${i + 1}行目：${re[st.rows[i].key]}` });
      focusId(re[st.rows[i].key].startsWith('金額') ? `ed-r${i}-amount` : isTr ? `ed-r${i}-kari` : firstField(i));
      return;
    }
    // 振替伝票形式：伝票全体で借方合計と貸方合計が一致していること
    if (isTr && total !== kashiTotal) { setMsg({ tone: 'error', text: `借方合計と貸方合計が一致していません（差額 ${Math.abs(total - kashiTotal).toLocaleString('ja-JP')} 円）。` }); return; }
    if (hasError(allIssues)) { setMsg({ tone: 'error', text: '登録できない仕訳があります。赤い表示の内容を確認してください。' }); return; }
    if (hasWarn(allIssues) && !confirmed) { setMsg({ tone: 'info', text: '確認が必要な内容があります。黄色の表示を確認し、「確認して登録」を押してください。' }); focusId('ed-confirm'); return; }
    const date = `${em.month}/${dd}`;
    const keep = st.rows.filter((r) => r.id != null).map((r) => r.id as number);
    st.ids.filter((id) => !keep.includes(id)).forEach((id) => { deleteVoucher(id); setPartner(id, ''); });
    const ids: number[] = [];
    const partners: string[] = [];
    st.rows.forEach((r) => {
      const ka = toNum(r.amount);
      const sa = isTr ? toNum(r.kashiAmount) : ka;
      // 内部取引：振替単一形式は行ごと、ほかの形式は伝票に1つ
      const rp = isTs ? rowPartnerOf(r) : partner;
      // 税区分・税額は貸借それぞれ（振替伝票形式・振替単一形式。消費税対応の法人のみ）
      const kt = taxKindOf(r, 'kari');
      const kst = taxKindOf(r, 'kashi');
      const tax = taxOn ? { kariTax: kt, kariTaxAmt: r.kariTaxAmt ? toNum(r.kariTaxAmt) : taxAmountOf(kt, ka), kashiTax: kst, kashiTaxAmt: r.kashiTaxAmt ? toNum(r.kashiTaxAmt) : taxAmountOf(kst, sa) } : {};
      const body = {
        date, service: st.service, kari: st.shared ? st.kari : r.kari, kashi: st.shared ? st.kashi : r.kashi, tekiyo: r.tekiyo, gyosha: r.gyosha || undefined,
        amount: ka || sa,
        // 振替伝票形式：行の借方金額と貸方金額をそれぞれ持つ
        ...(isTr ? { kariAmount: ka, kashiAmount: sa } : {}),
        ...tax,
        shohyo: st.flags.shohyo, cheque: st.cheque.trim() || undefined,
        // 予備入力1・予備入力2 は行ごと（確認メモ #198）
        spare1: r.spare1 || undefined, spare2: r.spare2 || undefined,
        internal: rp || undefined,
        term: em.term,
      };
      if (r.id != null) { updateVoucher(r.id, { ...body, no: st.no.trim(), check: st.flags.check, fusen: st.flags.fusen }); ids.push(r.id); }
      else { const nv = addVoucher({ ...body, kind: st.base.kind, seq: st.base.seq, no: st.no.trim() }); updateVoucher(nv.id, { check: st.flags.check, fusen: st.flags.fusen }); ids.push(nv.id); }
      partners.push(rp ? (isTs ? r.aite : st.aite) : '');
    });
    applyOrder(ids);
    ids.forEach((id, k) => setPartner(id, partners[k]));
    const items = statementItems(date, st.service, st.rows.map((r) => ({ kari: st.shared ? st.kari : r.kari, kashi: st.shared ? st.kashi : r.kashi, tekiyo: r.tekiyo, amount: toNum(r.amount) || (isTr ? toNum(r.kashiAmount) : 0) })));
    if (items.length) { setDirty(false); stmt.start(items); return; }
    onClose();
  };

  const canRow = editable && !!st?.multi;
  useShortcuts(
    [
      { key: 'S', label: '伝票登録（訂正を保存）', group: '伝票の操作', run: () => save(false), disabled: !editable },
      { key: 'X', label: '伝票削除', group: '伝票の操作', run: () => setDelOpen(true), disabled: !editable },
      { key: 'U', label: '内部取引（内部取引相手区分の欄を出す／しまう）', group: '伝票の操作', run: () => toggleInternal(), disabled: !editable || isTs || internalLocked },
      { key: 'N', label: '行追加', group: '行の操作', run: () => addRow(rowsN), disabled: !canRow },
      { key: 'I', label: '行挿入', group: '行の操作', run: () => addRow(act), disabled: !canRow },
      { key: 'D', label: '行削除', group: '行の操作', run: () => delRow(act), disabled: !canRow },
      { key: 'C', label: 'チェック（伝票）', group: '伝票の操作', run: () => st && setFlags({ check: !st.flags.check }), disabled: !editable },
      { key: 'F', label: '付箋（伝票）', group: '伝票の操作', run: () => st && setFlags({ fusen: FUSEN_CYCLE[(FUSEN_CYCLE.indexOf(st.flags.fusen) + 1) % FUSEN_CYCLE.length] }), disabled: !editable },
      { key: 'V', label: '証憑（伝票）', group: '伝票の操作', run: () => st && setFlags({ shohyo: !st.flags.shohyo }), disabled: !editable },
    ],
    'modal',
    !!voucher && !!st && !delOpen && !calOpen && askNav == null,
  );

  if (stmt.active) return <>{stmt.node}</>;
  if (!voucher || !st) return null;
  const j = judgeTorihiki(st.shared ? st.kari : st.rows[act]?.kari ?? '', st.shared ? st.kashi : st.rows[act]?.kashi ?? '');
  const c = TORIHIKI_COLOR[j.kind];
  const ro = !editable;
  const viewOnly = isViewOnly(sess);
  const cell: CSSProperties = { ...input, padding: '7px 9px', fontSize: 14 };
  // 振替伝票形式は、入力画面と同じ並び（借方金額｜借方科目｜貸方科目｜貸方金額）。摘要と取引先は行の下段に置く
  const GRID = st.shared ? '34px minmax(0,1.5fr) minmax(0,1fr) 120px 132px' : isTr ? '34px 124px minmax(0,1fr) minmax(0,1fr) 124px 132px' : '34px minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,1.2fr) minmax(0,.9fr) 112px 132px';
  /** 行の下段：予備入力1・予備入力2 は行ごと（確認メモ #198）。振替伝票形式は摘要・取引先、振替単一形式は行ごとの内部取引と相手区分も置く */
  const SUB_GRID = isTr ? 'minmax(0,1.3fr) minmax(0,1fr) minmax(0,.8fr) minmax(0,.8fr)' : isTs ? 'minmax(0,1fr) minmax(0,1fr) 112px minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1fr)';
  const afterHead = () => focusId(st.shared ? 'ed-kari' : firstField(0));
  /** 行の最後の欄で Enter：次の行へ。最後の行なら新しい行を追加する（仕訳伝票形式と同じ。確認メモ #264）。何も入力していない行なら「伝票登録」へ */
  const rowNext = (i: number) => {
    if (i + 1 < st.rows.length) { setActive(i + 1); focusId(firstField(i + 1)); return; }
    if (canRow && !blankRow(st.rows[i])) { addRow(i + 1); return; }
    focusId('ed-save');
  };
  const smallBtn: CSSProperties = { ...btn('#5b6773', false, true), padding: '3px 9px' };
  const subLab: CSSProperties = { fontSize: 12, fontWeight: 700, color: '#8290a0', flex: 'none', whiteSpace: 'nowrap' };
  const subWrap: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 };
  const subInput: CSSProperties = { ...input, padding: '5px 8px', fontSize: 14, minWidth: 0, flex: 1 };
  const amountInput = (err: boolean): CSSProperties => ({ ...numInput, padding: '7px 9px', fontWeight: 700, fontSize: 14, borderColor: err ? '#c0392b' : '#cfd8e0' });
  /** 予備入力1・予備入力2（行ごと） */
  const spareCells = (r: EditRow, i: number) => (
    <>
      <div style={subWrap}><span style={subLab}>予備入力1</span><input id={`ed-r${i}-spare1`} data-spare="1" aria-label={`${i + 1}行目 予備入力1（摘要予備）`} className="ef-input" disabled={ro} value={r.spare1} onChange={(e) => setRow(i, { spare1: e.target.value })} onKeyDown={onEnter(() => focusId(`ed-r${i}-spare2`))} placeholder="摘要予備" style={subInput} /></div>
      <div style={subWrap}><span style={subLab}>予備入力2</span><input id={`ed-r${i}-spare2`} data-spare="2" aria-label={`${i + 1}行目 予備入力2（取引先予備）`} className="ef-input" disabled={ro} value={r.spare2} onChange={(e) => setRow(i, { spare2: e.target.value })} onKeyDown={onEnter(() => rowNext(i))} placeholder="取引先予備" style={subInput} /></div>
    </>
  );
  /** 税区分と税額（借方・貸方のそれぞれ。確認メモ #199／#200） */
  const taxCells = (r: EditRow, i: number, side: 'kari' | 'kashi') => {
    const name = side === 'kari' ? '借方' : '貸方';
    const color = side === 'kari' ? BLUE : PINK;
    const manual = side === 'kari' ? r.kariTaxAmt : r.kashiTaxAmt;
    const amt = (v: string | undefined): Partial<EditRow> => (side === 'kari' ? { kariTaxAmt: v } : { kashiTaxAmt: v });
    return (
      <>
        <div style={subWrap}>
          <span style={{ ...subLab, color }}>{name} 税区分</span>
          <select data-tax-kind={side} aria-label={`${i + 1}行目 ${name}の税区分`} className="ef-input" disabled={ro} value={taxKindOf(r, side)} onChange={(e) => setRow(i, side === 'kari' ? { kariTax: e.target.value } : { kashiTax: e.target.value })} style={{ ...subInput, padding: '5px 4px' }}>
            {TAX_OPTS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div style={subWrap}>
          <span style={{ ...subLab, color }}>{name} 税額</span>
          <input data-tax-amount={side} aria-label={`${i + 1}行目 ${name}の税額`} className="ef-input" disabled={ro} inputMode="numeric" value={fmtNum(manual ?? String(taxAmountOf(taxKindOf(r, side), taxBase(r, side))))} onChange={(e) => setRow(i, amt(e.target.value.replace(/[^0-9]/g, '')))} onBlur={() => { if (manual === '') setRow(i, amt(undefined)); }} title="金額 × 税率 ÷（100 ＋ 税率）の切り捨てで自動計算。端数の調整は手入力で変更できます（空にすると自動計算に戻ります）" style={{ ...subInput, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: manual != null ? '#1f2933' : '#5b6773' }} />
        </div>
      </>
    );
  };
  return (
    <Modal open onClose={onClose} width={st.shared ? 920 : 1080} title={<>{ro ? '伝票の参照' : '伝票の訂正'} <span style={{ fontSize: 14, color: '#7a8794', fontWeight: 500, marginLeft: 8 }}>Seq {st.base.seq}　伝票No {st.base.no}</span><span style={{ marginLeft: 10, padding: '2px 9px', borderRadius: 8, background: accent, color: '#fff', fontSize: 12, fontWeight: 800 }}>{KIND_FORMAT[st.base.kind]}</span></>} strict>
      <div className="ef-scope" style={scopeStyle(accent)}>
        <EntryStyles />
        <ReadOnlyBanner reason={reason} />
        <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 10px', borderRadius: 8, background: c.bg, color: c.fg, fontSize: 14, fontWeight: 800 }}>{j.kind}{j.reason ? `（${j.reason}）` : ''}</span>
            <span style={{ fontSize: 14, color: '#7a8794' }}>{st.multi ? `この伝票の ${st.rows.length} 行をまとめて編集します。` : '1伝票1行の形式です。'}</span>
            <span data-voucher-nav style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <button type="button" className="ef-act" data-nav="prev" disabled={!prevG} title={prevG ? `前の伝票（${prevG.head.date}　伝票No ${prevG.head.no}）を開きます` : '前の伝票はありません'} aria-label="前の伝票" onClick={() => prevG && goNav(prevG.head.id)} style={{ ...btn('#5b6773', false, true), width: 34, padding: '4px 0', fontSize: 18, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
              <button type="button" className="ef-act" data-nav="next" disabled={!nextG} title={nextG ? `次の伝票（${nextG.head.date}　伝票No ${nextG.head.no}）を開きます` : '次の伝票はありません'} aria-label="次の伝票" onClick={() => nextG && goNav(nextG.head.id)} style={{ ...btn('#5b6773', false, true), width: 34, padding: '4px 0', fontSize: 18, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: 12 }}>
            <div className="ef-field"><FieldLabel>区分</FieldLabel><ComboField id="ed-service" kind="service" value={st.service} onChange={(v) => set({ service: v || st.service })} onCommit={() => focusId('ed-month')} disabled={ro} /></div>
            <div className="ef-field">
              <FieldLabel>年月日</FieldLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: '#5b6773' }}>
                <span>令和{entryYearOf(st.month)}年</span>
                <input id="ed-month" className="ef-input" disabled={ro} value={st.month} onChange={(e) => set({ month: e.target.value.normalize('NFKC').replace(/[^0-9]/g, '').slice(0, 2) })} onKeyDown={onEnter(() => { if (parseEntryMonth(st.month).term === '決算' && !st.day) set({ day: '31' }); focusId('ed-day'); })} onFocus={(e) => e.currentTarget.select()} title="月は 1〜12 で入力します。決算月は 99、翌年度の予備月（4〜6月）は 13〜15" inputMode="numeric" style={{ ...cell, width: 44, textAlign: 'center', padding: '7px 2px' }} />
                <span>月</span>
                <input id="ed-day" className="ef-input" disabled={ro} value={st.day} onChange={(e) => set({ day: e.target.value.normalize('NFKC').replace(/[^0-9]/g, '').slice(0, 2) })} onKeyDown={onEnter(() => focusId('ed-no'))} onFocus={(e) => e.currentTarget.select()} inputMode="numeric" style={{ ...cell, width: 44, textAlign: 'center', padding: '7px 2px' }} />
                <span>日</span>
                {!viewOnly && (
                  <button type="button" tabIndex={-1} data-calendar-btn disabled={ro} onClick={() => setCalOpen(true)} aria-label="カレンダーから日付を選ぶ" title={ro ? reason : 'カレンダーから日付を選びます'} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, padding: 0, border: '1px solid #cfd8e0', borderRadius: 8, background: '#fff', color: ro ? '#a3adb8' : accent, cursor: ro ? 'not-allowed' : 'pointer' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4.5" width="18" height="16.5" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /><path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2" /></svg>
                  </button>
                )}
                <EntryMonthNote month={st.month} />
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
          {/* 内部取引のオン／オフ（確認メモ #265）。振替単一形式は行ごとに持つので、各行の下段で切り替える */}
          {internalShown && (
            <div data-internal-area data-on={partner ? '1' : '0'} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,340px)', gap: 16, alignItems: 'center', padding: '8px 14px', border: '1px solid ' + (partner ? '#e0d6f3' : '#e2e8ee'), background: partner ? '#faf7ff' : '#f6f8fa', borderRadius: 10, justifySelf: 'start' }}>
              {viewOnly ? <span style={{ fontSize: 14, fontWeight: 700, color: partner ? '#6b3fb5' : '#8895a3' }}>内部取引 {partner ? 'オン' : 'オフ'}</span> : <InternalSwitch on={partner} locked={internalLocked} disabled={ro} title={ro ? reason : undefined} onToggle={() => set(st.internal ? { internal: false, aite: '' } : { internal: true })} />}
              <div style={{ opacity: partner ? 1 : 0.5 }}>
                <FieldLabel color={partner ? '#6b3fb5' : '#8895a3'}>内部取引相手区分{partner ? '（必須）' : ''}</FieldLabel>
                <ComboField id="ed-aite" kind="service" value={st.aite} onChange={(v) => set({ aite: v })} onCommit={() => focusId(st.shared ? (st.kashi ? firstField(0) : 'ed-kashi') : firstField(0))} placeholder={partner ? '相手先の区分' : '内部取引をオンにすると入力できます'} disabled={ro || !partner} invalid={partner ? fieldState(allIssues, 'aite') : undefined} />
              </div>
            </div>
          )}
          {st.shared && <IssueList issues={pairIssues} onConfirm={ro ? undefined : () => save(true)} confirmId="ed-confirm" />}

          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, position: 'relative' }}>
            {/* 伝票に付けた付箋：入力画面と同じく枠の右端に貼る */}
            <FusenTab color={st.flags.fusen} offset={-12} top={22} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderBottom: '1px solid #eef2f5', background: '#fbfcfd', borderRadius: '10px 10px 0 0', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#8290a0', letterSpacing: '.05em' }}>伝票の印</span>
              {!viewOnly && <FlagButtons shohyo={st.flags.shohyo} check={st.flags.check} fusen={st.flags.fusen} disabled={ro} onChange={(p) => setFlags(p)} />}
              {viewOnly && <FlagCell v={{ ...target!, ...st.flags }} compact />}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '7px 10px', background: '#f6f8fa', fontSize: 12, fontWeight: 700, color: '#8290a0' }}>
              <div>行</div>
              {isTr && <div style={{ color: BLUE, textAlign: 'right' }}>借方金額</div>}
              {!st.shared && <div style={{ color: BLUE }}>借方科目</div>}
              {!st.shared && <div style={{ color: PINK }}>貸方科目</div>}
              {isTr ? <div style={{ color: PINK, textAlign: 'right' }}>貸方金額</div> : <><div>摘要</div><div>取引先</div><div style={{ textAlign: 'right' }}>金額</div></>}
              <div style={{ textAlign: 'center' }}>行の操作<span style={{ fontWeight: 500, marginLeft: 4 }}>挿入／削除</span></div>
            </div>
            {st.rows.map((r, i) => {
              const ri = issuesOfRow(r);
              /** 振替単一形式：この行が内部取引か（スイッチ、または内部取引科目）。内部取引科目を使う行は外せない */
              const rowLocked = needsPartner({ kari: r.kari, kashi: r.kashi });
              const rowIn = rowPartnerOf(r);
              return (
                <div key={r.key} className="ef-row" onFocus={() => setActive(i)} style={{ borderTop: '1px solid #f1f4f6', padding: '7px 10px', background: i === act ? '#fbfdff' : 'transparent' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: 14, color: '#9aa5b1' }}><span className="ef-rowno">{i + 1}{r.id == null && <span style={{ color: accent, fontWeight: 700 }}> 新</span>}</span><span className="ef-rownow" style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: accent, borderRadius: 6, padding: '1px 4px' }}>入力中</span></div>
                    {/* 振替伝票形式：借方金額と貸方金額をそれぞれ入力する（確認メモ #199） */}
                    {isTr && <input id={`ed-r${i}-amount`} data-amount="kari" aria-label={`${i + 1}行目 借方金額`} className="ef-input" disabled={ro} value={fmtNum(r.amount)} onChange={(e) => setRow(i, { amount: e.target.value.replace(/[^0-9]/g, '') })} onKeyDown={onEnter(() => focusId(`ed-r${i}-kari`))} inputMode="numeric" placeholder="0" style={amountInput(!!rowErr[r.key]?.startsWith('金額'))} />}
                    {!st.shared && <ComboField id={`ed-r${i}-kari`} kind="account" value={r.kari} onChange={(v) => setRow(i, { kari: v })} onCommit={() => focusId(`ed-r${i}-kashi`)} placeholder="借方科目" disabled={ro} invalid={fieldState(ri, 'kari', 'pair')} fontSize={14} padY={7} listWidth={380} />}
                    {!st.shared && <ComboField id={`ed-r${i}-kashi`} kind="account" value={r.kashi} onChange={(v) => setRow(i, { kashi: v })} onCommit={() => { if (isTr && !r.kashiAmount && r.amount) setRow(i, { kashiAmount: r.amount }); focusId(isTr ? `ed-r${i}-kashiamt` : `ed-r${i}-tekiyo`); }} placeholder="貸方科目" disabled={ro} invalid={fieldState(ri, 'kashi', 'pair')} fontSize={14} padY={7} listWidth={380} />}
                    {isTr && <input id={`ed-r${i}-kashiamt`} data-amount="kashi" aria-label={`${i + 1}行目 貸方金額`} className="ef-input" disabled={ro} value={fmtNum(r.kashiAmount)} onChange={(e) => setRow(i, { kashiAmount: e.target.value.replace(/[^0-9]/g, '') })} onKeyDown={onEnter(() => focusId(`ed-r${i}-tekiyo`))} inputMode="numeric" placeholder="0" style={amountInput(!!rowErr[r.key]?.startsWith('金額'))} />}
                    {!isTr && <ComboField id={`ed-r${i}-tekiyo`} kind="summary" freeText value={r.tekiyo} onChange={(v) => setRow(i, { tekiyo: v })} onCommit={() => focusId(`ed-r${i}-gyosha`)} placeholder="摘要" disabled={ro} fontSize={14} padY={7} listWidth={340} />}
                    {!isTr && <ComboField id={`ed-r${i}-gyosha`} kind="vendor" value={r.gyosha} onChange={(v) => setRow(i, { gyosha: v })} onCommit={() => focusId(`ed-r${i}-amount`)} placeholder="取引先" disabled={ro} fontSize={14} padY={7} listWidth={300} />}
                    {!isTr && <input id={`ed-r${i}-amount`} className="ef-input" disabled={ro} value={fmtNum(r.amount)} onChange={(e) => setRow(i, { amount: e.target.value.replace(/[^0-9]/g, '') })} onKeyDown={onEnter(() => rowNext(i))} inputMode="numeric" placeholder="0" style={amountInput(!!rowErr[r.key]?.startsWith('金額'))} />}
                    {!viewOnly ? <div data-row-ops={i} style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button type="button" className="ef-act" tabIndex={-1} disabled={!canRow} title={canRow ? `${i + 1}行目の上に1行挿入` : !editable ? reason : '1伝票1行の形式のため行は挿入できません'} onClick={() => addRow(i)} style={smallBtn}>挿入</button>
                      <button type="button" className="ef-act" tabIndex={-1} disabled={!canRow} title={canRow ? `${i + 1}行目を削除` : !editable ? reason : '1伝票1行の形式のため行は削除できません'} onClick={() => delRow(i)} style={{ ...smallBtn, color: '#c0392b', borderColor: '#f2c9c2' }}>削除</button>
                    </div> : <div />}
                  </div>
                  {/* 行の下段：予備入力1・予備入力2 は行ごと（確認メモ #198）。振替伝票形式は摘要・取引先、振替単一形式は行ごとの内部取引と相手区分もここに置く */}
                  <div data-row-sub={i} style={{ display: 'grid', gridTemplateColumns: SUB_GRID, gap: 8, alignItems: 'center', margin: '6px 140px 0 42px' }}>
                    {isTr && <div style={subWrap}><span style={subLab}>摘要</span><div style={{ flex: 1, minWidth: 0 }}><ComboField id={`ed-r${i}-tekiyo`} kind="summary" freeText value={r.tekiyo} onChange={(v) => setRow(i, { tekiyo: v })} onCommit={() => focusId(`ed-r${i}-gyosha`)} placeholder="摘要" disabled={ro} fontSize={14} padY={5} listWidth={340} /></div></div>}
                    {isTr && <div style={subWrap}><span style={subLab}>取引先</span><div style={{ flex: 1, minWidth: 0 }}><ComboField id={`ed-r${i}-gyosha`} kind="vendor" value={r.gyosha} onChange={(v) => setRow(i, { gyosha: v })} onCommit={() => rowNext(i)} placeholder="取引先（任意）" disabled={ro} fontSize={14} padY={5} listWidth={300} /></div></div>}
                    {spareCells(r, i)}
                    {isTs && (
                      <label data-row-internal={i} title={rowLocked ? '内部取引科目を使っているため、この行は内部取引です' : 'この行を内部取引として登録します（相手区分を指定します）'} style={{ ...subWrap, fontSize: 14, fontWeight: 700, color: rowIn ? '#b45309' : '#5b6773', cursor: ro || rowLocked ? 'default' : 'pointer' }}>
                        <input type="checkbox" checked={rowIn} disabled={ro || rowLocked} onChange={(e) => setRow(i, e.target.checked ? { internal: true } : { internal: false, aite: '' })} />
                        内部取引
                      </label>
                    )}
                    {isTs && <div style={subWrap}><span style={{ ...subLab, color: rowIn ? '#b45309' : '#b8c1cb' }}>相手区分</span><div style={{ flex: 1, minWidth: 0 }}><ComboField id={`ed-r${i}-aite`} kind="service" value={r.aite} onChange={(v) => setRow(i, { aite: v })} onCommit={() => rowNext(i)} placeholder={rowIn ? '相手先の区分' : '内部取引のとき'} disabled={ro || !rowIn} invalid={rowIn ? fieldState(ri, 'aite') : undefined} fontSize={14} padY={5} /></div></div>}
                  </div>
                  {taxOn && (
                    <div data-row-tax={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 190px minmax(0,1fr) 190px', gap: 8, alignItems: 'center', margin: '6px 140px 0 42px' }}>
                      {taxCells(r, i, 'kari')}
                      {taxCells(r, i, 'kashi')}
                    </div>
                  )}
                  {(rowErr[r.key] || ri.length > 0) && (
                    <div style={{ margin: '6px 0 2px 42px', display: 'grid', gap: 5 }}>
                      {rowErr[r.key] && <div role="alert" style={{ fontSize: 14, fontWeight: 700, color: '#a5281b' }}>× {rowErr[r.key]}</div>}
                      <IssueList issues={ri} compact />
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderTop: '2px solid #e2e8ee', background: '#fbfcfd', borderRadius: '0 0 10px 10px' }}>
              {!viewOnly && st.multi && <button type="button" className="ef-act" tabIndex={-1} data-row-add disabled={!canRow} onClick={() => addRow(st.rows.length)} title={canRow ? '最後に1行追加します（最後の行の金額欄で Enter を押しても追加できます）' : reason} style={{ padding: '4px 11px', borderRadius: 7, border: '1px dashed #b9c4cf', background: '#fff', color: '#48565f', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: canRow ? 'pointer' : 'not-allowed' }}>＋ 行追加</button>}
              <span style={{ fontSize: 12, fontWeight: 700, color: '#8290a0' }}>合計（{st.rows.length} 行）</span>
              {isTr ? (
                <span data-totals style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'baseline', gap: 14, fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: BLUE }}>借方合計</span><span style={{ fontSize: 17, fontWeight: 800 }}>{yen(total)}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: PINK }}>貸方合計</span><span style={{ fontSize: 17, fontWeight: 800 }}>{yen(kashiTotal)}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#7a8794' }}>円</span>
                  <span style={{ padding: '2px 9px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: total === kashiTotal ? '#e6f4ec' : '#fdeee9', color: total === kashiTotal ? '#1f7a52' : '#a5281b' }}>{total === kashiTotal ? '貸借一致' : `差額 ${yen(Math.abs(total - kashiTotal))}`}</span>
                </span>
              ) : (
                <span style={{ marginLeft: 'auto', fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{yen(total)} <span style={{ fontSize: 14, fontWeight: 600, color: '#7a8794' }}>円</span></span>
              )}
            </div>
          </div>
          {!st.shared && hasWarn(allIssues) && !hasError(allIssues) && !ro && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button id="ed-confirm" type="button" className="ef-act" onClick={() => save(true)} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #b07d00', background: '#d99a00', color: '#fff', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>確認して登録</button></div>
          )}

          {/* 小切手No は伝票に1つ。予備入力1・予備入力2 は行ごと（各行の下段。確認メモ #198） */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, alignItems: 'end' }}>
            <Field label="小切手No"><input className="ef-input" disabled={ro} value={st.cheque} onChange={(e) => set({ cheque: e.target.value })} style={cell} /></Field>
            <div style={{ fontSize: 12, color: '#8290a0', paddingBottom: 9 }}>予備入力1（摘要予備）・予備入力2（取引先予備）は、行ごとに各行の下段で入力します。{taxOn ? '税区分・税額は、借方と貸方のそれぞれに入力します。' : ''}</div>
          </div>

          {msg && <div role={msg.tone === 'error' ? 'alert' : 'status'} style={{ padding: '8px 12px', borderRadius: 9, fontSize: 14, fontWeight: 700, background: msg.tone === 'error' ? '#fdeee9' : '#eef4fb', color: msg.tone === 'error' ? '#a5281b' : '#2c5f9e', border: '1px solid ' + (msg.tone === 'error' ? '#f0b9ae' : '#c9dcf2') }}>{msg.text}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {!viewOnly && !isTs && <ActButton label={internalShown ? '内部取引：あり' : '内部取引'} k="U" menu="内部取引" active={internalShown} accent={accent} disabled={ro || internalLocked} title={internalLocked ? '内部取引科目を使っているため、内部取引の欄は閉じられません' : internalShown ? '内部取引の欄をしまいます（内部取引をオフにします）' : '内部取引相手区分の欄を出します'} onClick={toggleInternal} />}
            {!viewOnly && <ActButton label="伝票削除" k="X" tone="danger" disabled={ro} title={ro ? reason : 'この伝票（全行）を削除します。確認画面を表示します'} onClick={() => setDelOpen(true)} />}
            {!viewOnly && <ActDivider />}
            <span style={{ fontSize: 12, color: '#9aa5b1' }}>{viewOnly ? '参照のみの権限のため、内容の表示だけができます。' : '削除は確認画面のあとに実行します。元に戻せません。'}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button type="button" className="ef-act" onClick={onClose} style={btn()}>戻る（{returnTo}へ）</button>
              {!viewOnly && <ActButton id="ed-save" label="伝票登録" k="S" tone="primary" accent={accent} disabled={ro} title={ro ? reason : '訂正した内容で、この伝票の全行を登録します'} onClick={() => save(false)} />}
            </div>
          </div>
        </div>
      </div>
      <DeleteVoucherModal rows={delOpen ? all.filter((r) => st.ids.includes(r.id)) : null} onClose={() => setDelOpen(false)} onDeleted={onClose} />
      {calOpen && <CalendarModal open extended onClose={() => setCalOpen(false)} accent={accent} entries={all} month={parseEntryMonth(st.month).ok ? String(parseInt(st.month, 10)) : '8'} day={st.day} onPick={(m, d) => { set({ month: m, day: d }); setCalOpen(false); focusId('ed-no'); }} />}
      <ConfirmModal open={askNav != null} title="訂正内容の破棄の確認" okLabel="破棄して移動する" danger accent={accent} cancelLabel="訂正に戻る" onClose={() => setAskNav(null)} onOk={() => askNav != null && goNav(askNav, true)}>
        この伝票の訂正内容は、まだ登録していません。<b>移動すると訂正内容は破棄されます。</b><br />登録してから移動する場合は「訂正に戻る」を押し、伝票登録を行ってください。
      </ConfirmModal>
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
    if (c.internalOnly && !(r.internal || r.internalSide || needsPartner({ kari: r.kari, kashi: r.kashi }))) return false;
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
  const tri = (v: string, on: (x: '両方' | '有' | '無') => void) => <div style={{ display: 'flex', gap: 10, paddingTop: 8, fontSize: 14 }}>{(['両方', '有', '無'] as const).map((o) => <label key={o} style={{ display: 'flex', gap: 4 }}><input type="radio" checked={v === o} onChange={() => on(o)} />{o}</label>)}</div>;
  return (
    <Modal open={open} onClose={onClose} width={760} title="検索条件">
      <EntryStyles />
      <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field label="借方科目"><ComboField id="search-kari" kind="account" value={c.kari} onChange={(v) => set({ kari: v })} placeholder="コード・名称・フリガナで絞り込み" listWidth={360} padY={7} fontSize={14} /></Field>
          <Field label="貸方科目"><ComboField id="search-kashi" kind="account" value={c.kashi} onChange={(v) => set({ kashi: v })} placeholder="コード・名称・フリガナで絞り込み" listWidth={360} padY={7} fontSize={14} /></Field>
          <Field label="金額（範囲）"><div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input className="field-input" value={c.amountMin} onChange={(e) => set({ amountMin: e.target.value.replace(/[^0-9]/g, '') })} placeholder="下限" inputMode="numeric" style={numInput} />〜<input className="field-input" value={c.amountMax} onChange={(e) => set({ amountMax: e.target.value.replace(/[^0-9]/g, '') })} placeholder="上限" inputMode="numeric" style={numInput} /></div><label style={{ fontSize: 12, display: 'flex', gap: 4, marginTop: 4 }}><input type="checkbox" checked={c.beforeAlloc} onChange={(e) => set({ beforeAlloc: e.target.checked })} />按分前の金額で検索する</label></Field>
          <Field label="摘要コード"><input className="field-input" value={c.tekiyoCode} onChange={(e) => set({ tekiyoCode: e.target.value })} style={input} /></Field>
          <Field label="摘要文字（部分一致）"><input className="field-input ring" value={c.tekiyo} onChange={(e) => set({ tekiyo: e.target.value })} style={input} /></Field>
          <Field label="取引先"><ComboField id="search-gyosha" kind="vendor" value={c.gyosha} onChange={(v) => set({ gyosha: v === '（なし）' ? '' : v })} placeholder="コード・名称・フリガナで絞り込み" listWidth={300} padY={7} fontSize={14} /></Field>
          <Field label="伝票No"><input className="field-input" value={c.no} onChange={(e) => set({ no: e.target.value })} style={input} /></Field>
          <Field label="小切手No"><input className="field-input" value={c.cheque} onChange={(e) => set({ cheque: e.target.value })} style={input} /></Field>
          <Field label="部門（親区分で起動時）">{sel(c.dept, (v) => set({ dept: v }), ['（親区分）チャイルド保育園', ...SERVICES])}</Field>
          <Field label="証憑">{tri(c.shohyo, (v) => set({ shohyo: v }))}</Field>
          <Field label="チェック">{tri(c.check, (v) => set({ check: v }))}</Field>
          <Field label="伝票種別"><div style={{ display: 'flex', gap: 10, paddingTop: 8, fontSize: 14 }}><label style={{ display: 'flex', gap: 4 }}><input type="checkbox" checked={c.normal} onChange={(e) => set({ normal: e.target.checked })} />通常伝票</label><label style={{ display: 'flex', gap: 4 }}><input type="checkbox" checked={c.migrated} onChange={(e) => set({ migrated: e.target.checked })} />移行伝票</label></div></Field>
          <Field label="付箋"><div style={{ display: 'flex', gap: 8, paddingTop: 8, fontSize: 14, flexWrap: 'wrap' }}>{FUSEN_CYCLE.map((f) => <label key={f || 'none'} style={{ display: 'flex', gap: 4, color: f ? FUSEN_COLORS[f] : '#5b6773' }}><input type="checkbox" checked={c.fusen.has(f)} onChange={(e) => { const n = new Set(c.fusen); if (e.target.checked) n.add(f); else n.delete(f); set({ fusen: n }); }} />{f ? fusenLabel(f) : '付箋なし'}</label>)}</div></Field>
          <Field label="内部取引"><label style={{ display: 'flex', gap: 4, paddingTop: 8, fontSize: 14 }}><input type="checkbox" checked={c.internalOnly} onChange={(e) => set({ internalOnly: e.target.checked })} />内部取引伝票のみ</label></Field>
          <Field label="特殊付箋"><label style={{ display: 'flex', gap: 4, paddingTop: 8, fontSize: 14 }}><input type="checkbox" checked={c.special} onChange={(e) => set({ special: e.target.checked })} />決算チェック（10万以上）</label></Field>
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
