// 仕訳の訂正モード・詳細検索・行の証憑／チェック／付箋（提案F）
//   仕訳一覧／元帳の行クリック → 伝票を編集モードで開く（保存・削除・入換）。詳細検索は既存【検索条件】の14条件。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { Field, Notice, btn, input, numInput, toInt, yen } from './ui';
import { ACCOUNTS, SERVICES, VENDORS } from '../data';
import { FUSEN_COLORS, FUSEN_CYCLE, cycleFusen, deleteVoucher, moveVoucher, updateVoucher, type Fusen, type Voucher } from '../store/journalStore';
import { judgeTorihiki, TORIHIKI_COLOR } from '../lib/accounts';

const ACCTS = ACCOUNTS.flatMap((g) => g.items).concat(['手数料', '住民税', '健康保険', '厚生年金']);

/* ---------------- 行のフラグ（証憑・チェック・付箋） ---------------- */
export function FlagCell({ v, compact }: { v: Voucher; compact?: boolean }) {
  const dot: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: compact ? 20 : 24, height: compact ? 20 : 24, borderRadius: 6, border: '1px solid #dde4ea', background: '#fff', cursor: 'pointer', fontSize: 10.5, fontWeight: 800 };
  return (
    <div style={{ display: 'inline-flex', gap: 3 }} onClick={(e) => e.stopPropagation()}>
      <span title="証憑 有／無（クリックで切替）" onClick={() => updateVoucher(v.id, { shohyo: !v.shohyo })} style={{ ...dot, background: v.shohyo ? '#eaf5ef' : '#fff', color: v.shohyo ? '#1f7a52' : '#b3bcc5' }}>{v.shohyo ? '有' : '無'}</span>
      <span title="チェック（クリックで切替）" onClick={() => updateVoucher(v.id, { check: !v.check })} style={{ ...dot, background: v.check ? '#22303c' : '#fff', color: v.check ? '#fff' : '#b3bcc5' }}>✓</span>
      <span title={`付箋：${v.fusen || 'なし'}（クリックで 赤→青→黄→緑→なし）`} onClick={() => cycleFusen(v.id)} style={{ ...dot, background: v.fusen ? FUSEN_COLORS[v.fusen] : '#fff', color: v.fusen ? '#fff' : '#b3bcc5' }}>■</span>
    </div>
  );
}

/* ---------------- 伝票の訂正モード ---------------- */
export function EditVoucherModal({ voucher, onClose, accent, returnTo }: { voucher: Voucher | null; onClose: () => void; accent: string; returnTo: string }) {
  const [f, setF] = useState<Voucher | null>(voucher);
  const [loadedId, setLoadedId] = useState<number | null>(voucher?.id ?? null);
  if (voucher && voucher.id !== loadedId) { setF(voucher); setLoadedId(voucher.id); }
  if (!voucher || !f) return null;
  const set = (p: Partial<Voucher>) => setF({ ...f, ...p });
  const j = judgeTorihiki(f.kari, f.kashi);
  const c = TORIHIKI_COLOR[j.kind];
  const save = () => {
    if (!f.kari || !f.kashi || !f.amount) return alert('借方科目・貸方科目・金額を入力してください。');
    if (j.kind === '要確認' && j.reason === '誤伝票') return alert('誤った伝票、または通常は入力することのない伝票です。科目を確認してください。');
    updateVoucher(f.id, { date: f.date, kari: f.kari, kashi: f.kashi, tekiyo: f.tekiyo, gyosha: f.gyosha || undefined, amount: f.amount, shohyo: f.shohyo, cheque: f.cheque, service: f.service, spare1: f.spare1, spare2: f.spare2 });
    onClose();
  };
  const del = () => { if (confirm(`Seq ${f.seq}　${f.date} ${f.kari}／${f.kashi} ${yen(f.amount)}円 を削除しますか？\n一度削除したデータは元には戻せません。`)) { deleteVoucher(f.id); onClose(); } };
  const sel = (v: string, on: (x: string) => void, opts: string[]) => <select value={v} onChange={(e) => on(e.target.value)} style={input}><option value="">選択</option>{opts.map((o) => <option key={o}>{o}</option>)}</select>;
  return (
    <Modal open={!!voucher} onClose={onClose} width={720} title={<>伝票の訂正 <span style={{ fontSize: 12, color: '#7a8794', fontWeight: 500, marginLeft: 8 }}>Seq {f.seq}　伝票No {f.no}　{f.kind}</span></>} strict>
      <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ padding: '4px 10px', borderRadius: 8, background: c.bg, color: c.fg, fontSize: 12, fontWeight: 800 }}>{j.kind}{j.reason ? `（${j.reason}）` : ''}</span>
          <span style={{ fontSize: 12, color: '#7a8794' }}>{c.note}</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
            <button type="button" onClick={() => moveVoucher(f.id, -1) || alert('同一日の中でのみ入れ替えできます')} title="F3 ▲入換（同一日の中で表示順を上げる）" style={btn('#5b6773', false, true)}>▲入換</button>
            <button type="button" onClick={() => moveVoucher(f.id, 1) || alert('同一日の中でのみ入れ替えできます')} title="F4 ▼入換" style={btn('#5b6773', false, true)}>▼入換</button>
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field label="サービス区分"><select value={f.service} onChange={(e) => set({ service: e.target.value })} style={input}>{SERVICES.map((s) => <option key={s}>{s}</option>)}<option>002 チャイルド保育園</option></select></Field>
          <Field label="年月日（令和8年）"><input className="field-input ring" value={f.date} onChange={(e) => set({ date: e.target.value })} style={input} /></Field>
          <Field label="伝票No"><input className="field-input" value={f.no} onChange={(e) => set({ no: e.target.value })} style={input} /></Field>
          <Field label="借方 BS&PL">{sel(f.kari, (v) => set({ kari: v }), ACCTS)}</Field>
          <Field label="貸方 BS&PL">{sel(f.kashi, (v) => set({ kashi: v }), ACCTS)}</Field>
          <Field label="金額"><input className="field-input ring" value={yen(f.amount)} onChange={(e) => set({ amount: toInt(e.target.value) })} inputMode="numeric" style={{ ...numInput, fontWeight: 700, fontSize: 15 }} /></Field>
          <Field label="摘要" span={2}><input className="field-input ring" value={f.tekiyo} onChange={(e) => set({ tekiyo: e.target.value })} style={input} /></Field>
          <Field label="業者">{sel(f.gyosha ?? '', (v) => set({ gyosha: v }), VENDORS.filter((x) => x !== '（なし）'))}</Field>
          <Field label="証憑"><div style={{ display: 'flex', gap: 10, paddingTop: 8, fontSize: 13 }}>{[true, false].map((b) => <label key={String(b)} style={{ display: 'flex', gap: 4 }}><input type="radio" checked={f.shohyo === b} onChange={() => set({ shohyo: b })} />{b ? '有' : '無'}</label>)}</div></Field>
          <Field label="小切手No"><input className="field-input" value={f.cheque ?? ''} onChange={(e) => set({ cheque: e.target.value })} style={input} /></Field>
          <Field label="入力予備1／2"><div style={{ display: 'flex', gap: 6 }}><input className="field-input" value={f.spare1 ?? ''} onChange={(e) => set({ spare1: e.target.value })} placeholder="予備1" style={input} /><input className="field-input" value={f.spare2 ?? ''} onChange={(e) => set({ spare2: e.target.value })} placeholder="予備2" style={input} /></div></Field>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={del} style={btn('#c0392b')}>削除</button>
          <span style={{ fontSize: 11.5, color: '#9aa5b1' }}>削除は既存の「Shift＋ダブルクリック」に相当。取り消せません。</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={btn()}>戻る（{returnTo}へ）</button>
            <button type="button" className="submit-btn" onClick={save} style={btn(accent, true)}>F12 伝票登録</button>
          </div>
        </div>
      </div>
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
      <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field label="借方科目">{sel(c.kari, (v) => set({ kari: v }), ACCTS)}</Field>
          <Field label="貸方科目">{sel(c.kashi, (v) => set({ kashi: v }), ACCTS)}</Field>
          <Field label="金額（範囲）"><div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input className="field-input" value={c.amountMin} onChange={(e) => set({ amountMin: e.target.value.replace(/[^0-9]/g, '') })} placeholder="下限" inputMode="numeric" style={numInput} />〜<input className="field-input" value={c.amountMax} onChange={(e) => set({ amountMax: e.target.value.replace(/[^0-9]/g, '') })} placeholder="上限" inputMode="numeric" style={numInput} /></div><label style={{ fontSize: 11.5, display: 'flex', gap: 4, marginTop: 4 }}><input type="checkbox" checked={c.beforeAlloc} onChange={(e) => set({ beforeAlloc: e.target.checked })} />按分前の金額で検索する</label></Field>
          <Field label="摘要コード"><input className="field-input" value={c.tekiyoCode} onChange={(e) => set({ tekiyoCode: e.target.value })} style={input} /></Field>
          <Field label="摘要文字（部分一致）"><input className="field-input ring" value={c.tekiyo} onChange={(e) => set({ tekiyo: e.target.value })} style={input} /></Field>
          <Field label="業者">{sel(c.gyosha, (v) => set({ gyosha: v }), VENDORS.filter((x) => x !== '（なし）'))}</Field>
          <Field label="伝票No"><input className="field-input" value={c.no} onChange={(e) => set({ no: e.target.value })} style={input} /></Field>
          <Field label="小切手No"><input className="field-input" value={c.cheque} onChange={(e) => set({ cheque: e.target.value })} style={input} /></Field>
          <Field label="部門（親区分で起動時）">{sel(c.dept, (v) => set({ dept: v }), ['002 チャイルド保育園', ...SERVICES])}</Field>
          <Field label="証憑">{tri(c.shohyo, (v) => set({ shohyo: v }))}</Field>
          <Field label="チェック">{tri(c.check, (v) => set({ check: v }))}</Field>
          <Field label="伝票種別"><div style={{ display: 'flex', gap: 10, paddingTop: 8, fontSize: 13 }}><label style={{ display: 'flex', gap: 4 }}><input type="checkbox" checked={c.normal} onChange={(e) => set({ normal: e.target.checked })} />通常伝票</label><label style={{ display: 'flex', gap: 4 }}><input type="checkbox" checked={c.migrated} onChange={(e) => set({ migrated: e.target.checked })} />移行伝票</label></div></Field>
          <Field label="付箋"><div style={{ display: 'flex', gap: 8, paddingTop: 8, fontSize: 13, flexWrap: 'wrap' }}>{FUSEN_CYCLE.map((f) => <label key={f || 'none'} style={{ display: 'flex', gap: 4, color: f ? FUSEN_COLORS[f] : '#5b6773' }}><input type="checkbox" checked={c.fusen.has(f)} onChange={(e) => { const n = new Set(c.fusen); if (e.target.checked) n.add(f); else n.delete(f); set({ fusen: n }); }} />{f || '付箋なし'}</label>)}</div></Field>
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
