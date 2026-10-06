// 各画面の「印刷」ボタン（依頼書 5.1.1：帳票はその帳票に関係する画面から印刷できるようにする）
//   現行の印刷メニュー（仕訳日記帳／元帳／試算表／予算書／決算書／補助簿／消費税／経営分析／内部取引 一覧表 …）を、
//   関係する画面ごとに振り分けた。帳票が1つの画面は「印刷」、複数の画面は「印刷 ▾」で帳票を選んでから共通の印刷ダイアログへ。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { PreviewModal, PrintDialog, REPORTS, sampleReportData, type ReportDef, type TableData } from './PrintCenter';
import { btn } from './ui';

export interface PrintItem { name: string; /** 詳細設定の元にする帳票（REPORTS の名前） */ base: string; note?: string; /** 画面に表示中の表を印刷データに使う */ screenData?: boolean }
export interface PrintGroup { label?: string; items: PrintItem[] }
/** 画面独自の印刷処理を呼ぶ項目（出納帳の集計内訳表など）。共通の印刷ダイアログは使わない */
export interface PrintAction { name: string; onClick: () => void; note?: string }
export interface PrintActionGroup { label?: string; items: PrintAction[] }

const JOURNAL = (screenData: boolean): PrintItem[] => [{ name: '日記帳', base: '仕訳日記帳', screenData }, { name: '伝票', base: '仕訳伝票（伝票式）' }, { name: '振替伝票', base: '振替伝票（振替式）' }];
const BUDGET_KINDS = ['前年度', '当初', '補正', '次年度'];
const CLOSING: PrintItem[] = [
  { name: '法人単位資金収支計算書', base: '資金収支計算書（第一号様式）', note: '第一号第一様式' }, { name: '社会福祉事業区分 資金収支内訳表', base: '資金収支計算書（第一号様式）', note: '第一号第三様式' }, { name: '拠点区分 資金収支計算書', base: '資金収支計算書（第一号様式）', note: '第一号第四様式' },
  { name: '法人単位事業活動計算書', base: '事業活動計算書（第二号様式）', note: '第二号第一様式' }, { name: '社会福祉事業区分 事業活動内訳表', base: '事業活動計算書（第二号様式）', note: '第二号第三様式' }, { name: '拠点区分 事業活動計算書', base: '事業活動計算書（第二号様式）', note: '第二号第四様式' },
  { name: '法人単位貸借対照表', base: '貸借対照表（第三号様式）', note: '第三号第一様式' }, { name: '社会福祉事業区分 貸借対照表内訳表', base: '貸借対照表（第三号様式）', note: '第三号第三様式' }, { name: '拠点区分 貸借対照表', base: '貸借対照表（第三号様式）', note: '第三号第四様式' },
];
const PRE_CLOSING: PrintItem[] = [
  { name: '拠点区分 貸借対照表明細書', base: '準決算書（C別紙6〜9／C1-5〜C3-6）' },
  ...['001 本部', '002 チャイルド保育園'].flatMap((d) => ['資金収支計算書', '事業活動計算書', '貸借対照表'].map((r) => ({ name: `${d}サービス区分 ${r}`, base: '準決算書（C別紙6〜9／C1-5〜C3-6）' }))),
];

/** 画面キー → 印刷できる帳票（現行の印刷メニューの振り分け） */
export const SCREEN_PRINTS: Record<string, PrintGroup[]> = {
  仕訳一覧: [{ label: '仕訳日記帳', items: JOURNAL(true) }, { label: '内部取引 一覧表', items: [{ name: '内部取引 仕訳一覧表', base: '仕訳日記帳' }] }],
  伝票入力: [{ label: '仕訳日記帳', items: JOURNAL(false) }],
  収入支出: [{ items: [{ name: '収入・支出調書', base: '仕訳伝票（伝票式）', screenData: true }] }],
  勘定元帳: [{ label: '元帳', items: [{ name: '総勘定元帳', base: '総勘定元帳', screenData: true }, { name: '集計元帳', base: '集計元帳' }] }, { label: '補助簿（明細表）', items: ['事業未収金', '未収金', '未収補助金', '事業未払金', 'その他の未払金', '未払費用', '職員預り金'].map((n) => ({ name: `${n} 明細表`, base: /預り/.test(n) ? '補助簿（現預金・預かり金）' : '補助簿（未払金・未収金）' })) }],
  資金元帳: [{ items: [{ name: '資金元帳', base: '資金元帳', screenData: true }] }],
  業者元帳: [{ label: '元帳', items: [{ name: '業者元帳', base: '業者元帳', screenData: true }, { name: '業者元帳（合算集計）法人全体', base: '業者元帳' }] }, { label: 'その他', items: [{ name: '業者内訳表', base: '業者元帳' }] }],
  業者推移: [{ items: [{ name: '業者内訳表', base: '業者元帳' }] }],
  月次試算: [{ label: '試算表', items: [{ name: '資金収支計算書', base: '資金収支計算書（試算表）' }, { name: '事業活動計算書', base: '事業活動計算書（試算表）' }, { name: '貸借対照表', base: '貸借対照表（試算表）', screenData: true }, { name: '資金収支残高試算表', base: '資金収支残高試算表' }, { name: '残高試算表', base: '残高試算表' }] }, { label: '内部取引 一覧表', items: [{ name: '内部取引 残高一覧表', base: '残高試算表' }] }],
  月次決算: [{ label: '決算書', items: CLOSING }, { label: '準決算書', items: PRE_CLOSING }, { label: 'その他', items: [{ name: '収支分析表', base: '収支分析表' }, { name: '決算書 表紙', base: '資金収支計算書（第一号様式）' }, { name: 'WAMNET連携出力', base: '自動按分出力（CSV）', note: 'CSV' }] }],
  予算: [{ label: '資金収支予算書', items: BUDGET_KINDS.map((k) => ({ name: `資金収支${k}予算書`, base: '予算書' })) }, { label: '拠点区分 資金収支予算書', items: BUDGET_KINDS.map((k) => ({ name: `拠点区分 資金収支${k}予算書`, base: '予算書' })) }],
  予算対比: [{ items: [{ name: '予算管理表（予算対比表）', base: '予算管理表（予算対比表）', screenData: true }, { name: '内部取引 予算一覧表', base: '予算書' }] }],
  税区分: [{ label: '消費税', items: ['消費税区分別集計内訳表', '消費税区分別集計表', '科目別消費税区分別集計表', '消費税区分コード内訳表'].map((n) => ({ name: n, base: '仕訳日記帳' })) }],
  仕訳辞書: [{ items: [{ name: '自動按分出力（CSV）', base: '自動按分出力（CSV）' }] }],
  共通の印刷設定: [{ label: '備考・摘要', items: [{ name: '社会福祉法人 チャイルド保育園 資金収支計算書（備考・摘要）', base: '資金収支計算書（第一号様式）' }, { name: 'チャイルド保育園拠点区分 資金収支計算書（備考・摘要）', base: '資金収支計算書（第一号様式）' }] }],
  経年グラフ: [{ label: '経営分析', items: [{ name: '経年推移グラフ', base: '経年推移表／経月推移表' }, { name: '経月推移グラフ', base: '経年推移表／経月推移表' }, { name: '前年度同月対比表', base: '前年度同月対比表' }, { name: '3期連続資金収支比較表', base: '3期連続資金収支比較表' }] }],
  分析グラフ: [{ label: '経営分析', items: [{ name: '財務分析一覧表', base: '財務分析一覧表（5年）' }, { name: '財務分析グラフ', base: '財務分析グラフ（10年）' }, { name: '財務分析シート', base: '財務分析一覧表（5年）' }, { name: '基本チェック表', base: '財務分析一覧表（5年）' }] }],
};

function reportOf(item: PrintItem): ReportDef {
  const base = REPORTS.find((r) => r.name === item.base);
  return { ...(base ?? { id: 'x', name: item.name, cat: '画面の帳票', detail: ['タイトルを印刷する', '区分名を印刷する'] }), id: 'menu:' + item.name, name: item.name, note: item.note, cat: base?.cat ?? '画面の帳票' };
}

/** 画面の「印刷」ボタン。帳票が1つならそのまま印刷ダイアログ、複数なら一覧から選ぶ */
export function ScreenPrintMenu({ page, groups, actions, accent, data, label = '印刷', small, tone, style }: { page?: string; groups?: PrintGroup[]; /** 画面独自の印刷処理（指定時は groups／page より優先） */ actions?: PrintActionGroup[]; accent: string; /** 画面に表示中の表（screenData の帳票に使う） */ data?: TableData; label?: string; small?: boolean; /** 'act'＝伝票入力の操作ボタン（定型仕訳など）と同じ大きさ・色 */ tone?: 'act'; style?: CSSProperties }) {
  const gs: { label?: string; items: (PrintItem | PrintAction)[] }[] = actions ?? groups ?? (page ? SCREEN_PRINTS[page] : undefined) ?? [];
  const items = gs.flatMap((g) => g.items);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<PrintItem | null>(null);
  const [preview, setPreview] = useState<{ title: string; opts: { from: string; to: string; output: string; hideZero?: boolean } } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  if (items.length === 0) return null;
  const single = items.length === 1;
  const choose = (it: PrintItem | PrintAction) => { setOpen(false); if ('onClick' in it) it.onClick(); else setPicked(it); };
  const report = picked ? reportOf(picked) : null;
  const pdata = picked?.screenData ? data : undefined;
  const icon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="9" rx="2" /><path d="M7 14h10v7H7z" /></svg>;
  return (
    <div ref={ref} data-screen-print={page ?? (actions ? 'actions' : 'custom')} style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" className={tone === 'act' ? 'ef-act' : 'btn-outline'} aria-haspopup={single ? undefined : 'menu'} aria-expanded={single ? undefined : open} onClick={() => (single ? choose(items[0]) : setOpen((o) => !o))} title={single ? `${items[0].name} を印刷（期間・詳細設定・出力先を指定）` : 'この画面に関係する帳票を選んで印刷します'} style={{ ...(tone === 'act' ? { padding: '6px 10px', borderRadius: 8, border: '1px solid #cfd8e0', background: '#fff', color: '#48565f', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' } : btn(accent, false, small)), display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
        {icon}{label}{!single && <span aria-hidden style={{ fontSize: 10, marginLeft: 2 }}>▾</span>}
      </button>
      {open && !single && (
        <div role="menu" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 280, maxWidth: 420, maxHeight: '60vh', overflowY: 'auto', background: '#fff', border: '1px solid #dde4ea', borderRadius: 10, boxShadow: '0 12px 32px rgba(24,42,62,.16)', padding: 6, zIndex: 120, textAlign: 'left' }}>
          {gs.map((g, gi) => (
            <div key={gi} style={{ paddingBottom: gi < gs.length - 1 ? 4 : 0, marginBottom: gi < gs.length - 1 ? 4 : 0, borderBottom: gi < gs.length - 1 ? '1px solid #eef2f5' : 'none' }}>
              {g.label && <div style={{ padding: '6px 10px 3px', fontSize: 10.5, fontWeight: 800, color: '#8290a0', letterSpacing: '.04em' }}>{g.label}</div>}
              {g.items.map((it) => (
                <button key={it.name} type="button" role="menuitem" className="menu-sub" data-print-item={it.name} onClick={() => choose(it)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', borderRadius: 7, background: 'transparent', fontFamily: 'inherit', fontSize: 12.5, color: '#22303c', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</span>
                  {it.note && <span style={{ marginLeft: 'auto', fontSize: 10.5, color: '#9aa5b1', flex: 'none' }}>{it.note}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      <PrintDialog open={!!picked} onClose={() => setPicked(null)} report={report} accent={accent} data={pdata} keepOpenOnPreview onPreview={(title, opts) => setPreview({ title, opts })} />
      <PreviewModal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ''} opts={preview?.opts} accent={accent} data={preview ? (report && preview.title === report.name && pdata ? pdata : sampleReportData(preview.title)) : undefined} />
    </div>
  );
}

/** ReportShell の tools と並べるための薄い包み */
export const printTool = (node: ReactNode) => node;
