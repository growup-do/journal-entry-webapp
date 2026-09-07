// 仕訳数の確認（既存の小ダイアログの再現）

import { Modal } from './Modal';
import { NUM, TD, TH } from './ReportShell';
import { JOURNAL_COUNTS } from '../data';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function JournalCountModal({ open, onClose }: Props) {
  const total = JOURNAL_COUNTS.reduce((t, r) => t.map((x, i) => x + r.c[i]), [0, 0, 0, 0, 0, 0]);
  return (
    <Modal open={open} onClose={onClose} width={560} title="仕訳数の確認">
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
            </tr>
          </thead>
          <tbody>
            {JOURNAL_COUNTS.map((r) => (
              <tr key={r.month} style={{ color: r.c[0] === 0 ? '#9aa5b1' : undefined }}>
                <td style={TD}>{r.month}</td>
                <td style={{ ...NUM, fontWeight: 700 }}>{r.c[0]}</td>
                <td style={NUM}>{r.c[1]}</td>
                <td style={NUM}>{r.c[2]}<span style={{ color: '#9aa5b1' }}>（{r.c[3]}）</span></td>
                <td style={NUM}>{r.c[4]}</td>
                <td style={NUM}>{r.c[5]}</td>
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
            </tr>
          </tfoot>
        </table>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <button type="button" className="btn-outline" onClick={onClose} style={{ padding: '8px 40px', border: '1px solid #cfd8e0', borderRadius: 8, background: '#fff', color: '#22303c', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>閉じる</button>
        </div>
      </div>
    </Modal>
  );
}
