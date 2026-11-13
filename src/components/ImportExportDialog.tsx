// インポート／エクスポートの共通画面（確認事項「インポート・エクスポート処理の統一」）
//   環境設定の「設定の保存／読込」の動きをもとに、どの画面でも「インポート／エクスポート」ボタン 1 つから開き、
//   開いた画面で「エクスポート（書き出す）」か「インポート（読み込む）」のどちらかを選んで実行する。
//   エクスポート・インポート（ファイルを選んだとき）・サンプルの読込を実行すると画面を閉じ、結果はトーストで知らせる。
//   入力のある画面ではないが、ファイルを読み込む操作を含むので、閉じるのは × と「閉じる」だけ（Esc・外側のクリックでは閉じない）。

import { useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Modal } from './Modal';
import { Notice, btn, card, cardHead } from './ui';

export interface ImportExportProps {
  open: boolean;
  onClose: () => void;
  /** 対象の名前（例：環境設定、注記、合算テーブル）。見出しは「〇〇のインポート／エクスポート」 */
  name: string;
  accent: string;
  /** 画面上部の説明 */
  notice?: ReactNode;
  /** エクスポート：説明と実行 */
  exportDesc: ReactNode;
  onExport: () => void;
  /** ファイルの形式（例：JSON、CSV） */
  format: string;
  /** インポート：説明・受け付けるファイル・読み込み処理 */
  importDesc: ReactNode;
  accept: string;
  onImport: (f: File) => void;
  /** 手元にファイルがないときのサンプル読込（プロトタイプ用） */
  onSample?: () => void;
  /** インポートの注意（上書き・元に戻せない など） */
  importWarn?: ReactNode;
  /** インポートの下に足す内容（例：他の区分の設定を読み込む） */
  importExtra?: ReactNode;
}

export function ImportExportDialog({ open, onClose, name, accent, notice, exportDesc, onExport, format, importDesc, accept, onImport, onSample, importWarn, importExtra }: ImportExportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'export' | 'import'>('export');
  const choice = (on: boolean): CSSProperties => ({ ...card, padding: '12px 14px', cursor: 'pointer', borderColor: on ? accent : '#e2e8ee', background: on ? '#f6f9fc' : '#fff', display: 'flex', gap: 8, alignItems: 'flex-start', overflow: 'visible' });
  return (
    <Modal open={open} onClose={onClose} width={580} title={`${name}のインポート／エクスポート`}>
      <div data-import-export={name} style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        {notice && <Notice>{notice}</Notice>}
        {/* どちらを行うかを選ぶ */}
        <div role="radiogroup" aria-label="行う処理" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {([['export', 'エクスポート', 'ファイルに書き出す'], ['import', 'インポート', 'ファイルから読み込む']] as const).map(([k, l, d]) => (
            <label key={k} data-ie-mode={k} style={choice(mode === k)}>
              <input type="radio" name={`ie-${name}`} checked={mode === k} onChange={() => setMode(k)} style={{ marginTop: 3 }} />
              <span><span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{l}</span><span style={{ display: 'block', fontSize: 12, color: '#7a8794', marginTop: 2 }}>{d}（{format}）</span></span>
            </label>
          ))}
        </div>
        {mode === 'export' ? (
          <div style={card}><div style={cardHead}>エクスポート</div><div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 }}><span style={{ flex: 1, color: '#5b6773' }}>{exportDesc}</span><button type="button" data-ie-run="export" onClick={() => { onExport(); onClose(); }} style={btn(accent, true)}>エクスポート</button></div></div>
        ) : (
          <div style={card}><div style={cardHead}>インポート</div><div style={{ padding: 14, display: 'grid', gap: 10, fontSize: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ flex: 1, color: '#5b6773' }}>{importDesc}</span><button type="button" data-ie-run="import" onClick={() => fileRef.current?.click()} style={btn(accent, true)}>ファイルを選択…</button></div>
            <input ref={fileRef} type="file" accept={accept} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { onImport(f); onClose(); } }} style={{ display: 'none' }} />
            {onSample && <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ flex: 1, color: '#9aa5b1' }}>手元にファイルがない場合は、サンプルを読み込んで動作を確認できます。</span><button type="button" onClick={() => { onSample(); onClose(); }} style={btn()}>サンプルを読み込む</button></div>}
            {importWarn && <Notice tone="warn">{importWarn}</Notice>}
            {importExtra}
          </div></div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={onClose} style={btn()}>閉じる</button></div>
      </div>
    </Modal>
  );
}

/** 画面に置く「インポート／エクスポート」ボタンと画面の組 */
export function ImportExportButton({ style, small, ...props }: Omit<ImportExportProps, 'open' | 'onClose'> & { style?: CSSProperties; small?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-outline" data-import-export-btn={props.name} onClick={() => setOpen(true)} title={`${props.name}をファイルに書き出す／ファイルから読み込む`} style={{ ...btn('#5b6773', false, small), ...style }}>インポート／エクスポート</button>
      <ImportExportDialog {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
