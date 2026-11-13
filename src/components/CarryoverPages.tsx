// 旧 保守メニューのうち、Web版に未収録だった設定画面：
//   CarryoverJudgmentPage … 繰越判断の基準（収支分析表／高額繰越／前期末支払資金残高の取り扱い（委託費）／取崩による事前協議）
//   DepreciationLinkPage  … 減価償却との連動設定（固定資産科目の連動／借入元金償還補助の連動／国庫補助金等特別積立金の自動積立）
//   どちらも「科目の指定（チェックリスト）＋端数処理・監視の設定」という共通の形。判断の目安をその場で計算して見せる。
//   繰越判断の基準は、変更したのに保存していないあいだ、変更した項目を入力可能枠と同じ黄色で示し、
//   「保存されていません。」の表示・タブの印・画面の色で知らせる。ほかの画面へ移ろうとすると確認を出す（確認メモ #225）。
//   「関連資料（通知文）」は選択中のタブに応じて内容を切り替える（取崩による事前協議のタブにはボタンなし。確認メモ #226）。

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { Field, Notice, SettingsShell, Tabs, Toggle, btn, card, cardHead, input, lbl, yen } from './ui';
import { ACCOUNT_META } from '../lib/accounts';
import { ScopeBar, type MaintenancePageProps } from './MaintenancePages';
import { CHANGED_BG, CHANGED_BORDER, UNSAVED_FG, useUnsaved } from '../store/unsaved';

/* ---------------- 共通部品 ---------------- */
interface Item { code: string; name: string }
const meta = (f: (m: (typeof ACCOUNT_META)[number]) => boolean): Item[] => ACCOUNT_META.filter(f).map((m) => ({ code: m.code, name: m.name }));
const extra = (list: [string, string][]): Item[] => list.map(([code, name]) => ({ code, name }));
const codes = (items: Item[], re: RegExp) => items.filter((i) => re.test(i.name)).map((i) => i.code);

/** 科目のチェックリスト（旧画面の「―― ○○に集計する科目 ――」の枠） */
function PickList({ title, items, value, onChange, height = 220, note, saved }: { title: string; items: Item[]; value: string[]; onChange: (v: string[]) => void; height?: number; note?: ReactNode; /** 保存済みの値。渡すと、保存済みと違う行を入力可能枠と同じ黄色で示す（確認メモ #225） */ saved?: string[] }) {
  const toggle = (c: string) => onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  const diff = (c: string) => !!saved && saved.includes(c) !== value.includes(c);
  const changed = !!saved && items.some((i) => diff(i.code));
  return (
    <div data-changed={changed || undefined} style={changed ? { ...card, border: '1px solid ' + CHANGED_BORDER } : card}>
      <div style={cardHead}>{title}<span style={{ fontSize: 12, fontWeight: 600, color: value.length ? '#5b6773' : '#c0392b', marginLeft: 6 }}>{value.length ? `${value.length} 科目` : '未設定'}</span>
        {changed && <span style={{ fontSize: 12, fontWeight: 800, color: UNSAVED_FG }}>変更あり</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => onChange(items.map((i) => i.code))} style={btn('#5b6773', false, true)}>全て ON</button>
          <button type="button" onClick={() => onChange([])} style={btn('#5b6773', false, true)}>全て OFF</button>
        </span>
      </div>
      <div style={{ maxHeight: height, overflow: 'auto' }}>
        {items.map((i) => (
          <label key={i.code} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', fontSize: 14, borderTop: '1px solid #f1f4f7', background: saved ? (diff(i.code) ? CHANGED_BG : value.includes(i.code) ? '#f1f8f4' : '#fff') : value.includes(i.code) ? '#fffbe6' : '#fff', cursor: 'pointer' }} data-changed={diff(i.code) || undefined}>
            <input type="checkbox" checked={value.includes(i.code)} onChange={() => toggle(i.code)} />
            <span style={{ fontVariantNumeric: 'tabular-nums', color: '#7a8794', width: 48, fontSize: 12 }}>{i.code}</span>
            <span>{i.name}</span>
            {diff(i.code) && <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: UNSAVED_FG, flex: 'none' }}>{value.includes(i.code) ? '追加' : '解除'}</span>}
          </label>
        ))}
      </div>
      {note && <div style={{ padding: '8px 12px', fontSize: 12, color: '#5b6773', borderTop: '1px solid #eef2f5', background: '#fbfcfd' }}>{note}</div>}
    </div>
  );
}

type Rounding = '切り上げ' | '切り捨て' | '四捨五入';
const ROUNDINGS: Rounding[] = ['切り上げ', '切り捨て', '四捨五入'];
const roundBy = (n: number, r: Rounding) => (r === '切り上げ' ? Math.ceil(n) : r === '切り捨て' ? Math.floor(n) : Math.round(n));
/** 変更した項目を囲む枠（入力可能枠と同じ黄色） */
const changedBox = (changed?: boolean) => ({ border: '1px solid ' + (changed ? CHANGED_BORDER : 'transparent'), background: changed ? CHANGED_BG : 'transparent', borderRadius: 8, padding: '6px 8px', margin: '-6px -8px' });
function RoundingField({ label, value, onChange, changed }: { label: string; value: Rounding; onChange: (r: Rounding) => void; /** 保存済みと違う（確認メモ #225） */ changed?: boolean }) {
  return (
    <div data-changed={changed || undefined} style={changedBox(changed)}>
    <Field label={label}>
      <div style={{ display: 'flex', gap: 14, fontSize: 14, paddingTop: 2 }}>{ROUNDINGS.map((r) => <label key={r} style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="radio" checked={value === r} onChange={() => onChange(r)} />{r}</label>)}</div>
    </Field>
    </div>
  );
}

/** 判断の目安（設定した端数処理をその場で反映して見せる） */
function Guide({ rows }: { rows: { label: string; value: ReactNode; strong?: boolean }[] }) {
  return (
    <div style={{ ...card, background: '#f7f9fb' }}>
      <div style={cardHead}>判断の目安<span style={{ fontSize: 12, fontWeight: 500, color: '#7a8794', marginLeft: 6 }}>サンプルデータで計算</span></div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}><tbody>
        {rows.map((r) => <tr key={r.label}><td style={{ padding: '7px 12px', borderTop: '1px solid #eef2f5', color: '#5b6773' }}>{r.label}</td><td style={{ padding: '7px 12px', borderTop: '1px solid #eef2f5', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: r.strong ? 800 : 500 }}>{r.value}</td></tr>)}
      </tbody></table>
    </div>
  );
}

/* ---------------- 関連資料（通知文） ----------------
 * 現行システムと同じく、タブ（旧 各画面）ごとに内容が異なる（確認メモ #226）。
 * 全文は手元にないため、出典・該当箇所・要旨を示す。本番では現行システムの通知文をそのまま収録する。
 * 「取崩による事前協議」タブには関連資料がない（ボタンを出さない）。 */
interface NoticeDoc {
  /** 通知の日付・番号 */
  source: string;
  /** 件名（「〜より」まで） */
  subject?: string;
  /** 該当箇所の見出し */
  section?: string;
  /** 要旨 */
  points: ReactNode[];
  /** 参考となる通知 */
  refs?: { source: string; text: ReactNode }[];
}
const H29_SOURCE = '平成29年4月6日　府子本第225号・雇児発0406第2号';
const H29_SUBJECT = '「子ども・子育て支援法附則第６条の規定による私立保育所に対する委託費の経理等について」の一部改正について　より';
const NOTICES: Record<string, NoticeDoc | undefined> = {
  収支分析表: {
    source: H29_SOURCE,
    subject: H29_SUBJECT,
    section: '５　委託費の経理に係る指導監督　›　（２）④',
    points: [
      '設置者から提出された計算書類等が一定の場合に該当するときは、収支分析表の提出を求めることとされています。',
      <>そのひとつが ④<b>各種積立資産への積立支出と当期資金収支差額の合計が、事業活動収入計（決算額）の５％相当額を上回る場合</b>です。</>,
    ],
  },
  高額繰越: {
    source: '平成16年6月10日　雇児発第0610001号の1　より',
    points: [<>「<b>高額繰越による民改費の加算停止</b>」は撤廃されています。</>],
    refs: [
      { source: '昭和51年4月16日　厚生省発児第59号の5　第1の3の(3)', text: <>前年度収入決算額の<b>６か月分相当額以上</b>を繰り越した場合（高額繰越）の取り扱い。</> },
      { source: '平成12年6月8日　児発第582号', text: '上記の規定を読み替えるもの。' },
    ],
  },
  '前期末支払資金残高の取り扱い（委託費）': {
    source: H29_SOURCE,
    subject: H29_SUBJECT,
    section: '３　前期末支払資金残高の取扱いについて　›　（２）',
    points: [
      <>前期末支払資金残高は、<b>委託費収入の３０％以下</b>の保有とされています。</>,
      <>前期末支払資金残高を充当できる経費として、次の区分が示されています。<br />① 法人本部　② 第１種・第２種社会福祉事業、子育て支援事業　③ 公益事業</>,
    ],
  },
};

/** 通知文の窓（現行システムと同じく、タイトル「通知文」・本文・［OK］だけ。表示専用なので Esc・外側クリックでも閉じる） */
function NoticeModal({ doc, open, onClose, accent }: { doc?: NoticeDoc; open: boolean; onClose: () => void; accent: string }) {
  if (!doc) return null;
  return (
    <Modal open={open} onClose={onClose} width={640} title="通知文" dismissible>
      <div data-notice-body style={{ padding: '16px 22px 18px', display: 'grid', gap: 14, fontSize: 14, lineHeight: 1.8, color: '#22303c' }}>
        <div style={{ padding: '10px 14px', background: '#f7f9fb', border: '1px solid #e3e9ef', borderRadius: 8 }}>
          <div style={{ fontWeight: 800 }}>{doc.source}</div>
          {doc.subject && <div style={{ color: '#3a4855' }}>{doc.subject}</div>}
        </div>
        {doc.section && <div style={{ fontWeight: 800, paddingLeft: 10, borderLeft: '4px solid ' + accent, lineHeight: 1.5 }}>{doc.section}</div>}
        <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>{doc.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
        {doc.refs && (
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#5b6773' }}>参考</div>
            {doc.refs.map((r) => <div key={r.source} style={{ paddingLeft: 12, borderLeft: '2px solid #e3e9ef' }}><div style={{ fontWeight: 700 }}>{r.source}</div><div style={{ color: '#3a4855' }}>{r.text}</div></div>)}
          </div>
        )}
        <div style={{ fontSize: 12, color: '#7a8794' }}>ここでは出典と要旨を示しています。通知文の全文は、本番では現行システムと同じものを収録します。</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={onClose} style={{ ...btn(accent, true), minWidth: 96 }}>OK</button></div>
      </div>
    </Modal>
  );
}

/* ==================================================================
 * 繰越判断の基準
 * ================================================================== */
const SAMPLE = { income: 40_120_000, prevIncome: 42_300_000, fundEnd: 9_500_000, itaku: 37_500_000, budgetIncome: 40_800_000, reserveOut: 1_200_000, fundDiff: 650_000 };
const TABS_C = ['収支分析表', '高額繰越', '前期末支払資金残高の取り扱い（委託費）', '取崩による事前協議'];
const INCOME_ITEMS = meta((m) => m.cls === '収益');
const EXPENSE_ITEMS = [...extra([['5810', '施設整備等積立資産積立支出'], ['5820', '人件費積立資産積立支出'], ['5830', '修繕積立資産積立支出'], ['5840', '備品等購入積立資産積立支出'], ['5850', '保育所施設・設備整備積立資産積立支出']]), ...meta((m) => m.cls === '費用')];
const RESERVE_ITEMS = extra([['3310', '施設整備等積立金'], ['3320', '人件費積立金'], ['3330', '修繕積立金'], ['3340', '備品等購入積立金'], ['3350', '保育所施設・設備整備積立金'], ['3390', 'その他の積立金']]);

export function CarryoverJudgmentPage({ variant, accent, onNavigate }: MaintenancePageProps) {
  const toast = useToast();
  const [tab, setTab] = useState(TABS_C[0]);
  const [noticeOpen, setNoticeOpen] = useState(false);
  /** 選択中のタブの通知文（ないタブではボタンを出さない。確認メモ #226） */
  const notice = NOTICES[tab];
  // 収支分析表
  const [reserveOut, setReserveOut] = useState<string[]>(codes(EXPENSE_ITEMS, /積立資産積立支出/));
  const [incomeAll, setIncomeAll] = useState<string[]>(codes(INCOME_ITEMS, /委託費|利用料|補助金/));
  const [r5, setR5] = useState<Rounding>('切り上げ');
  // 高額繰越
  const [otherReserve, setOtherReserve] = useState<string[]>(codes(RESERVE_ITEMS, /その他の積立金/));
  const [incomeSrc, setIncomeSrc] = useState<'システムより集計する' | '手入力する'>('システムより集計する');
  const [incomeManual, setIncomeManual] = useState(SAMPLE.prevIncome);
  const [incomePrev, setIncomePrev] = useState<string[]>(codes(INCOME_ITEMS, /委託費|利用料|補助金/));
  const [r50, setR50] = useState<Rounding>('切り上げ');
  // 委託費 30%
  const [itaku, setItaku] = useState<string[]>(codes(INCOME_ITEMS, /委託費/));
  const [r30, setR30] = useState<Rounding>('切り上げ');
  // 事前協議 3%
  const [r3, setR3] = useState<Rounding>('切り上げ');

  // 保存済みの値との比較（確認メモ #225）。配列は並び順を問わず中身で比べる
  const cur = { reserveOut, incomeAll, r5, otherReserve, incomeSrc, incomeManual, incomePrev, r50, itaku, r30, r3 };
  type Snap = typeof cur;
  const [saved, setSaved] = useState<Snap>(cur);
  const same = (x: unknown, y: unknown) => (Array.isArray(x) && Array.isArray(y) ? x.length === y.length && x.every((v) => y.includes(v)) : x === y);
  const ch = (k: keyof Snap) => !same(cur[k], saved[k]);
  const TAB_KEYS: Record<string, (keyof Snap)[]> = { 収支分析表: ['reserveOut', 'incomeAll', 'r5'], 高額繰越: ['otherReserve', 'incomeSrc', 'incomeManual', 'incomePrev', 'r50'], '前期末支払資金残高の取り扱い（委託費）': ['itaku', 'r30'], 取崩による事前協議: ['r3'] };
  const dirtyTabs = TABS_C.filter((t) => TAB_KEYS[t].some(ch));
  const dirty = dirtyTabs.length > 0;
  const otherDirty = dirtyTabs.filter((t) => t !== tab);
  useUnsaved('繰越判断', '繰越判断の基準', dirty);
  const save = () => { setSaved(cur); toast.show('繰越判断の基準を保存しました'); };
  const revert = () => {
    setReserveOut(saved.reserveOut); setIncomeAll(saved.incomeAll); setR5(saved.r5);
    setOtherReserve(saved.otherReserve); setIncomeSrc(saved.incomeSrc); setIncomeManual(saved.incomeManual); setIncomePrev(saved.incomePrev); setR50(saved.r50);
    setItaku(saved.itaku); setR30(saved.r30); setR3(saved.r3);
  };

  const prevIncome = incomeSrc === '手入力する' ? incomeManual : SAMPLE.prevIncome;
  const limit5 = roundBy(SAMPLE.income * 0.05, r5);
  const limit50 = roundBy(prevIncome * 0.5, r50);
  const limit30 = roundBy(SAMPLE.itaku * 0.3, r30);
  const limit3 = roundBy(SAMPLE.budgetIncome * 0.03, r3);
  const total5 = SAMPLE.reserveOut + SAMPLE.fundDiff;
  const judge = (over: boolean, yes: string, no: string) => <span style={{ color: over ? '#c0392b' : '#1f7a52' }}>{over ? yes : no}</span>;

  return (
    <SettingsShell variant={variant} title="繰越判断の基準" badge="マスター設定" draft={false} desc="決算書（月次決算）の「繰越判断」ボタンからも開きます（旧 F10 繰越）。委託費の繰越・積立に関する判断（収支分析表の提出、高額繰越、前期末支払資金残高の取り扱い、取崩しの事前協議）の基準となる科目と端数処理を設定します。設定した内容は、決算チェック・収支分析表の印刷で使います。" unsaved={dirty} actions={<>
      {notice && <button type="button" className="btn-outline" data-action="関連資料（通知文）" onClick={() => setNoticeOpen(true)} title={`「${tab}」に関係する通知文を表示します`} style={btn()}>関連資料（通知文）</button>}
      {dirty && <span role="status" data-unsaved-msg style={{ fontSize: 15, fontWeight: 800, color: UNSAVED_FG, marginRight: 4 }}>保存されていません。</span>}
      <button type="button" data-action="変更を取り消す" onClick={revert} disabled={!dirty} title={dirty ? '保存する前の内容に戻します（すべてのタブ）' : '変更はありません'} style={{ ...btn(), opacity: dirty ? 1 : 0.5, cursor: dirty ? 'pointer' : 'default' }}>変更を取り消す</button>
      <button type="button" className="submit-btn" data-action="設定を保存" onClick={save} title="すべてのタブの内容をまとめて保存します" style={btn(accent, true)}>設定を保存</button>
    </>}>
      <ToastView msg={toast.msg} />
      <NoticeModal doc={notice} open={noticeOpen} onClose={() => setNoticeOpen(false)} accent={accent} />
      <Tabs items={TABS_C} current={tab} onChange={setTab} accent={accent} marks={dirtyTabs} />
      {otherDirty.length > 0 && (
        <div data-other-unsaved style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 22px', background: '#fff1d6', borderBottom: '1px solid #f0d9a8', fontSize: 14, color: '#8a5a00', flexWrap: 'wrap' }}>
          <span>ほかのタブにも保存されていない変更があります：</span>
          {otherDirty.map((t) => <button key={t} type="button" onClick={() => setTab(t)} style={{ border: 'none', background: 'transparent', padding: 0, color: '#8a5a00', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>{t}</button>)}
          <span style={{ color: '#a27a2c' }}>「設定を保存」で、すべてのタブをまとめて保存します。</span>
        </div>
      )}
      <ScopeBar scope="この区分のみ" note="拠点区分ごとに判断" right={onNavigate && <button type="button" className="btn-outline" onClick={() => onNavigate('印刷センター')} style={btn('#5b6773', false, true)}>収支分析表を印刷 →</button>}>
        判断は拠点区分（施設）ごとに行います。当期資金収支差額・当期末支払資金残高はシステムが自動計算します。
      </ScopeBar>

      {tab === '収支分析表' && (
        <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }}>
          <PickList title="各積立資産積立支出に集計する科目" items={EXPENSE_ITEMS} value={reserveOut} onChange={setReserveOut} saved={saved.reserveOut} />
          <PickList title="当期事業活動収入計に集計する科目" items={INCOME_ITEMS} value={incomeAll} onChange={setIncomeAll} saved={saved.incomeAll} />
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={card}><div style={cardHead}>端数処理</div><div style={{ padding: 14 }}><RoundingField label="当期事業活動収入計の 5% を算出する際の端数処理" value={r5} onChange={setR5} changed={ch('r5')} /></div></div>
            <Guide rows={[
              { label: '当期事業活動収入計', value: yen(SAMPLE.income) },
              { label: `5% 相当額（${r5}）`, value: yen(limit5), strong: true },
              { label: '各積立資産への積立支出', value: yen(SAMPLE.reserveOut) },
              { label: '当期資金収支差額合計', value: yen(SAMPLE.fundDiff) },
              { label: '合計', value: yen(total5) },
              { label: '判定', value: judge(total5 > limit5, '5% を超える：収支分析表の提出が必要', '5% 以内：提出不要') },
            ]} />
            <Notice>積立支出と当期資金収支差額の合計が、事業活動収入計の 5% 相当額を上回る場合は収支分析表の提出が必要です（通知文 5（2）④）。</Notice>
          </div>
        </div>
      )}

      {tab === '高額繰越' && (
        <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }}>
          <PickList title="「その他の積立金」の指定" items={RESERVE_ITEMS} value={otherReserve} onChange={setOtherReserve} saved={saved.otherReserve} note="当期末支払資金残高は、流動資産 − 流動負債 の計算によりシステムが自動集計します。" />
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={card}><div style={cardHead}>収入決算額</div><div style={{ padding: 14, display: 'grid', gap: 10 }}>
              <div data-changed={ch('incomeSrc') || undefined} style={{ display: 'flex', gap: 14, fontSize: 14, ...changedBox(ch('incomeSrc')) }}>{(['システムより集計する', '手入力する'] as const).map((o) => <label key={o} style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="radio" checked={incomeSrc === o} onChange={() => setIncomeSrc(o)} />{o}</label>)}</div>
              {incomeSrc === '手入力する' && <Field label="前年度の収入決算額"><input className="field-input" value={incomeManual.toLocaleString('ja-JP')} onChange={(e) => setIncomeManual(parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)} data-changed={ch('incomeManual') || undefined} style={{ ...input, textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...(ch('incomeManual') ? { background: CHANGED_BG, border: '1px solid ' + CHANGED_BORDER } : {}) }} /></Field>}
            </div></div>
            {incomeSrc === 'システムより集計する' && <PickList title="収入決算額に集計する科目" items={INCOME_ITEMS} value={incomePrev} onChange={setIncomePrev} saved={saved.incomePrev} height={180} />}
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={card}><div style={cardHead}>端数処理</div><div style={{ padding: 14 }}><RoundingField label="前年度収入決算額の 6 か月分（50%）の処理" value={r50} onChange={setR50} changed={ch('r50')} /></div></div>
            <Guide rows={[
              { label: '前年度の収入決算額', value: yen(prevIncome) },
              { label: `6 か月分（50%・${r50}）`, value: yen(limit50), strong: true },
              { label: '当期末支払資金残高', value: yen(SAMPLE.fundEnd) },
              { label: '判定', value: judge(SAMPLE.fundEnd > limit50, '高額繰越に該当', '高額繰越には該当しない') },
            ]} />
          </div>
        </div>
      )}

      {tab === '前期末支払資金残高の取り扱い（委託費）' && (
        <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }}>
          <PickList title="委託費科目" items={INCOME_ITEMS} value={itaku} onChange={setItaku} saved={saved.itaku} />
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={card}><div style={cardHead}>端数処理</div><div style={{ padding: 14 }}><RoundingField label="委託費収入の 30% を算出する際の端数処理" value={r30} onChange={setR30} changed={ch('r30')} /></div></div>
            <Guide rows={[
              { label: '委託費収入（当年度）', value: yen(SAMPLE.itaku) },
              { label: `30% 相当額（${r30}）`, value: yen(limit30), strong: true },
              { label: '前期末支払資金残高', value: yen(SAMPLE.fundEnd) },
              { label: '判定', value: judge(SAMPLE.fundEnd > limit30, '30% を超える：取り扱いの確認が必要', '30% 以内') },
            ]} />
          </div>
        </div>
      )}

      {tab === '取崩による事前協議' && (
        <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={card}><div style={cardHead}>端数処理</div><div style={{ padding: 14 }}><RoundingField label="事業活動収入（予算額）の 3% を算出する際の端数処理" value={r3} onChange={setR3} changed={ch('r3')} /></div></div>
            <Notice>前期末支払資金残高を取り崩して使う額が、事業活動収入（予算額）の 3% を超える場合は、あらかじめ所轄庁との協議が必要です。この画面では 3% を算出するときの端数処理だけを設定します。</Notice>
          </div>
          <Guide rows={[
            { label: '事業活動収入（当年度予算額）', value: yen(SAMPLE.budgetIncome) },
            { label: `3% 相当額（${r3}）`, value: yen(limit3), strong: true },
          ]} />
        </div>
      )}
    </SettingsShell>
  );
}

/* ==================================================================
 * 減価償却との連動設定
 * ================================================================== */
const TABS_D = ['固定資産科目の連動', '借入元金償還補助の連動', '国庫補助金等特別積立金の自動積立'];
const FIXED_ITEMS = [...meta((m) => m.cls === '資産' && !/定期預金|有価証券/.test(m.name)), ...extra([['1530', '構築物'], ['1540', '機械及び装置'], ['1550', '車輌運搬具'], ['1560', '建物附属設備'], ['1570', '建設仮勘定'], ['1580', '有形リース資産'], ['1591', '建物減価償却累計額'], ['1592', '構築物減価償却累計額'], ['1593', '器具及び備品減価償却累計額']])];
const EQUIP_ITEMS = meta((m) => m.cls === '費用');
const CASH_ITEMS = meta((m) => m.cls === '現預金');
const SUBSIDY_INCOME_ITEMS = [...extra([['4810', '施設整備等補助金収益'], ['4815', '設備資金借入金元金償還補助金収益'], ['4830', '施設整備等寄附金収益'], ['4840', '設備資金借入金元金償還寄附金収益']]), ...meta((m) => m.cls === '収益' && /補助金/.test(m.name))];
const RESERVE_IN_ITEMS = extra([['6810', '国庫補助金等特別積立金積立額'], ['6510', '国庫補助金等特別積立金取崩額（除却等）'], ['6710', '建物売却損・処分損'], ['6720', '器具及び備品売却損・処分損'], ['6730', 'ソフトウェア売却損・処分損']]);
const RESERVE_ACCT_ITEMS = extra([['3210', '国庫補助金等特別積立金']]);
const DEFAULTS = {
  fixed: codes(FIXED_ITEMS, /土地|建物|構築物|機械|車輌|器具|ソフトウェア|リース|累計額|仮勘定/),
  equip: codes(EQUIP_ITEMS, /消耗器具|器具|備品|修繕/),
  reserveIn: codes(RESERVE_IN_ITEMS, /積立額$/),
  cash: CASH_ITEMS.map((i) => i.code),
  subsidy: codes(SUBSIDY_INCOME_ITEMS, /元金償還補助金/),
  autoIn: codes(RESERVE_IN_ITEMS, /積立額$/),
  autoAcct: RESERVE_ACCT_ITEMS.map((i) => i.code),
};

export function DepreciationLinkPage({ variant, accent, onNavigate }: MaintenancePageProps) {
  const toast = useToast();
  const [tab, setTab] = useState(TABS_D[0]);
  const [fixed, setFixed] = useState(DEFAULTS.fixed);
  const [equip, setEquip] = useState(DEFAULTS.equip);
  const [reserveIn, setReserveIn] = useState(DEFAULTS.reserveIn);
  const [cash, setCash] = useState(DEFAULTS.cash);
  const [subsidy, setSubsidy] = useState(DEFAULTS.subsidy);
  const [watch, setWatch] = useState(true);
  const [autoIn, setAutoIn] = useState(DEFAULTS.autoIn);
  const [autoAcct, setAutoAcct] = useState(DEFAULTS.autoAcct);
  const [autoOn, setAutoOn] = useState(false);
  const [tekiyo, setTekiyo] = useState('国庫補助金等特別積立金 積立（自動）');
  // 保存済みの値との比較（確認メモ #227。繰越判断の基準 #225 と同じ見せ方）。配列は並び順を問わず中身で比べる
  const cur = { fixed, equip, reserveIn, cash, subsidy, watch, autoIn, autoAcct, autoOn, tekiyo };
  type Snap = typeof cur;
  const [saved, setSaved] = useState<Snap>(cur);
  const same = (x: unknown, y: unknown) => (Array.isArray(x) && Array.isArray(y) ? x.length === y.length && x.every((v) => y.includes(v)) : x === y);
  const ch = (k: keyof Snap) => !same(cur[k], saved[k]);
  const TAB_KEYS: Record<string, (keyof Snap)[]> = { 固定資産科目の連動: ['fixed', 'equip', 'reserveIn'], 借入元金償還補助の連動: ['cash', 'subsidy', 'watch'], 国庫補助金等特別積立金の自動積立: ['autoIn', 'autoAcct', 'autoOn', 'tekiyo'] };
  const dirtyTabs = TABS_D.filter((t) => TAB_KEYS[t].some(ch));
  const dirty = dirtyTabs.length > 0;
  const otherDirty = dirtyTabs.filter((t) => t !== tab);
  useUnsaved('減価償却連動', '減価償却との連動設定', dirty);
  const save = () => { setSaved(cur); toast.show('減価償却との連動設定を保存しました'); };
  const revert = () => {
    setFixed(saved.fixed); setEquip(saved.equip); setReserveIn(saved.reserveIn); setCash(saved.cash); setSubsidy(saved.subsidy); setWatch(saved.watch);
    setAutoIn(saved.autoIn); setAutoAcct(saved.autoAcct); setAutoOn(saved.autoOn); setTekiyo(saved.tekiyo);
  };
  const reset = () => { setFixed(DEFAULTS.fixed); setEquip(DEFAULTS.equip); setReserveIn(DEFAULTS.reserveIn); setCash(DEFAULTS.cash); setSubsidy(DEFAULTS.subsidy); setAutoIn(DEFAULTS.autoIn); setAutoAcct(DEFAULTS.autoAcct); toast.show('デフォルト設定に戻しました（未保存）'); };
  const go = (p: string) => (onNavigate ? onNavigate(p) : toast.show(`「${p}」を開きます（プロトタイプ）`));
  const cols3 = { padding: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' } as const;
  return (
    <SettingsShell variant={variant} title="減価償却との連動設定" badge="マスター設定" draft={false} desc="会計の仕訳と減価償却をつなぐ設定です。固定資産の取得・備品購入の仕訳を減価償却へ連動させる科目、借入元金償還補助の仕訳を認識する科目、国庫補助金等特別積立金を自動で積み立てる仕訳の科目を指定します。" unsaved={dirty} actions={<>
      <button type="button" className="btn-outline" onClick={reset} style={btn()}>デフォルト設定にする</button>
      {dirty && <span role="status" data-unsaved-msg style={{ fontSize: 15, fontWeight: 800, color: UNSAVED_FG, marginRight: 4 }}>保存されていません。</span>}
      <button type="button" data-action="変更を取り消す" onClick={revert} disabled={!dirty} title={dirty ? '保存する前の内容に戻します（すべてのタブ）' : '変更はありません'} style={{ ...btn(), opacity: dirty ? 1 : 0.5, cursor: dirty ? 'pointer' : 'default' }}>変更を取り消す</button>
      <button type="button" className="submit-btn" data-action="設定を保存" onClick={save} title="すべてのタブの内容をまとめて保存します" style={btn(accent, true)}>OK（保存）</button>
    </>}>
      <ToastView msg={toast.msg} />
      <Tabs items={TABS_D} current={tab} onChange={setTab} accent={accent} marks={dirtyTabs} />
      {otherDirty.length > 0 && (
        <div data-other-unsaved style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 22px', background: '#fff1d6', borderBottom: '1px solid #f0d9a8', fontSize: 14, color: '#8a5a00', flexWrap: 'wrap' }}>
          <span>ほかのタブにも保存されていない変更があります：</span>
          {otherDirty.map((t) => <button key={t} type="button" onClick={() => setTab(t)} style={{ border: 'none', background: 'transparent', padding: 0, color: '#8a5a00', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>{t}</button>)}
          <span style={{ color: '#a27a2c' }}>「OK（保存）」で、すべてのタブをまとめて保存します。</span>
        </div>
      )}
      <ScopeBar scope="全区分共通" note="法人全体で共有" right={<><button type="button" className="btn-outline" onClick={() => go('勘定科目')} style={btn('#5b6773', false, true)}>科目設定で確認 →</button><button type="button" className="btn-outline" onClick={() => go('減価償却')} style={btn('#5b6773', false, true)}>減価償却を開く →</button></>}>
        ここで指定した科目は、科目設定の各科目にある「減価償却連動」と同じ設定です。どちらで変更しても同じ内容になります。
      </ScopeBar>

      {tab === '固定資産科目の連動' && (
        <div style={cols3}>
          <PickList title="固定資産科目" items={FIXED_ITEMS} value={fixed} onChange={setFixed} saved={saved.fixed} height={300} note="これらの科目を借方にした仕訳は、減価償却の「移管・取込み」に資産候補として表示されます。" />
          <PickList title="備品科目" items={EQUIP_ITEMS} value={equip} onChange={setEquip} saved={saved.equip} height={300} note="10 万円未満の備品の購入を減価償却の「備品台帳」へ連動させる科目です。" />
          <div style={{ display: 'grid', gap: 12 }}>
            <PickList title="国庫補助金等特別積立金積立額" items={RESERVE_IN_ITEMS.filter((i) => /積立額$/.test(i.name))} value={reserveIn} onChange={setReserveIn} saved={saved.reserveIn} height={120} />
            <Notice>連動の対象となる仕訳は、伝票入力の「取引種別」に「償却」の印が付きます。連動を解除しても登録済みの資産は消えません。</Notice>
          </div>
        </div>
      )}

      {tab === '借入元金償還補助の連動' && (
        <div style={cols3}>
          <PickList title="補助金収入を受ける流動資産の科目" items={CASH_ITEMS} value={cash} onChange={setCash} saved={saved.cash} height={300} />
          <PickList title="設備資金借入金元金償還補助金収益の科目" items={SUBSIDY_INCOME_ITEMS} value={subsidy} onChange={setSubsidy} saved={saved.subsidy} height={300} />
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={card}><div style={cardHead}>監視</div><div style={{ padding: 14, display: 'grid', gap: 10 }}>
              <div data-changed={ch('watch') || undefined} style={changedBox(ch('watch'))}><Toggle on={watch} onChange={setWatch} accent={accent} label="伝票入力時に監視（機能を有効に）する" /></div>
              <div style={{ fontSize: 14, color: '#7a8794' }}>左の 2 つの科目を組み合わせた仕訳を登録すると、減価償却の「補助金」に償還補助金として記録するか確認します。</div>
            </div></div>
            <Notice>借入金元金償還補助金は、国庫補助金等特別積立金の積立の対象になります。積立の仕訳を自動で起こす場合は、次のタブで設定します。</Notice>
          </div>
        </div>
      )}

      {tab === '国庫補助金等特別積立金の自動積立' && (
        <div style={cols3}>
          <PickList title="国庫補助金等特別積立金積立額の科目" items={RESERVE_IN_ITEMS} value={autoIn} onChange={setAutoIn} saved={saved.autoIn} height={260} />
          <PickList title="国庫補助金等特別積立金の科目" items={RESERVE_ACCT_ITEMS} value={autoAcct} onChange={setAutoAcct} saved={saved.autoAcct} height={120} />
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={card}><div style={cardHead}>自動積立</div><div style={{ padding: 14, display: 'grid', gap: 10 }}>
              <div data-changed={ch('autoOn') || undefined} style={changedBox(ch('autoOn'))}><Toggle on={autoOn} onChange={setAutoOn} accent={accent} label="自動積立機能を有効とする" /></div>
              {/* 摘要は「自動積立機能を有効とする」とは独立して入力できる（現行と同じ。確認メモ #228） */}
              <Field label="自動で起こす仕訳の摘要"><input className="field-input" value={tekiyo} onChange={(e) => setTekiyo(e.target.value)} data-changed={ch('tekiyo') || undefined} style={{ ...input, ...(ch('tekiyo') ? { background: CHANGED_BG, border: '1px solid ' + CHANGED_BORDER } : {}) }} /></Field>
              <div style={{ fontSize: 14, color: '#7a8794' }}>有効にすると、補助金で取得した資産の登録時に「{RESERVE_IN_ITEMS.find((i) => autoIn.includes(i.code))?.name ?? '積立額の科目'} ／ {RESERVE_ACCT_ITEMS[0].name}」の仕訳を自動で作成します。</div>
            </div></div>
            <div style={{ fontSize: 12, color: '#7a8794', padding: '0 4px' }}><span style={lbl}>補足</span>自動で作成した仕訳は日記帳に「自動」の印が付き、通常の仕訳と同じように訂正・削除できます。</div>
          </div>
        </div>
      )}
    </SettingsShell>
  );
}
