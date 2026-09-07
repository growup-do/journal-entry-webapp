// 充実残額（既存「簡易充実残額シミュレーター」の再現）
//   起動時：①確認画面（保存されない旨・シミュレーターである旨 → 了解チェック）→ ②金額入力方式の選択 → 本体。
//   本体：1. 活用可能な財産の算定（資産・負債・基本金・国庫補助金等特別積立金）、2. 事業に活用している不動産等（控除対象）。
//   金額を編集すると予想額が再計算される。値はサンプル。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { NOT_IMPL, ToastView, useToast } from './Toast';
import { SUFFICIENCY_DEFAULT as D } from '../data';

type Step = 'confirm' | 'method' | 'main';
const METHODS = [
  { key: 'actual', label: '実績額方式（入力された実績金額から算出する方式）', hint: 'ご使用例　決算手続き完了後、決算伝票入力後から求めたい' },
  { key: 'add', label: '追加額方式（入力された実績金額から追加して算出する方式）', hint: 'ご使用例　期中時に残額を入力して求めたい' },
  { key: 'direct', label: '直接入力方式（全てを直接入力して算出する方式）', hint: 'ご使用例　実績とは異なる金額を入力して求めたい' },
];
const yen = (n: number) => n.toLocaleString('ja-JP');
const num = (s: string) => parseInt(s.replace(/[^0-9-]/g, ''), 10) || 0;

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  onNavigate: (label: string) => void;
}

export function SufficiencyPage({ variant, accent, onNavigate }: Props) {
  const [step, setStep] = useState<Step>('confirm');
  const [agreed, setAgreed] = useState(false);
  const [method, setMethod] = useState('');
  const [a, setA] = useState(D.assets);
  const [b, setB] = useState(D.liabilities);
  const [c, setC] = useState(D.kihonkin);
  const [d, setDd] = useState(D.kokko);
  const [deduct, setDeduct] = useState(D.deduct.map((x) => x.v));
  const toast = useToast();

  const usable = a - b - c - d;
  const deductSum = deduct.reduce((s, v) => s + v, 0);
  const result = usable - deductSum;
  const reset = () => {
    setA(D.assets); setB(D.liabilities); setC(D.kihonkin); setDd(D.kokko); setDeduct(D.deduct.map((x) => x.v));
    toast.show('初期値に戻しました');
  };

  const isSheet = variant === 'sheet';
  const input: CSSProperties = { width: 180, textAlign: 'right', padding: '7px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', outline: 'none', fontVariantNumeric: 'tabular-nums', background: '#fff' };
  const row = (label: string, value: number, set: (n: number) => void, odd: boolean, sub?: boolean) => (
    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 18px', paddingLeft: sub ? 34 : 18, background: odd ? '#fffbea' : '#f2fbfd' }}>
      <span style={{ flex: 1, fontSize: 13.5 }}>{label}</span>
      <input className="field-input ring" value={yen(value)} onChange={(e) => set(num(e.target.value))} inputMode="numeric" style={input} />
      <span style={{ fontSize: 12.5, color: '#5b6773', width: 16 }}>円</span>
    </div>
  );
  const btn = (primary?: boolean): CSSProperties => ({ padding: '9px 20px', borderRadius: 8, border: primary ? 'none' : '1px solid #cfd8e0', background: primary ? accent : '#fff', color: primary ? '#fff' : '#5b6773', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const section = (t: string): CSSProperties => ({ background: '#d8cfe6', padding: '10px 18px', fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 15, color: '#3b2f52', ...(t ? {} : {}) });

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <ToastView msg={toast.msg} />

      {/* ① 確認画面 */}
      <Modal open={step === 'confirm'} onClose={() => onNavigate('伝票入力')} width={620} strict title="確認画面">
        <div style={{ padding: '22px 28px 24px', fontSize: 14.5, lineHeight: 1.8 }}>
          <p style={{ margin: 0 }}><span style={{ color: '#c0392b', fontWeight: 700 }}>当画面で設定した金額や科目設定の内容は保存されません。</span><br />算出結果を保存したい場合にはExcel出力を行ってください。</p>
          <p style={{ margin: '16px 0 0' }}><span style={{ color: '#c0392b', fontWeight: 700 }}>これはシミュレーターです。</span>【財務諸表等入力シート】との誤差が生じる場合がございます。差違の照合については弊社では出来かねます。ご了承ください。</p>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 26, fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ width: 20, height: 20 }} />
            上記を確認し、了解しました
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
            <button type="button" onClick={() => onNavigate('伝票入力')} style={btn()}>キャンセル</button>
            <button type="button" disabled={!agreed} onClick={() => setStep('method')} style={{ ...btn(true), opacity: agreed ? 1 : 0.5 }}>次へ</button>
          </div>
        </div>
      </Modal>

      {/* ② 入力方式選択 */}
      <Modal open={step === 'method'} onClose={() => setStep('confirm')} width={640} strict title="入力方式選択画面">
        <div style={{ padding: '18px 28px 22px' }}>
          <div style={{ border: '1px solid #c0392b', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ color: '#c0392b', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>使用する金額入力方式を選択してください</div>
            {METHODS.map((m) => (
              <label key={m.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 4px', cursor: 'pointer' }}>
                <input type="radio" name="method" checked={method === m.key} onChange={() => setMethod(m.key)} style={{ marginTop: 4 }} />
                <span>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: '#7a8794' }}>{m.hint}</div>
                </span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 18 }}>
            <button type="button" onClick={() => toast.show(NOT_IMPL)} style={btn()}>ⓘ マニュアル</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => onNavigate('伝票入力')} style={btn()}>キャンセル</button>
              <button type="button" disabled={!method} onClick={() => setStep('main')} style={{ ...btn(true), opacity: method ? 1 : 0.5 }}>OK</button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 本体 */}
      <div style={{ width: '100%', maxWidth: isSheet ? 'none' : 1100, background: '#fff', border: '1px solid #dde4ea', borderRadius: isSheet ? 14 : 16, boxShadow: '0 6px 26px rgba(30,50,70,.07)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px 14px', borderBottom: '1px solid #eef2f5', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: isSheet ? 17 : 21 }}>簡易充実残額シミュレーター</div>
            <div style={{ color: '#7a8794', fontSize: 12, marginTop: 4 }}>
              入力方式：<b style={{ color: '#22303c' }}>{METHODS.find((m) => m.key === method)?.label.split('（')[0] ?? '未選択'}</b>　金額を編集すると予想額が再計算されます。<span style={{ color: '#b7791f' }}>（値はサンプルです）</span>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="btn-outline" onClick={() => toast.show(NOT_IMPL)} style={btn()}>科目設定</button>
            <button type="button" className="btn-outline" onClick={reset} style={btn()}>初期化</button>
            <button type="button" className="btn-outline" onClick={() => setStep('method')} style={btn()}>入力方式</button>
            <button type="button" className="btn-outline" onClick={() => toast.show(NOT_IMPL)} style={btn()}>過去年推移</button>
            <button type="button" className="btn-outline" onClick={() => toast.show(NOT_IMPL)} style={btn()}>Excel出力</button>
            <button type="button" className="btn-outline" onClick={() => onNavigate('伝票入力')} style={btn()}>閉じる</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 0 }}>
          <div style={{ borderRight: '1px solid #eef2f5', maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
            <div style={section('1')}>1．「活用可能な財産の算定」</div>
            {row('資産(a)', a, setA, true)}
            {row('負債(b)', b, setB, false)}
            {row('基本金(c)', c, setC, true)}
            {row('国庫補助金等特別積立金(d)', d, setDd, false)}
            <div style={section('2')}>
              2．「社会福祉法に基づく事業に活用している不動産等」
              <div style={{ fontSize: 12, fontWeight: 500, marginTop: 6 }}>（１）財産目録における貸借対照表価額</div>
              <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4 }}>控除対象資産</div>
            </div>
            {D.deduct.map((x, i) => row(x.name, deduct[i], (n) => setDeduct((ds) => ds.map((v, k) => (k === i ? n : v))), i % 2 === 0, true))}
          </div>

          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ border: '2px solid #22303c', borderRadius: 12, padding: '18px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 13.5 }}>特例計算による <b>令和8年度</b> の充実残額の簡易予想額は</div>
              <div style={{ margin: '10px 0', padding: '8px 12px', background: '#eef3f8', borderRadius: 8, fontSize: 30, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: result < 0 ? '#c0392b' : '#1f7a52' }}>
                {result < 0 ? '-' : ''}{yen(Math.abs(result))}
              </div>
              <div style={{ fontSize: 14 }}>円です</div>
              <div style={{ fontSize: 11, color: '#c0392b', marginTop: 10, lineHeight: 1.6, textAlign: 'left' }}>
                ※ 結果は特例計算を用いた予想額です。<br />※ マイナスで表示された場合には充実残額は生じていないと思われます。
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#5b6773', lineHeight: 1.9, background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
              <div>活用可能な財産（a－b－c－d）：<b style={{ fontVariantNumeric: 'tabular-nums' }}>{yen(usable)}</b> 円</div>
              <div>控除対象資産の合計：<b style={{ fontVariantNumeric: 'tabular-nums' }}>{yen(deductSum)}</b> 円</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
