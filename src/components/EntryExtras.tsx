// 伝票入力の強化部品（提案D／E／L）
//   入力設定ダイアログ、取引区分（7種）の表示、確認ダイアログ（誤伝票／費用間／収益間）、予算状況グラフ、
//   定型仕訳・連続定型仕訳の呼出し、自動按分仕訳の実行、特殊金額入力、決算附属明細書への登録ダイアログ。
//   useEntryTools … 4形式共通の機能ボタン（伝票の操作／行の操作／入力補助／参照）とショートカット、付随するダイアログ一式
//   （依頼書 5.3.3／5.3.4／5.3.6／付録A：ファンクションキーの代替）。

import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Modal } from './Modal';
import { NUM, TD, TH } from './ReportShell';
import { Field, Notice, Toggle, btn, input, lbl, numInput, toInt, yen } from './ui';
import { ActButton, ActDivider, ActionGroup, ConfirmModal, ENTRY_FORMATS, FORMAT_KIND, FUND_MODES, FUND_MODE_NOTE, FormatSwitcher, Kbd, ReadOnlyBanner, ShortcutHelpModal, nextFusen, openCandidatesOfFocused, useShortcuts, type EntryFormat, type FundMode, type FusenColor, type Shortcut } from './EntryCommon';
import { AccountBalanceModal, CalendarModal, CashBalanceModal } from './SingleEntryTools';
import { AllocationWizardModal, TemplateWizardModal, blankAllocation, blankTemplate, type AllocationWiz, type TemplateWiz } from './TemplateWizards';
import { DeleteVoucherModal, EditVoucherModal, VoucherPickerModal } from './VoucherEdit';
import { displayName } from '../data';
import { TORIHIKI_COLOR, budgetSample, judgeTorihiki, type Torihiki7 } from '../lib/accounts';
import { addVoucher, useVouchers, type Voucher } from '../store/journalStore';
import { canEdit, editBlockReason, setSession, useSession, type AllocationTemplate, type InputSettings, type JournalTemplate, type TemplateLine } from '../store/session';

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
          <Field label="伝票No"><div style={{ display: 'flex', gap: 10, fontSize: 13 }}>{(['自動', '手入力'] as const).map((o) => <label key={o} style={{ display: 'flex', gap: 5, alignItems: 'center' }}><input type="radio" checked={v.voucherNo === o} onChange={() => set({ voucherNo: o })} />{o === '自動' ? '自動伝票番号（月日ー連番）' : '伝票Noを手入力する'}</label>)}</div></Field>
          <Field label="表示フォント"><div style={{ display: 'flex', gap: 10, fontSize: 13 }}>{(['大き目', '小さ目'] as const).map((o) => <label key={o} style={{ display: 'flex', gap: 5, alignItems: 'center' }}><input type="radio" checked={v.font === o} onChange={() => set({ font: o })} />{o}</label>)}</div></Field>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <Toggle on={v.shohyo} onChange={(x) => set({ shohyo: x })} accent={accent} label="証憑の入力をする（有／無）" />
          <Toggle on={v.cheque} onChange={(x) => set({ cheque: x })} accent={accent} label="小切手Noの入力をする" />
          <Toggle on={v.tekiyoCode} onChange={(x) => set({ tekiyoCode: x })} accent={accent} label="摘要コードの入力をする（摘要辞書から検索）" />
          <Toggle on={v.gyoshaCode} onChange={(x) => set({ gyoshaCode: x })} accent={accent} label="業者コードの入力をする（取引先から検索）" />
          <Toggle on={v.spare1} onChange={(x) => set({ spare1: x })} accent={accent} label="入力予備１を入力する（用途は自由）" />
          <Toggle on={v.spare2} onChange={(x) => set({ spare2: x })} accent={accent} label="入力予備２を入力する" />
          <Toggle on={v.keepLast} onChange={(x) => set({ keepLast: x })} accent={accent} label="前回入力した日・科目を残すようにする" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={onClose} style={btn()}>中止</button><button type="button" className="submit-btn" onClick={() => { setSession({ input: v }); onClose(); }} style={btn(accent, true)}>決定</button></div>
      </div>
    </Modal>
  );
}

/* ---------------- 取引区分バッジ ---------------- */
export function TorihikiBadge({ kari, kashi, force, onForce, blocked, fundMode }: { kari: string; kashi: string; force: boolean; /** 指定したときだけ「強制資金」の切替を表示（資金モードを別の場所で切り替える画面では省略） */ onForce?: (v: boolean) => void; /** 登録できない仕訳（赤で表示） */ blocked?: boolean; fundMode?: string }) {
  const j = judgeTorihiki(kari, kashi, force);
  const c = blocked ? { bg: '#fdeee9', fg: '#c0392b', note: '登録できない仕訳です。科目の下の表示を確認してください' } : j.kind === '要確認' ? { bg: '#fff6dd', fg: '#7a5600', note: '確認のうえ登録できます' } : TORIHIKI_COLOR[j.kind];
  const text = blocked ? '登録できません' : j.kind === '要確認' ? `確認が必要${j.reason ? `（${j.reason}）` : ''}` : j.kind;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <span title={c.note} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: c.bg, color: c.fg, fontSize: 12.5, fontWeight: 800, border: '1px solid ' + c.fg + '33', whiteSpace: 'nowrap' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.fg }} />{text}
      </span>
      {fundMode && <span style={{ fontSize: 11, color: fundMode === '自動資金' ? '#7a8794' : '#6b3fb5', fontWeight: fundMode === '自動資金' ? 500 : 700 }}>資金モード：{fundMode}</span>}
      {onForce && <label style={{ fontSize: 11, color: '#7a8794', display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={force} onChange={(e) => onForce(e.target.checked)} />強制資金</label>}
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
            <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>登録の前に、次の内容を確認してください。<br /><span style={{ color: '#7a8794', fontSize: 12.5 }}>登録できない仕訳（エラー）ではありません。内容に問題がなければ、このまま登録できます。</span></div>
          </div>
          <div style={{ border: '1px solid #ecd08a', borderLeft: '5px solid #7a5600', background: '#fff6dd', borderRadius: 9, padding: '9px 12px', color: '#7a5600', fontSize: 12.5, lineHeight: 1.7 }}>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{issues.map((i) => <li key={i.code}><b>{i.title}</b>　<span style={{ fontWeight: 400 }}>{i.detail}</span></li>)}</ul>
          </div>
          {canHide && <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={dont} onChange={(e) => setDont(e.target.checked)} />費用科目間・収益科目間の振替の確認を、今後は表示しない（動作環境で戻せます）</label>}
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
          <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>{msg}<br />{blocked ? <b style={{ color: '#c0392b' }}>この伝票は登録できません。借方・貸方の科目を確認してください。</b> : '内容を確認のうえ、このまま登録する場合は「確認して登録」を押してください。'}</div>
        </div>
        {!blocked && <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={dont} onChange={(e) => setDont(e.target.checked)} />今後、この画面を表示しない（環境設定で戻せます）</label>}
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
  if (!b) return <div style={{ display: 'flex', gap: 16, marginTop: 11, fontSize: 11, color: '#9aa5b1' }}><span>予算残 <b style={{ color: '#7a8794', fontWeight: 600 }}>—</b></span><span>達成率 <b style={{ color: '#7a8794', fontWeight: 600 }}>—</b></span></div>;
  const over = b.rate * 100 >= threshold;
  return (
    <button type="button" onClick={onOpen} title="クリックで予算状況グラフ" style={{ display: 'flex', gap: 16, marginTop: 11, fontSize: 11, color: '#7a8794', background: over ? '#fdeee9' : '#f8fafc', border: '1px dashed ' + (over ? '#f2c9c2' : '#dde4ea'), borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left' }}>
      <span>予算残 <b style={{ color: over ? '#c0392b' : '#22303c', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{yen(b.remain)}</b></span>
      <span>達成率 <b style={{ color: over ? '#c0392b' : '#22303c', fontWeight: 700 }}>{(b.rate * 100).toFixed(1)}%</b></span>
      {over && <span style={{ marginLeft: 'auto', color: '#c0392b', fontWeight: 700 }}>予算チェック：{threshold}%超</span>}
      <span style={{ marginLeft: over ? 0 : 'auto', color: '#9aa5b1' }}>グラフ ▸</span>
    </button>
  );
}

export function BudgetGraphModal({ open, onClose, account }: { open: boolean; onClose: () => void; account: string }) {
  const b = budgetSample(account);
  const months = ['4', '5', '6', '7', '8', '9', '10', '11', '12', '1', '2', '3'];
  const series = useMemo(() => {
    if (!b) return null;
    const budgetLine = months.map((_, i) => Math.round((b.budget * (i + 1)) / 12));
    const initialLine = months.map((_, i) => Math.round((b.budget * 0.95 * (i + 1)) / 12));
    const actual = months.map((_, i) => (i <= 4 ? Math.round((b.actual * (i + 1)) / 5) : null));
    const remain = months.map((_, i) => (i <= 4 ? b.budget - Math.round((b.actual * (i + 1)) / 5) : null));
    return { budgetLine, initialLine, actual, remain };
  }, [b, account]);
  if (!b || !series) return null;
  const W = 640, H = 260, L = 60, R = 16, T = 16, B = 36;
  const max = Math.max(b.budget, ...series.actual.filter((x): x is number => x != null)) * 1.05;
  const x = (i: number) => L + (i * (W - L - R)) / 11;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const path = (arr: (number | null)[]) => arr.map((v, i) => (v == null ? '' : `${i === 0 || arr[i - 1] == null ? 'M' : 'L'}${x(i)},${y(v)}`)).join(' ');
  return (
    <Modal open={open} onClose={onClose} width={720} title={<>予算状況グラフ <span style={{ fontSize: 12.5, color: '#7a8794', fontWeight: 500, marginLeft: 8 }}>{account}</span></>}>
      <div style={{ padding: '10px 22px 18px' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', fontFamily: 'inherit' }}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(max * t)} y2={y(max * t)} stroke="#eef2f5" /><text x={L - 6} y={y(max * t) + 4} fontSize="10" textAnchor="end" fill="#8290a0">{yen(Math.round(max * t / 1000))}千</text></g>)}
          {months.map((m, i) => <text key={m} x={x(i)} y={H - 14} fontSize="10.5" textAnchor="middle" fill="#5b6773">{m}月</text>)}
          <path d={path(series.initialLine)} fill="none" stroke="#9aa5b1" strokeWidth="1.5" strokeDasharray="4 3" />
          <path d={path(series.budgetLine)} fill="none" stroke="#2c5f9e" strokeWidth="2" />
          <path d={path(series.actual)} fill="none" stroke="#c0392b" strokeWidth="2.5" />
          <path d={path(series.remain)} fill="none" stroke="#1f7a52" strokeWidth="2" />
          {series.actual.map((v, i) => v != null && <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="#c0392b" />)}
        </svg>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#5b6773', flexWrap: 'wrap', marginTop: 6 }}>
          <span><span style={{ display: 'inline-block', width: 18, height: 3, background: '#2c5f9e', verticalAlign: 'middle', marginRight: 5 }} />年間予算（累計）</span>
          <span><span style={{ display: 'inline-block', width: 18, height: 0, borderTop: '2px dashed #9aa5b1', verticalAlign: 'middle', marginRight: 5 }} />当初予算</span>
          <span><span style={{ display: 'inline-block', width: 18, height: 3, background: '#c0392b', verticalAlign: 'middle', marginRight: 5 }} />実績（累計・8月まで）</span>
          <span><span style={{ display: 'inline-block', width: 18, height: 3, background: '#1f7a52', verticalAlign: 'middle', marginRight: 5 }} />予算残高</span>
          <span style={{ marginLeft: 'auto' }}>予算 {yen(b.budget)}／実績 {yen(b.actual)}／残 {yen(b.remain)}（達成率 {(b.rate * 100).toFixed(1)}%）</span>
        </div>
        <div style={{ fontSize: 11.5, color: '#9aa5b1', marginTop: 6 }}>登録中・訂正中の伝票の金額はグラフに反映しません（登録後に再表示）。年間予算と当初予算が同額の場合は年間予算の線のみ表示します。</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}><button type="button" onClick={onClose} style={btn()}>閉じる</button></div>
      </div>
    </Modal>
  );
}

/* ---------------- 定型仕訳・連続定型仕訳の呼出し ---------------- */
export function TemplatePickerModal({ open, onClose, accent, onPick, onNew, mode = '連続' }: { open: boolean; onClose: () => void; accent: string; onPick: (t: JournalTemplate) => void; onNew?: () => void; /** 定型＝入力中の伝票に呼び出す／連続＝テンプレートの行を1枚ずつ続けて登録する */ mode?: '定型' | '連続' }) {
  const s = useSession();
  const [sel, setSel] = useState<string | null>(null);
  const t = s.templates.find((x) => x.id === sel) ?? null;
  const move = (dir: 1 | -1) => {
    if (s.templates.length === 0) return;
    const i = s.templates.findIndex((x) => x.id === sel);
    setSel(s.templates[Math.max(0, Math.min(s.templates.length - 1, i < 0 ? 0 : i + dir))].id);
  };
  return (
    <Modal open={open} onClose={onClose} width={720} title={mode === '定型' ? '定型仕訳の呼び出し' : '連続定型仕訳ウィザード'}>
      <div style={{ padding: '14px 22px 18px', display: 'grid', gridTemplateColumns: '260px minmax(0,1fr)', gap: 16 }}>
        <div>
          <span style={lbl}>定型伝票一覧（↑↓ で選び Enter で呼出し）</span>
          <div tabIndex={0} role="listbox" aria-label="定型伝票一覧" ref={(el) => { if (el && open && !el.dataset.f) { el.dataset.f = '1'; el.focus(); } }} onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); move(1); } if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); } if (e.key === 'Enter' && t) { e.preventDefault(); onPick(t); } }} className="ef-input" style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
            {s.templates.map((x) => <div key={x.id} onClick={() => setSel(x.id)} onDoubleClick={() => onPick(x)} style={{ padding: '9px 12px', borderBottom: '1px solid #f1f4f6', cursor: 'pointer', background: sel === x.id ? accent : '#fff', color: sel === x.id ? '#fff' : '#22303c', fontSize: 13 }}><div style={{ fontWeight: 700 }}>{x.name}</div><div style={{ fontSize: 11, opacity: 0.8 }}>{x.form}・{x.lines.length}行</div></div>)}
            {s.templates.length === 0 && <div style={{ padding: 20, color: '#9aa5b1', fontSize: 12.5 }}>定型仕訳がありません。「新規登録」または設定「仕訳辞書」で登録してください。</div>}
          </div>
          {onNew && <button type="button" className="btn-outline" onClick={onNew} style={{ ...btn(accent, false, true), marginTop: 8, width: '100%' }}>＋ 新規登録（入力中の内容から定型を作る）</button>}
        </div>
        <div>
          <span style={lbl}>内容</span>
          {!t ? <div style={{ color: '#9aa5b1', fontSize: 12.5, padding: 20, border: '1px dashed #dde4ea', borderRadius: 10 }}>左の一覧から定型仕訳を選ぶと内容を表示します。</div> : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={TH}>借方</th><th style={TH}>貸方</th><th style={TH}>摘要／業者</th><th style={{ ...TH, textAlign: 'right' }}>金額</th></tr></thead><tbody>{t.lines.map((l, i) => <tr key={i}><td style={TD}>{l.kari}</td><td style={TD}>{l.kashi}</td><td style={TD}>{l.tekiyo}{l.gyosha ? `／${l.gyosha}` : ''}</td><td style={NUM}>{l.amount ? yen(Number(l.amount)) : <span style={{ color: '#9aa5b1' }}>入力</span>}</td></tr>)}</tbody></table>
              <div style={{ marginTop: 10 }}><Notice>{mode === '定型' ? '呼び出すと、入力中の伝票に科目・摘要・業者・金額が入ります。日付と金額を入力（または訂正）して登録してください。' : '呼び出すと、定型の1行目が入力欄に入ります。登録すると次の行を順に呼び出し、複数の伝票を続けて登録できます。'}</Notice></div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={onClose} style={btn()}>中止</button>
            <button type="button" className="submit-btn" disabled={!t} onClick={() => t && onPick(t)} style={{ ...btn(accent, true), opacity: t ? 1 : 0.5 }}>入力欄へ呼び出す</button>
          </div>
        </div>
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
            <div style={{ fontSize: 12.5, color: '#5b6773' }}>作成された伝票の金額を確認してください（{idx + 1} ／ {rows.length} 枚目）</div>
            <div style={{ border: '1px solid #e2e8ee', borderRadius: 12, padding: 16, background: '#fbfcfd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8290a0', marginBottom: 8 }}><span>伝票入力区分：<b style={{ color: '#22303c' }}>{rows[idx]?.division}</b></span><span>令和8年 {date}</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ border: '1px solid #cfe0f2', borderRadius: 10, padding: '10px 12px' }}><div style={{ fontSize: 11, color: '#2c5f9e', fontWeight: 700 }}>借方</div><div style={{ fontSize: 14.5, fontWeight: 600 }}>{rows[idx]?.kari}</div></div>
                <div style={{ border: '1px solid #f2d0dc', borderRadius: 10, padding: '10px 12px' }}><div style={{ fontSize: 11, color: '#b0426a', fontWeight: 700 }}>貸方</div><div style={{ fontSize: 14.5, fontWeight: 600 }}>{rows[idx]?.kashi}</div></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}><span style={{ fontSize: 12.5, color: '#5b6773' }}>摘要：{rows[idx]?.tekiyo}</span><span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>¥ {yen(rows[idx]?.amount ?? 0)}</span></div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}><tbody>{rows.map((r, i) => <tr key={i} style={{ background: i === idx ? '#fff8d6' : 'transparent' }}><td style={{ ...TD, fontSize: 12 }}>{i + 1}</td><td style={{ ...TD, fontSize: 12 }}>{r.division}</td><td style={{ ...TD, fontSize: 12 }}>{r.kari}／{r.kashi}</td><td style={{ ...NUM, fontSize: 12 }}>{yen(r.amount)}</td></tr>)}<tr style={{ background: '#f3f6f9' }}><td style={{ ...TD, fontWeight: 700 }} colSpan={3}>合計</td><td style={{ ...NUM, fontWeight: 700 }}>{yen(rows.reduce((a, r) => a + r.amount, 0))}</td></tr></tbody></table>
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
export function SpecialAmountModal({ open, total, onClose, accent, onOk }: { open: boolean; total: number; onClose: () => void; accent: string; onOk: (parts: { division: string; amount: number }[]) => void }) {
  const s = useSession();
  const [parts, setParts] = useState<number[]>(() => s.specialRates.map((r, i) => (i === s.specialRates.length - 1 ? 0 : Math.floor((total * r.rate) / 100))));
  const sum = parts.reduce((a, b) => a + b, 0);
  const last = s.specialRates.length - 1;
  const fixed = parts.map((p, i) => (i === last ? total - parts.slice(0, last).reduce((a, b) => a + b, 0) : p));
  const ok = fixed.every((v) => v >= 0);
  return (
    <Modal open={open} onClose={onClose} width={520} title="特殊金額入力（区分別の金額）" strict>
      <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        <Notice>金額 <b>{yen(total)}</b> 円を、配下の伝票入力区分に按分します。按分率（設定「仕訳辞書」→「特殊金額の按分率」）を初期値として表示しています。合計が一致するよう最後の区分で調整します。</Notice>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={TH}>伝票入力区分</th><th style={{ ...TH, textAlign: 'right', width: 80 }}>按分率</th><th style={{ ...TH, textAlign: 'right', width: 170 }}>金額</th></tr></thead>
          <tbody>{s.specialRates.map((r, i) => <tr key={r.division}><td style={TD}>{r.division}</td><td style={NUM}>{r.rate}%</td><td style={NUM}>{i === last ? <b style={{ color: fixed[i] < 0 ? '#c0392b' : '#22303c' }}>{yen(fixed[i])}</b> : <input className="field-input ring" value={yen(parts[i])} onChange={(e) => setParts((p) => p.map((v, k) => (k === i ? toInt(e.target.value) : v)))} inputMode="numeric" style={{ ...numInput, padding: '4px 8px' }} />}</td></tr>)}
            <tr style={{ background: '#f3f6f9' }}><td style={{ ...TD, fontWeight: 700 }} colSpan={2}>合計</td><td style={{ ...NUM, fontWeight: 700 }}>{yen(sum - parts[last] + fixed[last])}</td></tr></tbody></table>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={onClose} style={btn()}>中止</button><button type="button" className="submit-btn" disabled={!ok} onClick={() => onOk(s.specialRates.map((r, i) => ({ division: r.division, amount: fixed[i] })))} style={{ ...btn(accent, true), opacity: ok ? 1 : 0.5 }}>OK（{s.specialRates.length}枚の伝票を作成）</button></div>
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
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: 12, fontSize: 13 }}><b>{entry.kari}</b> ／ <b>{entry.kashi}</b>　{entry.tekiyo}　<span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{yen(entry.amount)}</span> 円<div style={{ fontSize: 11.5, color: '#8290a0', marginTop: 4 }}>登録伝票仕訳数：1</div></div>
        <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={reg} onChange={() => setReg(true)} />この金額を、{statement}データに登録する</label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={!reg} onChange={() => setReg(false)} />この金額を、{statement}データに登録しない</label>
        </div>
        {reg && <Field label="明細書に出す内容（拠点名・目的など）"><input className="field-input ring" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="例：市区町村補助金／延長保育事業" style={input} /></Field>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={onClose} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => onDone(reg)} style={btn(accent, true)}>終了</button></div>
      </div>
    </Modal>
  );
}

export const chipStyle = (on: boolean, accent: string): CSSProperties => ({ padding: '6px 14px', fontSize: 12.5, fontWeight: 600, borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', background: on ? accent : '#fff', color: on ? '#fff' : '#5b6773', border: '1px solid ' + (on ? accent : '#cfd8e0') });

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
  /** 入力中の内容（「仕訳登録＝定型として登録」の初期値） */
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
  onLoadTemplate: (t: JournalTemplate, mode: '定型' | '連続') => void;
  /** 自動按分などで登録した仕訳の id（一覧の強調表示用） */
  onRegistered?: (ids: number[]) => void;
  onPickDate: (month: string, day: string) => void;
  /** 参照パネルを開く（画面問合の先頭に出す） */
  onOpenPanel?: () => void;
  /** 伝票登録ボタンの id（Enter 送りの最後にフォーカスする） */
  submitId: string;
  /** Enter 送りの順序（キーボード操作一覧に表示） */
  enterOrder: string;
}

const TEMPLATE_FORM: Record<EntryFormat, JournalTemplate['form']> = { 伝票入力: '伝票式', 単一入力: '単一式', 振替入力: '振替伝票式', 振替単一: '振替単一式' };
const INQUIRY_TARGETS = ['仕訳一覧', '勘定元帳', '資金元帳', '業者元帳', '月次試算', '元帳１', '元帳２', '残高照合'];

export function useEntryTools(o: EntryToolsOptions) {
  const sess = useSession();
  const vouchers = useVouchers();
  const editable = canEdit(sess);
  const reason = editBlockReason(sess);
  const ro = !editable;
  const [dlg, setDlg] = useState<null | '定型' | '連続' | '按分' | '科目別残' | '現預金残' | 'カレンダー' | '入力の変更' | '訂正' | '削除' | 'ヘルプ' | '問合' | '中止'>(null);
  const [wiz, setWiz] = useState<TemplateWiz>(null);
  const [awiz, setAwiz] = useState<AllocationWiz>(null);
  const [edit, setEdit] = useState<Voucher | null>(null);
  const [del, setDel] = useState<Voucher[] | null>(null);
  const [leave, setLeave] = useState<string | null>(null);
  const name = displayName(o.format);

  const go = (label: string) => {
    if (!o.onNavigate) return;
    if (o.dirty) setLeave(label);
    else o.onNavigate(label);
  };
  const cancel = () => {
    if (ro) return;
    if (!o.dirty) { o.toast('入力中の伝票はありません'); return; }
    setDlg('中止');
  };
  const cycleFund = () => o.onFundMode(FUND_MODES[(FUND_MODES.indexOf(o.fundMode) + 1) % FUND_MODES.length]);
  const saveAsTemplate = () => {
    const lines = o.lines.filter((l) => l.kari || l.kashi || l.tekiyo || l.amount);
    const t = blankTemplate(lines[0], TEMPLATE_FORM[o.format]);
    setWiz({ step: 0, t: { ...t, lines: lines.length ? lines : t.lines } });
  };
  const candidates = () => { if (!openCandidatesOfFocused()) o.toast('科目・摘要・業者の入力欄で使えます（入力欄で文字を打つと候補が出ます）'); };

  const G1 = '伝票の操作', G2 = '行の操作', G3 = '入力補助', G4 = '参照';
  const shortcuts: Shortcut[] = [
    { key: 'S', label: '伝票登録', group: G1, run: o.onSubmit, disabled: ro },
    { key: 'Q', label: '伝票中止（入力中の伝票を破棄）', group: G1, run: cancel, disabled: ro },
    { key: 'E', label: '伝票訂正（登録済みの伝票を選ぶ）', group: G1, run: () => setDlg('訂正'), disabled: ro },
    { key: 'X', label: '伝票削除（登録済みの伝票を選ぶ）', group: G1, run: () => setDlg('削除'), disabled: ro },
    { key: 'O', label: '入力の変更（表示項目）', group: G1, run: () => setDlg('入力の変更') },
    ...(o.onNavigate ? ENTRY_FORMATS.map((k, i): Shortcut => ({ key: String(i + 1), label: `形式の切替：${displayName(k)}`, group: G1, run: () => { if (k !== o.format) go(k); } })) : []),
    ...(o.onNavigate ? [{ key: 'L', label: '処理終了（伝票入力を終わる）', group: G1, run: () => go('ホーム') }] : []),
    ...(o.multiRow ? [
      { key: 'N', label: '行追加（最後に追加）', group: G2, run: () => o.onRowAdd?.(), disabled: ro },
      { key: 'I', label: '行挿入（対象行の上に挿入）', group: G2, run: () => o.onRowInsert?.(), disabled: ro },
      { key: 'D', label: '行削除（対象行を削除）', group: G2, run: () => o.onRowDelete?.(), disabled: ro },
    ] : []),
    { key: 'C', label: 'チェック', group: G2, run: () => o.onFlags({ check: !o.flags.check }), disabled: ro },
    { key: 'F', label: '付箋（赤→青→黄→緑→なし）', group: G2, run: () => o.onFlags({ fusen: nextFusen(o.flags.fusen) }), disabled: ro },
    { key: 'V', label: '証憑（有／無）', group: G2, run: () => o.onFlags({ shohyo: !o.flags.shohyo }), disabled: ro },
    { key: 'J', label: '候補一覧を開く（科目・摘要・業者・区分の検索）', group: G3, run: candidates, disabled: ro },
    { key: 'K', label: 'カレンダー', group: G3, run: () => setDlg('カレンダー'), disabled: ro },
    { key: 'T', label: '定型仕訳', group: G3, run: () => setDlg('定型'), disabled: ro },
    { key: 'R', label: '連続定型', group: G3, run: () => setDlg('連続'), disabled: ro },
    { key: 'A', label: '自動按分', group: G3, run: () => setDlg('按分'), disabled: ro },
    { key: 'G', label: '仕訳登録（入力中の伝票を定型として登録）', group: G3, run: saveAsTemplate, disabled: ro },
    { key: 'U', label: '内部取引（相手区分の入力欄を開く）', group: G3, run: o.onInternal, disabled: ro },
    { key: 'M', label: '資金モードの切替（自動資金→強制資金→非資金）', group: G3, run: cycleFund, disabled: ro },
    { key: 'B', label: '科目別残高', group: G4, run: () => setDlg('科目別残') },
    { key: 'Z', label: '現預金残高', group: G4, run: () => setDlg('現預金残') },
    { key: 'W', label: '画面問合（問合せ画面・参照パネル）', group: G4, run: () => setDlg('問合') },
    { key: 'H', label: 'キーボード操作一覧', group: 'ヘルプ', run: () => setDlg('ヘルプ') },
  ];
  useShortcuts(shortcuts, 'page');

  const topBar: ReactNode = (
    <FormatSwitcher
      current={o.format}
      accent={o.accent}
      onSwitch={o.onNavigate ? (k) => go(k) : undefined}
      right={
        <>
          <ActButton label="入力の変更" k="O" accent={o.accent} onClick={() => setDlg('入力の変更')} title="伝票No・証憑・小切手No・予備入力などの表示項目を変更します" />
          <ActButton label="キーボード操作一覧" k="H" accent={o.accent} onClick={() => setDlg('ヘルプ')} title="マウスを使わない操作方法の一覧" />
        </>
      }
    />
  );
  const banner: ReactNode = <ReadOnlyBanner reason={reason} />;

  const why = (t: string) => (ro ? reason : t);
  const actionBar: ReactNode = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 8 }}>
      <ActionGroup caption="伝票の操作" note={name}>
        <ActButton id={o.submitId} label="伝票登録" k="S" tone="primary" accent={o.accent} disabled={ro} title={why('入力中の伝票を登録します')} onClick={o.onSubmit} />
        <ActButton label="伝票中止" k="Q" accent={o.accent} disabled={ro} title={why('入力中の伝票を破棄します（確認あり）')} onClick={cancel} />
        <ActButton label="伝票訂正" k="E" accent={o.accent} disabled={ro} title={why('登録済みの伝票を選んで訂正します')} onClick={() => setDlg('訂正')} />
        {o.onNavigate && <ActButton label="処理終了" k="L" accent={o.accent} title="伝票入力を終わり、ホームへ戻ります" onClick={() => go('ホーム')} />}
        <ActDivider />
        <ActButton label="伝票削除" k="X" tone="danger" disabled={ro} title={why('登録済みの伝票を選んで削除します（確認画面のあとに削除）')} onClick={() => setDlg('削除')} />
      </ActionGroup>
      <ActionGroup caption="行の操作" note={<span style={{ color: o.accent }}>対象：{o.rowLabel}</span>}>
        {o.multiRow && <ActButton label="行追加" k="N" accent={o.accent} disabled={ro} title={why('最後に1行追加します')} onClick={() => o.onRowAdd?.()} />}
        {o.multiRow && <ActButton label="行挿入" k="I" accent={o.accent} disabled={ro} title={why(`${o.rowLabel}の上に1行挿入します`)} onClick={() => o.onRowInsert?.()} />}
        {o.multiRow && <ActButton label="行削除" k="D" accent={o.accent} disabled={ro} title={why(`${o.rowLabel}を削除します`)} onClick={() => o.onRowDelete?.()} />}
        <ActButton label="チェック" k="C" accent={o.accent} disabled={ro} active={o.flags.check} title={why('チェック印を付ける／外す')} onClick={() => o.onFlags({ check: !o.flags.check })} />
        <ActButton label={<>付箋{o.flags.fusen ? `：${o.flags.fusen}` : ''}</>} menu="付箋" k="F" accent={o.accent} disabled={ro} active={!!o.flags.fusen} title={why('押すごとに 赤→青→黄→緑→なし')} onClick={() => o.onFlags({ fusen: nextFusen(o.flags.fusen) })} />
        <ActButton label={<>証憑：{o.flags.shohyo ? '有' : '無'}</>} menu="証憑" k="V" accent={o.accent} disabled={ro} active={o.flags.shohyo} title={why('証憑の 有／無 を切り替えます')} onClick={() => o.onFlags({ shohyo: !o.flags.shohyo })} />
      </ActionGroup>
      <ActionGroup caption="入力補助">
        <ActButton label="定型仕訳" k="T" accent={o.accent} disabled={ro} title={why('登録済みの定型仕訳を、入力中の伝票に呼び出します')} onClick={() => setDlg('定型')} />
        <ActButton label="連続定型" k="R" accent={o.accent} disabled={ro} title={why('テンプレートから複数の伝票を続けて登録します')} onClick={() => setDlg('連続')} />
        <ActButton label="自動按分" k="A" accent={o.accent} disabled={ro} title={why('按分テンプレートで、複数の区分・科目に金額を配分します')} onClick={() => setDlg('按分')} />
        <ActButton label="仕訳登録" k="G" accent={o.accent} disabled={ro} title={why('入力中の伝票を、定型仕訳として登録します')} onClick={saveAsTemplate} />
        <ActButton label="カレンダー" k="K" accent={o.accent} disabled={ro} title={why('カレンダーから日付を選びます')} onClick={() => setDlg('カレンダー')} />
        <ActButton label="候補一覧" k="J" accent={o.accent} disabled={ro} title={why('入力中の欄（科目・摘要・業者・区分）の候補一覧を開きます。入力欄で文字を打っても候補が出ます')} onClick={candidates} />
        <ActButton label="内部取引" k="U" accent={o.accent} disabled={ro} active={o.internal} title={why('内部取引として指定し、相手区分の入力欄を開きます')} onClick={o.onInternal} />
        <span role="radiogroup" aria-label="資金モード" title={ro ? reason : FUND_MODE_NOTE[o.fundMode]} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: 2, border: '1px solid #cfd8e0', borderRadius: 8, background: '#eef2f5' }}>
          {FUND_MODES.map((m) => {
            const on = m === o.fundMode;
            return <button key={m} type="button" role="radio" aria-checked={on} className="ef-act" data-menu={'資金モード:' + m} disabled={ro} onClick={() => o.onFundMode(m)} title={ro ? reason : FUND_MODE_NOTE[m]} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: on ? (m === '自動資金' ? o.accent : '#6b3fb5') : 'transparent', color: on ? '#fff' : '#48565f', fontSize: 12, fontWeight: on ? 800 : 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>{m}</button>;
          })}
          <span style={{ color: '#5b6773', paddingRight: 5 }}><Kbd k="Alt+M" /></span>
        </span>
      </ActionGroup>
      <ActionGroup caption="参照">
        <ActButton label="科目別残高" k="B" accent={o.accent} onClick={() => setDlg('科目別残')} />
        <ActButton label="現預金残高" k="Z" accent={o.accent} onClick={() => setDlg('現預金残')} />
        <ActButton label="画面問合" k="W" accent={o.accent} title="参照パネルや問合せ画面（日記帳・元帳・試算表など）を開きます" onClick={() => setDlg('問合')} />
      </ActionGroup>
    </div>
  );

  const month = o.month || '8';
  const dialogs: ReactNode = (
    <>
      <InputSettingsModal open={dlg === '入力の変更'} onClose={() => setDlg(null)} accent={o.accent} />
      <ShortcutHelpModal open={dlg === 'ヘルプ'} onClose={() => setDlg(null)} shortcuts={shortcuts} formatName={name} enterOrder={o.enterOrder} />
      <TemplatePickerModal
        key={dlg === '定型' ? 't' : 'r'}
        open={dlg === '定型' || dlg === '連続'}
        mode={dlg === '定型' ? '定型' : '連続'}
        onClose={() => setDlg(null)}
        accent={o.accent}
        onPick={(t) => { const m = dlg === '定型' ? '定型' : '連続'; setDlg(null); o.onLoadTemplate(t, m); }}
        onNew={() => { setDlg(null); saveAsTemplate(); }}
      />
      <TemplateWizardModal wiz={wiz} setWiz={setWiz} accent={o.accent} onSaved={() => o.toast('定型仕訳として登録しました。「定型仕訳」「連続定型」から呼び出せます')} />
      <AllocationWizardModal awiz={awiz} setAwiz={setAwiz} accent={o.accent} onSaved={() => setDlg('按分')} />
      <AllocationRunModal
        open={dlg === '按分'}
        onClose={() => setDlg(null)}
        accent={o.accent}
        onRegister={(rows, date) => {
          const ids = rows.map((r) => addVoucher({ kind: FORMAT_KIND[o.format], date, kari: r.kari, kashi: r.kashi, tekiyo: `${r.tekiyo}（${r.division.split(' ')[1] ?? r.division}）`, amount: r.amount, service: r.division, shohyo: true }).id);
          o.onRegistered?.(ids);
          o.toast(`自動按分：${rows.length} 枚の伝票を登録しました`);
        }}
        onNew={() => { setDlg(null); setAwiz({ step: 0, t: blankAllocation({ kari: o.kari, kashi: o.kashi, tekiyo: o.lines[0]?.tekiyo ?? '' }) }); }}
      />
      {dlg === '科目別残' && <AccountBalanceModal open onClose={() => setDlg(null)} accent={o.accent} entries={vouchers} month={month} focus={[o.kari, o.kashi]} />}
      {dlg === '現預金残' && <CashBalanceModal open onClose={() => setDlg(null)} accent={o.accent} entries={vouchers} month={month} focus={[o.kari, o.kashi]} />}
      {dlg === 'カレンダー' && <CalendarModal open onClose={() => setDlg(null)} accent={o.accent} entries={vouchers} month={month} day={o.day} onPick={(m, d) => { o.onPickDate(m, d); o.toast(`日付を ${m}月${d}日 にしました`); }} />}
      <VoucherPickerModal key={dlg === '削除' ? 'd' : 'e'} open={dlg === '訂正' || dlg === '削除'} mode={dlg === '削除' ? '削除' : '訂正'} onClose={() => setDlg(null)} accent={o.accent} onPick={(g) => { if (dlg === '削除') setDel(g.rows); else setEdit(g.head); setDlg(null); }} />
      <EditVoucherModal voucher={edit} onClose={() => setEdit(null)} accent={o.accent} returnTo={name} />
      <DeleteVoucherModal rows={del} onClose={() => setDel(null)} onDeleted={() => o.toast('伝票を削除しました')} />
      <ConfirmModal open={dlg === '中止'} title="伝票中止の確認" okLabel="入力中の伝票を破棄する" danger accent={o.accent} onClose={() => setDlg(null)} onOk={() => { setDlg(null); o.onCancel(); o.toast('入力中の伝票を破棄しました'); }}>
        入力中の伝票を破棄します。<b>登録済みの伝票には影響しません。</b>
      </ConfirmModal>
      <ConfirmModal open={leave != null} title="入力中の伝票があります" okLabel={`破棄して${leave && (ENTRY_FORMATS as readonly string[]).includes(leave) ? '形式を切り替える' : '移動する'}`} danger accent={o.accent} onClose={() => setLeave(null)} onOk={() => { const to = leave; setLeave(null); if (to) o.onNavigate?.(to); }}>
        「{leave ? displayName(leave) : ''}」へ移動すると、<b>入力中（未登録）の伝票は破棄されます。</b><br />登録してから移動する場合は「入力に戻る」を押し、伝票登録を行ってください。
      </ConfirmModal>
      <Modal open={dlg === '問合'} onClose={() => setDlg(null)} width={520} title="画面問合">
        <div
          style={{ padding: '12px 22px 18px', display: 'grid', gap: 6 }}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            const list = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-inq]'));
            const i = list.indexOf(document.activeElement as HTMLButtonElement);
            e.preventDefault();
            list[Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
          }}
        >
          <div style={{ fontSize: 12, color: '#7a8794', marginBottom: 4 }}>↑↓ で選び Enter で開きます。</div>
          {o.onOpenPanel && <button type="button" data-inq className="ef-act ef-input" autoFocus onClick={() => { setDlg(null); o.onOpenPanel?.(); }} style={{ ...btn(o.accent), textAlign: 'left', padding: '10px 14px' }}>参照パネルを開く<span style={{ fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>伝票入力のまま、日記帳・元帳・残高照合を横に表示</span></button>}
          {o.onNavigate ? INQUIRY_TARGETS.map((t, i) => (
            <button key={t} type="button" data-inq className="ef-act ef-input" autoFocus={!o.onOpenPanel && i === 0} onClick={() => { setDlg(null); go(t); }} style={{ ...btn(), textAlign: 'left', padding: '10px 14px' }}>{displayName(t)}<span style={{ fontWeight: 500, color: '#9aa5b1', marginLeft: 8 }}>画面を移動</span></button>
          )) : <Notice>問合せ画面への移動は、上部のメニューから行えます。</Notice>}
          {o.dirty && o.onNavigate && <Notice tone="warn">入力中（未登録）の伝票があります。画面を移動する前に確認を表示します。</Notice>}
        </div>
      </Modal>
    </>
  );

  return { topBar, banner, actionBar, dialogs, editable, reason, openEdit: (v: Voucher) => setEdit(v), openDelete: (rows: Voucher[]) => setDel(rows) };
}
