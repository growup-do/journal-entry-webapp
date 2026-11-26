// 一覧行の操作（依頼書 5.4.4／6.4／6.5）— 日記帳・各元帳で同じ部品を使う
//   行をクリックすると伝票を訂正（参照のみ権限は表示）で開く。行にマウスを載せると色が変わる（確認メモ #271）。
//   行の右端の「証憑・チェック・付箋」は常に表示。表示順の入換（↑↓とドラッグハンドル）と削除（ごみ箱）は、
//   行にマウスを載せたときだけ表示する（確認メモ #267）。削除は確認ダイアログ（伝票の内容＋取り消せない旨）を経てから実行する。
//   親区分・合算区分で起動して使えないときは無効表示＋理由のツールチップ。

import { useState } from 'react';
import type { CSSProperties, DragEvent, MouseEvent, ReactNode } from 'react';
import { Modal } from './Modal';
import { TH } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { EditVoucherModal, FlagCell } from './VoucherEdit';
import { needsPartner } from './EntryCommon';
import { btn, HelpTip } from './ui';
import { deleteVoucher, getVouchers, moveVoucher, type Voucher } from '../store/journalStore';
import { canEdit, canReorder, editBlockReason, isViewOnly, startKindOf, useSession, type Session } from '../store/session';

const RED = '#c0392b';
const yen = (n: number) => n.toLocaleString('ja-JP');

/** 表示順の入換が使えない理由（使えるときは空文字） */
export const reorderBlockReason = (s: Session) => (s.role !== '入力可' ? '参照のみの権限のため操作できません' : startKindOf(s) === '合算区分' ? '合算区分で起動中のため表示順の入換はできません' : '');

interface RowActionsProps {
  v: Voucher;
  /** 訂正・削除ができるか／できない理由 */
  editable: boolean;
  editReason: string;
  /** 表示順入換ができるか／できない理由 */
  reorderable: boolean;
  reorderReason: string;
  /** 上下に同一日の行があるか */
  canUp: boolean;
  canDown: boolean;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}

const icon = (disabled: boolean, danger = false): CSSProperties => ({
  width: 28, height: 28, padding: 0, borderRadius: 7, border: '1px solid ' + (disabled ? '#e6ecf1' : danger ? '#f2c9c2' : '#cfd8e0'), background: '#fff', color: disabled ? '#c8d0d8' : danger ? RED : '#48565f',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', pointerEvents: disabled ? 'none' : 'auto',
});
const svg = (d: ReactNode) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>;
const UP = svg(<path d="M12 19V5M5 12l7-7 7 7" />);
const DOWN = svg(<path d="M12 5v14M5 12l7 7 7-7" />);
const TRASH = svg(<><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /><path d="M10 11v6M14 11v6" /></>);
const GRIP = <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden><circle cx="3" cy="3" r="1.6" /><circle cx="9" cy="3" r="1.6" /><circle cx="3" cy="9" r="1.6" /><circle cx="9" cy="9" r="1.6" /><circle cx="3" cy="15" r="1.6" /><circle cx="9" cy="15" r="1.6" /></svg>;

/** 内部取引の伝票の印（取引日の列に出す。確認メモ #268） */
export const isInternalVoucher = (v: Voucher) => !!v.internal || !!v.internalSide || needsPartner({ kari: v.kari, kashi: v.kashi });
export function InternalTag({ v }: { v: Voucher }) {
  if (!isInternalVoucher(v)) return null;
  return <span data-internal-tag title="内部取引の伝票です" data-keep-color style={{ display: 'inline-block', marginLeft: 5, padding: '0 5px', borderRadius: 5, background: '#efe7fa', color: '#6b3fb5', border: '1px solid #d6c4f0', fontSize: 12, fontWeight: 800, lineHeight: '18px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>内部</span>;
}

/** 行の操作エリア（1行分）。証憑・チェック・付箋は常に表示、↑↓とごみ箱は行にマウスを載せたときだけ */
export function RowActions({ v, editable, editReason, reorderable, reorderReason, canUp, canDown, onMove, onDelete }: RowActionsProps) {
  const s = useSession();
  if (isViewOnly(s)) {
    return (
      <div data-row-actions onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
        <FlagCell v={v} compact />
      </div>
    );
  }
  const upOff = !reorderable || !canUp;
  const downOff = !reorderable || !canDown;
  const moveTip = (ok: boolean, label: string) => (!reorderable ? reorderReason : ok ? label : '同一日の中でのみ入れ替えできます');
  return (
    <div data-row-actions onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      <FlagCell v={v} compact />
      <span className="ra-hover" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 10 }}>
        <span title={moveTip(canUp, '表示順を1つ上へ（同一日内）')} style={{ display: 'inline-flex', cursor: upOff ? 'not-allowed' : undefined }}>
          <button type="button" aria-label="表示順を上へ" aria-disabled={upOff} tabIndex={upOff ? -1 : 0} onClick={() => onMove(-1)} style={icon(upOff)}>{UP}</button>
        </span>
        <span title={moveTip(canDown, '表示順を1つ下へ（同一日内）')} style={{ display: 'inline-flex', cursor: downOff ? 'not-allowed' : undefined }}>
          <button type="button" aria-label="表示順を下へ" aria-disabled={downOff} tabIndex={downOff ? -1 : 0} onClick={() => onMove(1)} style={icon(downOff)}>{DOWN}</button>
        </span>
        {/* 削除は誤操作を避けるため、入換から間隔を空けて置く */}
        <span title={editable ? '伝票を削除する（確認があります）' : editReason} style={{ display: 'inline-flex', marginLeft: 14, cursor: editable ? undefined : 'not-allowed' }}>
          <button type="button" data-action="削除" aria-label="伝票を削除" aria-disabled={!editable} tabIndex={editable ? 0 : -1} onClick={onDelete} style={icon(!editable, true)}>{TRASH}</button>
        </span>
      </span>
    </div>
  );
}

/** 削除の確認（伝票の内容を示し、取り消せないことを伝える） */
export function DeleteVoucherModal({ voucher, onClose, onDeleted }: { voucher: Voucher | null; onClose: () => void; onDeleted?: (v: Voucher) => void }) {
  const [agree, setAgree] = useState(false);
  const [shownId, setShownId] = useState<number | null>(null);
  if ((voucher?.id ?? null) !== shownId) { setShownId(voucher?.id ?? null); setAgree(false); }
  if (!voucher) return null;
  const siblings = getVouchers().filter((r) => r.seq === voucher.seq && r.no === voucher.no && r.id !== voucher.id).length;
  const cell: CSSProperties = { padding: '7px 12px', borderBottom: '1px solid #f1f4f6', fontSize: 14 };
  const head: CSSProperties = { ...cell, width: 96, background: '#f8fafc', color: '#8290a0', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' };
  const items: [string, ReactNode][] = [
    ['Seq／伝票No', <>{voucher.seq}　／　{voucher.no}<span style={{ marginLeft: 8, fontSize: 12, color: '#9aa5b1' }}>{voucher.kind}</span></>],
    ['年月日', `令和8年 ${voucher.date.replace('/', '月')}日`],
    ['区分', voucher.service],
    ['借方科目', voucher.kari],
    ['貸方科目', voucher.kashi],
    ['摘要', <>{voucher.tekiyo}{voucher.gyosha ? <span style={{ marginLeft: 8, color: '#7a8794' }}>／ {voucher.gyosha}</span> : null}</>],
    ['金額', <b style={{ fontVariantNumeric: 'tabular-nums', fontSize: 16 }}>{yen(voucher.amount)} 円</b>],
  ];
  return (
    <Modal open onClose={onClose} width={520} strict title={<span style={{ color: RED }}>伝票の削除</span>}>
      <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: '#fdeee9', border: '1px solid #f2c9c2', borderRadius: 10, color: '#8a2a1f', fontSize: 14, lineHeight: 1.7 }}>
          <span style={{ flex: 'none', width: 22, height: 22, borderRadius: '50%', background: RED, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>!</span>
          <span>次の伝票を削除します。<b>一度削除した伝票は元に戻せません。</b>内容を確認してください。</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8ee', borderRadius: 10 }}>
          <tbody>{items.map(([k, val]) => <tr key={k}><td style={head}>{k}</td><td style={cell}>{val}</td></tr>)}</tbody>
        </table>
        {siblings > 0 && <div style={{ fontSize: 14, color: '#7a8794' }}>この伝票には他に {siblings} 行あります。削除するのは上の1行だけです。</div>}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          内容を確認しました（削除すると元に戻せません）
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span title={agree ? '' : '上のチェックを入れると削除できます'} style={{ display: 'inline-flex', cursor: agree ? undefined : 'not-allowed' }}>
            <button type="button" data-action="削除する" aria-disabled={!agree} onClick={() => { if (!agree) return; deleteVoucher(voucher.id); onDeleted?.(voucher); onClose(); }} style={{ ...btn(RED, true), opacity: agree ? 1 : 0.4, pointerEvents: agree ? 'auto' : 'none' }}>削除する</button>
          </span>
          <button type="button" autoFocus onClick={onClose} style={{ ...btn(), marginLeft: 'auto', padding: '8px 22px' }}>キャンセル</button>
        </div>
      </div>
    </Modal>
  );
}

/** 一覧ごとに呼ぶフック：操作列のセル・注意書き・訂正／削除ダイアログをまとめて返す */
export function useRowActions({ rows, accent, returnTo }: { /** 画面に表示している順の伝票 */ rows: Voucher[]; accent: string; /** 訂正ダイアログの「戻る」に出す画面名 */ returnTo: string }) {
  const s = useSession();
  const toast = useToast();
  const [edit, setEdit] = useState<Voucher | null>(null);
  const [del, setDel] = useState<Voucher | null>(null);
  const editable = canEdit(s);
  const reorderable = canReorder(s);
  const editReason = editBlockReason(s);
  const reorderReason = reorderBlockReason(s);

  const neighbor = (v: Voucher, dir: -1 | 1) => {
    const i = rows.findIndex((r) => r.id === v.id);
    const n = i < 0 ? undefined : rows[i + dir];
    return n && n.date === v.date ? n : undefined;
  };
  /** 表示上の隣の行と入れ替える（絞り込み中でも、画面で隣り合う同一日の行と入れ替わる） */
  const move = (v: Voucher, dir: -1 | 1) => {
    if (!reorderable) return;
    const n = neighbor(v, dir);
    if (!n) { toast.show('同一日の中でのみ入れ替えできます'); return; }
    const all = getVouchers();
    const steps = Math.abs(all.findIndex((r) => r.id === n.id) - all.findIndex((r) => r.id === v.id));
    for (let k = 0; k < steps; k++) if (!moveVoucher(v.id, dir)) break;
  };
  const openEdit = (v: Voucher) => {
    // 参照のみ権限は「表示」として開く（訂正画面は表示専用）。区分の都合で訂正できないときは理由を出す
    if (!editable && !isViewOnly(s)) { toast.show(editReason || 'この伝票は訂正できません'); return; }
    setEdit(v);
  };
  const openDelete = (v: Voucher) => { if (editable) setDel(v); };

  const cell = (v: Voucher) => (
    <RowActions v={v} editable={editable} editReason={editReason} reorderable={reorderable} reorderReason={reorderReason} canUp={!!neighbor(v, -1)} canDown={!!neighbor(v, 1)} onMove={(d) => move(v, d)} onDelete={() => openDelete(v)} />
  );

  /* ---- ドラッグで表示順を入れ替える（同じ日の中。確認メモ #267） ---- */
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<{ id: number; pos: 'before' | 'after' } | null>(null);
  const endDrag = () => { setDragId(null); setOver(null); };
  /** v を target の位置へ（下へ動かすときは target の下、上へ動かすときは target の上） */
  const moveTo = (v: Voucher, target: Voucher) => {
    const all = getVouchers();
    const a = all.findIndex((r) => r.id === v.id), b = all.findIndex((r) => r.id === target.id);
    if (a < 0 || b < 0 || a === b) return;
    const dir = b > a ? 1 : -1;
    for (let k = 0; k < Math.abs(b - a); k++) if (!moveVoucher(v.id, dir)) break;
  };
  /** 行の左端に置くドラッグハンドル（行にマウスを載せたときだけ表示） */
  const handle = (v: Voucher) => (isViewOnly(s) ? null : (
    <span
      className="ra-hover"
      data-drag-handle
      draggable={reorderable}
      onClick={(e) => e.stopPropagation()}
      onDragStart={(e: DragEvent<HTMLSpanElement>) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(v.id));
        const tr = e.currentTarget.closest('tr');
        if (tr) e.dataTransfer.setDragImage(tr, 16, 16);
        setDragId(v.id);
      }}
      onDragEnd={endDrag}
      title={reorderable ? 'ドラッグして表示順を入れ替えます（同じ日の中）' : reorderReason}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 22, marginRight: 4, verticalAlign: 'middle', color: '#9aa5b1', cursor: reorderable ? 'grab' : 'not-allowed' }}
    >
      {GRIP}
    </span>
  ));
  const clickable = editable || isViewOnly(s);
  /** 一覧の行（tr）に付ける属性：ホバーの色・クリックで訂正・ドラッグの受け先 */
  const rowProps = (v: Voucher) => ({
    className: clickable ? 'row-hover ra-row' : 'ra-row',
    'data-drop': over?.id === v.id ? over.pos : undefined,
    'data-dragging': dragId === v.id || undefined,
    title: editable ? 'クリックで伝票を訂正' : isViewOnly(s) ? 'クリックで伝票の内容を表示' : undefined,
    onClick: (e: MouseEvent<HTMLTableRowElement>) => {
      if (e.shiftKey || e.metaKey || e.ctrlKey) return;
      // 文字を選択しただけのときは開かない
      if (String(window.getSelection?.() ?? '').trim()) return;
      if (clickable) openEdit(v);
    },
    onDragOver: (e: DragEvent<HTMLTableRowElement>) => {
      if (dragId == null) return;
      const d = rows.find((r) => r.id === dragId);
      if (!d || d.id === v.id || d.date !== v.date) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const pos = rows.indexOf(d) < rows.indexOf(v) ? 'after' : 'before';
      if (over?.id !== v.id || over.pos !== pos) setOver({ id: v.id, pos });
    },
    onDragLeave: () => { if (over?.id === v.id) setOver(null); },
    onDrop: (e: DragEvent<HTMLTableRowElement>) => {
      e.preventDefault();
      const d = rows.find((r) => r.id === dragId);
      if (d && d.date === v.date) moveTo(d, v);
      endDrag();
    },
  });

  /** 一覧の上に出す1行の注意書き（使える操作がすべて有効なら null） */
  const notice: ReactNode = !editable || !reorderable ? (
    <>
      <span style={{ padding: '1px 8px', borderRadius: 6, background: '#fff', border: '1px solid #f3d9b0', fontWeight: 700, fontSize: 12 }}>{s.role !== '入力可' ? '参照のみ' : startKindOf(s)}</span>
      <span>
        {editReason || reorderReason}。
        {isViewOnly(s) ? <>削除・表示順の入換のボタンは表示されません。<HelpTip style={{ marginLeft: 6 }} text="行をクリックすると伝票の内容を表示します" /></> : !editable ? `訂正・削除${!reorderable ? '・表示順の入換' : ''}は使えません（無効表示）。` : '表示順の入換は使えません（無効表示）。'}
      </span>
    </>
  ) : null;

  const modals = (
    <>
      <ToastView msg={toast.msg} />
      <EditVoucherModal voucher={edit} onClose={() => setEdit(null)} accent={accent} returnTo={returnTo} />
      <DeleteVoucherModal voucher={del} onClose={() => setDel(null)} onDeleted={(v) => toast.show(`Seq ${v.seq}（${v.date}　${yen(v.amount)}円）を削除しました`)} />
    </>
  );

  return { editable, reorderable, openEdit, openDelete, cell, handle, rowProps, notice, modals };
}

/** 操作列の見出し */
export const ACTION_TH: CSSProperties = { ...TH, width: 230 };
export const ACTION_HEAD = '証憑・チェック・付箋';
