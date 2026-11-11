// 伝票入力の強化部品（提案D／E／L）
//   入力設定ダイアログ、取引区分（7種）の表示、確認ダイアログ（誤伝票／費用間／収益間）、予算状況グラフ、
//   定型仕訳・連続定型仕訳の呼出し、自動按分仕訳の実行、特殊金額入力、決算附属明細書への登録ダイアログ。
//   useEntryTools … 4形式共通の機能ボタン（伝票の操作／行の操作／入力補助／参照）とショートカット、付随するダイアログ一式
//   （依頼書 5.3.3／5.3.4／5.3.6／付録A：ファンクションキーの代替）。

import { useMemo, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { Modal } from './Modal';
import { NUM, TD, TH } from './ReportShell';
import { Field, Notice, Toggle, btn, input, numInput, toInt, yen } from './ui';
import { ActButton, ActionGroup, ConfirmModal, ENTRY_FORMATS, FORMAT_KIND, FUND_MODES, FUND_MODE_NOTE, FormatSwitcher, INTERNAL_SIDES, ReadOnlyBanner, ShortcutHelpModal, entryDateOfKey, entryMonthKey, nextFusen, openCandidatesOfFocused, parseEntryDate, parseEntryMonth, useShortcuts, type EntryFormat, type FundMode, type FusenColor, type InternalSide, type Shortcut } from './EntryCommon';
import { AccountBalanceModal, CalendarModal, CashBalanceModal } from './SingleEntryTools';
import { AllocationWizardModal, blankAllocation, type AllocationWiz } from './TemplateWizards';
import { PreviewModal, type TableData } from './PrintCenter';
import { SerialTemplateModal } from './SerialTemplateModal';
import { DeleteVoucherModal, EditVoucherModal, VoucherPickerModal } from './VoucherEdit';
import { BulkDeleteModal } from './JournalListPage';
import { ScreenPrintMenu } from './ScreenPrintMenu';
import { displayName } from '../data';
import { TORIHIKI_COLOR, budgetSample, judgeTorihiki, type Torihiki7 } from '../lib/accounts';
import { addVoucher, getVouchers, useVouchers, type Voucher } from '../store/journalStore';
import { canEnterVoucher, entryBlockReason, entryDivisionsOf, type EntryDivisionCtl } from '../lib/entryDivision';
import { isViewOnly, setSession, specialRatesOf, splitSpecialAmount, useSession, type AllocationTemplate, type InputSettings, type TemplateLine } from '../store/session';

export { WATCHED, watchedStatement } from './EntryCommon';

/* ---------------- 入力設定（既存「入力の変更」＋詳細設定） ---------------- */
export function InputSettingsModal({ open, onClose, accent }: { open: boolean; onClose: () => void; accent: string }) {
  const s = useSession();
  const [v, setV] = useState<InputSettings>(s.input);
  const set = (p: Partial<InputSettings>) => setV((x) => ({ ...x, ...p }));
  return (
    <Modal open={open} onClose={onClose} width={560} title="入力の変更（詳細設定）">
      <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="伝票No"><div style={{ display: 'flex', gap: 10, fontSize: 14 }}>{(['自動', '手入力'] as const).map((o) => <label key={o} style={{ display: 'flex', gap: 5, alignItems: 'center' }}><input type="radio" checked={v.voucherNo === o} onChange={() => set({ voucherNo: o })} />{o === '自動' ? '自動伝票番号（月日ー連番）' : '伝票Noを手入力する'}</label>)}</div></Field>
          <Field label="表示フォント"><div style={{ display: 'flex', gap: 10, fontSize: 14 }}>{(['大き目', '小さ目'] as const).map((o) => <label key={o} style={{ display: 'flex', gap: 5, alignItems: 'center' }}><input type="radio" checked={v.font === o} onChange={() => set({ font: o })} />{o}</label>)}</div></Field>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <Toggle on={v.shohyo} onChange={(x) => set({ shohyo: x })} accent={accent} label="証憑の入力をする（有／無）" />
          <Toggle on={v.cheque} onChange={(x) => set({ cheque: x })} accent={accent} label="小切手Noの入力をする" />
          <Toggle on={v.tekiyoCode} onChange={(x) => set({ tekiyoCode: x })} accent={accent} label="摘要コードの入力をする（摘要辞書から検索）" />
          <Toggle on={v.gyoshaCode} onChange={(x) => set({ gyoshaCode: x })} accent={accent} label="取引先コードの入力をする（取引先から検索）" />
          <Toggle on={v.spare1} onChange={(x) => set({ spare1: x })} accent={accent} label="入力予備１を入力する（用途は自由）" />
          <Toggle on={v.spare2} onChange={(x) => set({ spare2: x })} accent={accent} label="入力予備２を入力する" />
          <Toggle on={v.keepLast} onChange={(x) => set({ keepLast: x })} accent={accent} label="登録後も直前の借方・貸方科目を残す（日付は常に残ります。続けて同じ科目で入力するとき）" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={onClose} style={btn()}>中止</button><button type="button" className="submit-btn" onClick={() => { setSession({ input: v }); onClose(); }} style={btn(accent, true)}>決定</button></div>
      </div>
    </Modal>
  );
}

/* ---------------- 取引区分バッジ ---------------- */
export function TorihikiBadge({ kari, kashi, force, blocked, right }: { kari: string; kashi: string; force: boolean; /** 登録できない仕訳（赤で表示） */ blocked?: boolean; /** バッジの右側に置くもの（資金モードの切替） */ right?: ReactNode }) {
  const j = judgeTorihiki(kari, kashi, force);
  const c = blocked ? { bg: '#fdeee9', fg: '#c0392b', note: '登録できない仕訳です。科目の下の表示を確認してください' } : j.kind === '要確認' ? { bg: '#fff6dd', fg: '#7a5600', note: '確認のうえ登録できます' } : TORIHIKI_COLOR[j.kind];
  const text = blocked ? '登録できません' : j.kind === '要確認' ? `確認が必要${j.reason ? `（${j.reason}）` : ''}` : j.kind;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <span title={c.note} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: c.bg, color: c.fg, fontSize: 14, fontWeight: 800, border: '1px solid ' + c.fg + '33', whiteSpace: 'nowrap' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.fg }} />{text}
      </span>
      {right}
    </div>
  );
}

/* ---------------- 内部取引スイッチ（相手区分の入力欄の中に置く） ---------------- */
export function InternalSwitch({ on, onToggle, disabled, locked, title, id, onNext }: { on: boolean; onToggle: () => void; disabled?: boolean; /** 内部取引科目を使っているため自動でオン（切り替え不可） */ locked?: boolean; title?: string; /** Enter 送りの順序に入れるための id */ id?: string; /** Enter で次の入力欄へ（Shift+Enter はオン／オフの切替） */ onNext?: () => void }) {
  const off = disabled || locked;
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (e.shiftKey) {
      // キーボードでの切替はカーソルをスイッチに残す（続けて Shift+Enter で戻せる。Enter で次の欄へ）
      const el = e.currentTarget;
      if (!off) { onToggle(); window.setTimeout(() => el.focus(), 10); }
      return;
    }
    onNext?.();
  };
  return (
    <button id={id} type="button" role="switch" aria-checked={on} data-menu="内部取引" className="ef-act" disabled={disabled} aria-disabled={off || undefined} onKeyDown={onKey} onClick={() => { if (!off) onToggle(); }} data-tip={off ? (title ?? (locked ? '内部取引科目（区分間繰入金など）を使っているため自動でオンです。科目を変えるとオフにできます' : undefined)) : undefined} title={off ? undefined : (title ?? (on ? '内部取引をオフにします（相手区分の入力欄を閉じます）。Shift+Enter でも切替' : '内部取引としてあつかい、相手区分を入力できるようにします。Shift+Enter でも切替'))} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '3px 4px', border: 'none', background: 'transparent', fontFamily: 'inherit', cursor: off ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: on ? '#6b3fb5' : '#5b6773', whiteSpace: 'nowrap' }}>内部取引</span>
      <span aria-hidden style={{ position: 'relative', width: 38, height: 22, borderRadius: 11, background: on ? '#6b3fb5' : '#c3ccd4', transition: 'background .15s', flex: 'none' }}>
        <span style={{ position: 'absolute', top: 2, left: 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transform: on ? 'translateX(16px)' : 'translateX(0)', transition: 'transform .15s' }} />
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: on ? '#6b3fb5' : '#8895a3', minWidth: 22, textAlign: 'left' }}>{on ? 'オン' : 'オフ'}</span>
    </button>
  );
}

/* ---------------- 内部取引の側（なし／借方／貸方。確認メモ #186） ---------------- */
const SIDE_COLOR = '#6b3fb5';
/** 貸借のどちらを内部取引にするかを選ぶ。両方を内部取引にすることはできない。←→ か Shift+Enter で切替、Enter で次の欄へ */
export function InternalSideSwitch({ side, onChange, disabled, locked, title, id, onNext }: { side: InternalSide; onChange: (s: InternalSide) => void; disabled?: boolean; /** 内部取引科目を使っているため、その側に固定（切り替え不可） */ locked?: boolean; title?: string; id?: string; onNext?: () => void }) {
  const off = disabled || locked;
  const step = (d: 1 | -1) => { if (!off) onChange(INTERNAL_SIDES[(INTERNAL_SIDES.indexOf(side) + d + INTERNAL_SIDES.length) % INTERNAL_SIDES.length]); };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing || e.altKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (e.shiftKey) { step(1); return; }
    onNext?.();
  };
  const tip = title ?? (locked ? '内部取引科目（区分間繰入金など）を使っている側に固定しています。科目を変えると選び直せます' : '貸借のどちらを内部取引にするかを選びます（両方を内部取引にすることはできません）。←→ か Shift+Enter で切替、Enter で次の欄へ');
  return (
    <div id={id} role="radiogroup" aria-label="内部取引" tabIndex={disabled ? -1 : 0} data-menu="内部取引" data-internal-side={side || 'なし'} className="ef-act" onKeyDown={onKey} title={tip} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '3px 4px', borderRadius: 8, opacity: disabled ? 0.55 : 1 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: side ? SIDE_COLOR : '#5b6773', whiteSpace: 'nowrap' }}>内部取引</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: 2, border: '1px solid #cfd8e0', borderRadius: 8, background: '#eef2f5' }}>
        {INTERNAL_SIDES.map((s) => {
          const on = s === side;
          return <button key={s || 'none'} type="button" role="radio" aria-checked={on} tabIndex={-1} data-side={s || 'なし'} disabled={disabled} aria-disabled={off || undefined} onClick={() => { if (!off) onChange(s); }} style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: on ? (s ? SIDE_COLOR : '#7a8794') : 'transparent', color: on ? '#fff' : off ? '#a9b3bd' : '#48565f', fontSize: 14, fontWeight: on ? 800 : 600, fontFamily: 'inherit', cursor: off ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>{s || 'なし'}</button>;
        })}
      </span>
    </div>
  );
}

/* ---------------- 確認ダイアログ（誤伝票／費用間／収益間） ---------------- */
export function EntryConfirmModal({ open, kind, reason, onClose, onProceed, accent, issues }: { open: boolean; kind: Torihiki7; reason?: string; onClose: () => void; onProceed: (dontShow: boolean) => void; accent: string; /** 確認して続行できる警告の一覧（指定時はこの内容を表示） */ issues?: { code: string; title: string; detail: string }[] }) {
  const [dont, setDont] = useState(false);
  if (issues && issues.length > 0) {
    const canHide = issues.some((i) => i.code === 'expense' || i.code === 'income');
    return (
      <Modal open={open} onClose={onClose} width={560} title="確認画面" strict>
        <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span aria-hidden style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff1c9', color: '#8a6200', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, flex: 'none' }}>!</span>
            <div style={{ fontSize: 14, lineHeight: 1.8 }}>登録の前に、次の内容を確認してください。<br /><span style={{ color: '#7a8794', fontSize: 14 }}>登録できない仕訳（エラー）ではありません。内容に問題がなければ、このまま登録できます。</span></div>
          </div>
          <div style={{ border: '1px solid #ecd08a', borderLeft: '5px solid #7a5600', background: '#fff6dd', borderRadius: 9, padding: '9px 12px', color: '#7a5600', fontSize: 14, lineHeight: 1.7 }}>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{issues.map((i) => <li key={i.code}><b>{i.title}</b>　<span style={{ fontWeight: 400 }}>{i.detail}</span></li>)}</ul>
          </div>
          {canHide && <label style={{ fontSize: 14, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={dont} onChange={(e) => setDont(e.target.checked)} />費用科目間・収益科目間の振替の確認を、今後は表示しない（動作環境で戻せます）</label>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="ef-act" onClick={onClose} style={btn()}>入力に戻る</button>
            <button type="button" className="ef-act" autoFocus onClick={() => onProceed(dont)} style={{ ...btn('#d99a00', true), borderColor: '#b07d00' }}>確認して登録</button>
          </div>
        </div>
      </Modal>
    );
  }
  void accent;
  const blocked = kind === '要確認' && reason === '誤伝票';
  const msg = reason === '費用間' ? '費用の科目から費用の科目に金額を振り替えようとしています。' : reason === '収益間' ? '収入の科目から収入の科目に金額を振り替えようとしています。' : '誤った伝票、または通常は入力することのない伝票です。';
  return (
    <Modal open={open} onClose={onClose} width={520} title="確認画面" strict>
      <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#fdeee9', color: '#c0392b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, flex: 'none' }}>!</span>
          <div style={{ fontSize: 14, lineHeight: 1.8 }}>{msg}<br />{blocked ? <b style={{ color: '#c0392b' }}>この伝票は登録できません。借方・貸方の科目を確認してください。</b> : '内容を確認のうえ、このまま登録する場合は「確認して登録」を押してください。'}</div>
        </div>
        {!blocked && <label style={{ fontSize: 14, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={dont} onChange={(e) => setDont(e.target.checked)} />今後、この画面を表示しない（環境設定で戻せます）</label>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={btn()}>{blocked ? 'OK' : '戻る'}</button>
          {!blocked && <button type="button" className="submit-btn" onClick={() => onProceed(dont)} style={btn(accent, true)}>確認して登録</button>}
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- 予算残・達成率（クリックで予算状況グラフ） ---------------- */
export function BudgetHintLive({ account, threshold, onOpen }: { account: string; threshold: number; onOpen: () => void }) {
  const b = budgetSample(account);
  if (!b) return <div style={{ display: 'flex', gap: 16, marginTop: 11, fontSize: 12, color: '#8290a0', padding: '5px 0' }}><span>予算残 <b style={{ color: '#7a8794', fontWeight: 600 }}>—</b></span><span>達成率 <b style={{ color: '#7a8794', fontWeight: 600 }}>—</b></span></div>;
  const over = b.rate * 100 >= threshold;
  return (
    <button type="button" onClick={onOpen} title="クリックで予算状況グラフ" style={{ display: 'flex', gap: 16, marginTop: 11, fontSize: 12, color: '#7a8794', background: over ? '#fdeee9' : '#f8fafc', border: '1px dashed ' + (over ? '#f2c9c2' : '#dde4ea'), borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left' }}>
      <span>予算残 <b style={{ color: over ? '#c0392b' : '#22303c', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{yen(b.remain)}</b></span>
      <span>達成率 <b style={{ color: over ? '#c0392b' : '#22303c', fontWeight: 700 }}>{(b.rate * 100).toFixed(1)}%</b></span>
      {over && <span style={{ marginLeft: 'auto', color: '#c0392b', fontWeight: 700 }}>予算チェック：{threshold}%超</span>}
      <span style={{ marginLeft: over ? 0 : 'auto', color: '#9aa5b1' }}>グラフ ▸</span>
    </button>
  );
}

export function BudgetGraphModal({ open, onClose, account }: { open: boolean; onClose: () => void; account: string }) {
  const b = budgetSample(account);
  // 3月の次に決算月を置く（確認メモ #185）。予算の累計は 3月で年間予算に達し、決算月は同額
  const months = ['4', '5', '6', '7', '8', '9', '10', '11', '12', '1', '2', '3', '決'];
  const series = useMemo(() => {
    if (!b) return null;
    const budgetLine = months.map((_, i) => Math.round((b.budget * Math.min(i + 1, 12)) / 12));
    const initialLine = months.map((_, i) => Math.round((b.budget * 0.95 * Math.min(i + 1, 12)) / 12));
    const actual = months.map((_, i) => (i <= 4 ? Math.round((b.actual * (i + 1)) / 5) : null));
    const remain = months.map((_, i) => (i <= 4 ? b.budget - Math.round((b.actual * (i + 1)) / 5) : null));
    return { budgetLine, initialLine, actual, remain };
  }, [b, account]);
  if (!b || !series) return null;
  const W = 640, H = 260, L = 60, R = 16, T = 16, B = 36;
  const max = Math.max(b.budget, ...series.actual.filter((x): x is number => x != null)) * 1.05;
  const x = (i: number) => L + (i * (W - L - R)) / (months.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const path = (arr: (number | null)[]) => arr.map((v, i) => (v == null ? '' : `${i === 0 || arr[i - 1] == null ? 'M' : 'L'}${x(i)},${y(v)}`)).join(' ');
  return (
    <Modal open={open} onClose={onClose} width={720} title={<>予算状況グラフ <span style={{ fontSize: 14, color: '#7a8794', fontWeight: 500, marginLeft: 8 }}>{account}</span></>}>
      <div style={{ padding: '10px 22px 18px' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', fontFamily: 'inherit' }}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(max * t)} y2={y(max * t)} stroke="#eef2f5" /><text x={L - 6} y={y(max * t) + 4} fontSize="10" textAnchor="end" fill="#8290a0">{yen(Math.round(max * t / 1000))}千</text></g>)}
          {months.map((m, i) => <text key={m} x={x(i)} y={H - 14} fontSize="10.5" textAnchor="middle" fill={m === '決' ? '#6b3fb5' : '#5b6773'} fontWeight={m === '決' ? 700 : 400}>{m === '決' ? '決算月' : `${m}月`}</text>)}
          <path d={path(series.initialLine)} fill="none" stroke="#9aa5b1" strokeWidth="1.5" strokeDasharray="4 3" />
          <path d={path(series.budgetLine)} fill="none" stroke="#2c5f9e" strokeWidth="2" />
          <path d={path(series.actual)} fill="none" stroke="#c0392b" strokeWidth="2.5" />
          <path d={path(series.remain)} fill="none" stroke="#1f7a52" strokeWidth="2" />
          {series.actual.map((v, i) => v != null && <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="#c0392b" />)}
        </svg>
        <div style={{ display: 'flex', gap: 16, fontSize: 14, color: '#5b6773', flexWrap: 'wrap', marginTop: 6 }}>
          <span><span style={{ display: 'inline-block', width: 18, height: 3, background: '#2c5f9e', verticalAlign: 'middle', marginRight: 5 }} />年間予算（累計）</span>
          <span><span style={{ display: 'inline-block', width: 18, height: 0, borderTop: '2px dashed #9aa5b1', verticalAlign: 'middle', marginRight: 5 }} />当初予算</span>
          <span><span style={{ display: 'inline-block', width: 18, height: 3, background: '#c0392b', verticalAlign: 'middle', marginRight: 5 }} />実績（累計・8月まで）</span>
          <span><span style={{ display: 'inline-block', width: 18, height: 3, background: '#1f7a52', verticalAlign: 'middle', marginRight: 5 }} />予算残高</span>
          <span style={{ marginLeft: 'auto' }}>予算 {yen(b.budget)}／実績 {yen(b.actual)}／残 {yen(b.remain)}（達成率 {(b.rate * 100).toFixed(1)}%）</span>
        </div>
        <div style={{ fontSize: 12, color: '#9aa5b1', marginTop: 6 }}>登録中・訂正中の伝票の金額はグラフに反映しません（登録後に再表示）。年間予算と当初予算が同額の場合は年間予算の線のみ表示します。</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}><button type="button" onClick={onClose} style={btn()}>閉じる</button></div>
      </div>
    </Modal>
  );
}

/* ---------------- 自動按分仕訳の実行 ---------------- */
export interface AllocatedVoucher { division: string; kari: string; kashi: string; tekiyo: string; amount: number }
export function allocate(t: AllocationTemplate, total: number): AllocatedVoucher[] {
  const round = (v: number) => (t.rounding === '切り捨て' ? Math.floor(v) : t.rounding === '切り上げ' ? Math.ceil(v) : Math.round(v));
  let rest = total;
  const out: AllocatedVoucher[] = [];
  t.lines.forEach((l, i) => {
    const last = i === t.lines.length - 1 || l.mode === '残り';
    const amount = last ? rest : round((total * l.rate) / 100);
    rest -= amount;
    out.push({ division: l.division, kari: l.kari, kashi: l.kashi, tekiyo: l.tekiyo, amount });
  });
  return out;
}
export function AllocationRunModal({ open, onClose, accent, onRegister, onNew }: { open: boolean; onClose: () => void; accent: string; onRegister: (rows: AllocatedVoucher[], date: string) => void; onNew?: () => void }) {
  const s = useSession();
  const [step, setStep] = useState(0);
  const [tid, setTid] = useState(s.allocations[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('8/20');
  const t = s.allocations.find((x) => x.id === tid);
  const rows = t && amount ? allocate(t, toInt(amount)) : [];
  const [idx, setIdx] = useState(0);
  const reset = () => { setStep(0); setAmount(''); setIdx(0); };
  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} width={640} title="自動按分仕訳 ― 按分元の金額入力" strict>
      <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        {step === 0 ? (
          <>
            <Field label="按分仕訳（テンプレート）"><div style={{ display: 'flex', gap: 8 }}><select value={tid} onChange={(e) => setTid(e.target.value)} style={input}>{s.allocations.map((a) => <option key={a.id} value={a.id}>{a.name}（{a.lines.map((l) => `${l.division.split(' ')[1]} ${l.mode === '残り' ? '残り' : l.rate + '%'}`).join('／')}）</option>)}</select>{onNew && <button type="button" className="btn-outline" onClick={onNew} style={{ ...btn(accent, false, true), flex: 'none' }}>＋ 新規登録</button>}</div></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="按分元となる金額（総金額）"><input className="field-input ring" value={amount ? yen(toInt(amount)) : ''} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="0" style={{ ...numInput, fontSize: 18, fontWeight: 700 }} /></Field>
              <Field label="年月日（令和8年）"><input className="field-input" value={date} onChange={(e) => setDate(e.target.value)} style={input} /></Field>
            </div>
            <Notice>OKを押すと、按分率に従って区分ごとの伝票を作成し、1枚ずつ金額を確認してから登録します（端数処理：{t?.rounding}）。</Notice>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => { reset(); onClose(); }} style={btn()}>中止</button><button type="button" className="submit-btn" disabled={!amount || !t} onClick={() => setStep(1)} style={{ ...btn(accent, true), opacity: amount && t ? 1 : 0.5 }}>OK</button></div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: '#5b6773' }}>作成された伝票の金額を確認してください（{idx + 1} ／ {rows.length} 枚目）</div>
            <div style={{ border: '1px solid #e2e8ee', borderRadius: 12, padding: 16, background: '#fbfcfd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#8290a0', marginBottom: 8 }}><span>伝票入力区分：<b style={{ color: '#22303c' }}>{rows[idx]?.division}</b></span><span>令和8年 {date}</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ border: '1px solid #cfe0f2', borderRadius: 10, padding: '10px 12px' }}><div style={{ fontSize: 12, color: '#2c5f9e', fontWeight: 700 }}>借方</div><div style={{ fontSize: 14.5, fontWeight: 600 }}>{rows[idx]?.kari}</div></div>
                <div style={{ border: '1px solid #f2d0dc', borderRadius: 10, padding: '10px 12px' }}><div style={{ fontSize: 12, color: '#b0426a', fontWeight: 700 }}>貸方</div><div style={{ fontSize: 14.5, fontWeight: 600 }}>{rows[idx]?.kashi}</div></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}><span style={{ fontSize: 14, color: '#5b6773' }}>摘要：{rows[idx]?.tekiyo}</span><span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>¥ {yen(rows[idx]?.amount ?? 0)}</span></div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}><tbody>{rows.map((r, i) => <tr key={i} style={{ background: i === idx ? '#fff8d6' : 'transparent' }}><td style={{ ...TD, fontSize: 14 }}>{i + 1}</td><td style={{ ...TD, fontSize: 14 }}>{r.division}</td><td style={{ ...TD, fontSize: 14 }}>{r.kari}／{r.kashi}</td><td style={{ ...NUM, fontSize: 14 }}>{yen(r.amount)}</td></tr>)}<tr style={{ background: '#f3f6f9' }}><td style={{ ...TD, fontWeight: 700 }} colSpan={3}>合計</td><td style={{ ...NUM, fontWeight: 700 }}>{yen(rows.reduce((a, r) => a + r.amount, 0))}</td></tr></tbody></table>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button type="button" onClick={() => setStep(0)} style={btn()}>戻る</button>
              <div style={{ display: 'flex', gap: 8 }}>
                {idx < rows.length - 1 ? <button type="button" className="submit-btn" onClick={() => setIdx((i) => i + 1)} style={btn(accent, true)}>次へ</button> : <button type="button" className="submit-btn" onClick={() => { onRegister(rows, date); reset(); onClose(); }} style={btn(accent, true)}>終わり（{rows.length}枚を登録）</button>}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- 特殊金額入力（金額の先頭に「＋」） ---------------- */
export function SpecialAmountModal({ open, total, account, onClose, accent, onOk }: { open: boolean; total: number; /** 按分率を引く科目。科目ごとの設定がなければ共通の按分率を使う（確認メモ #179） */ account?: string; onClose: () => void; accent: string; onOk: (parts: { division: string; amount: number }[]) => void }) {
  const s = useSession();
  const sp = specialRatesOf(s, account ?? '');
  const [parts, setParts] = useState<number[]>(() => splitSpecialAmount(s, account ?? '', total).map((p) => p.amount));
  /** 自動で調整する行＝端数の加算先区分 */
  const last = Math.max(0, sp.rates.findIndex((r) => r.division === sp.roundTo));
  const fixed = parts.map((p, i) => (i === last ? total - parts.reduce((a, b, k) => (k === last ? a : a + b), 0) : p));
  const ok = fixed.every((v) => v >= 0);
  return (
    <Modal open={open} onClose={onClose} width={520} title="特殊金額入力（区分別の金額）" strict>
      <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        <Notice>金額 <b>{yen(total)}</b> 円を、配下の伝票入力区分に按分します。{sp.byAccount ? <>科目「<b>{account}</b>」の按分率</> : '共通の按分率'}（設定「仕訳辞書」→「特殊金額の按分率」）を初期値として表示しています。端数は<b>端数の加算先区分（{sp.roundTo}）</b>に加算し、合計が一致するよう調整します。</Notice>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={TH}>伝票入力区分</th><th style={{ ...TH, textAlign: 'right', width: 80 }}>按分率</th><th style={{ ...TH, textAlign: 'right', width: 170 }}>金額</th></tr></thead>
          <tbody>{sp.rates.map((r, i) => <tr key={r.division} data-special-part={i === last ? 'round' : 'part'}><td style={TD}>{r.division}{i === last && <span style={{ marginLeft: 8, padding: '1px 7px', borderRadius: 8, background: '#eef2f5', color: '#5b6773', fontSize: 12, fontWeight: 700 }}>端数の加算先</span>}</td><td style={NUM}>{r.rate}%</td><td style={NUM}>{i === last ? <b style={{ color: fixed[i] < 0 ? '#c0392b' : '#22303c' }}>{yen(fixed[i])}</b> : <input className="field-input ring" value={yen(parts[i])} onChange={(e) => setParts((p) => p.map((v, k) => (k === i ? toInt(e.target.value) : v)))} inputMode="numeric" style={{ ...numInput, padding: '4px 8px' }} />}</td></tr>)}
            <tr style={{ background: '#f3f6f9' }}><td style={{ ...TD, fontWeight: 700 }} colSpan={2}>合計</td><td style={{ ...NUM, fontWeight: 700 }}>{yen(fixed.reduce((a, b) => a + b, 0))}</td></tr></tbody></table>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={onClose} style={btn()}>中止</button><button type="button" className="submit-btn" disabled={!ok} onClick={() => onOk(sp.rates.map((r, i) => ({ division: r.division, amount: fixed[i] })))} style={{ ...btn(accent, true), opacity: ok ? 1 : 0.5 }}>OK（{sp.rates.length}枚の伝票を作成）</button></div>
      </div>
    </Modal>
  );
}

/* ---------------- 決算附属明細書への登録（伝票入力時の監視） ---------------- */
export function AttachedStatementModal({ open, statement, entry, onClose, onDone, accent }: { open: boolean; statement: string; entry: { kari: string; kashi: string; tekiyo: string; amount: number } | null; onClose: () => void; onDone: (register: boolean) => void; accent: string }) {
  const [reg, setReg] = useState(true);
  const [purpose, setPurpose] = useState('');
  if (!entry) return null;
  return (
    <Modal open={open} onClose={onClose} width={560} title={`${statement}への登録`} strict>
      <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        <Notice>登録した伝票を{statement}へ追加しますか？（設定「決算附属明細書」で「伝票入力時に監視する」が有効のため表示しています）</Notice>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: 12, fontSize: 14 }}><b>{entry.kari}</b> ／ <b>{entry.kashi}</b>　{entry.tekiyo}　<span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{yen(entry.amount)}</span> 円<div style={{ fontSize: 12, color: '#8290a0', marginTop: 4 }}>登録伝票仕訳数：1</div></div>
        <div style={{ display: 'grid', gap: 6, fontSize: 14 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={reg} onChange={() => setReg(true)} />この金額を、{statement}データに登録する</label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={!reg} onChange={() => setReg(false)} />この金額を、{statement}データに登録しない</label>
        </div>
        {reg && <Field label="明細書に出す内容（拠点名・目的など）"><input className="field-input ring" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="例：市区町村補助金／延長保育事業" style={input} /></Field>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={onClose} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => onDone(reg)} style={btn(accent, true)}>終了</button></div>
      </div>
    </Modal>
  );
}

export const chipStyle = (on: boolean, accent: string): CSSProperties => ({ padding: '6px 14px', fontSize: 14, fontWeight: 600, borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', background: on ? accent : '#fff', color: on ? '#fff' : '#5b6773', border: '1px solid ' + (on ? accent : '#cfd8e0') });

/* ------------------------------------------------------------------ */
/* 4形式共通：機能ボタン・ショートカット・付随ダイアログ                 */
/*   ファンクションキーは使わず、機能を性質ごとにまとめて常に表示する。    */
/*   ショートカットは Alt＋英数字で、どの入力欄にいても同じ機能が動く。   */
/* ------------------------------------------------------------------ */
export interface EntryFlags { check: boolean; fusen: FusenColor; shohyo: boolean }
export interface EntryToolsOptions {
  format: EntryFormat;
  accent: string;
  /** 形式の切替・画面問合・処理終了の遷移先。未指定のときは切替を出さない */
  onNavigate?: (label: string) => void;
  toast: (m: string) => void;
  /** 入力中の内容があるか（中止・形式切替・画面移動の確認に使う） */
  dirty: boolean;
  service: string;
  month: string;
  day: string;
  /** 入力中（対象行）の科目：残高照会の先頭表示に使う */
  kari: string;
  kashi: string;
  /** 入力中の内容（自動按分の新規登録の初期値） */
  lines: TemplateLine[];
  /** 複数行の形式か（行追加・行挿入・行削除を出す） */
  multiRow: boolean;
  /** 行の操作の対象（例 '2行目'） */
  rowLabel: string;
  flags: EntryFlags;
  onFlags: (p: Partial<EntryFlags>) => void;
  fundMode: FundMode;
  onFundMode: (m: FundMode) => void;
  onSubmit: () => void;
  /** 入力中の伝票を破棄（確認後に呼ばれる） */
  onCancel: () => void;
  onRowAdd?: () => void;
  onRowInsert?: () => void;
  onRowDelete?: () => void;
  internal: boolean;
  onInternal: () => void;
  /** 内部取引にする側。指定した画面は「なし／借方／貸方」の 3 択で表示する（確認メモ #186） */
  internalSide?: InternalSide;
  onInternalSide?: (s: InternalSide) => void;
  /** 内部取引スイッチの id と、スイッチで Enter を押したときの移動先 */
  internalId?: string;
  onInternalNext?: () => void;
  /** 登録できないエラーがある（登録ボタンをグレーにする） */
  blocked?: boolean;
  /** 内部取引科目を使っているため、内部取引スイッチを自動でオンに固定する */
  internalLocked?: boolean;
  /** 自動按分などで登録した仕訳の id（一覧の強調表示用） */
  /** 伝票を削除したあと（削除した伝票の id。画面内の一覧から消すのに使う） */
  onDeleted?: (ids: number[]) => void;
  onRegistered?: (ids: number[]) => void;
  /** 伝票日付の年（令和）。指定した画面は年も入力できる（確認メモ #184 の修正） */
  year?: string;
  /** カレンダーで日付を選んだとき（year を指定した画面には年も渡す） */
  onPickDate: (month: string, day: string, year?: string) => void;
  /** 参照パネルを開く（画面問合の先頭に出す） */
  onOpenPanel?: () => void;
  /** 伝票登録ボタンの id（Enter 送りの最後にフォーカスする） */
  submitId: string;
  /** Enter 送りの順序（キーボード操作一覧に表示） */
  enterOrder: string;
}

/* ---------------- 入力区分の欄（確認メモ #157／#181／#182） ---------------- */
/** 入力区分で起動中は固定表示。親区分で起動中（入力権限あり）は、その親区分に属する入力区分から選ぶ */
export function EntryDivisionField({ ctl, id, disabled, onCommit }: { ctl: EntryDivisionCtl; id?: string; disabled?: boolean; onCommit?: () => void }) {
  const sp = ctl.division.indexOf(' ');
  const code = sp > 0 ? ctl.division.slice(0, sp) : '';
  const name = sp > 0 ? ctl.division.slice(sp + 1) : ctl.division;
  if (ctl.fixed || disabled) {
    return (
      <span className="pp-ro pp-ro-fill" data-entry-division="fixed" title={ctl.fixed && ctl.options.length ? '入力区分で起動中のため固定です。入力区分は、画面上部の区分の選択で切り替えます' : undefined} style={{ gap: 8, fontSize: 14, color: '#22303c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {code && <span className="pp-num" style={{ fontSize: 14, color: '#7a8794' }}>{code}</span>}
        <span>{name}</span>
      </span>
    );
  }
  return (
    <select id={id} className="ef-input pp-input" data-entry-division="select" aria-label="入力区分" value={ctl.division} onChange={(e) => ctl.setDivision(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCommit?.(); } }} title="起動中の親区分に属する入力区分から選びます" style={{ width: '100%', height: 34, padding: '0 8px', fontSize: 14, fontFamily: 'inherit', color: '#22303c' }}>
      {ctl.options.map((d) => <option key={d} value={d}>{d}</option>)}
    </select>
  );
}
/** 伝票日付の表示（決算月・翌年度の予備月は注記つき。確認メモ #184）。year を渡すと「令和◯年」から表示する */
export function entryDateText(month: string, day: string, year?: string): string {
  const d = parseInt(day, 10) || day;
  if (year !== undefined) {
    const em = parseEntryDate(year, month);
    if (!em.ok) return `令和${year}年${month}月${d}日`;
    return `令和${year}年${em.month}月${d}日${em.term === '決算' ? '（決算月）' : em.term === '予備' ? '（翌年度の予備月）' : ''}`;
  }
  const em = parseEntryMonth(month);
  if (!em.ok) return `${month}月${d}日`;
  return `${em.term === '決算' ? '決算月（3月）' : em.term === '予備' ? `翌年${em.month}月（予備月）` : `${em.month}月`}${d}日`;
}

export function useEntryTools(o: EntryToolsOptions) {
  const sess = useSession();
  // 予備月（翌年4〜6月）の伝票も含めて扱う（確認メモ #184）。残高には当年度の伝票だけを渡す
  const vouchers = useVouchers(true);
  const current = useMemo(() => vouchers.filter((v) => v.term !== '予備'), [vouchers]);
  // 親区分で起動中でも、配下の入力区分を選んで登録できる（確認メモ #182／#183）
  const editable = canEnterVoucher(sess);
  const reason = entryBlockReason(sess);
  const ro = !editable;
  /** 参照のみ権限：登録・訂正系のボタンは表示しない（参照の操作だけ残す） */
  const viewOnly = isViewOnly(sess);
  const [dlg, setDlg] = useState<null | '連続' | '按分' | '科目別残' | '現預金残' | 'カレンダー' | '入力の変更' | '訂正' | '削除' | '一括削除' | 'ヘルプ' | '中止'>(null);
  const [awiz, setAwiz] = useState<AllocationWiz>(null);
  const [edit, setEdit] = useState<Voucher | null>(null);
  const [del, setDel] = useState<Voucher[] | null>(null);
  /** 一括削除から開いた削除確認か（行単位の案内にする） */
  const [bulk, setBulk] = useState(false);
  const [leave, setLeave] = useState<string | null>(null);
  /** 登録の確認（確認メモ #153）。run＝確認後に実行する登録処理、back＝「入力に戻る」で戻すフォーカス */
  const [ask, setAsk] = useState<null | { run: () => void; back: HTMLElement | null }>(null);
  const askRegister = (run: () => void) => setAsk({ run, back: document.activeElement as HTMLElement | null });
  /** 「登録して印刷」で登録した伝票（確認メモ #187）。登録の前後で伝票の id を比べて取り出す */
  const [printed, setPrinted] = useState<Voucher[] | null>(null);
  const registerAndPrint = () => {
    const r = ask?.run;
    setAsk(null);
    if (!r) return;
    const before = getVouchers().reduce((m, v) => Math.max(m, v.id), 0);
    r();
    const made = getVouchers().filter((v) => v.id > before);
    if (made.length) setPrinted(made);
  };
  const name = displayName(o.format);

  const go = (label: string) => {
    if (!o.onNavigate) return;
    if (o.dirty) setLeave(label);
    else o.onNavigate(label);
  };
  const cycleFund = () => o.onFundMode(FUND_MODES[(FUND_MODES.indexOf(o.fundMode) + 1) % FUND_MODES.length]);
  const candidates = () => { if (!openCandidatesOfFocused()) o.toast('科目・摘要・取引先の入力欄で使えます（入力欄で文字を打つと候補が出ます）'); };

  const G1 = '伝票の操作', G2 = '行の操作', G3 = '入力補助', G4 = '参照';
  const shortcuts: Shortcut[] = [
    { key: 'S', label: '伝票登録', group: G1, run: o.onSubmit, disabled: ro || !!o.blocked },
    { key: 'O', label: '入力の変更（表示項目）', group: G1, run: () => setDlg('入力の変更') },
    ...(o.onNavigate ? ENTRY_FORMATS.map((k, i): Shortcut => ({ key: String(i + 1), label: `形式の切替：${displayName(k)}`, group: G1, run: () => { if (k !== o.format) go(k); } })) : []),
    ...(o.multiRow ? [
      { key: 'N', label: '行追加（最後に追加）', group: G2, run: () => o.onRowAdd?.(), disabled: ro },
      { key: 'I', label: '行挿入（対象行の上に挿入）', group: G2, run: () => o.onRowInsert?.(), disabled: ro },
      { key: 'D', label: '行削除（対象行を削除）', group: G2, run: () => o.onRowDelete?.(), disabled: ro },
    ] : []),
    { key: 'C', label: 'チェック（伝票1枚につき1つ）', group: G1, run: () => o.onFlags({ check: !o.flags.check }), disabled: ro },
    { key: 'F', label: '付箋（赤→青→黄→緑→なし。伝票1枚につき1つ）', group: G1, run: () => o.onFlags({ fusen: nextFusen(o.flags.fusen) }), disabled: ro },
    { key: 'V', label: '証憑（有／無。伝票1枚につき1つ）', group: G1, run: () => o.onFlags({ shohyo: !o.flags.shohyo }), disabled: ro },
    { key: 'J', label: '候補一覧を開く（科目・摘要・取引先・区分の検索）', group: G3, run: candidates, disabled: ro },
    { key: 'K', label: 'カレンダー', group: G3, run: () => setDlg('カレンダー'), disabled: ro },
    { key: 'R', label: '連続定型（定型の伝票をまとめて登録）', group: G3, run: () => setDlg('連続'), disabled: ro },
    { key: 'A', label: '自動按分', group: G3, run: () => setDlg('按分'), disabled: ro },
    { key: 'U', label: o.onInternalSide ? '内部取引の切替（なし→借方→貸方。欄の上では ←→ か Shift+Enter でも切替）' : '内部取引のオン／オフ（スイッチ上では Shift+Enter でも切替）', group: G3, run: o.onInternal, disabled: ro },
    { key: 'M', label: '資金モードの切替（自動資金⇄強制資金）', group: G3, run: cycleFund, disabled: ro },
    { key: 'B', label: '科目別残高', group: G4, run: () => setDlg('科目別残') },
    { key: 'Z', label: '現預金残高', group: G4, run: () => setDlg('現預金残') },
    { key: 'H', label: 'キーボード操作一覧', group: 'ヘルプ', run: () => setDlg('ヘルプ') },
  ];
  useShortcuts(shortcuts, 'page');

  const topBar: ReactNode = (
    <FormatSwitcher
      current={o.format}
      accent={o.accent}
      onSwitch={o.onNavigate ? (k) => go(k) : undefined}
    />
  );
  /** 「入力の変更」「キーボード操作一覧」は、左下の入力補助に置く（確認メモ #156）。参照のみ権限では入力補助が出ないので、参照の並びに置く */
  const settingButtons: ReactNode = (
    <>
      <ActButton label="入力の変更" k="O" accent={o.accent} onClick={() => setDlg('入力の変更')} title="伝票No・証憑・小切手No・予備入力などの表示項目を変更します" />
      <ActButton label="キーボード操作一覧" k="H" accent={o.accent} onClick={() => setDlg('ヘルプ')} title="マウスを使わない操作方法の一覧" />
    </>
  );
  const banner: ReactNode = <ReadOnlyBanner reason={reason} />;

  const why = (t: string) => (ro ? reason : t);
  /** 伝票登録ボタン（各形式の入力欄の中に置く。伝票の操作グループは廃止） */
  const submitButton: ReactNode = viewOnly ? null : <ActButton id={o.submitId} label="登録する" k="S" tone="primary" wide accent={o.accent} disabled={ro || !!o.blocked} title={ro ? reason : o.blocked ? '登録できないエラーがあります。入力欄の下の表示を直すと登録できます' : '入力中の伝票を登録します'} onClick={o.onSubmit} />;
  /** 見出し行の右端に置く「印刷」（日記帳・伝票・振替伝票）。「定型仕訳」ボタンは「連続定型」に統一したため廃止（確認メモ #202） */
  const templateButton: ReactNode = <ScreenPrintMenu page="伝票入力" accent={o.accent} tone="act" />;
  /** 資金モードの切替（自動資金⇄強制資金）。取引区分の右、または伝票の1段目の右端に置く */
  const fundSwitch: ReactNode = viewOnly ? null : (
    <span role="radiogroup" aria-label="資金モード" data-fund-switch title={ro ? reason : FUND_MODE_NOTE[o.fundMode]} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 2, padding: 2, border: '1px solid #cfd8e0', borderRadius: 8, background: '#eef2f5' }}>
      {FUND_MODES.map((m) => {
        const on = m === o.fundMode;
        return <button key={m} type="button" role="radio" aria-checked={on} tabIndex={-1} className="ef-act" data-menu={'資金モード:' + m} disabled={ro} onClick={() => o.onFundMode(m)} title={ro ? reason : FUND_MODE_NOTE[m]} style={{ padding: '4px 9px', borderRadius: 6, border: 'none', background: on ? (m === '自動資金' ? o.accent : '#6b3fb5') : 'transparent', color: on ? '#fff' : '#48565f', fontSize: 14, fontWeight: on ? 800 : 600, fontFamily: 'inherit', cursor: ro ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>{m}</button>;
      })}
    </span>
  );
  /** 内部取引スイッチ（相手区分の入力欄の中に置く） */
  const internalSwitch: ReactNode = viewOnly ? null : o.onInternalSide ? <InternalSideSwitch side={o.internalSide ?? ''} onChange={o.onInternalSide} disabled={ro} locked={o.internalLocked} title={ro ? reason : undefined} id={o.internalId} onNext={o.onInternalNext} /> : <InternalSwitch on={o.internal} onToggle={o.onInternal} disabled={ro} locked={o.internalLocked} title={ro ? reason : undefined} id={o.internalId} onNext={o.onInternalNext} />;
  const actionBar: ReactNode = (
    <div data-entry-actions style={{ display: 'grid', gridTemplateColumns: viewOnly ? '1fr' : 'minmax(0, 3fr) minmax(0, 1.25fr) minmax(0, 1.15fr)', gap: 8 }}>
      {!viewOnly && <ActionGroup caption="入力補助">
        <ActButton label="連続定型" k="R" accent={o.accent} disabled={ro} title={why('定型の伝票を一覧で開き、有効にしたものをまとめて登録します（内容の入力と有効／無効の切替もここで行います）')} onClick={() => setDlg('連続')} />
        <ActButton label="自動按分" k="A" accent={o.accent} disabled={ro} title={why('按分テンプレートで、複数の区分・科目に金額を配分します')} onClick={() => setDlg('按分')} />
        <ActButton label="カレンダー" k="K" accent={o.accent} disabled={ro} title={why('カレンダーから日付を選びます')} onClick={() => setDlg('カレンダー')} />
        {settingButtons}
      </ActionGroup>}
      <ActionGroup caption="参照">
        <ActButton label="科目別残高" k="B" accent={o.accent} onClick={() => setDlg('科目別残')} />
        <ActButton label="現預金残高" k="Z" accent={o.accent} onClick={() => setDlg('現預金残')} />
        {viewOnly && settingButtons}
      </ActionGroup>
      {!viewOnly && <ActionGroup caption="伝票の整理">
        <ActButton label="インポート伝票一括削除" tone="danger" accent={o.accent} disabled={ro} title={why('インポートで取り込んだ伝票を、取込の単位ごとにまとめて削除します')} onClick={() => setDlg('一括削除')} />
      </ActionGroup>}
    </div>
  );

  // 伝票日付の月を、残高（暦の月）とカレンダー（内部キー：1〜12／99＝決算月／13〜15＝翌年度の予備月）に分けて渡す。
  // year を指定した画面は年と月の組み合わせで判定する（確認メモ #184 の修正）
  const withYear = o.year !== undefined;
  const em = withYear ? parseEntryDate(o.year ?? '', o.month || '8') : parseEntryMonth(o.month || '8');
  const month = !em.ok ? '8' : em.term ? '3' : String(em.month);
  const calMonth = withYear ? (entryMonthKey(o.year ?? '', o.month) || '8') : em.ok ? String(parseInt(o.month.normalize('NFKC'), 10)) : '8';
  /** 連続定型のダイアログに渡す日付（年を持たない画面は内部キーから年と月に直す） */
  const serialDate = withYear ? { year: o.year ?? '', month: o.month } : entryDateOfKey(em.ok ? o.month : '8');
  const printData: TableData | null = printed ? { header: ['伝票No', '日付', '借方科目', '貸方科目', '摘要', '取引先', '金額'], rows: printed.map((v) => [v.no, v.date + (v.term === '決算' ? '（決算月）' : v.term === '予備' ? '（翌年度）' : ''), v.kari, v.kashi, v.tekiyo, v.gyosha ?? '', v.amount]) } : null;
  const mine = entryDivisionsOf(sess);
  const dialogs: ReactNode = (
    <>
      <InputSettingsModal open={dlg === '入力の変更'} onClose={() => setDlg(null)} accent={o.accent} />
      <ShortcutHelpModal open={dlg === 'ヘルプ'} onClose={() => setDlg(null)} shortcuts={shortcuts} formatName={name} enterOrder={o.enterOrder} />
      {/* 連続定型（確認メモ #202）。別ダイアログの中で伝票の入力と有効／無効の切替を行い、有効な伝票をまとめて登録する */}
      {dlg === '連続' && <SerialTemplateModal open onClose={() => setDlg(null)} accent={o.accent} format={o.format} service={o.service} year={serialDate.year} month={serialDate.month} day={o.day} toast={o.toast} onRegistered={o.onRegistered} />}
      <AllocationWizardModal awiz={awiz} setAwiz={setAwiz} accent={o.accent} onSaved={() => setDlg('按分')} />
      <AllocationRunModal
        open={dlg === '按分'}
        onClose={() => setDlg(null)}
        accent={o.accent}
        onRegister={(rows, date) => {
          // 実行ごとに固有のID（既存の GUID に相当）。一括削除はこの単位で行う（確認メモ #56）
          const runId = 'alloc-' + Date.now().toString(36);
          const ids = rows.map((r) => addVoucher({ kind: FORMAT_KIND[o.format], date, kari: r.kari, kashi: r.kashi, tekiyo: `${r.tekiyo}（${r.division.split(' ')[1] ?? r.division}）`, amount: r.amount, service: r.division, shohyo: true, source: '自動按分', from: '自動按分', batch: runId }).id);
          o.onRegistered?.(ids);
          o.toast(`自動按分：${rows.length} 枚の伝票を登録しました`);
        }}
        onNew={() => { setDlg(null); setAwiz({ step: 0, t: blankAllocation({ kari: o.kari, kashi: o.kashi, tekiyo: o.lines[0]?.tekiyo ?? '' }) }); }}
      />
      {dlg === '科目別残' && <AccountBalanceModal open onClose={() => setDlg(null)} accent={o.accent} entries={current} month={month} focus={[o.kari, o.kashi]} />}
      {dlg === '現預金残' && <CashBalanceModal open onClose={() => setDlg(null)} accent={o.accent} entries={current} month={month} focus={[o.kari, o.kashi]} />}
      {dlg === 'カレンダー' && <CalendarModal open extended onClose={() => setDlg(null)} accent={o.accent} entries={vouchers} month={calMonth} day={o.day} onPick={(m, d) => { if (withYear) { const k = entryDateOfKey(m); o.onPickDate(k.month, d, k.year); o.toast(`日付を ${entryDateText(k.month, d, k.year)} にしました`); } else { o.onPickDate(m, d); o.toast(`日付を ${entryDateText(m, d)} にしました`); } }} />}
      <VoucherPickerModal key={dlg === '削除' ? 'd' : 'e'} open={dlg === '訂正' || dlg === '削除'} mode={dlg === '削除' ? '削除' : '訂正'} onClose={() => setDlg(null)} accent={o.accent} onPick={(g) => { if (dlg === '削除') { setBulk(false); setDel(g.rows); } else setEdit(g.head); setDlg(null); }} />
      <EditVoucherModal entry voucher={edit} onClose={() => setEdit(null)} accent={o.accent} returnTo={name} />
      <DeleteVoucherModal entry multi={bulk} rows={del} onClose={() => setDel(null)} onDeleted={() => { o.onDeleted?.((del ?? []).map((r) => r.id)); o.toast(bulk ? `インポート伝票 ${(del ?? []).length} 行を削除しました` : '伝票を削除しました'); }} />
      {/* インポート伝票の一括削除（確認メモ #159）。対象は、いま登録できる入力区分の伝票 */}
      {dlg === '一括削除' && <BulkDeleteModal src="インポート" all={vouchers.filter((v) => mine.includes(v.service))} onClose={() => setDlg(null)} onConfirm={(ids) => { setDlg(null); setBulk(true); setDel(vouchers.filter((v) => ids.includes(v.id))); }} />}
      {/* 登録の確認（確認メモ #153）。Enter でそのまま登録できるよう、初期フォーカスは「登録する」 */}
      <ConfirmModal open={!!ask} title="伝票登録の確認" okLabel="登録する" focusOk accent={o.accent} extra={<button type="button" className="ef-act" data-register-print onClick={registerAndPrint} title="登録したあと、その伝票の印刷プレビューを開きます" style={btn(o.accent)}>登録して印刷</button>} onClose={() => { const b = ask?.back; setAsk(null); window.setTimeout(() => b?.focus(), 0); }} onOk={() => { const r = ask?.run; setAsk(null); r?.(); }}>
        この内容で伝票を登録しますか？
        <div data-register-confirm style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#f3f6f9', fontSize: 14, lineHeight: 1.8 }}>入力区分：<b>{o.service || '（未指定）'}</b><br />伝票日付：<b>{entryDateText(o.month, o.day, o.year)}</b></div>
      </ConfirmModal>
      {/* 登録した伝票の印刷（確認メモ #187） */}
      {printed && printData && <PreviewModal open onClose={() => setPrinted(null)} title={/振替/.test(o.format) ? '振替伝票' : '仕訳伝票'} accent={o.accent} data={printData} pages={1} />}
      <ConfirmModal open={dlg === '中止'} title="伝票中止の確認" okLabel="入力中の伝票を破棄する" danger accent={o.accent} onClose={() => setDlg(null)} onOk={() => { setDlg(null); o.onCancel(); o.toast('入力中の伝票を破棄しました'); }}>
        入力中の伝票を破棄します。<b>登録済みの伝票には影響しません。</b>
      </ConfirmModal>
      <ConfirmModal open={leave != null} title="入力中の伝票があります" okLabel={`破棄して${leave && (ENTRY_FORMATS as readonly string[]).includes(leave) ? '形式を切り替える' : '移動する'}`} danger accent={o.accent} onClose={() => setLeave(null)} onOk={() => { const to = leave; setLeave(null); if (to) o.onNavigate?.(to); }}>
        「{leave ? displayName(leave) : ''}」へ移動すると、<b>入力中（未登録）の伝票は破棄されます。</b><br />登録してから移動する場合は「入力に戻る」を押し、伝票登録を行ってください。
      </ConfirmModal>
    </>
  );

  return { topBar, banner, actionBar, submitButton, templateButton, fundSwitch, internalSwitch, dialogs, editable, reason, viewOnly, askRegister, openEdit: (v: Voucher) => setEdit(v), openDelete: (rows: Voucher[]) => { setBulk(false); setDel(rows); } };
}
