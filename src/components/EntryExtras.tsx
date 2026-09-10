// 伝票入力の強化部品（提案D／E／L）
//   入力設定ダイアログ、取引区分（7種）の表示、確認ダイアログ（誤伝票／費用間／収益間）、予算状況グラフ、
//   連続定型仕訳の呼出し、自動按分仕訳の実行、特殊金額入力、決算附属明細書への登録ダイアログ。

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { NUM, TD, TH } from './ReportShell';
import { Field, Notice, Toggle, btn, input, lbl, numInput, toInt, yen } from './ui';
import { TORIHIKI_COLOR, budgetSample, judgeTorihiki, type Torihiki7 } from '../lib/accounts';
import { setSession, useSession, type AllocationTemplate, type InputSettings, type JournalTemplate } from '../store/session';

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
export function TorihikiBadge({ kari, kashi, force, onForce }: { kari: string; kashi: string; force: boolean; onForce: (v: boolean) => void }) {
  const j = judgeTorihiki(kari, kashi, force);
  const c = TORIHIKI_COLOR[j.kind];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <span title={c.note} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: c.bg, color: c.fg, fontSize: 12.5, fontWeight: 800, border: '1px solid ' + c.fg + '33' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.fg }} />{j.kind}{j.reason ? `（${j.reason}）` : ''}
      </span>
      <label style={{ fontSize: 11, color: '#7a8794', display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={force} onChange={(e) => onForce(e.target.checked)} />強制資金（F9）</label>
    </div>
  );
}

/* ---------------- 確認ダイアログ（誤伝票／費用間／収益間） ---------------- */
export function EntryConfirmModal({ open, kind, reason, onClose, onProceed, accent }: { open: boolean; kind: Torihiki7; reason?: string; onClose: () => void; onProceed: (dontShow: boolean) => void; accent: string }) {
  const [dont, setDont] = useState(false);
  const blocked = kind === '要確認' && reason === '誤伝票';
  const msg = reason === '費用間' ? '費用の科目から費用の科目に金額を振り替えようとしています。' : reason === '収益間' ? '収入の科目から収入の科目に金額を振り替えようとしています。' : '誤った伝票、または通常は入力することのない伝票です。';
  return (
    <Modal open={open} onClose={onClose} width={520} title="確認画面" strict>
      <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#fdeee9', color: '#c0392b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, flex: 'none' }}>!</span>
          <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>{msg}<br />{blocked ? <b style={{ color: '#c0392b' }}>この伝票は登録できません。借方・貸方の科目を確認してください。</b> : '内容を確認のうえ、このまま登録する場合は「登録する」を押してください。'}</div>
        </div>
        {!blocked && <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={dont} onChange={(e) => setDont(e.target.checked)} />今後、この画面を表示しない（環境設定で戻せます）</label>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={btn()}>{blocked ? 'OK' : '戻る'}</button>
          {!blocked && <button type="button" className="submit-btn" onClick={() => onProceed(dont)} style={btn(accent, true)}>登録する</button>}
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

/* ---------------- 連続定型仕訳の呼出し ---------------- */
export function TemplatePickerModal({ open, onClose, accent, onPick }: { open: boolean; onClose: () => void; accent: string; onPick: (t: JournalTemplate) => void }) {
  const s = useSession();
  const [sel, setSel] = useState<string | null>(null);
  const t = s.templates.find((x) => x.id === sel) ?? null;
  return (
    <Modal open={open} onClose={onClose} width={720} title="連続定型仕訳ウィザード">
      <div style={{ padding: '14px 22px 18px', display: 'grid', gridTemplateColumns: '260px minmax(0,1fr)', gap: 16 }}>
        <div>
          <span style={lbl}>定型伝票一覧（ダブルクリックで呼出し）</span>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'hidden' }}>
            {s.templates.map((x) => <div key={x.id} onClick={() => setSel(x.id)} onDoubleClick={() => onPick(x)} style={{ padding: '9px 12px', borderBottom: '1px solid #f1f4f6', cursor: 'pointer', background: sel === x.id ? accent : '#fff', color: sel === x.id ? '#fff' : '#22303c', fontSize: 13 }}><div style={{ fontWeight: 700 }}>{x.name}</div><div style={{ fontSize: 11, opacity: 0.8 }}>{x.form}・{x.lines.length}行</div></div>)}
            {s.templates.length === 0 && <div style={{ padding: 20, color: '#9aa5b1', fontSize: 12.5 }}>定型仕訳がありません。設定「仕訳辞書」で登録してください。</div>}
          </div>
        </div>
        <div>
          <span style={lbl}>内容</span>
          {!t ? <div style={{ color: '#9aa5b1', fontSize: 12.5, padding: 20, border: '1px dashed #dde4ea', borderRadius: 10 }}>左の一覧から定型仕訳を選ぶと内容を表示します。</div> : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={TH}>借方</th><th style={TH}>貸方</th><th style={TH}>摘要／業者</th><th style={{ ...TH, textAlign: 'right' }}>金額</th></tr></thead><tbody>{t.lines.map((l, i) => <tr key={i}><td style={TD}>{l.kari}</td><td style={TD}>{l.kashi}</td><td style={TD}>{l.tekiyo}{l.gyosha ? `／${l.gyosha}` : ''}</td><td style={NUM}>{l.amount ? yen(Number(l.amount)) : <span style={{ color: '#9aa5b1' }}>入力</span>}</td></tr>)}</tbody></table>
              <div style={{ marginTop: 10 }}><Notice>呼び出すと入力欄に科目・摘要・業者が入ります。日付と金額を入力（または訂正）して登録してください。複数行の定型は1行ずつ順に呼び出します。</Notice></div>
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

/* ---------------- 自動按分仕訳の実行（F7） ---------------- */
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
export function AllocationRunModal({ open, onClose, accent, onRegister }: { open: boolean; onClose: () => void; accent: string; onRegister: (rows: AllocatedVoucher[], date: string) => void }) {
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
            <Field label="按分仕訳（テンプレート）"><select value={tid} onChange={(e) => setTid(e.target.value)} style={input}>{s.allocations.map((a) => <option key={a.id} value={a.id}>{a.name}（{a.lines.map((l) => `${l.division.split(' ')[1]} ${l.mode === '残り' ? '残り' : l.rate + '%'}`).join('／')}）</option>)}</select></Field>
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
export const WATCHED: { key: string; label: string; test: RegExp }[] = [
  { key: 'kifu', label: '寄附金収益明細書', test: /寄附/ },
  { key: 'hojo', label: '補助金事業等収益明細書', test: /補助金/ },
  { key: 'kihon', label: '基本金明細書', test: /基本金/ },
  { key: 'kurii', label: '事業区分間及び拠点区分間繰入金明細書', test: /繰入/ },
];
export function watchedStatement(kari: string, kashi: string) { return WATCHED.find((w) => w.test.test(kari) || w.test.test(kashi)) ?? null; }
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
