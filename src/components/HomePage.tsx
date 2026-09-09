// ホーム：銀行の預金残高／お知らせ／FAQ／バナースペース（＋よく使う操作）

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { NOT_IMPL, ToastView, useToast } from './Toast';
import { HOME_BANKS, HOME_FAQ, HOME_NOTICES } from '../data';

const yen = (n: number) => n.toLocaleString('ja-JP');
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
  const toast = useToast();
  const isSheet = variant === 'sheet';
  const total = HOME_BANKS.reduce((a, b) => a + b.balance, 0);
  const card: CSSProperties = { background: '#fff', border: '1px solid #dde4ea', borderRadius: 14, boxShadow: '0 6px 26px rgba(30,50,70,.06)', overflow: 'hidden' };
  const h2: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid #eef2f5', fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 15 };
  const link: CSSProperties = { marginLeft: 'auto', fontSize: 12, color: accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' };

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <ToastView msg={toast.msg} />
      <div style={{ width: '100%', maxWidth: isSheet ? 'none' : 1280, display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(280px,1fr)', gap: 20, alignItems: 'start' }}>
        {/* 左列 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* 銀行の預金残高 */}
          <section style={card}>
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
          </section>

          {/* よく使う操作 */}
          <section style={card}>
            <div style={h2}>よく使う操作</div>
            <div style={{ display: 'flex', gap: 8, padding: 16, flexWrap: 'wrap' }}>
              {['単一入力', '伝票入力', '仕訳一覧', '勘定元帳', '月次試算', '日次調査'].map((l) => (
                <button key={l} type="button" className="btn-outline" onClick={() => onNavigate(l)} style={{ padding: '9px 16px', border: '1px solid #cfd8e0', borderRadius: 9, background: '#fff', color: '#22303c', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section style={card}>
            <div style={h2}>よくある質問（FAQ）<button type="button" style={link} onClick={() => toast.show(NOT_IMPL)}>すべて見る ›</button></div>
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
          </section>
        </div>

        {/* 右列 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* お知らせ */}
          <section style={card}>
            <div style={h2}>お知らせ<button type="button" style={link} onClick={() => toast.show(NOT_IMPL)}>一覧 ›</button></div>
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
          </section>

          {/* バナースペース */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['バナースペース①', 336, 120], ['バナースペース②', 336, 120], ['バナースペース③', 336, 80]].map(([label, w, h]) => (
              <div key={label as string} style={{ height: h as number, border: '2px dashed #cfd8e0', borderRadius: 12, background: 'repeating-linear-gradient(45deg, #fbfcfd, #fbfcfd 10px, #f3f6f9 10px, #f3f6f9 20px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9aa5b1', fontSize: 12, fontWeight: 700 }}>
                {label}
                <span style={{ fontSize: 10.5, fontWeight: 500 }}>{w}×{h} 想定・画像差し替え可</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
