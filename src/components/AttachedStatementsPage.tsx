// 決算附属明細書設定（依頼書 5.5.4、マニュアル 7.8）
//   現行の 3 画面（決算附属明細書設定／設定２／設定３）を 1 画面に統合し、タブで切り替える。
//   項目・並び・結びつけ方は現行の画面（保守 › 項目、科目、取引先 › 決算附属明細書設定）に合わせる（確認メモ #217）：
//     1 行に 1 科目を対応させる項目はコンボボックス（選択）、複数の科目を対象にする項目はチェック付きの一覧。
//   科目の候補はプロトタイプの既存データ（科目ツリー・科目候補）から取る。既存データに無い科目は作らず、未設定にしている。
//   設定２・３ の「収入に合わせる／支出に合わせる」の切替は、動作環境ではなくこの画面内で行う（全区分共通の設定）。
//   ［１年基準科目設定］は、決算チェック設定の「★１年基準科目 期中残高チェック」の設定画面をそのまま使う。
//   明細入力・財産目録の行設定・注記の編集・合算テーブルは、印刷の準備として「別紙」画面（AppendixPrintPage）へ移した（5.5.3）。

import { useState } from 'react';
import type { ReactNode } from 'react';
import { AuditItemDialog } from './AuditItemDialog';
import { Modal } from './Modal';
import { ScopeBadge } from './PrintCenter';
import { ToastView, useToast } from './Toast';
import { Notice, SettingsShell, Tabs, btn, card, cardHead, input } from './ui';
import { AUDIT_ITEMS, GRAPH_TREES, displayName } from '../data';
import { setSession, useSession } from '../store/session';
import { CHANGED_BG, CHANGED_BORDER, UNSAVED_FG, useUnsaved } from '../store/unsaved';

const TABS = ['設定１　借入金・寄附金・国庫補助金・補助金・基本金・引当金', '設定２　区分間繰入金・積立金', '設定３　区分間貸付金（借入金）'];
const TAB_DESC = [
  '借入金明細書・寄附金収益明細書・国庫補助金等特別積立金明細書・補助金事業等収益明細書・基本金明細書・引当金明細書で使う科目を設定します。',
  '区分間繰入金明細書（事業区分間・拠点区分間・サービス区分間・小サービス区分間）と、積立金・積立資産明細書で使う科目を設定します。',
  '区分間貸付金（借入金）明細書（事業区分間・拠点区分間・サービス区分間・小サービス区分間）で使う科目を設定します。',
];
type Side = '収入' | '支出';
type OptGroup = { group: string; names: string[] };
/** チェック付き一覧の候補（cls は科目の区分。一覧の右に小さく出す） */
type Pool = { name: string; cls: string }[];

/* ---------- 科目の候補（既存データから） ---------- */
/** 流動負債・固定負債の科目（経年グラフの科目ツリー「負債」から。明細書用の科目候補で補う） */
const LIAB_OPTS: OptGroup[] = (() => {
  const out: OptGroup[] = [];
  GRAPH_TREES.負債.forEach((r) => {
    if (r.level === 0) out.push({ group: r.name, names: [] });
    else if (r.level === 1 && out.length && !out[out.length - 1].names.includes(r.name)) out[out.length - 1].names.push(r.name);
  });
  const addAfter = (g: string, after: string, n: string) => { const o = out.find((x) => x.group === g); if (!o || o.names.includes(n)) return; const i = o.names.indexOf(after); o.names.splice(i < 0 ? o.names.length : i + 1, 0, n); };
  addAfter('固定負債', '長期運営資金借入金', '役員等長期借入金');
  addAfter('流動負債', '前受収益', '賞与引当金');
  return out;
})();
const KOKKO_OPTS: OptGroup[] = [{ group: '純資産', names: ['国庫補助金等特別積立金'] }, { group: 'サービス活動費用（控除項目）', names: ['国庫補助金等特別積立金取崩額'] }, { group: '特別増減', names: ['国庫補助金等特別積立金積立額'] }];
const KIHON_OPTS: OptGroup[] = [{ group: '純資産', names: ['基本金'] }, { group: '特別増減', names: ['基本金組入額', '基本金取崩額'] }];
const HIKIATE_OPTS: OptGroup[] = [{ group: '流動資産（控除項目）', names: ['徴収不能引当金'] }, { group: '流動負債', names: ['賞与引当金'] }, { group: '固定負債', names: ['退職給付引当金', '役員退職慰労引当金'] }];

/** 1 行に 1 科目を対応させる明細書（コンボボックス） */
interface ComboSec { key: string; title: string; opts: OptGroup[]; rows: { label: string; def: string; hint?: string }[] }
const COMBO: Record<'kariire' | 'kokko' | 'kihon' | 'hikiate', ComboSec> = {
  kariire: { key: 'kariire', title: '借入金明細書用　中区分項目の指定', opts: LIAB_OPTS, rows: [
    { label: '設備資金借入金', def: '設備資金借入金' },
    { label: '長期運営資金借入金', def: '長期運営資金借入金' },
    { label: '短期運営資金借入金', def: '短期運営資金借入金' },
    { label: '役員等長期借入金', def: '' },
    { label: '役員等短期借入金', def: '' },
  ] },
  kokko: { key: 'kokko', title: '国庫補助金等特別積立金明細書用', opts: KOKKO_OPTS, rows: [
    { label: '国庫補助金等特別積立金', def: '国庫補助金等特別積立金' },
    { label: '取崩額（サービス活動）', def: '国庫補助金等特別積立金取崩額' },
    { label: '取崩額（特別増減）', def: '', hint: '除却等による取崩額の科目' },
    { label: '積立額（特別増減）', def: '国庫補助金等特別積立金積立額' },
  ] },
  kihon: { key: 'kihon', title: '基本金明細書用', opts: KIHON_OPTS, rows: [
    { label: '１号基本金', def: '基本金' },
    { label: '２号基本金', def: '' },
    { label: '３号基本金', def: '' },
  ] },
  hikiate: { key: 'hikiate', title: '引当金明細書', opts: HIKIATE_OPTS, rows: [
    { label: '徴収不能引当金', def: '徴収不能引当金' },
    { label: '賞与引当金', def: '賞与引当金' },
    { label: '退職給付引当金', def: '退職給付引当金' },
  ] },
};

/** 複数の科目を対象にする明細書（チェック付きの一覧） */
const KIFU_POOL: Pool = [{ name: '寄附金収益', cls: 'サービス活動収益' }, { name: '施設整備等寄附金収益', cls: '特別収益' }, { name: '長期運営資金借入金元金償還寄附金収益', cls: '特別収益' }, { name: '設備資金借入金元金償還寄附金収益', cls: '特別収益' }, { name: '固定資産受贈額', cls: '特別収益' }];
const HOJO_POOL: Pool = [{ name: '補助金収益', cls: 'サービス活動収益' }, { name: '市区町村補助金収益', cls: 'サービス活動収益' }, { name: '都道府県補助金収益', cls: 'サービス活動収益' }, { name: 'その他の補助金収益', cls: 'サービス活動収益' }, { name: '借入金利息補助金収益', cls: 'サービス活動外収益' }, { name: '施設整備等補助金収益', cls: '特別収益' }, { name: '設備資金借入金元金償還補助金収益', cls: '特別収益' }];
const SHISAN_POOL: Pool = ['施設整備等積立資産', '人件費積立資産', '修繕積立資産', '備品等購入積立資産', '保育所繰越積立資産'].map((name) => ({ name, cls: 'その他の固定資産' }));
const TSUMIKIN_POOL: Pool = ['施設整備等積立金', '人件費積立金', '修繕費積立金', '備品等購入積立金', '保育所施設・設備整備積立金', 'その他の積立金'].map((name) => ({ name, cls: '純資産' }));
const LIST_DEF: Record<string, string[]> = {
  kifu: KIFU_POOL.map((p) => p.name),
  hojo: ['補助金収益', '市区町村補助金収益', '都道府県補助金収益', 'その他の補助金収益'],
  'tsumi/shisan': SHISAN_POOL.map((p) => p.name),
  'tsumi/kin': TSUMIKIN_POOL.map((p) => p.name),
};

/** 区分間の明細書（設定２・３）：区分の段階ごとのチェック付き一覧。収入／支出の合わせ方で候補が変わる */
const LEVELS = ['事業区分間', '拠点区分間', 'サービス区分間', '小サービス区分間'];
const KURII_POOL: Record<Side, Pool> = {
  収入: ['事業区分間', '拠点区分間', 'サービス区分間'].map((l) => ({ name: `${l}繰入金収益`, cls: '特別収益' })),
  支出: ['事業区分間', '拠点区分間', 'サービス区分間'].map((l) => ({ name: `${l}繰入金費用`, cls: '特別費用' })),
};
const KASHI_POOL: Record<Side, Pool> = {
  収入: [{ name: '１年以内回収予定長期貸付金', cls: '流動資産' }, { name: '短期貸付金', cls: '流動資産' }, { name: '事業区分間貸付金', cls: '流動資産' }, { name: '拠点区分間貸付金', cls: '流動資産' }, { name: 'サービス区分間貸付金', cls: '流動資産' }, { name: '長期貸付金', cls: 'その他の固定資産' }],
  支出: [{ name: '１年以内返済予定事業区分間長期借入金', cls: '流動負債' }, { name: '１年以内返済予定拠点区分間長期借入金', cls: '流動負債' }, { name: '１年以内返済予定サービス区分間長期借入金', cls: '流動負債' }, { name: '事業区分間借入金', cls: '流動負債' }, { name: '拠点区分間借入金', cls: '流動負債' }, { name: 'サービス区分間借入金', cls: '流動負債' }],
};
/** 区分の段階ごとの既定（小サービス区分間は、該当する科目が科目マスターに無いため空） */
const levelDef = (sec: 'kurii' | 'kashi', side: Side, lv: number): string[] => {
  const l = LEVELS[lv];
  if (lv === 3) return [];
  if (sec === 'kurii') return [`${l}繰入金${side === '収入' ? '収益' : '費用'}`];
  return side === '収入' ? [`${l}貸付金`] : [`１年以内返済予定${l}長期借入金`, `${l}借入金`];
};
const lvKey = (sec: 'kurii' | 'kashi', lv: number, side: Side) => `${sec}/${lv}:${side}`;

/* ---------- 設定値 ---------- */
type Kihon2 = '明細による集計' | '科目による集計' | '交付目的による集計';
const KIHON2_OPTS: Kihon2[] = ['明細による集計', '科目による集計', '交付目的による集計'];
interface Grant { org: string; purpose: string }
interface Conf {
  /** コンボボックス：`明細書/行` → 科目（'' は未設定） */ combo: Record<string, string>;
  /** チェック付き一覧：`明細書` または `明細書/段階:収入|支出` → 対象の科目 */ checks: Record<string, string[]>;
  /** 伝票入力時に監視する */ watch: Record<string, boolean>;
  kihon2: Kihon2; kihonReplace: string; kokkoTitles: string[]; grants: Grant[];
}
const KOKKO_TITLES_DEFAULT = ['国庫補助金', '都道府県補助金', '市町村補助金', 'その他の補助金'];
const GRANTS_DEFAULT: Grant[] = [{ org: '○○市', purpose: '延長保育事業' }, { org: '○○市', purpose: '障害児保育事業' }];
const WATCH_DEF: Record<string, boolean> = { kifu: true, kokko: true, hojo: true, kihon: true, 'kurii/0': false, 'kurii/1': false, 'kurii/2': false, 'kurii/3': false };
const defaultConf = (): Conf => ({
  combo: Object.fromEntries(Object.values(COMBO).flatMap((c) => c.rows.map((r, i) => [`${c.key}/${i}`, r.def]))),
  checks: {
    ...Object.fromEntries(Object.entries(LIST_DEF).map(([k, v]) => [k, [...v]])),
    ...Object.fromEntries((['kurii', 'kashi'] as const).flatMap((sec) => (['収入', '支出'] as const).flatMap((side) => LEVELS.map((_, lv) => [lvKey(sec, lv, side), levelDef(sec, side, lv)])))),
  },
  watch: { ...WATCH_DEF },
  kihon2: '交付目的による集計', kihonReplace: '', kokkoTitles: [...KOKKO_TITLES_DEFAULT], grants: GRANTS_DEFAULT.map((g) => ({ ...g })),
});
/** 設定のキーがどのタブのものか（キーの先頭＝明細書） */
const SEC_TAB: Record<string, number> = { kariire: 0, kifu: 0, kokko: 0, hojo: 0, kihon: 0, hikiate: 0, kurii: 1, tsumi: 1, kashi: 2 };
const secOf = (k: string) => k.split(/[/:]/)[0];
/** タブごとの比較用の値（チェックの順番の違いは変更として扱わない） */
const snap = (c: Conf, ti: number) => JSON.stringify([
  Object.entries(c.combo).filter(([k]) => SEC_TAB[secOf(k)] === ti).sort(),
  Object.entries(c.checks).filter(([k]) => SEC_TAB[secOf(k)] === ti).map(([k, v]) => [k, [...v].sort()]).sort(),
  Object.entries(c.watch).filter(([k]) => SEC_TAB[secOf(k)] === ti).sort(),
  ti === 0 ? [c.kihon2, c.kihonReplace, c.kokkoTitles, c.grants] : null,
]);
const ONE_YEAR_NO = 23;
const MOVED = ['明細入力', '財産目録の行設定', '注記の編集', '合算テーブル'];

/* ---------- 部品 ---------- */
function SecCard({ title, sub, onReset, children }: { title: string; sub?: ReactNode; onReset: () => void; children: ReactNode }) {
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
      <div style={cardHead}><span>{title}</span>{sub}<button type="button" onClick={onReset} style={{ ...btn('#5b6773', false, true), marginLeft: 'auto' }}>デフォルト設定にする</button></div>
      <div style={{ padding: '12px 16px 14px', display: 'grid', gap: 10, alignContent: 'start' }}>{children}</div>
    </div>
  );
}
function CheckList({ pool, checked, saved, onToggle, height = 150, empty }: { pool: Pool; checked: string[]; saved: string[]; onToggle: (name: string, on: boolean) => void; height?: number; empty?: string }) {
  return (
    <div data-stmt-list style={{ border: '1px solid #cfd8e0', borderRadius: 6, maxHeight: height, overflowY: 'auto', background: '#fff' }}>
      {pool.map((p) => {
        const on = checked.includes(p.name);
        const changed = on !== saved.includes(p.name);
        return (
          <label key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderBottom: '1px solid #f1f4f6', fontSize: 14, cursor: 'pointer', background: changed ? CHANGED_BG : on ? '#f3f8f7' : '#fff' }}>
            <input type="checkbox" checked={on} onChange={(e) => onToggle(p.name, e.target.checked)} />
            <span style={{ flex: 1, minWidth: 0 }}>{p.name}</span>
            <span style={{ fontSize: 12, color: '#9aa5b1', whiteSpace: 'nowrap' }}>{p.cls}</span>
          </label>
        );
      })}
      {pool.length === 0 && <div style={{ padding: 14, fontSize: 14, color: '#9aa5b1', lineHeight: 1.7 }}>{empty ?? '該当する科目がありません'}</div>}
    </div>
  );
}
function WatchBox({ on, changed, onChange, label }: { on: boolean; changed: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '2px 6px', borderRadius: 6, background: changed ? CHANGED_BG : 'transparent', justifySelf: 'start' }}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />{label}
    </label>
  );
}

export function AttachedStatementsPage({ variant, accent, onNavigate }: { variant: 'form' | 'sheet'; accent: string; /** メニュー項目名で別画面へ移動（「別紙」画面へのリンクに使用） */ onNavigate?: (label: string) => void }) {
  const s = useSession();
  const toast = useToast();
  const [tab, setTab] = useState(TABS[0]);
  const ti = TABS.indexOf(tab);
  const side: Side = s.env.transferWatch === '支払いで監視' ? '支出' : '収入';
  const setSide = (v: Side) => { setSession({ env: { ...s.env, transferWatch: v === '支出' ? '支払いで監視' : '収入で監視' } }); toast.show(`設定２・設定３ を「${v}に合わせる」に切り替えました（全区分共通）`); };
  const [saved, setSaved] = useState<Conf>(defaultConf);
  const [draft, setDraft] = useState<Conf>(defaultConf);
  const [oneYearOpen, setOneYearOpen] = useState(false);
  const [titlesDraft, setTitlesDraft] = useState<string[] | null>(null);
  const [grantsDraft, setGrantsDraft] = useState<Grant[] | null>(null);

  const dirtyTabs = TABS.filter((_, i) => snap(draft, i) !== snap(saved, i));
  const dirty = dirtyTabs.length > 0;
  useUnsaved('決算附属明細書設定', `${displayName('決算附属明細書')}（${dirtyTabs.map((t) => t.split('　')[0]).join('・')}）`, dirty);

  const setCombo = (k: string, v: string) => setDraft((d) => ({ ...d, combo: { ...d.combo, [k]: v } }));
  const toggleCheck = (k: string, n: string, on: boolean) => setDraft((d) => { const cur = d.checks[k] ?? []; return { ...d, checks: { ...d.checks, [k]: on ? [...cur.filter((x) => x !== n), n] : cur.filter((x) => x !== n) } }; });
  const setWatch = (k: string, v: boolean) => setDraft((d) => ({ ...d, watch: { ...d.watch, [k]: v } }));
  const watchBox = (k: string, label: string) => <WatchBox on={!!draft.watch[k]} changed={!!draft.watch[k] !== !!saved.watch[k]} onChange={(v) => setWatch(k, v)} label={label} />;
  /** 明細書ごとの［デフォルト設定にする］（科目・監視・集計方法を既定に戻す。合計タイトル・交付団体などの入力内容はそのまま） */
  const resetSec = (sec: string, name: string) => {
    const d0 = defaultConf();
    const mine = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).filter(([k]) => secOf(k) === sec));
    setDraft((d) => ({ ...d, combo: { ...d.combo, ...mine(d0.combo) }, checks: { ...d.checks, ...mine(d0.checks) }, watch: { ...d.watch, ...mine(d0.watch) }, kihon2: sec === 'kihon' ? d0.kihon2 : d.kihon2 }));
    toast.show(`「${name}」をデフォルト設定にしました（未保存：保存で確定）`);
  };
  const saveAll = () => { setSaved(draft); toast.show(`${displayName('決算附属明細書')}を保存しました`); };
  const cancelAll = () => { setDraft(saved); toast.show('変更を取り消しました'); };
  const goAppendix = () => { if (onNavigate) onNavigate('別紙（注記・明細書・財産目録）'); else toast.show('「帳票・印刷 ＞ 別紙（注記・明細書・財産目録）」を開いてください'); };

  /** コンボボックスの表（項目 ｜ 科目）。同じ明細書の中で同じ科目を 2 か所に選んだときは注意を出す */
  const comboRows = (c: ComboSec, after?: (i: number) => ReactNode) => {
    const chosen = c.rows.map((_, i) => draft.combo[`${c.key}/${i}`] ?? '');
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 190px) minmax(0, 1fr)', gap: '6px 12px', alignItems: 'center' }}>
        {c.rows.map((r, i) => {
          const k = `${c.key}/${i}`;
          const v = chosen[i];
          const changed = v !== (saved.combo[k] ?? '');
          const dup = !!v && chosen.some((x, j) => j !== i && x === v);
          return (
            <div key={k} data-stmt-row={`${c.key}:${r.label}`} style={{ display: 'contents' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{r.label}</span>
              <div style={{ display: 'grid', gap: 3 }}>
                <select aria-label={`${r.label}の科目`} value={v} onChange={(e) => setCombo(k, e.target.value)} style={{ ...input, padding: '6px 10px', background: changed ? CHANGED_BG : '#fff', borderColor: changed ? CHANGED_BORDER : '#cfd8e0', color: v ? '#22303c' : '#9aa5b1' }}>
                  <option value="">（未設定）</option>
                  {c.opts.map((g) => <optgroup key={g.group} label={g.group}>{g.names.map((n) => <option key={n} value={n} style={{ color: '#22303c' }}>{n}</option>)}</optgroup>)}
                </select>
                {(r.hint && !v) && <span style={{ fontSize: 12, color: '#8290a0' }}>{r.hint}を選びます</span>}
                {dup && <span style={{ fontSize: 12, fontWeight: 700, color: '#8a5a00' }}>同じ科目をこの明細書のほかの項目にも選んでいます</span>}
                {after?.(i)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  /** 区分の段階ごとのチェック付き一覧（設定２・３） */
  const levelGrid = (sec: 'kurii' | 'kashi', pool: Pool, title: (l: string) => string) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
      {LEVELS.map((l, lv) => {
        const k = lvKey(sec, lv, side);
        const checked = draft.checks[k] ?? [];
        const dupNames = checked.filter((n) => LEVELS.some((_, o) => o !== lv && (draft.checks[lvKey(sec, o, side)] ?? []).includes(n)));
        return (
          <div key={l} data-stmt-level={`${sec}:${l}`} style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#3d4a56' }}>{title(l)}<span style={{ fontWeight: 500, color: '#8290a0', marginLeft: 6 }}>{checked.length} 科目</span></div>
            <CheckList pool={pool} checked={checked} saved={saved.checks[k] ?? []} onToggle={(n, on) => toggleCheck(k, n, on)} height={190} />
            {lv === 3 && checked.length === 0 && <span style={{ fontSize: 12, color: '#8290a0', lineHeight: 1.6 }}>小サービス区分間の科目がない場合は、チェックなしのままにします。</span>}
            {dupNames.length > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#8a5a00', lineHeight: 1.6 }}>{dupNames.join('、')} は、ほかの区分間にもチェックがあります</span>}
            {sec === 'kurii' && watchBox(`kurii/${lv}`, '伝票入力時に監視する')}
          </div>
        );
      })}
    </div>
  );
  const oneYearName = AUDIT_ITEMS.find((a) => a.no === ONE_YEAR_NO)?.name ?? '１年基準科目';

  return (
    <SettingsShell variant={variant} title={displayName('決算附属明細書')} badge="決算" unsaved={dirty}
      desc="決算附属明細書に集計する科目と、伝票入力時の監視を設定します。これまで 3 つに分かれていた画面（設定／設定２／設定３）を、1 つの画面にまとめました。"
      actions={<>
        {dirty && <span role="status" data-unsaved-msg style={{ fontSize: 15, fontWeight: 800, color: UNSAVED_FG, marginRight: 4 }}>保存されていません。</span>}
        <button type="button" onClick={cancelAll} disabled={!dirty} style={{ ...btn(), opacity: dirty ? 1 : 0.5 }}>変更を取り消す</button>
        <button type="button" className="submit-btn" onClick={saveAll} style={btn(accent, true)}>保存</button>
      </>}>
      <ToastView msg={toast.msg} />
      <Tabs items={TABS} current={tab} onChange={setTab} accent={accent} marks={dirtyTabs} />

      <div style={{ padding: '16px 22px 20px', display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 14, color: '#48565f', lineHeight: 1.8 }}>{TAB_DESC[ti]}<span style={{ color: '#8290a0' }}>　1 行に 1 科目を対応させる項目は一覧から選び、複数の科目を対象にする項目はチェックを付けます。</span></div>

        {/* 設定２・３：収入に合わせる／支出に合わせる（これまで動作環境にあった切替） */}
        {ti >= 1 && (
          <div style={{ border: '1px solid #bfdcd9', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#e4f1f0', flexWrap: 'wrap' }}>
              <ScopeBadge kind="全区分共通" />
              <b style={{ fontSize: 14 }}>科目の合わせ方（設定２・設定３ 共通）</b>
              <span style={{ fontSize: 14, color: '#48565f' }}>{ti === 1 ? `いまは${side === '収入' ? '繰入金収入（繰入金収益）' : '繰入金支出（繰入金費用）'}の科目を表示しています` : `いまは${side === '収入' ? '貸付金' : '借入金'}の科目を表示しています`}<span style={{ color: '#8290a0' }}>（合わせ方ごとに別々に保存されます。これまで「{displayName('環境設定')}」にあった切替です）</span></span>
              <div role="radiogroup" aria-label="科目の合わせ方" style={{ display: 'inline-flex', border: '1px solid #1f6f6b', borderRadius: 9, overflow: 'hidden', marginLeft: 'auto' }}>
                {(['収入', '支出'] as const).map((v) => <button key={v} type="button" role="radio" aria-checked={side === v} onClick={() => side !== v && setSide(v)} style={{ padding: '7px 16px', border: 'none', background: side === v ? '#1f6f6b' : '#fff', color: side === v ? '#fff' : '#1f6f6b', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{v}に合わせる</button>)}
              </div>
            </div>
          </div>
        )}

        {ti === 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, alignItems: 'start' }}>
              {/* 借入金明細書 */}
              <SecCard title={COMBO.kariire.title} onReset={() => resetSec('kariire', '借入金明細書')}>
                <div style={{ fontSize: 12, color: '#8290a0' }}>選択肢は流動負債・固定負債の科目です。</div>
                {comboRows(COMBO.kariire)}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setOneYearOpen(true)} style={btn('#5b6773', false, true)}>１年基準科目設定</button>
                  <span style={{ fontSize: 12, color: '#8290a0' }}>決算チェック設定の「{oneYearName}」と同じ設定です（その画面の OK で保存されます）</span>
                </div>
              </SecCard>

              {/* 寄附金収益明細書 */}
              <SecCard title="寄附金収益明細書用" onReset={() => resetSec('kifu', '寄附金収益明細書')}>
                <CheckList pool={KIFU_POOL} checked={draft.checks.kifu ?? []} saved={saved.checks.kifu ?? []} onToggle={(n, on) => toggleCheck('kifu', n, on)} />
                {watchBox('kifu', '伝票入力時に寄附金収益を監視する')}
              </SecCard>

              {/* 国庫補助金等特別積立金明細書 */}
              <SecCard title={COMBO.kokko.title} onReset={() => resetSec('kokko', '国庫補助金等特別積立金明細書')}>
                {comboRows(COMBO.kokko)}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {watchBox('kokko', '伝票入力時に国庫補助金等を監視する')}
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 12, color: '#9aa5b1' }}>{draft.kokkoTitles.join('／')}</span><button type="button" onClick={() => setTitlesDraft([...draft.kokkoTitles])} style={btn('#5b6773', false, true)}>合計タイトル</button></span>
                </div>
              </SecCard>

              {/* 補助金事業等収益明細書 */}
              <SecCard title="補助金事業等収益明細書用" onReset={() => resetSec('hojo', '補助金事業等収益明細書')}>
                <CheckList pool={HOJO_POOL} checked={draft.checks.hojo ?? []} saved={saved.checks.hojo ?? []} onToggle={(n, on) => toggleCheck('hojo', n, on)} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {watchBox('hojo', '伝票入力時に補助金収益を監視する')}
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 12, color: '#9aa5b1' }}>登録 {draft.grants.length} 件</span><button type="button" onClick={() => setGrantsDraft(draft.grants.map((g) => ({ ...g })))} style={btn('#5b6773', false, true)}>交付団体及び交付の目的の編集</button></span>
                </div>
              </SecCard>

              {/* 基本金明細書 */}
              <SecCard title={COMBO.kihon.title} onReset={() => resetSec('kihon', '基本金明細書')}>
                {comboRows(COMBO.kihon, (i) => i === 1 && (
                  <div role="radiogroup" aria-label="２号基本金の集計方法" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '4px 8px', borderRadius: 6, background: draft.kihon2 !== saved.kihon2 ? CHANGED_BG : '#f6f8fa', fontSize: 14 }}>
                    <span style={{ color: '#8290a0', fontWeight: 700 }}>集計方法</span>
                    {KIHON2_OPTS.map((o) => <label key={o} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><input type="radio" name="kihon2" checked={draft.kihon2 === o} onChange={() => setDraft((d) => ({ ...d, kihon2: o }))} />{o}</label>)}
                  </div>
                ))}
                {watchBox('kihon', '伝票入力時に基本金を監視する')}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, flexWrap: 'wrap' }}>明細書の「○○事業」を
                  <input className="field-input" value={draft.kihonReplace} onChange={(e) => setDraft((d) => ({ ...d, kihonReplace: e.target.value }))} placeholder="例：保育事業" style={{ ...input, padding: '5px 10px', width: 180, background: draft.kihonReplace !== saved.kihonReplace ? CHANGED_BG : '#fff' }} />に置き換える
                </label>
              </SecCard>

              {/* 引当金明細書 */}
              <SecCard title={COMBO.hikiate.title} onReset={() => resetSec('hikiate', '引当金明細書')}>
                {comboRows(COMBO.hikiate)}
              </SecCard>
            </div>
            <Notice>
              ※ 伝票入力の監視をするタイプの明細書については、設定を変更した場合、該当する科目のすべての伝票を再登録する必要があります。<br />
              <span style={{ color: '#7a8794' }}>「伝票入力時に監視する」を有効にすると、該当する科目の伝票を登録したときに「明細表へ追加しますか？」の確認が出て、その場で明細データを登録できます（連続定型仕訳で登録した伝票は対象外）。</span>
            </Notice>
          </>
        )}

        {ti === 1 && (
          <>
            <SecCard title="区分間繰入金明細書　科目設定" onReset={() => resetSec('kurii', '区分間繰入金明細書')}>
              {levelGrid('kurii', KURII_POOL[side], (l) => `${l}繰入金${side}`)}
            </SecCard>
            <SecCard title="積立金・積立資産明細書" onReset={() => resetSec('tsumi', '積立金・積立資産明細書')}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                {([['積立資産の一覧', 'tsumi/shisan', SHISAN_POOL], ['積立金の一覧', 'tsumi/kin', TSUMIKIN_POOL]] as const).map(([t, k, pool]) => (
                  <div key={k} style={{ display: 'grid', gap: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#3d4a56' }}>{t}<span style={{ fontWeight: 500, color: '#8290a0', marginLeft: 6 }}>{(draft.checks[k] ?? []).length} 科目</span></div>
                    <CheckList pool={pool} checked={draft.checks[k] ?? []} saved={saved.checks[k] ?? []} onToggle={(n, on) => toggleCheck(k, n, on)} height={190} />
                  </div>
                ))}
              </div>
            </SecCard>
          </>
        )}

        {ti === 2 && (
          <SecCard title="区分間貸付金（借入金）明細書" sub={<span style={{ fontSize: 12, fontWeight: 500, color: '#8290a0' }}>候補は「１年以内回収予定長期貸付金」〜「長期貸付金」の{side === '収入' ? '貸付金' : '借入金'}科目</span>} onReset={() => resetSec('kashi', '区分間貸付金（借入金）明細書')}>
            {levelGrid('kashi', KASHI_POOL[side], (l) => `${l}${side === '収入' ? '貸付金' : '借入金'}`)}
          </SecCard>
        )}
      </div>

      <div style={{ borderTop: '1px solid #eef2f5', padding: '12px 22px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 14, color: '#5b6773' }}>
        <span style={{ fontWeight: 700, color: '#8290a0' }}>移動した機能</span>
        {MOVED.map((m) => <span key={m} style={{ padding: '2px 8px', borderRadius: 8, background: '#f3f6f9', border: '1px solid #dde4ea' }}>{m}</span>)}
        <span>は、印刷の準備として「帳票・印刷 ＞ 別紙」にまとめました。</span>
        <button type="button" onClick={goAppendix} style={btn('#5b6773', false, true)}>別紙を開く</button>
      </div>

      {/* ［１年基準科目設定］：決算チェック設定の項目の設定画面を流用 */}
      <AuditItemDialog no={oneYearOpen ? ONE_YEAR_NO : null} scope="区分" onClose={() => setOneYearOpen(false)} onSaved={(m) => toast.show(m)} accent={accent} />

      {/* ［合計タイトル］：国庫補助金明細書 積立合計行タイトル入力 */}
      <Modal open={!!titlesDraft} onClose={() => setTitlesDraft(null)} width={480} title="国庫補助金明細書　積立合計行タイトル入力">
        {titlesDraft && (
          <div style={{ padding: '12px 22px 18px', display: 'grid', gap: 10 }}>
            <Notice>明細書に出力する国庫補助金等のグループ名（積立合計行のタイトル）を設定します。グループごとに積立額・取崩額の合計行が印刷されます。</Notice>
            {titlesDraft.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ width: 24, fontSize: 14, color: '#8290a0' }}>{i + 1}</span><input className="field-input" value={t} onChange={(e) => setTitlesDraft(titlesDraft.map((x, k) => (k === i ? e.target.value : x)))} placeholder="例：国庫補助金" style={input} /><button type="button" title="この行を削除" onClick={() => setTitlesDraft(titlesDraft.filter((_, k) => k !== i))} style={btn('#c0392b', false, true)}>×</button></div>
            ))}
            <div><button type="button" onClick={() => setTitlesDraft([...titlesDraft, ''])} style={btn(accent, false, true)}>＋ 行を追加</button></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setTitlesDraft(null)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => { const t = titlesDraft.map((x) => x.trim()).filter(Boolean); setDraft((d) => ({ ...d, kokkoTitles: t.length ? t : [...KOKKO_TITLES_DEFAULT] })); setTitlesDraft(null); toast.show('合計タイトルを変更しました（未保存：保存で確定）'); }} style={btn(accent, true)}>OK</button></div>
          </div>
        )}
      </Modal>

      {/* ［交付団体及び交付の目的の編集］：補助金事業等収益明細書の明細で選ぶ交付団体と目的 */}
      <Modal open={!!grantsDraft} onClose={() => setGrantsDraft(null)} width={640} title="交付団体及び交付の目的の編集">
        {grantsDraft && (
          <div style={{ padding: '12px 22px 18px', display: 'grid', gap: 10 }}>
            <Notice>補助金事業等収益明細書の明細に記載する「交付団体」と「交付の目的」を登録します。明細入力のときに、ここで登録したものから選べます。</Notice>
            <div style={{ display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr) minmax(0, 1.4fr) auto', gap: '6px 8px', alignItems: 'center' }}>
              <span /><span style={{ fontSize: 12, fontWeight: 700, color: '#8290a0' }}>交付団体</span><span style={{ fontSize: 12, fontWeight: 700, color: '#8290a0' }}>交付の目的</span><span />
              {grantsDraft.map((g, i) => (
                <div key={i} style={{ display: 'contents' }}>
                  <span style={{ fontSize: 14, color: '#8290a0' }}>{i + 1}</span>
                  <input className="field-input" aria-label={`${i + 1} 行目の交付団体`} value={g.org} onChange={(e) => setGrantsDraft(grantsDraft.map((x, k) => (k === i ? { ...x, org: e.target.value } : x)))} placeholder="例：○○市" style={{ ...input, padding: '6px 10px' }} />
                  <input className="field-input" aria-label={`${i + 1} 行目の交付の目的`} value={g.purpose} onChange={(e) => setGrantsDraft(grantsDraft.map((x, k) => (k === i ? { ...x, purpose: e.target.value } : x)))} placeholder="例：延長保育事業" style={{ ...input, padding: '6px 10px' }} />
                  <button type="button" title="この行を削除" onClick={() => setGrantsDraft(grantsDraft.filter((_, k) => k !== i))} style={btn('#c0392b', false, true)}>×</button>
                </div>
              ))}
            </div>
            {grantsDraft.length === 0 && <div style={{ fontSize: 14, color: '#9aa5b1' }}>登録がありません。「＋ 行を追加」で登録します。</div>}
            <div><button type="button" onClick={() => setGrantsDraft([...grantsDraft, { org: '', purpose: '' }])} style={btn(accent, false, true)}>＋ 行を追加</button></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setGrantsDraft(null)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => { const g = grantsDraft.map((x) => ({ org: x.org.trim(), purpose: x.purpose.trim() })).filter((x) => x.org || x.purpose); setDraft((d) => ({ ...d, grants: g })); setGrantsDraft(null); toast.show(`交付団体及び交付の目的を ${g.length} 件にしました（未保存：保存で確定）`); }} style={btn(accent, true)}>OK</button></div>
          </div>
        )}
      </Modal>
    </SettingsShell>
  );
}
