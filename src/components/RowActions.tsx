// 一覧行の操作（依頼書 5.4.4／6.4／6.5）— 日記帳・各元帳で同じ部品を使う
//   行の右端に「証憑・チェック・付箋」「▲▼（同一日内の表示順入換）」「訂正」「削除」を常に表示する。
//   削除は訂正から離して置き、確認ダイアログ（伝票の内容＋取り消せない旨）を経てから実行する。
//   参照のみ権限には操作ボタンを出さず「表示」だけ。親区分・合算区分で起動して使えないときは無効表示＋理由のツールチップ。

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Modal } from './Modal';
import { TH } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { EditVoucherModal, FlagCell } from './VoucherEdit';
import { btn } from './ui';
import { deleteVoucher, getVouchers, moveVoucher, type Voucher } from '../store/journalStore';
import { canEdit, canReorder, editBlockReason, isViewOnly, startKindOf, useSession, type Session } from '../store/session';

const RED = '#c0392b';
const yen = (n: number) => n.toLocaleString('ja-JP');

/** 表示順の入換が使えない理由（使えるときは空文字） */
export const reorderBlockReason = (s: Session) => (s.role !== '入力可' ? '参照のみの権限のため操作できません' : startKindOf(s) === '合算区分' ? '合算区分で起動中のため表示順の入換はできません' : '');

interface RowActionsProps {
  v: Voucher;
  accent: string;
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
  onEdit: () => void;
  onDelete: () => void;
}

const small = (color: string, disabled: boolean): CSSProperties => ({
  padding: '4px 10px', borderRadius: 7, border: '1px solid ' + (disabled ? '#dde4ea' : color), background: '#fff', color: disabled ? '#b3bcc5' : color,
  fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', pointerEvents: disabled ? 'none' : 'auto',
});
const arrow = (disabled: boolean): CSSProperties => ({
  width: 24, height: 24, padding: 0, borderRadius: 6, border: '1px solid ' + (disabled ? '#e6ecf1' : '#cfd8e0'), background: disabled ? '#f8fafc' : '#fff', color: disabled ? '#c8d0d8' : '#5b6773',
  fontSize: 10, fontWeight: 800, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', lineHeight: 1, pointerEvents: disabled ? 'none' : 'auto',
});

/** 行の操作エリア（1行分） */
export function RowActions({ v, accent, editable, editReason, reorderable, reorderReason, canUp, canDown, onMove, onEdit, onDelete }: RowActionsProps) {
  const s = useSession();
  if (isViewOnly(s)) {
    return (
      <div data-row-actions onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
        <FlagCell v={v} compact />
        <span style={{ width: 1, height: 18, background: '#e2e8ee', margin: '0 4px' }} />
        <button type="button" data-action="表示" title="伝票の内容を表示します（参照のみ）" onClick={onEdit} style={small(accent, false)}>表示</button>
      </div>
    );
  }
  const upOff = !reorderable || !canUp;
  const downOff = !reorderable || !canDown;
  const moveTip = (ok: boolean, label: string) => (!reorderable ? reorderReason : ok ? label : '同一日の中でのみ入れ替えできます');
  return (
    <div data-row-actions onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      <FlagCell v={v} compact />
      <span style={{ width: 1, height: 18, background: '#e2e8ee', margin: '0 4px' }} />
      <span title={moveTip(canUp, '表示順を1つ上へ（同一日内）')} style={{ display: 'inline-flex', cursor: upOff ? 'not-allowed' : undefined }}>
        <button type="button" aria-label="表示順を上へ" aria-disabled={upOff} tabIndex={upOff ? -1 : 0} onClick={() => onMove(-1)} style={arrow(upOff)}>▲</button>
      </span>
      <span title={moveTip(canDown, '表示順を1つ下へ（同一日内）')} style={{ display: 'inline-flex', cursor: downOff ? 'not-allowed' : undefined }}>
        <button type="button" aria-label="表示順を下へ" aria-disabled={downOff} tabIndex={downOff ? -1 : 0} onClick={() => onMove(1)} style={arrow(downOff)}>▼</button>
      </span>
      <span style={{ width: 1, height: 18, background: '#e2e8ee', margin: '0 4px' }} />
      <span title={editable ? '伝票を訂正する' : editReason} style={{ display: 'inline-flex', cursor: editable ? undefined : 'not-allowed' }}>
        <button type="button" data-action="訂正" aria-disabled={!editable} tabIndex={editable ? 0 : -1} onClick={onEdit} style={small(accent, !editable)}>訂正</button>
      </span>
      {/* 削除は誤操作を避けるため、訂正から間隔を空けて置く */}
      <span title={editable ? '伝票を削除する（確認があります）' : editReason} style={{ display: 'inline-flex', marginLeft: 16, cursor: editable ? undefined : 'not-allowed' }}>
        <button type="button" data-action="削除" aria-disabled={!editable} tabIndex={editable ? 0 : -1} onClick={onDelete} style={small(RED, !editable)}>削除</button>
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
  const cell: CSSProperties = { padding: '7px 12px', borderBottom: '1px solid #f1f4f6', fontSize: 13 };
  const head: CSSProperties = { ...cell, width: 96, background: '#f8fafc', color: '#8290a0', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' };
  const items: [string, ReactNode][] = [
    ['Seq／伝票No', <>{voucher.seq}　／　{voucher.no}<span style={{ marginLeft: 8, fontSize: 11, color: '#9aa5b1' }}>{voucher.kind}</span></>],
    ['年月日', `令和8年 ${voucher.date.replace('/', '月')}日`],
    ['区分', voucher.service],
    ['借方科目', voucher.kari],
    ['貸方科目', voucher.kashi],
    ['摘要', <>{voucher.tekiyo}{voucher.gyosha ? <span style={{ marginLeft: 8, color: '#7a8794' }}>／ {voucher.gyosha}</span> : null}</>],
    ['金額', <b style={{ fontVariantNumeric: 'tabular-nums', fontSize: 15 }}>{yen(voucher.amount)} 円</b>],
  ];
  return (
    <Modal open onClose={onClose} width={520} strict title={<span style={{ color: RED }}>伝票の削除</span>}>
      <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: '#fdeee9', border: '1px solid #f2c9c2', borderRadius: 10, color: '#8a2a1f', fontSize: 12.5, lineHeight: 1.7 }}>
          <span style={{ flex: 'none', width: 22, height: 22, borderRadius: '50%', background: RED, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>!</span>
          <span>次の伝票を削除します。<b>一度削除した伝票は元に戻せません。</b>内容を確認してください。</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8ee', borderRadius: 10 }}>
          <tbody>{items.map(([k, val]) => <tr key={k}><td style={head}>{k}</td><td style={cell}>{val}</td></tr>)}</tbody>
        </table>
        {siblings > 0 && <div style={{ fontSize: 12, color: '#7a8794' }}>この伝票には他に {siblings} 行あります。削除するのは上の1行だけです。</div>}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
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
    <RowActions v={v} accent={accent} editable={editable} editReason={editReason} reorderable={reorderable} reorderReason={reorderReason} canUp={!!neighbor(v, -1)} canDown={!!neighbor(v, 1)} onMove={(d) => move(v, d)} onEdit={() => openEdit(v)} onDelete={() => openDelete(v)} />
  );

  /** 一覧の上に出す1行の注意書き（使える操作がすべて有効なら null） */
  const notice: ReactNode = !editable || !reorderable ? (
    <>
      <span style={{ padding: '1px 8px', borderRadius: 6, background: '#fff', border: '1px solid #f3d9b0', fontWeight: 700, fontSize: 11 }}>{s.role !== '入力可' ? '参照のみ' : startKindOf(s)}</span>
      <span>
        {editReason || reorderReason}。
        {isViewOnly(s) ? '行の「表示」で伝票の内容を確認できます。訂正・削除・表示順の入換のボタンは表示されません。' : !editable ? `「訂正」「削除」${!reorderable ? '「▲▼（表示順の入換）」' : ''}は使えません（無効表示）。` : '「▲▼（表示順の入換）」は使えません（無効表示）。'}
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

  return { editable, reorderable, openEdit, openDelete, cell, notice, modals };
}

/** 操作列の見出し */
export const ACTION_TH: CSSProperties = { ...TH, width: 300 };
export const ACTION_HEAD = '証憑・チェック・付箋 ／ 入換 ／ 訂正・削除';
