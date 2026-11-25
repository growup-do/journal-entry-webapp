// 連続定型（確認メモ #202／#291）。
//   定型を 1 つ選び、その定型のページ（1 ページ＝伝票 1 枚）を並べる。ページごとに内容を直し、有効／無効を切り替えて、有効なページをまとめて登録する（最大 50 ページ。現行を踏襲）。
//   ページは仕訳辞書の連続定型仕訳ウィザードで作る。ここで「定型に保存」すると、選んでいる定型のページと有効／無効を上書きする。
//   以前の「定型仕訳」（右上のボタン）と「仕訳登録」（入力補助）はここに統合した。定型の追加・保存もこのダイアログで行う。
//   EntryExtras から呼ぶので、EntryExtras は import しない（循環を避ける）。

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { btn, input, numInput } from './ui';
import { ComboField, ENTRY_DATE_RANGE, EntryMonthNote, FORMAT_KIND, autoInternalSide, fmtNum, focusId, isInternalAccount, judgeEntry, onEnter, parseEntryDate, scopeStyle, setPartner, toNum, type EntryFormat } from './EntryCommon';
import { addVoucher, getVouchers } from '../store/journalStore';
import { setSession, templatePages, useSession, withPages, type EnvSettings, type JournalTemplate, type TemplateLine, type TemplatePage } from '../store/session';

const TEMPLATE_FORM: Record<EntryFormat, JournalTemplate['form']> = { 伝票入力: '伝票式', 単一入力: '単一式', 振替入力: '振替伝票式', 振替単一: '振替単一式' };
const FORMAT_LABEL: Record<EntryFormat, string> = { 伝票入力: '仕訳伝票形式', 単一入力: '単一仕訳形式', 振替入力: '振替伝票形式', 振替単一: '振替単一形式' };
/** 連続定型に並べられるページ数の上限（現行を踏襲） */
const MAX_PAGES = 50;

interface PLine { id: number; kari: string; kashi: string; tekiyo: string; gyosha: string; amount: string; /** 定型に登録した予備１・２、消費税（貸借）、振替伝票式の貸方金額（確認メモ #292／#293） */ spare1?: string; spare2?: string; kariTax?: string; kashiTax?: string; kashiAmount?: string }
interface Page { id: number; enabled: boolean; kari: string; kashi: string; lines: PLine[]; aite: string }

let uid = 1;
const nid = () => uid++;
const blankLine = (): PLine => ({ id: nid(), kari: '', kashi: '', tekiyo: '', gyosha: '', amount: '' });
const blankPage = (): Page => ({ id: nid(), enabled: true, kari: '', kashi: '', lines: [blankLine()], aite: '' });

/** 行ごとに借方・貸方の科目を持つ形式（振替伝票形式・振替単一形式） */
const isPerLine = (f: EntryFormat) => f === '振替入力' || f === '振替単一';
/** 1 枚の伝票に複数行を持てる形式（単一仕訳形式だけ 1 行） */
const isMulti = (f: EntryFormat) => f !== '単一入力';

/** 選んだ定型のページを、ダイアログのページに直す（1 ページ＝伝票 1 枚。確認メモ #291） */
function toPages(t: JournalTemplate | undefined, format: EntryFormat): Page[] {
  if (!t) return [];
  const out: Page[] = [];
  const mk = (l: TemplateLine): PLine => ({ id: nid(), kari: l.kari, kashi: l.kashi, tekiyo: l.tekiyo, gyosha: l.gyosha ?? '', amount: l.kariAmount || l.amount, spare1: l.spare1, spare2: l.spare2, kariTax: l.kariTax, kashiTax: l.kashiTax, kashiAmount: l.kashiAmount });
  for (const tp of templatePages(t)) {
    const enabled = tp.enabled !== false;
    if (isPerLine(format)) {
      out.push({ id: nid(), enabled, kari: '', kashi: '', lines: tp.lines.length ? tp.lines.map(mk) : [blankLine()], aite: '' });
    } else if (format === '伝票入力') {
      // 仕訳伝票形式は借方・貸方の科目が伝票に 1 組（ウィザードでもページに 1 組で入力する）
      const first = tp.lines[0];
      out.push({ id: nid(), enabled, kari: first?.kari ?? '', kashi: first?.kashi ?? '', lines: tp.lines.length ? tp.lines.map(mk) : [blankLine()], aite: '' });
    } else {
      // 単一仕訳形式は 1 ページ＝1 行
      (tp.lines.length ? tp.lines : [{ kari: '', kashi: '', tekiyo: '', amount: '' }]).forEach((l) => out.push({ id: nid(), enabled, kari: l.kari, kashi: l.kashi, lines: [mk(l)], aite: '' }));
    }
  }
  return out.slice(0, MAX_PAGES);
}

/** ページの一覧に出す内容（1 行目の摘要か科目） */
const pageLabel = (p: Page, perLine: boolean) => {
  const l = p.lines[0];
  if (!l) return '（行なし）';
  return l.tekiyo || (perLine ? l.kari : p.kari) || '（未入力）';
};

const lineAccounts = (p: Page, l: PLine, perLine: boolean) => ({ kari: perLine ? l.kari : p.kari, kashi: perLine ? l.kashi : p.kashi });
const pageTotal = (p: Page) => p.lines.reduce((s, l) => s + toNum(l.amount), 0);
const pageInternal = (p: Page, perLine: boolean) => p.lines.some((l) => { const a = lineAccounts(p, l, perLine); return isInternalAccount(a.kari) || isInternalAccount(a.kashi); });

/** ページが登録できない理由（登録できるときは空） */
function pageError(p: Page, perLine: boolean, service: string, env: EnvSettings): string {
  if (!perLine && (!p.kari || !p.kashi)) return `${!p.kari ? '借方科目' : '貸方科目'}が未入力です`;
  const lines = p.lines.filter((l) => toNum(l.amount) > 0);
  if (lines.length === 0) return '金額が入っている行がありません';
  for (const l of lines) {
    const { kari, kashi } = lineAccounts(p, l, perLine);
    const n = p.lines.indexOf(l) + 1;
    if (!kari || !kashi) return `${n}行目の${!kari ? '借方科目' : '貸方科目'}が未入力です`;
    const bad = judgeEntry({ kari, kashi, amount: toNum(l.amount), fundMode: '自動資金', internalSide: autoInternalSide(kari, kashi), aite: p.aite, division: service }, env).find((x) => x.level === 'error');
    if (bad) return perLine ? `${n}行目：${bad.title}` : bad.title;
  }
  return '';
}

const th: CSSProperties = { padding: '6px 8px', fontSize: 12, fontWeight: 700, color: '#5b6773', background: '#f3f6f9', borderBottom: '1px solid #dfe6ec', textAlign: 'left', whiteSpace: 'nowrap' };
const td: CSSProperties = { padding: '4px 4px', borderBottom: '1px solid #eef2f5', verticalAlign: 'top' };
const dateBox: CSSProperties = { ...numInput, width: 46, padding: '7px 8px', textAlign: 'center' };

export function SerialTemplateModal({ open, onClose, accent, format, service, year, month, day, toast, onRegistered }: {
  open: boolean; onClose: () => void; accent: string; format: EntryFormat;
  /** 入力区分（登録先） */
  service: string;
  /** 伝票日付の初期値（入力画面の年・月・日） */
  year: string; month: string; day: string;
  toast: (m: string) => void;
  onRegistered?: (ids: number[]) => void;
}) {
  const sess = useSession();
  const perLine = isPerLine(format);
  const multi = isMulti(format);
  const mine = sess.templates.filter((t) => t.form === TEMPLATE_FORM[format]);
  /** 選んでいる定型（'new' は新しい定型） */
  const [tplId, setTplId] = useState<string>('new');
  const [newName, setNewName] = useState('');
  const [pages, setPages] = useState<Page[]>([]);
  const [sel, setSel] = useState(0);
  const [y, setY] = useState(year);
  const [m, setM] = useState(month);
  const [d, setD] = useState(day);
  const [err, setErr] = useState('');

  // 開いたときに、保存してある定型と入力画面の日付を読み込む
  useEffect(() => {
    if (!open) return;
    const first = mine[0];
    setTplId(first?.id ?? 'new');
    setNewName('');
    setPages(toPages(first, format));
    setSel(0);
    setY(year); setM(month); setD(day);
    setErr('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cur = pages[sel];
  /** 定型を選び直す（ページはその定型の内容に入れ替わる） */
  const pickTemplate = (id: string) => {
    setErr('');
    setTplId(id);
    setPages(id === 'new' ? [blankPage()] : toPages(mine.find((t) => t.id === id), format));
    setSel(0);
  };
  const errors = useMemo(() => pages.map((p) => (p.enabled ? pageError(p, perLine, service, sess.env) : '')), [pages, perLine, service, sess.env]);
  const active = pages.filter((p) => p.enabled);
  const total = active.reduce((s, p) => s + pageTotal(p), 0);
  const em = parseEntryDate(y, m);
  const dn = parseInt(d.normalize('NFKC'), 10);

  const patchPage = (patch: Partial<Page>) => { setErr(''); setPages((ps) => ps.map((p, i) => (i === sel ? { ...p, ...patch } : p))); };
  const patchLine = (id: number, patch: Partial<PLine>) => { setErr(''); setPages((ps) => ps.map((p, i) => (i === sel ? { ...p, lines: p.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) } : p))); };
  const addLine = () => {
    if (!cur) return;
    const l = blankLine();
    patchPage({ lines: [...cur.lines, l] });
    focusId(perLine ? `st-l${l.id}-kari` : `st-l${l.id}-tek`);
  };
  const removeLine = (id: number) => { if (cur && cur.lines.length > 1) patchPage({ lines: cur.lines.filter((l) => l.id !== id) }); };
  const addPage = () => {
    if (pages.length >= MAX_PAGES) { toast(`連続定型は ${MAX_PAGES} ページまでです`); return; }
    setErr('');
    setPages((ps) => [...ps, blankPage()]);
    setSel(pages.length);
    if (!perLine) focusId('st-kari');
  };
  const removePage = () => {
    if (!cur) return;
    setErr('');
    setPages((ps) => ps.filter((_, i) => i !== sel));
    setSel((s) => Math.max(0, Math.min(s, pages.length - 2)));
  };
  const setAll = (enabled: boolean) => { setErr(''); setPages((ps) => ps.map((p) => ({ ...p, enabled }))); };
  /** 金額欄で Enter：次の行へ。最後の行なら行を足す（単一仕訳形式は 1 行だけ） */
  const afterAmount = (i: number) => {
    if (!cur) return;
    const next = cur.lines[i + 1];
    if (next) focusId(perLine ? `st-l${next.id}-kari` : `st-l${next.id}-tek`);
    else if (multi && toNum(cur.lines[i].amount) > 0) addLine();
  };

  /** ページの内容と有効／無効を、選んでいる定型に保存する（新しい定型なら追加する。確認メモ #291） */
  const save = () => {
    const tp: TemplatePage[] = pages.map((p) => ({
      enabled: p.enabled ? undefined : false,
      lines: p.lines.map((l) => ({ ...lineAccounts(p, l, perLine), tekiyo: l.tekiyo, amount: l.amount, gyosha: l.gyosha, spare1: l.spare1, spare2: l.spare2, kariTax: l.kariTax, kashiTax: l.kashiTax, ...(format === '振替入力' ? { kariAmount: l.amount, kashiAmount: l.kashiAmount } : {}) })),
    }));
    if (tplId === 'new') {
      const name = newName.trim() || `定型 ${mine.length + 1}`;
      const t = withPages({ id: `s${Date.now()}`, name, form: TEMPLATE_FORM[format], lines: [] }, tp);
      setSession({ templates: [...sess.templates, t] });
      setTplId(t.id);
      toast(`定型「${name}」を保存しました（${tp.length}ページ）`);
      return;
    }
    const base = mine.find((t) => t.id === tplId);
    if (!base) return;
    setSession({ templates: sess.templates.map((t) => (t.id === tplId ? withPages(t, tp) : t)) });
    toast(`定型「${base.name}」を保存しました（${tp.length}ページ）`);
  };

  /** 有効なページを、1 ページ＝伝票 1 枚として登録する */
  const register = () => {
    if (!em.ok) { setErr(`伝票日付の年と月を確認してください。入力できるのは、${ENTRY_DATE_RANGE}です。`); focusId('st-month'); return; }
    if (!(dn >= 1 && dn <= 31)) { setErr('伝票日付の日を 1〜31 で入力してください。'); focusId('st-day'); return; }
    if (active.length === 0) { setErr('有効なページがありません。登録するページにチェックを入れてください。'); return; }
    const bad = errors.findIndex((e) => e);
    if (bad >= 0) { setSel(bad); setErr(`${bad + 1}ページ目：${errors[bad]}`); return; }
    const date = `${em.month}/${dn}`;
    const ids: number[] = [];
    let seq = getVouchers().reduce((mx, r) => Math.max(mx, r.seq), 0);
    for (const p of active) {
      seq += 1;
      // 伝票No は入力画面の自動採番に合わせる（仕訳伝票形式・単一仕訳形式は「月-連番」、振替の 2 形式は「月-日」）
      const no = perLine ? date.replace('/', '-') : `${em.month}-${seq}`;
      for (const l of p.lines) {
        const amount = toNum(l.amount);
        if (!amount) continue;
        const { kari, kashi } = lineAccounts(p, l, perLine);
        const side = autoInternalSide(kari, kashi);
        const v = addVoucher({
          kind: FORMAT_KIND[format], date, seq, no, kari, kashi, tekiyo: l.tekiyo, amount, service, gyosha: l.gyosha || undefined, shohyo: true,
          ...(format === '振替入力' ? { kariAmount: amount, kashiAmount: l.kashiAmount ? toNum(l.kashiAmount) : amount } : {}),
          spare1: l.spare1 || undefined, spare2: l.spare2 || undefined, kariTax: l.kariTax || undefined, kashiTax: l.kashiTax || undefined,
          internal: side ? true : undefined, internalSide: side || undefined, term: em.term,
        });
        if (side) setPartner(v.id, p.aite);
        ids.push(v.id);
      }
    }
    onRegistered?.(ids);
    toast(`連続定型で ${active.length} 枚の伝票を登録しました（${ids.length}行、合計 ${total.toLocaleString('ja-JP')} 円）`);
    onClose();
  };

  const cols = perLine ? '32px minmax(0,1fr) minmax(0,1fr) minmax(0,1.1fr) 150px 120px 40px' : '32px minmax(0,1.4fr) 180px 130px 40px';
  const internal = cur ? pageInternal(cur, perLine) : false;

  return (
    <Modal open={open} onClose={onClose} width={1120} title={<>連続定型 <span style={{ fontSize: 13, fontWeight: 500, color: '#8290a0', marginLeft: 8 }}>{FORMAT_LABEL[format]}の定型をまとめて登録します</span></>}>
      <div data-serial-template style={{ ...scopeStyle(accent), padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '8px 12px', borderRadius: 8, background: '#f3f6f9', fontSize: 14 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            定型：
            <select data-serial-template-pick aria-label="定型" value={tplId} onChange={(e) => pickTemplate(e.target.value)} style={{ ...input, width: 'auto', minWidth: 220, padding: '6px 8px', fontWeight: 700 }}>
              {mine.map((t) => <option key={t.id} value={t.id}>{t.name}（{templatePages(t).length}ページ）</option>)}
              <option value="new">＋ 新しい定型</option>
            </select>
            {tplId === 'new' && <input aria-label="新しい定型の名前" value={newName} onChange={(e) => setNewName(e.target.value.slice(0, 20))} placeholder="定型の名前" style={{ ...input, width: 180, padding: '6px 8px' }} />}
          </span>
          <span>入力区分：<b>{service || '（未指定）'}</b></span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            伝票日付：令和
            <input id="st-year" aria-label="年" inputMode="numeric" value={y} onChange={(e) => { setErr(''); setY(e.target.value.normalize('NFKC').replace(/\D/g, '').slice(0, 2)); }} onKeyDown={onEnter(() => focusId('st-month'))} style={dateBox} />年
            <input id="st-month" aria-label="月" inputMode="numeric" value={m} onChange={(e) => { setErr(''); setM(e.target.value.normalize('NFKC').replace(/\D/g, '').slice(0, 2)); }} onKeyDown={onEnter(() => focusId('st-day'))} style={dateBox} />月
            <input id="st-day" aria-label="日" inputMode="numeric" value={d} onChange={(e) => { setErr(''); setD(e.target.value.normalize('NFKC').replace(/\D/g, '').slice(0, 2)); }} style={dateBox} />日
            <EntryMonthNote month={m} year={y} />
          </span>
          <span style={{ color: '#5b6773', fontSize: 13 }}>有効にしたページを、1 ページにつき伝票 1 枚として登録します（最大 {MAX_PAGES} ページ）。</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '310px minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
          {/* ページの一覧 */}
          <div style={{ border: '1px solid #dfe6ec', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: '#f3f6f9', borderBottom: '1px solid #dfe6ec' }}>
              <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>ページ（{pages.length}／{MAX_PAGES}）</span>
              <button type="button" className="ef-act" data-serial-all="on" onClick={() => setAll(true)} style={btn('#5b6773', false, true)}>すべて有効</button>
              <button type="button" className="ef-act" data-serial-all="off" onClick={() => setAll(false)} style={btn('#5b6773', false, true)}>すべて無効</button>
            </div>
            <div style={{ maxHeight: 330, overflow: 'auto' }}>
              {pages.length === 0 && <div style={{ padding: 14, fontSize: 14, color: '#8290a0', lineHeight: 1.8 }}>{mine.length === 0 ? 'この形式の定型がまだありません。「＋ページを追加」でページを作り、「定型に保存」で保存します。仕訳辞書の連続定型仕訳ウィザードでも作れます。' : 'この定型にはページがありません。「＋ページを追加」で作成します。'}</div>}
              {pages.map((p, i) => (
                <div key={p.id} data-serial-page={i + 1} data-enabled={p.enabled ? '1' : '0'} onClick={() => setSel(i)} style={{ display: 'grid', gridTemplateColumns: '26px 22px minmax(0,1fr) auto', gap: 6, alignItems: 'center', padding: '7px 10px', cursor: 'pointer', borderBottom: '1px solid #eef2f5', background: i === sel ? '#eef4fb' : '#fff', borderLeft: '3px solid ' + (i === sel ? accent : 'transparent'), opacity: p.enabled ? 1 : 0.55 }}>
                  <span style={{ fontSize: 12, color: '#8290a0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                  <input type="checkbox" aria-label={`${i + 1}ページ目を有効にする`} title="チェックを入れたページだけ登録します" checked={p.enabled} onClick={(e) => e.stopPropagation()} onChange={(e) => { setErr(''); setPages((ps) => ps.map((x, k) => (k === i ? { ...x, enabled: e.target.checked } : x))); }} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pageLabel(p, perLine)}</span>
                    {errors[i] && <span data-serial-page-error style={{ display: 'block', fontSize: 12, color: '#c0392b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={errors[i]}>{errors[i]}</span>}
                  </span>
                  <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: '#22303c' }}>{pageTotal(p).toLocaleString('ja-JP')}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderTop: '1px solid #dfe6ec', background: '#fafbfc' }}>
              <button type="button" className="ef-act" data-serial-add onClick={addPage} disabled={pages.length >= MAX_PAGES} style={btn(accent, false, true)}>＋ページを追加</button>
              <button type="button" className="ef-act" data-serial-remove onClick={removePage} disabled={!cur} style={btn('#c0392b', false, true)}>このページを削除</button>
            </div>
          </div>

          {/* 選んだページの内容 */}
          <div style={{ border: '1px solid #dfe6ec', borderRadius: 10, padding: 12, minHeight: 380, display: 'grid', gap: 10, alignContent: 'start' }}>
            {!cur && <div style={{ fontSize: 14, color: '#8290a0' }}>左の一覧からページを選ぶか、「＋ページを追加」で定型を作成します。</div>}
            {cur && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: perLine ? '90px' : '90px 44px minmax(0,1fr) 44px minmax(0,1fr)', gap: 8, alignItems: 'center' }}>
                  <span data-serial-page-no style={{ fontSize: 14, fontWeight: 700, color: '#22303c' }}>{sel + 1}ページ目</span>
                  {!perLine && (
                    <>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#5b6773', textAlign: 'right' }}>借方</span>
                      <ComboField key={`k${cur.id}`} id="st-kari" kind="account" value={cur.kari} onChange={(v) => patchPage({ kari: v })} onCommit={() => focusId('st-kashi')} placeholder="借方科目" padY={7} listWidth={340} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#5b6773', textAlign: 'right' }}>貸方</span>
                      <ComboField key={`s${cur.id}`} id="st-kashi" kind="account" value={cur.kashi} onChange={(v) => patchPage({ kashi: v })} onCommit={() => focusId(`st-l${cur.lines[0].id}-tek`)} placeholder="貸方科目" padY={7} listWidth={340} />
                    </>
                  )}
                </div>

                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: cols }}>
                    <div style={th}>行</div>
                    {perLine && <div style={th}>借方科目</div>}
                    {perLine && <div style={th}>貸方科目</div>}
                    <div style={th}>摘要</div>
                    <div style={th}>取引先</div>
                    <div style={{ ...th, textAlign: 'right' }}>金額</div>
                    <div style={th} />
                  </div>
                  {cur.lines.map((l, i) => (
                    <div key={l.id} data-serial-line={i + 1} style={{ display: 'grid', gridTemplateColumns: cols }}>
                      <div style={{ ...td, padding: '10px 8px', fontSize: 13, color: '#8290a0', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</div>
                      {perLine && <div style={td}><ComboField id={`st-l${l.id}-kari`} kind="account" value={l.kari} onChange={(v) => patchLine(l.id, { kari: v })} onCommit={() => focusId(`st-l${l.id}-kashi`)} placeholder="借方科目" padY={7} listWidth={320} /></div>}
                      {perLine && <div style={td}><ComboField id={`st-l${l.id}-kashi`} kind="account" value={l.kashi} onChange={(v) => patchLine(l.id, { kashi: v })} onCommit={() => focusId(`st-l${l.id}-tek`)} placeholder="貸方科目" padY={7} listWidth={320} /></div>}
                      <div style={td}><ComboField id={`st-l${l.id}-tek`} kind="summary" freeText value={l.tekiyo} onChange={(v) => patchLine(l.id, { tekiyo: v })} onCommit={() => focusId(`st-l${l.id}-gyo`)} placeholder="摘要" padY={7} listWidth={340} /></div>
                      <div style={td}><ComboField id={`st-l${l.id}-gyo`} kind="vendor" value={l.gyosha} onChange={(v) => patchLine(l.id, { gyosha: v })} onCommit={() => focusId(`st-l${l.id}-amt`)} placeholder="取引先（任意）" padY={7} listWidth={280} /></div>
                      <div style={td}><input id={`st-l${l.id}-amt`} aria-label={`${i + 1}行目の金額`} inputMode="numeric" value={fmtNum(l.amount)} onChange={(e) => patchLine(l.id, { amount: e.target.value.normalize('NFKC').replace(/\D/g, '').slice(0, 12) })} onKeyDown={onEnter(() => afterAmount(i))} placeholder="0" style={{ ...numInput, padding: '8px 10px' }} /></div>
                      <div style={{ ...td, textAlign: 'center' }}>
                        {multi && <button type="button" className="ef-act" aria-label={`${i + 1}行目を削除`} title="この行を削除" onClick={() => removeLine(l.id)} disabled={cur.lines.length <= 1} style={{ ...btn('#c0392b', false, true), padding: '6px 8px' }}>×</button>}
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8 }}>
                    {multi && <button type="button" className="ef-act" data-serial-add-line onClick={addLine} style={btn(accent, false, true)}>＋行を追加</button>}
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 14 }}>このページの合計　<b style={{ fontVariantNumeric: 'tabular-nums' }}>{pageTotal(cur).toLocaleString('ja-JP')}</b> 円</span>
                  </div>
                </div>

                {internal && (
                  <div style={{ display: 'grid', gridTemplateColumns: '150px 260px minmax(0,1fr)', gap: 8, alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: '#f5f0fc', border: '1px solid #d6c4f0' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#6b3fb5' }}>内部取引の相手区分</span>
                    <ComboField key={`a${cur.id}`} id="st-aite" kind="service" value={cur.aite} onChange={(v) => patchPage({ aite: v })} placeholder="相手区分" padY={7} listWidth={300} dropUp />
                    <span style={{ fontSize: 12, color: '#5b6773' }}>内部取引科目を使っているので、相手区分を入力します（定型には保存しません）。</span>
                  </div>
                )}
                {cur.enabled && errors[sel] && <div data-serial-current-error style={{ fontSize: 13, color: '#c0392b' }}>このページはまだ登録できません：{errors[sel]}</div>}
                {!cur.enabled && <div style={{ fontSize: 13, color: '#8290a0' }}>このページは無効です（登録しません）。左のチェックを入れると登録の対象になります。</div>}
              </>
            )}
          </div>
        </div>

        {err && <div data-serial-error role="alert" style={{ padding: '8px 12px', borderRadius: 8, background: '#fdecea', border: '1px solid #f1c4bd', color: '#c0392b', fontSize: 14 }}>{err}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span data-serial-summary style={{ fontSize: 14, flex: 1 }}>有効 <b>{active.length}</b> ページ／合計 <b style={{ fontVariantNumeric: 'tabular-nums' }}>{total.toLocaleString('ja-JP')}</b> 円</span>
          <button type="button" className="ef-act" onClick={onClose} style={btn()}>キャンセル</button>
          <button type="button" className="ef-act" data-serial-save onClick={save} title="いまのページの内容と有効／無効を、選んでいる定型に保存します（伝票は登録しません）" style={btn(accent)}>定型に保存</button>
          <button type="button" className="ef-act" data-serial-register onClick={register} style={btn(accent, true)}>有効な {active.length} ページを登録する</button>
        </div>
      </div>
    </Modal>
  );
}
