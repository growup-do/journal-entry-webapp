// 機能から探す（依頼書 5.2.2「機能一覧型」／1.2 課題1「どこに何の機能があるか分かりにくい」）
//   FunctionDirectory  … 全機能を分類ごとに並べた一覧（検索語で絞り込む）。ホームと「機能から探す」画面で共用。
//   FinderPanel        … ホーム（ダッシュボード）に置く「機能から探す」：検索ボックス＋全機能の一覧。
//                        別画面には飛ばさず、検索ボックスに入力するとその場で一覧を絞り込む（確認メモ #147／#148）。
//   FunctionFinderPage … 左メニューの「機能から探す」から開く画面（中身はホームと同じ一覧）。
//   重要度（確認メモ #241）：重要度の高い機能はアイコンつきの大きなタイル、中の機能はアイコンつきのやや大きいボタン、ほかは従来のボタンで出す。

import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { HOME_CHECKS, MENU_GROUPS, SETTINGS_GROUPS, displayName, settingsMenuName } from '../data';
import { startKindOf, useSession } from '../store/session';
import { canOpen, type Access } from '../store/access';

interface Group { key: string; label: string; note: string; danger: boolean; items: string[] }
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
/** 重要度つきの機能のアイコン（24×24 の線画） */
const ICONS: Record<string, ReactNode> = {
  伝票入力: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /><path d="M9 12h7M9 16h7" /></>,
  印刷センター: <><path d="M7 8V3h10v5" /><path d="M7 17H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-3" /><path d="M7 13h10v8H7z" /></>,
  小口現金: <><path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10v3" /><path d="M20 12h-4a2 2 0 0 0 0 4h4" /></>,
  減価償却: <><path d="M3 3v18h18" /><path d="M7 8l4 4 3-3 5 6" /><path d="M19 11v4h-4" /></>,
  預金出納: <><path d="M3 10l9-6 9 6" /><path d="M4 10h16" /><path d="M6 10v8M10 10v8M14 10v8M18 10v8" /><path d="M3 21h18M4 18h16" /></>,
  決算調査: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /><path d="M8 11l2 2 4-4" /></>,
  予算: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8" /><path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" /></>,
};
function FnIcon({ name, size, color }: { name: string; size: number; color: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}>{ICONS[name]}</svg>;
}

/* ---------------- 全機能の一覧（分類ごと） ---------------- */
function FunctionDirectory({ groups, onNavigate, first, minCol = 250, accent }: { groups: Group[]; onNavigate: (label: string) => void; accent: string; /** 検索中：Enter で開く先頭の項目（強調表示） */ first?: string; /** 列の最小幅 */ minCol?: number }) {
  const kind = startKindOf(useSession());
  const tint = (pct: number) => 'color-mix(in srgb, ' + accent + ' ' + pct + '%, #fff)';
  return (
    <div data-function-directory style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))`, gap: 12 }}>
      {groups.length === 0 && <div style={{ gridColumn: '1 / -1', padding: 30, textAlign: 'center', color: '#9aa5b1', fontSize: 14 }}>該当する機能がありません。別の言葉でお試しください。</div>}
      {groups.map((g) => (
        <div key={g.key} data-function-group={g.key} style={{ border: '1px solid ' + (g.danger ? '#f2c9c2' : '#e2e8ee'), background: g.danger ? '#fdf5f3' : '#fbfcfd', borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: g.danger ? '#c0392b' : '#3d4a56' }}>{g.label}</div>
          {g.note && <div style={{ fontSize: 12, color: g.danger ? '#b5564a' : '#9aa5b1', marginTop: 1 }}>{g.note}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 8 }}>
            {g.items.map((l) => {
              const off = INPUT_ONLY.includes(l) && kind !== '入力区分';
              const hit = first === l;
              const pr = PRIORITY[l];
              const name = g.key.startsWith('s-') ? settingsMenuName(l) : displayName(l);
              const tip = off ? kind + 'で起動中は利用できません' : hit ? 'Enter でこの画面を開きます' : pr ? PRIORITY_LABEL[pr] : undefined;
              const ink = off ? '#b3bcc5' : g.danger ? '#c0392b' : '#22303c';
              const ring = hit ? '0 0 0 2px rgba(31,122,82,.18)' : 'none';
              // 重要度・高：アイコンを上に置いた大きなタイル
              if (pr === 'high') return (
                <button key={l} type="button" className="btn-outline" data-menu={'機能:' + l} data-priority="high" onClick={() => onNavigate(l)} title={tip} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, flex: '1 1 96px', minWidth: 96, padding: '11px 10px 9px', border: '2px solid ' + (hit ? '#1f7a52' : off ? '#d3dbe3' : accent), borderRadius: 10, background: hit ? '#eaf5ef' : off ? '#f7f9fa' : tint(9), color: ink, fontSize: 15, fontWeight: 800, fontFamily: 'inherit', whiteSpace: 'nowrap', cursor: 'pointer', boxShadow: ring }}>
                  <FnIcon name={l} size={30} color={off ? '#b3bcc5' : accent} />
                  {name}
                </button>
              );
              // 重要度・中：アイコンつきのやや大きいボタン
              if (pr === 'mid') return (
                <button key={l} type="button" className="btn-outline" data-menu={'機能:' + l} data-priority="mid" onClick={() => onNavigate(l)} title={tip} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px 8px 10px', border: '1.5px solid ' + (hit ? '#1f7a52' : off ? '#d3dbe3' : tint(60)), borderRadius: 9, background: hit ? '#eaf5ef' : '#fff', color: ink, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', maxWidth: '100%', textAlign: 'left', lineHeight: 1.35, cursor: 'pointer', boxShadow: ring }}>
                  <FnIcon name={l} size={20} color={off ? '#b3bcc5' : accent} />
                  {name}
                </button>
              );
              return (
                <button key={l} type="button" className="btn-outline" data-menu={'機能:' + l} onClick={() => onNavigate(l)} title={tip} style={{ padding: '5px 10px', border: '1px solid ' + (hit ? '#1f7a52' : g.danger ? '#f2c9c2' : '#cfd8e0'), borderRadius: 8, background: hit ? '#eaf5ef' : '#fff', color: ink, fontSize: 14, fontWeight: hit ? 700 : 600, fontFamily: 'inherit', cursor: 'pointer', boxShadow: ring }}>
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
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
        <FunctionDirectory groups={groups} onNavigate={go} first={first} minCol={190} accent={accent} />
      </div>
    </section>
  );
}
