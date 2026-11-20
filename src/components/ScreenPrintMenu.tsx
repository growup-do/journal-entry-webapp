// 各画面の「印刷」ボタン（依頼書 5.1.1：帳票はその帳票に関係する画面から印刷できるようにする）
//   現行の印刷メニュー（仕訳日記帳／元帳／試算表／予算書／決算書／補助簿／消費税／経営分析／内部取引 一覧表 …）を、
//   関係する画面ごとに振り分けた。帳票が1つの画面は「印刷」、複数の画面は「印刷 ▾」で帳票を選んでから共通の印刷ダイアログへ。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { PreviewModal, PrintDialog, SCREEN_DETAIL, sampleReportData, type ReportDef, type TableData } from './PrintCenter';
import { REPORTS, condOk } from './printCatalog';
import { useSession } from '../store/session';
import { Chevron, PrintIcon, btn } from './ui';

export interface PrintItem { name: string; /** 詳細設定の元にする帳票（REPORTS の名前）。'WAMNET' は WAMNET連携のダイアログで扱う */ base: string; note?: string; /** 画面に表示中の表を印刷データに使う */ screenData?: boolean; /** 決算書の様式（共通の印刷設定「様式設定」で省略にした様式はメニューに出さない） */ form?: string }
export interface PrintGroup { label?: string; items: PrintItem[]; /** 次のグループとの区切りを点線にする（同じ種類の帳票の中の区切り） */ dashedBelow?: boolean }
/** 画面独自の印刷処理を呼ぶ項目（出納帳の集計内訳表など）。共通の印刷ダイアログは使わない */
export interface PrintAction { name: string; onClick: () => void; note?: string }
/** items には、共通の印刷ダイアログへ回す帳票（PrintItem）も混ぜられる（月次決算の WAMNET連携出力 など） */
export interface PrintActionGroup { label?: string; items: (PrintAction | PrintItem)[]; /** この分類の下を破線で区切る */ dashedBelow?: boolean }

const JOURNAL = (screenData: boolean): PrintItem[] => [{ name: '日記帳', base: '仕訳日記帳', screenData }, { name: '伝票', base: '仕訳伝票（伝票式）' }, { name: '振替伝票', base: '振替伝票（振替式）' }];
const BUDGET_KINDS = ['前年度', '当初', '補正', '次年度'];
// 決算書の様式（第一〜第四様式）。第二様式（事業区分別の内訳表）も現行の印刷メニューにある（確認事項「【帳票・印刷】現行との差分について」）
const CLOSING: PrintItem[] = REPORTS.filter((r) => r.cat === '決算書').map((r) => ({ name: r.name.replace('○○事業区分', '社会福祉事業区分').replace('○○拠点区分', '拠点区分'), base: r.name, note: r.note, form: r.form }));
/** WAMNET連携出力（現行の印刷メニューの 7 項目）。選ぶと WAMNET連携のダイアログを開く */
const WAMNET: PrintItem[] = ['WAMNET連携設定', 'WAMNET連携科目チェック', 'WAMNET連携ファイル出力', 'WAMNET連携注記出力（PDF）', 'WAMNET連携注記出力（Excel）', 'WAMNET連携附属明細書出力（PDF）', 'WAMNET連携附属明細書出力（Excel）'].map((name) => ({ name, base: 'WAMNET' }));
const PRE_CLOSING: PrintItem[] = [
  { name: '拠点区分 貸借対照表明細書', base: '○○拠点区分 貸借対照表明細書', note: 'C別紙6', form: 'pc6' },
  ...['001 本部', '002 チャイルド保育園'].flatMap((d) => (['資金収支計算書', '事業活動計算書', '貸借対照表'] as const).map((r, i) => ({ name: `${d}サービス区分 ${r}`, base: `○○サービス区分 ${r}`, note: `C${i + 1}-5`, form: `pc${i + 1}-5` }))),
];

/** 画面キー → 印刷できる帳票（現行の印刷メニューの振り分け） */
export const SCREEN_PRINTS: Record<string, PrintGroup[]> = {
  仕訳一覧: [{ label: '仕訳日記帳', items: JOURNAL(true) }, { label: '内部取引 一覧表', items: [{ name: '内部取引 仕訳一覧表', base: '内部取引 仕訳一覧表' }] }],
  伝票入力: [{ label: '仕訳日記帳', items: JOURNAL(false) }],
  収入支出: [{ items: [{ name: '収入・支出調書', base: '仕訳伝票（伝票式）', screenData: true }] }],
  勘定元帳: [{ label: '元帳', items: [{ name: '総勘定元帳', base: '総勘定元帳', screenData: true }, { name: '集計元帳', base: '集計元帳' }] }, { label: '補助簿（明細表）', items: ['事業未収金', '未収金', '未収補助金', '事業未払金', 'その他の未払金', '未払費用', '職員預り金'].map((n) => ({ name: `${n} 明細表`, base: '○○［科目名］明細表' })) }],
  資金元帳: [{ items: [{ name: '資金元帳', base: '資金元帳', screenData: true }] }],
  業者元帳: [{ label: '元帳', items: [{ name: '取引先元帳', base: '取引先元帳', screenData: true }, { name: '取引先元帳（合算集計）法人全体', base: '取引先元帳' }] }, { label: 'その他', items: [{ name: '取引先内訳表', base: '取引先内訳表' }] }],
  業者推移: [{ items: [{ name: '取引先内訳表', base: '取引先内訳表' }] }],
  月次試算: [{ label: '試算表', items: [{ name: '資金収支計算書', base: '資金収支計算書（試算表）' }, { name: '事業活動計算書', base: '事業活動計算書（試算表）' }, { name: '貸借対照表', base: '貸借対照表（試算表）', screenData: true }, { name: '資金収支残高試算表', base: '資金収支残高試算表' }, { name: '残高試算表', base: '残高試算表' }] }, { label: '内部取引 一覧表', items: [{ name: '内部取引 残高一覧表', base: '内部取引 残高一覧表' }] }],
  月次決算: [{ label: '決算書', items: CLOSING }, { label: '準決算書', items: PRE_CLOSING }, { label: 'その他', items: [{ name: '収支分析表', base: '収支分析表' }, { name: '決算書 表紙', base: '決算書 表紙' }] }, { label: 'WAMNET連携出力', items: WAMNET }],
  予算: [{ label: '予算書', items: [...BUDGET_KINDS.map((k) => ({ name: `資金収支${k}予算書`, base: `資金収支${k}予算書` })), { name: '資金収支予算内訳表', base: '資金収支予算内訳表' }, { name: '資金収支次年度予算内訳表', base: '資金収支次年度予算内訳表' }] }, { label: '予算書（拠点区分）', items: BUDGET_KINDS.map((k) => ({ name: `資金収支${k}予算書（拠点区分）`, base: `資金収支${k}予算書（拠点区分）` })) }],
  // 予算書・予算管理表（月別の推移表を含む）は、予算対比表の「印刷 ▾」からも出す（確認事項「【帳票・印刷】現行との差分について」）
  予算対比: [
    { label: '予算管理表', items: [{ name: '資金収支予算管理表（予算対比表）', base: '予算管理表（予算対比表）', screenData: true }, { name: '資金収支月別予算推移表', base: '資金収支月別予算推移表' }, { name: '資金収支月別実績推移表', base: '資金収支月別実績推移表' }, { name: '資金収支月別予算実績推移表', base: '資金収支月別予算実績推移表' }] },
    { label: '予算書', items: BUDGET_KINDS.map((k) => ({ name: `資金収支${k}予算書`, base: `資金収支${k}予算書` })) },
    { label: '予算書（拠点区分）', items: BUDGET_KINDS.map((k) => ({ name: `資金収支${k}予算書（拠点区分）`, base: `資金収支${k}予算書（拠点区分）` })) },
    { label: '内部取引 一覧表', items: [{ name: '内部取引 予算一覧表', base: '内部取引 予算一覧表' }] },
  ],
  税区分: [{ label: '消費税', items: ['消費税区分別集計内訳表', '消費税区分別集計表', '科目別消費税区分別集計表', '消費税区分コード内訳表', '売上仕入税額集計表'].map((n) => ({ name: n, base: n })) }],
  仕訳辞書: [{ items: [{ name: '自動按分出力', base: '自動按分出力' }] }],
  共通の印刷設定: [{ label: '備考・摘要', items: [{ name: '社会福祉法人 チャイルド保育園 資金収支計算書（備考・摘要）', base: '法人単位資金収支計算書' }, { name: 'チャイルド保育園拠点区分 資金収支計算書（備考・摘要）', base: '○○拠点区分 資金収支計算書' }] }],
  経年グラフ: [{ label: '経営分析', items: ['経年推移グラフ', '経月推移グラフ', '前年度同月対比表', '3期連続資金収支比較表', '経年推移内訳グラフ', '経月推移内訳グラフ'].map((n) => ({ name: n, base: n })) }],
  分析グラフ: [{ label: '経営分析', items: ['財務分析一覧表', '財務分析グラフ', '財務分析シート', '基本チェック表', '財務分析内訳グラフ'].map((n) => ({ name: n, base: n })) }],
};

function reportOf(item: PrintItem): ReportDef {
  const base = REPORTS.find((r) => r.name === item.base);
  return { ...(base ?? { id: 'x', name: item.name, cat: '画面の帳票', detail: SCREEN_DETAIL }), id: 'menu:' + item.name, name: item.name, note: item.note ?? base?.note, cat: base?.cat ?? '画面の帳票' };
}

/** 画面の「印刷」ボタン。帳票が1つならそのまま印刷ダイアログ、複数なら一覧から選ぶ */
export function ScreenPrintMenu({ page, groups, actions, accent, data, label = '印刷', small, tone, style }: { page?: string; groups?: PrintGroup[]; /** 画面独自の印刷処理（指定時は groups／page より優先） */ actions?: PrintActionGroup[]; accent: string; /** 画面に表示中の表（screenData の帳票に使う） */ data?: TableData; label?: string; small?: boolean; /** 'act'＝伝票入力の操作ボタン（定型仕訳など）と同じ大きさ・色 */ tone?: 'act'; style?: CSSProperties }) {
  const s = useSession();
  const okItem = (it: PrintItem | PrintAction) => { if ('onClick' in it) return true; const base = REPORTS.find((r) => r.name === it.base); return !base || condOk(base, s); };
  const gs: { label?: string; items: (PrintItem | PrintAction)[]; dashedBelow?: boolean }[] = (actions ?? groups ?? (page ? SCREEN_PRINTS[page] : undefined) ?? []).map((g) => ({ ...g, items: g.items.filter(okItem) })).filter((g) => g.items.length > 0);
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
  const icon = <PrintIcon />;
  return (
    <div ref={ref} data-screen-print={page ?? (actions ? 'actions' : 'custom')} style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" className={tone === 'act' ? 'ef-act' : 'btn-outline'} aria-haspopup={single ? undefined : 'menu'} aria-expanded={single ? undefined : open} onClick={() => (single ? choose(items[0]) : setOpen((o) => !o))} title={single ? `${items[0].name} を印刷（期間・詳細設定・出力先を指定）` : 'この画面に関係する帳票を選んで印刷します'} style={{ ...(tone === 'act' ? { padding: '6px 10px', borderRadius: 8, border: '1px solid #cfd8e0', background: '#fff', color: '#48565f', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' } : btn(accent, false, small)), display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
        {icon}{label}{!single && <Chevron open={open} color="currentColor" />}
      </button>
      {open && !single && (
        <div role="menu" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 280, maxWidth: 420, maxHeight: '60vh', overflowY: 'auto', background: '#fff', border: '1px solid #dde4ea', borderRadius: 10, boxShadow: '0 12px 32px rgba(24,42,62,.16)', padding: 6, zIndex: 120, textAlign: 'left' }}>
          {gs.map((g, gi) => (
            <div key={gi} style={{ paddingBottom: gi < gs.length - 1 ? 4 : 0, marginBottom: gi < gs.length - 1 ? 4 : 0, borderBottom: gi < gs.length - 1 ? (g.dashedBelow ? '1px dashed #b4bfca' : '1px solid #eef2f5') : 'none' }}>
              {g.label && <div style={{ padding: '6px 10px 3px', fontSize: 12, fontWeight: 800, color: '#8290a0', letterSpacing: '.04em' }}>{g.label}</div>}
              {g.items.map((it) => (
                <button key={it.name} type="button" role="menuitem" className="menu-sub" data-print-item={it.name} onClick={() => choose(it)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', borderRadius: 7, background: 'transparent', fontFamily: 'inherit', fontSize: 14, color: '#22303c', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</span>
                  {it.note && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9aa5b1', flex: 'none' }}>{it.note}</span>}
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
