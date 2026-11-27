// 帳票の印刷（確認メモ #238：現行の印刷メニューに合わせた階層）
//   大区分＝メニューの「帳票の印刷」。画面上部のタブが中区分（仕訳日記帳・元帳・試算表・予算・決算書・別紙 …）。
//   左の一覧は小区分の見出し（予算書・予算書（拠点区分）・予算管理表 など）とその下の帳票。右は選んだ帳票の詳細設定と印刷。
//   レイアウトは別紙の画面（左に見出しつきの一覧、右に見出し・タグ・内容）にそろえた。中区分「別紙」は別紙の画面をそのまま描く。
//   表示条件を満たさない帳票は一覧に出さない（「表示条件を満たさない帳票も表示」で薄く表示し、条件を確かめられる）。
//   まとめて印刷（旧「一括印刷」）は上部のボタンから、中区分をまたいで帳票を選ぶ。

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AppendixPrintPage } from './AppendixPrintPage';
import { Modal } from './Modal';
import { OUTPUTS, PreviewModal, PrintFlow, sampleReportData } from './PrintCenter';
import { PrintOutDialog } from './PrintOutDialog';
import { ToastView, useToast } from './Toast';
import { Notice, PrintIcon, SettingsShell, TabStrip, btn, card, lbl, tabBtn } from './ui';
import { WAMNET_ITEMS, WamnetDialog, type WamnetItem } from './WamnetDialog';
import { CATS, condOk, localizeReports, subsOf, type ReportDef } from './printCatalog';
import { displayName } from '../data';
import { useSession } from '../store/session';

const tag = (label: string, bg: string, fg: string, title?: string): ReactNode => <span title={title} style={{ fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 8, background: bg, color: fg, whiteSpace: 'nowrap' }}>{label}</span>;

/** 最後に開いていた中区分と帳票（ほかの画面へ移ってから「← 帳票の印刷に戻る」で戻ったときに、同じ帳票を開く） */
const lastView: { cat: string | null; curOf: Record<string, string> } = { cat: null, curOf: {} };

export function PrintCenterPage({ variant, accent, onNavigate, initialCat }: { variant: 'form' | 'sheet'; accent: string; onNavigate?: (label: string) => void; /** 最初に開く中区分（旧「別紙」の画面キーから来たとき） */ initialCat?: string }) {
  const s = useSession();
  const toast = useToast();
  const [cat, setCat] = useState(initialCat && CATS.includes(initialCat) ? initialCat : lastView.cat && CATS.includes(lastView.cat) ? lastView.cat : CATS[0]);
  /** 中区分ごとに最後に選んだ帳票 */
  const [curOf, setCurOf] = useState<Record<string, string>>(() => ({ ...lastView.curOf }));
  useEffect(() => { lastView.cat = cat; lastView.curOf = curOf; }, [cat, curOf]);
  const [showAll, setShowAll] = useState(false);
  const [preview, setPreview] = useState<{ title: string; opts: { from: string; to: string; output: string; hideZero?: boolean } } | null>(null);
  const [wamnet, setWamnet] = useState<WamnetItem | null>(null);
  // まとめて印刷
  const [pickOpen, setPickOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(['j1', 'l1', 't1', 't2', 't3']));

  const ok = (r: ReportDef) => condOk(r, s);
  // 帳票名の「○○」は起動中の区分が属する区分の名前で埋め、補助簿（明細表）は設定した科目ごとに出す（確認メモ #355・#356・#361〜#363）
  const REPORTS = localizeReports(s);
  const inCat = REPORTS.filter((r) => r.cat === cat);
  const list = inCat.filter((r) => showAll || ok(r));
  const hidden = inCat.filter((r) => !ok(r)).length;
  const cur = list.find((r) => r.id === curOf[cat]) ?? list.find(ok) ?? list[0];
  const go = (label: string) => onNavigate?.(label);

  const batchPool = REPORTS.filter((r) => !r.wamnet && ok(r));
  const picked = batchPool.filter((r) => selected.has(r.id));
  const toggle = (id: string) => setSelected((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const batchData = () => ({ header: ['帳票名', '科目', '当月', '累計'], rows: picked.flatMap((r) => sampleReportData(r.name).rows.map((row) => [r.name, ...row])) });

  return (
    <SettingsShell variant={variant} title={displayName('印刷センター')} actions={<>
      <button type="button" className="btn-outline" data-open-common-page onClick={() => go('共通の印刷設定')} style={btn()}>{displayName('共通の印刷設定')}</button>
      <button type="button" className="btn-outline" data-print-batch onClick={() => setPickOpen(true)} title="分類をまたいで帳票を選び、一度に出力します（旧「一括印刷」）" style={{ ...btn(accent), display: 'inline-flex', alignItems: 'center', gap: 6 }}><PrintIcon />まとめて印刷</button>
    </>}>
      <ToastView msg={toast.msg} />
      {/* 中区分 */}
      {/* 中区分はタブ（減価償却ページのタブと同じ形）。幅が足りないときは横にスクロール */}
      <TabStrip aria-label="帳票の分類" data-print-cats accent={accent} style={{ flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'thin' }}>
        {CATS.map((c) => {
          const on = c === cat;
          return (
            <button key={c} type="button" role="tab" aria-selected={on} className="tab-btn" data-print-cat={c} onClick={() => setCat(c)} style={{ ...tabBtn(on, accent), flex: 'none' }}>
              {c}
            </button>
          );
        })}
      </TabStrip>

      {cat === '別紙' ? <AppendixPrintPage embedded variant={variant} accent={accent} onNavigate={onNavigate} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0,1fr)', minHeight: 520, alignItems: 'start' }}>
          {/* 左：小区分の見出しと帳票 */}
          <nav aria-label={`${cat}の帳票`} data-print-list style={{ borderRight: '1px solid #eef2f5', padding: 10, maxHeight: 'calc(100vh - 230px)', overflow: 'auto', alignSelf: 'stretch' }}>
            {subsOf(cat).filter((g) => list.some((r) => (r.sub ?? cat) === g)).map((g, gi) => {
              const items = list.filter((r) => (r.sub ?? cat) === g);
              // 小区分の間に区切り線を入れて、見出しのまとまりを分かりやすくする
              return (
                <div key={g} data-print-sub={g} style={{ borderTop: gi > 0 ? '1px solid #e2e8ee' : 'none', marginTop: gi > 0 ? 8 : 0, paddingTop: gi > 0 ? 8 : 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#8290a0', padding: '6px 8px 4px', letterSpacing: '0.04em' }}>{g}</div>
                  {items.map((r) => {
                    const on = r.id === cur?.id;
                    const fine = ok(r);
                    const st = !fine ? { label: '条件外', bg: '#f1f4f6', fg: '#9aa5b1' } : r.wamnet ? { label: r.note ?? '設定', bg: '#eef2f6', fg: '#3d4a56' } : null;
                    return (
                      <button key={r.id} type="button" data-report={r.id} onClick={() => setCurOf((m) => ({ ...m, [cat]: r.id }))} aria-current={on ? 'true' : undefined} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%', textAlign: 'left', padding: '7px 8px', border: 'none', borderRadius: 8, background: on ? accent : 'transparent', color: on ? '#fff' : fine ? '#22303c' : '#9aa5b1', fontFamily: 'inherit', cursor: 'pointer', marginBottom: 1 }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: on ? 700 : 500, lineHeight: 1.45 }}>{r.name}{r.note && !r.wamnet && <span style={{ display: 'block', fontSize: 12, fontWeight: 500, opacity: 0.8 }}>{r.note}</span>}</span>
                        {st && <span style={{ flex: 'none', fontSize: 12, fontWeight: 800, padding: '1px 6px', borderRadius: 6, background: on ? 'rgba(255,255,255,.22)' : st.bg, color: on ? '#fff' : st.fg, marginTop: 2 }}>{st.label}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {list.length === 0 && <div style={{ fontSize: 14, color: '#9aa5b1', padding: 8, lineHeight: 1.7 }}>起動中の区分（{s.division}）で印刷できる帳票はありません。</div>}
            {(hidden > 0 || showAll) && <label data-show-all style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 12, color: '#8290a0', padding: '4px 8px', cursor: 'pointer' }}><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />表示条件を満たさない帳票も表示（{hidden}）</label>}
          </nav>

          {/* 右：選んだ帳票の詳細設定と印刷 */}
          <div style={{ minWidth: 0 }} data-print-detail={cur?.id}>
            {cur && <>
              <div style={{ padding: '14px 22px 8px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16, minWidth: 0 }}>{cur.name}</div>
                {tag(cur.sub && cur.sub !== cat ? `${cat}／${cur.sub}` : cat, '#eef2f6', '#3d4a56')}
                {cur.note && !cur.wamnet && tag(cur.note, '#eef2f6', '#3d4a56')}
                {cur.cond && !ok(cur) && tag('表示条件を満たしていません', '#fdecea', '#b03a2e')}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8290a0' }}>{s.fiscalYear}　{s.division}</span>
              </div>
              <div style={{ padding: '6px 22px 22px' }}>
                {!ok(cur) ? (
                  <Notice>この帳票は表示条件（{cur.cond?.label}）を満たしていないため、起動中の区分（{s.division}）では印刷できません。</Notice>
                ) : cur.wamnet ? (
                  <div style={{ ...card, padding: 16, display: 'grid', gap: 10 }}>
                    <div><button type="button" className="submit-btn" onClick={() => setWamnet(WAMNET_ITEMS.find((w) => w.name === cur.name) ?? null)} style={btn(accent, true)}>{cur.name}を開く</button></div>
                  </div>
                ) : (
                  <div style={{ ...card, overflow: 'visible', ['--print-foot-bottom' as string]: 'var(--proto-dock-space, 0px)', ['--print-foot-radius' as string]: '0 0 12px 12px' }}>
                    <PrintFlow key={cur.id} report={cur} accent={accent} onPreview={(title, opts) => setPreview({ title, opts })} />
                  </div>
                )}
              </div>
            </>}
          </div>
        </div>
      )}

      <PreviewModal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ''} opts={preview?.opts} accent={accent} data={preview ? sampleReportData(preview.title) : undefined} />
      <WamnetDialog item={wamnet} onClose={() => setWamnet(null)} accent={accent} />

      {/* まとめて印刷：中区分をまたいで帳票を選ぶ */}
      <Modal open={pickOpen} onClose={() => setPickOpen(false)} width={1000} title="まとめて印刷する帳票を選ぶ">
        <div style={{ padding: '12px 22px 18px', display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 14, color: '#5b6773', lineHeight: 1.7 }}>期間は当月（令和8年8月）で一括指定し、帳票ごとの詳細設定は各帳票で決めた内容を使います。別紙は別紙の画面から印刷します。</div>
          <div data-batch-pick style={{ columns: '3 280px', columnGap: 12, maxHeight: '56vh', overflow: 'auto' }}>
            {CATS.filter((c) => c !== '別紙').map((c) => {
              const rs = batchPool.filter((r) => r.cat === c);
              if (!rs.length) return null;
              return (
                <div key={c} style={{ breakInside: 'avoid', border: '1px solid #e2e8ee', borderRadius: 10, padding: '8px 12px 10px', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>{c}</div>
                  {subsOf(c).map((g) => {
                    const xs = rs.filter((r) => (r.sub ?? c) === g);
                    if (!xs.length) return null;
                    return (
                      <div key={g}>
                        {g !== c && <div style={{ ...lbl, marginTop: 6, marginBottom: 2 }}>{g}</div>}
                        {xs.map((r) => <label key={r.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 14, padding: '3px 0', cursor: 'pointer', lineHeight: 1.45 }}><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} style={{ marginTop: 3 }} />{r.name}</label>)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14 }}>選択中 <b style={{ fontSize: 16, color: accent, fontVariantNumeric: 'tabular-nums' }}>{picked.length}</b> 帳票</span>
            <button type="button" onClick={() => setSelected(new Set())} disabled={!picked.length} style={btn('#5b6773', false, true)}>選択を解除</button>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setPickOpen(false)} style={btn()}>キャンセル</button>
              <button type="button" className="submit-btn" data-print-batch-run disabled={!picked.length} onClick={() => { setPickOpen(false); setBatchOpen(true); }} style={{ ...btn(accent, true), opacity: picked.length ? 1 : 0.5, cursor: picked.length ? 'pointer' : 'not-allowed' }}>選んだ {picked.length} 帳票を印刷</button>
            </span>
          </div>
        </div>
      </Modal>
      <PrintOutDialog open={batchOpen} onClose={() => setBatchOpen(false)} name={`まとめて印刷（${picked.length}帳票）`} accent={accent} data={batchData} fileName="まとめて印刷_令和8年8月" meta={`令和8年8月1日〜8月31日　対象：${picked.map((r) => r.name).join('、')}`}
        previewOpts={{ from: '令和8年8月1日', to: '令和8年8月31日', output: OUTPUTS[1] }} detailSummary={`${picked.length} 帳票`}
        basic={<div style={{ display: 'grid', gap: 10 }}>
          <span style={lbl}>まとめて印刷する帳票（{picked.length}）</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{picked.map((r) => <span key={r.id} style={{ padding: '4px 10px', borderRadius: 8, background: '#eef2f6', fontSize: 14 }}>{r.name}</span>)}</div>
          <div style={{ fontSize: 12, color: '#8290a0' }}>期間：令和8年8月1日〜8月31日。帳票ごとの詳細設定は、各帳票で決めた内容を使います。帳票を変えるときは、この画面を閉じて「まとめて印刷」から選び直します。</div>
        </div>} />
    </SettingsShell>
  );
}
