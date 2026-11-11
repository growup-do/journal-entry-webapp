// 設定メニュー「マスター設定／保守・運用」の追加画面（依頼書 2.3・5.1.2・5.5.6・6.3・6.4、図16〜19・図52）
//   財務分析設定（マニュアル 8.1）／決算チェック設定（図52）／パスワード（4.1）／仕訳更新（5.6）／データのバックアップ・復元（4.4、図19）
//   どの画面も「全区分共通」か「この区分のみ」かを見出しの下に明示する（6.3）。
//   取り消せない操作（復元）は他の操作と分けて置き、確認の流れを挟む（6.4）。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { ExplainModal } from './ExplainModal';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { Field, Notice, SettingsShell, Steps, Tabs, Toggle, btn, card, cardHead, input, lbl, numInput } from './ui';
import { ACCOUNT_META } from '../lib/accounts';
import { AUDIT_ITEMS, SERVICES, displayName } from '../data';
import { isViewOnly, setSession, useSession } from '../store/session';
import { CHANGED_BG, UNSAVED_FG, useUnsaved } from '../store/unsaved';
import { AuditChecklist, AuditItemDialog } from './AuditItemDialog';

export interface MaintenancePageProps { variant: 'form' | 'sheet'; accent: string; /** 関連画面へ移動する（未指定のときは案内のみ表示） */ onNavigate?: (page: string) => void }

/* ======================================================================
 * 共通部品
 * ==================================================================== */
export type Scope = '全区分共通' | 'この区分のみ';
/** 設定の適用範囲バッジ（依頼書 6.3） */
export function ScopeBadge({ scope, note }: { scope: Scope; note?: string }) {
  const c = scope === '全区分共通' ? { bg: '#e8f0fb', fg: '#2c5f9e', bd: '#c5d8f2', mark: '◎' } : { bg: '#fff1d6', fg: '#8a5a00', bd: '#f0d9a8', mark: '●' };
  return (
    <span title={scope === '全区分共通' ? '法人内のすべての区分に同じ内容が適用されます' : '起動中の区分だけに適用されます（他の区分には影響しません）'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 800, padding: '2px 9px', borderRadius: 10, background: c.bg, color: c.fg, border: '1px solid ' + c.bd, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
      <span aria-hidden style={{ fontSize: 12 }}>{c.mark}</span>{scope}{note && <span style={{ fontWeight: 600 }}>（{note}）</span>}
    </span>
  );
}
/** 見出し直下の「適用範囲」帯 */
export function ScopeBar({ scope, note, children, right }: { scope: Scope; note?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 22px', background: '#fafbfc', borderBottom: '1px solid #eef2f5', fontSize: 14, color: '#48565f', flexWrap: 'wrap' }}>
      <ScopeBadge scope={scope} note={note} />
      <span style={{ lineHeight: 1.6 }}>{children}</span>
      {right && <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>{right}</span>}
    </div>
  );
}
/** 日本語変換の確定 Enter を無視して、Enter で実行する */
const onEnter = (fn: () => void) => (e: ReactKeyboardEvent<HTMLElement>) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); fn(); } };
const digits = (v: string) => v.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[^0-9]/g, '');
/** 和暦の日時表示（依頼書 6.5） */
const warekiNow = () => { const d = new Date(); return `令和${d.getFullYear() - 2018}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/** 進行状況の表示用（プロトタイプ：時間経過で 0→100%） */
function useProgress() {
  const [p, setP] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; window.clearInterval(timer.current); }; }, []);
  const start = (ms: number, done: () => void) => {
    window.clearInterval(timer.current);
    setP(0);
    const t0 = Date.now();
    timer.current = window.setInterval(() => {
      const v = Math.min(100, Math.round(((Date.now() - t0) / ms) * 100));
      setP(v);
      if (v >= 100) { window.clearInterval(timer.current); window.setTimeout(() => { if (!alive.current) return; setP(null); done(); }, 350); }
    }, 80);
  };
  return { p, running: p != null, start };
}
function ProgressBar({ value, accent, height = 12 }: { value: number; accent: string; height?: number }) {
  return <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} style={{ height, background: '#eef2f5', borderRadius: height / 2, overflow: 'hidden' }}><div style={{ width: `${value}%`, height: '100%', background: accent, transition: 'width .1s' }} /></div>;
}
/** changed：保存済みの値と違うとき、入力欄を仕訳入力の入力可能枠と同じ黄色にする（確認メモ #224） */
function Stepper({ value, onChange, unit, label, changed = false }: { value: number; onChange: (n: number) => void; unit: string; label: string; changed?: boolean }) {
  const sb: CSSProperties = { width: 34, height: 34, border: '1px solid #cfd8e0', background: '#fff', borderRadius: 8, fontSize: 16, fontWeight: 700, color: '#48565f', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button type="button" aria-label={`${label}を1減らす`} onClick={() => onChange(Math.max(0, value - 1))} style={sb}>−</button>
      <input className="field-input ring" aria-label={label} inputMode="numeric" value={String(value)} onChange={(e) => onChange(Math.min(9999, parseInt(digits(e.target.value) || '0', 10)))} data-changed={changed || undefined} style={{ ...numInput, width: 84, fontSize: 16, fontWeight: 700, background: changed ? CHANGED_BG : '#fff', border: '1px solid ' + (changed ? '#d4a72c' : '#cfd8e0') }} />
      <button type="button" aria-label={`${label}を1増やす`} onClick={() => onChange(Math.min(9999, value + 1))} style={sb}>＋</button>
      <span style={{ fontSize: 14, color: '#7a8794' }}>{unit}</span>
    </div>
  );
}
const radioRow = (on: boolean, accent: string): CSSProperties => ({ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', border: '1px solid ' + (on ? accent : '#dde4ea'), borderRadius: 10, background: on ? '#f7fbf9' : '#fff', cursor: 'pointer', fontSize: 14, lineHeight: 1.6 });
const sub: CSSProperties = { fontSize: 12, color: '#7a8794' };

/* ======================================================================
 * 財務分析設定（マニュアル 8.1）：財務分析科目設定／人数設定
 *   指標は現行システムと同じ 5 分類 28 指標（確認メモ #222）。名称・並び・算式・要素（①②③）の見出し・注記を現行に合わせている。
 *   科目はプロトタイプのサンプル科目。標準のチェックは算式と見出しに沿って決めたもので、現行の利用者の設定を写したものではない。
 *   人数設定は、変更した欄を黄色にし、保存するまで「保存されていません。」を出す（確認メモ #224）。
 * ==================================================================== */
type FaCat = '成長性' | '安全性' | '健全性' | '効率性' | 'その他';
/** 科目の区分（要素ごとのリストに並べる科目を決める） */
type FaGrp = '流動資産' | '固定資産' | '流動負債' | '固定負債' | '純資産' | '収益' | '費用' | 'その他の活動支出';
const FA_CATS: { cat: FaCat; note: string }[] = [
  { cat: '成長性', note: '収入・支出・資産が前年度からどれだけ伸びたか' },
  { cat: '安全性', note: '支払能力・財政の安定度' },
  { cat: '健全性', note: '収支のバランス・収入に対する費用の割合' },
  { cat: '効率性', note: '人件費・職員 1 人に対する収入の大きさ' },
  { cat: 'その他', note: '園児 1 人当たりの指標、資金・積立金の割合など' },
];
/** カテゴリの色（確認メモ #223）。カテゴリは色つきの帯と大きい文字、項目は字下げした通常の文字で区別する */
const FA_CAT_COLOR: Record<FaCat, { fg: string; bg: string }> = {
  成長性: { fg: '#1e6b3a', bg: '#e3f3e8' },
  安全性: { fg: '#1d4f91', bg: '#e3edfb' },
  健全性: { fg: '#6b3fa0', bg: '#efe8f9' },
  効率性: { fg: '#8a5200', bg: '#fcefd8' },
  その他: { fg: '#46525e', bg: '#e9edf1' },
};
/** fund は資金収支計算書での科目名（〜収入・〜支出）。資金の動きがない科目（減価償却費など）は持たない */
interface FaAccount { name: string; code: string; grp: FaGrp; fund?: string }
const FA_ACCOUNT_SRC: FaAccount[] = [
  // 入力用の「現金（収入）」は分析の対象にしない
  ...ACCOUNT_META.filter((m) => m.name !== '現金（収入）').map((m): FaAccount => {
    const grp: FaGrp = m.cls === '収益' ? '収益' : m.cls === '費用' ? '費用' : m.code < '1500' ? '流動資産' : '固定資産';
    return { name: m.name, code: m.code, grp, fund: grp === '収益' || grp === '費用' ? m.fund : undefined };
  }),
  { name: '建物減価償却累計額', code: '1610', grp: '固定資産' }, { name: '器具及び備品減価償却累計額', code: '1620', grp: '固定資産' },
  { name: '退職給付引当資産', code: '1710', grp: '固定資産' }, { name: '人件費積立資産', code: '1720', grp: '固定資産' }, { name: '保育所施設・設備整備積立資産', code: '1730', grp: '固定資産' },
  { name: '事業未払金', code: '2110', grp: '流動負債' }, { name: '職員預り金', code: '2120', grp: '流動負債' }, { name: '1年以内返済予定設備資金借入金', code: '2130', grp: '流動負債' },
  { name: '設備資金借入金', code: '2510', grp: '固定負債' }, { name: '退職給付引当金', code: '2520', grp: '固定負債' },
  { name: '基本金', code: '3110', grp: '純資産' }, { name: '国庫補助金等特別積立金', code: '3210', grp: '純資産' }, { name: '人件費積立金', code: '3310', grp: '純資産' }, { name: '保育所施設・設備整備積立金', code: '3320', grp: '純資産' }, { name: '次期繰越活動増減差額', code: '3910', grp: '純資産' },
  { name: '私的契約利用料収益', code: '4160', grp: '収益', fund: '私的契約利用料収入' }, { name: '雑収益', code: '4170', grp: '収益', fund: '雑収入' }, { name: '受取利息配当金収益', code: '4210', grp: '収益', fund: '受取利息配当金収入' },
  { name: '非常勤職員給与', code: '5180', grp: '費用', fund: '非常勤職員給与支出' }, { name: '退職給付費用', code: '5190', grp: '費用', fund: '退職給付支出' },
  { name: '福利厚生費', code: '5310', grp: '費用', fund: '福利厚生費支出' }, { name: '旅費交通費', code: '5320', grp: '費用', fund: '旅費交通費支出' }, { name: '事務消耗品費', code: '5330', grp: '費用', fund: '事務消耗品費支出' }, { name: '業務委託費', code: '5340', grp: '費用', fund: '業務委託費支出' },
  { name: '減価償却費', code: '5390', grp: '費用' }, { name: '支払利息', code: '5410', grp: '費用', fund: '支払利息支出' },
  { name: '長期運営資金借入金元金償還支出', code: '6010', grp: 'その他の活動支出' }, { name: '退職給付引当資産支出', code: '6110', grp: 'その他の活動支出' }, { name: '人件費積立資産支出', code: '6120', grp: 'その他の活動支出' }, { name: '保育所施設・設備整備積立資産支出', code: '6130', grp: 'その他の活動支出' },
];
/** コード順（流動資産 → 固定資産 → 負債 → 純資産 → 収益 → 費用 → その他の活動支出） */
const FA_ACCOUNTS = [...FA_ACCOUNT_SRC].sort((a, b) => a.code.localeCompare(b.code));

type FaPick = (a: FaAccount) => boolean;
/** 科目を選ぶ要素。
 *   mark は算式の番号。「①③」「①②」のように 2 つ並べると、その番号が同じ科目指定を共有する（shared に共有の説明を書く）。
 *   scope はリストに並べる科目、pick は標準でチェックする科目。fund を付けると資金収支の科目名（〜収入・〜支出）で表示する */
interface FaList { kind: 'list'; mark: string; title: string; caution?: string; shared?: string; scope: FaPick; pick: FaPick; fund?: boolean; note?: string }
/** 科目を選ばない要素。staff＝専任職員数、kids＝園児数（どちらも人数設定の値）、auto＝帳票から自動で集計する値 */
interface FaValue { kind: 'staff' | 'kids' | 'auto'; mark: string; title: string; desc?: string }
type FaPart = FaList | FaValue;
/** formula は算式の右辺（画面では「指標名 ＝ 右辺」と表示する） */
interface FaDef { cat: FaCat; name: string; formula: string; parts: FaPart[]; guide: string }

const grpIn = (...g: FaGrp[]): FaPick => (a) => g.includes(a.grp);
const anyOf = (...f: FaPick[]): FaPick => (a) => f.some((x) => x(a));
const all: FaPick = () => true;
const isCurrent = grpIn('流動資産'), isFixed = grpIn('固定資産'), isAssets = grpIn('流動資産', '固定資産');
const isCurLiab = grpIn('流動負債'), isFixLiab = grpIn('固定負債'), isNet = grpIn('純資産');
const isRev = grpIn('収益'), isExp = grpIn('費用'), isOtherOut = grpIn('その他の活動支出');
/** 資金収支に出る費用（減価償却費などを除く） */
const isFundExp: FaPick = (a) => a.grp === '費用' && !!a.fund;
const isCash: FaPick = (a) => a.grp === '流動資産' && /現金|預金/.test(a.name);
/** その他の積立金（純資産の部。国庫補助金等特別積立金は含めない） */
const isReserve: FaPick = (a) => a.grp === '純資産' && /積立金$/.test(a.name) && !/国庫補助金/.test(a.name);
const isJinken: FaPick = (a) => a.grp === '費用' && /俸給|手当|法定福利|非常勤|退職給付/.test(a.name);
const isJimu: FaPick = (a) => a.grp === '費用' && /福利厚生|旅費交通|事務消耗品|業務委託|通信運搬|印刷製本/.test(a.name);
const isJigyo: FaPick = (a) => a.grp === '費用' && /保育材料|給食|水道光熱|賃借料|^消耗品/.test(a.name);
/** 保育所基礎収入：運営費（委託費）、事業活動経費補助金、私的契約利用料、雑収入 */
const isKiso: FaPick = (a) => a.grp === '収益' && /委託費|補助金|私的契約|雑収益/.test(a.name);
const isKihon: FaPick = (a) => a.grp === '収益' && /委託費/.test(a.name);
const isSvcRev: FaPick = (a) => a.grp === '収益' && !/受取利息|雑収益/.test(a.name);
const isSvcExp: FaPick = (a) => a.grp === '費用' && !/支払利息/.test(a.name);

const lst = (mark: string, title: string, scope: FaPick, pick: FaPick = all, opt: Partial<FaList> = {}): FaList => ({ kind: 'list', mark, title, scope, pick, ...opt });
const NOTE_KISO = '運営費、事業活動経費補助金、私的契約利用料、雑収入の基本４項目の科目を指定します。';
const SHARED_YEAR = '① 当年度と ② 前年度は、同じ科目指定で集計します。';
const CAUTION_FIXED = '積立預金は外してください', CAUTION_NET = 'その他の積立金は外してください';
/** よく使う要素 */
const pIncome = (mark: string) => lst(mark, '事業活動収入', isRev, all, { fund: true });
const pKiso = (mark: string, opt: Partial<FaList> = {}) => lst(mark, '保育所基礎収入', isRev, isKiso, { fund: true, ...opt });
const pKihon = (mark: string) => lst(mark, '基本収入', isRev, isKihon, { fund: true });
const pJinken = (mark: string) => lst(mark, '人件費', isFundExp, isJinken, { fund: true });
const pFixedNoReserve = (mark: string) => lst(mark, '固定資産', isFixed, (a) => !/積立資産/.test(a.name), { caution: CAUTION_FIXED });
const pNetNoReserve = (mark: string) => lst(mark, '純資産', isNet, (a) => !isReserve(a), { caution: CAUTION_NET });
const pStaff = (mark: string): FaValue => ({ kind: 'staff', mark, title: '専任職員数' });
const pKids = (mark: string): FaValue => ({ kind: 'kids', mark, title: '園児数' });

const FA_DEFS: FaDef[] = [
  /* ---- 成長性（4） ---- */
  { cat: '成長性', name: '保育所基礎収入伸長率', formula: '①当年度保育所基礎収入 ÷ ②前年度保育所基礎収入', parts: [lst('①②', '保育所基礎収入', isRev, isKiso, { shared: SHARED_YEAR, note: NOTE_KISO })], guide: '保育所の基礎となる収入（運営費に当たる委託費、事業活動経費補助金、私的契約利用料、雑収入）の科目を選びます。当年度と前年度は同じ科目指定で集計し、前年度の金額は「残高（繰越・前年実績）」の前年実績を使います。' },
  { cat: '成長性', name: '保育所基礎支出伸長率', formula: '①当年度保育所基礎支出 ÷ ②前年度保育所基礎支出', parts: [lst('①②', '保育所基礎支出', isExp, anyOf(isJinken, isJimu, isJigyo), { shared: SHARED_YEAR, note: '人件費、事務費、事業費の基本３項目の科目を指定します。' })], guide: '人件費・事務費・事業費の科目を選びます。減価償却費や支払利息など、基本３項目に当たらない科目は外します。当年度と前年度は同じ科目指定で集計します。' },
  { cat: '成長性', name: '総資産増加率', formula: '①当年度総資産 ÷ ②前年度総資産', parts: [lst('①②', '総資産', isAssets, all, { shared: SHARED_YEAR })], guide: '資産の部（流動資産・固定資産）のすべての科目を選ぶのが標準です。前年度の金額は前年度末の残高を使います。' },
  { cat: '成長性', name: '純資産増加率', formula: '①当年度純資産 ÷ ②前年度純資産', parts: [lst('①②', '純資産', isNet, all, { shared: SHARED_YEAR })], guide: '純資産の部（基本金、国庫補助金等特別積立金、その他の積立金、次期繰越活動増減差額）のすべての科目を選ぶのが標準です。' },
  /* ---- 安全性（7） ---- */
  { cat: '安全性', name: '流動比率', formula: '①流動資産 ÷ ②流動負債', parts: [lst('①', '流動資産', isCurrent), lst('②', '流動負債', isCurLiab)], guide: '1 年以内に現金化できる資産と、1 年以内に支払う負債の割合です。1 年基準で振り替えた借入金は ② に含めます。' },
  { cat: '安全性', name: '現金預金比率', formula: '①現金・預金 ÷ ②流動負債', parts: [lst('①', '現金・預金', isCash), lst('②', '流動負債', isCurLiab)], guide: '① には現金と預金の科目だけが並びます。小口現金を含めるかどうかは法人の方針に合わせてください。' },
  { cat: '安全性', name: '固定比率', formula: '①固定資産 ÷ ②純資産', parts: [pFixedNoReserve('①'), pNetNoReserve('②')], guide: '固定資産が純資産でどれだけまかなわれているかを見ます。① は積立資産（積立預金）を、② はその他の積立金を外すのが標準です。' },
  { cat: '安全性', name: '減価償却累計比率', formula: '①償却累計額 ÷ （②期末償却資産 ＋ ③償却累計額）', parts: [lst('①③', '償却累計額', isFixed, (a) => /減価償却累計額/.test(a.name), { shared: '① と ③ は、同じ科目指定を使います。' }), lst('②', '期末償却資産', isFixed, (a) => /^(建物|器具及び備品|ソフトウェア)$/.test(a.name))], guide: '償却資産について、償却がどれだけ進んだかを見ます。①③ に各資産の減価償却累計額、② に期末の償却資産（建物、器具及び備品など）を選びます。土地などの償却しない資産は選びません。' },
  { cat: '安全性', name: '固定長期適合率', formula: '①固定資産 ÷ （②純資産 ＋ ③固定負債）', parts: [pFixedNoReserve('①'), pNetNoReserve('②'), lst('③', '固定負債', isFixLiab)], guide: '固定資産が、純資産と長期の負債でどれだけまかなわれているかを見ます。① と ② の選び方は「固定比率」と同じです。' },
  { cat: '安全性', name: '固定負債比率', formula: '①固定負債 ÷ ②総資産', parts: [lst('①', '固定負債', isFixLiab), lst('②', '総資産', isAssets)], guide: '総資産に対する固定負債（設備資金借入金、退職給付引当金など）の割合です。' },
  { cat: '安全性', name: '純資産比率', formula: '①純資産 ÷ ②総資産', parts: [lst('①', '純資産', isNet), lst('②', '総資産', isAssets)], guide: '基本金・国庫補助金等特別積立金・その他の積立金・次期繰越活動増減差額を ① に選びます。' },
  /* ---- 健全性（8） ---- */
  { cat: '健全性', name: 'サービス活動増減差額比率', formula: '①サービス活動増減差額 ÷ ②サービス活動収益', parts: [lst('①', 'サービス活動増減差額', anyOf(isRev, isExp), anyOf(isSvcRev, isSvcExp), { note: '収益と費用を 1 つのリストで選びます。選んだ収益の合計から費用の合計を差し引いた額を使います。' }), lst('②', 'サービス活動収益', isRev, isSvcRev)], guide: '事業活動計算書のサービス活動増減の部の科目を選びます。サービス活動外（受取利息配当金収益、支払利息など）と特別増減の部の科目は含めません。' },
  { cat: '健全性', name: '事業活動収支差額比率', formula: '①事業活動資金収支差額 ÷ ②事業活動収入', parts: [lst('①', '事業活動資金収支差額', anyOf(isRev, isFundExp), all, { fund: true, note: '収入と支出を 1 つのリストで選びます。選んだ収入の合計から支出の合計を差し引いた額を使います。' }), pIncome('②')], guide: '資金収支計算書の「事業活動による収支」の科目を選びます。施設整備等・その他の活動の科目は含めません。' },
  { cat: '健全性', name: '基本収入比率', formula: '①基本収入 ÷ ②事業活動収入', parts: [pKihon('①'), pIncome('②')], guide: '委託費収入（施設型給付費収入）など、制度上の基本となる収入を ① に選びます。' },
  { cat: '健全性', name: '事業活動経費補助金収入比率', formula: '①事業活動経費補助金収入 ÷ ②事業活動収入', parts: [lst('①', '事業活動経費補助金収入', isRev, (a) => /補助金/.test(a.name), { fund: true }), pIncome('②')], guide: '延長保育・一時保育など、事業活動の経費に充てる補助金の収入を ① に選びます。' },
  { cat: '健全性', name: '人件費比率', formula: '（①人件費 ＋ ②預け金） ÷ ③事業活動収入', parts: [pJinken('①'), lst('②', '退職共済掛金預け金に対する資金科目', isOtherOut, (a) => /退職給付引当資産支出/.test(a.name), { note: '退職共済の掛金を預け金（資産）として支出している場合に、その支出の科目を指定します。' }), pIncome('③')], guide: '① に職員俸給・諸手当・法定福利費・非常勤職員給与などの人件費、② に退職共済掛金の預け金に当たる資金科目、③ に事業活動収入の科目を選びます。' },
  { cat: '健全性', name: '事務費比率', formula: '①事務費 ÷ ②事業活動収入', parts: [lst('①', '事務費', isFundExp, isJimu, { fund: true }), pIncome('②')], guide: '事務費に区分している科目（福利厚生費、旅費交通費、通信運搬費など）を ① に選びます。' },
  { cat: '健全性', name: '事業費比率', formula: '①事業費 ÷ ②事業活動収入', parts: [lst('①', '事業費', isFundExp, isJigyo, { fund: true }), pIncome('②')], guide: '事業費に区分している科目（給食費、保育材料費、水道光熱費など）を ① に選びます。' },
  { cat: '健全性', name: '積立金支出比率', formula: '①積立金支出 ÷ ②事業活動収入', parts: [lst('①', '積立金支出', isOtherOut, (a) => /積立資産支出/.test(a.name)), pIncome('②')], guide: '「その他の活動による支出」のうち、積立資産への支出の科目を ① に選びます。借入金の償還支出などは含めません。' },
  /* ---- 効率性（2） ---- */
  { cat: '効率性', name: '労働生産性', formula: '①保育所基礎収入 ÷ ②人件費', parts: [pKiso('①', { note: NOTE_KISO }), pJinken('②')], guide: '人件費に対して、保育所の基礎となる収入がどれだけあるかを見ます。' },
  { cat: '効率性', name: '職員１人当たり保育所基礎収入', formula: '①保育所基礎収入 ÷ ②専任職員数', parts: [pKiso('①'), pStaff('②')], guide: '① に保育所基礎収入の科目を選びます。② の専任職員数は科目ではなく、「人数設定」タブで入力した人数を使います。' },
  /* ---- その他（7） ---- */
  { cat: 'その他', name: '園児１人当たり基本収入', formula: '①基本収入 ÷ ②園児数', parts: [pKihon('①'), pKids('②')], guide: '① に基本収入の科目を選びます。② の園児数は科目ではなく、「人数設定」タブで入力した年齢ごとの児童数の合計を使います。' },
  { cat: 'その他', name: '園児１人当たり保育所基礎収入', formula: '①保育所基礎収入 ÷ ②園児数', parts: [pKiso('①'), pKids('②')], guide: '① に保育所基礎収入の科目を選びます。② の園児数は科目ではなく、「人数設定」タブで入力した年齢ごとの児童数の合計を使います。' },
  { cat: 'その他', name: '園児１人当たり人件費', formula: '①人件費 ÷ ②園児数', parts: [pJinken('①'), pKids('②')], guide: '① に人件費の科目を選びます。② の園児数は科目ではなく、「人数設定」タブで入力した年齢ごとの児童数の合計を使います。' },
  { cat: 'その他', name: '非常勤職員人件費比率', formula: '①非常勤職員人件費 ÷ ②（職員俸給 ＋ 職員諸手当 ＋ 非常勤職員給与）', parts: [lst('①', '非常勤職員人件費', isFundExp, (a) => /非常勤/.test(a.name), { fund: true }), lst('②', '職員俸給、職員諸手当、非常勤職員給与', isFundExp, (a) => /俸給|手当|非常勤/.test(a.name), { fund: true })], guide: '① に非常勤職員給与、② に職員俸給・職員諸手当・非常勤職員給与を選びます。法定福利費と退職給付は ② に含めません。' },
  { cat: 'その他', name: '支払資金残高率', formula: '①期末支払資金残高 ÷ ②基本収入', parts: [{ kind: 'auto', mark: '①', title: '期末支払資金残高', desc: '科目は選びません。資金収支計算書の「当期末支払資金残高」を使います。' }, pKihon('②')], guide: '① の期末支払資金残高は帳票から自動で集計します。② に基本収入の科目を選びます。' },
  { cat: 'その他', name: '当期資金収支差額率', formula: '（①積立支出 ＋ ②当期資金収支差額） ÷ ③事業活動収入', parts: [lst('①', '積立支出', isOtherOut, (a) => /積立資産支出/.test(a.name)), { kind: 'auto', mark: '②', title: '当期資金収支差額', desc: '科目は選びません。資金収支計算書の「当期資金収支差額合計」を使います。' }, pIncome('③')], guide: '① に積立資産への支出の科目、③ に事業活動収入の科目を選びます。② の当期資金収支差額は帳票から自動で集計します。' },
  { cat: 'その他', name: '積立金比率', formula: '①積立金 ÷ ②事業活動収入', parts: [lst('①', '積立金', isReserve), pIncome('②')], guide: '① には純資産の部のその他の積立金（人件費積立金、保育所施設・設備整備積立金など）だけが並びます。' },
];
const faKey = (name: string, i: number) => `${name}#${i}`;
/** 指標の、科目を選ぶ要素のキー */
const faKeys = (d: FaDef) => d.parts.flatMap((p, i) => (p.kind === 'list' ? [faKey(d.name, i)] : []));
const faStd = (p: FaList) => FA_ACCOUNTS.filter((a) => p.scope(a) && p.pick(a)).map((a) => a.name);
const faDefault = (): Record<string, string[]> => Object.fromEntries(FA_DEFS.flatMap((d) => d.parts.flatMap((p, i) => (p.kind === 'list' ? [[faKey(d.name, i), faStd(p)]] : []))));
const AGES = ['0歳児', '1歳児', '2歳児', '3歳児', '4歳児', '5歳児'];
/** 未保存の案内の文字色（濃い橙） */

export function FinancialAnalysisSettingsPage({ variant, accent, onNavigate }: MaintenancePageProps) {
  const s = useSession();
  const toast = useToast();
  const [tab, setTab] = useState('財務分析科目設定');
  const [cur, setCur] = useState('流動比率');
  const [picked, setPicked] = useState<Record<string, string[]>>(faDefault);
  const [saved, setSaved] = useState<Record<string, string[]>>(faDefault);
  const [q, setQ] = useState('');
  const [guide, setGuide] = useState(false);
  // 人数設定：保存済みの値と、編集中の値を分けて持つ（確認メモ #224）
  const [savedStaff, setSavedStaff] = useState(18);
  const [savedKids, setSavedKids] = useState<number[]>([9, 15, 18, 20, 20, 20]);
  const [staff, setStaff] = useState(18);
  const [kids, setKids] = useState<number[]>([9, 15, 18, 20, 20, 20]);
  const def = FA_DEFS.find((d) => d.name === cur) ?? FA_DEFS[0];
  const dirty = (d: FaDef) => faKeys(d).some((k) => (picked[k] ?? []).join('|') !== (saved[k] ?? []).join('|'));
  const toggle = (k: string, name: string) => setPicked((p) => { const set = new Set(p[k] ?? []); if (set.has(name)) set.delete(name); else set.add(name); return { ...p, [k]: FA_ACCOUNTS.filter((a) => set.has(a.name)).map((a) => a.name) }; });
  const kidsTotal = kids.reduce((a, b) => a + b, 0);
  const go = (page: string) => (onNavigate ? onNavigate(page) : toast.show(`メニューの「${displayName(page)}」から開きます`));

  // 未保存の状態（確認メモ #224）：人数設定と、指標の対象科目の両方を見る
  const staffDirty = staff !== savedStaff;
  const kidsDirty = kids.map((v, i) => v !== savedKids[i]);
  const kidsAnyDirty = kidsDirty.some(Boolean);
  const headDirty = staffDirty || kidsAnyDirty;
  const pickDirtyCount = FA_DEFS.filter(dirty).length;
  const anyDirty = headDirty || pickDirtyCount > 0;
  useUnsaved('財務分析設定', headDirty && pickDirtyCount ? '財務分析設定の人数設定・対象科目' : headDirty ? '財務分析設定の人数設定' : '財務分析設定の対象科目', anyDirty);
  // いま見ていないタブに未保存の変更があるときの案内
  const other = tab === '財務分析科目設定'
    ? (headDirty ? { text: '「人数設定」に、保存されていない変更があります。', to: '人数設定' } : null)
    : (pickDirtyCount ? { text: `「財務分析科目設定」に、保存されていない変更があります（${pickDirtyCount} 項目）。`, to: '財務分析科目設定' } : null);

  return (
    <SettingsShell variant={variant} title="財務分析設定" badge="マスター設定" desc="経年グラフ・分析グラフ・経営分析の帳票で使う指標について、計算に含める科目と、職員・園児の人数を設定します。" unsaved={anyDirty}>
      <ToastView msg={toast.msg} />
      <Tabs items={['財務分析科目設定', '人数設定']} current={tab} onChange={setTab} accent={accent} />
      {other && (
        <div data-fa-other-unsaved style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 22px', background: '#fff1d6', borderBottom: '1px solid #f0d9a8', fontSize: 14, color: '#8a5a00', flexWrap: 'wrap' }}>
          <b>{other.text}</b>
          <button type="button" onClick={() => setTab(other.to)} style={btn('#8a5a00', false, true)}>{other.to}を開く</button>
        </div>
      )}

      {tab === '財務分析科目設定' && (
        <>
          <ScopeBar scope="全区分共通" note="法人全体で共有" right={<><button type="button" className="btn-outline" onClick={() => go('分析グラフ')} style={btn('#5b6773', false, true)}>分析グラフで確認 →</button></>}>
            指標ごとの対象科目は、法人内のすべての区分で同じ設定を使います。
          </ScopeBar>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)', minHeight: 520 }}>
            {/* 指標の一覧（分野別） */}
            <div style={{ borderRight: '1px solid #eef2f5', padding: '0 0 12px', overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
              {/* 見方：カテゴリ（色つきの帯・大きい文字）と項目（字下げ・通常の文字）。確認メモ #223 */}
              <div data-fa-legend style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', fontSize: 12, color: '#7a8794', borderBottom: '1px solid #eef2f5' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span aria-hidden="true" style={{ width: 18, height: 12, borderRadius: 3, background: '#e3edfb', borderLeft: '4px solid #1d4f91' }} /><b style={{ color: '#3d4a56' }}>カテゴリ</b></span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: '#1d4f91' }} />項目（指標）</span>
              </div>
              {FA_CATS.map((c) => {
                const col = FA_CAT_COLOR[c.cat];
                const defs = FA_DEFS.filter((d) => d.cat === c.cat);
                return (
                <div key={c.cat} data-fa-cat={c.cat} style={{ marginBottom: 6 }}>
                  <div role="heading" aria-level={3} style={{ padding: '9px 14px 8px', background: col.bg, borderLeft: '6px solid ' + col.fg, borderTop: '1px solid ' + col.fg + '33', borderBottom: '1px solid ' + col.fg + '33' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 17, fontWeight: 800, color: col.fg, fontFamily: "'Zen Kaku Gothic New', sans-serif", letterSpacing: '.04em' }}>{c.cat}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: col.fg, whiteSpace: 'nowrap' }}>{defs.length} 項目</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#5b6773', marginTop: 1 }}>{c.note}</div>
                  </div>
                  {defs.map((d) => {
                    const on = d.name === cur;
                    const n = faKeys(d).reduce((a, k) => a + (picked[k]?.length ?? 0), 0);
                    return (
                      <button key={d.name} type="button" data-fa-item={d.name} aria-current={on ? 'true' : undefined} onClick={() => { setCur(d.name); setQ(''); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 14px 8px 26px', border: 'none', borderLeft: '6px solid ' + (on ? col.fg : 'transparent'), background: on ? '#eef2f6' : 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: on ? 700 : 400, color: '#22303c', cursor: 'pointer' }}>
                        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: col.fg, opacity: on ? 1 : 0.55, flex: 'none' }} />
                        <span style={{ flex: 1 }}>{d.name}</span>
                        {dirty(d) && <span style={{ fontSize: 12, fontWeight: 800, padding: '1px 6px', borderRadius: 6, background: '#fff1b8', color: '#8a6d00' }}>未保存</span>}
                        <span style={{ fontSize: 12, color: n ? '#7a8794' : '#c0392b', whiteSpace: 'nowrap' }}>{n ? `${n} 科目` : '未設定'}</span>
                      </button>
                    );
                  })}
                </div>
                );
              })}
            </div>

            {/* 指標の詳細：算式・科目選択・ガイド */}
            <div style={{ padding: 20, display: 'grid', gap: 14, alignContent: 'start' }}>
              <div data-fa-head style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, padding: '3px 12px', borderRadius: 8, background: FA_CAT_COLOR[def.cat].bg, color: FA_CAT_COLOR[def.cat].fg, border: '1px solid ' + FA_CAT_COLOR[def.cat].fg + '55' }}><span style={{ fontSize: 12, fontWeight: 700 }}>カテゴリ</span><span style={{ fontSize: 15, fontWeight: 800 }}>{def.cat}</span></span>
                <span aria-hidden="true" style={{ color: '#9aa5b1' }}>›</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#8290a0' }}>項目</span>
                <span style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Zen Kaku Gothic New', sans-serif" }}>{def.name}</span>
                <button type="button" className="btn-outline" onClick={() => setGuide(true)} style={{ ...btn('#5b6773', false, true), marginLeft: 'auto' }}>ガイドを表示</button>
              </div>
              <div>
                <span style={lbl}>算式</span>
                <div data-fa-formula style={{ padding: '12px 14px', border: '1px solid #dde4ea', borderRadius: 10, background: '#f6f8fa', fontSize: 14.5, fontWeight: 600, lineHeight: 1.8 }}>{def.name} ＝ {def.formula}</div>
              </div>
              <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="科目名・コードで絞り込み" aria-label="科目の絞り込み" style={{ ...input, maxWidth: 300 }} />
              <div style={{ display: 'grid', gridTemplateColumns: def.parts.length > 1 ? 'repeat(auto-fit, minmax(300px, 1fr))' : '1fr', gap: 14, alignItems: 'start' }}>
                {def.parts.map((p, i) => {
                  const k = faKey(def.name, i);
                  // 科目を選ばない要素：人数設定の値（専任職員数・園児数）か、帳票から自動で集計する値
                  if (p.kind !== 'list') {
                    const isStaff = p.kind === 'staff';
                    return (
                      <div key={k} data-fa-part={p.mark} data-fa-value={p.kind} style={card}>
                        <div style={cardHead}>{p.mark} {p.title}<span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, padding: '1px 8px', borderRadius: 8, background: '#fff1d6', color: '#8a5a00', whiteSpace: 'nowrap' }}>{p.kind === 'auto' ? '自動で集計' : '人数設定の値'}</span></div>
                        <div style={{ padding: 16, display: 'grid', gap: 10, fontSize: 14, lineHeight: 1.7, color: '#48565f' }}>
                          {p.kind === 'auto' ? <div>{p.desc}</div> : (
                            <>
                              <div>科目は選びません。「人数設定」で入力した{isStaff ? '専任職員数' : '年齢ごとの児童数の合計'}を使います。</div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                <b style={{ fontSize: 26, color: '#22303c', fontVariantNumeric: 'tabular-nums' }}>{isStaff ? staff : kidsTotal}</b><span>人</span>
                                {(isStaff ? staffDirty : kidsAnyDirty) && <span style={{ fontSize: 12, fontWeight: 800, color: UNSAVED_FG }}>保存する前の値です</span>}
                              </div>
                              {!isStaff && <div style={sub}>{AGES.map((a, j) => `${a} ${kids[j]} 人`).join('／')}</div>}
                              <div><button type="button" className="btn-outline" onClick={() => setTab('人数設定')} style={btn(accent, false, true)}>人数設定を開く</button></div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }
                  const sel = new Set(picked[k] ?? []);
                  const shown = (a: FaAccount) => (p.fund ? a.fund ?? a.name : a.name);
                  const kw = q.trim();
                  const list = FA_ACCOUNTS.filter((a) => p.scope(a) && (!kw || a.name.includes(kw) || shown(a).includes(kw) || a.code.startsWith(kw)));
                  return (
                    <div key={k} data-fa-part={p.mark} style={card}>
                      <div style={{ ...cardHead, flexWrap: 'wrap' }}>
                        <span>{p.mark} {p.title}</span>
                        {p.caution && <span data-fa-caution style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>（{p.caution}）</span>}
                        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#7a8794' }}>{sel.size} 科目を選択中</span>
                      </div>
                      {p.shared && <div data-fa-shared style={{ padding: '7px 14px', fontSize: 12, fontWeight: 700, color: '#2c5f9e', background: '#f0f5fc', borderBottom: '1px solid #e2e8ee' }}>{p.shared}</div>}
                      <div style={{ maxHeight: 300, overflow: 'auto' }}>
                        {list.map((a) => (
                          <label key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderBottom: '1px solid #f1f4f6', fontSize: 14, cursor: 'pointer', background: sel.has(a.name) ? '#f7fbf9' : '#fff' }}>
                            <input type="checkbox" checked={sel.has(a.name)} onChange={() => toggle(k, a.name)} style={{ width: 16, height: 16 }} />
                            <span style={{ width: 46, color: '#8290a0', fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>{a.code}</span>
                            <span style={{ flex: 1, fontWeight: sel.has(a.name) ? 700 : 400 }}>{shown(a)}</span>
                            <span style={{ fontSize: 12, color: '#9aa5b1', whiteSpace: 'nowrap' }}>{p.fund && a.grp === '収益' ? '収入' : p.fund && a.grp === '費用' ? '支出' : a.grp}</span>
                          </label>
                        ))}
                        {!list.length && <div style={{ padding: 16, color: '#9aa5b1', fontSize: 14 }}>該当する科目がありません。</div>}
                      </div>
                      {p.note && <div data-fa-note style={{ padding: '8px 14px', fontSize: 12, color: '#5b6773', lineHeight: 1.6, borderTop: '1px solid #f1f4f6' }}>{p.note}</div>}
                      <div style={{ display: 'flex', gap: 6, padding: '8px 12px', background: '#fafbfc' }}>
                        <button type="button" onClick={() => setPicked((x) => ({ ...x, [k]: faStd(p) }))} style={btn('#5b6773', false, true)}>標準の科目に戻す</button>
                        <button type="button" onClick={() => setPicked((x) => ({ ...x, [k]: [] }))} style={btn('#5b6773', false, true)}>すべて外す</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                {dirty(def) && <span style={{ fontSize: 14, color: '#8a6d00', marginRight: 'auto' }}>変更があります。保存すると全区分のグラフ・帳票に反映されます。</span>}
                <button type="button" onClick={() => setPicked((x) => ({ ...x, ...Object.fromEntries(faKeys(def).map((key) => [key, saved[key] ?? []])) }))} disabled={!dirty(def)} style={{ ...btn(), opacity: dirty(def) ? 1 : 0.5 }}>変更を取り消す</button>
                <button type="button" className="submit-btn" onClick={() => { setSaved((x) => ({ ...x, ...Object.fromEntries(faKeys(def).map((key) => [key, picked[key] ?? []])) })); toast.show(`「${def.name}」の対象科目を保存しました（全区分共通）`); }} style={btn(accent, true)}>保存</button>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === '人数設定' && (
        <>
          <ScopeBar scope="この区分のみ" note={s.division}>
            人数は区分（施設）ごとに入力します。{s.fiscalYear} の「職員 1 人当たり」「園児 1 人当たり」の指標の計算に使います。
          </ScopeBar>
          <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, maxWidth: 980 }}>
            <div style={card}>
              <div style={cardHead}>職員数</div>
              <div style={{ padding: 16, display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>専任職員数</span><Stepper value={staff} onChange={setStaff} unit="人" label="専任職員数" changed={staffDirty} /></div>
                <div style={sub}>数値は直接入力するか、− ＋ ボタンで増減します。変更した欄は、保存するまで黄色で表示します。</div>
              </div>
            </div>
            <div style={card}>
              <div style={cardHead}>年齢ごとの児童数<span style={{ marginLeft: 'auto', fontSize: 14 }}>合計 <b style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{kidsTotal}</b> 人</span></div>
              <div style={{ padding: 16, display: 'grid', gap: 10 }}>
                {AGES.map((a, i) => (
                  <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{a}</span><Stepper value={kids[i]} onChange={(n) => setKids((k) => k.map((v, j) => (j === i ? n : v)))} unit="人" label={`${a}の児童数`} changed={kidsDirty[i]} /></div>
                ))}
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
              {headDirty && <span role="status" data-unsaved-msg style={{ fontSize: 15, fontWeight: 800, color: UNSAVED_FG, marginRight: 4 }}>保存されていません。</span>}
              <button type="button" onClick={() => { setStaff(savedStaff); setKids(savedKids); }} disabled={!headDirty} style={{ ...btn(), opacity: headDirty ? 1 : 0.5 }}>変更を取り消す</button>
              <button type="button" className="submit-btn" onClick={() => { setSavedStaff(staff); setSavedKids(kids); toast.show(`人数設定を保存しました（${s.division}：職員 ${staff} 人・園児 ${kidsTotal} 人）`); }} style={btn(accent, true)}>保存</button>
            </div>
          </div>
        </>
      )}

      <ExplainModal open={guide} onClose={() => setGuide(false)} accent={accent} title={`ガイド：${def.name}`} source="マニュアル 8.1.1 財務分析科目設定" sections={[
        { h: 'この指標の算式', body: <>{def.name} ＝ {def.formula}</> },
        { h: '科目の選び方', body: <>{def.guide}</> },
        { h: '設定の適用範囲', body: <>財務分析科目設定は法人全体で共有します（全区分共通）。科目の区分コードを変更したときは、対象科目を確認し直してください。</> },
      ]} />
    </SettingsShell>
  );
}

/* ======================================================================
 * 決算チェック設定（図52）：28 項目の有効／無効と、項目ごとの設定
 * ==================================================================== */

export function AuditSettingsPage({ variant, accent, onNavigate }: MaintenancePageProps) {
  const s = useSession();
  const toast = useToast();
  const viewOnly = isViewOnly(s);
  const [mode, setMode] = useState<'区分' | '法人'>('区分');
  const [dlg, setDlg] = useState<number | null>(null);
  const [help, setHelp] = useState(false);
  // 区分の設定と法人全体の設定は別に保持する（確認メモ #124。決算調査から開く設定画面と共通）
  const isOn = (no: number) => (mode === '区分' ? s.auditEnabled[no] !== false : s.auditCorpEnabled[no] !== false);
  const setOn = (no: number, v: boolean) => (mode === '区分' ? setSession({ auditEnabled: { ...s.auditEnabled, [no]: v } }) : setSession({ auditCorpEnabled: { ...s.auditCorpEnabled, [no]: v } }));
  const setAll = (v: boolean) => { const all = Object.fromEntries(AUDIT_ITEMS.map((a) => [a.no, v])); setSession(mode === '区分' ? { auditEnabled: all } : { auditCorpEnabled: all }); toast.show(`28 項目をすべて${v ? '有効' : '無効'}にしました`); };
  const onCount = AUDIT_ITEMS.filter((a) => isOn(a.no)).length;

  return (
    <SettingsShell variant={variant} title="決算チェック設定" badge="保守・運用" draft={false} desc="決算チェック（決算調査）の 28 項目について、チェックする項目の有効／無効と、項目ごとの条件（対象科目など）を設定します。" actions={<>
      <button type="button" className="btn-outline" onClick={() => setHelp(true)} style={btn()}>説明</button>
      <button type="button" className="btn-outline" onClick={() => (onNavigate ? onNavigate('決算調査') : toast.show('メニューの「決算チェック（決算調査）」から開きます'))} style={btn()}>決算チェック（決算調査）を開く →</button>
    </>}>
      <ToastView msg={toast.msg} />
      {/* 一覧の構成は現行【決算チェックシステム ― 設定】に合わせる（確認メモ #117）。
          3 列（01〜14／15〜19 と説明／20〜28）。項目名のボタンで項目ごとの設定を開く。
          設定の対象（この区分／法人全体）は、下の「法人決算チェック設定」で切り替える */}
      <div style={{ padding: '14px 22px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <b data-audit-mode={mode} style={{ fontSize: 16, color: '#22303c' }}>{mode === '区分' ? '決算チェック設定（この区分）' : '法人決算チェック設定（法人全体）'}</b>
        <span style={{ fontSize: 14, color: '#5b6773' }}>有効 <b style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{onCount}</b> ／ 28 項目</span>
        {viewOnly
          ? <span data-view-only style={{ marginLeft: 'auto', fontSize: 14, color: '#b7791f', fontWeight: 700 }}>参照のみの権限のため、設定の変更はできません</span>
          : <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => setAll(true)} style={btn('#5b6773', false, true)}>すべて有効</button>
              <button type="button" onClick={() => setAll(false)} style={btn('#5b6773', false, true)}>すべて無効</button>
            </span>}
      </div>

      <div style={{ padding: '12px 22px 22px' }}>
        <div style={{ ...card, padding: '16px 18px' }}>
          <AuditChecklist scope={mode} isOn={isOn} setOn={setOn} onOpen={setDlg} onSwitch={() => setMode(mode === '区分' ? '法人' : '区分')} accent={accent} />
        </div>
      </div>

      <AuditItemDialog no={dlg} scope={mode} onClose={() => setDlg(null)} onSaved={toast.show} accent={accent} />
      <ExplainModal open={help} onClose={() => setHelp(false)} accent={accent} support={false} title="決算チェック設定の説明" source="現行画面【決算チェックシステム - 設定】" sections={[
        { h: '有効／無効', body: <>チェックを外した項目は、決算チェック（決算調査）の実行時に調査しません。結果一覧では「対象外」として表示します。</> },
        { h: '項目ごとの設定', body: <>項目名のボタンを押すと、設定先の区分を確認する画面のあとに、その項目の診断用条件式と、条件式の要素ごとの勘定科目の一覧を表示します。科目はチェックで有効／無効に切り替えます。予算や残高率で判定する項目（26・27）は、しきい値もここで設定します。14 の抽出する金額（10 万円以上）は変更できません。</> },
        { h: '適用範囲', body: <>一覧の下に、この設定がどの区分に対するものかを表示します。「決算チェック設定（この区分）」は起動中の区分のみに適用されます。「法人決算チェック設定」ボタンで切り替える法人全体の設定は、法人全体の決算チェックに使う設定で、区分ごとの設定とは別に保持します。</> },
        { h: '項目の並び', body: <>現行と同じ 3 列（左 01〜14／中 15〜19／右 20〜28）で並べています。01〜14・18〜19 は会計システムのデータ同士を比較します。15〜17 は減価償却システムのデータと会計システムのデータを比較します。★印（20〜28）は期中残高や内部取引などの追加チェックです。</> },
      ]} />
    </SettingsShell>
  );
}

/* ======================================================================
 * 仕訳更新（マニュアル 5.6）：対象範囲の選択 → 確認 → 進行状況 → 完了
 * ==================================================================== */
const MONTHS = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];
const MONTH_COUNTS = [21, 18, 19, 22, 17, 20, 16, 18, 15, 14, 13, 15];

export function JournalRefreshPage({ variant, accent, onNavigate }: MaintenancePageProps) {
  const s = useSession();
  const toast = useToast();
  const prog = useProgress();
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState<'この区分' | '全入力区分'>('この区分');
  const [range, setRange] = useState<'年度全体' | '月を指定'>('年度全体');
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(11);
  const [agree, setAgree] = useState(false);
  const [last, setLast] = useState({ at: '令和8年9月10日 10:12', by: '鈴木', count: 196 });
  const entryDivs = SERVICES.length;
  const lo = Math.min(from, to), hi = Math.max(from, to);
  const perDiv = range === '年度全体' ? MONTH_COUNTS.reduce((a, b) => a + b, 0) : MONTH_COUNTS.slice(lo, hi + 1).reduce((a, b) => a + b, 0);
  const total = target === 'この区分' ? perDiv : Math.round(perDiv * (entryDivs - 0.4));
  const changed = Math.round(total * 0.06);
  const rangeLabel = range === '年度全体' ? `${s.fiscalYear} の全期間（4月〜3月）` : `${s.fiscalYear} ${MONTHS[lo]}〜${MONTHS[hi]}`;
  const targetLabel = target === 'この区分' ? s.division : `法人内のすべての入力区分（${entryDivs} 区分）`;
  const run = () => {
    setStep(2);
    prog.start(target === 'この区分' ? 3200 : 5600, () => { setStep(3); setLast({ at: warekiNow(), by: '鈴木', count: total }); toast.show(`仕訳更新が完了しました（${total.toLocaleString('ja-JP')} 件）`); });
  };
  const reset = () => { setStep(0); setAgree(false); };
  const row: CSSProperties = { display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10, padding: '9px 0', borderBottom: '1px solid #f1f4f6', fontSize: 14 };

  return (
    <SettingsShell variant={variant} title="仕訳更新" badge="保守・運用" draft={false} desc="勘定科目と資金科目の連動を変更したあとに、登録済みの伝票を整理し直して、集計データを作り直します。">
      <ToastView msg={toast.msg} />
      <ScopeBar scope={target === 'この区分' ? 'この区分のみ' : '全区分共通'} note={target === 'この区分' ? s.division : '法人内の全入力区分'} right={<span style={sub}>前回の実行：{last.at}（{last.by}・{last.count.toLocaleString('ja-JP')} 件）</span>}>
        {target === 'この区分' ? '起動中の区分の伝票だけを対象にします。' : '法人内のすべての入力区分の伝票を対象にします。'}
      </ScopeBar>
      <Steps steps={['対象範囲の選択', '確認', '実行', '完了']} current={step} accent={accent} />
      <div style={{ padding: 22, maxWidth: 820 }}>
        {step === 0 && (
          <div style={{ display: 'grid', gap: 18 }}>
            <Notice>科目設定で「対応する資金科目」や資金区分を変更したときに実行します。貸借対照表・事業活動計算書と資金収支計算書の連動も整理し直します。伝票の内容（日付・金額・摘要）は変わりません。</Notice>
            <div>
              <span style={lbl}>対象の区分</span>
              <div style={{ display: 'grid', gap: 8 }}>
                <label style={radioRow(target === 'この区分', accent)}><input type="radio" name="jr-target" checked={target === 'この区分'} onChange={() => setTarget('この区分')} /><span><b>起動中の区分のみ</b>（通常はこちら）<br /><span style={sub}>{s.division}</span></span></label>
                <label style={radioRow(target === '全入力区分', accent)}><input type="radio" name="jr-target" checked={target === '全入力区分'} onChange={() => setTarget('全入力区分')} /><span><b>法人内のすべての入力区分</b><br /><span style={sub}>{SERVICES.join('／')}</span></span></label>
              </div>
            </div>
            <div>
              <span style={lbl}>対象の期間（{s.fiscalYear}）</span>
              <div style={{ display: 'grid', gap: 8 }}>
                <label style={radioRow(range === '年度全体', accent)}><input type="radio" name="jr-range" checked={range === '年度全体'} onChange={() => setRange('年度全体')} /><span><b>年度全体</b>（1 年分の全伝票。通常はこちら）</span></label>
                <label style={radioRow(range === '月を指定', accent)}>
                  <input type="radio" name="jr-range" checked={range === '月を指定'} onChange={() => setRange('月を指定')} />
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><b>月を指定</b>
                    <select value={from} onChange={(e) => { setFrom(Number(e.target.value)); setRange('月を指定'); }} aria-label="開始月" style={{ ...input, width: 90, padding: '5px 8px' }}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>〜
                    <select value={to} onChange={(e) => { setTo(Number(e.target.value)); setRange('月を指定'); }} aria-label="終了月" style={{ ...input, width: 90, padding: '5px 8px' }}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
                  </span>
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid #dde4ea', borderRadius: 10, background: '#f6f8fa' }}>
              <span style={{ fontSize: 14 }}>対象の伝票</span><b style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>{total.toLocaleString('ja-JP')}</b><span style={{ fontSize: 14 }}>件</span>
              <span style={sub}>目安の時間：{total > 600 ? '2〜3 分' : '1 分以内'}</span>
              <button type="button" className="submit-btn" onClick={() => setStep(1)} style={{ ...btn(accent, true), marginLeft: 'auto' }}>確認へ進む</button>
            </div>
          </div>
        )}
        {step === 1 && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={card}>
              <div style={cardHead}>実行する内容</div>
              <div style={{ padding: '4px 16px 8px' }}>
                <div style={row}><span style={{ color: '#7a8794' }}>対象の区分</span><b>{targetLabel}</b></div>
                <div style={row}><span style={{ color: '#7a8794' }}>対象の期間</span><b>{rangeLabel}</b></div>
                <div style={row}><span style={{ color: '#7a8794' }}>対象の伝票</span><b>{total.toLocaleString('ja-JP')} 件</b></div>
                <div style={{ ...row, borderBottom: 'none' }}><span style={{ color: '#7a8794' }}>処理の内容</span><span>勘定科目と資金科目の連動を整理し、集計データを作り直します</span></div>
              </div>
            </div>
            <Notice tone="warn">開始すると、すべての伝票の整理が終わるまで途中で中断できません。処理中は、対象の区分で伝票の入力・訂正ができません。ほかの利用者が入力中でないことを確認してから開始してください。</Notice>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 17, height: 17 }} />途中で中断できないことを確認しました</label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setStep(0)} style={btn()}>← 対象範囲に戻る</button>
              <button type="button" className="submit-btn" disabled={!agree} onClick={run} style={{ ...btn('#b7791f', true), opacity: agree ? 1 : 0.45, cursor: agree ? 'pointer' : 'not-allowed' }}>仕訳更新を開始</button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div style={{ display: 'grid', gap: 14 }} aria-live="polite">
            <div style={{ fontSize: 16, fontWeight: 700 }}>仕訳を更新しています…</div>
            <ProgressBar value={prog.p ?? 100} accent={accent} height={16} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, fontVariantNumeric: 'tabular-nums' }}>
              <b style={{ fontSize: 22 }}>{prog.p ?? 100}%</b>
              <span style={{ fontSize: 14, color: '#5b6773' }}>{Math.round((total * (prog.p ?? 100)) / 100).toLocaleString('ja-JP')} ／ {total.toLocaleString('ja-JP')} 件</span>
              <span style={{ ...sub, marginLeft: 'auto' }}>{targetLabel}　{rangeLabel}</span>
            </div>
            <Notice tone="warn">処理中は中断できません。この画面を閉じずにお待ちください。</Notice>
          </div>
        )}
        {step === 3 && (
          <div style={{ display: 'grid', gap: 16 }}>
            <Notice tone="ok"><b>仕訳更新が完了しました。</b>　試算表・決算書・資金収支計算書に、更新後の集計が反映されています。</Notice>
            <div style={card}>
              <div style={cardHead}>実行結果</div>
              <div style={{ padding: '4px 16px 8px' }}>
                <div style={row}><span style={{ color: '#7a8794' }}>完了した日時</span><b>{last.at}</b></div>
                <div style={row}><span style={{ color: '#7a8794' }}>対象</span><span>{targetLabel}　{rangeLabel}</span></div>
                <div style={row}><span style={{ color: '#7a8794' }}>整理した伝票</span><b>{total.toLocaleString('ja-JP')} 件</b></div>
                <div style={{ ...row, borderBottom: 'none' }}><span style={{ color: '#7a8794' }}>資金科目が変わった伝票</span><b>{changed.toLocaleString('ja-JP')} 件</b></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={reset} style={btn()}>最初に戻る</button>
              <button type="button" className="submit-btn" onClick={() => (onNavigate ? onNavigate('月次試算') : toast.show('メニューの「試算表（月次試算）」で確認できます'))} style={btn(accent, true)}>試算表で確認 →</button>
            </div>
          </div>
        )}
      </div>
    </SettingsShell>
  );
}

/* ======================================================================
 * データのバックアップ／復元（ピックアップ）（マニュアル 4.4、図19）
 * ==================================================================== */
/** 保存先はこのパソコン／社内のフォルダだけ（クラウドストレージの連携は設けない） */
export interface BackupPrefs { /** 手動バックアップの保存先フォルダ */ path: string; /** 自動バックアップ（年度ごと）の保存先フォルダ */ autoPath: string }
const PREF_KEY = 'proto-backup-prefs-v1';
const DEFAULT_PREFS: BackupPrefs = { path: 'バックアップ用フォルダ（共有サーバー）／Chappy／バックアップ', autoPath: 'バックアップ用フォルダ（共有サーバー）／Chappy／自動バックアップ' };
/** バックアップの保存先（終了時にバックアップを尋ねる動作は廃止。手動はこの画面からすぐ実行、自動は年度ごと） */
export function getBackupPrefs(): BackupPrefs {
  try { const raw = localStorage.getItem(PREF_KEY); return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<BackupPrefs>) } : DEFAULT_PREFS; } catch { return DEFAULT_PREFS; }
}
const saveBackupPrefs = (p: BackupPrefs) => { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* ignore */ } };
const destLabel = (p: BackupPrefs) => p.path;
type BackupMethod = '区分・年度' | '法人全体';
const METHOD_LABEL: Record<BackupMethod, string> = { '区分・年度': '選択中の区分・年度のバックアップ', 法人全体: '法人全体（全年度・全区分）のバックアップ' };
interface BackupGen { id: string; at: string; target: string; method: BackupMethod; size: string; dest: string; by: string; kind: '手動' | '自動' }
const GEN_SEED: BackupGen[] = [
  { id: 'g5', at: '令和8年9月28日 18:02', target: '002 保育事業／令和8年度', method: '区分・年度', size: '4.2 MB', dest: 'フォルダ', by: '鈴木', kind: '手動' },
  { id: 'g4', at: '令和8年9月27日 23:00', target: '002 保育事業／令和8年度', method: '区分・年度', size: '4.2 MB', dest: 'フォルダ', by: '（自動）', kind: '自動' },
  { id: 'g3', at: '令和8年9月25日 17:48', target: '002 保育事業／令和8年度', method: '区分・年度', size: '4.1 MB', dest: 'フォルダ', by: '鈴木', kind: '手動' },
  { id: 'g2', at: '令和8年9月10日 10:05', target: '002 保育事業／令和8年度', method: '区分・年度', size: '3.9 MB', dest: 'フォルダ', by: '田中', kind: '手動' },
  { id: 'g1', at: '令和8年8月31日 18:30', target: '法人全体／全年度', method: '法人全体', size: '37.9 MB', dest: 'フォルダ', by: '田中', kind: '手動' },
  { id: 'g0', at: '令和8年4月1日 02:00', target: '002 保育事業／令和7年度', method: '区分・年度', size: '5.6 MB', dest: 'フォルダ', by: '（自動）', kind: '自動' },
];
const RESTORE_ITEMS: { key: string; label: string; note: string }[] = [
  { key: 'voucher', label: '伝票データ', note: '登録済みの伝票（仕訳）' },
  { key: 'account', label: '科目マスター', note: '勘定科目・資金科目・費目・使用科目' },
  { key: 'master', label: '取引先・摘要マスター', note: '取引先、摘要、摘要の自動補完候補' },
  { key: 'budget', label: '予算・残高', note: '予算額、繰越残高、前年実績' },
  { key: 'setting', label: '設定条件', note: '動作環境、印刷設定、決算チェック設定' },
];
const DANGER = '#c0392b';

export function BackupPage({ variant, accent }: MaintenancePageProps) {
  const s = useSession();
  const toast = useToast();
  const prog = useProgress();
  const restoreProg = useProgress();
  const [prefs, setPrefsState] = useState<BackupPrefs>(getBackupPrefs);
  const [method, setMethod] = useState<BackupMethod>('区分・年度');
  const [gens, setGens] = useState<BackupGen[]>(GEN_SEED);
  /** 保存先フォルダの変更（manual＝手動、auto＝自動バックアップ） */
  const [pathEdit, setPathEdit] = useState<{ kind: 'manual' | 'auto'; value: string } | null>(null);
  const [restore, setRestore] = useState<null | { step: number; genId: string; items: Record<string, boolean>; autoBackup: boolean; agree: boolean; done: boolean }>(null);
  const [itemHelp, setItemHelp] = useState(false);
  const setPrefs = (p: Partial<BackupPrefs>) => setPrefsState((x) => { const n = { ...x, ...p }; saveBackupPrefs(n); return n; });
  const here = `${s.division}／${s.fiscalYear}`;
  const newGen = (m: BackupMethod, kind: BackupGen['kind']): BackupGen => ({ id: 'g' + Date.now(), at: warekiNow(), target: m === '区分・年度' ? here : '法人全体／全年度', method: m, size: m === '区分・年度' ? '4.2 MB' : '38.7 MB', dest: kind === '自動' ? '自動バックアップ用フォルダ' : 'フォルダ', by: '鈴木', kind });
  const runBackup = () => prog.start(method === '区分・年度' ? 2200 : 4200, () => { setGens((g) => [newGen(method, '手動'), ...g]); toast.show('バックアップが完了しました'); });
  // 今すぐバックアップ：範囲や保存先を選び直さず、選択中の区分・年度をいまの保存先へすぐに保存する
  const runQuick = () => prog.start(2200, () => { setGens((g) => [newGen('区分・年度', '手動'), ...g]); toast.show('バックアップが完了しました'); });
  const lastAuto = gens.find((g) => g.kind === '自動');
  const openRestore = (genId?: string) => setRestore({ step: genId ? 1 : 0, genId: genId ?? gens[0]?.id ?? '', items: Object.fromEntries(RESTORE_ITEMS.map((i) => [i.key, true])), autoBackup: true, agree: false, done: false });
  const rGen = restore ? gens.find((g) => g.id === restore.genId) : undefined;
  const rItems = restore ? RESTORE_ITEMS.filter((i) => restore.items[i.key]) : [];
  const runRestore = () => {
    if (!restore || !rGen) return;
    const auto = restore.autoBackup;
    setRestore({ ...restore, step: 3 });
    restoreProg.start(3600, () => {
      if (auto) setGens((g) => [{ ...newGen('区分・年度', '自動'), by: '（復元前の自動保存）' }, ...g]);
      setRestore((r) => (r ? { ...r, done: true } : r));
      toast.show('復元（ピックアップ）が完了しました');
    });
  };
  const th: CSSProperties = { padding: '9px 12px', background: '#f6f8fa', fontSize: 12, fontWeight: 700, color: '#8290a0', borderBottom: '1px solid #eef2f5', textAlign: 'left', whiteSpace: 'nowrap' };
  const td: CSSProperties = { padding: '10px 12px', fontSize: 14, borderBottom: '1px solid #f1f4f6', verticalAlign: 'middle' };
  const kindChip = (k: BackupGen['kind']): CSSProperties => ({ fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 8, background: k === '手動' ? '#e8f0fb' : '#f1f4f6', color: k === '手動' ? '#2c5f9e' : '#5b6773', whiteSpace: 'nowrap' });

  return (
    <SettingsShell variant={variant} title="データのバックアップ" badge="保守・運用" draft={false} desc="データのバックアップをすぐに実行できます。年度ごとの自動バックアップ、保存したバックアップの一覧、バックアップからの復元（ピックアップ）もここで確認・実行します。">
      <ToastView msg={toast.msg} />
      <div style={{ padding: 22, display: 'grid', gap: 18 }}>
        {/* 今すぐバックアップ：1回押すだけで実行 */}
        <div data-backup-now style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '16px 20px', border: '1.5px solid ' + accent, borderRadius: 12, background: accent + '0d', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>今すぐバックアップ</div>
            {prog.running
              ? <div style={{ display: 'grid', gap: 6, marginTop: 8 }} aria-live="polite"><div style={{ fontSize: 14, fontWeight: 600 }}>バックアップを作成しています…　{prog.p}%</div><ProgressBar value={prog.p ?? 0} accent={accent} /></div>
              : <div style={{ fontSize: 14, color: '#5b6773', marginTop: 4, lineHeight: 1.7 }}>{here} のデータを、いまの保存先（{destLabel(prefs)}）へ保存します。<br />最新のバックアップ：<b style={{ color: '#22303c' }}>{gens[0]?.at ?? 'なし'}</b>{gens[0] ? `（${gens[0].kind}）` : ''}</div>}
          </div>
          <button type="button" className="submit-btn" onClick={runQuick} disabled={prog.running} style={{ ...btn(accent, true), padding: '13px 28px', fontSize: 16, opacity: prog.running ? 0.5 : 1, cursor: prog.running ? 'not-allowed' : 'pointer' }}>今すぐバックアップ</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18, alignItems: 'start' }}>
          {/* 範囲・保存先を指定して実行 */}
          <div style={card}>
            <div style={cardHead}>範囲・保存先を指定してバックアップ</div>
            <div style={{ padding: 16, display: 'grid', gap: 14 }}>
              <div>
                <span style={lbl}>バックアップする範囲</span>
                <div style={{ display: 'grid', gap: 8 }}>
                  <label style={radioRow(method === '区分・年度', accent)}><input type="radio" name="bk-method" checked={method === '区分・年度'} onChange={() => setMethod('区分・年度')} disabled={prog.running} /><span><b>{METHOD_LABEL['区分・年度']}</b>（通常はこちら）<br /><span style={sub}>{here}</span>　<ScopeBadge scope="この区分のみ" /></span></label>
                  <label style={radioRow(method === '法人全体', accent)}><input type="radio" name="bk-method" checked={method === '法人全体'} onChange={() => setMethod('法人全体')} disabled={prog.running} /><span><b>{METHOD_LABEL['法人全体']}</b><br /><span style={sub}>すべての区分・すべての年度をまとめて保存します</span>　<ScopeBadge scope="全区分共通" /></span></label>
                </div>
              </div>
              <div>
                <span style={lbl}>保存先フォルダ　<ScopeBadge scope="全区分共通" /></span>
                <div data-backup-dest style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid #e2e8ee', borderRadius: 10, background: '#fbfcfd' }}>
                  <span style={{ flex: 1, minWidth: 0 }}><b>このパソコン／社内のフォルダ</b><br /><span style={{ ...sub, wordBreak: 'break-all' }}>{prefs.path}</span></span>
                  <button type="button" onClick={() => setPathEdit({ kind: 'manual', value: prefs.path })} disabled={prog.running} style={btn('#5b6773', false, true)}>フォルダを変更</button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" className="submit-btn" onClick={runBackup} disabled={prog.running} style={{ ...btn(accent, true), opacity: prog.running ? 0.5 : 1 }}>この内容でバックアップを実行</button></div>
            </div>
          </div>

          {/* 自動バックアップ（年度ごと） */}
          <div style={card} data-backup-auto>
            <div style={cardHead}>自動バックアップ（年度ごと） <ScopeBadge scope="全区分共通" /><span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, padding: '2px 9px', borderRadius: 10, background: '#eaf5ef', color: '#1f7a52' }}>有効</span></div>
            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 14, color: '#5b6773', lineHeight: 1.8 }}>会計年度（単年度）ごとに、データを自動でバックアップします。操作は不要で、下の一覧に「自動」として保存されます。</div>
              <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, fontSize: 14 }}>
                <div style={{ display: 'flex', gap: 12, padding: '9px 12px', borderBottom: '1px solid #f1f4f6' }}><span style={{ width: 150, color: '#7a8794' }}>バックアップの単位</span><b>区分ごと・会計年度ごと</b></div>
                <div style={{ display: 'flex', gap: 12, padding: '9px 12px', borderBottom: '1px solid #f1f4f6' }}><span style={{ width: 150, color: '#7a8794' }}>前回の自動バックアップ</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{lastAuto ? `${lastAuto.at}（${lastAuto.target}）` : 'まだありません'}</span></div>
                <div data-backup-auto-dest style={{ display: 'flex', gap: 12, padding: '9px 12px', alignItems: 'center' }}><span style={{ width: 150, color: '#7a8794', flex: 'none' }}>保存先フォルダ</span><span style={{ wordBreak: 'break-all', flex: 1, minWidth: 0 }}>{prefs.autoPath}</span><button type="button" onClick={() => setPathEdit({ kind: 'auto', value: prefs.autoPath })} style={btn('#5b6773', false, true)}>フォルダを変更</button></div>
              </div>
              <Notice>システムを終了するときに、バックアップの確認は表示しません。手動で保存したいときは、上の「今すぐバックアップ」を押してください。</Notice>
            </div>
          </div>
        </div>

        {/* 世代一覧 */}
        <div style={card}>
          <div style={cardHead}>保存したバックアップ<span style={{ fontSize: 12, fontWeight: 500, color: '#8290a0' }}>{gens.length} 件（新しい順）</span></div>
          <div style={{ overflow: 'auto', maxHeight: 320 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>作成日時</th><th style={th}>種類</th><th style={th}>範囲</th><th style={th}>保存先</th><th style={{ ...th, textAlign: 'right' }}>サイズ</th><th style={th}>実行者</th></tr></thead>
              <tbody>{gens.map((g, i) => (
                <tr key={g.id}>
                  <td style={{ ...td, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{g.at}{i === 0 && <span style={{ fontSize: 12, fontWeight: 800, color: accent, marginLeft: 8 }}>最新</span>}</td>
                  <td style={td}><span style={kindChip(g.kind)}>{g.kind}</span></td>
                  <td style={td}>{g.target}</td>
                  <td style={td}>{g.dest}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{g.size}</td>
                  <td style={td}>{g.by}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>

        {/* 復元（ピックアップ）：取り消せない操作なので、ほかの操作と分けて置く */}
        <div style={{ marginTop: 18, paddingTop: 22, borderTop: '2px dashed #e6c9c3' }}>
          <div style={{ border: '1px solid #efc2b9', borderRadius: 12, background: '#fff8f6', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f3d5ce', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 9px', borderRadius: 10, background: DANGER, color: '#fff' }}>取り消せない操作</span>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: '#8a2a1e' }}>バックアップからの復元（ピックアップ）</span>
            </div>
            <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 280, fontSize: 14, lineHeight: 1.8, color: '#5b3a34' }}>保存したバックアップを読み込み、現在のデータに上書きします。<b>一度実行すると元には戻せません。</b>復元するバックアップと項目を選び、内容を確認してから実行します。</div>
              <button type="button" onClick={() => openRestore()} disabled={!gens.length} style={{ ...btn(DANGER), borderColor: DANGER, padding: '10px 18px' }}>復元の手順を始める…</button>
            </div>
          </div>
        </div>
      </div>

      {/* 保存先フォルダの変更（手動／自動） */}
      <Modal open={pathEdit != null} onClose={() => setPathEdit(null)} width={560} title={pathEdit?.kind === 'auto' ? '自動バックアップの保存先フォルダ' : 'バックアップの保存先フォルダ'}>
        {pathEdit != null && (() => {
          const apply = () => {
            const v = pathEdit.value.trim();
            if (!v) return;
            setPrefs(pathEdit.kind === 'auto' ? { autoPath: v } : { path: v });
            setPathEdit(null);
            toast.show(pathEdit.kind === 'auto' ? '自動バックアップの保存先フォルダを変更しました' : '保存先フォルダを変更しました');
          };
          return (
            <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
              <Field label="保存先フォルダ（このパソコン／外部ディスク／社内の共有フォルダ）"><input className="field-input ring" value={pathEdit.value} onChange={(e) => setPathEdit({ ...pathEdit, value: e.target.value })} onKeyDown={onEnter(apply)} autoFocus style={input} /></Field>
              <Notice>{pathEdit.kind === 'auto' ? '年度ごとの自動バックアップは、このフォルダに「自動」として保存されます。' : '手動のバックアップは、このフォルダに保存されます。'}このパソコン以外の場所（外部ディスクや社内の共有フォルダ）をおすすめします。本番ではフォルダの選択画面から指定します。</Notice>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setPathEdit(null)} style={btn()}>キャンセル</button>
                <button type="button" className="submit-btn" disabled={!pathEdit.value.trim()} onClick={apply} style={{ ...btn(accent, true), opacity: pathEdit.value.trim() ? 1 : 0.5 }}>変更する</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* 復元の確認フロー */}
      <Modal open={!!restore} onClose={() => setRestore(null)} width={760} strict closable={!restoreProg.running} title="バックアップからの復元（ピックアップ）">
        {restore && (
          <div>
            <Steps steps={['バックアップの選択', '復元する項目', '最終確認', '復元の実行']} current={restore.step} accent={DANGER} />
            <div style={{ padding: '16px 22px 20px', display: 'grid', gap: 14 }}>
              {restore.step === 0 && (
                <>
                  <div style={{ fontSize: 14, color: '#5b6773' }}>復元するバックアップを 1 つ選んでください。</div>
                  <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: 300, overflow: 'auto' }}>
                    {gens.map((g) => (
                      <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #f1f4f6', cursor: 'pointer', background: restore.genId === g.id ? '#fff4f1' : '#fff', fontSize: 14 }}>
                        <input type="radio" name="rs-gen" checked={restore.genId === g.id} onChange={() => setRestore({ ...restore, genId: g.id })} />
                        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', width: 170 }}>{g.at}</span>
                        <span style={kindChip(g.kind)}>{g.kind}</span>
                        <span style={{ flex: 1 }}>{g.target}</span>
                        <span style={sub}>{g.size}・{g.dest}</span>
                      </label>
                    ))}
                  </div>
                  <div style={sub}>ほかの場所に保存したバックアップは、「バックアップの実行」の保存先フォルダを変更すると一覧に表示されます。</div>
                </>
              )}
              {restore.step === 1 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 14, color: '#5b6773' }}>復元する項目にチェックを入れてください。チェックを外した項目は、現在のデータのまま残ります。</span><button type="button" onClick={() => setItemHelp(true)} style={{ ...btn('#5b6773', false, true), marginLeft: 'auto' }}>説明</button></div>
                  <div style={{ border: '1px solid #e2e8ee', borderRadius: 10 }}>
                    {RESTORE_ITEMS.map((it) => (
                      <label key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #f1f4f6', cursor: 'pointer', fontSize: 14 }}>
                        <input type="checkbox" checked={!!restore.items[it.key]} onChange={(e) => setRestore({ ...restore, items: { ...restore.items, [it.key]: e.target.checked } })} style={{ width: 17, height: 17 }} />
                        <b style={{ width: 170 }}>{it.label}</b><span style={sub}>{it.note}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
              {restore.step === 2 && rGen && (
                <>
                  <div style={{ padding: '12px 14px', border: '1px solid #efc2b9', background: '#fff4f1', borderRadius: 10, fontSize: 14, lineHeight: 1.8, color: '#8a2a1e' }}><b>現在のデータに上書きします。一度実行すると元には戻せません。</b><br />バックアップを作成した日時より後に登録・変更した内容は失われます。</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', alignItems: 'stretch', gap: 8 }}>
                    <div style={{ ...card, padding: 12 }}><span style={lbl}>読み込むバックアップ</span><div style={{ fontSize: 14, fontWeight: 700 }}>{rGen.at}</div><div style={sub}>{rGen.target}・{rGen.size}</div></div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: DANGER }}>→</div>
                    <div style={{ ...card, padding: 12, borderColor: '#efc2b9' }}><span style={lbl}>上書きされるデータ</span><div style={{ fontSize: 14, fontWeight: 700 }}>{rGen.method === '法人全体' ? '法人全体（全年度・全区分）' : here}</div><div style={sub}>{rItems.map((i) => i.label).join('、')}</div></div>
                  </div>
                  <Toggle on={restore.autoBackup} onChange={(v) => setRestore({ ...restore, autoBackup: v })} accent={accent} label="復元の前に、現在のデータを自動でバックアップする（おすすめ）" />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}><input type="checkbox" checked={restore.agree} onChange={(e) => setRestore({ ...restore, agree: e.target.checked })} style={{ width: 17, height: 17 }} />現在のデータが上書きされ、元に戻せないことを確認しました</label>
                </>
              )}
              {restore.step === 3 && (
                restore.done ? (
                  <>
                    <Notice tone="ok"><b>復元が完了しました。</b>　{rGen?.at} のバックアップから、{rItems.map((i) => i.label).join('、')} を読み込みました。</Notice>
                    {restore.autoBackup && <div style={sub}>復元前のデータは「保存したバックアップ」の一覧に自動で保存しました。</div>}
                  </>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }} aria-live="polite">
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{restore.autoBackup && (restoreProg.p ?? 0) < 30 ? '現在のデータをバックアップしています…' : 'バックアップを読み込んでいます…'}　{restoreProg.p ?? 100}%</div>
                    <ProgressBar value={restoreProg.p ?? 100} accent={DANGER} height={14} />
                    <div style={sub}>処理中は中断できません。この画面を閉じずにお待ちください。</div>
                  </div>
                )
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {restore.step < 3 && <button type="button" onClick={() => setRestore(null)} style={btn()}>キャンセル</button>}
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  {restore.step > 0 && restore.step < 3 && <button type="button" onClick={() => setRestore({ ...restore, step: restore.step - 1, agree: false })} style={btn()}>← 戻る</button>}
                  {restore.step === 0 && <button type="button" className="submit-btn" disabled={!rGen} onClick={() => setRestore({ ...restore, step: 1 })} style={{ ...btn(accent, true), opacity: rGen ? 1 : 0.5 }}>次へ</button>}
                  {restore.step === 1 && <button type="button" className="submit-btn" disabled={!rItems.length} onClick={() => setRestore({ ...restore, step: 2 })} style={{ ...btn(accent, true), opacity: rItems.length ? 1 : 0.5 }}>次へ</button>}
                  {restore.step === 2 && <button type="button" disabled={!restore.agree} onClick={runRestore} style={{ ...btn(DANGER, true), opacity: restore.agree ? 1 : 0.45, cursor: restore.agree ? 'pointer' : 'not-allowed' }}>復元を実行する</button>}
                  {restore.step === 3 && restore.done && <button type="button" className="submit-btn" onClick={() => setRestore(null)} style={btn(accent, true)}>閉じる</button>}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
      <ExplainModal open={itemHelp} onClose={() => setItemHelp(false)} accent={accent} title="復元する項目の説明" source="マニュアル 4.4.2 ピックアップ機能" sections={RESTORE_ITEMS.map((i) => ({ h: i.label, body: <>{i.note}を、バックアップを作成した時点の内容に戻します。チェックを外すと、現在の内容のまま残ります。</> }))} />
    </SettingsShell>
  );
}
