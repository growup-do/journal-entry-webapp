// 単一入力（単一形式：1伝票＝1行）
//   上部 … 伝票の形式の切替、入力した伝票が積み上がる一覧（会計月タブで絞り込み。行ごとに「訂正」「削除」）
//   下部 … 1行分の入力欄。Enterで次の項目へ、金額でEnterすると登録して次の伝票へ。
//   機能ボタン（伝票の操作／行の操作／入力補助／参照）は入力欄の下に常に表示し、Alt＋英字のショートカットでも動く。
// フォーム型（緑）・スプレッドシート型（青）のどちらのシェルからも同じ部品を使う。

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { ToastView, useToast } from './Toast';
import { PrevYearJournal } from './PrevYearJournal';
import { TorihikiBadge, useEntryTools, type EntryFlags } from './EntryExtras';
import { ComboField, ConfirmModal, EntryStyles, FieldLabel, FlagButtons, FundAccountLine, IssueList, fieldState, focusId, hasError, hasWarn, judgeEntry, needsPartner, onEnter, scopeStyle, setPartner, toNum, type FundMode, type FusenColor } from './EntryCommon';
import { useWidePanel } from './WidePanel';
import { yearOfMonth } from './SingleEntryTools';
import { makeSingleSeed } from '../data';
import { useEntryForm } from '../hooks/useEntryForm';
import { applyMonth } from '../lib/format';
import { FUSEN_COLORS, addVoucher, deleteVoucher, getVouchers, updateVoucher } from '../store/journalStore';
import { useSession, type TemplateLine } from '../store/session';
import type { FormState, JournalEntry } from '../types';

const PINK = '#b0426a';
const BLUE = '#2c5f9e';

/** 一覧・入力行で共通の列構成（最後は操作列） */
const COLS = '52px 92px 84px minmax(0,1.15fr) minmax(0,1.15fr) minmax(0,1.35fr) 118px 96px';

const initialForm: FormState = {
  service: '001 本部',
  month: '8',
  day: '5',
  torihiki: '資金',
  kariKamoku: '',
  kashiKamoku: '',
  tekiyo: '',
  gyosha: '',
  amount: '',
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
/** 令和8年＝2026年として曜日を求める（月/日が不正なら空） */
function weekdayOf(month: string, day: string): string {
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (!m || !d) return '';
  const dt = new Date(yearOfMonth(month), m - 1, d);
  if (dt.getMonth() !== m - 1) return '';
  return WEEKDAYS[dt.getDay()];
}
function weekdayOfDate(date: string): string {
  const [m, d] = date.split('/');
  return weekdayOf(m ?? '', d ?? '');
}

const ENTER_ORDER = '月 → 日 → 借方科目 → 貸方科目 →（内部取引のとき：相手区分）→ 摘要 → 業者 → 金額。金額で Enter を押すと登録し、次の伝票の借方科目へ移ります';

/** 一覧の行に付ける情報（チェック・付箋・内部取引相手区分・共有ストア側の id） */
interface RowMeta { storeId?: number; check: boolean; fusen: FusenColor; aite: string }

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  accentRgb: string;
  /** ヘッダーで「前年仕訳」を選んだとき：一覧を前年仕訳（閲覧のみ）に差し替え、入力行は隠す */
  prevYear?: boolean;
  /** 形式の切替・問合せ画面への移動。未指定のときは切替を出さず、現在の形式だけを表示 */
  onNavigate?: (label: string) => void;
}

export function SingleEntryPage({ variant, accent, prevYear, onNavigate }: Props) {
  const sess = useSession();
  const toast = useToast();
  const wide = useWidePanel('form-entry'); // 右側の参照パネル（4形式で共有。表示は FormScreen 側）
  const [flags, setFlags] = useState<EntryFlags>({ check: false, fusen: '', shohyo: true });
  const [cheque, setCheque] = useState('');
  const [fundMode, setFundMode] = useState<FundMode>('自動資金');
  const [internal, setInternal] = useState(false);
  const [aite, setAite] = useState('');
  /** 連続定型：テンプレートの行を1枚ずつ続けて登録する */
  const [queue, setQueue] = useState<{ name: string; lines: TemplateLine[]; i: number } | null>(null);
  const [delTarget, setDelTarget] = useState<JournalEntry | null>(null);
  const [meta, setMeta] = useState<Record<number, RowMeta>>({});
  const [, setHi] = useState<number[]>([]);
  const pending = useRef<RowMeta | null>(null);

  // 登録後：小切手Noをクリアし、借方科目へフォーカス（証憑・日付・区分は保持して連続入力）
  const afterSubmit = useCallback(() => {
    setCheque('');
    focusId('se-kari');
  }, []);
  const v = useEntryForm({ initialForm, seed: makeSingleSeed(), afterSubmit, initialMonth: '8' });
  const f = v.form;

  // 登録した行の id が決まったら、行の情報（チェック・付箋・相手区分）をひも付ける
  useEffect(() => {
    const p = pending.current;
    if (v.lastAdded == null || !p) return;
    pending.current = null;
    const id = v.lastAdded;
    setMeta((m) => ({ ...m, [id]: p }));
  }, [v.lastAdded]);

  const partner = needsPartner({ kari: f.kariKamoku, kashi: f.kashiKamoku, internal });
  const issues = judgeEntry({ kari: f.kariKamoku, kashi: f.kashiKamoku, amount: toNum(f.amount), fundMode, internal, aite, division: f.service }, sess.env);
  const blocked = hasError(issues);
  const dirty = !!(f.kariKamoku || f.kashiKamoku || f.tekiyo || f.gyosha || f.amount);

  const fill = (l: TemplateLine) => v.setFields({ kariKamoku: l.kari, kashiKamoku: l.kashi, tekiyo: l.tekiyo, gyosha: l.gyosha ?? '', amount: String(l.amount ?? '').replace(/[^0-9]/g, '') });
  const clearEntry = () => {
    v.setFields({ kariKamoku: '', kashiKamoku: '', tekiyo: '', gyosha: '', amount: '' });
    setCheque('');
    setInternal(false);
    setAite('');
    setQueue(null);
    setFlags((s) => ({ ...s, check: false, fusen: '' }));
  };

  const doSubmit = (confirmed = false) => {
    if (prevYear) { toast.show('前年仕訳は閲覧のみです。当年の表示に切り替えてから入力してください'); return; }
    if (!tools.editable) { toast.show(tools.reason); return; }
    if (!f.kariKamoku || !f.kashiKamoku || !toNum(f.amount)) {
      v.submit(); // 未入力のメッセージを表示
      focusId(!f.kariKamoku ? 'se-kari' : !f.kashiKamoku ? 'se-kashi' : 'se-amount');
      return;
    }
    if (blocked) {
      const first = issues.find((i) => i.level === 'error');
      toast.show('登録できない内容があります。入力欄の下の表示を確認してください');
      focusId(first?.field === 'aite' ? 'se-aite' : first?.field === 'kari' ? 'se-kari' : 'se-kashi');
      return;
    }
    if (hasWarn(issues) && !confirmed) {
      toast.show('確認が必要な内容があります。「確認して登録」を押すと登録します');
      focusId('se-confirm');
      return;
    }
    const stored = addVoucher({ kind: '単一', date: `${f.month}/${f.day}`, kari: f.kariKamoku, kashi: f.kashiKamoku, tekiyo: f.tekiyo, amount: toNum(f.amount), service: f.service, gyosha: f.gyosha || undefined, shohyo: flags.shohyo, cheque: cheque.trim() || undefined, internal: partner || undefined });
    if (flags.check || flags.fusen) updateVoucher(stored.id, { check: flags.check, fusen: flags.fusen });
    if (partner) setPartner(stored.id, aite);
    pending.current = { storeId: stored.id, check: flags.check, fusen: flags.fusen, aite: partner ? aite : '' };
    setHi([stored.id]);
    v.submit({ shohyo: flags.shohyo, cheque: cheque.trim() || undefined });
    setFlags((s) => ({ ...s, check: false, fusen: '' }));
    setInternal(false);
    setAite('');
    // 連続定型：次の行を入力欄に呼び出す
    if (queue) {
      const next = queue.i + 1;
      if (next < queue.lines.length) {
        fill(queue.lines[next]);
        setQueue({ ...queue, i: next });
        focusId('se-amount');
        toast.show(`伝票を登録しました。連続定型「${queue.name}」 ${next + 1}／${queue.lines.length} 枚目を呼び出しました`);
        return;
      }
      setQueue(null);
      toast.show(`連続定型「${queue.name}」の ${queue.lines.length} 枚を登録しました`);
      return;
    }
    toast.show('伝票を登録しました');
  };

  const tools = useEntryTools({
    format: '単一入力',
    accent,
    onNavigate,
    toast: toast.show,
    dirty: dirty && !prevYear,
    service: f.service,
    month: f.month,
    day: f.day,
    kari: f.kariKamoku,
    kashi: f.kashiKamoku,
    lines: [{ kari: f.kariKamoku, kashi: f.kashiKamoku, tekiyo: f.tekiyo, amount: f.amount, gyosha: f.gyosha || undefined }],
    multiRow: false,
    rowLabel: '入力中の伝票',
    flags,
    onFlags: (p) => setFlags((s) => ({ ...s, ...p })),
    fundMode,
    onFundMode: setFundMode,
    onSubmit: () => doSubmit(),
    onCancel: () => { clearEntry(); focusId('se-kari'); },
    internal: partner,
    onInternal: () => {
      if (internal) { setInternal(false); return; }
      setInternal(true);
      focusId('se-aite');
    },
    onLoadTemplate: (t, mode) => {
      const l = t.lines[0];
      if (!l) { toast.show(`定型仕訳「${t.name}」には行がありません`); return; }
      fill(l);
      setQueue(mode === '連続' && t.lines.length > 1 ? { name: t.name, lines: t.lines, i: 0 } : null);
      focusId('se-amount');
      toast.show(mode === '連続' && t.lines.length > 1 ? `連続定型「${t.name}」 1／${t.lines.length} 枚目を呼び出しました。登録すると次の伝票を呼び出します` : `定型仕訳「${t.name}」を入力欄に呼び出しました`);
    },
    onRegistered: (ids) => {
      // 自動按分で登録した伝票を一覧にも追加
      const added = getVouchers().filter((r) => ids.includes(r.id));
      v.addEntries(added.map((r) => ({ date: r.date, kari: r.kari, kashi: r.kashi, tekiyo: r.tekiyo, amount: r.amount, gyosha: r.gyosha, shohyo: r.shohyo })));
      setHi(ids);
    },
    onPickDate: (m, d) => { v.setFields({ month: m, day: d }); v.setMonth(m); focusId('se-kari'); },
    onOpenPanel: prevYear ? undefined : () => { wide.setCollapsed(false); toast.show('画面の下に参照パネルを開きました'); },
    submitId: 'se-submit',
    enterOrder: ENTER_ORDER,
  });
  const ro = !tools.editable;

  // 訂正：行を入力欄に戻す（一覧の行ごとの「訂正」）
  const edit = (e: JournalEntry) => {
    if (ro) return;
    const [m, d] = e.date.split('/');
    const mt = meta[e.id];
    v.setFields({ month: m ?? '', day: d ?? '', kariKamoku: e.kari, kashiKamoku: e.kashi, tekiyo: e.tekiyo, gyosha: e.gyosha ?? '', amount: String(e.amount) });
    setFlags({ shohyo: !!e.shohyo, check: !!mt?.check, fusen: mt?.fusen ?? '' });
    setCheque(e.cheque ?? '');
    setAite(mt?.aite ?? '');
    setInternal(!!mt?.aite);
    setQueue(null);
    if (mt?.storeId != null) deleteVoucher(mt.storeId);
    v.removeEntry(e.id);
    focusId('se-kari');
    toast.show('伝票を入力欄に戻しました。修正して登録してください');
  };
  // 削除（一覧の行ごとの「削除」。確認のあとに削除）
  const doDelete = () => {
    const e = delTarget;
    setDelTarget(null);
    if (!e) return;
    const mt = meta[e.id];
    if (mt?.storeId != null) deleteVoucher(mt.storeId);
    v.removeEntry(e.id);
    toast.show('伝票を削除しました');
  };

  const wd = weekdayOf(f.month, f.day);
  const rows = applyMonth(v.journal, v.monthFilter);
  const isSheet = variant === 'sheet';
  const showCheque = sess.input.cheque;

  const textInput: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 10px',
    border: '1px solid #cfd8e0',
    borderRadius: 8,
    fontSize: 13.5,
    fontFamily: 'inherit',
    outline: 'none',
    color: '#22303c',
    background: ro ? '#f5f7f9' : '#fff',
    minWidth: 0,
  };
  const dateInput: CSSProperties = { ...textInput, width: 40, padding: '9px 2px', textAlign: 'center' };
  const rowBtn = (color: string): CSSProperties => ({
    padding: '4px 9px',
    borderRadius: 6,
    border: '1px solid #d3dbe3',
    background: '#fff',
    color,
    fontSize: 11.5,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  });
  const afterKashi = () => focusId(needsPartner({ kari: f.kariKamoku, kashi: f.kashiKamoku, internal }) ? 'se-aite' : 'se-tekiyo');

  return (
    <main className="ef-scope" style={{ ...scopeStyle(accent), flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <EntryStyles />
      <ToastView msg={toast.msg} />
      {tools.dialogs}
      <ConfirmModal open={delTarget != null} title="伝票削除の確認" okLabel="この伝票を削除する" cancelLabel="削除しない" danger accent={accent} onClose={() => setDelTarget(null)} onOk={doDelete}>
        {delTarget && (
          <>
            次の伝票を削除します。<b>削除した伝票は元に戻せません。</b>
            <div style={{ marginTop: 8, padding: '8px 12px', background: '#f6f8fa', border: '1px solid #e2e8ee', borderRadius: 8, fontSize: 13 }}>
              {delTarget.date}　{delTarget.kari} ／ {delTarget.kashi}　<b>{delTarget.amount.toLocaleString('ja-JP')}円</b>
              {delTarget.tekiyo && <div style={{ color: '#7a8794', fontSize: 12 }}>{delTarget.tekiyo}</div>}
            </div>
          </>
        )}
      </ConfirmModal>
      <div style={{ width: '100%', maxWidth: isSheet ? 'none' : 1280, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      <div
        style={{
          width: '100%',
          background: '#fff',
          border: '1px solid #dde4ea',
          borderRadius: isSheet ? 14 : 16,
          boxShadow: '0 6px 26px rgba(30,50,70,.07)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 伝票の形式の切替 */}
        {tools.topBar}
        {tools.banner}

        {/* 見出し */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, padding: '14px 22px 12px', borderBottom: '1px solid #eef2f5' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: isSheet ? 17 : 21, letterSpacing: '.02em' }}>
              単一入力 <span style={{ fontSize: 12.5, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>チャイルド保育園　拠点区分</span>
            </div>
            <div style={{ color: '#7a8794', fontSize: 12, marginTop: 4 }}>
              1行＝1伝票を連続入力。<b style={{ color: '#5b6773', fontWeight: 600 }}>Enter</b>で次の項目へ、金額で<b style={{ color: '#5b6773', fontWeight: 600 }}>Enter</b>すると登録して次の伝票へ進みます。
            </div>
          </div>
          <div style={{ flex: 'none', fontSize: 12.5, color: '#68757f', whiteSpace: 'nowrap', paddingTop: 4 }}>
            会計期間　<b style={{ color: '#22303c', fontWeight: 600 }}>令和8年度</b>
          </div>
        </div>

        {prevYear ? (
          <PrevYearJournal accent={accent} />
        ) : (
        <>
        {/* 会計月タブ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 22px', borderBottom: '1px solid #eef2f5' }}>
          <span style={{ fontSize: 11, color: '#8895a3', fontWeight: 700, flex: 'none' }}>表示月</span>
          <FiscalMonthTabs current={v.monthFilter} accent={accent} onSelect={v.setMonth} withAll />
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8895a3', flex: 'none' }}>
            <b style={{ color: '#22303c', fontWeight: 700 }}>{rows.length}</b> 件
          </span>
        </div>

        {/* 入力済み一覧 */}
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '9px 22px', background: '#f6f8fa', fontSize: 10.5, fontWeight: 700, color: '#8290a0', borderBottom: '1px solid #eef2f5' }}>
          <div>伝票No</div>
          <div>日（曜日）</div>
          <div>証憑・印</div>
          <div style={{ color: BLUE }}>借方 勘定科目 <span style={{ color: '#b3bcc5', fontWeight: 500 }}>／ 資金科目</span></div>
          <div style={{ color: PINK }}>貸方 勘定科目 <span style={{ color: '#b3bcc5', fontWeight: 500 }}>／ 資金科目</span></div>
          <div>摘要 <span style={{ color: '#b3bcc5', fontWeight: 500 }}>／ 業者</span></div>
          <div style={{ textAlign: 'right' }}>金額</div>
          <div style={{ textAlign: 'right' }}>操作</div>
        </div>
        <div id="journal-scroll" style={{ overflowY: 'auto', minHeight: 150, maxHeight: 'calc(100vh - 690px)' }}>
          {rows.length === 0 && (
            <div style={{ padding: '40px 22px', textAlign: 'center', color: '#9aa5b1', fontSize: 13 }}>この月の伝票はありません。下の入力行から登録してください。</div>
          )}
          {rows.map((e, i) => {
            const isNew = e.id === v.lastAdded;
            const mt = meta[e.id];
            return (
              <div
                key={e.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: COLS,
                  gap: 12,
                  padding: '10px 22px',
                  borderBottom: '1px solid #f1f4f6',
                  fontSize: 12.5,
                  alignItems: 'center',
                  background: isNew ? '#fff2c9' : 'transparent',
                  animation: isNew ? 'rowin 1.8s ease' : 'none',
                }}
              >
                <div style={{ color: '#8895a3', fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(3, '0')}</div>
                <div style={{ color: '#48565f' }}>
                  {e.date}
                  <span style={{ color: '#9aa5b1', fontSize: 11 }}>（{weekdayOfDate(e.date) || '－'}）</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: e.shohyo ? '#eaf5ef' : '#f1f4f6', color: e.shohyo ? '#1f7a52' : '#9aa5b1' }}>
                    {e.shohyo ? '有' : '無'}
                  </span>
                  {mt?.check && <span title="チェック" style={{ fontSize: 11, fontWeight: 900, color: '#22303c' }}>✓</span>}
                  {mt?.fusen && <span title={`付箋：${mt.fusen}`} style={{ width: 10, height: 10, borderRadius: 2, background: FUSEN_COLORS[mt.fusen], display: 'inline-block' }} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.kari}</div>
                  <div style={{ fontSize: 10.5, color: '#b3bcc5' }}>資金科目：自動</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#48565f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.kashi}</div>
                  <div style={{ fontSize: 10.5, color: '#b3bcc5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mt?.aite ? `内部取引　相手：${mt.aite}` : '資金科目：自動'}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#48565f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.tekiyo || '—'}</div>
                  <div style={{ fontSize: 10.5, color: '#9aa5b1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.gyosha || '業者なし'}
                    {e.cheque ? `　小切手 ${e.cheque}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{e.amount.toLocaleString('ja-JP')}</div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button type="button" className="ef-act" disabled={ro} title={ro ? tools.reason : 'この伝票を入力欄に戻して訂正します'} onClick={() => edit(e)} style={rowBtn('#2c5f9e')}>訂正</button>
                  <button type="button" className="ef-act" disabled={ro} title={ro ? tools.reason : 'この伝票を削除します（確認あり）'} onClick={() => setDelTarget(e)} style={rowBtn('#c0392b')}>削除</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 入力行 */}
        <div style={{ borderTop: `2px solid ${accent}`, background: '#fbfcfd', padding: '12px 22px 12px' }}>
          {/* 伝票の属性（サービス区分・取引区分） */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 10, flexWrap: 'wrap' }}>
            <div className="ef-field" style={{ width: 220 }}>
              <FieldLabel>サービス区分</FieldLabel>
              <ComboField id="se-service" kind="service" value={f.service} onChange={(x) => v.setField('service', x)} onCommit={() => focusId('se-month')} placeholder="コード・名称で指定" dropUp disabled={ro} />
            </div>
            {partner && (
              <div className="ef-field" style={{ width: 240 }}>
                <FieldLabel color="#6b3fb5">内部取引相手区分</FieldLabel>
                <ComboField id="se-aite" kind="service" value={aite} onChange={setAite} onCommit={() => focusId('se-tekiyo')} placeholder="相手先の区分を指定" dropUp disabled={ro} invalid={fieldState(issues, 'aite')} />
              </div>
            )}
            {queue && (
              <div style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: '#eef4fb', border: '1px solid #c9dbf0', color: '#2c5f9e', fontSize: 12.5, fontWeight: 700 }}>
                連続定型「{queue.name}」 {queue.i + 1}／{queue.lines.length} 枚目
                <button type="button" className="ef-act" onClick={() => { setQueue(null); toast.show('連続定型を終了しました（入力中の内容は残っています）'); }} style={{ padding: '2px 8px', borderRadius: 6, border: '1px solid #c9dbf0', background: '#fff', color: '#2c5f9e', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>終了</button>
              </div>
            )}
            <div style={{ marginLeft: 'auto' }}>
              <TorihikiBadge kari={f.kariKamoku} kashi={f.kashiKamoku} force={fundMode === '強制資金'} blocked={blocked} fundMode={fundMode} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, alignItems: 'start' }}>
            <div>
              <FieldLabel>伝票No</FieldLabel>
              <div style={{ height: 38, display: 'flex', alignItems: 'center', fontSize: 12, color: '#9aa5b1' }}>自動採番</div>
            </div>
            <div className="ef-field">
              <FieldLabel>日（曜日）</FieldLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <input id="se-month" className="ef-input" aria-label="月" disabled={ro} value={f.month} onChange={(e) => v.setField('month', e.target.value)} onKeyDown={onEnter(() => focusId('se-day'))} inputMode="numeric" style={dateInput} />
                <span style={{ color: '#9aa5b1' }}>/</span>
                <input id="se-day" className="ef-input" aria-label="日" disabled={ro} value={f.day} onChange={(e) => v.setField('day', e.target.value)} onKeyDown={onEnter(() => focusId('se-kari'))} inputMode="numeric" style={dateInput} />
                <span style={{ fontSize: 12, color: wd ? '#48565f' : '#c3ccd4', width: 22, textAlign: 'center' }}>{wd || '－'}</span>
              </div>
            </div>
            <div>
              <FieldLabel>証憑・印</FieldLabel>
              <div style={{ height: 38, display: 'flex', alignItems: 'center' }}>
                <FlagButtons shohyo={flags.shohyo} check={flags.check} fusen={flags.fusen} disabled={ro} onChange={(p) => setFlags((s) => ({ ...s, ...p }))} />
              </div>
            </div>
            <div className="ef-field" style={{ minWidth: 0 }}>
              <FieldLabel color={BLUE}>借方科目</FieldLabel>
              <ComboField id="se-kari" kind="account" value={f.kariKamoku} onChange={(x) => v.setField('kariKamoku', x)} onCommit={() => focusId('se-kashi')} placeholder="コード・名称・フリガナ" dropUp listWidth={400} disabled={ro} invalid={fieldState(issues, 'kari', 'pair')} />
              <FundAccountLine name={f.kariKamoku} other={f.kashiKamoku} mode={fundMode} />
            </div>
            <div className="ef-field" style={{ minWidth: 0 }}>
              <FieldLabel color={PINK}>貸方科目</FieldLabel>
              <ComboField id="se-kashi" kind="account" value={f.kashiKamoku} onChange={(x) => v.setField('kashiKamoku', x)} onCommit={afterKashi} placeholder="コード・名称・フリガナ" dropUp listWidth={400} disabled={ro} invalid={fieldState(issues, 'kashi', 'pair')} />
              <FundAccountLine name={f.kashiKamoku} other={f.kariKamoku} mode={fundMode} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <div className="ef-field" style={{ flex: 1.2, minWidth: 0 }}>
                  <FieldLabel>摘要</FieldLabel>
                  <ComboField id="se-tekiyo" kind="summary" freeText value={f.tekiyo} onChange={(x) => v.setField('tekiyo', x)} onCommit={() => focusId('se-gyosha')} placeholder="摘要" dropUp listWidth={320} disabled={ro} />
                </div>
                <div className="ef-field" style={{ flex: 1, minWidth: 0 }}>
                  <FieldLabel>業者</FieldLabel>
                  <ComboField id="se-gyosha" kind="vendor" value={f.gyosha} onChange={(x) => v.setField('gyosha', x)} onCommit={() => focusId('se-amount')} placeholder="業者" dropUp listWidth={280} disabled={ro} />
                </div>
              </div>
            </div>
            <div className="ef-field">
              <FieldLabel style={{ textAlign: 'right' }}>金額</FieldLabel>
              <input
                id="se-amount"
                className="ef-input"
                disabled={ro}
                value={v.amountFmt}
                onChange={(e) => v.setField('amount', e.target.value)}
                onKeyDown={onEnter(() => doSubmit())}
                inputMode="numeric"
                placeholder="0"
                autoComplete="off"
                style={{ ...textInput, textAlign: 'right', fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
              />
            </div>
            <div className="ef-field">
              {showCheque ? (
                <>
                  <FieldLabel>小切手No</FieldLabel>
                  <input id="se-cheque" className="ef-input" disabled={ro} value={cheque} onChange={(e) => setCheque(e.target.value)} onKeyDown={onEnter(() => focusId('se-amount'))} placeholder="任意" autoComplete="off" style={textInput} />
                </>
              ) : (
                <div style={{ paddingTop: 26, fontSize: 11, color: '#9aa5b1', lineHeight: 1.5 }}>金額で Enter<br />→ 登録</div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>{tools.submitButton}</div>
          {/* 入力内容の判定（エラー＝登録不可／確認＝確認して登録） */}
          {(issues.length > 0 || v.err) && (
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              {v.err && <div role="alert" style={{ color: '#c0392b', fontSize: 12.5, fontWeight: 600 }}>{v.err}</div>}
              <IssueList issues={issues} confirmId="se-confirm" onConfirm={() => doSubmit(true)} confirmDisabled={ro ? tools.reason : !toNum(f.amount) ? '金額を入力すると登録できます' : undefined} />
            </div>
          )}

          {/* 機能ボタン（入力補助／参照） */}
          <div style={{ marginTop: 10 }}>{tools.actionBar}</div>
        </div>
        </>
        )}
      </div>

      </div>
    </main>
  );
}
