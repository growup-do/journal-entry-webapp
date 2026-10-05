// ホーム：銀行の預金残高／調査・チェック／よく使う操作／FAQ／お知らせ／バナースペース
//   右上の「ダッシュボード表示オプション」で、表示するメニューと最初に表示する画面（ホーム／伝票入力）を選ぶ。
//   年度更新の時期には、上部に年度更新を促す案内を表示する。

import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ToastView, useToast } from './Toast';
import { HOME_BANKS, HOME_CHECKS, HOME_FAQ, HOME_NOTICES, IMPLEMENTED_MENU, MENU_GROUPS, SETTINGS_MENU, displayName } from '../data';
import { FinderSearch } from './FunctionFinder';
import { Modal } from './Modal';
import { HOME_SECTIONS, setSession, startKindOf, useSession } from '../store/session';
import { SUPPORT_URL } from './SettingsMenu';

const yen = (n: number) => n.toLocaleString('ja-JP');
/** 調査・チェック（メニューバーには置かず、ホームから開く）の説明 */
const CHECK_NOTE: Record<string, string> = {
  仕訳数: '月ごとの仕訳件数と、入力済みの月を確認します。',
  日次調査: '仕訳と残高の同額・不一致を検索し、不一致の日の伝票を確認します。',
  決算調査: '決算前に、残高や設定の28項目をまとめて点検します。',
};
const TAG_COLOR: Record<string, { bg: string; fg: string }> = {
  システム: { bg: '#e8f0fb', fg: '#2c5f9e' },
  法改正: { bg: '#fdeee9', fg: '#c0392b' },
  保守: { bg: '#fff1b8', fg: '#8a6d00' },
  お知らせ: { bg: '#eaf5ef', fg: '#1f7a52' },
};

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  onNavigate: (label: string) => void;
}

export function HomePage({ variant, accent, onNavigate }: Props) {
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [favEdit, setFavEdit] = useState(false);
  // ダッシュボード表示オプション（表示メニュー・最初に表示する画面）
  const [homeEdit, setHomeEdit] = useState(false);
  // 年度更新を促す案内（「あとで」で、この画面を開いている間だけ閉じる）
  const [yearNotice, setYearNotice] = useState(true);
  // お知らせ一覧（タグ絞り込み・クリックで本文を展開）
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeTag, setNoticeTag] = useState<string>('すべて');
  const [noticeExpanded, setNoticeExpanded] = useState<number | null>(null);
  const NOTICE_TAGS = ['すべて', ...Array.from(new Set(HOME_NOTICES.map((n) => n.tag)))];
  const noticeList = HOME_NOTICES.map((n, i) => ({ ...n, i })).filter((n) => noticeTag === 'すべて' || n.tag === noticeTag).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const s = useSession();
  const CANDIDATES = [...MENU_GROUPS.flatMap((g) => g.items), ...HOME_CHECKS, '元帳１', '元帳２', '残高照合', '法人印刷', ...SETTINGS_MENU].filter((l) => IMPLEMENTED_MENU.includes(l) || l === '印刷センター' || l === '予算' || SETTINGS_MENU.includes(l));
  // ドラッグ＆ドロップで並べ替え
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null); // 描画を待たずに参照できるよう ref にも保持
  const startDrag = (i: number) => { dragRef.current = i; setDrag(i); };
  const dropFav = (to: number) => { const from = dragRef.current; if (from == null || from === to) return; const f = [...s.favorites]; const [m] = f.splice(from, 1); f.splice(to, 0, m); setSession({ favorites: f }); };
  const endDrag = () => { dragRef.current = null; setDrag(null); setOver(null); };
  const toast = useToast();
  const isSheet = variant === 'sheet';
  const total = HOME_BANKS.reduce((a, b) => a + b.balance, 0);
  const card: CSSProperties = { background: '#fff', border: '1px solid #dde4ea', borderRadius: 14, boxShadow: '0 6px 26px rgba(30,50,70,.06)', overflow: 'hidden' };
  const h2: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid #eef2f5', fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 15 };
  const link: CSSProperties = { marginLeft: 'auto', fontSize: 12, color: accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' };
  const show = s.homeSections;
  const hasRight = show.notices || show.banners;
  const canEntry = startKindOf(s) === '入力区分';
  const nextYear = s.currentYear.replace(/(\d+)/, (d) => String(Number(d) + 1));

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <ToastView msg={toast.msg} />
      <div style={{ width: '100%', maxWidth: isSheet ? 'none' : 1280, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* 見出し行：右上に「ダッシュボード表示オプション」 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 21 }}>ホーム</div>
          <span style={{ fontSize: 12.5, color: '#7a8794' }}>{s.fiscalYear}　{s.division}</span>
          <button type="button" className="btn-outline" data-home-edit onClick={() => setHomeEdit(true)} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', border: '1px solid #cfd8e0', borderRadius: 9, background: '#fff', color: '#3d4a56', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            ダッシュボード表示オプション
          </button>
        </div>

        {/* 年度更新を促す案内 */}
        {yearNotice && (
          <div data-year-notice role="status" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', border: '1px solid #f0c98a', borderRadius: 14, background: '#fff8ea', flexWrap: 'wrap' }}>
            <span aria-hidden style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: '#f5a623', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800 }}>!</span>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#7a4a00' }}>年度更新の時期です</div>
              <div style={{ fontSize: 12.5, color: '#7a5a1e', marginTop: 3, lineHeight: 1.7 }}>{s.currentYear}の決算が確定したら、年度更新を行って {nextYear} へ残高を繰り越してください。年度更新を行うまで、{nextYear} の伝票は入力できません。</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
              <button type="button" onClick={() => setYearNotice(false)} style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid #e2c48f', background: '#fff', color: '#7a5a1e', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>あとで</button>
              {s.role === '入力可'
                ? <button type="button" data-menu="年度更新" onClick={() => onNavigate('年度更新')} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: '#b7791f', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>年度更新へ進む ›</button>
                : <span style={{ alignSelf: 'center', fontSize: 11.5, color: '#7a5a1e' }}>年度更新は入力権限のある方が行います</span>}
            </div>
          </div>
        )}

        {/* 伝票入力をはじめる（大きく目立たせ、横幅の中央に置く） */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button type="button" className="submit-btn" data-home-start disabled={!canEntry} title={!canEntry ? '入力区分で起動すると伝票を入力できます' : undefined} onClick={() => onNavigate('伝票入力')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '24px 34px 24px 26px', borderRadius: 16, border: 'none', background: accent, color: '#fff', fontFamily: 'inherit', cursor: !canEntry ? 'not-allowed' : 'pointer', opacity: !canEntry ? 0.45 : 1, boxShadow: '0 8px 22px rgba(31,122,82,.32)', textAlign: 'left', flex: 'none', minWidth: 360, justifyContent: 'center' }}>
              <span aria-hidden style={{ width: 48, height: 48, borderRadius: 13, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
              </span>
              <span>
                <span style={{ display: 'block', fontSize: 20, fontWeight: 700, lineHeight: 1.3, whiteSpace: 'nowrap' }}>伝票入力をはじめる</span>
                <span style={{ display: 'block', fontSize: 11.5, fontWeight: 500, opacity: 0.9, marginTop: 2, whiteSpace: 'nowrap' }}>{canEntry ? `${s.division} の伝票を入力します` : '入力区分で起動すると入力できます'}</span>
              </span>
            </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: hasRight ? 'minmax(0,1.6fr) minmax(280px,1fr)' : 'minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
        {/* 左列 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* 機能から探す（検索窓。横幅は下の預金残高と同じ。一覧はメニュー右端の「機能から探す」） */}
          <FinderSearch accent={accent} onNavigate={onNavigate} full />

          {/* 銀行の預金残高 */}
          {show.bank && <section style={card}>
            <div style={h2}>
              銀行の預金残高
              <span style={{ fontSize: 11.5, fontWeight: 500, color: '#7a8794' }}>合計 <b style={{ color: '#22303c', fontVariantNumeric: 'tabular-nums' }}>{yen(total)}</b> 円</span>
              <button type="button" style={link} onClick={() => onNavigate('残高照合')}>残高照合へ ›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, padding: 16 }}>
              {HOME_BANKS.map((b) => (
                <div key={b.name} style={{ border: '1px solid #e2e8ee', borderRadius: 12, padding: '12px 14px', background: '#fbfcfd' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{b.name}</div>
                  <div style={{ fontSize: 10.5, color: '#9aa5b1', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.bank}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginTop: 8 }}>{yen(b.balance)}<span style={{ fontSize: 11, fontWeight: 600, color: '#7a8794', marginLeft: 4 }}>円</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11 }}>
                    <span style={{ color: b.diff > 0 ? '#1f7a52' : b.diff < 0 ? '#c0392b' : '#9aa5b1', fontWeight: 700 }}>{b.diff > 0 ? '▲' : b.diff < 0 ? '▼' : '±'} {yen(Math.abs(b.diff))}<span style={{ fontWeight: 500, color: '#9aa5b1' }}> 前日比</span></span>
                    <span style={{ color: '#9aa5b1' }}>更新 {b.updated}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '0 16px 14px', fontSize: 11, color: '#9aa5b1' }}>※ 残高はサンプル値です。本番では預金出納（オプション）の銀行連携または通帳残高の入力を反映します。</div>
          </section>}

          {/* 調査・チェック：仕訳数の問合せ／同額・不一致検索／決算チェック（メニューバーには置かず、ここから開く） */}
          {show.checks && <section style={card} data-home-checks>
            <div style={h2}>調査・チェック<span style={{ fontSize: 11.5, fontWeight: 500, color: '#7a8794' }}>入力した仕訳の点検は、ここから開きます</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, padding: 16 }}>
              {HOME_CHECKS.map((l) => (
                <button key={l} type="button" className="btn-outline" data-menu={l} onClick={() => onNavigate(l)} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch', textAlign: 'left', padding: '12px 14px', border: '1px solid #cfd8e0', borderRadius: 12, background: '#fff', color: '#22303c', fontFamily: 'inherit', cursor: 'pointer', minWidth: 0 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.4 }}>{displayName(l)}</span>
                  <span style={{ fontSize: 11.5, color: '#7a8794', lineHeight: 1.6, flex: 1 }}>{CHECK_NOTE[l]}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: accent, textAlign: 'right' }}>開く ›</span>
                </button>
              ))}
            </div>
          </section>}

          {/* よく使う操作 */}
          {show.favorites && <section style={card}>
            <div style={h2}>よく使う操作（お気に入り）<button type="button" style={link} onClick={() => setFavEdit(true)}>編集 ›</button></div>
            <div style={{ display: 'flex', gap: 8, padding: 16, flexWrap: 'wrap' }}>
              {s.favorites.map((l) => (
                <button key={l} type="button" className="btn-outline" onClick={() => onNavigate(l)} style={{ padding: '9px 16px', border: '1px solid #cfd8e0', borderRadius: 9, background: '#fff', color: '#22303c', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}> {displayName(l)}</button>
              ))}
              {s.favorites.length === 0 && <span style={{ fontSize: 12.5, color: '#9aa5b1' }}>「編集」からよく使う画面を登録できます。</span>}
            </div>
          </section>}

          {/* FAQ */}
          {show.faq && <section style={card}>
            <div style={h2}>よくある質問（FAQ）<button type="button" style={link} onClick={() => window.open(SUPPORT_URL, '_blank', 'noopener')} title="サポートサイトを別タブで開きます">すべて見る（サポートサイトへ） ›</button></div>
            <div>
              {HOME_FAQ.map((f, i) => {
                const on = faqOpen === i;
                return (
                  <div key={i} style={{ borderBottom: '1px solid #f1f4f6' }}>
                    <button type="button" onClick={() => setFaqOpen(on ? null : i)} aria-expanded={on} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '12px 18px', border: 'none', background: on ? '#f8fafc' : 'transparent', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', color: '#22303c' }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: accent, color: '#fff', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>Q</span>
                      <span style={{ flex: 1 }}>{f.q}</span>
                      <span style={{ color: '#9aa5b1', transform: on ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                    </button>
                    {on && <div style={{ padding: '0 18px 14px 50px', fontSize: 13, color: '#48565f', lineHeight: 1.8 }}>{f.a}</div>}
                  </div>
                );
              })}
            </div>
          </section>}
        </div>

        {/* 右列 */}
        {hasRight && <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* お知らせ */}
          {show.notices && <section style={card}>
            <div style={h2}>お知らせ<button type="button" style={link} onClick={() => { setNoticeExpanded(null); setNoticeOpen(true); }}>一覧 ›</button></div>
            <Modal open={noticeOpen} onClose={() => setNoticeOpen(false)} width={680} title="お知らせ一覧">
              <div style={{ padding: '12px 22px 18px' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {NOTICE_TAGS.map((t) => {
                    const on = noticeTag === t;
                    const c = TAG_COLOR[t];
                    return <button key={t} type="button" className="chip" onClick={() => { setNoticeTag(t); setNoticeExpanded(null); }} style={{ padding: '5px 12px', borderRadius: 14, border: '1px solid ' + (on ? accent : '#dde4ea'), background: on ? accent : c ? c.bg : '#fff', color: on ? '#fff' : c ? c.fg : '#5b6773', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{t}<span style={{ marginLeft: 4, opacity: 0.75 }}>{t === 'すべて' ? HOME_NOTICES.length : HOME_NOTICES.filter((n) => n.tag === t).length}</span></button>;
                  })}
                </div>
                <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: '56vh', overflow: 'auto' }}>
                  {noticeList.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#9aa5b1', fontSize: 12.5 }}>該当するお知らせはありません。</div>}
                  {noticeList.map((n) => {
                    const c = TAG_COLOR[n.tag];
                    const on = noticeExpanded === n.i;
                    return (
                      <div key={n.i} style={{ borderBottom: '1px solid #f1f4f6' }}>
                        <button type="button" onClick={() => setNoticeExpanded(on ? null : n.i)} aria-expanded={on} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '11px 14px', border: 'none', background: on ? '#f8fafc' : 'transparent', fontFamily: 'inherit', cursor: 'pointer', color: '#22303c' }}>
                          <span style={{ fontSize: 11.5, color: '#9aa5b1', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{n.date}</span>
                          <span style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 8, background: c.bg, color: c.fg, fontWeight: 700, flex: 'none' }}>{n.tag}</span>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>{n.title}</span>
                          <span style={{ color: '#9aa5b1', transform: on ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                        </button>
                        {on && <div style={{ padding: '0 14px 14px 14px', fontSize: 13, color: '#48565f', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{n.body}</div>}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><button type="button" onClick={() => setNoticeOpen(false)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>閉じる</button></div>
              </div>
            </Modal>
            <div>
              {HOME_NOTICES.map((n, i) => {
                const c = TAG_COLOR[n.tag];
                return (
                  <div key={i} style={{ padding: '11px 18px', borderBottom: '1px solid #f1f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#9aa5b1' }}>
                      <span>{n.date}</span>
                      <span style={{ padding: '1px 7px', borderRadius: 8, background: c.bg, color: c.fg, fontWeight: 700 }}>{n.tag}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, lineHeight: 1.5 }}>{n.title}</div>
                    <div style={{ fontSize: 11.5, color: '#7a8794', marginTop: 2 }}>{n.body}</div>
                  </div>
                );
              })}
            </div>
          </section>}

          {/* バナースペース */}
          {show.banners && <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['バナースペース①', 336, 120], ['バナースペース②', 336, 120], ['バナースペース③', 336, 80]].map(([label, w, h]) => (
              <div key={label as string} style={{ height: h as number, border: '2px dashed #cfd8e0', borderRadius: 12, background: 'repeating-linear-gradient(45deg, #fbfcfd, #fbfcfd 10px, #f3f6f9 10px, #f3f6f9 20px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9aa5b1', fontSize: 12, fontWeight: 700 }}>
                {label}
                <span style={{ fontSize: 10.5, fontWeight: 500 }}>{w}×{h} 想定・画像差し替え可</span>
              </div>
            ))}
          </section>}
        </div>}
        </div>
      </div>

      <Modal open={favEdit} onClose={() => setFavEdit(false)} width={640} title="お気に入りメニューの設定">
              <div style={{ padding: '12px 22px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8290a0', marginBottom: 6 }}>登録済み（上から順に表示・ドラッグ＆ドロップで並べ替え）</div>
                  <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, minHeight: 200 }}>
                    {s.favorites.map((l, i) => (
                      <div
                        key={l}
                        draggable
                        onDragStart={(e) => { startDrag(i); e.dataTransfer.effectAllowed = 'move'; }}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== i) setOver(i); }}
                        onDragLeave={() => { if (over === i) setOver(null); }}
                        onDrop={(e) => { e.preventDefault(); dropFav(i); endDrag(); }}
                        onDragEnd={endDrag}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid #f1f4f6', fontSize: 13, cursor: 'grab', background: drag === i ? '#f3f6f9' : over === i && drag != null ? accent + '14' : '#fff', boxShadow: over === i && drag != null && drag !== i ? `inset 0 ${drag < i ? -2 : 2}px 0 ${accent}` : 'none', opacity: drag === i ? 0.5 : 1, userSelect: 'none' }}
                      >
                        <span aria-hidden style={{ color: '#b3bcc5', fontSize: 14, letterSpacing: -2, lineHeight: 1 }}>⋮⋮</span>
                        <span style={{ flex: 1 }}>{l}</span>
                        <button type="button" onClick={() => setSession({ favorites: s.favorites.filter((x) => x !== l) })} style={{ border: '1px solid #f2c9c2', background: '#fff', color: '#c0392b', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>解除</button>
                      </div>
                    ))}
                    {s.favorites.length === 0 && <div style={{ padding: 20, color: '#9aa5b1', fontSize: 12.5 }}>右の一覧から追加してください。</div>}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8290a0', marginBottom: 6 }}>登録できる機能（クリックで追加）</div>
                  <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: 300, overflow: 'auto' }}>
                    {CANDIDATES.filter((c) => !s.favorites.includes(c)).map((c) => <button key={c} type="button" onClick={() => setSession({ favorites: [...s.favorites, c] })} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', borderBottom: '1px solid #f1f4f6', background: '#fff', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', color: '#22303c' }}>＋ {c}</button>)}
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={() => setFavEdit(false)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>閉じる</button></div>
              </div>
            </Modal>

      {/* ダッシュボード表示オプション */}
      <Modal open={homeEdit} onClose={() => setHomeEdit(false)} width={620} title="ダッシュボード表示オプション">
        <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 18 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>最初に表示する画面</div>
            <div style={{ fontSize: 11.5, color: '#7a8794', marginBottom: 8 }}>ログインして区分を選んだあと、最初に開く画面です。次回のログインから反映します。</div>
            <div role="radiogroup" aria-label="最初に表示する画面" data-start-slider style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 4, background: '#e6ecf0', borderRadius: 13, maxWidth: 420 }}>
              <span aria-hidden style={{ position: 'absolute', top: 4, bottom: 4, left: 4, width: 'calc(50% - 4px)', borderRadius: 10, background: accent, boxShadow: '0 2px 8px rgba(31,122,82,.35)', transform: s.startScreen === '伝票入力' ? 'translateX(100%)' : 'translateX(0)', transition: 'transform .22s ease' }} />
              {([['ホーム', 'ホーム画面'], ['伝票入力', '伝票入力画面']] as const).map(([key, label]) => {
                const on = s.startScreen === key;
                return <button key={key} type="button" role="radio" aria-checked={on} data-start-screen={key} onClick={() => setSession({ startScreen: key })} style={{ position: 'relative', zIndex: 1, padding: '10px 12px', border: 'none', borderRadius: 10, background: 'transparent', color: on ? '#fff' : '#48565f', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', transition: 'color .2s' }}>{label}</button>;
              })}
            </div>
            <div style={{ fontSize: 11.5, color: '#5b6773', marginTop: 8 }}>{s.startScreen === 'ホーム' ? 'ホーム画面：残高やお知らせを確認してから作業を始めます。' : '伝票入力画面：すぐに伝票（仕訳伝票形式）の入力を始めます。'}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>ダッシュボードに表示するメニュー</div>
            <div style={{ fontSize: 11.5, color: '#7a8794', marginBottom: 8 }}>チェックを外したメニューは、ホーム画面に表示しません。「伝票入力をはじめる」と検索窓は常に表示します。</div>
            <div style={{ border: '1px solid #e2e8ee', borderRadius: 10 }}>
              {HOME_SECTIONS.map((sec, i) => (
                <label key={sec.key} data-home-section={sec.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: i ? '1px solid #f1f4f6' : 'none', cursor: 'pointer', fontSize: 13.5 }}>
                  <input type="checkbox" checked={show[sec.key]} onChange={(e) => setSession({ homeSections: { ...show, [sec.key]: e.target.checked } })} style={{ width: 17, height: 17, accentColor: accent }} />
                  <b style={{ width: 210, flex: 'none' }}>{sec.label}</b>
                  <span style={{ fontSize: 11.5, color: '#7a8794', flex: 1 }}>{sec.note}</span>
                  {sec.key === 'favorites' && <button type="button" onClick={(e) => { e.preventDefault(); setFavEdit(true); }} style={{ flex: 'none', padding: '5px 10px', borderRadius: 7, border: '1px solid ' + accent, background: '#fff', color: accent, fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>登録する画面を編集</button>}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={() => setHomeEdit(false)} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>閉じる</button></div>
        </div>
      </Modal>
    </main>
  );
}
