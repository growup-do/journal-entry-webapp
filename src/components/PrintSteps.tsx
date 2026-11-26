// 印刷画面の共通の枠（確認事項「印刷の画面遷移の統一」「「帳票の印刷」画面の構成について」）
//   開いたときは「出力先」を表示し、出力先を選んですぐに印刷できるようにする。基本条件（期間・区分・印刷する明細など）も出力先と同じ画面に置く。
//   変更することの少ない詳細設定は「詳細設定」のタブに分け、必要なときだけ切り替えて変更する。
//   設定内容を確かめるまとめの画面（旧 3. 印刷／プレビュー）は置かない。仕上がりは［プレビュー］で確かめる。
//   Excel 出力・CSV 出力・PDF 出力は個別のボタンを置かず、出力先で選ぶ（プリンター／PDF／Excel／CSV）。
//   帳票選択はこの画面に入れない。印刷する帳票は、印刷画面を開く前（「印刷 ▾」の一覧や帳票の印刷の一覧）で決めておく。

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Notice, btn, card, lbl } from './ui';

export type OutKind = 'print' | 'pdf' | 'excel' | 'csv';
export const OUT_DESTS: { kind: OutKind; label: string; desc: string; action: string }[] = [
  { kind: 'print', label: 'プリンター', desc: '用紙に印刷します', action: '印刷' },
  { kind: 'pdf', label: 'PDF', desc: 'PDF ファイルとして保存します', action: 'PDFで保存' },
  { kind: 'excel', label: 'Excel', desc: 'Excel ファイルとして保存します', action: 'Excelで保存' },
  { kind: 'csv', label: 'CSV', desc: 'エクセル互換（カンマ区切り）で保存します', action: 'CSVで保存' },
];
/** タブの名前（出力先が先） */
export const PRINT_TAB_LABELS = ['出力先', '詳細設定'] as const;
export const destOf = (k: OutKind) => OUT_DESTS.find((d) => d.kind === k) ?? OUT_DESTS[0];

export interface PrintStepsProps {
  accent: string;
  /** 基本条件（期間・区分・印刷する明細など）。出力先のタブに、出力先の下に置く */
  basic?: ReactNode;
  /** 詳細設定のタブの中身。省略したときはタブを出さず、出力先と基本条件だけの画面にする */
  detail?: ReactNode;
  /** 詳細設定のタブの下に出す短い要約 */
  detailSummary?: string;
  dest: OutKind;
  onDest: (k: OutKind) => void;
  /** 選べる出力先（省略時はプリンター／PDF／Excel／CSV） */
  dests?: OutKind[];
  /** 出力先の下に出す補足 */
  destNote?: ReactNode;
  onPreview?: () => void;
  onRun: () => void;
  onClose?: () => void;
  /** 出力できない理由（帳票が選ばれていない など）。あるとプレビュー・実行を押せない */
  blocked?: string;
}

export function PrintSteps({ accent, basic, detail, detailSummary, dest, onDest, dests, destNote, onPreview, onRun, onClose, blocked }: PrintStepsProps) {
  const [tab, setTab] = useState<(typeof PRINT_TAB_LABELS)[number]>('出力先');
  const list = dests ? OUT_DESTS.filter((d) => dests.includes(d.kind)) : OUT_DESTS;
  const cur = list.find((d) => d.kind === dest) ?? list[0];
  const sub: Record<(typeof PRINT_TAB_LABELS)[number], string> = { 出力先: cur.label, 詳細設定: detailSummary ?? '' };
  const showTab = detail ? tab : '出力先';
  return (
    <div data-print-steps style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 出力先と詳細設定のタブ（詳細設定があるときだけ） */}
      {detail && (
        <div role="tablist" aria-label="印刷の設定" style={{ display: 'flex', gap: 0, padding: '12px 18px 0', borderBottom: '1px solid #e8edf2' }}>
          {PRINT_TAB_LABELS.map((label) => {
            const on = label === showTab;
            return (
              <button key={label} type="button" role="tab" aria-selected={on} data-print-tab={label} onClick={() => setTab(label)} style={{ flex: '0 1 260px', minWidth: 0, textAlign: 'left', padding: '8px 14px 9px', border: 'none', borderBottom: '3px solid ' + (on ? accent : 'transparent'), marginBottom: -1, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: on ? '#22303c' : '#5b6773', whiteSpace: 'nowrap' }}>{label}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#8290a0', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minHeight: 15 }}>{sub[label]}</span>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ padding: '16px 18px 4px', display: 'grid', gap: 14 }}>
        {showTab === '出力先' && (
          <div data-print-dest-tab style={{ display: 'grid', gap: 14 }}>
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
            </div>
            {basic}
            {blocked && <Notice tone="warn">{blocked}</Notice>}
          </div>
        )}
        {showTab === '詳細設定' && detail}
      </div>

      {/* ボタンは画面の下に固定し、スクロールしなくても［印刷］を押せるようにする */}
      <div data-print-foot style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px 14px', flexWrap: 'wrap', position: 'sticky', bottom: 'var(--print-foot-bottom, 0px)', zIndex: 2, background: '#fff', borderTop: '1px solid #e8edf2', borderRadius: '0 0 12px 12px' }}>
        {onClose && <button type="button" onClick={onClose} style={btn()}>キャンセル</button>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }} title={blocked}>
          {onPreview && <button type="button" className="btn-outline" data-print-preview disabled={!!blocked} onClick={onPreview} style={{ ...btn(accent), opacity: blocked ? 0.5 : 1 }}>プレビュー</button>}
          <button type="button" className="submit-btn" data-print-run={cur.kind} disabled={!!blocked} onClick={onRun} style={{ ...btn(accent, true), opacity: blocked ? 0.5 : 1 }}>{cur.action}</button>
        </span>
      </div>
    </div>
  );
}
