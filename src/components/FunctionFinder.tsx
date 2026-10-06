// 機能から探す（依頼書 5.2.2「機能一覧型」／1.2 課題1「どこに何の機能があるか分かりにくい」）
//   FunctionFinderPage … メニュー右端の「機能から探す」から開く画面。全機能を分類ごとに並べ、検索で絞り込む。
//   FinderSearch       … ホームに置く検索窓。入力すると候補を出し、選ぶとその画面へ移動する。

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { HOME_CHECKS, MENU_GROUPS, SETTINGS_GROUPS, displayName, isOptionMenu } from '../data';
import { startKindOf, useSession } from '../store/session';

interface Group { key: string; label: string; note: string; danger: boolean; items: string[] }
/** 検索対象：メインメニュー＋各種設定（Web版の追加案は除く）＋ホーム・機能一覧 */
function allGroups(): Group[] {
  return [
    ...MENU_GROUPS.map((g) => ({ key: g.key, label: g.label, note: '', danger: false, items: g.items })),
    { key: 'audit', label: '調査・チェック', note: 'ホーム（ダッシュボード）から開きます', danger: false, items: HOME_CHECKS },
    ...SETTINGS_GROUPS.filter((g) => g.key !== 'web').map((g) => ({ key: 's-' + g.key, label: '各種設定 › ' + g.label, note: g.note ?? '', danger: !!g.danger, items: g.items })),
  ];
}
/** 旧名称・別名でも探せるようにする（サポートが口頭で案内しやすいように） */
const ALIASES: Record<string, string[]> = {
  伝票入力: ['仕訳伝票', '伝票', '仕訳'], 単一入力: ['単一式', '単一'], 振替入力: ['振替伝票', '振替'], 振替単一: ['振替単一式'],
  仕訳一覧: ['日記帳', '仕訳日記帳', '問合'], 勘定元帳: ['総勘定元帳', '元帳'], 資金元帳: ['元帳'], 業者元帳: ['業者別支払一覧', '元帳'],
  月次試算: ['試算表', '試算'], 月次決算: ['決算書', '決算'], 予算対比: ['予算対比表', '予算'], 日次調査: ['同額', '不一致', '検索'], 決算調査: ['決算チェック', 'チェック'],
  充実残額: ['社会福祉充実残額', 'シミュレーター'], 印刷センター: ['印刷', '帳票', '一括印刷', 'まとめて印刷'],
  事業者: ['法人', '区分', '部門情報'], 勘定科目: ['科目', '科目設定', '科目マスター', '資金科目', '勘定費目', '資金費目', '使用科目', '使用科目設定更新', '補助簿', '明細表'], 取引先: ['業者', '合算集計用', '業者マスター'], 摘要辞書: ['摘要', '摘要マスター', '自動補完'], 開始残高: ['残高', '繰越'], 予算: ['予算額'],
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

/* ---------------- 画面 ---------------- */
export function FunctionFinderPage({ onNavigate, initialQuery = '' }: { accent: string; onNavigate: (label: string) => void; initialQuery?: string }) {
  const s = useSession();
  const [q, setQ] = useState(initialQuery);
  const kind = startKindOf(s);
  const groups = useMemo(() => allGroups().map((g) => ({ ...g, items: g.items.filter((l) => matchesFunction(l, q) || g.label.includes(q.trim())) })).filter((g) => g.items.length > 0), [q]);
  const total = groups.reduce((a, g) => a + g.items.length, 0);
  const card: CSSProperties = { background: '#fff', border: '1px solid #dde4ea', borderRadius: 14, boxShadow: '0 6px 26px rgba(30,50,70,.06)', overflow: 'hidden' };
  return (
    <main style={{ flex: 1, minWidth: 0, padding: 28, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1280 }}>
        <section style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 22px 14px', borderBottom: '1px solid #eef2f5', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 21 }}>機能から探す</div>
              <div style={{ color: '#7a8794', fontSize: 12, marginTop: 4 }}>すべての機能を分類ごとに並べています。画面名・旧メニュー名・キーワードで絞り込めます。</div>
            </div>
            <input autoFocus className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="例：試算表、年度更新、科目、元帳" autoComplete="off" style={{ marginLeft: 'auto', width: 320, padding: '9px 12px', border: '1px solid #cfd8e0', borderRadius: 9, fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }} />
            <span style={{ fontSize: 12, color: '#7a8794' }}><b style={{ color: '#22303c' }}>{total}</b> 件</span>
          </div>
          <div style={{ padding: '14px 18px 6px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            {groups.length === 0 && <div style={{ gridColumn: '1 / -1', padding: 30, textAlign: 'center', color: '#9aa5b1', fontSize: 13 }}>該当する機能がありません。別の言葉でお試しください。</div>}
            {groups.map((g) => (
              <div key={g.key} style={{ border: '1px solid ' + (g.danger ? '#f2c9c2' : '#e2e8ee'), background: g.danger ? '#fdf5f3' : '#fbfcfd', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: g.danger ? '#c0392b' : '#3d4a56' }}>{g.label}</div>
                {g.note && <div style={{ fontSize: 10.5, color: g.danger ? '#b5564a' : '#9aa5b1', marginTop: 1 }}>{g.note}</div>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                  {g.items.map((l) => {
                    const missing = isOptionMenu(l) && !s.options[l];
                    const off = ['単一入力', '伝票入力', '振替入力', '振替単一'].includes(l) && kind !== '入力区分';
                    return (
                      <button key={l} type="button" className="btn-outline" onClick={() => onNavigate(l)} title={off ? `${kind}で起動中は利用できません` : undefined} style={{ padding: '5px 10px', border: '1px solid ' + (g.danger ? '#f2c9c2' : '#cfd8e0'), borderRadius: 8, background: '#fff', color: off ? '#b3bcc5' : g.danger ? '#c0392b' : '#22303c', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                        {displayName(l)}{missing && <span style={{ marginLeft: 5, fontSize: 9.5, color: '#b7791f' }}>未導入</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

/* ---------------- ホームの検索窓 ---------------- */
/** ホームの検索窓に出す入力例（押すとその言葉で検索する） */
const FINDER_EXAMPLES = ['試算表', '元帳', '科目', '年度更新', 'バックアップ', '印刷'];
export function FinderSearch({ accent, onNavigate, full }: { accent: string; onNavigate: (label: string) => void; /** 置き場所の横幅いっぱいに広げる（ホーム） */ full?: boolean }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hits = useMemo(() => {
    if (!q.trim()) return [] as { key: string; group: string }[];
    const out: { key: string; group: string }[] = [];
    allGroups().forEach((g) => g.items.forEach((l) => { if (matchesFunction(l, q)) out.push({ key: l, group: g.label }); }));
    return out.slice(0, 8);
  }, [q]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  const go = (key: string) => { setOpen(false); setQ(''); onNavigate(key); };
  const inputRef = useRef<HTMLInputElement>(null);
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || (e.nativeEvent as unknown as { keyCode: number }).keyCode === 229) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(hits.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (hits[idx]) go(hits[idx].key); else onNavigate('機能から探す'); }
    else if (e.key === 'Escape') setOpen(false);
  };
  const results = open && q.trim() && (
    <div role="listbox" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', border: '1px solid #dde4ea', borderRadius: 10, boxShadow: '0 12px 32px rgba(24,42,62,.16)', padding: 6, zIndex: 80 }}>
      {hits.length === 0 && <div style={{ padding: '10px 12px', fontSize: 12.5, color: '#9aa5b1' }}>該当する機能がありません</div>}
      {hits.map((h, i) => (
        <button key={h.key} type="button" onMouseEnter={() => setIdx(i)} onClick={() => go(h.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', borderRadius: 7, background: i === idx ? '#eef2f6' : 'transparent', fontFamily: 'inherit', fontSize: 13, color: '#22303c', cursor: 'pointer' }}>
          <span style={{ fontWeight: 600 }}>{displayName(h.key)}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9aa5b1' }}>{h.group}</span>
        </button>
      ))}
      <div style={{ borderTop: '1px solid #eef2f5', marginTop: 4, padding: '6px 10px 2px', fontSize: 11, color: '#9aa5b1' }}>Enter で開く　／　<span onClick={() => onNavigate('機能から探す')} style={{ color: accent, cursor: 'pointer', fontWeight: 700 }}>すべての機能を見る ›</span></div>
    </div>
  );

  // ホーム用：白いカードと見分けがつくよう、色つきの帯＋丸い大きな入力欄にする
  if (full) {
    const tint = (pct: number) => `color-mix(in srgb, ${accent} ${pct}%, #fff)`;
    const tryWord = (w: string) => { setQ(w); setIdx(0); setOpen(true); inputRef.current?.focus(); };
    return (
      <div ref={ref} data-finder-search style={{ position: 'relative', width: '100%', padding: '16px 20px 14px', borderRadius: 14, background: tint(10), border: '1px solid ' + tint(30), ['--finder-accent' as string]: accent }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span aria-hidden style={{ flex: 'none', width: 30, height: 30, borderRadius: '50%', background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          </span>
          <label htmlFor="finder-input" style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16, color: '#1c2a36' }}>機能から探す</label>
          <span style={{ fontSize: 12, color: '#4d5b68' }}>画面の名前や、やりたいことを入力すると、その画面へ移動できます</span>
          <button type="button" data-finder-all onClick={() => onNavigate('機能から探す')} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: accent, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', padding: 0 }}>すべての機能を一覧で見る ›</button>
        </div>
        <div style={{ position: 'relative', marginTop: 12 }}>
          <div className="finder-bar" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 5px 5px 18px', border: '2px solid ' + accent, borderRadius: 999, background: '#fff' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input
              id="finder-input"
              ref={inputRef}
              className="search-input no-ring"
              value={q}
              onChange={(e) => { setQ(e.target.value); setOpen(true); setIdx(0); }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKey}
              placeholder="ここに入力して探す"
              autoComplete="off"
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 15.5, fontFamily: 'inherit', background: 'transparent', color: '#22303c', padding: '8px 0' }}
            />
            {q && <button type="button" aria-label="入力を消す" onClick={() => { setQ(''); inputRef.current?.focus(); }} style={{ flex: 'none', width: 26, height: 26, borderRadius: '50%', border: 'none', background: '#e6ecf0', color: '#5b6875', fontSize: 14, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>}
            <button type="button" data-finder-go onClick={() => { if (hits[idx]) go(hits[idx].key); else onNavigate('機能から探す'); }} style={{ flex: 'none', padding: '9px 24px', borderRadius: 999, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>探す</button>
          </div>
          {results}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          <span style={{ fontSize: 11.5, color: '#4d5b68', marginRight: 2 }}>入力の例：</span>
          {FINDER_EXAMPLES.map((w) => (
            <button key={w} type="button" data-finder-example={w} onClick={() => tryWord(w)} style={{ padding: '4px 12px', borderRadius: 999, border: '1px solid ' + tint(34), background: 'rgba(255,255,255,.75)', color: '#22303c', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{w}</button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} data-finder-search style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 420 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 12px', border: '1px solid #cfd8e0', borderRadius: 10, background: '#fff' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8290a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        <input
          ref={inputRef}
          className="search-input"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setIdx(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="機能から探す（例：試算表、年度更新、科目）"
          autoComplete="off"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit', background: 'transparent', color: '#22303c' }}
        />
        <button type="button" onClick={() => onNavigate('機能から探す')} title="すべての機能を分類ごとに見る" style={{ border: 'none', background: 'transparent', color: accent, fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>一覧 ›</button>
      </div>
      {results}
    </div>
  );
}
