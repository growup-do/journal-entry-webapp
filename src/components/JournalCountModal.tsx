// 仕訳数の問合せ（既存の小ダイアログの再現）。見出しに会計年度・区分名を表示する
//   各月の行の右に「全仕訳削除」を置く（現行は行の Shift＋ダブルクリック。隠し機能にしない。確認メモ #308）

import { useState } from 'react';
import { askConfirm } from './ConfirmDialog';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { Icon } from './ui';
import { NUM, TD, TH } from './ReportShell';
import { JOURNAL_COUNTS, displayName } from '../data';
import { useSession } from '../store/session';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function JournalCountModal({ open, onClose }: Props) {
  const s = useSession();
  const toast = useToast();
  // プロトタイプ：削除した月の件数は 0 にする（再読み込みで元に戻る）
  const [counts, setCounts] = useState(JOURNAL_COUNTS);
  const removeMonth = async (month: string, n: number) => {
    const ok = await askConfirm({
      title: '全仕訳削除',
      message: <>{s.fiscalYear}　{s.division}<br /><b>{month}</b>の仕訳 <b>{n} 件</b>を、すべて削除しますか？<br /><span style={{ color: '#c0392b' }}>削除すると取り消せません。</span></>,
      okLabel: '削除する',
      danger: true,
    });
    if (!ok) return;
    setCounts((cs) => cs.map((r) => (r.month === month ? { ...r, c: r.c.map(() => 0) } : r)));
    toast.show(`${month}の仕訳 ${n} 件を削除しました`);
  };
  const total = counts.reduce((t, r) => t.map((x, i) => x + r.c[i]), [0, 0, 0, 0, 0, 0]);
  return (
    <Modal open={open} onClose={onClose} width={680} title={<>{displayName('仕訳数')} <span style={{ fontSize: 14, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>{s.fiscalYear}　{s.division}</span></>}>
      <ToastView msg={toast.msg} />
      <div style={{ padding: '6px 20px 18px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>月</th>
              <th style={{ ...TH, textAlign: 'right' }}>仕訳数 合計</th>
              <th style={{ ...TH, textAlign: 'right' }}>単一</th>
              <th style={{ ...TH, textAlign: 'right' }}>伝（特）</th>
              <th style={{ ...TH, textAlign: 'right' }}>振替</th>
              <th style={{ ...TH, textAlign: 'right' }}>振単</th>
              <th style={{ ...TH, width: 112 }} aria-label="操作" />
            </tr>
          </thead>
          <tbody>
            {counts.map((r) => (
              <tr key={r.month} style={{ color: r.c[0] === 0 ? '#9aa5b1' : undefined }}>
                <td style={TD}>{r.month}</td>
                <td style={{ ...NUM, fontWeight: 700 }}>{r.c[0]}</td>
                <td style={NUM}>{r.c[1]}</td>
                <td style={NUM}>{r.c[2]}<span style={{ color: '#9aa5b1' }}>（{r.c[3]}）</span></td>
                <td style={NUM}>{r.c[4]}</td>
                <td style={NUM}>{r.c[5]}</td>
                <td style={{ ...TD, textAlign: 'right', padding: '2px 6px' }}>
                  <button type="button" className="month-row-act" data-danger data-delete-month={r.month} disabled={r.c[0] === 0} onClick={() => removeMonth(r.month, r.c[0])} title={r.c[0] === 0 ? 'この月には仕訳がありません' : `${r.month}の仕訳をすべて削除します`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 6px', border: 'none', borderRadius: 6, background: 'transparent', color: r.c[0] === 0 ? '#c3cbd3' : '#c0392b', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: r.c[0] === 0 ? 'default' : 'pointer', whiteSpace: 'nowrap', pointerEvents: r.c[0] === 0 ? 'none' : undefined }}>
                    <Icon name="trash" size={15} />全仕訳削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f3f6f9' }}>
              <td style={{ ...TD, fontWeight: 700 }}>年度計</td>
              <td style={{ ...NUM, fontWeight: 700 }}>{total[0]}</td>
              <td style={{ ...NUM, fontWeight: 700 }}>{total[1]}</td>
              <td style={{ ...NUM, fontWeight: 700 }}>{total[2]}<span style={{ color: '#9aa5b1' }}>（{total[3]}）</span></td>
              <td style={{ ...NUM, fontWeight: 700 }}>{total[4]}</td>
              <td style={{ ...NUM, fontWeight: 700 }}>{total[5]}</td>
              <td style={TD} />
            </tr>
          </tfoot>
        </table>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <button type="button" className="btn-outline" onClick={onClose} style={{ padding: '8px 40px', border: '1px solid #cfd8e0', borderRadius: 8, background: '#fff', color: '#22303c', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>閉じる</button>
        </div>
      </div>
    </Modal>
  );
}
