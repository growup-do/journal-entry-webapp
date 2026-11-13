// 機能から探す（依頼書 5.2.2「機能一覧型」／1.2 課題1「どこに何の機能があるか分かりにくい」）
//   FunctionDirectory  … 全機能を分類ごとに並べた一覧（検索語で絞り込む）。ホームと「機能から探す」画面で共用。
//   FinderPanel        … ホーム（ダッシュボード）に置く「機能から探す」：検索ボックス＋全機能の一覧。
//                        別画面には飛ばさず、検索ボックスに入力するとその場で一覧を絞り込む（確認メモ #147／#148）。
//   FunctionFinderPage … 左メニューの「機能から探す」から開く画面（中身はホームと同じ一覧）。
//   一覧の形：分類ごとに、左に大きなアイコンと分類名、右にその分類の機能を文字のリンクで並べる。
//   分類のアイコンと分類名は緑で目立たせ、機能はすべて同じ形の枠つきボタンで 1 行に 1 つ並べる。分類の間は仕切り線で区切る。

import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { HOME_CHECKS, MENU_GROUPS, SETTINGS_GROUPS, displayName, settingsMenuName } from '../data';
import { startKindOf, useSession } from '../store/session';
import { canOpen, type Access } from '../store/access';

export interface FunctionGroup { key: string; label: string; note: string; danger: boolean; items: string[] }
type Group = FunctionGroup;
/** 検索対象：メインメニュー＋各種設定（Web版の追加案は除く）＋ホーム・機能一覧 */
function allGroups(a: Access): Group[] {
  // アカウントで使えない機能は出さない
  return ([
    ...MENU_GROUPS.map((g) => ({ key: g.key, label: g.label, note: '', danger: false, items: g.items })),
    { key: 'audit', label: '調査・チェック', note: 'ヘッダーの区分名の横のボタンからも開けます', danger: false, items: HOME_CHECKS },
    ...SETTINGS_GROUPS.filter((g) => g.key !== 'web').map((g) => ({ key: 's-' + g.key, label: '各種設定 › ' + g.label, note: g.note ?? '', danger: !!g.danger, items: g.items })),
  ] as Group[]).map((g) => ({ ...g, items: g.items.filter((l) => canOpen(l, a)) })).filter((g) => g.items.length > 0);
}
/** 旧名称・別名でも探せるようにする（サポートが口頭で案内しやすいように） */
const ALIASES: Record<string, string[]> = {
  伝票入力: ['仕訳伝票', '伝票', '仕訳'], 単一入力: ['単一式', '単一'], 振替入力: ['振替伝票', '振替'], 振替単一: ['振替単一式'],
  仕訳一覧: ['日記帳', '仕訳日記帳', '問合'], 勘定元帳: ['総勘定元帳', '元帳'], 資金元帳: ['元帳'], 業者元帳: ['取引先別支払一覧', '元帳', '業者元帳', '業者別支払一覧'], 業者推移: ['業者推移表'],
  月次試算: ['試算表', '試算'], 月次決算: ['決算書', '決算'], 予算対比: ['予算対比表', '予算'], 日次調査: ['同額', '不一致', '検索'], 決算調査: ['決算チェック', 'チェック'],
  充実残額: ['社会福祉充実残額', 'シミュレーター'], 預金残高: ['銀行', '口座', '通帳', '預金', '残高'], 印刷センター: ['印刷', '帳票', '一括印刷', 'まとめて印刷'],
  事業者: ['法人', '区分', '部門情報'], 勘定科目: ['科目', '科目設定', '科目マスター', '資金科目', '勘定費目', '資金費目', '使用科目', '使用科目設定更新', '補助簿', '明細表'], 取引先: ['取引先', '合算集計用', '業者', '業者マスター'], 摘要辞書: ['摘要', '摘要マスター', '自動補完'], 開始残高: ['残高', '繰越'], 予算: ['予算額'],
  決算附属明細書: ['附属明細書', '明細書'], 環境設定: ['動作環境', '金額書式', '動作印刷設定の読込', '他の区分の設定', '付箋', '付箋の意味'], 年度更新: ['年度', '更新', '繰越'], 整合性チェック: ['伝票チェック', '科目チェック'],
  データのバックアップ: ['バックアップ', 'ピックアップ', '復元'], 小口現金: ['出納帳', '小口'], 預金出納: ['出納帳', '預金'], 収入支出: ['伺い書', '調書'],
  繰越判断: ['収支分析表', '高額繰越', '事前協議', '前期末支払資金残高', '委託費', '繰越'], 減価償却連動: ['減価償却連動設定', '借入元金償還補助', '償還補助', '国庫補助金等特別積立金', '連動'],
  '別紙（注記・明細書・財産目録）': ['財産目録設定', '財産目録', '注記', '計算書類に対する注記', '別紙', '附属明細書'],
  共通の印刷設定: ['印刷設定', '0データ', '除外科目', '動作印刷設定の読込'], 仕訳辞書: ['連続定型仕訳登録', '自動按分仕訳登録', '定型', '按分', 'テンプレート'],
};
export const matchesFunction = (key: string, q: string) => {
  const s = q.trim();
  if (!s) return true;
  return key.includes(s) || displayName(key).includes(s) || (ALIASES[key] ?? []).some((a) => a.includes(s) || s.includes(a));
};

/** 検索語で絞り込んだ分類（分類名に一致したときは、その分類の項目をすべて出す） */
function filterGroups(q: string, a: Access): Group[] {
  const s = q.trim();
  return allGroups(a).map((g) => ({ ...g, items: g.items.filter((l) => matchesFunction(l, s) || (!!s && g.label.includes(s))) })).filter((g) => g.items.length > 0);
}
const INPUT_ONLY = ['単一入力', '伝票入力', '振替入力', '振替単一'];

/* ---------------- 重要度（確認メモ #241：▲＝高、△＝中、無印＝低） ---------------- */
type Priority = 'high' | 'mid';
const PRIORITY: Record<string, Priority> = { 伝票入力: 'high', 印刷センター: 'high', 小口現金: 'high', 減価償却: 'high', 預金出納: 'high', 決算調査: 'mid', 予算: 'mid' };
const PRIORITY_LABEL: Record<Priority, string> = { high: '重要度：高', mid: '重要度：中' };

/** 分類ごとのアイコン（24×24 の線画。一覧では大きく表示する） */
const GROUP_ICONS: Record<string, ReactNode> = {
  input: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /><path d="M9 12h7M9 16h7" /></>,
  ledger: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" /><path d="M6.5 8h2.5M6.5 11h2.5M15.5 8h2M15.5 11h2" /></>,
  trend: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 6-7" /><path d="M16 7h4v4" /></>,
  compare: <><rect x="3.5" y="4" width="17" height="16" rx="1.5" /><path d="M3.5 9h17M3.5 14.5h17M9.5 9v11" /></>,
  print: <><path d="M7 8V3h10v5" /><path d="M7 17H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-3" /><path d="M7 13h10v8H7z" /></>,
  option: <><path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10v3" /><path d="M20 12h-4a2 2 0 0 0 0 4h4" /></>,
  audit: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /><path d="M8 11l2 2 4-4" /></>,
  's-master': <><ellipse cx="12" cy="5.5" rx="7" ry="2.5" /><path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13" /><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" /></>,
  's-config': <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>,
  's-register': <><rect x="8" y="3" width="12" height="14" rx="1.5" /><path d="M16 17v2.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 19.5v-11A1.5 1.5 0 0 1 5.5 7H8" /><path d="M11 8h6M11 12h6" /></>,
  's-maint': <><path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 6.7-6.7a4 4 0 0 1-5-5L10 4.6 4.6 10" /><path d="M3 21l6-6" /></>,
  // 減価償却のホーム（確認メモ #244）
  'd-asset': <><path d="M4 21V8.5L12 3l8 5.5V21" /><path d="M9.5 21v-6h5v6" /><path d="M3 21h18" /></>,
  'd-equip': <><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></>,
  'd-move': <><path d="M4 8h14" /><path d="M14 4l4 4-4 4" /><path d="M20 16H6" /><path d="M10 12l-4 4 4 4" /></>,
  'd-closing': <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8.5 7h7" /><path d="M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h.01M15.5 18h.01" /></>,
  'd-setting': <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>,
  's-update': <><rect x="3.5" y="5" width="17" height="15" rx="1.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="M15 14.5a3 3 0 1 1-1-2.2" /><path d="M14.5 11.5v1.5H13" /></>,
};
const DEFAULT_ICON: ReactNode = <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h5" /></>;

/** ボタン名を本体と後ろのカッコ書きに分ける。半角のカッコも全角にそろえる（例「固定資産管理台帳(新会計版)」）。
 *  「移管(元)固定資産一覧表」のように名前の途中のカッコは分けない（カッコのあとが 4 文字までなら後ろのカッコ書きとみなす） */
export function splitParen(name: string): [string, string] {
  const m = name.match(/^(.+?)([（(][^（()）]*[）)])(.*)$/);
  if (!m || m[3].length > 4) return [name, ''];
  return [m[1], (m[2] + m[3]).replace('(', '（').replace(')', '）')];
}

/* ---------------- 全機能の一覧（分類ごと） ----------------
 *  分類ごとに、左に大きなアイコンと分類名、右にその分類の機能を文字のリンクで並べる。
 *  先頭の機能と重要度・高の機能（確認メモ #241）は大きな見出しの文字、重要度・中はやや大きい文字にする。 */
export function FunctionDirectory({ groups, onNavigate, first, minCol = 270, cols, stacked, wide, accent, nameOf }: { groups: Group[]; onNavigate: (label: string) => void; accent: string; /** 検索中：Enter で開く先頭の項目（強調表示） */ first?: string; /** 列の最小幅 */ minCol?: number; /** 列の数を固定するとき（既定は幅に合わせて自動） */ cols?: number; /** 分類のアイコンと名前を上に置き、機能のボタンをその下に横幅いっぱいで並べる（列が狭いとき。横幅いっぱいの分類も同じ見出しの形） */ stacked?: boolean; /** 横幅いっぱいに置く分類と、その機能を並べる列の数（項目の多い分類。例 減価償却の帳票） */ wide?: Record<string, number>; /** ボタンに出す名前（会計以外の画面で使うとき。既定は会計の表示名） */ nameOf?: (label: string) => string }) {
  const kind = startKindOf(useSession());
  const tint = (pct: number) => 'color-mix(in srgb, ' + accent + ' ' + pct + '%, #fff)';
  const LINE = '1px solid #e3e9ee';
  // ボタンと見出しのマウスオーバー（使えない項目・検索で強調中の項目は変えない）
  const css = '[data-fn-btn]:not([data-off]):not([data-hit]):hover{border-color:var(--fn-accent)!important;color:var(--fn-accent)!important;background:var(--fn-tint)!important}'
    + '[data-fn-btn][data-danger]:not([data-off]):not([data-hit]):hover{border-color:#c0392b!important;color:#c0392b!important;background:#fdf1ee!important}';
  return (
    // 仕切り線：各分類の上と左に線を引き、外周の線は外側の枠で隠す（内側の仕切りだけが見える）
    <div style={{ overflow: 'hidden' }}>
      <style>{css}</style>
      <div data-function-directory style={{ display: 'grid', gridTemplateColumns: cols ? `repeat(${cols}, minmax(0, 1fr))` : `repeat(auto-fill, minmax(${minCol}px, 1fr))`, margin: '-1px 0 0 -1px', ['--fn-accent' as string]: accent, ['--fn-tint' as string]: tint(8) } as CSSProperties}>
        {groups.length === 0 && <div style={{ gridColumn: '1 / -1', padding: 30, textAlign: 'center', color: '#9aa5b1', fontSize: 14 }}>該当する機能がありません。別の言葉でお試しください。</div>}
        {groups.map((g) => {
          // 分類のアイコンと分類名は緑（年度更新は赤）で目立たせる
          const ink = g.danger ? '#c0392b' : accent;
          // 分類名は「各種設定 › マスター設定」のように長いものを 2 行に分ける
          const [l1, l2] = g.label.includes(' › ') ? g.label.split(' › ') : [g.label, ''];
          const wideCols = wide?.[g.key];
          const top = !!stacked;
          return (
            <div key={g.key} data-function-group={g.key} style={{ display: 'grid', gridTemplateColumns: top ? 'minmax(0, 1fr)' : '104px minmax(0, 1fr)', gridColumn: wideCols ? '1 / -1' : undefined, columnGap: 12, rowGap: 12, alignItems: 'start', alignContent: 'start', padding: top ? '16px 16px 18px' : '18px 14px 18px 6px', borderTop: LINE, borderLeft: LINE, background: g.danger ? '#fdf7f5' : undefined }}>
              <div title={g.note || undefined} style={{ display: 'flex', flexDirection: top ? 'row' : 'column', alignItems: 'center', gap: top ? 10 : 8, textAlign: top ? 'left' : 'center' }}>
                <svg width={top ? 34 : 52} height={top ? 34 : 52} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{GROUP_ICONS[g.key] ?? DEFAULT_ICON}</svg>
                <div data-group-title style={{ fontSize: top ? 15 : 13, fontWeight: 800, color: ink, lineHeight: 1.35, whiteSpace: 'nowrap' }}>
                  {l2 ? <><span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: ink, opacity: 0.7 }}>{l1}</span>{l2}</> : l1}
                </div>
              </div>
              {/* 機能はすべて同じ形のボタンで、1 行に 1 つ（横幅いっぱいの分類は、指定の列の数で並べる） */}
              <div style={wideCols ? { display: 'grid', gridTemplateColumns: `repeat(${wideCols}, minmax(0, 1fr))`, gap: 6, minWidth: 0 } : { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                {g.items.map((l) => {
                  const off = INPUT_ONLY.includes(l) && kind !== '入力区分';
                  const hit = first === l;
                  const pr = PRIORITY[l];
                  const name = nameOf ? nameOf(l) : g.key.startsWith('s-') ? settingsMenuName(l) : displayName(l);
                  const tip = off ? kind + 'で起動中は利用できません' : hit ? 'Enter でこの画面を開きます' : pr ? PRIORITY_LABEL[pr] : undefined;
                  // 名前の後ろのカッコの部分（例「日記帳（仕訳一覧）」の（仕訳一覧））は、改行して下の行に小さく細く出す
                  const [main, sub] = splitParen(name);
                  return (
                    <button key={l} type="button" className="btn-outline" data-fn-btn data-off={off || undefined} data-hit={hit || undefined} data-danger={g.danger || undefined} data-menu={'機能:' + l} data-priority={pr} onClick={() => onNavigate(l)} title={tip}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%', boxSizing: 'border-box', padding: '6px 8px 6px 12px', border: '1px solid ' + (hit ? '#1f7a52' : off ? '#e3e8ec' : g.danger ? '#f2c9c2' : '#d5dde4'), borderRadius: 8, background: hit ? '#eaf5ef' : off ? '#f7f9fa' : '#fff', boxShadow: hit ? '0 0 0 2px rgba(31,122,82,.22)' : '0 1px 1px rgba(34,48,60,.04)', color: off ? '#b3bcc5' : g.danger ? '#c0392b' : '#22303c', fontSize: 14, fontWeight: 600, lineHeight: 1.4, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}>
                      <span style={{ minWidth: 0 }}>{sub ? <>{main}<span data-fn-sub style={{ display: 'block', fontSize: 12, fontWeight: 400, opacity: 0.75 }}>{sub}</span></> : name}</span>
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none', opacity: 0.4 }}><path d="M9 6l6 6-6 6" /></svg>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- 画面（左メニューの「機能から探す」） ---------------- */
export function FunctionFinderPage({ accent, onNavigate, initialQuery = '' }: { accent: string; onNavigate: (label: string) => void; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const access = useSession().access;
  const groups = useMemo(() => filterGroups(q, access), [q, access]);
  const total = groups.reduce((a, g) => a + g.items.length, 0);
  const card: CSSProperties = { background: '#fff', border: '1px solid #dde4ea', borderRadius: 14, boxShadow: '0 6px 26px rgba(30,50,70,.06)', overflow: 'hidden' };
  return (
    <main style={{ flex: 1, minWidth: 0, padding: 28, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1280 }}>
        <section style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 22px 14px', borderBottom: '1px solid #eef2f5', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 21 }}>機能から探す</div>
              <div style={{ color: '#7a8794', fontSize: 14, marginTop: 4 }}>すべての機能を分類ごとに並べています。画面名・旧メニュー名・キーワードで絞り込めます。ホーム（ダッシュボード）にも同じ一覧があります。</div>
            </div>
            <input autoFocus className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="例：試算表、年度更新、科目、元帳" autoComplete="off" style={{ marginLeft: 'auto', width: 320, padding: '9px 12px', border: '1px solid #cfd8e0', borderRadius: 9, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            <span style={{ fontSize: 14, color: '#7a8794' }}><b style={{ color: '#22303c' }}>{total}</b> 件</span>
          </div>
          <div style={{ padding: '14px 18px 18px' }}>
            <FunctionDirectory groups={groups} onNavigate={onNavigate} accent={accent} />
          </div>
        </section>
      </div>
    </main>
  );
}

/* ---------------- ホーム（ダッシュボード）の「機能から探す」 ---------------- */
/** ホームの検索ボックスに出す入力例（押すとその言葉で絞り込む） */
const FINDER_EXAMPLES = ['試算表', '元帳', '科目', '年度更新', 'バックアップ', '印刷'];
export function FinderPanel({ accent, onNavigate }: { accent: string; onNavigate: (label: string) => void }) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const access = useSession().access;
  const groups = useMemo(() => filterGroups(q, access), [q, access]);
  const total = groups.reduce((a, g) => a + g.items.length, 0);
  const all = useMemo(() => allGroups(access).reduce((a, g) => a + g.items.length, 0), [access]);
  const searching = !!q.trim();
  const first = searching ? groups[0]?.items[0] : undefined;
  const go = (key: string) => { setQ(''); onNavigate(key); };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    // 日本語の変換確定の Enter は無視する
    if (e.nativeEvent.isComposing || (e.nativeEvent as unknown as { keyCode: number }).keyCode === 229) return;
    if (e.key === 'Enter') { e.preventDefault(); if (first) go(first); }
    else if (e.key === 'Escape' && q) { e.preventDefault(); setQ(''); }
  };
  const tint = (pct: number) => `color-mix(in srgb, ${accent} ${pct}%, #fff)`;
  const tryWord = (w: string) => { setQ(w); inputRef.current?.focus(); };
  return (
    <section data-finder-search data-finder-panel style={{ background: '#fff', border: '1px solid #dde4ea', borderRadius: 14, boxShadow: '0 6px 26px rgba(30,50,70,.06)', overflow: 'hidden', ['--finder-accent' as string]: accent }}>
      {/* 検索ボックス（色つきの帯と丸い入力欄で他のカードと区別。確認メモ #148：残す） */}
      <div style={{ padding: '16px 20px 14px', background: tint(10), borderBottom: '1px solid ' + tint(30) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span aria-hidden style={{ flex: 'none', width: 30, height: 30, borderRadius: '50%', background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          </span>
          <label htmlFor="finder-input" style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16, color: '#1c2a36' }}>機能から探す</label>
          <span style={{ fontSize: 14, color: '#4d5b68' }}>すべての機能を分類ごとに並べています。画面の名前ややりたいことを入力すると、下の一覧を絞り込みます</span>
        </div>
        <div className="finder-bar" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '5px 5px 5px 18px', border: '2px solid ' + accent, borderRadius: 999, background: '#fff' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input
            id="finder-input"
            ref={inputRef}
            className="search-input no-ring"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="ここに入力して探す（例：試算表、年度更新、科目）"
            autoComplete="off"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 16, fontFamily: 'inherit', background: 'transparent', color: '#22303c', padding: '8px 0' }}
          />
          {q && <button type="button" aria-label="入力を消す" onClick={() => { setQ(''); inputRef.current?.focus(); }} style={{ flex: 'none', width: 26, height: 26, borderRadius: '50%', border: 'none', background: '#e6ecf0', color: '#5b6875', fontSize: 14, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>}
          <button type="button" data-finder-go disabled={!first} onClick={() => { if (first) go(first); }} title={first ? `「${displayName(first)}」を開きます（Enter）` : '入力すると、一致した先頭の画面を開けます'} style={{ flex: 'none', padding: '9px 24px', borderRadius: 999, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: first ? 'pointer' : 'default', opacity: first ? 1 : 0.55, whiteSpace: 'nowrap' }}>開く</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          <span style={{ fontSize: 12, color: '#4d5b68', marginRight: 2 }}>入力の例：</span>
          {FINDER_EXAMPLES.map((w) => (
            <button key={w} type="button" data-finder-example={w} onClick={() => tryWord(w)} style={{ padding: '4px 12px', borderRadius: 999, border: '1px solid ' + tint(34), background: q === w ? '#fff' : 'rgba(255,255,255,.75)', color: '#22303c', fontSize: 14, fontWeight: q === w ? 800 : 600, fontFamily: 'inherit', cursor: 'pointer' }}>{w}</button>
          ))}
          <span role="status" style={{ marginLeft: 'auto', fontSize: 12, color: '#4d5b68' }}>{searching ? <><b style={{ color: '#22303c' }}>{total}</b> 件が一致（全 {all} 件）{first && <>　Enter で「{displayName(first)}」を開きます</>}</> : <>全 <b style={{ color: '#22303c' }}>{all}</b> 件</>}</span>
        </div>
      </div>
      {/* 全機能の一覧（確認メモ #147：別画面に飛ばさず、最初からダッシュボードに表示） */}
      <div style={{ padding: '14px 16px 16px' }}>
        <FunctionDirectory groups={groups} onNavigate={go} first={first} accent={accent} />
      </div>
    </section>
  );
}
