// Screen 1: フォーム型（`仕訳伝票_フォーム型.dc.html`）
// アプリバー + 横スクロールナビ + 中央フォームカード + 右端固定・折りたたみ仕訳帳。
// アクセント = 緑 #1f7a52。

import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AssistField } from './AssistField';
import { AssistPanel } from './AssistPanel';
import { DivisionPicker } from './DivisionPicker';
import { FiscalYearBanner } from './FiscalYearPage';
import { AllocationRunModal, AttachedStatementModal, BudgetGraphModal, BudgetHintLive, EntryConfirmModal, InputSettingsModal, SpecialAmountModal, TemplatePickerModal, TorihikiBadge, watchedStatement } from './EntryExtras';
import { ToastView, useToast } from './Toast';
import { fundAccountOf, judgeTorihiki, type Torihiki7 } from '../lib/accounts';
import { setSession, useSession, type JournalTemplate } from '../store/session';
import { HeaderTools, type JournalYear } from './HeaderTools';
import { PrevYearJournal } from './PrevYearJournal';
import { UserMenu } from './UserMenu';
import { SettingsMenu } from './SettingsMenu';
import { VersionBadge } from './VersionBadge';
import { Menu } from './Menu';
import { MonthChips } from './MonthChips';
import { renderPage } from './pages';
import { Footer } from './Footer';
import { makeFormSeed } from '../data';
import { applyMonth } from '../lib/format';
import { useEntryForm } from '../hooks/useEntryForm';
import type { FormState } from '../types';

const GREEN = '#1f7a52';
const GREEN_RGB = '31,122,82';
const BLUE = '#2c5f9e';
const BLUE_RGB = '44,95,158';
const PINK = '#b0426a';
const PINK_RGB = '176,66,106';

const JOURNAL_W = 392;

const initialForm: FormState = {
  service: '001 本部',
  month: '8',
  day: '1',
  torihiki: '資金',
  kariKamoku: '',
  kashiKamoku: '',
  tekiyo: '',
  gyosha: '',
  amount: '',
};

const fieldBtnBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  width: '100%',
  boxSizing: 'border-box',
  background: '#fff',
  border: '1px solid #cfd8e0',
  fontFamily: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  color: 'inherit',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: '#8290a0',
  marginBottom: 7,
  letterSpacing: '.03em',
};

const dateInput: CSSProperties = {
  width: 44,
  padding: '8px 4px',
  textAlign: 'center',
  border: '1px solid #cfd8e0',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  color: '#22303c',
};

interface Props {
  /** 表示中のメニュー項目（例 '伝票入力'） */
  page: string;
  onNavigate: (label: string) => void;
  year: JournalYear;
  onYear: (y: JournalYear) => void;
  onLogout: () => void;
}

export function FormScreen({ page, onNavigate, year, onYear, onLogout }: Props) {
  const v = useEntryForm({ initialForm, seed: makeFormSeed() });
  const [collapsed, setCollapsed] = useState(false);
  const sess = useSession();
  const toast = useToast();
  // 提案D／E／L：入力設定・取引区分・確認ダイアログ・予算グラフ・定型／按分／特殊金額・明細表登録
  const [inputOpen, setInputOpen] = useState(false);
  const [force, setForce] = useState(false);
  const [shohyo, setShohyo] = useState(true);
  const [cheque, setCheque] = useState('');
  const [spare, setSpare] = useState(['', '']);
  const [manualNo, setManualNo] = useState('');
  const [confirm, setConfirm] = useState<{ kind: Torihiki7; reason?: '費用間' | '収益間' | '誤伝票' } | null>(null);
  const [graphAcct, setGraphAcct] = useState<string | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  const [tplQueue, setTplQueue] = useState<JournalTemplate['lines']>([]);
  const [allocOpen, setAllocOpen] = useState(false);
  const [special, setSpecial] = useState<number | null>(null);
  const [stmt, setStmt] = useState<{ label: string; entry: { kari: string; kashi: string; tekiyo: string; amount: number } } | null>(null);
  const inp = sess.input;
  const loadLine = (l: JournalTemplate['lines'][number]) => v.setFields({ kariKamoku: l.kari, kashiKamoku: l.kashi, tekiyo: l.tekiyo, gyosha: l.gyosha ?? '', amount: l.amount });
  const finalize = () => {
    const entry = { kari: v.form.kariKamoku, kashi: v.form.kashiKamoku, tekiyo: v.form.tekiyo, amount: parseInt(v.form.amount, 10) || 0 };
    const w = watchedStatement(entry.kari, entry.kashi);
    v.submit({ shohyo: inp.shohyo ? shohyo : undefined, cheque: cheque.trim() || undefined });
    setCheque(''); setSpare(['', '']); setForce(false);
    if (w) setStmt({ label: w.label, entry });
    if (tplQueue.length) { const [next, ...rest] = tplQueue; loadLine(next); setTplQueue(rest); toast.show(`定型仕訳の次の行（残り ${rest.length + 1} 行）を入力欄に呼び出しました`); }
  };
  const doSubmit = () => {
    if (!v.form.kariKamoku || !v.form.kashiKamoku || !v.form.amount) { v.submit(); return; }
    const j = judgeTorihiki(v.form.kariKamoku, v.form.kashiKamoku, force);
    if (j.kind === '要確認') {
      const need = j.reason === '誤伝票' ? sess.env.confirmGeneral || true : j.reason === '費用間' ? sess.env.confirmExpense : sess.env.confirmIncome;
      if (need) { setConfirm(j); return; }
    }
    finalize();
  };
  const [topOffset, setTopOffset] = useState(102);
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // アプリバー＋ナビの合計高さを実測（ナビ折返しに追従）
  useLayoutEffect(() => {
    const measure = () => {
      const h = headerRef.current?.offsetHeight ?? 0;
      const n = navRef.current?.offsetHeight ?? 0;
      const o = h + n;
      if (o) setTopOffset((prev) => (o !== prev ? o : prev));
    };
    measure();
    const t1 = setTimeout(measure, 60);
    const t2 = setTimeout(measure, 300);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', measure);
    };
  }, []);

  const rows = applyMonth(v.journal, v.monthFilter);
  const f = v.form;
  const hidden = collapsed;

  const submitStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: GREEN,
    color: '#fff',
    border: 'none',
    borderRadius: 11,
    padding: '13px 24px',
    fontWeight: 700,
    fontSize: 15,
    fontFamily: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: '0 3px 12px rgba(31,122,82,.24)',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* アプリバー */}
      <header
        ref={headerRef}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: '#fff',
          borderBottom: '1px solid #dde4ea',
          height: 58,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 26px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 'none' }}>
            <button type="button" data-menu="ホーム（ロゴ）" onClick={() => onNavigate('ホーム')} title="ホームへ" style={{ display: 'flex', alignItems: 'center', gap: 9, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: 'inherit' }}>
              <span style={logoStyle(GREEN, 28, 15)}>会</span>
              <span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 15.5, whiteSpace: 'nowrap' }}>
                会計基準システム
              </span>
            </button>
            <VersionBadge accent={GREEN} />
          </div>
          <span style={{ color: '#c3ccd4' }}>｜</span>
          <DivisionPicker accent={GREEN} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5, color: '#68757f', flex: 'none', marginLeft: 12 }}>
          <HeaderTools accent={GREEN} page={page} onNavigate={onNavigate} year={year} onYear={onYear} />
          <SettingsMenu accent={GREEN} active={page} onNavigate={onNavigate} />
          <UserMenu accent={GREEN} soft="#eef4f0" onNavigate={onNavigate} />
        </div>
      </header>
      <FiscalYearBanner />

      {/* ナビ（横スクロール） */}
      <nav
        ref={navRef}
        style={{
          background: '#fff',
          borderBottom: '1px solid #eef2f5',
          padding: '3px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          overflow: 'visible',
          alignItems: 'stretch',
          position: 'relative',
          zIndex: 99,
        }}
      >
        <Menu orientation="h" accent={GREEN} active={page} onSelect={onNavigate} />
      </nav>

      {page !== '伝票入力' ? (
        renderPage(page, 'form', GREEN, GREEN_RGB, onNavigate, year, onLogout)
      ) : (
        <>
      {/* メイン（フォームカード） */}
      <main
        style={{
          flex: 1,
          padding: 28,
          paddingRight: hidden ? 28 : JOURNAL_W + 28,
          display: 'flex',
          gap: 24,
          alignItems: 'flex-start',
          justifyContent: 'center',
          overflowX: 'auto',
          transition: 'padding-right .28s ease',
        }}
      >
        <div
          style={{
            flex: 'none',
            width: 720,
            background: '#fff',
            border: '1px solid #dde4ea',
            borderRadius: 16,
            boxShadow: '0 6px 26px rgba(30,50,70,.07)',
            padding: '26px 28px 22px',
          }}
        >
          {/* 見出し行 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '2px solid #28323c',
              paddingBottom: 15,
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'Zen Kaku Gothic New', sans-serif",
                  fontWeight: 700,
                  fontSize: 25,
                  letterSpacing: '.03em',
                }}
              >
                仕訳伝票
              </div>
              <div style={{ color: '#5b6773', fontSize: 13, marginTop: 4 }}>{sess.division}　{sess.fiscalYear}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {[['連続定型（F9）', () => setTplOpen(true)], ['自動按分（F7）', () => setAllocOpen(true)], ['入力の変更', () => setInputOpen(true)]].map(([l, fn]) => (
                  <button key={l as string} type="button" className="btn-outline" onClick={fn as () => void} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #cfd8e0', background: '#fff', color: '#5b6773', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{l as string}</button>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#8895a3', marginBottom: 7 }}>取引区分（科目から自動判定）</div>
              <TorihikiBadge kari={f.kariKamoku} kashi={f.kashiKamoku} force={force} onForce={setForce} />
            </div>
          </div>

          {/* メタ行 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr .95fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>サービス区分</label>
              <AssistField
                value={f.service}
                placeholder="選択"
                open={v.isActive('service')}
                onOpen={() => v.openAssist('service', 'service')}
                accent={GREEN}
                accentRgb={GREEN_RGB}
                buttonStyle={{ ...fieldBtnBase, padding: '9px 12px', borderRadius: 9, fontSize: 14 }}
                panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', minWidth: 230, zIndex: 60 }}
                groups={v.assistGroups}
                query={v.assist.query}
                empty={v.assistEmpty}
                onInput={v.onQueryInput}
                onPick={v.pick}
              />
            </div>
            <div>
              <label style={labelStyle}>伝票日付</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, fontSize: 14, color: '#5b6773' }}>
                <span>令和8年</span>
                <input
                  className="field-input"
                  value={f.month}
                  onChange={(e) => v.setField('month', e.target.value)}
                  inputMode="numeric"
                  style={dateInput}
                />
                <span>月</span>
                <input
                  className="field-input"
                  value={f.day}
                  onChange={(e) => v.setField('day', e.target.value)}
                  inputMode="numeric"
                  style={dateInput}
                />
                <span>日</span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>伝票No</label>
              {inp.voucherNo === '手入力' ? (
                <input className="field-input ring" value={manualNo} onChange={(e) => setManualNo(e.target.value)} placeholder="例 0801-001" style={{ height: 38, boxSizing: 'border-box', width: '100%', padding: '0 12px', border: '1px solid #cfd8e0', borderRadius: 9, fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', height: 38, padding: '0 12px', background: '#f5f7f9', border: '1px solid #e2e8ee', borderRadius: 9, fontSize: 13.5, color: '#9aa5b1' }}>
                  自動採番（{f.month || '8'}{(f.day || '1').padStart(2, '0')}-{String(v.journal.length + 1).padStart(3, '0')}）
                </div>
              )}
            </div>
          </div>

          {/* 借方 / 貸方 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
            <div style={{ border: '1px solid #cfe0f2', borderRadius: 12 }}>
              <div style={boxHeader('#eaf2fb', BLUE)}>
                借方
                <span style={{ fontSize: 10, fontWeight: 600, color: '#87a6cc' }}>BS / PL</span>
              </div>
              <div style={{ padding: 14 }}>
                <AssistField
                  value={f.kariKamoku}
                  placeholder="科目を選択"
                  open={v.isActive('kariKamoku')}
                  onOpen={() => v.openAssist('kariKamoku', 'account')}
                  accent={BLUE}
                  accentRgb={BLUE_RGB}
                  buttonStyle={{ ...fieldBtnBase, padding: '11px 12px', borderRadius: 9, fontSize: 14.5 }}
                  panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', minWidth: 270, zIndex: 60 }}
                  groups={v.assistGroups}
                  query={v.assist.query}
                  empty={v.assistEmpty}
                  onInput={v.onQueryInput}
                  onPick={v.pick}
                />
                <BudgetHintLive account={f.kariKamoku} threshold={sess.env.budgetCheck ? sess.env.budgetThreshold : 101} onOpen={() => setGraphAcct(f.kariKamoku)} />
              </div>
            </div>
            <div style={{ border: '1px solid #f2d0dc', borderRadius: 12 }}>
              <div style={boxHeader('#fdeef3', PINK)}>
                貸方
                <span style={{ fontSize: 10, fontWeight: 600, color: '#d18aa5' }}>BS / PL</span>
              </div>
              <div style={{ padding: 14 }}>
                <AssistField
                  value={f.kashiKamoku}
                  placeholder="科目を選択"
                  open={v.isActive('kashiKamoku')}
                  onOpen={() => v.openAssist('kashiKamoku', 'account')}
                  accent={PINK}
                  accentRgb={PINK_RGB}
                  buttonStyle={{ ...fieldBtnBase, padding: '11px 12px', borderRadius: 9, fontSize: 14.5 }}
                  panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', minWidth: 270, zIndex: 60 }}
                  groups={v.assistGroups}
                  query={v.assist.query}
                  empty={v.assistEmpty}
                  onInput={v.onQueryInput}
                  onPick={v.pick}
                />
                <BudgetHintLive account={f.kashiKamoku} threshold={sess.env.budgetCheck ? sess.env.budgetThreshold : 101} onOpen={() => setGraphAcct(f.kashiKamoku)} />
              </div>
            </div>
          </div>
          {/* 資金科目の自動表示（既存 5.2.2） */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '-8px 0 16px', fontSize: 12, color: '#7a8794' }}>
            <span style={{ fontWeight: 700, color: '#8290a0' }}>資金科目</span>
            {fundAccountOf(f.kariKamoku, f.kashiKamoku) ? <span style={{ padding: '3px 10px', borderRadius: 8, background: '#e0f4f7', color: '#0e6b7a', fontWeight: 700 }}>{fundAccountOf(f.kariKamoku, f.kashiKamoku)}</span> : <span style={{ color: '#b3bcc5' }}>支払資金の増減がない仕訳、または科目未選択（資金収支計算書には出力しません）</span>}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9aa5b1' }}>科目はコード（例 5210）やカナ（例 ほいく）でも検索できます</span>
          </div>

          {/* 摘要・業者・金額 */}
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 12, marginBottom: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 216px' }}>
              <div
                style={{
                  padding: '15px 16px',
                  borderRight: '1px solid #eef2f5',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 13,
                  borderRadius: '11px 0 0 11px',
                }}
              >
                <div>
                  <label style={labelStyle}>摘要</label>
                  <div style={{ position: 'relative', display: 'flex', gap: 6 }} data-assist>
                    <input
                      className="field-input ring"
                      value={f.tekiyo}
                      onChange={(e) => v.setField('tekiyo', e.target.value)}
                      placeholder="摘要を入力"
                      autoComplete="off"
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        border: '1px solid #cfd8e0',
                        borderRadius: 9,
                        fontSize: 14,
                        fontFamily: 'inherit',
                        outline: 'none',
                        color: '#22303c',
                        minWidth: 0,
                      }}
                    />
                    <button
                      type="button"
                      className="tekiyo-toggle"
                      onClick={() => v.openAssist('tekiyo', 'summary')}
                      style={{
                        flex: 'none',
                        width: 40,
                        border: '1px solid #cfd8e0',
                        borderRadius: 9,
                        background: '#f4f7f9',
                        cursor: 'pointer',
                        color: '#7a8794',
                        fontSize: 9,
                      }}
                    >
                      ▼
                    </button>
                    {v.isActive('tekiyo') && (
                      <AssistPanel
                        groups={v.assistGroups}
                        query={v.assist.query}
                        empty={v.assistEmpty}
                        onInput={v.onQueryInput}
                        onPick={v.pick}
                        style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 250, zIndex: 60 }}
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>業者</label>
                  <AssistField
                    value={f.gyosha}
                    placeholder="業者を選択"
                    open={v.isActive('gyosha')}
                    onOpen={() => v.openAssist('gyosha', 'vendor')}
                    accent={GREEN}
                    accentRgb={GREEN_RGB}
                    buttonStyle={{ ...fieldBtnBase, padding: '10px 12px', borderRadius: 9, fontSize: 14 }}
                    panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', minWidth: 210, zIndex: 60 }}
                    groups={v.assistGroups}
                    query={v.assist.query}
                    empty={v.assistEmpty}
                    onInput={v.onQueryInput}
                    onPick={v.pick}
                  />
                </div>
              </div>
              <div
                style={{
                  padding: '15px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: 9,
                  background: '#fbfcfd',
                  borderRadius: '0 11px 11px 0',
                }}
              >
                <label style={{ ...labelStyle, marginBottom: 0 }}>金額</label>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 17, color: '#8290a0' }}>¥</span>
                  <input
                    className="field-input"
                    value={v.amountFmt}
                    onChange={(e) => { const raw = e.target.value; if (/^[+＋]/.test(raw)) { const n = parseInt(raw.replace(/[^0-9]/g, ''), 10) || 0; if (n > 0) setSpecial(n); return; } v.setField('amount', raw); }}
                    title="先頭に「＋」を付けて入力すると特殊金額入力（区分別の按分）が開きます"
                    inputMode="numeric"
                    placeholder="0"
                    style={{
                      width: '100%',
                      minWidth: 0,
                      textAlign: 'right',
                      fontSize: 23,
                      fontWeight: 700,
                      padding: '5px 2px',
                      border: 'none',
                      borderBottom: '2px solid #cfd8e0',
                      outline: 'none',
                      fontFamily: 'inherit',
                      background: 'transparent',
                      color: '#22303c',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {(inp.shohyo || inp.cheque || inp.spare1 || inp.spare2) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: -10, marginBottom: 18, fontSize: 12, color: '#5b6773', flexWrap: 'wrap' }}>
              {inp.shohyo && <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>証憑 <button type="button" className="chip" onClick={() => setShohyo((x) => !x)} style={{ padding: '3px 10px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: shohyo ? '#eaf5ef' : '#fff', color: shohyo ? '#1f7a52' : '#9aa5b1', border: '1px solid ' + (shohyo ? '#bfe0cf' : '#cfd8e0') }}>{shohyo ? '有' : '無'}</button></label>}
              {inp.cheque && <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>小切手No <input className="field-input" value={cheque} onChange={(e) => setCheque(e.target.value)} placeholder="任意" style={{ width: 110, padding: '4px 8px', border: '1px solid #cfd8e0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} /></label>}
              {inp.spare1 && <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>予備1 <input className="field-input" value={spare[0]} onChange={(e) => setSpare([e.target.value, spare[1]])} style={{ width: 120, padding: '4px 8px', border: '1px solid #cfd8e0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} /></label>}
              {inp.spare2 && <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>予備2 <input className="field-input" value={spare[1]} onChange={(e) => setSpare([spare[0], e.target.value])} style={{ width: 120, padding: '4px 8px', border: '1px solid #cfd8e0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} /></label>}
              {inp.tekiyoCode && <span style={{ color: '#9aa5b1' }}>摘要コード：辞書から検索可</span>}
            </div>
          )}

          {/* フッター */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div style={{ minHeight: 22 }}>
              {v.err && <span style={{ color: '#c0392b', fontSize: 12.5, fontWeight: 500 }}>{v.err}</span>}
            </div>
            <button type="button" className="submit-btn" onClick={doSubmit} style={submitStyle}>
              処理終了　→　仕訳帳へ登録
            </button>
          </div>
        </div>
      </main>
      <ToastView msg={toast.msg} />
      <InputSettingsModal open={inputOpen} onClose={() => setInputOpen(false)} accent={GREEN} />
      <EntryConfirmModal open={!!confirm} kind={confirm?.kind ?? '要確認'} reason={confirm?.reason} onClose={() => setConfirm(null)} onProceed={(dont) => { if (dont && confirm) setSession({ env: { ...sess.env, ...(confirm.reason === '費用間' ? { confirmExpense: false } : confirm.reason === '収益間' ? { confirmIncome: false } : { confirmGeneral: false }) } }); setConfirm(null); finalize(); }} accent={GREEN} />
      <BudgetGraphModal open={!!graphAcct} onClose={() => setGraphAcct(null)} account={graphAcct ?? ''} />
      <TemplatePickerModal open={tplOpen} onClose={() => setTplOpen(false)} accent={GREEN} onPick={(t) => { const [first, ...rest] = t.lines; if (first) loadLine(first); setTplQueue(rest); setTplOpen(false); toast.show(`定型仕訳「${t.name}」を呼び出しました${rest.length ? `（残り ${rest.length} 行は登録後に順に呼び出します）` : ''}`); }} />
      <AllocationRunModal open={allocOpen} onClose={() => setAllocOpen(false)} accent={GREEN} onRegister={(rows, date) => { v.addEntries(rows.map((r) => ({ date, kari: r.kari, kashi: r.kashi, tekiyo: `${r.tekiyo}（${r.division.split(' ')[1] ?? r.division}）`, amount: r.amount }))); toast.show(`自動按分：${rows.length} 枚の伝票を登録しました`); }} />
      <SpecialAmountModal key={special ?? 0} open={special != null} total={special ?? 0} onClose={() => setSpecial(null)} accent={GREEN} onOk={(parts) => { if (!f.kariKamoku || !f.kashiKamoku) { toast.show('先に借方・貸方の科目を選んでください'); setSpecial(null); return; } v.addEntries(parts.filter((p) => p.amount > 0).map((p) => ({ date: (f.month || '8') + '/' + (f.day || '1'), kari: f.kariKamoku, kashi: f.kashiKamoku, tekiyo: `${f.tekiyo || '特殊金額入力'}（${p.division.split(' ')[1] ?? p.division}）`, amount: p.amount, gyosha: f.gyosha || undefined }))); v.setFields({ kariKamoku: '', kashiKamoku: '', tekiyo: '', gyosha: '', amount: '' }); setSpecial(null); toast.show(`特殊金額入力：${parts.filter((p) => p.amount > 0).length} 枚の伝票を登録しました`); }} />
      <AttachedStatementModal open={!!stmt} statement={stmt?.label ?? ''} entry={stmt?.entry ?? null} onClose={() => setStmt(null)} onDone={(reg) => { toast.show(reg ? `${stmt?.label}に登録しました` : '明細書には登録しませんでした'); setStmt(null); }} accent={GREEN} />

      {/* 折りたたみトグル */}
      <button
        type="button"
        className="collapse-toggle"
        onClick={() => setCollapsed((c) => !c)}
        title="仕訳帳の表示切替"
        style={{
          position: 'fixed',
          top: topOffset + 10,
          right: collapsed ? 12 : JOURNAL_W + 12,
          zIndex: 95,
          width: 30,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fff',
          border: '1px solid #dde4ea',
          borderRadius: 9,
          boxShadow: '0 3px 12px rgba(30,50,70,.14)',
          cursor: 'pointer',
          color: '#5b6773',
          fontSize: 12,
        }}
      >
        {collapsed ? '◀' : '▶'}
      </button>

      {/* 仕訳帳（右端固定） */}
      <aside
        style={{
          position: 'fixed',
          top: topOffset,
          right: 0,
          bottom: 0,
          width: JOURNAL_W,
          background: '#fff',
          borderLeft: '1px solid #dde4ea',
          boxShadow: '-8px 0 28px rgba(30,50,70,.07)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 90,
          transition: 'transform .28s ease',
          transform: hidden ? `translateX(${JOURNAL_W}px)` : 'translateX(0)',
        }}
      >
        {year === 'prev' ? (
          <PrevYearJournal accent={GREEN} compact />
        ) : (
        <>
        <div style={{ padding: '15px 18px 13px', borderBottom: '1px solid #eef2f5', flex: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 11 }}>
            <span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16.5 }}>
              仕訳帳
            </span>
            <span style={{ fontSize: 12, color: '#8895a3' }}>{rows.length} 件</span>
          </div>
          <MonthChips months={v.months} current={v.monthFilter} accent={GREEN} onSelect={v.setMonth} />
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '46px minmax(0,1fr) minmax(0,1fr) 82px',
            gap: 8,
            padding: '9px 14px',
            background: '#f6f8fa',
            fontSize: 10.5,
            fontWeight: 700,
            color: '#8290a0',
            borderBottom: '1px solid #eef2f5',
          }}
        >
          <div>月日</div>
          <div>借方科目</div>
          <div>貸方科目</div>
          <div style={{ textAlign: 'right' }}>金額</div>
        </div>
        <div id="journal-scroll" style={{ overflowY: 'auto', flex: 1 }}>
          {rows.map((e) => {
            const isNew = e.id === v.lastAdded;
            return (
              <div
                key={e.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '46px minmax(0,1fr) minmax(0,1fr) 82px',
                  gap: 8,
                  padding: '11px 14px',
                  borderBottom: '1px solid #f1f4f6',
                  fontSize: 12.5,
                  alignItems: 'center',
                  background: isNew ? '#fff2c9' : 'transparent',
                  animation: isNew ? 'rowin 1.8s ease' : 'none',
                }}
              >
                <div style={{ color: '#8895a3', fontSize: 11 }}>{e.date}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.kari}
                  </div>
                  {e.tekiyo && (
                    <div
                      style={{
                        fontSize: 10.5,
                        color: '#9aa5b1',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginTop: 1,
                      }}
                    >
                      {e.tekiyo}
                    </div>
                  )}
                </div>
                <div style={{ color: '#48565f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.kashi}
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {e.amount.toLocaleString('ja-JP')}
                </div>
              </div>
            );
          })}
        </div>
        </>
        )}
      </aside>
        </>
      )}
      <Footer />
    </div>
  );
}

function logoStyle(bg: string, size: number, font: number): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    background: bg,
    color: '#fff',
    borderRadius: 8,
    fontFamily: "'Zen Kaku Gothic New', sans-serif",
    fontWeight: 700,
    fontSize: font,
  };
}


function boxHeader(bg: string, color: string): CSSProperties {
  return {
    background: bg,
    padding: '9px 14px',
    fontWeight: 700,
    fontSize: 13,
    color,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderRadius: '11px 11px 0 0',
  };
}

