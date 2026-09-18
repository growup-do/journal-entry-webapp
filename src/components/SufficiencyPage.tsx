// 充実残額（既存「簡易充実残額シミュレーター」の再現）
//   起動時：①確認画面（保存されない旨・シミュレーターである旨 → 了解チェック）→ ②金額入力方式の選択 → 本体。
//   本体：1. 活用可能な財産の算定（資産・負債・基本金・国庫補助金等特別積立金）、2. 事業に活用している不動産等（控除対象）。
//   金額を編集すると予想額が再計算される。値はサンプル。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { ExplainModal } from './ExplainModal';
import { ExportDialog, type ExportSpec } from './ExportDialog';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { ACCOUNT_META } from '../lib/accounts';
import { SUFFICIENCY_DEFAULT as D } from '../data';

/** 科目設定：シミュレーターの各行に集計する勘定科目（初期値はサンプル科目マスタから機械的に割当） */
const LINE_KEYS = ['資産(a)', '負債(b)', '基本金(c)', '国庫補助金等特別積立金(d)', ...D.deduct.map((x) => x.name)];
const DEFAULT_MAP: Record<string, string[]> = Object.fromEntries(LINE_KEYS.map((k) => [k, [] as string[]]));
DEFAULT_MAP['資産(a)'] = ACCOUNT_META.filter((m) => m.cls === '現預金' || m.cls === '資産').filter((m) => m.name !== '現金（収入）').map((m) => m.name);
DEFAULT_MAP['事業未収金'] = ['事業未収金'];
DEFAULT_MAP['未収補助金'] = ['未収金'];
/** 過去年推移のサンプル（令和4〜7年度）。令和8年度は画面の入力値から算出 */
const HISTORY = [
  { y: '令和4年度', usable: 9_800_000, deduct: 38_900_000 },
  { y: '令和5年度', usable: 10_900_000, deduct: 39_400_000 },
  { y: '令和6年度', usable: 11_600_000, deduct: 39_800_000 },
  { y: '令和7年度', usable: 12_100_000, deduct: 40_100_000 },
];

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
  const [manualOpen, setManualOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string[]>>(DEFAULT_MAP);
  const [mapDraft, setMapDraft] = useState<Record<string, string[]>>(DEFAULT_MAP);
  const [histOpen, setHistOpen] = useState(false);
  const [exportSpec, setExportSpec] = useState<ExportSpec | null>(null);
  const toast = useToast();

  const usable = a - b - c - d;
  const deductSum = deduct.reduce((s, v) => s + v, 0);
  const result = usable - deductSum;
  const reset = () => {
    setA(D.assets); setB(D.liabilities); setC(D.kihonkin); setDd(D.kokko); setDeduct(D.deduct.map((x) => x.v));
    toast.show('初期値に戻しました');
  };

  const history = [...HISTORY.map((h) => ({ ...h, result: h.usable - h.deduct })), { y: '令和8年度', usable, deduct: deductSum, result }];
  const excelSpec = (): ExportSpec => ({
    kind: 'excel',
    title: '簡易充実残額シミュレーター',
    fileName: '充実残額シミュレーション_令和8年度',
    meta: `入力方式：${METHODS.find((m) => m.key === method)?.label.split('（')[0] ?? '未選択'}`,
    header: ['区分', '項目', '金額（円）', '集計科目'],
    rows: [
      ['1．活用可能な財産の算定', '資産(a)', a, mapping['資産(a)'].join('、')],
      ['', '負債(b)', b, mapping['負債(b)'].join('、')],
      ['', '基本金(c)', c, mapping['基本金(c)'].join('、')],
      ['', '国庫補助金等特別積立金(d)', d, mapping['国庫補助金等特別積立金(d)'].join('、')],
      ['', '活用可能な財産（a－b－c－d）', usable, ''],
      ...D.deduct.map((x, i): (string | number)[] => [i === 0 ? '2．事業に活用している不動産等（控除対象）' : '', x.name, deduct[i], mapping[x.name].join('、')]),
      ['', '控除対象資産の合計', deductSum, ''],
      ['結果', '充実残額の簡易予想額（特例計算）', result, ''],
    ],
  });
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
            <button type="button" onClick={() => setManualOpen(true)} style={btn()}>ⓘ マニュアル</button>
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
            <button type="button" className="btn-outline" onClick={() => { setMapDraft(mapping); setMapOpen(true); }} style={btn()}>科目設定</button>
            <button type="button" className="btn-outline" onClick={reset} style={btn()}>初期化</button>
            <button type="button" className="btn-outline" onClick={() => setStep('method')} style={btn()}>入力方式</button>
            <button type="button" className="btn-outline" onClick={() => setHistOpen(true)} style={btn()}>過去年推移</button>
            <button type="button" className="btn-outline" onClick={() => setExportSpec(excelSpec())} style={btn()}>Excel出力</button>
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

      {/* ⓘ マニュアル */}
      <ExplainModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        accent={accent}
        title="社会福祉充実残額とは"
        source="社会福祉法 第55条の2／簡易充実残額シミュレーター（既存システム）"
        sections={[
          { h: '概要', body: '社会福祉充実残額は、法人が保有する財産のうち、事業の継続に必要な財産を控除してもなお残る「再投下可能な財産」の額です。残額が生じた法人は、社会福祉充実計画を策定して既存事業の充実や新規事業に活用することが求められます。' },
          { h: '算定の考え方', body: <>充実残額 ＝ ①活用可能な財産 － ②社会福祉法に基づく事業に活用している不動産等 － ③再取得に必要な財産 － ④必要な運転資金<br />①活用可能な財産 ＝ 資産(a) － 負債(b) － 基本金(c) － 国庫補助金等特別積立金(d)</> },
          { h: 'このシミュレーターの特例計算', body: '②〜④のうち、財産目録の貸借対照表価額から把握できる②（控除対象資産）のみを控除する簡易計算です。③再取得に必要な財産（建物の建替・大規模修繕の費用）や④必要な運転資金（年間事業活動支出の3か月分）は含みません。正式な算定は「財務諸表等入力シート」で行ってください。' },
          { h: '入力方式', body: '実績額方式：決算伝票入力後の実績金額から算出　／　追加額方式：期中に見込み額を追加して算出　／　直接入力方式：実績とは別の金額をすべて直接入力して算出' },
          { h: '注意', body: '当画面の金額・科目設定は保存されません。結果を残す場合は「Excel出力」を行ってください。また、シミュレーターの結果と財務諸表等入力シートの算定結果には差異が生じることがあります。' },
        ]}
      />

      {/* 科目設定 */}
      <Modal open={mapOpen} onClose={() => setMapOpen(false)} width={760} title="科目設定 ― 各行に集計する勘定科目">
        <div style={{ padding: '12px 22px 18px' }}>
          <div style={{ fontSize: 12.5, color: '#5b6773', marginBottom: 10, lineHeight: 1.7 }}>シミュレーターの各行に、どの勘定科目の残高を集計するかを設定します（実績額方式・追加額方式で使用）。<span style={{ color: '#b7791f' }}>設定内容は保存されません。</span></div>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: '52vh', overflow: 'auto' }}>
            {LINE_KEYS.map((k, i) => {
              const sel = mapDraft[k];
              const rest = ACCOUNT_META.filter((m) => !sel.includes(m.name));
              return (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 10, padding: '8px 12px', borderBottom: '1px solid #f1f4f6', background: i % 2 ? '#fbfcfd' : '#fff', alignItems: 'start' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, paddingTop: 6, paddingLeft: i >= 4 ? 14 : 0, color: i >= 4 ? '#48565f' : '#22303c' }}>{i >= 4 ? '控除：' : ''}{k}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    {sel.map((n) => (
                      <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 12, background: '#eef3f8', fontSize: 12 }}>
                        <span style={{ color: '#9aa5b1', fontSize: 10.5 }}>{ACCOUNT_META.find((m) => m.name === n)?.code}</span>{n}
                        <button type="button" onClick={() => setMapDraft({ ...mapDraft, [k]: sel.filter((x) => x !== n) })} title="外す" style={{ border: 'none', background: 'transparent', color: '#8290a0', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                      </span>
                    ))}
                    <select value="" onChange={(e) => { if (e.target.value) setMapDraft({ ...mapDraft, [k]: [...sel, e.target.value] }); }} style={{ padding: '4px 8px', border: '1px solid #cfd8e0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', background: '#fff', color: '#5b6773' }}>
                      <option value="">＋ 科目を追加…</option>
                      {rest.map((m) => <option key={m.name} value={m.name}>{m.code}　{m.name}</option>)}
                    </select>
                    {sel.length === 0 && <span style={{ fontSize: 11.5, color: '#9aa5b1' }}>（未設定：直接入力の金額を使用）</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: '#9aa5b1', marginTop: 8 }}>※ プロトタイプの科目マスタはサンプル（現預金・未収金・事業費・人件費・事業収益）のため、負債・基本金・固定資産の科目は未登録です。本番では法人の勘定科目マスタから選択します。</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" className="btn-outline" onClick={() => setMapDraft(DEFAULT_MAP)} style={{ ...btn(), marginRight: 'auto' }}>初期値に戻す</button>
            <button type="button" onClick={() => setMapOpen(false)} style={btn()}>キャンセル</button>
            <button type="button" className="submit-btn" onClick={() => { setMapping(mapDraft); setMapOpen(false); toast.show('科目設定を反映しました（この画面を閉じるまで有効）'); }} style={btn(true)}>OK</button>
          </div>
        </div>
      </Modal>

      {/* 過去年推移 */}
      <Modal open={histOpen} onClose={() => setHistOpen(false)} width={760} title="充実残額の推移（過去5年度）">
        <div style={{ padding: '12px 22px 18px' }}>
          {(() => {
            const W = 700, H = 240, padL = 70, padR = 16, padT = 26, padB = 34;
            const vals = history.map((h) => h.result);
            const maxAbs = Math.max(1, ...vals.map((v) => Math.abs(v)));
            const step = Math.pow(10, Math.floor(Math.log10(maxAbs)));
            const top = Math.ceil(maxAbs / step) * step;
            const hasNeg = vals.some((v) => v < 0);
            const yMin = hasNeg ? -top : 0;
            const plotH = H - padT - padB;
            const y = (v: number) => padT + ((top - v) / (top - yMin)) * plotH;
            const zero = y(0);
            const bw = (W - padL - padR) / history.length;
            const ticks = hasNeg ? [-top, -top / 2, 0, top / 2, top] : [0, top / 4, top / 2, (top * 3) / 4, top];
            const fmt = (v: number) => (Math.abs(v) >= 1_000_000 ? `${v / 1_000_000}百万` : Math.abs(v) >= 1000 ? `${v / 1000}千` : String(v));
            return (
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="充実残額の推移（棒グラフ）" style={{ display: 'block', maxWidth: '100%', fontFamily: 'inherit' }}>
                {ticks.map((t) => (
                  <g key={t}>
                    <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#9aa5b1' : '#eef2f5'} strokeWidth={1} />
                    <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize={10.5} fill="#8290a0">{fmt(t)}</text>
                  </g>
                ))}
                {history.map((h, i) => {
                  const cx = padL + bw * i + bw / 2;
                  const barW = Math.min(44, bw * 0.45);
                  const yv = y(h.result);
                  const isCur = i === history.length - 1;
                  const fill = h.result < 0 ? '#c0392b' : isCur ? accent : '#7fa9d6';
                  return (
                    <g key={h.y}>
                      <rect x={cx - barW / 2} y={Math.min(yv, zero)} width={barW} height={Math.max(2, Math.abs(zero - yv))} rx={4} fill={fill} />
                      <text x={cx} y={(h.result < 0 ? yv + 14 : yv - 7)} textAnchor="middle" fontSize={11} fontWeight={700} fill="#22303c" style={{ fontVariantNumeric: 'tabular-nums' }}>{yen(h.result)}</text>
                      <text x={cx} y={H - padB + 18} textAnchor="middle" fontSize={11.5} fontWeight={isCur ? 800 : 500} fill={isCur ? '#22303c' : '#5b6773'}>{h.y}{isCur ? '（予想）' : ''}</text>
                    </g>
                  );
                })}
              </svg>
            );
          })()}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10, fontSize: 12.5 }}>
            <thead>
              <tr>{['年度', '活用可能な財産', '控除対象資産', '充実残額'].map((h, i) => <th key={h} style={{ padding: '6px 10px', background: '#f6f8fa', textAlign: i ? 'right' : 'left', fontSize: 11.5, color: '#5b6773', borderBottom: '1px solid #e2e8ee' }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {history.map((h, i) => {
                const cur = i === history.length - 1;
                return (
                  <tr key={h.y} style={{ background: cur ? '#fffbea' : 'transparent', fontWeight: cur ? 700 : 500 }}>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f4f6' }}>{h.y}{cur && <span style={{ fontSize: 10.5, color: '#b7791f', marginLeft: 6 }}>今回のシミュレーション</span>}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f4f6', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{yen(h.usable)}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f4f6', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{yen(h.deduct)}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f4f6', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: h.result < 0 ? '#c0392b' : '#1f7a52' }}>{h.result < 0 ? '-' : ''}{yen(Math.abs(h.result))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: '#9aa5b1', marginTop: 8 }}>※ 過去年度の値はサンプルです。本番では各年度の決算データ（財産目録）から算出した値を表示します。</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><button type="button" onClick={() => setHistOpen(false)} style={btn()}>閉じる</button></div>
        </div>
      </Modal>

      <ExportDialog spec={exportSpec} onClose={() => setExportSpec(null)} accent={accent} />
    </main>
  );
}
