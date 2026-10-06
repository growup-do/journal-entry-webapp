// 日記帳（仕訳一覧）＋ 訂正・削除・検索条件・行のフラグ
//   骨格は ReportShell 共通：集計期間（月）→ 絞り込み → 表示切替 → 一覧。
//   行の操作（証憑／チェック／付箋・▲▼入換・訂正・削除）は RowActions で全一覧共通（依頼書 5.4.4）。
//   表示切替＝摘要／業者・区分色・区分名（区分色・区分名は合算区分・親区分で起動したときに有効）。
//   CSV出力・検索条件・検索合計・貸借の色付けは画面上のボタン／表示（依頼書 5.4.3）。
//   旧 伝票メニューの「インポート伝票一括削除」「自動按分伝票一括削除」は右上の「一括削除 ▾」（依頼書 2.3／6.4）。

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { BizSwitch, useDivisionTools } from './DivisionTools';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { ExportDialog, type ExportSpec } from './ExportDialog';
import { NUM, ReportShell, SwitchPill, TD, TH, useMoney } from './ReportShell';
import { ACTION_HEAD, ACTION_TH, useRowActions } from './RowActions';
import { ToastView, useToast } from './Toast';
import { AdvancedSearchModal, DeleteVoucherModal, EMPTY_COND, applyCond, condActive, type SearchCond } from './VoucherEdit';
import { btn } from './ui';
import { ScreenPrintMenu } from './ScreenPrintMenu';
import { displayName } from '../data';
import { useVouchers, type Voucher } from '../store/journalStore';
import { getSession, setSession, useSession } from '../store/session';
import type { MonthFilter } from '../types';

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  onNavigate: (label: string) => void;
}

const KEY = '仕訳一覧';

export function JournalListPage({ variant, accent, onNavigate }: Props) {
  // 同額・不一致検索の「伝票表示」から開いたとき：不一致が見つかった日の伝票だけを表示し、戻り導線を出す
  const [boot] = useState(() => getSession().journalTarget);
  useEffect(() => { if (boot) setSession({ journalTarget: null }); }, [boot]);
  const all = useVouchers();
  const s = useSession();
  const money = useMoney();
  const [month, setMonthV] = useState<MonthFilter>(boot?.month ?? '8');
  const [day, setDay] = useState<number | null>(boot?.day ?? null);
  const setMonth = (v: MonthFilter) => { setMonthV(v); setDay(null); };
  const [kw, setKw] = useState('');
  const [cond, setCond] = useState<SearchCond>(EMPTY_COND);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showBiz, setShowBiz] = useState(false);
  /** 借方・貸方の色付け（依頼書 2.5／5.4.3：Fキーではなく画面上の切替） */
  const [colorDC, setColorDC] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [exp, setExp] = useState<ExportSpec | null>(null);
  const toast = useToast();
  const dt = useDivisionTools(all, accent);
  const title = displayName(KEY);

  const rows = applyCond(
    all.filter((r) => (month == null || r.date.split('/')[0] === month) && (day == null || Number(r.date.split('/')[1]) === day) && (!kw || [r.kari, r.kashi, r.tekiyo, r.gyosha ?? ''].some((x) => x.includes(kw)))),
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
  const periodLabel = month == null ? '令和8年 全期間' : day != null ? `令和8年 ${m}月${day}日` : `令和8年 ${m}月1日〜${m}月末日`;
  /** 複数行の選択（確認メモ #28）：行頭のチェック、Shift＋クリックで範囲、Ctrl／⌘＋クリックで追加・解除 */
  const [sel, setSel] = useState<number[]>([]);
  const [lastIdx, setLastIdx] = useState<number | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  useEffect(() => { setSel([]); setLastIdx(null); }, [month, day, kw, cond]);
  const toggleSel = (id: number, idx: number, shift: boolean) => {
    if (shift && lastIdx != null) {
      const [a, b] = [Math.min(lastIdx, idx), Math.max(lastIdx, idx)];
      const ids = rows.slice(a, b + 1).map((x) => x.id);
      setSel((cur) => Array.from(new Set([...cur, ...ids])));
    } else setSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    setLastIdx(idx);
  };
  const selectable = ra.editable;
  /** 一括削除（インポート伝票／自動按分伝票）：表示中の期間・絞り込みの中から対象行を選び、通常の削除確認に渡す */
  const bulkPick = (src: NonNullable<Voucher['source']>) => {
    setBulkOpen(false);
    const ids = rows.filter((r) => r.source === src).map((r) => r.id);
    if (ids.length === 0) return toast.show(`表示中の期間に${src}伝票はありません（月タブを「全月」にすると全期間が対象になります）`);
    setSel(ids); setDelOpen(true);
  };
  const colCount = 5 + (dt.nameOn ? 1 : 0) + 1 + (selectable ? 1 : 0);

  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title={title}
      subtitle="指定月の仕訳を伝票順に一覧します。行の右端の「訂正」「削除」、または行のダブルクリックで伝票を訂正できます。証憑・チェック・付箋は行の右端で切り替えます。"
      returnTo={boot ? { from: boot.from, onBack: () => onNavigate(boot.from), here: `${boot.month}月${boot.day}日の伝票`, hint: '伝票を訂正したら戻り、「検査継続」で再検査します' } : null}
      tools={[
        { label: '検索条件', onClick: () => setSearchOpen(true), primary: true },
        { label: 'CSV出力', onClick: () => setExp({ kind: 'csv', title, fileName: `日記帳_令和8年${month ?? '全'}月`, meta: `${periodLabel}　${rows.length} 件${filtered ? '（絞り込み中）' : ''}`, ...table }) },
      ]}
      extraTools={<>{selectable && <BulkDeleteMenu open={bulkOpen} onToggle={() => setBulkOpen((o) => !o)} onPick={bulkPick} />}<ScreenPrintMenu page="仕訳一覧" accent={accent} data={table} /></>}
      period={
        <>
          <FiscalMonthTabs current={month} accent={accent} onSelect={setMonth} withAll />
          <span style={{ fontSize: 12.5, color: '#48565f' }}>{month == null ? '令和8年 全期間' : day != null ? `令和8年 ${m}月${day}日（1日分）` : `令和8年 ${m}月1日 〜 令和8年 ${m}月末日`}</span>
          {day != null && <button type="button" onClick={() => setDay(null)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid ' + accent, background: '#fff', color: accent, fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{m}月{day}日のみ表示中 ×月全体を表示</button>}
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
      targetLabel="絞り込み"
      listNote={<span>行の右端の「訂正」「削除」、または行のダブルクリックで伝票を訂正できます{selectable && '。行頭のチェックで複数行を選び、まとめて削除できます'}</span>}
      target={
        <>
          <input className="search-input" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="科目・摘要・業者で絞り込み" autoComplete="off" style={{ width: 240, padding: '7px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
          {condActive(cond) && <button type="button" onClick={() => setCond(EMPTY_COND)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid ' + accent, background: '#fff', color: accent, fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>検索条件で絞り込み中 ×解除</button>}
          <span style={{ fontSize: 11.5, color: '#9aa5b1' }}>金額・伝票No・付箋・区分などは右上の「検索条件」で指定します</span>
        </>
      }
      switches={
        <>
          <BizSwitch on={showBiz} onChange={setShowBiz} accent={accent} />
          <SwitchPill label="貸借の色付け" on={colorDC} onChange={setColorDC} accent={accent} title="借方科目を青、貸方科目を赤で表示します" />
          {dt.switches}
        </>
      }
      controls={dt.legend}
      notice={ra.notice}
    >
      <ToastView msg={toast.msg} />
      {sel.length > 0 && (
        <div data-selection-bar style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff7cc', borderBottom: '1px solid #f3e3a0', fontSize: 12.5 }}>
          <b>{sel.length} 行を選択中</b>
          <span style={{ color: '#7a8794' }}>Shift＋クリックで範囲、Ctrl／⌘＋クリックで追加・解除</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => setSel([])} style={btn('#5b6773', false, true)}>選択解除</button>
            <button type="button" data-action="選択した行を削除" onClick={() => setDelOpen(true)} style={btn('#c0392b', true, true)}>選択した行を削除</button>
          </span>
        </div>
      )}
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 330px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {selectable && <th style={{ ...TH, width: 34, textAlign: 'center' }}><input type="checkbox" aria-label="表示中の行をすべて選択" title="表示中の行をすべて選択" checked={rows.length > 0 && sel.length === rows.length} onChange={() => setSel(sel.length === rows.length ? [] : rows.map((r) => r.id))} /></th>}
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
            {rows.map((r, idx) => (
              <tr key={r.id} data-voucher={r.id} data-selected={sel.includes(r.id) || undefined} onDoubleClick={() => ra.openEdit(r)} onClick={(e) => { if (selectable && (e.shiftKey || e.metaKey || e.ctrlKey)) { e.preventDefault(); toggleSel(r.id, idx, e.shiftKey); } }} title={ra.editable ? 'ダブルクリックで伝票を訂正' : undefined} style={{ cursor: ra.editable ? 'pointer' : 'default', background: sel.includes(r.id) ? '#fff7cc' : dt.rowBg(r) }}>
                {selectable && <td style={{ ...TD, textAlign: 'center' }} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.includes(r.id)} onChange={() => undefined} onClick={(e) => toggleSel(r.id, idx, e.shiftKey)} aria-label={`Seq ${r.seq} を選択`} /></td>}
                <td style={TD}><div style={{ fontWeight: 700 }}>{dt.chip(r)}{r.seq}</div></td>
                <td style={TD}><div style={{ fontSize: 10.5, color: '#9aa5b1' }}>{r.kind}{r.source && <span data-source={r.source} title={r.source === '自動按分' ? '自動按分で登録した伝票' : '銀行CSVなどから取り込んだ伝票'} style={{ marginLeft: 3, padding: '0 4px', borderRadius: 4, background: '#eef2f5', color: '#5b6773', fontWeight: 700 }}>{r.source === '自動按分' ? '按分' : r.source}</span>}</div><div>{r.date}</div></td>
                <td style={TD}>{r.no}</td>
                {dt.nameOn && <td style={TD}>{dt.nameTag(r)}</td>}
                <td style={TD}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontWeight: 500, minWidth: 180, color: colorDC ? '#2c5f9e' : undefined }}>{r.kari}</span>
                    <span style={{ color: '#9aa5b1' }}>―</span>
                    <span style={{ color: colorDC ? '#b0426a' : '#48565f' }}>{r.kashi}</span>
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
      {delOpen && <DeleteVoucherModal rows={all.filter((r) => sel.includes(r.id))} multi onClose={() => setDelOpen(false)} onDeleted={() => { toast.show(`${sel.length} 行の仕訳を削除しました`); setSel([]); }} />}
      <AdvancedSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} cond={cond} onApply={setCond} accent={accent} />
      <ExportDialog spec={exp} onClose={() => setExp(null)} accent={accent} />
      {dt.modal}
    </ReportShell>
  );
}

/** 旧 伝票メニューの「インポート伝票一括削除」「自動按分伝票一括削除」（依頼書 2.3／6.4）。対象の行を選んで「選択した仕訳の削除」の確認に渡す。入力内容を持たないメニューなので Esc で閉じてよい */
function BulkDeleteMenu({ open, onToggle, onPick }: { open: boolean; onToggle: () => void; onPick: (src: NonNullable<Voucher['source']>) => void }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onToggle(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onToggle]);
  const item: CSSProperties = { display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 8, fontSize: 12.5, fontWeight: 700, color: '#c0392b', fontFamily: 'inherit', cursor: 'pointer' };
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }} data-bulk-delete>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-haspopup="menu" title="インポート伝票・自動按分伝票をまとめて削除します" style={btn('#c0392b', false, true)}>一括削除 ▾</button>
      {open && (
        <div role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 40, minWidth: 280, background: '#fff', border: '1px solid #e2e8ee', borderRadius: 10, boxShadow: '0 10px 30px rgba(20,30,40,.14)', padding: 6 }}>
          <div style={{ padding: '4px 10px 6px', fontSize: 11, color: '#8290a0', lineHeight: 1.6 }}>表示中の期間・絞り込みの中から対象を選び、確認画面で削除します（削除した仕訳は元に戻せません）</div>
          {(['インポート', '自動按分'] as const).map((src) => (
            <button key={src} type="button" role="menuitem" data-bulk-src={src} onClick={() => onPick(src)} style={item}>
              {src}伝票を一括削除
              <span style={{ display: 'block', fontSize: 11, color: '#8290a0', fontWeight: 500 }}>{src === 'インポート' ? '銀行CSVなどから取り込んだ伝票（行に「インポート」の印）' : '自動按分で登録した伝票（行に「按分」の印）'}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
