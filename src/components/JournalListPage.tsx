// 日記帳（仕訳一覧）＋ 訂正・削除・検索条件・行のフラグ
//   骨格は ReportShell 共通：集計期間（月）→ 絞り込み → 表示切替 → 一覧。
//   行の操作（証憑／チェック／付箋・▲▼入換・訂正・削除）は RowActions で全一覧共通（依頼書 5.4.4）。
//   表示切替＝摘要／業者・区分色・区分名（区分色・区分名は合算区分・親区分で起動したときに有効）。
//   CSV出力・検索条件・検索合計は画面上のボタン／表示（依頼書 5.4.3）。

import { useState } from 'react';
import { BizSwitch, useDivisionTools } from './DivisionTools';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { ExportDialog, type ExportSpec } from './ExportDialog';
import { LABEL, NUM, ReportShell, TD, TH, useMoney } from './ReportShell';
import { ACTION_HEAD, ACTION_TH, useRowActions } from './RowActions';
import { ToastView, useToast } from './Toast';
import { AdvancedSearchModal, EMPTY_COND, applyCond, condActive, type SearchCond } from './VoucherEdit';
import { PrintDialog, PreviewModal, REPORTS } from './PrintCenter';
import { displayName } from '../data';
import { useVouchers } from '../store/journalStore';
import { useSession } from '../store/session';
import type { MonthFilter } from '../types';

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  onNavigate: (label: string) => void;
}

const KEY = '仕訳一覧';

export function JournalListPage({ variant, accent }: Props) {
  const all = useVouchers();
  const s = useSession();
  const money = useMoney();
  const [month, setMonth] = useState<MonthFilter>('8');
  const [kw, setKw] = useState('');
  const [cond, setCond] = useState<SearchCond>(EMPTY_COND);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showBiz, setShowBiz] = useState(false);
  const [print, setPrint] = useState(false);
  const [preview, setPreview] = useState<{ title: string; opts: { from: string; to: string; output: string } } | null>(null);
  const [exp, setExp] = useState<ExportSpec | null>(null);
  const toast = useToast();
  const dt = useDivisionTools(all, accent);
  const title = displayName(KEY);

  const rows = applyCond(
    all.filter((r) => (month == null || r.date.split('/')[0] === month) && (!kw || [r.kari, r.kashi, r.tekiyo, r.gyosha ?? ''].some((x) => x.includes(kw)))),
    cond,
  );
  const ra = useRowActions({ rows, accent, returnTo: title });
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const m = month ?? '8';
  const filtered = condActive(cond) || !!kw;
  // 複合仕訳（1伝票に複数行）が検索結果に含まれるときは、検索合計を出さず注意を表示する
  const compound = filtered && rows.some((r) => all.some((x) => x.id !== r.id && x.seq === r.seq && x.no === r.no));
  // 表示中（絞り込み後）の仕訳をそのまま出力用の表にする（CSV出力・印刷・プレビューで共用）
  const table = {
    header: ['Seq', '日付', '伝票No', '種別', '借方科目', '貸方科目', '摘要', '業者', '金額', '区分'],
    rows: rows.map((r) => [r.seq, `令和8年${r.date.replace('/', '月')}日`, r.no, r.kind, r.kari, r.kashi, r.tekiyo, r.gyosha ?? '', r.amount, r.service]) as (string | number)[][],
  };
  const periodLabel = month == null ? '令和8年 全期間' : `令和8年 ${m}月1日〜${m}月末日`;
  const colCount = 5 + (dt.nameOn ? 1 : 0) + 1;

  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title={title}
      subtitle="指定月の仕訳を伝票順に一覧します。行の右端の「訂正」「削除」、または行のダブルクリックで伝票を訂正できます。証憑・チェック・付箋は行の右端で切り替えます。"
      tools={[
        { label: '検索条件', onClick: () => setSearchOpen(true), primary: true },
        { label: 'CSV出力', onClick: () => setExp({ kind: 'csv', title, fileName: `日記帳_令和8年${month ?? '全'}月`, meta: `${periodLabel}　${rows.length} 件${filtered ? '（絞り込み中）' : ''}`, ...table }) },
        { label: '印刷', onClick: () => setPrint(true) },
      ]}
      period={
        <>
          <span style={LABEL}>集計期間</span>
          <FiscalMonthTabs current={month} accent={accent} onSelect={setMonth} withAll />
          <span style={{ fontSize: 12.5, color: '#48565f' }}>{month == null ? '令和8年 全期間' : `令和8年 ${m}月1日 〜 令和8年 ${m}月末日`}</span>
        </>
      }
      periodAside={
        <span data-total style={{ fontSize: 12.5, color: '#48565f' }}>
          <b style={{ color: '#22303c' }}>{rows.length}</b> 件
          {compound ? (
            <span title="1枚の伝票に複数行ある仕訳（複合仕訳）が含まれるため、金額を単純に合計できません" style={{ padding: '2px 8px', borderRadius: 8, background: '#fff7e6', border: '1px solid #f3d9b0', color: '#8a5a00', fontSize: 11.5, fontWeight: 700 }}>複合仕訳を含むため検索合計は表示できません</span>
          ) : (
            <>{filtered && s.env.searchTotal ? '検索合計' : '合計'} <b style={{ color: filtered ? accent : '#22303c', fontVariantNumeric: 'tabular-nums' }}>{money(total)}</b></>
          )}
        </span>
      }
      target={
        <>
          <span style={LABEL}>絞り込み</span>
          <input className="search-input" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="科目・摘要・業者で絞り込み" autoComplete="off" style={{ width: 240, padding: '7px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
          {condActive(cond) && <button type="button" onClick={() => setCond(EMPTY_COND)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid ' + accent, background: '#fff', color: accent, fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>検索条件で絞り込み中 ×解除</button>}
          <span style={{ fontSize: 11.5, color: '#9aa5b1' }}>金額・伝票No・付箋・区分などは右上の「検索条件」で指定します</span>
        </>
      }
      switches={
        <>
          <BizSwitch on={showBiz} onChange={setShowBiz} accent={accent} />
          {dt.switches}
        </>
      }
      controls={dt.legend}
      notice={ra.notice}
    >
      <ToastView msg={toast.msg} />
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 330px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: 70 }}>Seq-No</th>
              <th style={{ ...TH, width: 70 }}>日</th>
              <th style={{ ...TH, width: 70 }}>伝票</th>
              {dt.nameOn && <th style={{ ...TH, width: 130 }}>区分名</th>}
              <th style={TH}>借方 ― 貸方 ／ {showBiz ? '業者' : '摘要'}</th>
              <th style={{ ...TH, width: 130, textAlign: 'right' }}>金額</th>
              <th style={ACTION_TH}>{ACTION_HEAD}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={colCount} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 40 }}>該当する仕訳がありません。</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} data-voucher={r.id} onDoubleClick={() => ra.openEdit(r)} title={ra.editable ? 'ダブルクリックで伝票を訂正' : undefined} style={{ cursor: ra.editable ? 'pointer' : 'default', background: dt.rowBg(r) }}>
                <td style={TD}><div style={{ fontWeight: 700 }}>{dt.chip(r)}{r.seq}</div></td>
                <td style={TD}><div style={{ fontSize: 10.5, color: '#9aa5b1' }}>{r.kind}</div><div>{r.date}</div></td>
                <td style={TD}>{r.no}</td>
                {dt.nameOn && <td style={TD}>{dt.nameTag(r)}</td>}
                <td style={TD}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontWeight: 500, minWidth: 180 }}>{r.kari}</span>
                    <span style={{ color: '#9aa5b1' }}>―</span>
                    <span style={{ color: '#48565f' }}>{r.kashi}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#7a8794', marginTop: 2 }}>{showBiz ? (r.gyosha || '業者なし') : r.tekiyo}{!showBiz && r.gyosha ? `　／ ${r.gyosha}` : ''}{r.cheque ? `　小切手 ${r.cheque}` : ''}</div>
                </td>
                <td style={{ ...NUM, fontWeight: 700 }}>{money(r.amount)}</td>
                <td style={{ ...TD, paddingTop: 5, paddingBottom: 5 }}>{ra.cell(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ra.modals}
      <AdvancedSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} cond={cond} onApply={setCond} accent={accent} />
      <PrintDialog open={print} onClose={() => setPrint(false)} report={REPORTS[0]} accent={accent} onPreview={(t, opts) => setPreview({ title: t, opts })} data={table} />
      <PreviewModal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ''} opts={preview?.opts} accent={accent} data={table} />
      <ExportDialog spec={exp} onClose={() => setExp(null)} accent={accent} />
      {dt.modal}
    </ReportShell>
  );
}
