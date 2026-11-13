// 一覧・結果などを出力する「印刷」画面（確認事項「印刷の画面遷移の統一」）
//   画面にあった「Excel出力」「CSV出力」「PDF出力」のボタンをやめ、「印刷」ボタン 1 つから開く。
//   流れは帳票と同じ「1. 詳細設定 → 2. 出力先 → 3. 印刷／プレビュー」（PrintSteps）。出力の形式は「2. 出力先」で選ぶ。
//   詳細設定を渡さない画面は、タイトルと出力する内容（件数）だけを表示する。

import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ExportDialog, runExport, type ExportSpec } from './ExportDialog';
import { Modal } from './Modal';
import { PreviewModal, type TableData } from './PrintCenter';
import { PrintSteps, type OutKind } from './PrintSteps';
import { ToastView, useToast } from './Toast';
import { Field, Notice, btn, input } from './ui';

export interface PrintOutProps {
  open: boolean;
  onClose: () => void;
  /** 帳票・一覧の名前（ダイアログの見出し・ファイル名・印刷のタイトルの既定値） */
  name: string;
  accent: string;
  /** 出力する表（開いたときの内容） */
  data: () => TableData;
  /** 印刷時の補足（区分・期間・件数など） */
  meta?: string;
  fileName?: string;
  /** 詳細設定（省略時はタイトルと出力する件数） */
  detail?: ReactNode;
  detailSummary?: string;
  /** 確認表に足す行（帳票・タイトル・出力する内容の行は自動） */
  confirm?: [string, ReactNode][];
  /** 出力できない理由 */
  blocked?: string;
  /** 選べる出力先（省略時は 4 つ） */
  dests?: OutKind[];
  defaultDest?: OutKind;
  width?: number;
  /** プレビューの中身を差し替える（省略時は表） */
  previewChildren?: ReactNode;
  previewOpts?: { from: string; to: string; output: string };
}

export function PrintOutDialog({ open, onClose, name, accent, data, meta, fileName, detail, detailSummary, confirm = [], blocked, dests, defaultDest = 'print', width = 760, previewChildren, previewOpts }: PrintOutProps) {
  const toast = useToast();
  const [dest, setDest] = useState<OutKind>(defaultDest);
  const [title, setTitle] = useState(name);
  const [exp, setExp] = useState<ExportSpec | null>(null);
  const [preview, setPreview] = useState(false);
  useEffect(() => { if (open) { setDest(defaultDest); setTitle(name); } }, [open, name, defaultDest]);
  if (!open && !exp) return <ToastView msg={toast.msg} />;
  const rowsN = open ? data().rows.length : 0;
  const run = () => {
    const spec: ExportSpec = { kind: dest, title: title.trim() || name, fileName, meta, ...data() };
    if (dest === 'print') { toast.show(runExport(spec)); onClose(); return; }
    // ファイル出力は【名前を付けて保存】を経由する
    setExp(spec);
  };
  const note: CSSProperties = { fontSize: 12, color: '#7a8794' };
  return (
    <>
      <ToastView msg={toast.msg} />
      <Modal open={open} onClose={onClose} width={width} title={<>{name} の印刷</>}>
        <div data-print-out={name}>
          <PrintSteps
            accent={accent}
            detailSummary={detailSummary ?? `${rowsN} 行`}
            dest={dest}
            onDest={setDest}
            dests={dests}
            confirm={[['帳票', name], ...(detail ? [] : [['タイトル', title.trim() || name] as [string, ReactNode], ['出力する内容', `${rowsN} 行`] as [string, ReactNode]]), ...confirm]}
            blocked={blocked}
            onPreview={() => setPreview(true)}
            onRun={run}
            onClose={onClose}
            detail={detail ?? (
              <div style={{ display: 'grid', gap: 12 }}>
                <Field label="タイトル"><input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} style={input} /></Field>
                <div style={note}>{meta ? `${meta}　` : ''}画面に表示中の内容（{rowsN} 行）を出力します。</div>
                <Notice>出力の形式（プリンター／PDF／Excel／CSV）は「次へ：出力先」で選びます。</Notice>
              </div>
            )}
          />
        </div>
      </Modal>
      <ExportDialog spec={exp} onClose={() => { setExp(null); onClose(); }} accent={accent} />
      <PreviewModal open={preview && open} onClose={() => setPreview(false)} title={title.trim() || name} accent={accent} pages={1} opts={previewOpts} data={previewChildren || !preview ? undefined : data()}>{previewChildren}</PreviewModal>
    </>
  );
}

/** 画面に置く「印刷」ボタン（ボタンと PrintOutDialog の組）。表示中の一覧・結果を出力する */
export function PrintOutButton({ label = '印刷', style, disabled, disabledTip, ...props }: Omit<PrintOutProps, 'open' | 'onClose'> & { label?: string; style?: CSSProperties; disabled?: boolean; disabledTip?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span data-tip={disabled ? disabledTip : undefined} style={{ display: 'inline-flex' }}>
        <button type="button" className="btn-outline" data-print-out-btn={props.name} disabled={disabled} onClick={() => setOpen(true)} title={disabled ? undefined : `${props.name} を印刷（詳細設定・出力先を指定）`} style={{ ...btn(), display: 'inline-flex', alignItems: 'center', gap: 6, opacity: disabled ? 0.5 : 1, ...style }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="9" rx="2" /><path d="M7 14h10v7H7z" /></svg>
          {label}
        </button>
      </span>
      <PrintOutDialog {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
