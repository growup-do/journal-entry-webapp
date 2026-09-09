// 機能一覧（フッターから同じタブで表示：?page=features）
// このプロトタイプで作成した画面と機能の洗い出し。印刷／PDF保存に対応。

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { FEATURE_GROUPS, type FeatureScreen, type FeatureStatus } from '../features';
import { backToApp } from './Footer';

/** 画面カードの「画面を開く」：アプリ内の画面は ?open=画面名（＋mode／year）で開く。静的ページは ?page=…。 */
const openLink = (l: NonNullable<FeatureScreen['link']>) => {
  if (l.url) { window.location.assign(window.location.pathname + l.url); return; }
  const q = new URLSearchParams();
  q.set('open', l.page ?? 'ホーム');
  if (l.mode) q.set('mode', l.mode);
  if (l.year) q.set('year', l.year);
  window.location.assign(window.location.pathname + '?' + q.toString());
};

const STATUS: Record<FeatureStatus, { bg: string; fg: string }> = { 作成済: { bg: '#eaf5ef', fg: '#1f7a52' }, 叩き台: { bg: '#fff1b8', fg: '#8a6d00' }, 未作成: { bg: '#f1f4f6', fg: '#7a8794' } };

export function FeatureListPage() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FeatureStatus | 'すべて'>('すべて');
  const groups = useMemo(() => FEATURE_GROUPS.map((g) => ({ ...g, screens: g.screens.filter((s) => (filter === 'すべて' || s.status === filter) && (!q || s.name.includes(q) || s.summary.includes(q) || s.features.some((f) => f.includes(q)))) })).filter((g) => g.screens.length > 0), [q, filter]);
  // 画面数は「画面の分類」だけを数える（共通基盤・未実装／要確認は画面ではないので除外）
  const screens = FEATURE_GROUPS.filter((g) => !g.kind).flatMap((g) => g.screens);
  const commons = FEATURE_GROUPS.filter((g) => g.kind === 'feature').flatMap((g) => g.screens);
  const count = (st: FeatureStatus) => screens.filter((s) => s.status === st).length;
  const featureCount = FEATURE_GROUPS.flatMap((g) => g.screens).reduce((n, s) => n + s.features.length, 0);
  const unit = (g: { kind?: string }) => (g.kind ? '項目' : '画面');
  // 小画面（モーダル・説明ページ・タブなど）は共通機能のものも含めて数える
  const subCount = (list: { subs?: { count: number }[] }[]) => list.reduce((n, s) => n + (s.subs?.reduce((a, b) => a + b.count, 0) ?? 0), 0);
  const subTotal = subCount(FEATURE_GROUPS.flatMap((g) => g.screens));
  const badge = (st: FeatureStatus): CSSProperties => ({ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: STATUS[st].bg, color: STATUS[st].fg, whiteSpace: 'nowrap' });

  return (
    <div style={{ minHeight: '100vh', background: '#f3f5f7', fontFamily: "'Noto Sans JP', sans-serif", color: '#22303c' }}>
      <style>{`@media print { .no-print { display: none !important } body { background: #fff } .fl-card { box-shadow: none !important; break-inside: avoid } }`}</style>
      {/* ヘッダー */}
      <header className="no-print" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid #dde4ea', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, background: '#1f7a52', color: '#fff', borderRadius: 8, fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700 }}>会</span>
        <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 17 }}>会計基準システム　機能一覧（サイトマップ）</div>
        <span style={{ fontSize: 12, color: '#7a8794' }}>Web版プロトタイプ　{new Date().toLocaleDateString('ja-JP')} 時点</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="画面名・機能で検索" style={{ width: 240, padding: '7px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
          {(['すべて', '作成済', '叩き台', '未作成'] as const).map((st) => <button key={st} type="button" onClick={() => setFilter(st)} style={{ padding: '6px 12px', borderRadius: 14, border: '1px solid ' + (filter === st ? '#1f7a52' : '#d3dbe3'), background: filter === st ? '#1f7a52' : '#fff', color: filter === st ? '#fff' : '#5b6773', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{st}</button>)}
          <button type="button" onClick={() => window.print()} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #cfd8e0', background: '#fff', color: '#22303c', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>印刷／PDF保存</button>
          <button type="button" onClick={backToApp} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #1f7a52', background: '#1f7a52', color: '#fff', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>← システムに戻る</button>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 28px 60px' }}>
        {/* サマリー */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[['画面数', `${screens.length}`], ['小画面', `${subTotal}`], ['合計（画面＋小画面）', `${screens.length + subTotal}`], ['作成済', `${count('作成済')}`], ['叩き台', `${count('叩き台')}`], ['共通機能', `${commons.length}`], ['機能項目', `${featureCount}`]].map(([l, v]) => (
            <div key={l} className="fl-card" style={{ background: '#fff', border: '1px solid #dde4ea', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8290a0' }}>{l}</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* 目次 */}
        <nav className="no-print fl-card" style={{ background: '#fff', border: '1px solid #dde4ea', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FEATURE_GROUPS.map((g) => <a key={g.key} href={`#${g.key}`} style={{ fontSize: 12.5, fontWeight: 600, color: '#1f7a52', textDecoration: 'none', padding: '4px 10px', border: '1px solid #e2e8ee', borderRadius: 14 }}>{g.title}</a>)}
        </nav>

        {groups.length === 0 && <div style={{ textAlign: 'center', color: '#9aa5b1', padding: 40 }}>該当する項目がありません。</div>}
        {groups.map((g) => (
          <section key={g.key} id={g.key} style={{ marginBottom: 26 }}>
            <h2 style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontSize: 17, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
              {g.title}
              <span style={{ fontSize: 12, fontWeight: 500, color: '#7a8794' }}>{g.screens.length} {unit(g)}{subCount(g.screens) > 0 && `（小画面 ${subCount(g.screens)}）`}</span>
            </h2>
            {g.note && <div style={{ fontSize: 12, color: '#7a8794', marginBottom: 8 }}>{g.note}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
              {g.screens.map((s) => (
                <article key={s.name} className="fl-card" style={{ background: '#fff', border: '1px solid #dde4ea', borderRadius: 12, padding: '14px 16px', boxShadow: '0 4px 14px rgba(30,50,70,.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, flex: 1 }}>{s.name}</div>
                    <span style={badge(s.status)}>{s.status}</span>
                    {s.link && (
                      <button type="button" className="no-print" data-open={s.name} onClick={() => openLink(s.link!)} title="この画面を開く" style={{ padding: '3px 9px', border: '1px solid #cfd8e0', borderRadius: 7, background: '#fff', color: '#1f7a52', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        画面を開く →
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#5b6773', lineHeight: 1.6, marginBottom: 8 }}>{s.summary}</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.75, color: '#22303c' }}>
                    {s.features.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                  {s.subs && s.subs.length > 0 && (
                    <div style={{ marginTop: 10, padding: '8px 10px', background: '#f8fafc', border: '1px solid #e8edf2', borderRadius: 8, fontSize: 12, lineHeight: 1.7, color: '#5b6773' }}>
                      <span style={{ fontWeight: 700, color: '#22303c' }}>小画面 {s.subs.reduce((a, b) => a + b.count, 0)}</span>
                      <span style={{ color: '#c3ccd4', margin: '0 6px' }}>｜</span>
                      {s.subs.map((b) => `${b.name}${b.count > 1 ? ` ×${b.count}` : ''}`).join('、')}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
        <div style={{ fontSize: 11, color: '#9aa5b1', marginTop: 20 }}>※ 表示している金額・件数はすべてサンプルです。「作成済」はプロトタイプとして操作できる状態、「叩き台」は構成案の段階を指します。</div>
      </div>
    </div>
  );
}
