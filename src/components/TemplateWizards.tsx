// 連続定型仕訳ウィザード／自動按分仕訳登録（テンプレートの新規登録・訂正）
//   連続定型は 1 つの定型に複数のページ（1 ページ＝伝票 1 枚）を持ち、ページごとに伝票画面での有効・無効の初期値を持つ（確認メモ #291）。
//   連続定型仕訳ウィザードの明細は、予備１・予備２・消費税（貸借）も入力できる（確認メモ #292）。振替伝票式は借方金額・貸方金額を行ごとに分ける（#293）。0 行のページがあると登録できない（#294）。
//   自動按分仕訳登録は、現行と同じく 4 つの伝票の形式と、伝票（ページ）の追加・挿入・削除を持つ。按分率は行ごと（振替の 2 形式は借方・貸方それぞれ）に設定する（確認メモ #295）。
//   設定「仕訳辞書」と、伝票入力の「連続定型」「自動按分」ダイアログの両方から開く共通部品。

import { Modal } from './Modal';
import { NUM, TD, TH } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { Field, Notice, Steps, btn, input, lbl, numInput, toInt, yen } from './ui';
import { ACCOUNTS, SERVICES, VENDORS } from '../data';
import { TAX_OPTS } from '../lib/transferTax';
import { MAX_ALLOCATION_PAGES, allocationError, allocationPages, entryShare, isTransferForm, setSession, sharePct, templatePages, useSession, withPages, type AllocMode, type AllocShare, type AllocationEntry, type AllocationPage, type AllocationTemplate, type JournalTemplate, type TemplateLine, type TemplatePage } from '../store/session';

const ACCTS = ACCOUNTS.flatMap((g) => g.items).concat(['水道光熱費（事務）', '寄附金収益', '基本金組入額']);
const FORMS = ['単一式', '伝票式', '振替伝票式', '振替単一式'] as const;

/** page は明細の手順で開いているページ（0 始まり） */
export type TemplateWiz = { step: number; t: JournalTemplate; page?: number } | null;
/** page は伝票・按分率設定の手順で開いている伝票（0 始まり） */
export type AllocationWiz = { step: number; t: AllocationTemplate; page?: number } | null;

export const blankTemplate = (line?: Partial<TemplateLine>, form: JournalTemplate['form'] = '単一式'): JournalTemplate => withPages({ id: 't' + Date.now(), name: '', form, lines: [] }, [{ lines: [{ kari: '', kashi: '', tekiyo: '', amount: '', ...line }] }]);
const blankEntry = (p?: Partial<AllocationEntry>): AllocationEntry => ({ kari: '', kashi: '', tekiyo: '', share: { mode: '％', rate: 0 }, ...p });
export const blankAllocation = (line?: { kari?: string; kashi?: string; tekiyo?: string }): AllocationTemplate => {
  const base = { kari: line?.kari ?? '', kashi: line?.kashi ?? '', tekiyo: line?.tekiyo ?? '' };
  return { id: 'a' + Date.now(), name: '', form: '単一式', rounding: '切り捨て', lines: [], pages: [
    { division: SERVICES[0], entries: [blankEntry({ ...base, share: { mode: '％', rate: 50 } })] },
    { division: SERVICES[1], entries: [blankEntry({ ...base, share: { mode: '残り', rate: 0 } })] },
  ] };
};
/** 登録する形にそろえる（単一式は 1 枚 1 行、仕訳伝票形式は借方・貸方を伝票に 1 組、振替以外は貸方の按分率を持たない） */
function normalizeAllocation(t: AllocationTemplate): AllocationTemplate {
  const single = t.form === '単一式' || t.form === '振替単一式';
  const pages = allocationPages(t).map((p): AllocationPage => {
    let es = single ? p.entries.slice(0, 1) : p.entries;
    if (t.form === '伝票式' && es[0]) es = es.map((e) => ({ ...e, kari: es[0].kari, kashi: es[0].kashi }));
    if (!isTransferForm(t.form)) es = es.map((e) => ({ ...e, kashiShare: undefined }));
    return { ...p, entries: es };
  });
  return { ...t, lines: [], pages };
}
const FORM_NOTE: Record<JournalTemplate['form'], string> = {
  伝票式: '仕訳伝票形式。借方・貸方の科目は伝票に 1 組で、摘要と金額を複数行',
  単一式: '単一式形式。伝票 1 枚に 1 行',
  振替伝票式: '振替伝票形式。行ごとに借方・貸方の科目と按分率',
  振替単一式: '振替単一式。伝票 1 枚に 1 行で、借方・貸方の按分率',
};
const MODE_LABEL: Record<AllocMode, string> = { '％': 'パーセント', 分数: '分数', 残り: '残り', 按分元金: '按分元金' };

const sel = (v: string, onChange: (x: string) => void, opts: string[], ph = '選択') => <select value={v} onChange={(e) => onChange(e.target.value)} style={{ ...input, padding: '5px 8px', fontSize: 14 }}><option value="">{ph}</option>{opts.map((o) => <option key={o}>{o}</option>)}</select>;

/* ---------------- 連続定型仕訳ウィザード ---------------- */
/** 1 つの定型に置けるページ数の上限（伝票画面の連続定型と同じ） */
const MAX_TEMPLATE_PAGES = 50;
const blankLine = (): TemplateLine => ({ kari: '', kashi: '', tekiyo: '', amount: '' });

export function TemplateWizardModal({ wiz, setWiz, accent, onSaved }: { wiz: TemplateWiz; setWiz: (w: TemplateWiz) => void; accent: string; onSaved?: (t: JournalTemplate) => void }) {
  const s = useSession();
  const toast = useToast();
  const pages = wiz ? templatePages(wiz.t) : [];
  const pi = Math.min(wiz?.page ?? 0, Math.max(0, pages.length - 1));
  const cur = pages[pi];
  /** 行が 0 行のページ（登録できない。確認メモ #294） */
  const emptyPage = pages.findIndex((p) => p.lines.length === 0);
  const blocked = pages.length === 0 ? 'ページがありません。「＋ ページ追加」でページを追加してください' : emptyPage >= 0 ? `${emptyPage + 1}ページ目の行が 0 行のため登録できません。「＋ 行追加」で行を追加するか、ページを削除してください` : '';
  const saveT = () => {
    if (!wiz) return;
    if (!wiz.t.name.trim()) return toast.show('名称を入力してください（全角20文字まで）');
    if (blocked) return toast.show(blocked);
    const t = withPages(wiz.t, pages);
    setSession({ templates: s.templates.some((x) => x.id === t.id) ? s.templates.map((x) => (x.id === t.id ? t : x)) : [...s.templates, t] });
    setWiz(null); toast.show(`定型仕訳を登録しました（${pages.length}ページ）`); onSaved?.(t);
  };
  const setPages = (ps: TemplatePage[], page = pi) => wiz && setWiz({ ...wiz, t: withPages(wiz.t, ps), page });
  const patchPage = (p: Partial<TemplatePage>) => setPages(pages.map((x, k) => (k === pi ? { ...x, ...p } : x)));
  const updLine = (i: number, p: Partial<TemplateLine>) => cur && patchPage({ lines: cur.lines.map((l, k) => (k === i ? { ...l, ...p } : l)) });
  const addPage = () => {
    if (pages.length >= MAX_TEMPLATE_PAGES) return toast.show(`1 つの定型に置けるのは ${MAX_TEMPLATE_PAGES} ページまでです`);
    // 新しいページは、仕訳伝票形式なら借方・貸方の科目をいまのページから引き継ぐ
    const base = wiz?.t.form === '伝票式' && cur?.lines[0] ? { ...blankLine(), kari: cur.lines[0].kari, kashi: cur.lines[0].kashi } : blankLine();
    setPages([...pages.slice(0, pi + 1), { lines: [base] }, ...pages.slice(pi + 1)], pi + 1);
  };
  const removePage = () => setPages(pages.filter((_, k) => k !== pi), Math.max(0, pi - 1));
  return (
    <>
      <ToastView msg={toast.msg} />
  <Modal open={!!wiz} onClose={() => setWiz(null)} width={wiz?.step === 2 ? 1180 : 760} title="連続定型仕訳ウィザード" strict>
    {wiz && (
      <>
        <Steps steps={['名称設定', '伝票の形式選択', '仕訳伝票（テンプレート）']} current={wiz.step} accent={accent} />
        <div style={{ padding: '18px 22px' }}>
          {wiz.step === 0 && <Field label="伝票（テンプレート）の名称（全角20文字まで）"><input className="field-input ring" value={wiz.t.name} onChange={(e) => setWiz({ ...wiz, t: { ...wiz.t, name: e.target.value.slice(0, 20) } })} style={input} autoFocus /></Field>}
          {wiz.step === 1 && <Field label="伝票の形式"><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{FORMS.map((f) => <label key={f} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', border: '1px solid ' + (wiz.t.form === f ? accent : '#e2e8ee'), borderRadius: 10, fontSize: 14, cursor: 'pointer' }}><input type="radio" checked={wiz.t.form === f} onChange={() => setWiz({ ...wiz, t: { ...wiz.t, form: f } })} />{f}</label>)}</div></Field>}
          {wiz.step === 2 && (() => {
            const split = wiz.t.form === '振替伝票式';
            /** 仕訳伝票形式は、借方・貸方の科目を伝票（ページ）に 1 組だけ持つ */
            const slip = wiz.t.form === '伝票式';
            /** 単一式は 1 ページ＝1 行 */
            const single = wiz.t.form === '単一式';
            const amt = (v: string | undefined, on: (x: string) => void, ph: string, label: string) => <input className="field-input" aria-label={label} value={v ? yen(Number(v)) : ''} onChange={(e) => on(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder={ph} style={{ ...numInput, padding: '5px 8px', fontSize: 14 }} />;
            const txt = (v: string | undefined, on: (x: string) => void, label: string) => <input className="field-input" aria-label={label} value={v ?? ''} onChange={(e) => on(e.target.value)} style={{ ...input, padding: '5px 8px', fontSize: 14 }} />;
            const tax = (v: string | undefined, on: (x: string) => void, label: string) => <select aria-label={label} value={v ?? ''} onChange={(e) => on(e.target.value)} style={{ ...input, padding: '3px 6px', fontSize: 12 }}><option value="">科目の既定</option>{TAX_OPTS.map((o) => <option key={o}>{o}</option>)}</select>;
            const cols = 8 + (slip ? 0 : 2) + (split ? 1 : 0);
            const slipKari = cur?.lines[0]?.kari ?? '';
            const slipKashi = cur?.lines[0]?.kashi ?? '';
            return (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ ...lbl, marginBottom: 0 }}>{wiz.t.name}（{wiz.t.form}）　1 ページが伝票 1 枚です。日付・金額は未入力でも登録できます</span>
              </div>

              {/* ページの切替（確認メモ #291）。伝票画面の連続定型では、ページごとに有効・無効を切り替えて登録する */}
              <div data-wiz-pages style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '8px 10px', marginBottom: 10, borderRadius: 8, background: '#f3f6f9' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#5b6773', marginRight: 2 }}>ページ</span>
                <div role="tablist" aria-label="ページ" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {pages.map((p, k) => {
                    const on = k === pi;
                    const off = p.enabled === false;
                    return (
                      <button key={k} type="button" role="tab" aria-selected={on} data-wiz-page={k + 1} onClick={() => setWiz({ ...wiz, page: k })}
                        title={`${k + 1}ページ目${off ? '（伝票画面では無効で始まる）' : ''}${p.lines.length === 0 ? '：行がありません' : `：${p.lines[0].tekiyo || p.lines[0].kari || '（未入力）'}`}`}
                        style={{ minWidth: 34, height: 30, padding: '0 8px', borderRadius: 6, border: '1px solid ' + (on ? accent : p.lines.length === 0 ? '#e3a59c' : '#cfd8e0'), background: on ? accent : '#fff', color: on ? '#fff' : p.lines.length === 0 ? '#c0392b' : '#22303c', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', fontVariantNumeric: 'tabular-nums', textDecoration: off ? 'line-through' : 'none', opacity: off && !on ? 0.6 : 1 }}>{k + 1}</button>
                    );
                  })}
                </div>
                <button type="button" data-wiz-add-page onClick={addPage} disabled={pages.length >= MAX_TEMPLATE_PAGES} style={btn(accent, false, true)}>＋ ページ追加</button>
                <button type="button" data-wiz-remove-page onClick={removePage} disabled={!cur} style={btn('#c0392b', false, true)}>このページを削除</button>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7a8794' }}>{pages.length}／{MAX_TEMPLATE_PAGES} ページ</span>
              </div>

              {!cur && <div style={{ padding: 18, textAlign: 'center', color: '#c0392b', fontSize: 14 }}>ページがありません。「＋ ページ追加」で 1 ページ以上追加してください（0 ページのままでは登録できません）。</div>}
              {cur && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 14 }}>{pi + 1}ページ目</b>
                    {slip && (
                      <>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#5b6773' }}>借方</span>
                        <span style={{ width: 220 }}>{sel(slipKari, (v) => patchPage({ lines: cur.lines.map((l) => ({ ...l, kari: v })) }), ACCTS)}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#5b6773' }}>貸方</span>
                        <span style={{ width: 220 }}>{sel(slipKashi, (v) => patchPage({ lines: cur.lines.map((l) => ({ ...l, kashi: v })) }), ACCTS)}</span>
                      </>
                    )}
                    <label title="伝票画面の連続定型を開いたときに、このページを有効（登録の対象）にしておくか" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#22303c', cursor: 'pointer' }}>
                      <input type="checkbox" data-wiz-page-enabled checked={cur.enabled !== false} onChange={(e) => patchPage({ enabled: e.target.checked ? undefined : false })} style={{ width: 16, height: 16 }} />
                      伝票画面で有効にしておく
                    </label>
                    {(!single || cur.lines.length === 0) && <button type="button" onClick={() => patchPage({ lines: [...cur.lines, slip ? { ...blankLine(), kari: slipKari, kashi: slipKashi } : blankLine()] })} style={{ ...btn(accent, false, true), marginLeft: 'auto' }}>＋ 行追加</button>}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>
                      <th style={{ ...TH, width: 30 }}>#</th>{!slip && <><th style={TH}>借方</th><th style={TH}>貸方</th></>}<th style={TH}>摘要</th><th style={{ ...TH, width: 120 }}>取引先</th>
                      <th style={{ ...TH, width: 90 }}>予備１</th><th style={{ ...TH, width: 90 }}>予備２</th>
                      <th style={{ ...TH, width: 128 }} title="消費税コード（上が借方、下が貸方。「科目の既定」は科目に設定した税区分）">消費税（借／貸）</th>
                      {split ? <><th style={{ ...TH, width: 110, textAlign: 'right' }}>借方金額</th><th style={{ ...TH, width: 110, textAlign: 'right' }}>貸方金額</th></> : <th style={{ ...TH, width: 110, textAlign: 'right' }}>金額</th>}
                      <th style={{ ...TH, width: 64 }} />
                    </tr></thead>
                    <tbody>
                      {cur.lines.length === 0 && <tr><td colSpan={cols} style={{ ...TD, textAlign: 'center', color: '#c0392b', padding: 18 }}>このページには行がありません。「＋ 行追加」で 1 行以上追加するか、ページを削除してください（0 行のページがあると登録できません）。</td></tr>}
                      {cur.lines.map((l, i) => <tr key={i}>
                        <td style={TD}>{i + 1}</td>
                        {!slip && <td style={TD}>{sel(l.kari, (v) => updLine(i, { kari: v }), ACCTS)}</td>}
                        {!slip && <td style={TD}>{sel(l.kashi, (v) => updLine(i, { kashi: v }), ACCTS)}</td>}
                        <td style={TD}>{txt(l.tekiyo, (v) => updLine(i, { tekiyo: v }), `${i + 1}行目の摘要`)}</td>
                        <td style={TD}>{sel(l.gyosha ?? '', (v) => updLine(i, { gyosha: v }), VENDORS.filter((x) => x !== '（なし）'), 'なし')}</td>
                        <td style={TD}>{txt(l.spare1, (v) => updLine(i, { spare1: v }), `${i + 1}行目の予備１`)}</td>
                        <td style={TD}>{txt(l.spare2, (v) => updLine(i, { spare2: v }), `${i + 1}行目の予備２`)}</td>
                        <td style={TD}><div style={{ display: 'grid', gap: 3 }}>{tax(l.kariTax, (v) => updLine(i, { kariTax: v }), `${i + 1}行目の借方の消費税`)}{tax(l.kashiTax, (v) => updLine(i, { kashiTax: v }), `${i + 1}行目の貸方の消費税`)}</div></td>
                        {split ? (
                          <>
                            <td style={NUM}>{amt(l.kariAmount ?? l.amount, (v) => updLine(i, { kariAmount: v, amount: v }), '呼出時', `${i + 1}行目の借方金額`)}</td>
                            <td style={NUM}>{amt(l.kashiAmount ?? l.amount, (v) => updLine(i, { kashiAmount: v }), '呼出時', `${i + 1}行目の貸方金額`)}</td>
                          </>
                        ) : <td style={NUM}>{amt(l.amount, (v) => updLine(i, { amount: v }), '呼出時に入力', `${i + 1}行目の金額`)}</td>}
                        <td style={TD}><button type="button" onClick={() => patchPage({ lines: cur.lines.filter((_, k) => k !== i) })} title="この行を削除" style={btn('#c0392b', false, true)}>行削除</button></td>
                      </tr>)}
                    </tbody>
                  </table>
                  </div>
                </>
              )}
              {(split || single) && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#7a8794', lineHeight: 1.7 }}>
                  {split && '振替伝票式は、行ごとに借方金額と貸方金額を分けて入力できます。'}
                  {single && '単一式は 1 ページに 1 行です。'}
                </div>
              )}
            </>
            );
          })()}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <button type="button" onClick={() => (wiz.step === 0 ? setWiz(null) : setWiz({ ...wiz, step: wiz.step - 1 }))} style={btn()}>{wiz.step === 0 ? '中止' : '戻る'}</button>
            {wiz.step < 2 ? <button type="button" className="submit-btn" onClick={() => setWiz({ ...wiz, step: wiz.step + 1 })} style={btn(accent, true)}>次へ</button> : <span data-tip={blocked || undefined} style={{ display: 'inline-flex' }}><button type="button" className="submit-btn" data-template-save disabled={!!blocked} onClick={saveT} style={{ ...btn(accent, true), ...(blocked ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }}>定型仕訳を登録</button></span>}
          </div>
        </div>
      </>
    )}
  </Modal>
    </>
  );
}

/* ---------------- 自動按分仕訳登録 ---------------- */
// 現行の自動按分仕訳登録（マニュアル 5.3.2）に合わせる（確認メモ #295）
//   1 つの自動按分仕訳は複数の伝票（ページ）からなり、伝票ごとに伝票入力区分を選ぶ。伝票の追加・挿入・削除と行削除ができる（最大 50 枚）。
//   按分率は金額欄（行）ごとに「パーセント」「分数」「残り」「按分元金」から選ぶ。最後の伝票（振替伝票では最終行）は「残り」にする。
export function AllocationWizardModal({ awiz, setAwiz, accent, onSaved }: { awiz: AllocationWiz; setAwiz: (w: AllocationWiz) => void; accent: string; onSaved?: (t: AllocationTemplate) => void }) {
  const s = useSession();
  const toast = useToast();
  const norm = awiz ? normalizeAllocation(awiz.t) : null;
  const blocked = norm ? allocationError(norm) : '';
  const pages = awiz ? allocationPages(awiz.t) : [];
  const pi = Math.min(awiz?.page ?? 0, Math.max(0, pages.length - 1));
  const cur = pages[pi];
  const form = awiz?.t.form ?? '単一式';
  const transfer = isTransferForm(form);
  const single = form === '単一式' || form === '振替単一式';
  const slip = form === '伝票式';
  const saveA = () => {
    if (!awiz || !norm) return;
    if (blocked) return toast.show(blocked);
    setSession({ allocations: s.allocations.some((x) => x.id === norm.id) ? s.allocations.map((x) => (x.id === norm.id ? norm : x)) : [...s.allocations, norm] });
    setAwiz(null); toast.show(`自動按分仕訳を登録しました（伝票 ${norm.pages?.length ?? 0} 枚）`); onSaved?.(norm);
  };
  const setPages = (ps: AllocationPage[], page = pi) => awiz && setAwiz({ ...awiz, t: { ...awiz.t, lines: [], pages: ps }, page });
  const patchPage = (p: Partial<AllocationPage>) => setPages(pages.map((x, k) => (k === pi ? { ...x, ...p } : x)));
  const updEntry = (i: number, p: Partial<AllocationEntry>) => cur && patchPage({ entries: cur.entries.map((e, k) => (k === i ? { ...e, ...p } : e)) });
  /** 伝票を足す。最後へ追加するときは、新しい伝票を「残り」にし、それまで「残り」だった行はパーセントに戻す */
  const insertPage = (at: number) => {
    if (pages.length >= MAX_ALLOCATION_PAGES) return toast.show(`${MAX_ALLOCATION_PAGES}枚を超えて伝票登録はできません`);
    const atEnd = at >= pages.length;
    const unRest = (sh?: AllocShare): AllocShare | undefined => (sh?.mode === '残り' ? { mode: '％', rate: 0 } : sh);
    const src = cur ?? { division: SERVICES[0], entries: [blankEntry()] };
    const es = single ? src.entries.slice(0, 1) : src.entries;
    // 新しい伝票の行は科目・摘要を引き継ぎ、按分率は入れ直す（最後へ追加したときは最終行を「残り」に）
    const fresh: AllocationPage = { division: src.division, entries: es.map((e, k) => ({ ...e, share: atEnd && k === es.length - 1 ? { mode: '残り', rate: 0 } : { mode: '％', rate: 0 }, kashiShare: e.kashiShare?.mode === '按分元金' ? e.kashiShare : undefined })) };
    const base = atEnd ? pages.map((p) => ({ ...p, entries: p.entries.map((e) => ({ ...e, share: unRest(e.share) as AllocShare, kashiShare: unRest(e.kashiShare) })) })) : pages;
    setPages([...base.slice(0, at), fresh, ...base.slice(at)], at);
  };
  /** 伝票を削除する。最後の伝票を消して「残り」がなくなったときは、新しい最後の伝票の未設定（0%）の行を「残り」に戻す */
  const removePage = () => {
    const ps = pages.filter((_, k) => k !== pi);
    const hasRest = ps.some((p) => p.entries.some((e) => e.share.mode === '残り'));
    const lastP = ps[ps.length - 1];
    const fixed = pi === pages.length - 1 && !hasRest && lastP
      ? [...ps.slice(0, -1), { ...lastP, entries: lastP.entries.map((e): AllocationEntry => (e.share.mode === '％' && !e.share.rate ? { ...e, share: { mode: '残り', rate: 0 } } : e)) }]
      : ps;
    setPages(fixed, Math.max(0, pi - 1));
  };
  /** 現在の按分済み比率（「残り」「按分元金」を除く。現行の按分率設定の表示） */
  const used = (side: 0 | 1) => (norm ? allocationPages(norm).flatMap((p) => p.entries.map((e) => entryShare(norm, e, side))).reduce((a, sh) => a + (sh ? sharePct(sh) : 0), 0) : 0);
  const shareCell = (sh: AllocShare | undefined, on: (v: AllocShare | undefined) => void, label: string, sameOpt = false) => (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', whiteSpace: 'nowrap' }}>
      <select aria-label={label} data-alloc-mode value={sh ? sh.mode : 'same'} onChange={(e) => { const m = e.target.value; on(m === 'same' ? undefined : { mode: m as AllocMode, rate: sh?.rate ?? 0, num: sh?.num ?? 1, den: sh?.den ?? 2 }); }} style={{ ...input, padding: '4px 6px', fontSize: 13, width: 104 }}>
        {sameOpt && <option value="same">借方と同じ</option>}
        {(['％', '分数', '残り', '按分元金'] as const).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
      </select>
      {sh?.mode === '％' && <><input className="field-input" aria-label={`${label}（%）`} value={sh.rate ? String(sh.rate) : ''} onChange={(e) => on({ ...sh, rate: Math.min(100, toInt(e.target.value)) })} inputMode="numeric" placeholder="0" style={{ ...numInput, width: 52, padding: '4px 6px', fontSize: 14 }} /><span style={{ fontSize: 13 }}>%</span></>}
      {sh?.mode === '分数' && <><input className="field-input" aria-label={`${label}（分子）`} value={String(sh.num ?? '')} onChange={(e) => on({ ...sh, num: toInt(e.target.value) })} inputMode="numeric" style={{ ...numInput, width: 40, padding: '4px 6px', fontSize: 14 }} /><span style={{ fontSize: 13 }}>/</span><input className="field-input" aria-label={`${label}（分母）`} value={String(sh.den ?? '')} onChange={(e) => on({ ...sh, den: toInt(e.target.value) })} inputMode="numeric" style={{ ...numInput, width: 40, padding: '4px 6px', fontSize: 14 }} /></>}
    </div>
  );
  return (
    <>
      <ToastView msg={toast.msg} />
  <Modal open={!!awiz} onClose={() => setAwiz(null)} width={awiz?.step === 3 ? 1180 : 820} title="自動按分仕訳登録" strict>
    {awiz && (
      <>
        <Steps steps={['名称設定', '伝票の形式設定', '経理区分選択', '伝票・按分率設定']} current={awiz.step} accent={accent} />
        <div style={{ padding: '18px 22px' }}>
          {awiz.step === 0 && <Field label="自動按分仕訳の名称（全角20文字まで）"><input className="field-input ring" value={awiz.t.name} onChange={(e) => setAwiz({ ...awiz, t: { ...awiz.t, name: e.target.value.slice(0, 20) } })} style={input} autoFocus /></Field>}
          {awiz.step === 1 && <Field label="伝票の形式"><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{FORMS.map((f) => <label key={f} data-alloc-form={f} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', border: '1px solid ' + (awiz.t.form === f ? accent : '#e2e8ee'), borderRadius: 10, fontSize: 14, cursor: 'pointer' }}><input type="radio" checked={awiz.t.form === f} onChange={() => setAwiz({ ...awiz, t: { ...awiz.t, form: f } })} style={{ marginTop: 3 }} /><span><b>{f}</b><span style={{ display: 'block', fontSize: 12, color: '#7a8794', marginTop: 2 }}>{FORM_NOTE[f]}</span></span></label>)}</div></Field>}
          {awiz.step === 2 && <><Field label="伝票を作成する伝票入力区分（伝票ごとに選択）"><div style={{ fontSize: 14, color: '#5b6773' }}>次のステップで、伝票ごとに区分を選びます。伝票入力区分間でも按分できます。</div></Field><div style={{ marginTop: 8 }}>{SERVICES.map((sv) => <span key={sv} style={{ display: 'inline-block', padding: '4px 10px', margin: 3, background: '#eef2f6', borderRadius: 8, fontSize: 14 }}>{sv}</span>)}</div></>}
          {awiz.step === 3 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ ...lbl, marginBottom: 0 }}>{awiz.t.name}（{form}）　金額以外は通常の伝票と同じです。年月日は伝票入力で呼び出すときに入れます</span>
                <span style={{ marginLeft: 'auto', fontSize: 14 }}>端数処理：</span>{(['四捨五入', '切り捨て', '切り上げ'] as const).map((r) => <label key={r} style={{ fontSize: 14, display: 'flex', gap: 4 }}><input type="radio" checked={awiz.t.rounding === r} onChange={() => setAwiz({ ...awiz, t: { ...awiz.t, rounding: r } })} />{r}</label>)}
              </div>

              {/* 伝票（ページ）の切替（確認メモ #295）。現行の［伝票追加］［伝票挿入］［伝票削除］ */}
              <div data-alloc-pages style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '8px 10px', marginBottom: 10, borderRadius: 8, background: '#f3f6f9' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#5b6773', marginRight: 2 }}>伝票</span>
                <div role="tablist" aria-label="伝票" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {pages.map((p, k) => {
                    const on = k === pi;
                    return (
                      <button key={k} type="button" role="tab" aria-selected={on} data-alloc-page={k + 1} onClick={() => setAwiz({ ...awiz, page: k })}
                        title={`${k + 1}枚目：${p.division}${p.entries[0] ? `　${p.entries[0].tekiyo || p.entries[0].kari || '（未入力）'}` : ''}`}
                        style={{ minWidth: 34, height: 30, padding: '0 8px', borderRadius: 6, border: '1px solid ' + (on ? accent : '#cfd8e0'), background: on ? accent : '#fff', color: on ? '#fff' : '#22303c', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}>{k + 1}</button>
                    );
                  })}
                </div>
                <button type="button" data-alloc-add-page onClick={() => insertPage(pages.length)} disabled={pages.length >= MAX_ALLOCATION_PAGES} title="最後へ新しい伝票を追加します" style={btn(accent, false, true)}>伝票追加</button>
                <button type="button" data-alloc-insert-page onClick={() => insertPage(pi)} disabled={pages.length >= MAX_ALLOCATION_PAGES || !cur} title="現在表示されている伝票の前へ新しい伝票を挿入します" style={btn(accent, false, true)}>伝票挿入</button>
                <button type="button" data-alloc-remove-page onClick={removePage} disabled={!cur} title="現在表示されている伝票を削除します" style={btn('#c0392b', false, true)}>伝票削除</button>
                <span data-alloc-page-no style={{ marginLeft: 'auto', fontSize: 13, color: '#22303c' }}>{cur ? <>現在登録中の伝票は <b>{pi + 1}</b> 枚目です</> : '伝票がありません'}<span style={{ color: '#7a8794' }}>（全 {pages.length} 枚／{MAX_ALLOCATION_PAGES} 枚まで）</span></span>
              </div>

              {!cur && <div style={{ padding: 18, textAlign: 'center', color: '#c0392b', fontSize: 14 }}>伝票がありません。「伝票追加」で 1 枚以上追加してください。</div>}
              {cur && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 14 }}>{pi + 1}枚目</b>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#5b6773' }}>伝票入力区分</span>
                    <span style={{ width: 170 }}>{sel(cur.division, (v) => patchPage({ division: v }), SERVICES)}</span>
                    {slip && (
                      <>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#5b6773' }}>借方</span>
                        <span style={{ width: 220 }}>{sel(cur.entries[0]?.kari ?? '', (v) => patchPage({ entries: cur.entries.map((e) => ({ ...e, kari: v })) }), ACCTS)}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#5b6773' }}>貸方</span>
                        <span style={{ width: 220 }}>{sel(cur.entries[0]?.kashi ?? '', (v) => patchPage({ entries: cur.entries.map((e) => ({ ...e, kashi: v })) }), ACCTS)}</span>
                      </>
                    )}
                    {!single && <button type="button" data-alloc-add-line onClick={() => patchPage({ entries: [...cur.entries, blankEntry(slip ? { kari: cur.entries[0]?.kari ?? '', kashi: cur.entries[0]?.kashi ?? '' } : {})] })} style={{ ...btn(accent, false, true), marginLeft: 'auto' }}>＋ 行追加</button>}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>
                      <th style={{ ...TH, width: 30 }}>#</th>
                      {transfer ? <><th style={{ ...TH, width: 200 }}>借方科目</th><th style={{ ...TH, width: 196 }}>借方の按分率</th><th style={{ ...TH, width: 200 }}>貸方科目</th><th style={{ ...TH, width: 196 }}>貸方の按分率</th></> : !slip && <><th style={{ ...TH, width: 210 }}>借方</th><th style={{ ...TH, width: 210 }}>貸方</th></>}
                      <th style={TH}>摘要</th><th style={{ ...TH, width: 130 }}>取引先</th>
                      {!transfer && <th style={{ ...TH, width: 200 }}>按分率</th>}
                      {!single && <th style={{ ...TH, width: 64 }} />}
                    </tr></thead>
                    <tbody>
                      {cur.entries.length === 0 && <tr><td colSpan={9} style={{ ...TD, textAlign: 'center', color: '#c0392b', padding: 18 }}>この伝票には行がありません。「＋ 行追加」で行を追加してください。</td></tr>}
                      {(single ? cur.entries.slice(0, 1) : cur.entries).map((e, i) => <tr key={i} data-alloc-line={i + 1}>
                        <td style={TD}>{i + 1}</td>
                        {transfer ? (
                          <>
                            <td style={TD}>{sel(e.kari, (v) => updEntry(i, { kari: v }), ACCTS, 'なし')}</td>
                            <td style={TD}>{e.kari ? shareCell(e.share, (v) => v && updEntry(i, { share: v }), `${i + 1}行目の借方の按分率`) : <span style={{ fontSize: 12, color: '#9aa5b1' }}>借方なし</span>}</td>
                            <td style={TD}>{sel(e.kashi, (v) => updEntry(i, { kashi: v }), ACCTS, 'なし')}</td>
                            <td style={TD}>{e.kashi ? shareCell(e.kashiShare, (v) => updEntry(i, { kashiShare: v }), `${i + 1}行目の貸方の按分率`, true) : <span style={{ fontSize: 12, color: '#9aa5b1' }}>貸方なし</span>}</td>
                          </>
                        ) : !slip && (
                          <>
                            <td style={TD}>{sel(e.kari, (v) => updEntry(i, { kari: v }), ACCTS)}</td>
                            <td style={TD}>{sel(e.kashi, (v) => updEntry(i, { kashi: v }), ACCTS)}</td>
                          </>
                        )}
                        <td style={TD}><input className="field-input" aria-label={`${i + 1}行目の摘要`} value={e.tekiyo} onChange={(ev) => updEntry(i, { tekiyo: ev.target.value })} style={{ ...input, padding: '5px 8px', fontSize: 14 }} /></td>
                        <td style={TD}>{sel(e.gyosha ?? '', (v) => updEntry(i, { gyosha: v || undefined }), VENDORS.filter((x) => x !== '（なし）'), 'なし')}</td>
                        {!transfer && <td style={TD}>{shareCell(e.share, (v) => v && updEntry(i, { share: v }), `${i + 1}行目の按分率`)}</td>}
                        {!single && <td style={TD}><button type="button" onClick={() => patchPage({ entries: cur.entries.filter((_, k) => k !== i) })} title={`現在カーソルのある行（${i + 1}行目）を削除します`} style={btn('#c0392b', false, true)}>行削除</button></td>}
                      </tr>)}
                    </tbody>
                  </table>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, fontSize: 13, color: '#5b6773', flexWrap: 'wrap' }}>
                <span data-alloc-used>現在の按分済み比率：{transfer ? <>借方 <b>{used(0).toFixed(2)}%</b>　貸方 <b>{used(1).toFixed(2)}%</b></> : <b>{used(0).toFixed(2)}%</b>}</span>
                {blocked && <span data-alloc-error style={{ color: '#c0392b', fontWeight: 700 }}>{blocked}</span>}
              </div>
              <div style={{ marginTop: 8 }}><Notice tone="warn">最後の伝票（振替伝票では最終行）の按分率は、必ず「残り」（残りの按分率を適用する）を選びます。「按分元金」は総金額をそのまま適用します（振替伝票で貸方を総金額のままにする場合など）。{transfer && '振替の形式は、伝票ごとに借方と貸方の金額が一致するように按分率を設定します。'}</Notice></div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <button type="button" onClick={() => (awiz.step === 0 ? setAwiz(null) : setAwiz({ ...awiz, step: awiz.step - 1 }))} style={btn()}>{awiz.step === 0 ? '中止' : '戻る'}</button>
            {awiz.step < 3 ? <button type="button" className="submit-btn" onClick={() => setAwiz({ ...awiz, step: awiz.step + 1 })} style={btn(accent, true)}>次へ</button> : <span data-tip={blocked || undefined} style={{ display: 'inline-flex' }}><button type="button" className="submit-btn" data-alloc-save disabled={!!blocked} onClick={saveA} style={{ ...btn(accent, true), ...(blocked ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }}>自動按分仕訳を登録</button></span>}
          </div>
        </div>
      </>
    )}
  </Modal>
    </>
  );
}
