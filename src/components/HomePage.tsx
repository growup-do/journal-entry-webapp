// ホーム：機能から探す（検索ボックス＋全機能の一覧）／お気に入りメニュー／FAQ／バナースペース
//   「調査・チェック」の枠は、機能一覧ができたのでなくした。仕訳数・日次調査・決算調査はヘッダーの区分名の横のボタンから開く（確認メモ #242）。
//   表示するメニューと最初に表示する画面は、ヘッダーの「各種設定」›「ダッシュボード表示オプション」で選ぶ（確認メモ #152）。
//   お知らせはヘッダーのベルへ（#151）、預金残高は「推移・分析」›「預金残高」へ移した（#149）。「伝票入力をはじめる」ボタンは廃止（#150）。
//   年度更新の時期には、上部に年度更新を促す案内を表示する。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { ToastView, useToast } from './Toast';
import { HOME_FAQ, displayName } from '../data';
import { FinderPanel } from './FunctionFinder';
import { FavoritesEditModal } from './FavoritesEditModal';
import { useSession } from '../store/session';
import { SUPPORT_URL } from './SettingsMenu';

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  onNavigate: (label: string) => void;
}

export function HomePage({ variant, accent, onNavigate }: Props) {
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [favEdit, setFavEdit] = useState(false);
  // 年度更新を促す案内（「あとで」で、この画面を開いている間だけ閉じる）
  const [yearNotice, setYearNotice] = useState(true);
  const s = useSession();
  const toast = useToast();
  const isSheet = variant === 'sheet';
  const card: CSSProperties = { background: '#fff', border: '1px solid #dde4ea', borderRadius: 14, boxShadow: '0 6px 26px rgba(30,50,70,.06)', overflow: 'hidden' };
  const h2: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid #eef2f5', fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16 };
  const link: CSSProperties = { marginLeft: 'auto', fontSize: 14, color: accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' };
  const show = s.homeSections;
  const hasRight = show.banners;
  const nextYear = s.currentYear.replace(/(\d+)/, (d) => String(Number(d) + 1));

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <ToastView msg={toast.msg} />
      <div style={{ width: '100%', maxWidth: isSheet ? 'none' : 1280, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* 見出し行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 21 }}>ホーム</div>
          <span style={{ fontSize: 14, color: '#7a8794' }}>{s.fiscalYear}　{s.division}</span>
        </div>

        {/* 年度更新を促す案内 */}
        {yearNotice && (
          <div data-year-notice role="status" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', border: '1px solid #f0c98a', borderRadius: 14, background: '#fff8ea', flexWrap: 'wrap' }}>
            <span aria-hidden style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: '#f5a623', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800 }}>!</span>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#7a4a00' }}>年度更新の時期です</div>
              <div style={{ fontSize: 14, color: '#7a5a1e', marginTop: 3, lineHeight: 1.7 }}>{s.currentYear}の決算が確定したら、年度更新を行って {nextYear} へ残高を繰り越してください。年度更新を行うまで、{nextYear} の伝票は入力できません。</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
              <button type="button" onClick={() => setYearNotice(false)} style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid #e2c48f', background: '#fff', color: '#7a5a1e', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>あとで</button>
              {s.role === '入力可'
                ? <button type="button" data-menu="年度更新" onClick={() => onNavigate('年度更新')} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: '#b7791f', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>年度更新へ進む ›</button>
                : <span style={{ alignSelf: 'center', fontSize: 12, color: '#7a5a1e' }}>年度更新は入力権限のある方が行います</span>}
            </div>
          </div>
        )}

        {/* 機能から探す：検索ボックス＋全機能の一覧。別画面に飛ばさず、最初からダッシュボードに表示する（確認メモ #147／#148）。
            分類が多いので、2列の上に横幅いっぱいで置く */}
        <FinderPanel accent={accent} onNavigate={onNavigate} />

        <div style={{ display: 'grid', gridTemplateColumns: hasRight ? 'minmax(0,1.6fr) minmax(280px,1fr)' : 'minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
        {/* 左列 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

          {/* お気に入りメニュー */}
          {show.favorites && <section style={card}>
            <div style={h2}>お気に入りメニュー<button type="button" style={link} onClick={() => setFavEdit(true)}>編集 ›</button></div>
            <div style={{ display: 'flex', gap: 8, padding: 16, flexWrap: 'wrap' }}>
              {s.favorites.map((l) => (
                <button key={l} type="button" className="btn-outline" onClick={() => onNavigate(l)} style={{ padding: '9px 16px', border: '1px solid #cfd8e0', borderRadius: 9, background: '#fff', color: '#22303c', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}> {displayName(l)}</button>
              ))}
              {s.favorites.length === 0 && <span style={{ fontSize: 14, color: '#9aa5b1' }}>「編集」からよく使う画面を登録できます。</span>}
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
                    <button type="button" onClick={() => setFaqOpen(on ? null : i)} aria-expanded={on} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '12px 18px', border: 'none', background: on ? '#f8fafc' : 'transparent', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', color: '#22303c' }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: accent, color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>Q</span>
                      <span style={{ flex: 1 }}>{f.q}</span>
                      <span style={{ color: '#9aa5b1', transform: on ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                    </button>
                    {on && <div style={{ padding: '0 18px 14px 50px', fontSize: 14, color: '#48565f', lineHeight: 1.8 }}>{f.a}</div>}
                  </div>
                );
              })}
            </div>
          </section>}
        </div>

        {/* 右列 */}
        {hasRight && <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* バナースペース */}
          {show.banners && <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['バナースペース①', 336, 120], ['バナースペース②', 336, 120], ['バナースペース③', 336, 80]].map(([label, w, h]) => (
              <div key={label as string} style={{ height: h as number, border: '2px dashed #cfd8e0', borderRadius: 12, background: 'repeating-linear-gradient(45deg, #fbfcfd, #fbfcfd 10px, #f3f6f9 10px, #f3f6f9 20px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9aa5b1', fontSize: 14, fontWeight: 700 }}>
                {label}
                <span style={{ fontSize: 12, fontWeight: 500 }}>{w}×{h} 想定・画像差し替え可</span>
              </div>
            ))}
          </section>}
        </div>}
        </div>
      </div>

      <FavoritesEditModal open={favEdit} onClose={() => setFavEdit(false)} accent={accent} />
    </main>
  );
}
