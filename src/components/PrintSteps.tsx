// 印刷画面の共通の枠（確認事項「印刷の画面遷移の統一」）
//   「印刷」ボタンを押した先は、どの画面でも「1. 詳細設定 → 2. 出力先 → 3. 印刷／プレビュー」の同じ流れにする。
//   Excel 出力・CSV 出力・PDF 出力は個別のボタンを置かず、「2. 出力先」で選ぶ（プリンター／PDF／Excel／CSV）。
//   帳票選択はこの画面に入れない。印刷する帳票は、印刷画面を開く前（「印刷 ▾」の一覧や帳票の印刷の一覧）で決めておく。
//   詳細設定の中身だけを各画面が渡し、手順の表示・出力先・確認・ボタンの並びは共通にする。

import { useState } from 'react';
import type { ReactNode } from 'react';
import { TD } from './ReportShell';
import { Notice, btn, card, lbl } from './ui';

export type OutKind = 'print' | 'pdf' | 'excel' | 'csv';
export const OUT_DESTS: { kind: OutKind; label: string; desc: string; action: string }[] = [
  { kind: 'print', label: 'プリンター', desc: '用紙に印刷します', action: '印刷' },
  { kind: 'pdf', label: 'PDF', desc: 'PDF ファイルとして保存します', action: 'PDFで保存' },
  { kind: 'excel', label: 'Excel', desc: 'Excel ファイルとして保存します', action: 'Excelで保存' },
  { kind: 'csv', label: 'CSV', desc: 'エクセル互換（カンマ区切り）で保存します', action: 'CSVで保存' },
];
export const PRINT_STEP_LABELS = ['詳細設定', '出力先', '印刷／プレビュー'];
export const destOf = (k: OutKind) => OUT_DESTS.find((d) => d.kind === k) ?? OUT_DESTS[0];

export interface PrintStepsProps {
  accent: string;
  /** 1. 詳細設定の中身 */
  detail: ReactNode;
  /** 手順の見出しの下に出す、詳細設定の短い要約 */
  detailSummary?: string;
  dest: OutKind;
  onDest: (k: OutKind) => void;
  /** 選べる出力先（省略時はプリンター／PDF／Excel／CSV） */
  dests?: OutKind[];
  /** 出力先の下に出す補足 */
  destNote?: ReactNode;
  /** 3. 印刷／プレビューの確認表（行を押すと詳細設定へ戻る）。出力先の行は末尾に自動で足す */
  confirm: [string, ReactNode][];
  onPreview?: () => void;
  onRun: () => void;
  onClose?: () => void;
  /** 出力できない理由（帳票が選ばれていない など）。あるとプレビュー・実行を押せない */
  blocked?: string;
}

export function PrintSteps({ accent, detail, detailSummary, dest, onDest, dests, destNote, confirm, onPreview, onRun, onClose, blocked }: PrintStepsProps) {
  const [step, setStep] = useState(0);
  const list = dests ? OUT_DESTS.filter((d) => dests.includes(d.kind)) : OUT_DESTS;
  const cur = list.find((d) => d.kind === dest) ?? list[0];
  const summary = [detailSummary ?? '', cur.label, ''];
  const last = PRINT_STEP_LABELS.length - 1;
  const fix = (to: number) => <button type="button" onClick={() => setStep(to)} style={{ border: 'none', background: 'transparent', color: accent, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>変更</button>;
  return (
    <div data-print-steps style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 手順の表示（押すとその手順へ移る） */}
      <div style={{ display: 'flex', gap: 0, padding: '12px 18px 0', flexWrap: 'wrap' }}>
        {PRINT_STEP_LABELS.map((label, i) => {
          const on = i === step, done = i < step;
          return (
            <button key={label} type="button" data-print-step={label} onClick={() => setStep(i)} aria-current={on ? 'step' : undefined} style={{ flex: '1 1 160px', minWidth: 0, textAlign: 'left', padding: '8px 10px 9px', border: 'none', borderBottom: '3px solid ' + (on ? accent : done ? '#b9c4cf' : '#e8edf2'), background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: on ? accent : done ? '#8a97a5' : '#e2e8ee', color: on || done ? '#fff' : '#8290a0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{i + 1}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: on ? '#22303c' : '#5b6773', whiteSpace: 'nowrap' }}>{label}</span>
              </span>
              <span style={{ display: 'block', fontSize: 12, color: '#8290a0', marginTop: 3, paddingLeft: 26, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minHeight: 15 }}>{summary[i]}</span>
            </button>
          );
        })}
      </div>

      <div style={{ padding: '16px 18px 4px', display: 'grid', gap: 14 }}>
        {step === 0 && detail}

        {step === 1 && (
          <div style={{ display: 'grid', gap: 10 }}>
            <span style={lbl}>出力先</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
              {list.map((d) => {
                const on = cur.kind === d.kind;
                return (
                  <label key={d.kind} data-print-dest={d.kind} style={{ ...card, padding: '12px 14px', cursor: 'pointer', borderColor: on ? accent : '#e2e8ee', background: on ? '#f6f9fc' : '#fff', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <input type="radio" checked={on} onChange={() => onDest(d.kind)} style={{ marginTop: 3 }} />
                    <span><span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{d.label}</span><span style={{ display: 'block', fontSize: 12, color: '#7a8794', marginTop: 2 }}>{d.desc}</span></span>
                  </label>
                );
              })}
            </div>
            {destNote}
            {onPreview && <div style={{ fontSize: 12, color: '#8290a0' }}>印刷前に内容を確かめるときは、右下の「プレビュー」を使います。どの手順からでも開けます。</div>}
          </div>
        )}

        {step === last && (
          <div style={{ display: 'grid', gap: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {confirm.map(([k, v]) => <tr key={k}><td style={{ ...TD, width: 170, fontSize: 14, fontWeight: 700, color: '#5b6773' }}>{k}</td><td style={TD}>{v}</td><td style={{ ...TD, width: 60, textAlign: 'right' }}>{fix(0)}</td></tr>)}
                <tr><td style={{ ...TD, width: 170, fontSize: 14, fontWeight: 700, color: '#5b6773' }}>出力先</td><td style={TD}>{cur.label}</td><td style={{ ...TD, width: 60, textAlign: 'right' }}>{fix(1)}</td></tr>
              </tbody>
            </table>
            {blocked ? <Notice tone="warn">{blocked}</Notice> : <Notice>内容を確認して「{cur.action}」を押します。{onPreview ? '先に「プレビュー」で仕上がりを確かめることもできます。' : ''}</Notice>}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px 16px', flexWrap: 'wrap' }}>
        {onClose && <button type="button" onClick={onClose} style={btn()}>キャンセル</button>}
        <button type="button" onClick={() => setStep((x) => Math.max(0, x - 1))} disabled={step === 0} style={{ ...btn(), opacity: step === 0 ? 0.45 : 1 }}>戻る</button>
        {step < last && <button type="button" data-print-next onClick={() => setStep((x) => Math.min(last, x + 1))} style={btn(accent)}>次へ：{PRINT_STEP_LABELS[step + 1]}</button>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }} title={blocked}>
          {onPreview && <button type="button" className="btn-outline" disabled={!!blocked} onClick={onPreview} style={{ ...btn(accent), opacity: blocked ? 0.5 : 1 }}>プレビュー</button>}
          <button type="button" className="submit-btn" data-print-run={cur.kind} disabled={!!blocked} onClick={onRun} style={{ ...btn(accent, true), opacity: blocked ? 0.5 : 1 }}>{cur.action}</button>
        </span>
      </div>
    </div>
  );
}
