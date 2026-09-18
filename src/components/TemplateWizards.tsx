// 連続定型仕訳ウィザード／自動按分仕訳登録（テンプレートの新規登録・訂正）
//   設定「仕訳辞書」と、伝票入力の「連続定型」「自動按分」ダイアログの両方から開く共通部品。

import { Modal } from './Modal';
import { NUM, TD, TH } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { Field, Notice, Steps, btn, input, lbl, numInput, toInt, yen } from './ui';
import { ACCOUNTS, SERVICES, VENDORS } from '../data';
import { setSession, useSession, type AllocationLine, type AllocationTemplate, type JournalTemplate, type TemplateLine } from '../store/session';

const ACCTS = ACCOUNTS.flatMap((g) => g.items).concat(['水道光熱費（事務）', '寄附金収益', '基本金組入額']);
const FORMS = ['単一式', '伝票式', '振替伝票式', '振替単一式'] as const;

export type TemplateWiz = { step: number; t: JournalTemplate } | null;
export type AllocationWiz = { step: number; t: AllocationTemplate } | null;

export const blankTemplate = (line?: Partial<TemplateLine>, form: JournalTemplate['form'] = '単一式'): JournalTemplate => ({ id: 't' + Date.now(), name: '', form, lines: [{ kari: '', kashi: '', tekiyo: '', amount: '', ...line }] });
export const blankAllocation = (line?: Partial<AllocationLine>): AllocationTemplate => ({ id: 'a' + Date.now(), name: '', form: '単一式', rounding: '切り捨て', lines: [{ division: SERVICES[0], kari: '', kashi: '', tekiyo: '', rate: 50, mode: '％', ...line }, { division: SERVICES[1], kari: '', kashi: '', tekiyo: '', rate: 50, mode: '残り', ...line }] });

const sel = (v: string, onChange: (x: string) => void, opts: string[], ph = '選択') => <select value={v} onChange={(e) => onChange(e.target.value)} style={{ ...input, padding: '5px 8px', fontSize: 12.5 }}><option value="">{ph}</option>{opts.map((o) => <option key={o}>{o}</option>)}</select>;

/* ---------------- 連続定型仕訳ウィザード ---------------- */
export function TemplateWizardModal({ wiz, setWiz, accent, onSaved }: { wiz: TemplateWiz; setWiz: (w: TemplateWiz) => void; accent: string; onSaved?: (t: JournalTemplate) => void }) {
  const s = useSession();
  const toast = useToast();
  const saveT = () => {
    if (!wiz) return;
    if (!wiz.t.name.trim()) return toast.show('名称を入力してください（全角20文字まで）');
    setSession({ templates: s.templates.some((x) => x.id === wiz.t.id) ? s.templates.map((x) => (x.id === wiz.t.id ? wiz.t : x)) : [...s.templates, wiz.t] });
    setWiz(null); toast.show('定型仕訳を登録しました'); onSaved?.(wiz.t);
  };
  const updLine = (i: number, p: Partial<TemplateLine>) => wiz && setWiz({ ...wiz, t: { ...wiz.t, lines: wiz.t.lines.map((l, k) => (k === i ? { ...l, ...p } : l)) } });
  return (
    <>
      <ToastView msg={toast.msg} />
  <Modal open={!!wiz} onClose={() => setWiz(null)} width={760} title="連続定型仕訳ウィザード" strict>
    {wiz && (
      <>
        <Steps steps={['名称設定', '伝票の形式選択', '仕訳伝票（テンプレート）']} current={wiz.step} accent={accent} />
        <div style={{ padding: '18px 22px' }}>
          {wiz.step === 0 && <Field label="伝票（テンプレート）の名称（全角20文字まで）"><input className="field-input ring" value={wiz.t.name} onChange={(e) => setWiz({ ...wiz, t: { ...wiz.t, name: e.target.value.slice(0, 20) } })} style={input} autoFocus /></Field>}
          {wiz.step === 1 && <Field label="伝票の形式"><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{FORMS.map((f) => <label key={f} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', border: '1px solid ' + (wiz.t.form === f ? accent : '#e2e8ee'), borderRadius: 10, fontSize: 13, cursor: 'pointer' }}><input type="radio" checked={wiz.t.form === f} onChange={() => setWiz({ ...wiz, t: { ...wiz.t, form: f } })} />{f}</label>)}</div></Field>}
          {wiz.step === 2 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span style={lbl}>{wiz.t.name}（{wiz.t.form}）　日付・金額は未入力でも登録できます</span><button type="button" onClick={() => setWiz({ ...wiz, t: { ...wiz.t, lines: [...wiz.t.lines, { kari: '', kashi: '', tekiyo: '', amount: '' }] } })} style={{ ...btn(accent, false, true), marginLeft: 'auto' }}>F6 伝票追加</button></div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ ...TH, width: 36 }}>#</th><th style={TH}>借方</th><th style={TH}>貸方</th><th style={TH}>摘要</th><th style={{ ...TH, width: 120 }}>業者</th><th style={{ ...TH, width: 110, textAlign: 'right' }}>金額</th><th style={{ ...TH, width: 50 }} /></tr></thead>
                <tbody>{wiz.t.lines.map((l, i) => <tr key={i}><td style={TD}>{i + 1}</td><td style={TD}>{sel(l.kari, (v) => updLine(i, { kari: v }), ACCTS)}</td><td style={TD}>{sel(l.kashi, (v) => updLine(i, { kashi: v }), ACCTS)}</td><td style={TD}><input className="field-input" value={l.tekiyo} onChange={(e) => updLine(i, { tekiyo: e.target.value })} style={{ ...input, padding: '5px 8px', fontSize: 12.5 }} /></td><td style={TD}>{sel(l.gyosha ?? '', (v) => updLine(i, { gyosha: v }), VENDORS.filter((x) => x !== '（なし）'), 'なし')}</td><td style={NUM}><input className="field-input" value={l.amount ? yen(Number(l.amount)) : ''} onChange={(e) => updLine(i, { amount: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" placeholder="呼出時に入力" style={{ ...numInput, padding: '5px 8px', fontSize: 12.5 }} /></td><td style={TD}><button type="button" onClick={() => setWiz({ ...wiz, t: { ...wiz.t, lines: wiz.t.lines.filter((_, k) => k !== i) } })} style={btn('#c0392b', false, true)}>F8</button></td></tr>)}</tbody>
              </table>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <button type="button" onClick={() => (wiz.step === 0 ? setWiz(null) : setWiz({ ...wiz, step: wiz.step - 1 }))} style={btn()}>{wiz.step === 0 ? 'F11 中止' : '戻る'}</button>
            {wiz.step < 2 ? <button type="button" className="submit-btn" onClick={() => setWiz({ ...wiz, step: wiz.step + 1 })} style={btn(accent, true)}>次へ</button> : <button type="button" className="submit-btn" onClick={saveT} style={btn(accent, true)}>F12 定型登録</button>}
          </div>
        </div>
      </>
    )}
  </Modal>
    </>
  );
}

/* ---------------- 自動按分仕訳登録 ---------------- */
export function AllocationWizardModal({ awiz, setAwiz, accent, onSaved }: { awiz: AllocationWiz; setAwiz: (w: AllocationWiz) => void; accent: string; onSaved?: (t: AllocationTemplate) => void }) {
  const s = useSession();
  const toast = useToast();
  const saveA = () => {
    if (!awiz) return;
    if (!awiz.t.name.trim()) return toast.show('名称を入力してください');
    const sum = awiz.t.lines.filter((l) => l.mode !== '残り').reduce((a, l) => a + l.rate, 0);
    if (!awiz.t.lines.some((l) => l.mode === '残り') && sum !== 100) return toast.show('按分率の合計が100%になっていません（最後の行は「残りの按分率を適用する」にできます）');
    setSession({ allocations: s.allocations.some((x) => x.id === awiz.t.id) ? s.allocations.map((x) => (x.id === awiz.t.id ? awiz.t : x)) : [...s.allocations, awiz.t] });
    setAwiz(null); toast.show('自動按分仕訳を登録しました'); onSaved?.(awiz.t);
  };
  const updA = (i: number, p: Partial<AllocationLine>) => awiz && setAwiz({ ...awiz, t: { ...awiz.t, lines: awiz.t.lines.map((l, k) => (k === i ? { ...l, ...p } : l)) } });
  return (
    <>
      <ToastView msg={toast.msg} />
  <Modal open={!!awiz} onClose={() => setAwiz(null)} width={820} title="自動按分仕訳登録" strict>
    {awiz && (
      <>
        <Steps steps={['名称設定', '伝票の形式設定', '経理区分選択', '伝票・按分率設定']} current={awiz.step} accent={accent} />
        <div style={{ padding: '18px 22px' }}>
          {awiz.step === 0 && <Field label="自動按分仕訳の名称（全角20文字まで）"><input className="field-input ring" value={awiz.t.name} onChange={(e) => setAwiz({ ...awiz, t: { ...awiz.t, name: e.target.value.slice(0, 20) } })} style={input} autoFocus /></Field>}
          {awiz.step === 1 && <Field label="伝票の形式"><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{(['単一式', '伝票式'] as const).map((f) => <label key={f} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', border: '1px solid ' + (awiz.t.form === f ? accent : '#e2e8ee'), borderRadius: 10, fontSize: 13, cursor: 'pointer' }}><input type="radio" checked={awiz.t.form === f} onChange={() => setAwiz({ ...awiz, t: { ...awiz.t, form: f } })} />{f}</label>)}</div></Field>}
          {awiz.step === 2 && <><Field label="伝票を作成する伝票入力区分（伝票ごとに選択）"><div style={{ fontSize: 12.5, color: '#5b6773' }}>次のステップの各行で区分を選びます。伝票入力区分間でも按分できます。</div></Field><div style={{ marginTop: 8 }}>{SERVICES.map((sv) => <span key={sv} style={{ display: 'inline-block', padding: '4px 10px', margin: 3, background: '#eef2f6', borderRadius: 8, fontSize: 12.5 }}>{sv}</span>)}</div></>}
          {awiz.step === 3 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={lbl}>{awiz.t.name}（{awiz.t.form}）</span>
                <span style={{ marginLeft: 'auto', fontSize: 12 }}>端数処理：</span>{(['切り捨て', '四捨五入', '切り上げ'] as const).map((r) => <label key={r} style={{ fontSize: 12, display: 'flex', gap: 4 }}><input type="radio" checked={awiz.t.rounding === r} onChange={() => setAwiz({ ...awiz, t: { ...awiz.t, rounding: r } })} />{r}</label>)}
                <button type="button" onClick={() => setAwiz({ ...awiz, t: { ...awiz.t, lines: [...awiz.t.lines, { division: SERVICES[0], kari: '', kashi: '', tekiyo: '', rate: 0, mode: '残り' }] } })} style={btn(accent, false, true)}>F6 伝票追加</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ ...TH, width: 36 }}>#</th><th style={{ ...TH, width: 150 }}>伝票入力区分</th><th style={TH}>借方</th><th style={TH}>貸方</th><th style={TH}>摘要</th><th style={{ ...TH, width: 180 }}>按分率</th><th style={{ ...TH, width: 44 }} /></tr></thead>
                <tbody>{awiz.t.lines.map((l, i) => <tr key={i}><td style={TD}>{i + 1}</td><td style={TD}>{sel(l.division, (v) => updA(i, { division: v }), SERVICES)}</td><td style={TD}>{sel(l.kari, (v) => updA(i, { kari: v }), ACCTS)}</td><td style={TD}>{sel(l.kashi, (v) => updA(i, { kashi: v }), ACCTS)}</td><td style={TD}><input className="field-input" value={l.tekiyo} onChange={(e) => updA(i, { tekiyo: e.target.value })} style={{ ...input, padding: '5px 8px', fontSize: 12.5 }} /></td><td style={TD}><div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><select value={l.mode} onChange={(e) => updA(i, { mode: e.target.value as AllocationLine['mode'] })} style={{ ...input, padding: '4px 6px', fontSize: 12, width: 70 }}><option>％</option><option>分数</option><option>残り</option></select>{l.mode !== '残り' && <input className="field-input" value={String(l.rate)} onChange={(e) => updA(i, { rate: toInt(e.target.value) })} inputMode="numeric" style={{ ...numInput, width: 56, padding: '4px 6px', fontSize: 12 }} />}{l.mode === '％' && '%'}{l.mode === '分数' && <span style={{ fontSize: 11 }}>/100</span>}</div></td><td style={TD}><button type="button" onClick={() => setAwiz({ ...awiz, t: { ...awiz.t, lines: awiz.t.lines.filter((_, k) => k !== i) } })} style={btn('#c0392b', false, true)}>×</button></td></tr>)}</tbody>
              </table>
              <div style={{ marginTop: 8 }}><Notice tone="warn">最終頁（最後の行）の按分率は必ず「残りの按分率を適用する」を選びます。</Notice></div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <button type="button" onClick={() => (awiz.step === 0 ? setAwiz(null) : setAwiz({ ...awiz, step: awiz.step - 1 }))} style={btn()}>{awiz.step === 0 ? '中止' : '戻る'}</button>
            {awiz.step < 3 ? <button type="button" className="submit-btn" onClick={() => setAwiz({ ...awiz, step: awiz.step + 1 })} style={btn(accent, true)}>次へ</button> : <button type="button" className="submit-btn" onClick={saveA} style={btn(accent, true)}>F12 仕訳登録</button>}
          </div>
        </div>
      </>
    )}
  </Modal>
    </>
  );
}
