// 法人印刷（既存「決算書・決算附属明細書 一覧」の再現）
//   流れはほかの帳票と同じ「1. 詳細設定 → 2. 出力先 → 3. 印刷／プレビュー」（PrintOutDialog。確認事項「印刷の画面遷移の統一」）。
//   詳細設定で区分 × 帳票のマトリクスから出力する帳票を選ぶ。Excel／PDF は個別のボタンを置かず、出力先で選ぶ。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { TableData } from './PrintCenter';
import { PrintOutDialog } from './PrintOutDialog';
import { CLOSING_REPORT_GROUPS, CLOSING_REPORT_ROWS } from '../data';
import { useSession } from '../store/session';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ACCENT = '#1f7a52';
/** 列コード → 帳票名（決算書 1-1 … 3-4、注記 1,2、附属明細書 3①…、財産目録 4） */
function reportName(col: string): string {
  const m = /^([123])-([1234])$/.exec(col);
  if (m) return `${['資金収支計算書', '事業活動計算書', '貸借対照表'][Number(m[1]) - 1]}（第${['一', '二', '三'][Number(m[1]) - 1]}号第${['一', '二', '三', '四'][Number(m[2]) - 1]}様式）`;
  if (col === '1,2') return '財務諸表に対する注記';
  if (col === '4') return '財産目録';
  return `決算附属明細書 別紙${col}`;
}

export function CorporatePrintModal({ open, onClose }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const s = useSession();
  const key = (r: number, c: string) => `${r}:${c}`;
  const toggle = (k: string) => setChecked((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleGroup = (which: 'required' | 'optional') => {
    const keys: string[] = [];
    CLOSING_REPORT_ROWS.forEach((row, r) => row.avail.forEach((c) => { const req = row.required.includes(c); if ((which === 'required') === req) keys.push(key(r, c)); }));
    setChecked((s) => { const allOn = keys.every((k) => s.has(k)); const n = new Set(s); keys.forEach((k) => (allOn ? n.delete(k) : n.add(k))); return n; });
  };
  const cols = CLOSING_REPORT_GROUPS.flatMap((g) => g.cols);
  const period = `${s.fiscalYear} 4月1日〜3月31日`;
  /** チェックした帳票の一覧（帳票名／区分／対象期間）。行順→列順で並べる */
  const table = (): TableData => ({
    header: ['帳票名', '区分', '対象期間', '必須'],
    rows: CLOSING_REPORT_ROWS.flatMap((row, r) => cols.filter((c) => checked.has(key(r, c))).map((c) => [reportName(c), row.name, period, row.required.includes(c) ? '必須' : '省略可'])),
  });
  const btn = (primary?: boolean): CSSProperties => ({ padding: '9px 20px', borderRadius: 8, border: primary ? 'none' : '1px solid #cfd8e0', background: primary ? ACCENT : '#fff', color: primary ? '#fff' : '#5b6773', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const th: CSSProperties = { padding: '6px 4px', fontSize: 12, fontWeight: 700, color: '#8290a0', background: '#f6f8fa', borderBottom: '1px solid #eef2f5', textAlign: 'center', whiteSpace: 'nowrap' };

  return (
    <PrintOutDialog
      open={open}
      onClose={onClose}
      name="決算書・決算附属明細書 一覧（法人印刷）"
      accent={ACCENT}
      width={1120}
      data={table}
      fileName={`決算書一括_${s.fiscalYear}`}
      meta={`法人印刷　${period}`}
      detailSummary={`選択 ${checked.size} 帳票`}
      blocked={checked.size ? undefined : '出力する帳票を選んでください（詳細設定の一覧でチェックします）。'}
      confirm={[['選択した帳票', `${checked.size} 帳票`], ['対象期間', period]]}
      previewOpts={{ from: `${s.fiscalYear} 4月1日`, to: '3月31日', output: '画面へプレビューする' }}
      detail={<div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button type="button" className="btn-outline" onClick={() => toggleGroup('required')} style={btn()}>✓ 必須帳票のON/OFF</button>
          <button type="button" className="btn-outline" onClick={() => toggleGroup('optional')} style={btn()}>✓ 省略可能帳票のON/OFF</button>
          <span style={{ marginLeft: 'auto', fontSize: 14, color: '#7a8794', alignSelf: 'center' }}>選択 <b style={{ color: '#22303c' }}>{checked.size}</b> 帳票</span>
        </div>
        <div style={{ overflowX: 'auto', border: '1px solid #dde4ea', borderRadius: 10 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', minWidth: 220 }} rowSpan={2}>区分名</th>
                {CLOSING_REPORT_GROUPS.map((g) => <th key={g.group} style={{ ...th, borderLeft: '1px solid #e6ecf1' }} colSpan={g.cols.length}>{g.group}</th>)}
              </tr>
              <tr>{cols.map((c, i) => <th key={i} style={{ ...th, fontWeight: 500, borderLeft: CLOSING_REPORT_GROUPS.some((g) => g.cols[0] === c) ? '1px solid #e6ecf1' : undefined }}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {CLOSING_REPORT_ROWS.map((row, r) => (
                <tr key={row.name}>
                  <td style={{ padding: '8px 10px', fontSize: 14, fontWeight: 600, borderBottom: '1px solid #f1f4f6', whiteSpace: 'nowrap' }}>{row.name}</td>
                  {cols.map((c, i) => {
                    const avail = row.avail.includes(c);
                    const req = row.required.includes(c);
                    const k = key(r, c);
                    return (
                      <td key={i} style={{ padding: 4, textAlign: 'center', borderBottom: '1px solid #f1f4f6', background: avail ? (req ? '#eef2fb' : '#fff') : '#e6eaee', borderLeft: CLOSING_REPORT_GROUPS.some((g) => g.cols[0] === c) ? '1px solid #e6ecf1' : undefined }}>
                        {avail && <input type="checkbox" checked={checked.has(k)} onChange={() => toggle(k)} title={`${row.name}：${reportName(c)}${req ? '（必須）' : ''}`} />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 12, color: '#9aa5b1', marginTop: 8 }}>青い背景＝必須帳票、白＝省略可能、灰＝その区分では出力対象外</div>
        <div style={{ fontSize: 12, color: '#5b6773', marginTop: 6 }}>金額の書式などは、各帳票の印刷の詳細設定と共通の印刷設定に従います。</div>
      </div>}
    />
  );
}
