// ファイル出力・印刷の共通ダイアログ（既存の【名前を付けて保存】／プリンター選択に相当）
//   CSV・テキスト … 実際にファイルを生成してダウンロード（UTF-8 BOM 付き。本番では Shift_JIS も選択可）
//   Excel        … 表を .xls（HTML形式）として保存（Excelで開ける。本番では .xlsx を生成）
//   PDF・印刷    … 別ウィンドウに帳票を描画してブラウザの印刷ダイアログを開く（PDFとして保存できる）

import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { Field, Notice, btn, input, lbl } from './ui';

export type ExportKind = 'csv' | 'excel' | 'pdf' | 'print' | 'text';
export interface ExportSpec {
  kind: ExportKind;
  /** 帳票・一覧の名称（ファイル名の既定値・印刷タイトル） */
  title: string;
  fileName?: string;
  /** 表データ（csv／excel／pdf／print） */
  header?: string[];
  rows?: (string | number)[][];
  /** テキスト（text） */
  text?: string;
  /** 印刷時の補足（区分・期間など） */
  meta?: string;
}

const EXT: Record<ExportKind, string> = { csv: '.csv', excel: '.xls', pdf: '.pdf', print: '', text: '.txt' };
const KIND_LABEL: Record<ExportKind, string> = { csv: 'CSV（カンマ区切り）', excel: 'Excel ブック', pdf: 'PDF', print: '印刷', text: 'テキスト' };
const today = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };
const esc = (v: string | number) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function tableHtml(spec: ExportSpec) {
  const th = (spec.header ?? []).map((h) => `<th>${esc(h)}</th>`).join('');
  const tr = (spec.rows ?? []).map((r) => `<tr>${r.map((c) => `<td style="text-align:${typeof c === 'number' ? 'right' : 'left'}">${typeof c === 'number' ? c.toLocaleString('ja-JP') : esc(c)}</td>`).join('')}</tr>`).join('');
  return `<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-size:11pt"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}
/** 実際の出力処理（ダイアログを経ずに呼ぶこともできる） */
export function runExport(spec: ExportSpec, fileName?: string): string {
  const name = (fileName || spec.fileName || `${spec.title}_${today()}`) + EXT[spec.kind];
  if (spec.kind === 'csv') {
    const lines = [spec.header ?? [], ...(spec.rows ?? [])].filter((r) => r.length).map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
    download(name, new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    return `${name} を保存しました（${(spec.rows ?? []).length} 行）`;
  }
  if (spec.kind === 'text') {
    download(name, new Blob(['﻿' + (spec.text ?? '')], { type: 'text/plain;charset=utf-8' }));
    return `${name} を保存しました`;
  }
  if (spec.kind === 'excel') {
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><title>${esc(spec.title)}</title></head><body>${tableHtml(spec)}</body></html>`;
    download(name, new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' }));
    return `${name} を保存しました（Excelで開けます）`;
  }
  // pdf / print
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return '印刷ウィンドウを開けませんでした（ポップアップを許可してください）';
  w.document.write(`<html><head><meta charset="utf-8"><title>${esc(spec.title)}</title><style>body{font-family:'Noto Sans JP','Hiragino Sans',sans-serif;padding:24px;color:#22303c}h1{font-size:16pt;margin:0 0 4px}p{font-size:10pt;color:#5b6773;margin:0 0 14px}th{background:#f1f4f6;font-size:10.5pt;padding:4px 8px}td{padding:3px 8px;font-size:10.5pt;font-variant-numeric:tabular-nums}@media print{body{padding:0}}</style></head><body><h1>${esc(spec.title)}</h1><p>${esc(spec.meta ?? '')}　出力日：${new Date().toLocaleDateString('ja-JP')}</p>${spec.text ? `<pre>${esc(spec.text)}</pre>` : tableHtml(spec)}<script>setTimeout(function(){window.print();},300);</script></body></html>`);
  w.document.close();
  return spec.kind === 'pdf' ? '印刷ダイアログで「PDFに保存」を選ぶとPDFになります' : '印刷ダイアログを開きました';
}

/** 出力ダイアログ。spec が null のとき非表示 */
export function ExportDialog({ spec, onClose, accent }: { spec: ExportSpec | null; onClose: () => void; accent: string }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [dest, setDest] = useState('ダウンロード（このパソコン）');
  const [enc, setEnc] = useState('UTF-8（BOM付き）');
  useEffect(() => { if (spec) setName(spec.fileName ?? `${spec.title}_${today()}`); }, [spec]);
  if (!spec) return <ToastView msg={toast.msg} />;
  const isFile = spec.kind !== 'print';
  const preview = (spec.rows ?? []).slice(0, 5);
  return (
    <>
      <ToastView msg={toast.msg} />
      <Modal open={!!spec} onClose={onClose} width={620} title={isFile ? '名前を付けて保存' : '印刷'}>
        <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="対象" span={2}><div style={{ ...input, background: '#f5f7f9' }}>{spec.title}{spec.meta ? <span style={{ color: '#7a8794', fontSize: 12 }}>　{spec.meta}</span> : null}</div></Field>
            {isFile && <Field label="ファイル名"><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input className="field-input ring" value={name} onChange={(e) => setName(e.target.value)} style={input} /><span style={{ fontSize: 12.5, color: '#7a8794' }}>{EXT[spec.kind]}</span></div></Field>}
            <Field label="形式"><div style={{ ...input, background: '#f5f7f9' }}>{KIND_LABEL[spec.kind]}</div></Field>
            {isFile && <Field label="保存先"><select value={dest} onChange={(e) => setDest(e.target.value)} style={input}>{['ダウンロード（このパソコン）', '共有フォルダ（本番で設定）'].map((o) => <option key={o}>{o}</option>)}</select></Field>}
            {(spec.kind === 'csv' || spec.kind === 'text') && <Field label="文字コード"><select value={enc} onChange={(e) => setEnc(e.target.value)} style={input}>{['UTF-8（BOM付き）', 'Shift_JIS（本番で対応）'].map((o) => <option key={o}>{o}</option>)}</select></Field>}
            {!isFile && <Field label="プリンター"><select style={input} defaultValue="既定のプリンター"><option>既定のプリンター</option><option>PDFに保存</option></select></Field>}
          </div>
          {preview.length > 0 && (
            <div>
              <span style={lbl}>内容（先頭 {preview.length} 行／全 {(spec.rows ?? []).length} 行）</span>
              <div style={{ border: '1px solid #e2e8ee', borderRadius: 8, overflow: 'auto', maxHeight: 160 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <thead><tr>{(spec.header ?? []).map((h) => <th key={h} style={{ padding: '4px 8px', background: '#f6f8fa', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                  <tbody>{preview.map((r, i) => <tr key={i}>{r.map((c, k) => <td key={k} style={{ padding: '3px 8px', borderTop: '1px solid #f1f4f6', textAlign: typeof c === 'number' ? 'right' : 'left', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{typeof c === 'number' ? c.toLocaleString('ja-JP') : c}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
          {spec.kind === 'text' && spec.text && <pre style={{ margin: 0, padding: 10, background: '#f6f8fa', borderRadius: 8, fontSize: 11.5, maxHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{spec.text.slice(0, 600)}{spec.text.length > 600 ? '…' : ''}</pre>}
          <Notice>{spec.kind === 'excel' ? 'プロトタイプでは Excel が開ける .xls（HTML形式）で保存します。本番では .xlsx を生成します。' : spec.kind === 'pdf' || spec.kind === 'print' ? 'ブラウザの印刷ダイアログが開きます。PDFにする場合は送信先で「PDFに保存」を選んでください。' : 'ダウンロードフォルダに保存されます。'}</Notice>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onClose} style={btn()}>キャンセル</button>
            <button type="button" className="submit-btn" onClick={() => { const msg = runExport(spec, name.trim()); onClose(); toast.show(msg); }} style={btn(accent, true)}>{isFile ? '保存' : '印刷'}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
