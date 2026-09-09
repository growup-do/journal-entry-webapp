// オプション：小口現金出納帳／預金出納帳（共通部品）
//   紙の出納帳風の表（入金額／年月日／摘要／勘定科目／出金額／残高）。最終行が入力行で、Enterで次の項目→登録。
//   小口現金：特殊行の挿入・集計（確認→集計済みロック）・AI自動仕訳インポート
//   預金出納：新規出納帳（預金科目の選択）・銀行CSVインポート・インポート一括削除・預金残高（通帳残高との差額）
//   共通：会計連動・印刷（集計内訳表／仕訳伝票／出納帳）・区分の切替

import { useMemo, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { AssistField } from './AssistField';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { Modal } from './Modal';
import { NOT_IMPL, ToastView, useToast } from './Toast';
import { LABEL, NUM, ReportShell, TD, TH } from './ReportShell';
import { useAssist } from '../hooks/useAssist';
import type { MonthFilter } from '../types';

export type CashbookKind = 'petty' | 'bank';
const OPTION = '#b45309';
const yen = (n: number) => n.toLocaleString('ja-JP');

interface Row {
  id: number;
  month: string;
  day: string;
  tekiyo: string;
  account: string;
  code: string;
  inAmt: number;
  outAmt: number;
  special?: '小計行' | '改ページ' | '締切線' | '摘要行';
  aggregated?: boolean;
  imported?: boolean;
}
const CODE: Record<string, string> = { 手数料: '2340', 修繕費: '2290', '賃借料（事業）': '2520', '普通預金（保育園）': '5013', 福利厚生費: '2210', 消耗器具備品費: '2500', 通信運搬費: '2300', 給食費: '2410', 保育材料費: '2460', '水道光熱費（事業）': '2480', 委託費収益: '6110' };
let seq = 100;
const R = (month: string, day: string, tekiyo: string, account: string, inAmt: number, outAmt: number, extra: Partial<Row> = {}): Row => ({ id: seq++, month, day, tekiyo, account, code: CODE[account] ?? '', inAmt, outAmt, ...extra });

const PETTY_SEED: Row[] = [
  R('8', '1', '振込手数料', '手数料', 0, 660),
  R('8', '19', '金種手数料', '手数料', 0, 440),
  R('8', '24', '自転車修理代', '修繕費', 0, 8140),
  R('8', '25', '清掃代', '賃借料（事業）', 0, 4950),
  R('8', '29', '普通預金より', '普通預金（保育園）', 50000, 0),
  R('8', '29', '検便代', '福利厚生費', 0, 6930),
  R('8', '29', 'インク代', '消耗器具備品費', 0, 4864),
  R('8', '30', 'FAX代', '通信運搬費', 0, 6303),
];
const BANK_SEED: Row[] = [
  R('8', '5', '払い出し－当座へ', '当座預金（保育園）', 0, 500000),
  R('8', '5', '電話料金', '通信運搬費', 0, 8936),
  R('8', '19', '委託費－８月分', '委託費収益', 2732430, 0),
  R('8', '19', '職員俸給', '職員俸給', 0, 1502512),
];
const BANK_ACCOUNTS = ['普通預金（本部）', '普通預金（保育園）', '当座預金（保育園）', '定期預金'];

function onEnter(fn: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    if (e.nativeEvent.isComposing || (e.nativeEvent as unknown as { keyCode: number }).keyCode === 229) return;
    e.preventDefault();
    fn();
  };
}
const focusId = (id: string) => setTimeout(() => document.getElementById(id)?.focus(), 0);

interface Props {
  kind: CashbookKind;
  variant: 'form' | 'sheet';
  accent: string;
  accentRgb: string;
  onNavigate: (label: string) => void;
}

export function CashbookPage({ kind, variant, accent, accentRgb, onNavigate }: Props) {
  const isPetty = kind === 'petty';
  const title = isPetty ? '小口現金出納帳' : '預金出納帳';
  const [book, setBook] = useState(isPetty ? '小口現金' : '普通預金（保育園）');
  const [newBookOpen, setNewBookOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(isPetty ? PETTY_SEED : BANK_SEED);
  const [opening] = useState(isPetty ? 26517 : 9630000);
  const [month, setMonth] = useState<MonthFilter>('8');
  const [entry, setEntry] = useState({ inAmt: '', month: '8', day: '', tekiyo: '', account: '', outAmt: '' });
  const [specialOpen, setSpecialOpen] = useState(false);
  const [specialOpts, setSpecialOpts] = useState({ date: false, balance: false });
  const [aggOpen, setAggOpen] = useState(false);
  const [aggSel, setAggSel] = useState<Set<number>>(new Set());
  const [aggConfirm, setAggConfirm] = useState(false);
  const [aggLink, setAggLink] = useState(false);
  const [bankBalanceOpen, setBankBalanceOpen] = useState(false);
  const [bankBalance, setBankBalance] = useState<number | null>(null);
  const [bankInput, setBankInput] = useState('');
  const [csvOpen, setCsvOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const assist = useAssist();
  const toast = useToast();

  // 残高計算（月フィルタ前の全行で通算）
  const withBal = useMemo(() => {
    let bal = opening;
    return rows.map((r) => {
      if (!r.special) bal += r.inAmt - r.outAmt;
      return { ...r, bal };
    });
  }, [rows, opening]);
  const view = withBal.filter((r) => month == null || r.month === month);
  const lastBal = withBal.length ? withBal[withBal.length - 1].bal : opening;
  const monthIn = view.reduce((a, r) => a + r.inAmt, 0);
  const monthOut = view.reduce((a, r) => a + r.outAmt, 0);

  const add = () => {
    const inAmt = parseInt(entry.inAmt.replace(/[^0-9]/g, ''), 10) || 0;
    const outAmt = parseInt(entry.outAmt.replace(/[^0-9]/g, ''), 10) || 0;
    if (!entry.day) return toast.show('日を入力してください');
    if (!entry.account) return toast.show('勘定科目を選択してください');
    if (!inAmt && !outAmt) return toast.show('入金額または出金額を入力してください');
    setRows((rs) => [...rs, R(entry.month || '8', entry.day, entry.tekiyo, entry.account, inAmt, outAmt)]);
    setEntry({ inAmt: '', month: entry.month, day: '', tekiyo: '', account: '', outAmt: '' });
    focusId('cb-in');
  };
  const insertSpecial = (kind: Row['special']) => {
    setRows((rs) => [...rs, { ...R(entry.month || '8', '', kind === '摘要行' ? '（摘要行）' : '', '', 0, 0), special: kind }]);
    setSpecialOpen(false);
    toast.show(`${kind}を挿入しました`);
  };
  const aggregable = withBal.filter((r) => !r.special && !r.aggregated);
  const aggRange = aggregable.filter((r) => aggSel.has(r.id));
  const aggBal = aggRange.length ? withBal.find((r) => r.id === aggRange[aggRange.length - 1].id)!.bal : lastBal;
  const runAggregate = () => {
    setRows((rs) => rs.map((r) => (aggSel.has(r.id) ? { ...r, aggregated: true } : r)));
    setAggConfirm(false);
    setAggOpen(false);
    toast.show(`${aggSel.size} 件を集計しました${aggLink ? '（会計連動フォルダへ送信）' : ''}`);
    setAggSel(new Set());
  };
  const importCsv = () => {
    const imp: Row[] = [
      R('8', '20', '（CSV）ﾌﾘｺﾐ ｼｸﾞﾏﾘｰｽ', '賃借料（事業）', 0, 18216, { imported: true }),
      R('8', '25', '（CSV）ﾌﾘｺﾐ NTT', '通信運搬費', 0, 8936, { imported: true }),
      R('8', '28', '（CSV）ｲﾀｸﾋ ｼﾔｸｼｮ', '委託費収益', 662400, 0, { imported: true }),
    ];
    setRows((rs) => [...rs, ...imp]);
    setCsvOpen(false);
    toast.show(`CSVから ${imp.length} 件を取り込みました（勘定科目は摘要から自動判定・要確認）`);
  };
  const bulkDelete = () => {
    const n = rows.filter((r) => r.imported).length;
    setRows((rs) => rs.filter((r) => !r.imported));
    setBulkOpen(false);
    toast.show(`インポート伝票 ${n} 件を一括削除しました`);
  };
  const lockedMsg = () => toast.show('集計済みの明細は訂正・削除できません（F10：集計取消 を実行してください）');


  const cell: CSSProperties = { ...TD, padding: '6px 10px', borderRight: '1px solid #eef2f5' };
  const numCell: CSSProperties = { ...NUM, padding: '6px 10px', borderRight: '1px solid #eef2f5' };
  const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '6px 8px', border: '1px solid #cfd8e0', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' };
  const fieldBtn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%', boxSizing: 'border-box', padding: '6px 8px', background: '#fff', border: '1px solid #cfd8e0', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', color: 'inherit' };
  const btn = (primary?: boolean): CSSProperties => ({ padding: '8px 16px', borderRadius: 8, border: primary ? 'none' : '1px solid #cfd8e0', background: primary ? accent : '#fff', color: primary ? '#fff' : '#5b6773', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const badge = <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: OPTION, borderRadius: 5, padding: '2px 6px', verticalAlign: 'middle', marginLeft: 6 }}>オプション</span>;

  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title={title}
      badge={badge}
      org={`チャイルド保育園　${book}`}
      subtitle={isPetty ? '小口現金の入出金を出納帳形式で記帳し、集計して会計へ連動します。' : '預金口座ごとの入出金を出納帳形式で記帳。銀行CSVの取込と通帳残高の照合ができます。'}
      tools={[
        { label: '会計連動', onClick: () => toast.show('会計連動：集計済みの明細を仕訳として送ります（プロトタイプでは動作しません）') },
        { label: '印刷', onClick: () => setPrintOpen(true) },
        { label: isPetty ? '小口区分の切替' : '区分の切替', onClick: () => (isPetty ? toast.show(NOT_IMPL) : setNewBookOpen(true)) },
        ...(isPetty
          ? [{ label: '特殊行', onClick: () => setSpecialOpen(true) }, { label: '集計', onClick: () => setAggOpen(true), primary: true }]
          : [{ label: '預金残高', onClick: () => { setBankInput(bankBalance != null ? String(bankBalance) : ''); setBankBalanceOpen(true); } }, { label: '集計', onClick: () => setAggOpen(true), primary: true }]),
      ]}
      onBack={() => onNavigate('ホーム')}
      controls={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={LABEL}>会計月</span>
          <FiscalMonthTabs current={month} accent={accent} onSelect={setMonth} withAll />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isPetty ? (
              <>
                <button type="button" className="btn-outline" onClick={() => toast.show('AI自動仕訳システムからのインポート：' + NOT_IMPL)} style={btn()}>AI自動仕訳 インポート</button>
                <button type="button" className="btn-outline" onClick={() => toast.show('AI自動仕訳システム 会計確認：' + NOT_IMPL)} style={btn()}>AI自動仕訳 会計確認</button>
              </>
            ) : (
              <>
                <button type="button" className="btn-outline" onClick={() => setCsvOpen(true)} style={btn()}>銀行CSV インポート</button>
                <button type="button" className="btn-outline" onClick={() => setBulkOpen(true)} style={btn()}>インポート一括削除</button>
                <button type="button" className="btn-outline" onClick={() => setNewBookOpen(true)} style={btn()}>新規出納帳</button>
              </>
            )}
          </div>
        </div>
      }
    >
      <ToastView msg={toast.msg} />

      {/* 残高サマリー */}
      <div style={{ display: 'flex', gap: 16, padding: '10px 22px', borderBottom: '1px solid #eef2f5', fontSize: 12.5, color: '#5b6773', flexWrap: 'wrap' }}>
        <span>前月繰越 <b style={{ color: '#22303c', fontVariantNumeric: 'tabular-nums' }}>{yen(opening)}</b></span>
        <span>当月入金 <b style={{ color: '#2c5f9e', fontVariantNumeric: 'tabular-nums' }}>{yen(monthIn)}</b></span>
        <span>当月出金 <b style={{ color: '#b0426a', fontVariantNumeric: 'tabular-nums' }}>{yen(monthOut)}</b></span>
        <span>現在残高 <b style={{ color: '#22303c', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{yen(lastBal)}</b></span>
        {!isPetty && bankBalance != null && (
          <span style={{ marginLeft: 'auto', padding: '2px 10px', borderRadius: 10, background: bankBalance === lastBal ? '#eaf5ef' : '#fdeee9', color: bankBalance === lastBal ? '#1f7a52' : '#c0392b', fontWeight: 700 }}>
            通帳残高 {yen(bankBalance)}　差額 {yen(bankBalance - lastBal)}
          </span>
        )}
        <span style={{ marginLeft: isPetty || bankBalance == null ? 'auto' : 0, color: '#9aa5b1' }}>黄色＝集計済み（訂正不可）／青＝CSV取込</span>
      </div>

      {/* 出納帳 */}
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...TH, textAlign: 'right', width: 120 }}>入金額</th>
              <th style={{ ...TH, width: 150 }}>年月日</th>
              <th style={TH}>摘要</th>
              <th style={{ ...TH, width: 220 }}>勘定科目</th>
              <th style={{ ...TH, textAlign: 'right', width: 120 }}>出金額</th>
              <th style={{ ...TH, textAlign: 'right', width: 130 }}>残高</th>
              <th style={{ ...TH, width: 70 }} />
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: '#f8fafc' }}>
              <td style={cell} /><td style={cell} /><td style={{ ...cell, color: '#7a8794', fontWeight: 700 }}>前月繰越</td><td style={cell} /><td style={cell} /><td style={{ ...numCell, fontWeight: 700 }}>{yen(opening)}</td><td style={TD} />
            </tr>
            {view.map((r) => {
              if (r.special === '締切線') return <tr key={r.id}><td colSpan={7} style={{ padding: 0, borderBottom: '3px double #22303c' }} /></tr>;
              if (r.special === '改ページ') return <tr key={r.id}><td colSpan={7} style={{ padding: '3px 10px', fontSize: 10.5, color: '#9aa5b1', textAlign: 'center', background: 'repeating-linear-gradient(90deg,#e6ecf1 0 6px,transparent 6px 12px) center/100% 1px no-repeat' }}>— 改ページ —</td></tr>;
              if (r.special === '小計行') return <tr key={r.id} style={{ background: '#f3f6f9' }}><td style={numCell}>{yen(monthIn)}</td><td style={cell} /><td style={{ ...cell, fontWeight: 700 }}>小計</td><td style={cell} /><td style={numCell}>{yen(monthOut)}</td><td style={{ ...numCell, fontWeight: 700 }}>{yen(r.bal)}</td><td style={TD} /></tr>;
              const bg = r.aggregated ? '#fff8c4' : r.imported ? '#eaf2fb' : 'transparent';
              return (
                <tr key={r.id} style={{ background: bg }}>
                  <td style={{ ...numCell, color: '#2c5f9e' }}>{r.inAmt ? yen(r.inAmt) : ''}</td>
                  <td style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>{r.special === '摘要行' ? '' : `令和8年 ${r.month}月 ${r.day}日`}</td>
                  <td style={cell}>{r.tekiyo}</td>
                  <td style={cell}>{r.code && <span style={{ color: '#9aa5b1', fontSize: 11, marginRight: 6 }}>{r.code}</span>}{r.account}</td>
                  <td style={{ ...numCell, color: '#b0426a' }}>{r.outAmt ? yen(r.outAmt) : ''}</td>
                  <td style={{ ...numCell, fontWeight: 700 }}>{r.special ? '' : yen(r.bal)}</td>
                  <td style={{ ...TD, padding: '4px 8px', textAlign: 'right' }}>
                    <button type="button" className="btn-outline" onClick={() => (r.aggregated ? lockedMsg() : setRows((rs) => rs.filter((x) => x.id !== r.id)))} title="行の削除" style={{ padding: '3px 8px', border: '1px solid #d3dbe3', borderRadius: 6, background: '#fff', color: r.aggregated ? '#c3ccd4' : '#c0392b', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>削除</button>
                  </td>
                </tr>
              );
            })}
            {/* 入力行 */}
            <tr style={{ background: '#fbfcfd', borderTop: `2px solid ${accent}` }}>
              <td style={{ ...cell, padding: '8px 8px' }}><input id="cb-in" className="field-input ring" value={entry.inAmt} onChange={(e) => setEntry({ ...entry, inAmt: e.target.value.replace(/[^0-9]/g, '') })} onKeyDown={onEnter(() => focusId('cb-day'))} inputMode="numeric" placeholder="入金" style={{ ...inp, textAlign: 'right' }} /></td>
              <td style={{ ...cell, padding: '8px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#5b6773' }}>
                  <span>令和8</span>
                  <input className="field-input" value={entry.month} onChange={(e) => setEntry({ ...entry, month: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })} inputMode="numeric" style={{ ...inp, width: 34, padding: '6px 2px', textAlign: 'center' }} />
                  <input id="cb-day" className="field-input" value={entry.day} onChange={(e) => setEntry({ ...entry, day: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })} onKeyDown={onEnter(() => focusId('cb-tekiyo'))} inputMode="numeric" placeholder="日" style={{ ...inp, width: 34, padding: '6px 2px', textAlign: 'center' }} />
                </div>
              </td>
              <td style={{ ...cell, padding: '8px 8px' }}><input id="cb-tekiyo" className="field-input ring" value={entry.tekiyo} onChange={(e) => setEntry({ ...entry, tekiyo: e.target.value })} onKeyDown={onEnter(() => focusId('cb-acc'))} placeholder="摘要" autoComplete="off" style={inp} /></td>
              <td style={{ ...cell, padding: '8px 8px' }}>
                <AssistField buttonId="cb-acc" value={entry.account} placeholder="勘定科目検索" open={assist.isOpen('acc')} onOpen={() => assist.open('acc', 'account')} accent={accent} accentRgb={accentRgb} buttonStyle={fieldBtn} panelStyle={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, width: 260, zIndex: 60 }} groups={assist.groups} query={assist.query} empty={assist.empty} onInput={assist.setQuery} onPick={(v) => { setEntry((en) => ({ ...en, account: v })); assist.close(); focusId('cb-out'); }} />
              </td>
              <td style={{ ...cell, padding: '8px 8px' }}><input id="cb-out" className="field-input ring" value={entry.outAmt} onChange={(e) => setEntry({ ...entry, outAmt: e.target.value.replace(/[^0-9]/g, '') })} onKeyDown={onEnter(add)} inputMode="numeric" placeholder="出金" style={{ ...inp, textAlign: 'right' }} /></td>
              <td style={{ ...numCell, color: '#9aa5b1', fontSize: 11 }}>自動計算</td>
              <td style={{ ...TD, padding: '8px 8px' }}><button type="button" className="submit-btn" onClick={add} style={{ ...btn(true), padding: '7px 12px', fontSize: 12 }}>登録</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ---- 特殊行の挿入 ---- */}
      <Modal open={specialOpen} onClose={() => setSpecialOpen(false)} width={420} title="特殊行の挿入">
        <div style={{ padding: '18px 22px 20px' }}>
          <div style={{ fontSize: 13.5, marginBottom: 14 }}>カーソル位置へ挿入する特殊行を選択して下さい</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(['小計行', '改ページ', '締切線'] as const).map((k) => <button key={k} type="button" className="btn-outline" onClick={() => insertSpecial(k)} style={btn()}>{k}</button>)}
          </div>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
            <button type="button" className="btn-outline" onClick={() => insertSpecial('摘要行')} style={btn()}>摘要行</button>
            <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={specialOpts.date} onChange={() => setSpecialOpts({ ...specialOpts, date: !specialOpts.date })} />年月日欄を表示</label>
            <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={specialOpts.balance} onChange={() => setSpecialOpts({ ...specialOpts, balance: !specialOpts.balance })} />残高欄を表示</label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><button type="button" onClick={() => setSpecialOpen(false)} style={btn()}>キャンセル</button></div>
        </div>
      </Modal>

      {/* ---- 集計：明細選択 ---- */}
      <Modal open={aggOpen && !aggConfirm} onClose={() => setAggOpen(false)} width={860} title="集計">
        <div style={{ padding: '14px 22px 18px' }}>
          <div style={{ fontSize: 13.5, marginBottom: 10 }}>集計する明細を選択してください。<span style={{ fontSize: 12, color: '#7a8794', marginLeft: 8 }}>（選択 {aggSel.size} 件）</span></div>
          <div style={{ maxHeight: 380, overflow: 'auto', border: '1px solid #e2e8ee', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ ...TH, width: 36 }} /><th style={{ ...TH, textAlign: 'right' }}>入金額</th><th style={TH}>年月日</th><th style={TH}>摘要</th><th style={TH}>勘定科目</th><th style={{ ...TH, textAlign: 'right' }}>出金額</th><th style={{ ...TH, textAlign: 'right' }}>残高</th></tr></thead>
              <tbody>
                {aggregable.length === 0 && <tr><td colSpan={7} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 30 }}>集計できる明細がありません。</td></tr>}
                {aggregable.map((r) => {
                  const on = aggSel.has(r.id);
                  return (
                    <tr key={r.id} onClick={() => setAggSel((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} style={{ background: on ? '#fff8c4' : 'transparent', cursor: 'pointer' }}>
                      <td style={TD}><input type="checkbox" checked={on} readOnly /></td>
                      <td style={NUM}>{r.inAmt ? yen(r.inAmt) : ''}</td><td style={TD}>{r.month}/{r.day}</td><td style={TD}>{r.tekiyo}</td><td style={TD}>{r.account}</td><td style={NUM}>{r.outAmt ? yen(r.outAmt) : ''}</td><td style={{ ...NUM, fontWeight: 700 }}>{yen(r.bal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14 }}>
            <button type="button" className="btn-outline" onClick={() => setAggSel(new Set(aggregable.map((r) => r.id)))} style={btn()}>すべて選択</button>
            <button type="button" className="submit-btn" disabled={aggSel.size === 0} onClick={() => setAggConfirm(true)} style={{ ...btn(true), opacity: aggSel.size ? 1 : 0.5 }}>OK</button>
            <button type="button" onClick={() => setAggOpen(false)} style={btn()}>キャンセル</button>
          </div>
        </div>
      </Modal>

      {/* ---- 集計：確認 ---- */}
      <Modal open={aggConfirm} onClose={() => setAggConfirm(false)} width={620} title="集計 ― 確認">
        <div style={{ padding: '18px 22px 20px', fontSize: 13.5, lineHeight: 1.7 }}>
          <div>選択された明細は…</div>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: '10px 14px', margin: '8px 0 12px', background: '#fbfcfd' }}>
            {aggRange.length > 0 && (
              <>
                <div>令和8年 {aggRange[0].month}月{aggRange[0].day}日　{aggRange[0].account}　{yen(aggRange[0].inAmt || aggRange[0].outAmt)}円 〜</div>
                <div style={{ textAlign: 'right' }}>令和8年 {aggRange[aggRange.length - 1].month}月{aggRange[aggRange.length - 1].day}日　{aggRange[aggRange.length - 1].account}　{yen(aggRange[aggRange.length - 1].inAmt || aggRange[aggRange.length - 1].outAmt)}円 迄</div>
              </>
            )}
          </div>
          <div style={{ fontWeight: 700 }}>この時点での残高は　<span style={{ fontSize: 16 }}>{yen(aggBal)}円</span>になります。</div>
          <div style={{ marginTop: 8 }}>集計を開始してもよろしいですか？</div>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, fontSize: 13 }}><input type="checkbox" checked={aggLink} onChange={() => setAggLink(!aggLink)} />集計したら会計連動フォルダへこの伝票情報を送る</label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" className="submit-btn" onClick={runAggregate} style={btn(true)}>OK</button>
            <button type="button" onClick={() => setAggConfirm(false)} style={btn()}>キャンセル</button>
          </div>
          <div style={{ marginTop: 16, padding: '10px 14px', background: '#f3f6f9', borderRadius: 10, fontSize: 12, color: '#48565f' }}>
            集計された明細に対しては以下の操作が出来なくなります。<br />①日付・金額・科目・摘要など、明細内容の訂正　②前期繰越の金額訂正　③行の挿入　④行の削除<br />※一度集計した明細に対して修正を行う場合は『F10：集計取消』を実行してから行ってください。
          </div>
        </div>
      </Modal>

      {/* ---- 印刷メニュー ---- */}
      <Modal open={printOpen} onClose={() => setPrintOpen(false)} width={360} title="印刷および印刷プレビュー">
        <div style={{ padding: '10px 12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {['集計内訳表', '仕訳伝票', isPetty ? '小口現金出納帳' : '預金出納帳'].map((l) => (
            <button key={l} type="button" className="menu-sub" onClick={() => { setPrintOpen(false); toast.show(`${l} の印刷：${NOT_IMPL}`); }} style={{ textAlign: 'left', padding: '10px 12px', border: 'none', background: 'transparent', borderRadius: 7, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
      </Modal>

      {/* ---- 預金出納：新規出納帳 ---- */}
      <Modal open={newBookOpen} onClose={() => setNewBookOpen(false)} width={420} title="新規出納帳">
        <div style={{ padding: '14px 22px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8290a0', marginBottom: 8 }}>勘定科目（預金）</div>
          {BANK_ACCOUNTS.map((a) => (
            <label key={a} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 4px', fontSize: 13.5, cursor: 'pointer' }}><input type="radio" name="book" checked={book === a} onChange={() => setBook(a)} />{a}</label>
          ))}
          <div style={{ fontSize: 11.5, color: '#7a8794', marginTop: 10, lineHeight: 1.6 }}>※ 使用しないとして設定されている科目は選択できません。ご使用になられる場合は、使用科目へ設定を変更してください。</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" className="submit-btn" onClick={() => { setNewBookOpen(false); toast.show(`${book} の出納帳を開きました`); }} style={btn(true)}>OK</button>
            <button type="button" onClick={() => setNewBookOpen(false)} style={btn()}>キャンセル</button>
          </div>
        </div>
      </Modal>

      {/* ---- 預金出納：預金残高 ---- */}
      <Modal open={bankBalanceOpen} onClose={() => setBankBalanceOpen(false)} width={420} title="預金残高">
        <div style={{ padding: '18px 22px 20px' }}>
          <div style={{ fontSize: 13.5, marginBottom: 12 }}>通帳の預金残高を入力して下さい</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13 }}>残高</span>
            <input className="field-input ring" value={bankInput} onChange={(e) => setBankInput(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" autoFocus onKeyDown={onEnter(() => { setBankBalance(parseInt(bankInput, 10) || 0); setBankBalanceOpen(false); })} style={{ ...inp, flex: 1, textAlign: 'right', fontSize: 15, fontWeight: 700 }} />
            <span style={{ fontSize: 13 }}>円</span>
            <button type="button" className="submit-btn" onClick={() => { setBankBalance(parseInt(bankInput, 10) || 0); setBankBalanceOpen(false); }} style={btn(true)}>決定</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}><button type="button" onClick={() => setBankBalanceOpen(false)} style={btn()}>キャンセル</button></div>
        </div>
      </Modal>

      {/* ---- 預金出納：銀行CSV取込 ---- */}
      <Modal open={csvOpen} onClose={() => setCsvOpen(false)} width={560} title="CSVファイルの取り込み">
        <div style={{ padding: '14px 22px 20px' }}>
          <div style={{ fontSize: 12.5, color: '#5b6773', marginBottom: 10 }}>システム年度：令和8年（2026年）　対象口座：{book}</div>
          <div onClick={importCsv} style={{ border: '3px dashed #e0b400', background: '#fff9c4', borderRadius: 12, padding: '46px 20px', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#22303c' }}>CSVファイルをドロップしてください。</div>
            <div style={{ fontSize: 12, color: '#7a8794', marginTop: 6 }}>（プロトタイプ：クリックするとサンプル3件を取り込みます）</div>
            <button type="button" className="btn-outline" onClick={(e) => { e.stopPropagation(); importCsv(); }} style={{ ...btn(), marginTop: 18 }}>CSVファイルを指定する</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}><button type="button" onClick={() => setCsvOpen(false)} style={btn()}>キャンセル</button></div>
        </div>
      </Modal>

      {/* ---- 預金出納：インポート一括削除 ---- */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} width={560} title="インポート伝票一括削除">
        <div style={{ padding: '14px 22px 20px' }}>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, minHeight: 160, maxHeight: 260, overflow: 'auto' }}>
            <div style={{ padding: '8px 12px', background: '#f6f8fa', fontSize: 11, fontWeight: 700, color: '#8290a0', borderBottom: '1px solid #eef2f5' }}>コメント（取込単位）</div>
            {rows.some((r) => r.imported) ? (
              <div onDoubleClick={(e) => { if (e.shiftKey) bulkDelete(); else toast.show('[Shift] キーを押しながらダブルクリックしてください'); }} title="Shift + ダブルクリックで一括削除" style={{ padding: '10px 12px', fontSize: 13, cursor: 'pointer' }}>
                銀行CSV取込　{rows.filter((r) => r.imported).length} 件　（{book}）
              </div>
            ) : (
              <div style={{ padding: '30px 12px', textAlign: 'center', color: '#9aa5b1', fontSize: 12.5 }}>インポートされた伝票はありません。</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 12, fontSize: 12.5, color: '#48565f', lineHeight: 1.7 }}>
            <span style={{ flex: 'none', width: 28, height: 28, borderRadius: '50%', background: '#e8f0fb', color: '#2c5f9e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>i</span>
            <span>一括削除は大変危険な操作です。この為削除をするには、[Shift]キーを押しながら、コメント行をダブルクリックすると一括削除を継続する様になっております。</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}><button type="button" onClick={() => setBulkOpen(false)} style={btn()}>閉じる</button></div>
        </div>
      </Modal>
    </ReportShell>
  );
}
