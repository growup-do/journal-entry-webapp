// 仕訳一覧（既存「仕訳一覧」の再現）＋ 訂正モード・詳細検索・行のフラグ（提案F）
//   会計月タブ・指定年月日、行＝Seq-No／日／伝票No／借方―貸方／摘要／金額（2段表示）。
//   行クリック → 伝票の訂正モード。証憑／チェック／付箋は行上で切替。F5検索＝詳細検索（14条件）、検索合計。
//   F1ファイル出力・F7区分色・F8区分・F9摘要・F10業者・F11計算はボタン化。F3／F4入換は訂正モード内。

import { useState } from 'react';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { LABEL, NUM, ReportShell, TD, TH, yen } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { AdvancedSearchModal, EMPTY_COND, EditVoucherModal, FlagCell, applyCond, condActive, type SearchCond } from './VoucherEdit';
import { PrintDialog, PreviewModal, REPORTS } from './PrintCenter';
import { FUSEN_COLORS, useVouchers, type Voucher } from '../store/journalStore';
import { useSession } from '../store/session';
import type { MonthFilter } from '../types';

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  onNavigate: (label: string) => void;
}

export function JournalListPage({ variant, accent, onNavigate }: Props) {
  const all = useVouchers();
  const s = useSession();
  const [month, setMonth] = useState<MonthFilter>('8');
  const [kw, setKw] = useState('');
  const [cond, setCond] = useState<SearchCond>(EMPTY_COND);
  const [searchOpen, setSearchOpen] = useState(false);
  const [edit, setEdit] = useState<Voucher | null>(null);
  const [showBiz, setShowBiz] = useState(false);
  const [print, setPrint] = useState(false);
  const [preview, setPreview] = useState<{ title: string; opts: { from: string; to: string; output: string } } | null>(null);
  const toast = useToast();
  const rows = applyCond(all.filter((r) => (month == null || r.date.split('/')[0] === month) && (!kw || [r.kari, r.kashi, r.tekiyo, r.gyosha ?? ''].some((x) => x.includes(kw)))), cond);
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const m = month ?? '8';
  const filtered = condActive(cond) || !!kw;

  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title="仕訳一覧"
      subtitle="指定月の仕訳を伝票順に一覧します。行をクリックすると伝票を訂正できます。証憑・チェック・付箋は行上でクリックして切り替えます。"
      tools={[{ label: 'ファイル出力', onClick: () => toast.show('CSVファイルを出力しました（プロトタイプでは動作しません）') }, { label: '印刷', onClick: () => setPrint(true) }, { label: '検索', onClick: () => setSearchOpen(true), primary: true }, { label: '区分色' }, { label: '区分' }, { label: showBiz ? '摘要' : '業者', onClick: () => setShowBiz((b) => !b) }, { label: '計算', onClick: () => toast.show('再計算しました') }]}
      onBack={() => onNavigate('伝票入力')}
      controls={
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={LABEL}>会計月</span>
            <FiscalMonthTabs current={month} accent={accent} onSelect={setMonth} withAll />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12.5, color: '#48565f' }}>
            <span style={LABEL}>指定年月日</span>
            <span>令和8年 {m}月1日 〜 令和8年 {m}月末日</span>
            <input className="search-input" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="科目・摘要・業者で絞り込み" autoComplete="off" style={{ marginLeft: 12, width: 240, padding: '7px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
            {condActive(cond) && <button type="button" onClick={() => setCond(EMPTY_COND)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid ' + accent, background: '#fff', color: accent, fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>詳細検索中 ×解除</button>}
            <span style={{ marginLeft: 'auto' }}>
              <b style={{ color: '#22303c' }}>{rows.length}</b> 件　{filtered && s.env.searchTotal ? '検索合計' : '合計'} <b style={{ color: filtered ? accent : '#22303c', fontVariantNumeric: 'tabular-nums' }}>{yen(total)}</b>
            </span>
          </div>
        </>
      }
    >
      <ToastView msg={toast.msg} />
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 330px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: 70 }}>Seq-No</th>
              <th style={{ ...TH, width: 70 }}>日</th>
              <th style={{ ...TH, width: 70 }}>伝票</th>
              <th style={{ ...TH, width: 96 }}>証・チ・付</th>
              <th style={TH}>借方 ― 貸方 ／ {showBiz ? '業者' : '摘要'}</th>
              <th style={{ ...TH, width: 130, textAlign: 'right' }}>金額</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 40 }}>該当する仕訳がありません。</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} onClick={() => setEdit(r)} title="クリックで伝票を訂正" style={{ cursor: 'pointer', background: r.fusen ? FUSEN_COLORS[r.fusen] + '14' : 'transparent' }}>
                <td style={TD}><div style={{ fontWeight: 700 }}>{r.seq}</div><div style={{ fontSize: 10.5, color: '#9aa5b1' }}>{r.service.replace(/^\d+ /, '')}</div></td>
                <td style={TD}><div style={{ fontSize: 10.5, color: '#9aa5b1' }}>{r.kind}</div><div>{r.date}</div></td>
                <td style={TD}>{r.no}</td>
                <td style={TD}><FlagCell v={r} /></td>
                <td style={TD}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontWeight: 500, minWidth: 180 }}>{r.kari}</span>
                    <span style={{ color: '#9aa5b1' }}>―</span>
                    <span style={{ color: '#48565f' }}>{r.kashi}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#7a8794', marginTop: 2 }}>{showBiz ? (r.gyosha || '業者なし') : r.tekiyo}{!showBiz && r.gyosha ? `　／ ${r.gyosha}` : ''}{r.cheque ? `　小切手 ${r.cheque}` : ''}</div>
                </td>
                <td style={{ ...NUM, fontWeight: 700 }}>{yen(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <EditVoucherModal voucher={edit} onClose={() => setEdit(null)} accent={accent} returnTo="仕訳一覧" />
      <AdvancedSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} cond={cond} onApply={setCond} accent={accent} />
      <PrintDialog open={print} onClose={() => setPrint(false)} report={REPORTS[0]} accent={accent} onPreview={(title, opts) => setPreview({ title, opts })} />
      <PreviewModal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ''} opts={preview?.opts} accent={accent} />
    </ReportShell>
  );
}
