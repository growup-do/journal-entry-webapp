// 法人印刷（既存「決算書・決算附属明細書 一覧」の再現）
//   区分 × 帳票のマトリクスで出力する帳票を選び、Excel／PDF／プレビュー／印刷へ。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { NOT_IMPL, ToastView, useToast } from './Toast';
import { CLOSING_REPORT_GROUPS, CLOSING_REPORT_ROWS } from '../data';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CorporatePrintModal({ open, onClose }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const toast = useToast();
  const key = (r: number, c: string) => `${r}:${c}`;
  const toggle = (k: string) => setChecked((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleGroup = (which: 'required' | 'optional') => {
    const keys: string[] = [];
    CLOSING_REPORT_ROWS.forEach((row, r) => row.avail.forEach((c) => { const req = row.required.includes(c); if ((which === 'required') === req) keys.push(key(r, c)); }));
    setChecked((s) => { const allOn = keys.every((k) => s.has(k)); const n = new Set(s); keys.forEach((k) => (allOn ? n.delete(k) : n.add(k))); return n; });
  };
  const cols = CLOSING_REPORT_GROUPS.flatMap((g) => g.cols);
  const btn = (primary?: boolean): CSSProperties => ({ padding: '9px 20px', borderRadius: 8, border: primary ? 'none' : '1px solid #cfd8e0', background: primary ? '#1f7a52' : '#fff', color: primary ? '#fff' : '#5b6773', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const th: CSSProperties = { padding: '6px 4px', fontSize: 10.5, fontWeight: 700, color: '#8290a0', background: '#f6f8fa', borderBottom: '1px solid #eef2f5', textAlign: 'center', whiteSpace: 'nowrap' };

  return (
    <Modal open={open} onClose={onClose} width={1120} title={<>法人印刷 <span style={{ fontSize: 12, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>決算書・決算附属明細書　一覧</span></>}>
      <ToastView msg={toast.msg} />
      <div style={{ padding: '14px 22px 20px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button type="button" className="btn-outline" onClick={() => toggleGroup('required')} style={btn()}>✓ 必須帳票のON/OFF</button>
          <button type="button" className="btn-outline" onClick={() => toggleGroup('optional')} style={btn()}>✓ 省略可能帳票のON/OFF</button>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7a8794', alignSelf: 'center' }}>選択 <b style={{ color: '#22303c' }}>{checked.size}</b> 帳票</span>
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
                  <td style={{ padding: '8px 10px', fontSize: 12.5, fontWeight: 600, borderBottom: '1px solid #f1f4f6', whiteSpace: 'nowrap' }}>{row.name}</td>
                  {cols.map((c, i) => {
                    const avail = row.avail.includes(c);
                    const req = row.required.includes(c);
                    const k = key(r, c);
                    return (
                      <td key={i} style={{ padding: 4, textAlign: 'center', borderBottom: '1px solid #f1f4f6', background: avail ? (req ? '#eef2fb' : '#fff') : '#e6eaee', borderLeft: CLOSING_REPORT_GROUPS.some((g) => g.cols[0] === c) ? '1px solid #e6ecf1' : undefined }}>
                        {avail && <input type="checkbox" checked={checked.has(k)} onChange={() => toggle(k)} title={`${row.name}：${c}${req ? '（必須）' : ''}`} />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: '#9aa5b1', marginTop: 8 }}>青い背景＝必須帳票、白＝省略可能、灰＝その区分では出力対象外</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <button type="button" className="btn-outline" onClick={() => toast.show(NOT_IMPL)} style={btn()}>Excel出力</button>
          <button type="button" className="btn-outline" onClick={() => toast.show(NOT_IMPL)} style={btn()}>PDF出力</button>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn-outline" onClick={() => toast.show(NOT_IMPL)} style={btn()}>プレビュー</button>
          <button type="button" className="submit-btn" onClick={() => toast.show(checked.size ? `${checked.size} 帳票を印刷します（プロトタイプでは動作しません）` : '帳票を選択してください')} style={btn(true)}>印刷</button>
          <button type="button" className="btn-outline" onClick={onClose} style={btn()}>キャンセル</button>
        </div>
      </div>
    </Modal>
  );
}
