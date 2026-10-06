// 元帳（総勘定元帳／資金元帳／業者元帳の共通部品）
//   骨格は ReportShell 共通：集計期間（月）→ 指定科目（業者）→ 表示切替 → 一覧。
//   試算表・決算書・推移表からドリルダウンで開いたときは、先頭に「← ○○に戻る」を表示する（依頼書 5.4.1）。
//   行の操作（証憑／チェック／付箋・▲▼入換・訂正・削除）は RowActions で全一覧共通（依頼書 5.4.4）。
//   表示切替＝摘要／業者・区分色・区分名・消費税表示（資金元帳のみ：税区分／税額の列を追加）。

import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { AssistField } from './AssistField';
import { BizSwitch, useDivisionTools } from './DivisionTools';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { ExportDialog, type ExportSpec } from './ExportDialog';
import { taxOf } from './InquiryPages';
import { CHECK, LABEL, NUM, ReportShell, SwitchPill, TD, TH, moneyText, useMoney } from './ReportShell';
import { ACTION_HEAD, ACTION_TH, useRowActions } from './RowActions';
import { ToastView, useToast } from './Toast';
import { ScreenPrintMenu } from './ScreenPrintMenu';
import { displayName } from '../data';
import { useVouchers } from '../store/journalStore';
import { getSession, setSession, useSession } from '../store/session';
import { useAssist } from '../hooks/useAssist';
import type { MonthFilter } from '../types';

export type LedgerKind = 'account' | 'fund' | 'vendor';
/** 画面キー（ルーティング・確認メモで使用。表示名は displayName で現行の用語に合わせる） */
const KEY: Record<LedgerKind, string> = { account: '勘定元帳', fund: '資金元帳', vendor: '業者元帳' };
const CARRY = 1_000_000;

/** 税額（内税）。課税仕入のみ計算し、それ以外は 0 */
const taxAmount = (tax: string, amount: number) => (tax.includes('10%') ? Math.floor((amount * 10) / 110) : tax.includes('8%') ? Math.floor((amount * 8) / 108) : 0);

interface Props {
  kind: LedgerKind;
  variant: 'form' | 'sheet';
  accent: string;
  accentRgb: string;
  onNavigate: (label: string) => void;
}

export function LedgerPage({ kind, variant, accent, accentRgb, onNavigate }: Props) {
  // 推移表・試算表・決算書からのドリルダウン（科目・月・呼び出し元を引き継ぐ）
  const [boot] = useState(() => getSession().ledgerTarget);
  useEffect(() => { if (boot) setSession({ ledgerTarget: null }); }, [boot]);
  const s = useSession();
  const money = useMoney();
  const [month, setMonth] = useState<MonthFilter>(boot?.month ?? '8');
  const [target, setTarget] = useState(boot?.account ?? (kind === 'vendor' ? '中央リース' : '普通預金（保育園）'));
  const all = useVouchers();
  const [opts, setOpts] = useState({ check: false, red: false, blue: false, yellow: false, green: false, daily: true, spare: true, internal: false });
  const assist = useAssist();
  const isVendor = kind === 'vendor';
  const isFund = kind === 'fund';
  const dt = useDivisionTools(all, accent);
  const [showBiz, setShowBiz] = useState(false);
  const [showTax, setShowTax] = useState(false);
  const [exp, setExp] = useState<ExportSpec | null>(null);
  const toast = useToast();
  const title = displayName(KEY[kind]);
  const from = boot?.from;

  const rows = all.filter((r) => (month == null || r.date.split('/')[0] === month) && (isVendor ? r.gyosha === target : r.kari === target || r.kashi === target) && (!opts.check || r.check) && (!opts.internal || !!r.internal) && (!(opts.red || opts.blue || opts.yellow || opts.green) || (opts.red && r.fusen === '赤') || (opts.blue && r.fusen === '青') || (opts.yellow && r.fusen === '黄') || (opts.green && r.fusen === '緑')));
  const ra = useRowActions({ rows, accent, returnTo: title });
  let bal = CARRY;
  const lines = rows.map((r, i) => {
    const debit = isVendor ? r.amount : r.kari === target ? r.amount : 0;
    const credit = isVendor ? 0 : r.kashi === target ? r.amount : 0;
    bal += debit - credit;
    const tax = taxOf(r);
    // 「残高を日計で表示する」：その日の最後の行にだけ残高を出す
    const dayEnd = rows[i + 1]?.date !== r.date;
    return { r, debit, credit, bal, other: r.kari === target ? r.kashi : r.kari, tax, taxAmt: taxAmount(tax, r.amount), dayEnd };
  });
  const sumD = lines.reduce((a, l) => a + l.debit, 0);
  const sumC = lines.reduce((a, l) => a + l.credit, 0);
  const sumTax = lines.reduce((a, l) => a + l.taxAmt, 0);
  const m = month ?? '8';
  const toggle = (k: keyof typeof opts) => setOpts((o) => ({ ...o, [k]: !o[k] }));
  const taxCols = isFund && showTax;
  // 印刷／Excel：表示中の明細（繰越・月計を含む）をそのまま出力
  const exportTable = () => {
    const header = isVendor ? ['月日', 'Seq-No', '借方科目', '貸方科目', '摘要', '金額', '残高'] : ['月日', 'Seq-No', '相手科目', '摘要', '業者', ...(taxCols ? ['税区分', '税額'] : []), '借方', '貸方', '残高'];
    const pad = taxCols ? ['', ''] : [];
    const body: (string | number)[][] = isVendor
      ? [['', '', '繰越金額', '', '', '', CARRY], ...lines.map((l) => [l.r.date, l.r.seq, l.r.kari, l.r.kashi, l.r.tekiyo, l.debit, l.bal]), ['月計', '', '', '', '', sumD, bal]]
      : [['', '', '繰越金額', '', '', ...pad, '', '', CARRY], ...lines.map((l) => [l.r.date, l.r.seq, l.other, l.r.tekiyo, l.r.gyosha ?? '', ...(taxCols ? [l.tax, l.taxAmt || ''] : []), l.debit || '', l.credit || '', l.bal]), ['月計', '', '', '', '', ...(taxCols ? ['', sumTax] : []), sumD, sumC, bal]];
    return { header, rows: body };
  };
  const openExport = (out: 'print' | 'excel') => {
    const { header, rows: body } = exportTable();
    setExp({ kind: out, title: `${title}　${target}`, fileName: `${title}_${target}_令和8年${m}月`, meta: `${s.fiscalYear}　${s.division}　令和8年 ${m}月1日〜${m}月末日`, header, rows: body });
  };

  const fieldBtn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: 260, boxSizing: 'border-box', padding: '7px 10px', background: '#fff', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', color: 'inherit' };
  const stats: { label: string; value: ReactNode; hi?: boolean }[] = kind === 'account'
    ? [{ label: '実績', value: money(sumD - sumC) }]
    : [{ label: '予算', value: money(3_000_000) }, { label: '実績', value: money(sumD - sumC) }, { label: '残高', value: money(3_000_000 - (sumD - sumC)) }, { label: '達成率', value: ((sumD - sumC) / 3_000_000 * 100).toFixed(1) + '%', hi: true }];
  // 列数：月日・Seq・（区分名）・相手科目・（税区分・税額）・借方・（貸方）・残高・操作
  const leadCols = 3 + (dt.nameOn ? 1 : 0) + (taxCols ? 2 : 0);
  const colCount = leadCols + (isVendor ? 1 : 2) + 2;

  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title={title}
      subtitle={isVendor ? '指定した業者の取引を日付順に表示します。行の右端の「訂正」「削除」、または行のダブルクリックで伝票を訂正できます。' : '指定した科目の仕訳を日付順に表示し、残高を計算します。行の右端の「訂正」「削除」、または行のダブルクリックで伝票を訂正できます。'}
      returnTo={from ? { from, onBack: () => onNavigate(from), here: `${target}　${m}月` } : null}
      extraTools={<ScreenPrintMenu page={kind === 'vendor' ? '業者元帳' : kind === 'fund' ? '資金元帳' : '勘定元帳'} accent={accent} data={exportTable()} />}
      tools={[{ label: isVendor ? '業者検索' : '科目検索', onClick: () => assist.open('target', isVendor ? 'vendor' : 'account'), primary: true }, { label: 'Excel', onClick: () => openExport('excel') }, { label: '再計算', onClick: () => toast.show(`再計算しました（${lines.length} 件　残高 ${moneyText(bal, s.env)}）`) }]}
      period={
        <>
          <span style={LABEL}>集計期間</span>
          <FiscalMonthTabs current={month} accent={accent} onSelect={setMonth} />
          <span style={{ fontSize: 12.5, color: '#48565f' }}>令和8年 {m}月1日 〜 令和8年 {m}月末日</span>
        </>
      }
      periodAside={stats.map((st) => (
        <div key={st.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', border: '1px solid #e2e8ee', borderRadius: 8, background: st.hi ? '#fff8d6' : '#fbfcfd' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8290a0' }}>{st.label}</span>
          <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{st.value}</span>
        </div>
      ))}
      target={
        <>
          <span style={LABEL}>{isVendor ? '指定業者' : isFund ? '指定科目（費目－区分コード）' : '指定科目'}</span>
          <AssistField
            value={target}
            placeholder={isVendor ? '業者を選択' : '科目を選択'}
            open={assist.isOpen('target')}
            onOpen={() => assist.open('target', isVendor ? 'vendor' : 'account')}
            accent={accent}
            accentRgb={accentRgb}
            buttonStyle={fieldBtn}
            panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 260, zIndex: 60 }}
            groups={assist.groups}
            query={assist.query}
            empty={assist.empty}
            onInput={assist.setQuery}
            onPick={(v) => {
              setTarget(v === '（なし）' ? '' : v);
              assist.close();
            }}
          />
        </>
      }
      switches={
        <>
          {!isVendor && <BizSwitch on={showBiz} onChange={setShowBiz} accent={accent} />}
          {dt.switches}
          {isFund && <SwitchPill label="消費税表示" on={showTax} onChange={setShowTax} accent={accent} title="税区分と税額の列を表示します" />}
        </>
      }
      controls={
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={LABEL}>絞り込み</span>
            <label style={CHECK}><input type="checkbox" checked={opts.check} onChange={() => toggle('check')} />チェック</label>
            <span style={{ ...LABEL, marginLeft: 4 }}>付箋</span>
            {([['red', '赤', '#c0392b'], ['blue', '青', '#2c5f9e'], ['yellow', '黄', '#b7791f'], ['green', '緑', '#1f7a52']] as const).map(([k, l, c]) => (
              <label key={k} style={{ ...CHECK, color: c }}><input type="checkbox" checked={opts[k]} onChange={() => toggle(k)} />{l}</label>
            ))}
            {!isVendor && <label style={CHECK}><input type="checkbox" checked={opts.internal} onChange={() => toggle('internal')} />内部取引のみを表示する</label>}
            <label style={{ ...CHECK, marginLeft: 8 }}><input type="checkbox" checked={opts.daily} onChange={() => toggle('daily')} />残高を日計で表示する</label>
            {!isVendor && <label style={CHECK}><input type="checkbox" checked={opts.spare} onChange={() => toggle('spare')} />入力予備１，２を表示する</label>}
          </div>
          {dt.legend}
        </>
      }
      notice={ra.notice}
    >
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: 70 }}>月日</th>
              <th style={{ ...TH, width: 60 }}>Seq-No</th>
              {dt.nameOn && <th style={{ ...TH, width: 130 }}>区分名</th>}
              <th style={TH}>{isVendor ? '借方 ― 貸方 ／ 摘要' : `相手科目 ／ ${showBiz ? '業者' : '摘要'}`}</th>
              {taxCols && <th style={{ ...TH, width: 130 }}>税区分</th>}
              {taxCols && <th style={{ ...TH, width: 100, textAlign: 'right' }}>税額</th>}
              <th style={{ ...TH, width: 120, textAlign: 'right' }}>{isVendor ? '金額' : '借方'}</th>
              {!isVendor && <th style={{ ...TH, width: 120, textAlign: 'right' }}>貸方</th>}
              <th style={{ ...TH, width: 130, textAlign: 'right' }}>残高</th>
              <th style={ACTION_TH}>{ACTION_HEAD}</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: '#f8fafc' }}>
              <td style={TD} colSpan={leadCols}><span style={{ color: '#7a8794', fontWeight: 700 }}>繰越金額</span></td>
              <td style={NUM} />
              {!isVendor && <td style={NUM} />}
              <td style={{ ...NUM, fontWeight: 700 }}>{money(CARRY)}</td>
              <td style={TD} />
            </tr>
            {!target && <tr><td colSpan={colCount} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 40 }}>{isVendor ? '業者' : '科目'}を指定してください。</td></tr>}
            {target && lines.length === 0 && <tr><td colSpan={colCount} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 40 }}>この月に該当する仕訳はありません。</td></tr>}
            {lines.map((l) => (
              <tr key={l.r.id} data-voucher={l.r.id} onDoubleClick={() => ra.openEdit(l.r)} title={ra.editable ? 'ダブルクリックで伝票を訂正' : undefined} style={{ cursor: ra.editable ? 'pointer' : 'default', background: dt.rowBg(l.r) }}>
                <td style={TD}>{l.r.date}</td>
                <td style={TD}>{dt.chip(l.r)}{l.r.seq}</td>
                {dt.nameOn && <td style={TD}>{dt.nameTag(l.r)}</td>}
                <td style={TD}>
                  <div style={{ fontWeight: 500 }}>{isVendor ? `${l.r.kari} ― ${l.r.kashi}` : l.other}</div>
                  <div style={{ fontSize: 11.5, color: '#7a8794' }}>
                    {!isVendor && showBiz ? (l.r.gyosha || '業者なし') : l.r.tekiyo}{!isVendor && !showBiz && l.r.gyosha ? `　／ ${l.r.gyosha}` : ''}
                    {!isVendor && opts.spare && (l.r.spare1 || l.r.spare2) ? <span style={{ marginLeft: 8, color: '#9aa5b1' }}>予備：{[l.r.spare1, l.r.spare2].filter(Boolean).join('／')}</span> : null}
                  </div>
                </td>
                {taxCols && <td style={TD}><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: l.tax.startsWith('課税') ? '#e8f0fb' : l.tax === '非課税' ? '#eaf5ef' : '#f1f4f6', color: l.tax.startsWith('課税') ? '#2c5f9e' : l.tax === '非課税' ? '#1f7a52' : '#7a8794' }}>{l.tax}</span></td>}
                {taxCols && <td style={{ ...NUM, color: l.taxAmt ? undefined : '#b8c2cc' }}>{l.taxAmt ? money(l.taxAmt) : '—'}</td>}
                <td style={NUM}>{l.debit ? money(l.debit) : ''}</td>
                {!isVendor && <td style={NUM}>{l.credit ? money(l.credit) : ''}</td>}
                <td style={{ ...NUM, fontWeight: 700 }}>{!opts.daily || l.dayEnd ? money(l.bal) : ''}</td>
                <td style={{ ...TD, paddingTop: 5, paddingBottom: 5 }}>{ra.cell(l.r)}</td>
              </tr>
            ))}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f6f8fa' }}>
                <td style={{ ...TD, fontWeight: 700 }} colSpan={leadCols - (taxCols ? 2 : 0)}>月計</td>
                {taxCols && <td style={TD} />}
                {taxCols && <td style={{ ...NUM, fontWeight: 700 }}>{money(sumTax)}</td>}
                <td style={{ ...NUM, fontWeight: 700 }}>{money(sumD)}</td>
                {!isVendor && <td style={{ ...NUM, fontWeight: 700 }}>{money(sumC)}</td>}
                <td style={{ ...NUM, fontWeight: 700 }}>{money(bal)}</td>
                <td style={TD} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {dt.modal}
      {ra.modals}
      <ToastView msg={toast.msg} />
      <ExportDialog spec={exp} onClose={() => setExp(null)} accent={accent} />
    </ReportShell>
  );
}
