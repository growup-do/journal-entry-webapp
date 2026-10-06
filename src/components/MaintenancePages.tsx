// 設定メニュー「マスター設定／保守・運用」の追加画面（依頼書 2.3・5.1.2・5.5.6・6.3・6.4、図16〜19・図52）
//   財務分析設定（マニュアル 8.1）／決算チェック設定（図52）／パスワード（4.1）／仕訳更新（5.6）／データのバックアップ・復元（4.4、図19）
//   どの画面も「全区分共通」か「この区分のみ」かを見出しの下に明示する（6.3）。
//   取り消せない操作（復元）は他の操作と分けて置き、確認の流れを挟む（6.4）。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { ExplainModal } from './ExplainModal';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { Field, Notice, SettingsShell, Steps, Tabs, Toggle, btn, card, cardHead, input, lbl, numInput } from './ui';
import { ACCOUNT_META } from '../lib/accounts';
import { AUDIT_ITEMS, SERVICES, displayName } from '../data';
import { setSession, useSession } from '../store/session';

export interface MaintenancePageProps { variant: 'form' | 'sheet'; accent: string; /** 関連画面へ移動する（未指定のときは案内のみ表示） */ onNavigate?: (page: string) => void }

/* ======================================================================
 * 共通部品
 * ==================================================================== */
export type Scope = '全区分共通' | 'この区分のみ';
/** 設定の適用範囲バッジ（依頼書 6.3） */
export function ScopeBadge({ scope, note }: { scope: Scope; note?: string }) {
  const c = scope === '全区分共通' ? { bg: '#e8f0fb', fg: '#2c5f9e', bd: '#c5d8f2', mark: '◎' } : { bg: '#fff1d6', fg: '#8a5a00', bd: '#f0d9a8', mark: '●' };
  return (
    <span title={scope === '全区分共通' ? '法人内のすべての区分に同じ内容が適用されます' : '起動中の区分だけに適用されます（他の区分には影響しません）'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 10, background: c.bg, color: c.fg, border: '1px solid ' + c.bd, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
      <span aria-hidden style={{ fontSize: 9 }}>{c.mark}</span>{scope}{note && <span style={{ fontWeight: 600 }}>（{note}）</span>}
    </span>
  );
}
/** 見出し直下の「適用範囲」帯 */
export function ScopeBar({ scope, note, children, right }: { scope: Scope; note?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 22px', background: '#fafbfc', borderBottom: '1px solid #eef2f5', fontSize: 12.5, color: '#48565f', flexWrap: 'wrap' }}>
      <ScopeBadge scope={scope} note={note} />
      <span style={{ lineHeight: 1.6 }}>{children}</span>
      {right && <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>{right}</span>}
    </div>
  );
}
/** 日本語変換の確定 Enter を無視して、Enter で実行する */
const onEnter = (fn: () => void) => (e: ReactKeyboardEvent<HTMLElement>) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); fn(); } };
const digits = (v: string) => v.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[^0-9]/g, '');
/** 和暦の日時表示（依頼書 6.5） */
const warekiNow = () => { const d = new Date(); return `令和${d.getFullYear() - 2018}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/** 進行状況の表示用（プロトタイプ：時間経過で 0→100%） */
function useProgress() {
  const [p, setP] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; window.clearInterval(timer.current); }; }, []);
  const start = (ms: number, done: () => void) => {
    window.clearInterval(timer.current);
    setP(0);
    const t0 = Date.now();
    timer.current = window.setInterval(() => {
      const v = Math.min(100, Math.round(((Date.now() - t0) / ms) * 100));
      setP(v);
      if (v >= 100) { window.clearInterval(timer.current); window.setTimeout(() => { if (!alive.current) return; setP(null); done(); }, 350); }
    }, 80);
  };
  return { p, running: p != null, start };
}
function ProgressBar({ value, accent, height = 12 }: { value: number; accent: string; height?: number }) {
  return <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} style={{ height, background: '#eef2f5', borderRadius: height / 2, overflow: 'hidden' }}><div style={{ width: `${value}%`, height: '100%', background: accent, transition: 'width .1s' }} /></div>;
}
function Stepper({ value, onChange, unit, label }: { value: number; onChange: (n: number) => void; unit: string; label: string }) {
  const sb: CSSProperties = { width: 34, height: 34, border: '1px solid #cfd8e0', background: '#fff', borderRadius: 8, fontSize: 16, fontWeight: 700, color: '#48565f', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button type="button" aria-label={`${label}を1減らす`} onClick={() => onChange(Math.max(0, value - 1))} style={sb}>−</button>
      <input className="field-input ring" aria-label={label} inputMode="numeric" value={String(value)} onChange={(e) => onChange(Math.min(9999, parseInt(digits(e.target.value) || '0', 10)))} style={{ ...numInput, width: 84, fontSize: 15, fontWeight: 700 }} />
      <button type="button" aria-label={`${label}を1増やす`} onClick={() => onChange(Math.min(9999, value + 1))} style={sb}>＋</button>
      <span style={{ fontSize: 12.5, color: '#7a8794' }}>{unit}</span>
    </div>
  );
}
const radioRow = (on: boolean, accent: string): CSSProperties => ({ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', border: '1px solid ' + (on ? accent : '#dde4ea'), borderRadius: 10, background: on ? '#f7fbf9' : '#fff', cursor: 'pointer', fontSize: 13, lineHeight: 1.6 });
const sub: CSSProperties = { fontSize: 11.5, color: '#7a8794' };

/* ======================================================================
 * 財務分析設定（マニュアル 8.1）：財務分析科目設定／人数設定
 * ==================================================================== */
type FaCat = '成長性' | '安全性' | '健全性' | '効率性' | 'その他';
type FaCls = '現預金' | '資産' | '負債' | '純資産' | '費用' | '収益';
const FA_CATS: { cat: FaCat; note: string }[] = [
  { cat: '成長性', note: '収入・資産が前年度からどれだけ伸びたか' },
  { cat: '安全性', note: '支払能力・財政の安定度' },
  { cat: '健全性', note: '収支のバランス' },
  { cat: '効率性', note: '収入に対する費用の割合' },
  { cat: 'その他', note: '職員・園児 1 人当たりの指標など' },
];
const FA_ACCOUNTS: { name: string; code: string; cls: FaCls }[] = [
  ...ACCOUNT_META.map((m) => ({ name: m.name, code: m.code, cls: m.cls as FaCls })),
  { name: '建物', code: '1610', cls: '資産' }, { name: '器具及び備品', code: '1620', cls: '資産' },
  { name: '事業未払金', code: '2110', cls: '負債' }, { name: '職員預り金', code: '2120', cls: '負債' }, { name: '設備資金借入金', code: '2510', cls: '負債' }, { name: '退職給付引当金', code: '2520', cls: '負債' },
  { name: '基本金', code: '3110', cls: '純資産' }, { name: '国庫補助金等特別積立金', code: '3210', cls: '純資産' }, { name: '次期繰越活動増減差額', code: '3910', cls: '純資産' },
  { name: '非常勤職員給与', code: '5180', cls: '費用' }, { name: '減価償却費', code: '5390', cls: '費用' },
];
const JINKEN = /俸給|手当|法定福利|非常勤/;
const isAsset = (c: FaCls) => c === '現預金' || c === '資産';
interface FaPart { label: string; pick: (a: { name: string; cls: FaCls }) => boolean }
interface FaDef { cat: FaCat; name: string; formula: string; parts: FaPart[]; guide: string; head?: '職員' | '園児' }
const FA_DEFS: FaDef[] = [
  { cat: '成長性', name: '保育所基礎収入伸長率', formula: '（ ① 当年度の保育所基礎収入 − 前年度の保育所基礎収入 ） ÷ 前年度の保育所基礎収入 × 100', parts: [{ label: '① 保育所基礎収入に含める科目', pick: (a) => /委託費|利用料/.test(a.name) }], guide: '委託費収益・利用料収益など、保育所の基礎となる収入の科目を選びます。前年度の金額は「残高（繰越・前年実績）」の前年実績を使います。' },
  { cat: '成長性', name: '総資産増加率', formula: '（ ① 当年度末の総資産 − 前年度末の総資産 ） ÷ 前年度末の総資産 × 100', parts: [{ label: '① 総資産に含める科目', pick: (a) => isAsset(a.cls) }], guide: '資産の部のすべての科目を選ぶのが標準です。' },
  { cat: '安全性', name: '流動比率', formula: '① 流動資産 ÷ ② 流動負債 × 100', parts: [{ label: '① 流動資産に含める科目', pick: (a) => a.cls === '現預金' || /未収|立替|仮払/.test(a.name) }, { label: '② 流動負債に含める科目', pick: (a) => /未払金|預り金/.test(a.name) }], guide: '1 年以内に現金化できる資産と、1 年以内に支払う負債の割合です。1 年基準で振り替えた借入金は ② に含めます。' },
  { cat: '安全性', name: '現金預金比率', formula: '① 現金預金 ÷ ② 流動負債 × 100', parts: [{ label: '① 現金預金に含める科目', pick: (a) => a.cls === '現預金' }, { label: '② 流動負債に含める科目', pick: (a) => /未払金|預り金/.test(a.name) }], guide: '小口現金を含めるかどうかは法人の方針に合わせてください。' },
  { cat: '安全性', name: '純資産比率', formula: '① 純資産 ÷ ② 総資産 × 100', parts: [{ label: '① 純資産に含める科目', pick: (a) => a.cls === '純資産' }, { label: '② 総資産に含める科目', pick: (a) => isAsset(a.cls) }], guide: '基本金・国庫補助金等特別積立金・次期繰越活動増減差額などを ① に選びます。' },
  { cat: '健全性', name: 'サービス活動増減差額比率', formula: '（ ① サービス活動収益 − ② サービス活動費用 ） ÷ ① サービス活動収益 × 100', parts: [{ label: '① サービス活動収益に含める科目', pick: (a) => a.cls === '収益' }, { label: '② サービス活動費用に含める科目', pick: (a) => a.cls === '費用' }], guide: '特別増減の部・サービス活動外の科目は含めません。' },
  { cat: '健全性', name: '基本収入比率', formula: '① 基本収入 ÷ ② サービス活動収益 × 100', parts: [{ label: '① 基本収入に含める科目', pick: (a) => /委託費/.test(a.name) }, { label: '② サービス活動収益に含める科目', pick: (a) => a.cls === '収益' }], guide: '委託費収益（施設型給付費収益）など、制度上の基本となる収入を ① に選びます。' },
  { cat: '効率性', name: '人件費比率', formula: '① 人件費 ÷ ② サービス活動収益 × 100', parts: [{ label: '① 人件費に含める科目', pick: (a) => a.cls === '費用' && JINKEN.test(a.name) }, { label: '② サービス活動収益に含める科目', pick: (a) => a.cls === '収益' }], guide: '職員俸給・諸手当・法定福利費・非常勤職員給与などを ① に選びます。' },
  { cat: '効率性', name: '事業費比率', formula: '① 事業費 ÷ ② サービス活動収益 × 100', parts: [{ label: '① 事業費に含める科目', pick: (a) => a.cls === '費用' && !JINKEN.test(a.name) && a.name !== '減価償却費' }, { label: '② サービス活動収益に含める科目', pick: (a) => a.cls === '収益' }], guide: '給食費・保育材料費・水道光熱費（事業）などを ① に選びます。' },
  { cat: '効率性', name: '事務費比率', formula: '① 事務費 ÷ ② サービス活動収益 × 100', parts: [{ label: '① 事務費に含める科目', pick: (a) => /通信運搬|印刷製本|賃借料/.test(a.name) }, { label: '② サービス活動収益に含める科目', pick: (a) => a.cls === '収益' }], guide: '事務費に区分している科目を ① に選びます。' },
  { cat: 'その他', name: '職員１人当たり、保育所基礎収入', formula: '① 保育所基礎収入 ÷ 専任職員数（人数設定）', parts: [{ label: '① 保育所基礎収入に含める科目', pick: (a) => /委託費|利用料/.test(a.name) }], guide: '分母の専任職員数は「人数設定」タブで入力した人数を使います。', head: '職員' },
  { cat: 'その他', name: '園児１人当たり、人件費', formula: '① 人件費 ÷ 園児数の合計（人数設定）', parts: [{ label: '① 人件費に含める科目', pick: (a) => a.cls === '費用' && JINKEN.test(a.name) }], guide: '分母の園児数は「人数設定」タブで入力した年齢ごとの児童数の合計を使います。', head: '園児' },
  { cat: 'その他', name: '支払資金残高率', formula: '① 当期末支払資金残高 ÷ ② 事業活動収入 × 100', parts: [{ label: '① 支払資金に含める科目', pick: (a) => a.cls === '現預金' || /未収|未払金|預り金/.test(a.name) }, { label: '② 事業活動収入に含める科目', pick: (a) => a.cls === '収益' }], guide: '決算チェック「27. 予算額の支払資金残高率」と同じ考え方です。' },
];
const faKey = (name: string, i: number) => `${name}#${i}`;
const faDefault = (): Record<string, string[]> => Object.fromEntries(FA_DEFS.flatMap((d) => d.parts.map((p, i) => [faKey(d.name, i), FA_ACCOUNTS.filter(p.pick).map((a) => a.name)])));
const AGES = ['0歳児', '1歳児', '2歳児', '3歳児', '4歳児', '5歳児'];

export function FinancialAnalysisSettingsPage({ variant, accent, onNavigate }: MaintenancePageProps) {
  const s = useSession();
  const toast = useToast();
  const [tab, setTab] = useState('財務分析科目設定');
  const [cur, setCur] = useState(FA_DEFS[2].name);
  const [picked, setPicked] = useState<Record<string, string[]>>(faDefault);
  const [saved, setSaved] = useState<Record<string, string[]>>(faDefault);
  const [q, setQ] = useState('');
  const [guide, setGuide] = useState(false);
  const [staff, setStaff] = useState(18);
  const [kids, setKids] = useState<number[]>([9, 15, 18, 20, 20, 20]);
  const def = FA_DEFS.find((d) => d.name === cur) ?? FA_DEFS[0];
  const dirty = (d: FaDef) => d.parts.some((_, i) => (picked[faKey(d.name, i)] ?? []).join('|') !== (saved[faKey(d.name, i)] ?? []).join('|'));
  const toggle = (k: string, name: string) => setPicked((p) => { const set = new Set(p[k] ?? []); if (set.has(name)) set.delete(name); else set.add(name); return { ...p, [k]: FA_ACCOUNTS.filter((a) => set.has(a.name)).map((a) => a.name) }; });
  const kidsTotal = kids.reduce((a, b) => a + b, 0);
  const go = (page: string) => (onNavigate ? onNavigate(page) : toast.show(`メニューの「${displayName(page)}」から開きます`));

  return (
    <SettingsShell variant={variant} title="財務分析設定" badge="マスター設定" desc="経年グラフ・分析グラフ・経営分析の帳票で使う指標について、計算に含める科目と、職員・園児の人数を設定します。">
      <ToastView msg={toast.msg} />
      <Tabs items={['財務分析科目設定', '人数設定']} current={tab} onChange={setTab} accent={accent} />

      {tab === '財務分析科目設定' && (
        <>
          <ScopeBar scope="全区分共通" note="法人全体で共有" right={<><button type="button" className="btn-outline" onClick={() => go('分析グラフ')} style={btn('#5b6773', false, true)}>分析グラフで確認 →</button></>}>
            指標ごとの対象科目は、法人内のすべての区分で同じ設定を使います。
          </ScopeBar>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)', minHeight: 520 }}>
            {/* 指標の一覧（分野別） */}
            <div style={{ borderRight: '1px solid #eef2f5', padding: '12px 0', overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
              {FA_CATS.map((c) => (
                <div key={c.cat} style={{ marginBottom: 10 }}>
                  <div style={{ padding: '6px 18px', fontSize: 12, fontWeight: 800, color: '#48565f' }}>{c.cat}<span style={{ fontWeight: 500, color: '#9aa5b1', marginLeft: 8, fontSize: 11 }}>{c.note}</span></div>
                  {FA_DEFS.filter((d) => d.cat === c.cat).map((d) => {
                    const on = d.name === cur;
                    const n = d.parts.reduce((a, _, i) => a + (picked[faKey(d.name, i)]?.length ?? 0), 0);
                    return (
                      <button key={d.name} type="button" onClick={() => { setCur(d.name); setQ(''); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '9px 18px', border: 'none', borderLeft: '4px solid ' + (on ? accent : 'transparent'), background: on ? '#eef2f6' : 'transparent', fontFamily: 'inherit', fontSize: 13.5, fontWeight: on ? 700 : 500, color: '#22303c', cursor: 'pointer' }}>
                        <span style={{ flex: 1 }}>{d.name}</span>
                        {dirty(d) && <span style={{ fontSize: 10.5, fontWeight: 800, padding: '1px 6px', borderRadius: 6, background: '#fff1b8', color: '#8a6d00' }}>未保存</span>}
                        <span style={{ fontSize: 11, color: n ? '#7a8794' : '#c0392b', whiteSpace: 'nowrap' }}>{n ? `${n} 科目` : '未設定'}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* 指標の詳細：算式・科目選択・ガイド */}
            <div style={{ padding: 20, display: 'grid', gap: 14, alignContent: 'start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 10, background: '#eef2f6', color: '#3d4a56' }}>{def.cat}</span>
                <span style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Zen Kaku Gothic New', sans-serif" }}>{def.name}</span>
                <button type="button" className="btn-outline" onClick={() => setGuide(true)} style={{ ...btn('#5b6773', false, true), marginLeft: 'auto' }}>ガイドを表示</button>
              </div>
              <div>
                <span style={lbl}>算式</span>
                <div style={{ padding: '12px 14px', border: '1px solid #dde4ea', borderRadius: 10, background: '#f6f8fa', fontSize: 14.5, fontWeight: 600, lineHeight: 1.8 }}>{def.formula}</div>
              </div>
              {def.head && (
                <Notice>この指標は「人数設定」の{def.head === '職員' ? `専任職員数（現在 ${staff} 人）` : `園児数の合計（現在 ${kidsTotal} 人）`}を使います。<button type="button" onClick={() => setTab('人数設定')} style={{ border: 'none', background: 'transparent', color: accent, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, textDecoration: 'underline' }}>人数設定を開く</button></Notice>
              )}
              <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="科目名・コードで絞り込み" aria-label="科目の絞り込み" style={{ ...input, maxWidth: 300 }} />
              <div style={{ display: 'grid', gridTemplateColumns: def.parts.length > 1 ? 'repeat(auto-fit, minmax(300px, 1fr))' : '1fr', gap: 14 }}>
                {def.parts.map((p, i) => {
                  const k = faKey(def.name, i);
                  const sel = new Set(picked[k] ?? []);
                  const list = FA_ACCOUNTS.filter((a) => !q.trim() || a.name.includes(q.trim()) || a.code.startsWith(q.trim()));
                  return (
                    <div key={k} style={card}>
                      <div style={cardHead}>{p.label}<span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, color: '#7a8794' }}>{sel.size} 科目を選択中</span></div>
                      <div style={{ maxHeight: 300, overflow: 'auto' }}>
                        {list.map((a) => (
                          <label key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderBottom: '1px solid #f1f4f6', fontSize: 13.5, cursor: 'pointer', background: sel.has(a.name) ? '#f7fbf9' : '#fff' }}>
                            <input type="checkbox" checked={sel.has(a.name)} onChange={() => toggle(k, a.name)} style={{ width: 16, height: 16 }} />
                            <span style={{ width: 46, color: '#8290a0', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{a.code}</span>
                            <span style={{ flex: 1, fontWeight: sel.has(a.name) ? 700 : 400 }}>{a.name}</span>
                            <span style={{ fontSize: 11, color: '#9aa5b1' }}>{a.cls}</span>
                          </label>
                        ))}
                        {!list.length && <div style={{ padding: 16, color: '#9aa5b1', fontSize: 12.5 }}>該当する科目がありません。</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, padding: '8px 12px', background: '#fafbfc' }}>
                        <button type="button" onClick={() => setPicked((x) => ({ ...x, [k]: FA_ACCOUNTS.filter(p.pick).map((a) => a.name) }))} style={btn('#5b6773', false, true)}>標準の科目に戻す</button>
                        <button type="button" onClick={() => setPicked((x) => ({ ...x, [k]: [] }))} style={btn('#5b6773', false, true)}>すべて外す</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                {dirty(def) && <span style={{ fontSize: 12, color: '#8a6d00', marginRight: 'auto' }}>変更があります。保存すると全区分のグラフ・帳票に反映されます。</span>}
                <button type="button" onClick={() => setPicked((x) => ({ ...x, ...Object.fromEntries(def.parts.map((_, i) => [faKey(def.name, i), saved[faKey(def.name, i)] ?? []])) }))} disabled={!dirty(def)} style={{ ...btn(), opacity: dirty(def) ? 1 : 0.5 }}>変更を取り消す</button>
                <button type="button" className="submit-btn" onClick={() => { setSaved(picked); toast.show(`「${def.name}」の対象科目を保存しました（全区分共通）`); }} style={btn(accent, true)}>保存</button>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === '人数設定' && (
        <>
          <ScopeBar scope="この区分のみ" note={s.division}>
            人数は区分（施設）ごとに入力します。{s.fiscalYear} の「職員 1 人当たり」「園児 1 人当たり」の指標の計算に使います。
          </ScopeBar>
          <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, maxWidth: 980 }}>
            <div style={card}>
              <div style={cardHead}>職員数</div>
              <div style={{ padding: 16, display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>専任職員数</span><Stepper value={staff} onChange={setStaff} unit="人" label="専任職員数" /></div>
                <div style={sub}>数値は直接入力するか、− ＋ ボタンで増減します。</div>
              </div>
            </div>
            <div style={card}>
              <div style={cardHead}>年齢ごとの児童数<span style={{ marginLeft: 'auto', fontSize: 12.5 }}>合計 <b style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{kidsTotal}</b> 人</span></div>
              <div style={{ padding: 16, display: 'grid', gap: 10 }}>
                {AGES.map((a, i) => (
                  <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{a}</span><Stepper value={kids[i]} onChange={(n) => setKids((k) => k.map((v, j) => (j === i ? n : v)))} unit="人" label={`${a}の児童数`} /></div>
                ))}
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setStaff(18); setKids([9, 15, 18, 20, 20, 20]); }} style={btn()}>変更を取り消す</button>
              <button type="button" className="submit-btn" onClick={() => toast.show(`人数設定を保存しました（${s.division}：職員 ${staff} 人・園児 ${kidsTotal} 人）`)} style={btn(accent, true)}>保存</button>
            </div>
          </div>
        </>
      )}

      <ExplainModal open={guide} onClose={() => setGuide(false)} accent={accent} title={`ガイド：${def.name}`} source="マニュアル 8.1.1 財務分析科目設定" sections={[
        { h: 'この指標の算式', body: <>{def.formula}</> },
        { h: '科目の選び方', body: <>{def.guide}</> },
        { h: '設定の適用範囲', body: <>財務分析科目設定は法人全体で共有します（全区分共通）。科目の区分コードを変更したときは、対象科目を確認し直してください。</> },
      ]} />
    </SettingsShell>
  );
}

/* ======================================================================
 * 決算チェック設定（図52）：28 項目の有効／無効と、項目ごとの設定
 * ==================================================================== */
const AUDIT_GROUPS: { label: string; note: string; nos: number[] }[] = [
  { label: '会計データ同士の比較', note: '会計システムのデータ同士を比較してチェックします（01〜14、18〜19）', nos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 18, 19] },
  { label: '減価償却システムとの比較', note: '減価償却システムのデータと会計システムのデータを比較します（15〜17）', nos: [15, 16, 17] },
  { label: '★印の項目', note: '期中残高・内部取引・予算などの追加チェック（20〜28）', nos: [20, 21, 22, 23, 24, 25, 26, 27, 28] },
];
const AUDIT_PARAMS: Record<number, { label: string; unit: string; def: number }> = {
  14: { label: '抽出する金額（この金額以上の費用を一覧にします）', unit: '円', def: 100000 },
  26: { label: '予備費の予算額の上限（事業活動支出の予算に対する割合）', unit: '％', def: 3 },
  27: { label: '支払資金残高率の上限', unit: '％', def: 30 },
};
const auditDefaultAccts = (no: number) => ACCOUNT_META.filter((m, i) => (no >= 20 ? m.kind === 'BS' : m.kind === 'BS' || (i + no) % 3 === 0)).map((m) => m.name);
const no2 = (n: number) => String(n).padStart(2, '0');

export function AuditSettingsPage({ variant, accent, onNavigate }: MaintenancePageProps) {
  const s = useSession();
  const toast = useToast();
  const [mode, setMode] = useState<'区分' | '法人'>('区分');
  const [corpEnabled, setCorpEnabled] = useState<Record<number, boolean>>({ 21: false, 22: false });
  const [accts, setAccts] = useState<Record<string, string[]>>({});
  const [params, setParams] = useState<Record<string, number>>({});
  const [dlg, setDlg] = useState<null | { no: number; picked: string[]; param: string; q: string }>(null);
  const [help, setHelp] = useState(false);
  const isOn = (no: number) => (mode === '区分' ? s.auditEnabled[no] !== false : corpEnabled[no] !== false);
  const setOn = (no: number, v: boolean) => (mode === '区分' ? setSession({ auditEnabled: { ...s.auditEnabled, [no]: v } }) : setCorpEnabled((c) => ({ ...c, [no]: v })));
  const setAll = (v: boolean) => { const all = Object.fromEntries(AUDIT_ITEMS.map((a) => [a.no, v])); if (mode === '区分') setSession({ auditEnabled: all }); else setCorpEnabled(all); toast.show(`28 項目をすべて${v ? '有効' : '無効'}にしました`); };
  const k = (no: number) => `${mode}:${no}`;
  const acctsOf = (no: number) => accts[k(no)] ?? auditDefaultAccts(no);
  const paramOf = (no: number) => params[k(no)] ?? AUDIT_PARAMS[no]?.def;
  const open = (no: number) => setDlg({ no, picked: acctsOf(no), param: AUDIT_PARAMS[no] ? String(paramOf(no)) : '', q: '' });
  const saveDlg = () => {
    if (!dlg) return;
    setAccts((a) => ({ ...a, [k(dlg.no)]: ACCOUNT_META.filter((m) => dlg.picked.includes(m.name)).map((m) => m.name) }));
    if (AUDIT_PARAMS[dlg.no]) setParams((p) => ({ ...p, [k(dlg.no)]: parseInt(digits(dlg.param) || '0', 10) }));
    toast.show(`${no2(dlg.no)}. ${AUDIT_ITEMS.find((a) => a.no === dlg.no)?.name ?? ''} の設定を保存しました`);
    setDlg(null);
  };
  const onCount = AUDIT_ITEMS.filter((a) => isOn(a.no)).length;
  const dlgItem = dlg ? AUDIT_ITEMS.find((a) => a.no === dlg.no) : undefined;
  const seg = (on: boolean): CSSProperties => ({ padding: '8px 16px', border: '1px solid ' + (on ? accent : '#cfd8e0'), background: on ? accent : '#fff', color: on ? '#fff' : '#5b6773', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });

  return (
    <SettingsShell variant={variant} title="決算チェック設定" badge="保守・運用" draft={false} desc="決算チェック（決算調査）の 28 項目について、チェックする項目の有効／無効と、項目ごとの条件（対象科目など）を設定します。" actions={<>
      <button type="button" className="btn-outline" onClick={() => setHelp(true)} style={btn()}>説明</button>
      <button type="button" className="btn-outline" onClick={() => (onNavigate ? onNavigate('決算調査') : toast.show('メニューの「決算チェック（決算調査）」から開きます'))} style={btn()}>決算チェック（決算調査）を開く →</button>
    </>}>
      <ToastView msg={toast.msg} />
      <div style={{ padding: '14px 22px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div role="tablist" aria-label="設定の対象" style={{ display: 'inline-flex' }}>
          <button type="button" role="tab" aria-selected={mode === '区分'} onClick={() => setMode('区分')} style={{ ...seg(mode === '区分'), borderRadius: '8px 0 0 8px' }}>決算チェック設定（この区分）</button>
          <button type="button" role="tab" aria-selected={mode === '法人'} onClick={() => setMode('法人')} style={{ ...seg(mode === '法人'), borderRadius: '0 8px 8px 0', borderLeft: 'none' }}>法人決算チェック設定（法人全体）</button>
        </div>
        <span style={{ fontSize: 12.5, color: '#5b6773' }}>有効 <b style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{onCount}</b> ／ 28 項目</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => setAll(true)} style={btn('#5b6773', false, true)}>すべて有効</button>
          <button type="button" onClick={() => setAll(false)} style={btn('#5b6773', false, true)}>すべて無効</button>
        </span>
      </div>
      <div style={{ margin: '12px 22px 0', borderRadius: 10, overflow: 'hidden', border: '1px solid #eef2f5' }}>
        {mode === '区分'
          ? <ScopeBar scope="この区分のみ" note={s.division}>この画面の設定は、起動中の区分のみに適用されます。ほかの区分は、その区分で起動して設定してください。</ScopeBar>
          : <ScopeBar scope="全区分共通" note="法人全体">法人全体の決算チェック（法人で起動したときの決算調査）に使う設定です。区分ごとの設定とは別に保持します。</ScopeBar>}
      </div>

      <div style={{ padding: '16px 22px 22px', display: 'grid', gap: 16 }}>
        {AUDIT_GROUPS.map((g) => (
          <div key={g.label} style={card}>
            <div style={cardHead}>{g.label}<span style={{ fontSize: 11.5, fontWeight: 500, color: '#8290a0' }}>{g.note}</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(430px, 1fr))' }}>
              {g.nos.map((no) => {
                const it = AUDIT_ITEMS.find((a) => a.no === no);
                if (!it) return null;
                const on = isOn(no);
                const pr = AUDIT_PARAMS[no];
                return (
                  <div key={no} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #f1f4f6', borderRight: '1px solid #f1f4f6', background: on ? '#fff' : '#fafbfc' }}>
                    <span style={{ width: 26, fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: on ? '#22303c' : '#9aa5b1' }}>{no2(no)}</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: on ? accent : '#9aa5b1', fontWeight: 700, cursor: 'pointer', width: 62, flex: 'none' }}>
                      <input type="checkbox" checked={on} onChange={(e) => setOn(no, e.target.checked)} aria-label={`${no2(no)} ${it.name} を有効にする`} style={{ width: 17, height: 17 }} />{on ? '有効' : '無効'}
                    </label>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: on ? '#22303c' : '#9aa5b1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                      <div style={sub}>対象科目 {acctsOf(no).length} 件{pr ? `　／　${pr.unit === '円' ? paramOf(no).toLocaleString('ja-JP') + ' 円以上' : paramOf(no) + ' ％'}` : ''}</div>
                    </div>
                    <button type="button" className="btn-outline" onClick={() => open(no)} style={btn('#5b6773', false, true)}>設定</button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <Notice>減価償却システムのデータの指定（15〜17）は「法人・区分」の設定で行います。各項目で使っている科目の区分コードを変更した場合は、その項目の「設定」で対象科目を選び直してください。</Notice>
      </div>

      <Modal open={!!dlg} onClose={() => setDlg(null)} width={640} title={dlg ? `${no2(dlg.no)}. ${dlgItem?.name ?? ''} の設定` : ''}>
        {dlg && (
          <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5, color: '#5b6773' }}>
              <ScopeBadge scope={mode === '区分' ? 'この区分のみ' : '全区分共通'} note={mode === '区分' ? s.division : '法人全体'} />
              診断の条件式を構成する勘定科目を、チェックで有効／無効に切り替えます。
            </div>
            {AUDIT_PARAMS[dlg.no] && (
              <Field label={AUDIT_PARAMS[dlg.no].label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input className="field-input ring" inputMode="numeric" value={dlg.param ? parseInt(dlg.param, 10).toLocaleString('ja-JP') : ''} onChange={(e) => setDlg({ ...dlg, param: digits(e.target.value).slice(0, 10) })} onKeyDown={onEnter(saveDlg)} style={{ ...numInput, width: 160 }} />
                  <span style={{ fontSize: 12.5, color: '#7a8794' }}>{AUDIT_PARAMS[dlg.no].unit}</span>
                </div>
              </Field>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input className="search-input" value={dlg.q} onChange={(e) => setDlg({ ...dlg, q: e.target.value })} placeholder="科目名・コードで絞り込み" aria-label="科目の絞り込み" style={{ ...input, width: 240 }} />
              <span style={{ fontSize: 12, color: '#7a8794' }}>{dlg.picked.length} 科目を選択中</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => setDlg({ ...dlg, picked: auditDefaultAccts(dlg.no) })} style={btn('#5b6773', false, true)}>標準に戻す</button>
                <button type="button" onClick={() => setDlg({ ...dlg, picked: [] })} style={btn('#5b6773', false, true)}>すべて外す</button>
              </span>
            </div>
            <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: 320, overflow: 'auto' }}>
              {ACCOUNT_META.filter((m) => !dlg.q.trim() || m.name.includes(dlg.q.trim()) || m.code.startsWith(dlg.q.trim())).map((m) => {
                const on = dlg.picked.includes(m.name);
                return (
                  <label key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderBottom: '1px solid #f1f4f6', fontSize: 13.5, cursor: 'pointer', background: on ? '#f7fbf9' : '#fff' }}>
                    <input type="checkbox" checked={on} onChange={() => setDlg({ ...dlg, picked: on ? dlg.picked.filter((n) => n !== m.name) : [...dlg.picked, m.name] })} style={{ width: 16, height: 16 }} />
                    <span style={{ width: 46, color: '#8290a0', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{m.code}</span>
                    <span style={{ flex: 1, fontWeight: on ? 700 : 400 }}>{m.name}</span>
                    <span style={{ fontSize: 11, color: '#9aa5b1' }}>{m.cls}</span>
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setDlg(null)} style={btn()}>キャンセル</button>
              <button type="button" className="submit-btn" onClick={saveDlg} style={btn(accent, true)}>OK</button>
            </div>
          </div>
        )}
      </Modal>
      <ExplainModal open={help} onClose={() => setHelp(false)} accent={accent} title="決算チェック設定の説明" source="現行画面【決算チェックシステム - 設定】" sections={[
        { h: '有効／無効', body: <>チェックを外した項目は、決算チェック（決算調査）の実行時に調査しません。結果一覧では「対象外」として表示します。</> },
        { h: '項目ごとの設定', body: <>各行の「設定」から、その項目の診断に使う勘定科目を選びます。金額や割合で判定する項目（14・26・27）は、しきい値もここで設定します。</> },
        { h: '適用範囲', body: <>「決算チェック設定（この区分）」は起動中の区分のみに適用されます。「法人決算チェック設定（法人全体）」は法人全体の決算チェックに使う設定で、区分ごとの設定とは別に保持します。</> },
        { h: '項目の分類', body: <>01〜14・18〜19 は会計システムのデータ同士を比較します。15〜17 は減価償却システムのデータと会計システムのデータを比較します。★印（20〜28）は期中残高や内部取引などの追加チェックです。</> },
      ]} />
    </SettingsShell>
  );
}

/* ======================================================================
 * 仕訳更新（マニュアル 5.6）：対象範囲の選択 → 確認 → 進行状況 → 完了
 * ==================================================================== */
const MONTHS = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];
const MONTH_COUNTS = [21, 18, 19, 22, 17, 20, 16, 18, 15, 14, 13, 15];

export function JournalRefreshPage({ variant, accent, onNavigate }: MaintenancePageProps) {
  const s = useSession();
  const toast = useToast();
  const prog = useProgress();
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState<'この区分' | '全入力区分'>('この区分');
  const [range, setRange] = useState<'年度全体' | '月を指定'>('年度全体');
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(11);
  const [agree, setAgree] = useState(false);
  const [last, setLast] = useState({ at: '令和8年9月10日 10:12', by: '鈴木', count: 196 });
  const entryDivs = SERVICES.length;
  const lo = Math.min(from, to), hi = Math.max(from, to);
  const perDiv = range === '年度全体' ? MONTH_COUNTS.reduce((a, b) => a + b, 0) : MONTH_COUNTS.slice(lo, hi + 1).reduce((a, b) => a + b, 0);
  const total = target === 'この区分' ? perDiv : Math.round(perDiv * (entryDivs - 0.4));
  const changed = Math.round(total * 0.06);
  const rangeLabel = range === '年度全体' ? `${s.fiscalYear} の全期間（4月〜3月）` : `${s.fiscalYear} ${MONTHS[lo]}〜${MONTHS[hi]}`;
  const targetLabel = target === 'この区分' ? s.division : `法人内のすべての入力区分（${entryDivs} 区分）`;
  const run = () => {
    setStep(2);
    prog.start(target === 'この区分' ? 3200 : 5600, () => { setStep(3); setLast({ at: warekiNow(), by: '鈴木', count: total }); toast.show(`仕訳更新が完了しました（${total.toLocaleString('ja-JP')} 件）`); });
  };
  const reset = () => { setStep(0); setAgree(false); };
  const row: CSSProperties = { display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10, padding: '9px 0', borderBottom: '1px solid #f1f4f6', fontSize: 13.5 };

  return (
    <SettingsShell variant={variant} title="仕訳更新" badge="保守・運用" draft={false} desc="勘定科目と資金科目の連動を変更したあとに、登録済みの伝票を整理し直して、集計データを作り直します。">
      <ToastView msg={toast.msg} />
      <ScopeBar scope={target === 'この区分' ? 'この区分のみ' : '全区分共通'} note={target === 'この区分' ? s.division : '法人内の全入力区分'} right={<span style={sub}>前回の実行：{last.at}（{last.by}・{last.count.toLocaleString('ja-JP')} 件）</span>}>
        {target === 'この区分' ? '起動中の区分の伝票だけを対象にします。' : '法人内のすべての入力区分の伝票を対象にします。'}
      </ScopeBar>
      <Steps steps={['対象範囲の選択', '確認', '実行', '完了']} current={step} accent={accent} />
      <div style={{ padding: 22, maxWidth: 820 }}>
        {step === 0 && (
          <div style={{ display: 'grid', gap: 18 }}>
            <Notice>科目設定で「対応する資金科目」や資金区分を変更したときに実行します。貸借対照表・事業活動計算書と資金収支計算書の連動も整理し直します。伝票の内容（日付・金額・摘要）は変わりません。</Notice>
            <div>
              <span style={lbl}>対象の区分</span>
              <div style={{ display: 'grid', gap: 8 }}>
                <label style={radioRow(target === 'この区分', accent)}><input type="radio" name="jr-target" checked={target === 'この区分'} onChange={() => setTarget('この区分')} /><span><b>起動中の区分のみ</b>（通常はこちら）<br /><span style={sub}>{s.division}</span></span></label>
                <label style={radioRow(target === '全入力区分', accent)}><input type="radio" name="jr-target" checked={target === '全入力区分'} onChange={() => setTarget('全入力区分')} /><span><b>法人内のすべての入力区分</b><br /><span style={sub}>{SERVICES.join('／')}</span></span></label>
              </div>
            </div>
            <div>
              <span style={lbl}>対象の期間（{s.fiscalYear}）</span>
              <div style={{ display: 'grid', gap: 8 }}>
                <label style={radioRow(range === '年度全体', accent)}><input type="radio" name="jr-range" checked={range === '年度全体'} onChange={() => setRange('年度全体')} /><span><b>年度全体</b>（1 年分の全伝票。通常はこちら）</span></label>
                <label style={radioRow(range === '月を指定', accent)}>
                  <input type="radio" name="jr-range" checked={range === '月を指定'} onChange={() => setRange('月を指定')} />
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><b>月を指定</b>
                    <select value={from} onChange={(e) => { setFrom(Number(e.target.value)); setRange('月を指定'); }} aria-label="開始月" style={{ ...input, width: 90, padding: '5px 8px' }}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>〜
                    <select value={to} onChange={(e) => { setTo(Number(e.target.value)); setRange('月を指定'); }} aria-label="終了月" style={{ ...input, width: 90, padding: '5px 8px' }}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
                  </span>
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid #dde4ea', borderRadius: 10, background: '#f6f8fa' }}>
              <span style={{ fontSize: 13 }}>対象の伝票</span><b style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>{total.toLocaleString('ja-JP')}</b><span style={{ fontSize: 13 }}>件</span>
              <span style={sub}>目安の時間：{total > 600 ? '2〜3 分' : '1 分以内'}</span>
              <button type="button" className="submit-btn" onClick={() => setStep(1)} style={{ ...btn(accent, true), marginLeft: 'auto' }}>確認へ進む</button>
            </div>
          </div>
        )}
        {step === 1 && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={card}>
              <div style={cardHead}>実行する内容</div>
              <div style={{ padding: '4px 16px 8px' }}>
                <div style={row}><span style={{ color: '#7a8794' }}>対象の区分</span><b>{targetLabel}</b></div>
                <div style={row}><span style={{ color: '#7a8794' }}>対象の期間</span><b>{rangeLabel}</b></div>
                <div style={row}><span style={{ color: '#7a8794' }}>対象の伝票</span><b>{total.toLocaleString('ja-JP')} 件</b></div>
                <div style={{ ...row, borderBottom: 'none' }}><span style={{ color: '#7a8794' }}>処理の内容</span><span>勘定科目と資金科目の連動を整理し、集計データを作り直します</span></div>
              </div>
            </div>
            <Notice tone="warn">開始すると、すべての伝票の整理が終わるまで途中で中断できません。処理中は、対象の区分で伝票の入力・訂正ができません。ほかの利用者が入力中でないことを確認してから開始してください。</Notice>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 17, height: 17 }} />途中で中断できないことを確認しました</label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setStep(0)} style={btn()}>← 対象範囲に戻る</button>
              <button type="button" className="submit-btn" disabled={!agree} onClick={run} style={{ ...btn('#b7791f', true), opacity: agree ? 1 : 0.45, cursor: agree ? 'pointer' : 'not-allowed' }}>仕訳更新を開始</button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div style={{ display: 'grid', gap: 14 }} aria-live="polite">
            <div style={{ fontSize: 15, fontWeight: 700 }}>仕訳を更新しています…</div>
            <ProgressBar value={prog.p ?? 100} accent={accent} height={16} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, fontVariantNumeric: 'tabular-nums' }}>
              <b style={{ fontSize: 22 }}>{prog.p ?? 100}%</b>
              <span style={{ fontSize: 13, color: '#5b6773' }}>{Math.round((total * (prog.p ?? 100)) / 100).toLocaleString('ja-JP')} ／ {total.toLocaleString('ja-JP')} 件</span>
              <span style={{ ...sub, marginLeft: 'auto' }}>{targetLabel}　{rangeLabel}</span>
            </div>
            <Notice tone="warn">処理中は中断できません。この画面を閉じずにお待ちください。</Notice>
          </div>
        )}
        {step === 3 && (
          <div style={{ display: 'grid', gap: 16 }}>
            <Notice tone="ok"><b>仕訳更新が完了しました。</b>　試算表・決算書・資金収支計算書に、更新後の集計が反映されています。</Notice>
            <div style={card}>
              <div style={cardHead}>実行結果</div>
              <div style={{ padding: '4px 16px 8px' }}>
                <div style={row}><span style={{ color: '#7a8794' }}>完了した日時</span><b>{last.at}</b></div>
                <div style={row}><span style={{ color: '#7a8794' }}>対象</span><span>{targetLabel}　{rangeLabel}</span></div>
                <div style={row}><span style={{ color: '#7a8794' }}>整理した伝票</span><b>{total.toLocaleString('ja-JP')} 件</b></div>
                <div style={{ ...row, borderBottom: 'none' }}><span style={{ color: '#7a8794' }}>資金科目が変わった伝票</span><b>{changed.toLocaleString('ja-JP')} 件</b></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={reset} style={btn()}>最初に戻る</button>
              <button type="button" className="submit-btn" onClick={() => (onNavigate ? onNavigate('月次試算') : toast.show('メニューの「試算表（月次試算）」で確認できます'))} style={btn(accent, true)}>試算表で確認 →</button>
            </div>
          </div>
        )}
      </div>
    </SettingsShell>
  );
}

/* ======================================================================
 * データのバックアップ／復元（ピックアップ）（マニュアル 4.4、図19）
 * ==================================================================== */
/** 保存先はこのパソコン／社内のフォルダだけ（クラウドストレージの連携は設けない） */
export interface BackupPrefs { /** 手動バックアップの保存先フォルダ */ path: string; /** 自動バックアップ（年度ごと）の保存先フォルダ */ autoPath: string }
const PREF_KEY = 'proto-backup-prefs-v1';
const DEFAULT_PREFS: BackupPrefs = { path: 'バックアップ用フォルダ（共有サーバー）／Chappy／バックアップ', autoPath: 'バックアップ用フォルダ（共有サーバー）／Chappy／自動バックアップ' };
/** バックアップの保存先（終了時にバックアップを尋ねる動作は廃止。手動はこの画面からすぐ実行、自動は年度ごと） */
export function getBackupPrefs(): BackupPrefs {
  try { const raw = localStorage.getItem(PREF_KEY); return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<BackupPrefs>) } : DEFAULT_PREFS; } catch { return DEFAULT_PREFS; }
}
const saveBackupPrefs = (p: BackupPrefs) => { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* ignore */ } };
const destLabel = (p: BackupPrefs) => p.path;
type BackupMethod = '区分・年度' | '法人全体';
const METHOD_LABEL: Record<BackupMethod, string> = { '区分・年度': '選択中の区分・年度のバックアップ', 法人全体: '法人全体（全年度・全区分）のバックアップ' };
interface BackupGen { id: string; at: string; target: string; method: BackupMethod; size: string; dest: string; by: string; kind: '手動' | '自動' }
const GEN_SEED: BackupGen[] = [
  { id: 'g5', at: '令和8年9月28日 18:02', target: '002 保育事業／令和8年度', method: '区分・年度', size: '4.2 MB', dest: 'フォルダ', by: '鈴木', kind: '手動' },
  { id: 'g4', at: '令和8年9月27日 23:00', target: '002 保育事業／令和8年度', method: '区分・年度', size: '4.2 MB', dest: 'フォルダ', by: '（自動）', kind: '自動' },
  { id: 'g3', at: '令和8年9月25日 17:48', target: '002 保育事業／令和8年度', method: '区分・年度', size: '4.1 MB', dest: 'フォルダ', by: '鈴木', kind: '手動' },
  { id: 'g2', at: '令和8年9月10日 10:05', target: '002 保育事業／令和8年度', method: '区分・年度', size: '3.9 MB', dest: 'フォルダ', by: '田中', kind: '手動' },
  { id: 'g1', at: '令和8年8月31日 18:30', target: '法人全体／全年度', method: '法人全体', size: '37.9 MB', dest: 'フォルダ', by: '田中', kind: '手動' },
  { id: 'g0', at: '令和8年4月1日 02:00', target: '002 保育事業／令和7年度', method: '区分・年度', size: '5.6 MB', dest: 'フォルダ', by: '（自動）', kind: '自動' },
];
const RESTORE_ITEMS: { key: string; label: string; note: string }[] = [
  { key: 'voucher', label: '伝票データ', note: '登録済みの伝票（仕訳）' },
  { key: 'account', label: '科目マスター', note: '勘定科目・資金科目・費目・使用科目' },
  { key: 'master', label: '業者・摘要マスター', note: '業者、摘要、摘要の自動補完候補' },
  { key: 'budget', label: '予算・残高', note: '予算額、繰越残高、前年実績' },
  { key: 'setting', label: '設定条件', note: '動作環境、印刷設定、決算チェック設定' },
];
const DANGER = '#c0392b';

export function BackupPage({ variant, accent }: MaintenancePageProps) {
  const s = useSession();
  const toast = useToast();
  const prog = useProgress();
  const restoreProg = useProgress();
  const [prefs, setPrefsState] = useState<BackupPrefs>(getBackupPrefs);
  const [method, setMethod] = useState<BackupMethod>('区分・年度');
  const [gens, setGens] = useState<BackupGen[]>(GEN_SEED);
  /** 保存先フォルダの変更（manual＝手動、auto＝自動バックアップ） */
  const [pathEdit, setPathEdit] = useState<{ kind: 'manual' | 'auto'; value: string } | null>(null);
  const [restore, setRestore] = useState<null | { step: number; genId: string; items: Record<string, boolean>; autoBackup: boolean; agree: boolean; done: boolean }>(null);
  const [itemHelp, setItemHelp] = useState(false);
  const setPrefs = (p: Partial<BackupPrefs>) => setPrefsState((x) => { const n = { ...x, ...p }; saveBackupPrefs(n); return n; });
  const here = `${s.division}／${s.fiscalYear}`;
  const newGen = (m: BackupMethod, kind: BackupGen['kind']): BackupGen => ({ id: 'g' + Date.now(), at: warekiNow(), target: m === '区分・年度' ? here : '法人全体／全年度', method: m, size: m === '区分・年度' ? '4.2 MB' : '38.7 MB', dest: kind === '自動' ? '自動バックアップ用フォルダ' : 'フォルダ', by: '鈴木', kind });
  const runBackup = () => prog.start(method === '区分・年度' ? 2200 : 4200, () => { setGens((g) => [newGen(method, '手動'), ...g]); toast.show('バックアップが完了しました'); });
  // 今すぐバックアップ：範囲や保存先を選び直さず、選択中の区分・年度をいまの保存先へすぐに保存する
  const runQuick = () => prog.start(2200, () => { setGens((g) => [newGen('区分・年度', '手動'), ...g]); toast.show('バックアップが完了しました'); });
  const lastAuto = gens.find((g) => g.kind === '自動');
  const openRestore = (genId?: string) => setRestore({ step: genId ? 1 : 0, genId: genId ?? gens[0]?.id ?? '', items: Object.fromEntries(RESTORE_ITEMS.map((i) => [i.key, true])), autoBackup: true, agree: false, done: false });
  const rGen = restore ? gens.find((g) => g.id === restore.genId) : undefined;
  const rItems = restore ? RESTORE_ITEMS.filter((i) => restore.items[i.key]) : [];
  const runRestore = () => {
    if (!restore || !rGen) return;
    const auto = restore.autoBackup;
    setRestore({ ...restore, step: 3 });
    restoreProg.start(3600, () => {
      if (auto) setGens((g) => [{ ...newGen('区分・年度', '自動'), by: '（復元前の自動保存）' }, ...g]);
      setRestore((r) => (r ? { ...r, done: true } : r));
      toast.show('復元（ピックアップ）が完了しました');
    });
  };
  const th: CSSProperties = { padding: '9px 12px', background: '#f6f8fa', fontSize: 11, fontWeight: 700, color: '#8290a0', borderBottom: '1px solid #eef2f5', textAlign: 'left', whiteSpace: 'nowrap' };
  const td: CSSProperties = { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f1f4f6', verticalAlign: 'middle' };
  const kindChip = (k: BackupGen['kind']): CSSProperties => ({ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 8, background: k === '手動' ? '#e8f0fb' : '#f1f4f6', color: k === '手動' ? '#2c5f9e' : '#5b6773', whiteSpace: 'nowrap' });

  return (
    <SettingsShell variant={variant} title="データのバックアップ" badge="保守・運用" draft={false} desc="データのバックアップをすぐに実行できます。年度ごとの自動バックアップ、保存したバックアップの一覧、バックアップからの復元（ピックアップ）もここで確認・実行します。">
      <ToastView msg={toast.msg} />
      <div style={{ padding: 22, display: 'grid', gap: 18 }}>
        {/* 今すぐバックアップ：1回押すだけで実行 */}
        <div data-backup-now style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '16px 20px', border: '1.5px solid ' + accent, borderRadius: 12, background: accent + '0d', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700 }}>今すぐバックアップ</div>
            {prog.running
              ? <div style={{ display: 'grid', gap: 6, marginTop: 8 }} aria-live="polite"><div style={{ fontSize: 13, fontWeight: 600 }}>バックアップを作成しています…　{prog.p}%</div><ProgressBar value={prog.p ?? 0} accent={accent} /></div>
              : <div style={{ fontSize: 12.5, color: '#5b6773', marginTop: 4, lineHeight: 1.7 }}>{here} のデータを、いまの保存先（{destLabel(prefs)}）へ保存します。<br />最新のバックアップ：<b style={{ color: '#22303c' }}>{gens[0]?.at ?? 'なし'}</b>{gens[0] ? `（${gens[0].kind}）` : ''}</div>}
          </div>
          <button type="button" className="submit-btn" onClick={runQuick} disabled={prog.running} style={{ ...btn(accent, true), padding: '13px 28px', fontSize: 15, opacity: prog.running ? 0.5 : 1, cursor: prog.running ? 'not-allowed' : 'pointer' }}>今すぐバックアップ</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18, alignItems: 'start' }}>
          {/* 範囲・保存先を指定して実行 */}
          <div style={card}>
            <div style={cardHead}>範囲・保存先を指定してバックアップ</div>
            <div style={{ padding: 16, display: 'grid', gap: 14 }}>
              <div>
                <span style={lbl}>バックアップする範囲</span>
                <div style={{ display: 'grid', gap: 8 }}>
                  <label style={radioRow(method === '区分・年度', accent)}><input type="radio" name="bk-method" checked={method === '区分・年度'} onChange={() => setMethod('区分・年度')} disabled={prog.running} /><span><b>{METHOD_LABEL['区分・年度']}</b>（通常はこちら）<br /><span style={sub}>{here}</span>　<ScopeBadge scope="この区分のみ" /></span></label>
                  <label style={radioRow(method === '法人全体', accent)}><input type="radio" name="bk-method" checked={method === '法人全体'} onChange={() => setMethod('法人全体')} disabled={prog.running} /><span><b>{METHOD_LABEL['法人全体']}</b><br /><span style={sub}>すべての区分・すべての年度をまとめて保存します</span>　<ScopeBadge scope="全区分共通" /></span></label>
                </div>
              </div>
              <div>
                <span style={lbl}>保存先フォルダ　<ScopeBadge scope="全区分共通" /></span>
                <div data-backup-dest style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid #e2e8ee', borderRadius: 10, background: '#fbfcfd' }}>
                  <span style={{ flex: 1, minWidth: 0 }}><b>このパソコン／社内のフォルダ</b><br /><span style={{ ...sub, wordBreak: 'break-all' }}>{prefs.path}</span></span>
                  <button type="button" onClick={() => setPathEdit({ kind: 'manual', value: prefs.path })} disabled={prog.running} style={btn('#5b6773', false, true)}>フォルダを変更</button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" className="submit-btn" onClick={runBackup} disabled={prog.running} style={{ ...btn(accent, true), opacity: prog.running ? 0.5 : 1 }}>この内容でバックアップを実行</button></div>
            </div>
          </div>

          {/* 自動バックアップ（年度ごと） */}
          <div style={card} data-backup-auto>
            <div style={cardHead}>自動バックアップ（年度ごと） <ScopeBadge scope="全区分共通" /><span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 10, background: '#eaf5ef', color: '#1f7a52' }}>有効</span></div>
            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 12.5, color: '#5b6773', lineHeight: 1.8 }}>会計年度（単年度）ごとに、データを自動でバックアップします。操作は不要で、下の一覧に「自動」として保存されます。</div>
              <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', gap: 12, padding: '9px 12px', borderBottom: '1px solid #f1f4f6' }}><span style={{ width: 150, color: '#7a8794' }}>バックアップの単位</span><b>区分ごと・会計年度ごと</b></div>
                <div style={{ display: 'flex', gap: 12, padding: '9px 12px', borderBottom: '1px solid #f1f4f6' }}><span style={{ width: 150, color: '#7a8794' }}>前回の自動バックアップ</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{lastAuto ? `${lastAuto.at}（${lastAuto.target}）` : 'まだありません'}</span></div>
                <div data-backup-auto-dest style={{ display: 'flex', gap: 12, padding: '9px 12px', alignItems: 'center' }}><span style={{ width: 150, color: '#7a8794', flex: 'none' }}>保存先フォルダ</span><span style={{ wordBreak: 'break-all', flex: 1, minWidth: 0 }}>{prefs.autoPath}</span><button type="button" onClick={() => setPathEdit({ kind: 'auto', value: prefs.autoPath })} style={btn('#5b6773', false, true)}>フォルダを変更</button></div>
              </div>
              <Notice>システムを終了するときに、バックアップの確認は表示しません。手動で保存したいときは、上の「今すぐバックアップ」を押してください。</Notice>
            </div>
          </div>
        </div>

        {/* 世代一覧 */}
        <div style={card}>
          <div style={cardHead}>保存したバックアップ<span style={{ fontSize: 11.5, fontWeight: 500, color: '#8290a0' }}>{gens.length} 件（新しい順）</span></div>
          <div style={{ overflow: 'auto', maxHeight: 320 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>作成日時</th><th style={th}>種類</th><th style={th}>範囲</th><th style={th}>保存先</th><th style={{ ...th, textAlign: 'right' }}>サイズ</th><th style={th}>実行者</th></tr></thead>
              <tbody>{gens.map((g, i) => (
                <tr key={g.id}>
                  <td style={{ ...td, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{g.at}{i === 0 && <span style={{ fontSize: 10.5, fontWeight: 800, color: accent, marginLeft: 8 }}>最新</span>}</td>
                  <td style={td}><span style={kindChip(g.kind)}>{g.kind}</span></td>
                  <td style={td}>{g.target}</td>
                  <td style={td}>{g.dest}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{g.size}</td>
                  <td style={td}>{g.by}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>

        {/* 復元（ピックアップ）：取り消せない操作なので、ほかの操作と分けて置く */}
        <div style={{ marginTop: 18, paddingTop: 22, borderTop: '2px dashed #e6c9c3' }}>
          <div style={{ border: '1px solid #efc2b9', borderRadius: 12, background: '#fff8f6', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f3d5ce', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 9px', borderRadius: 10, background: DANGER, color: '#fff' }}>取り消せない操作</span>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: '#8a2a1e' }}>バックアップからの復元（ピックアップ）</span>
            </div>
            <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 280, fontSize: 13, lineHeight: 1.8, color: '#5b3a34' }}>保存したバックアップを読み込み、現在のデータに上書きします。<b>一度実行すると元には戻せません。</b>復元するバックアップと項目を選び、内容を確認してから実行します。</div>
              <button type="button" onClick={() => openRestore()} disabled={!gens.length} style={{ ...btn(DANGER), borderColor: DANGER, padding: '10px 18px' }}>復元の手順を始める…</button>
            </div>
          </div>
        </div>
      </div>

      {/* 保存先フォルダの変更（手動／自動） */}
      <Modal open={pathEdit != null} onClose={() => setPathEdit(null)} width={560} title={pathEdit?.kind === 'auto' ? '自動バックアップの保存先フォルダ' : 'バックアップの保存先フォルダ'}>
        {pathEdit != null && (() => {
          const apply = () => {
            const v = pathEdit.value.trim();
            if (!v) return;
            setPrefs(pathEdit.kind === 'auto' ? { autoPath: v } : { path: v });
            setPathEdit(null);
            toast.show(pathEdit.kind === 'auto' ? '自動バックアップの保存先フォルダを変更しました' : '保存先フォルダを変更しました');
          };
          return (
            <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
              <Field label="保存先フォルダ（このパソコン／外部ディスク／社内の共有フォルダ）"><input className="field-input ring" value={pathEdit.value} onChange={(e) => setPathEdit({ ...pathEdit, value: e.target.value })} onKeyDown={onEnter(apply)} autoFocus style={input} /></Field>
              <Notice>{pathEdit.kind === 'auto' ? '年度ごとの自動バックアップは、このフォルダに「自動」として保存されます。' : '手動のバックアップは、このフォルダに保存されます。'}このパソコン以外の場所（外部ディスクや社内の共有フォルダ）をおすすめします。本番ではフォルダの選択画面から指定します。</Notice>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setPathEdit(null)} style={btn()}>キャンセル</button>
                <button type="button" className="submit-btn" disabled={!pathEdit.value.trim()} onClick={apply} style={{ ...btn(accent, true), opacity: pathEdit.value.trim() ? 1 : 0.5 }}>変更する</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* 復元の確認フロー */}
      <Modal open={!!restore} onClose={() => setRestore(null)} width={760} strict closable={!restoreProg.running} title="バックアップからの復元（ピックアップ）">
        {restore && (
          <div>
            <Steps steps={['バックアップの選択', '復元する項目', '最終確認', '復元の実行']} current={restore.step} accent={DANGER} />
            <div style={{ padding: '16px 22px 20px', display: 'grid', gap: 14 }}>
              {restore.step === 0 && (
                <>
                  <div style={{ fontSize: 13, color: '#5b6773' }}>復元するバックアップを 1 つ選んでください。</div>
                  <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: 300, overflow: 'auto' }}>
                    {gens.map((g) => (
                      <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #f1f4f6', cursor: 'pointer', background: restore.genId === g.id ? '#fff4f1' : '#fff', fontSize: 13 }}>
                        <input type="radio" name="rs-gen" checked={restore.genId === g.id} onChange={() => setRestore({ ...restore, genId: g.id })} />
                        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', width: 170 }}>{g.at}</span>
                        <span style={kindChip(g.kind)}>{g.kind}</span>
                        <span style={{ flex: 1 }}>{g.target}</span>
                        <span style={sub}>{g.size}・{g.dest}</span>
                      </label>
                    ))}
                  </div>
                  <div style={sub}>ほかの場所に保存したバックアップは、「バックアップの実行」の保存先フォルダを変更すると一覧に表示されます。</div>
                </>
              )}
              {restore.step === 1 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 13, color: '#5b6773' }}>復元する項目にチェックを入れてください。チェックを外した項目は、現在のデータのまま残ります。</span><button type="button" onClick={() => setItemHelp(true)} style={{ ...btn('#5b6773', false, true), marginLeft: 'auto' }}>説明</button></div>
                  <div style={{ border: '1px solid #e2e8ee', borderRadius: 10 }}>
                    {RESTORE_ITEMS.map((it) => (
                      <label key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #f1f4f6', cursor: 'pointer', fontSize: 13.5 }}>
                        <input type="checkbox" checked={!!restore.items[it.key]} onChange={(e) => setRestore({ ...restore, items: { ...restore.items, [it.key]: e.target.checked } })} style={{ width: 17, height: 17 }} />
                        <b style={{ width: 170 }}>{it.label}</b><span style={sub}>{it.note}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
              {restore.step === 2 && rGen && (
                <>
                  <div style={{ padding: '12px 14px', border: '1px solid #efc2b9', background: '#fff4f1', borderRadius: 10, fontSize: 13.5, lineHeight: 1.8, color: '#8a2a1e' }}><b>現在のデータに上書きします。一度実行すると元には戻せません。</b><br />バックアップを作成した日時より後に登録・変更した内容は失われます。</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', alignItems: 'stretch', gap: 8 }}>
                    <div style={{ ...card, padding: 12 }}><span style={lbl}>読み込むバックアップ</span><div style={{ fontSize: 14, fontWeight: 700 }}>{rGen.at}</div><div style={sub}>{rGen.target}・{rGen.size}</div></div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: DANGER }}>→</div>
                    <div style={{ ...card, padding: 12, borderColor: '#efc2b9' }}><span style={lbl}>上書きされるデータ</span><div style={{ fontSize: 14, fontWeight: 700 }}>{rGen.method === '法人全体' ? '法人全体（全年度・全区分）' : here}</div><div style={sub}>{rItems.map((i) => i.label).join('、')}</div></div>
                  </div>
                  <Toggle on={restore.autoBackup} onChange={(v) => setRestore({ ...restore, autoBackup: v })} accent={accent} label="復元の前に、現在のデータを自動でバックアップする（おすすめ）" />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}><input type="checkbox" checked={restore.agree} onChange={(e) => setRestore({ ...restore, agree: e.target.checked })} style={{ width: 17, height: 17 }} />現在のデータが上書きされ、元に戻せないことを確認しました</label>
                </>
              )}
              {restore.step === 3 && (
                restore.done ? (
                  <>
                    <Notice tone="ok"><b>復元が完了しました。</b>　{rGen?.at} のバックアップから、{rItems.map((i) => i.label).join('、')} を読み込みました。</Notice>
                    {restore.autoBackup && <div style={sub}>復元前のデータは「保存したバックアップ」の一覧に自動で保存しました。</div>}
                  </>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }} aria-live="polite">
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{restore.autoBackup && (restoreProg.p ?? 0) < 30 ? '現在のデータをバックアップしています…' : 'バックアップを読み込んでいます…'}　{restoreProg.p ?? 100}%</div>
                    <ProgressBar value={restoreProg.p ?? 100} accent={DANGER} height={14} />
                    <div style={sub}>処理中は中断できません。この画面を閉じずにお待ちください。</div>
                  </div>
                )
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {restore.step < 3 && <button type="button" onClick={() => setRestore(null)} style={btn()}>キャンセル</button>}
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  {restore.step > 0 && restore.step < 3 && <button type="button" onClick={() => setRestore({ ...restore, step: restore.step - 1, agree: false })} style={btn()}>← 戻る</button>}
                  {restore.step === 0 && <button type="button" className="submit-btn" disabled={!rGen} onClick={() => setRestore({ ...restore, step: 1 })} style={{ ...btn(accent, true), opacity: rGen ? 1 : 0.5 }}>次へ</button>}
                  {restore.step === 1 && <button type="button" className="submit-btn" disabled={!rItems.length} onClick={() => setRestore({ ...restore, step: 2 })} style={{ ...btn(accent, true), opacity: rItems.length ? 1 : 0.5 }}>次へ</button>}
                  {restore.step === 2 && <button type="button" disabled={!restore.agree} onClick={runRestore} style={{ ...btn(DANGER, true), opacity: restore.agree ? 1 : 0.45, cursor: restore.agree ? 'pointer' : 'not-allowed' }}>復元を実行する</button>}
                  {restore.step === 3 && restore.done && <button type="button" className="submit-btn" onClick={() => setRestore(null)} style={btn(accent, true)}>閉じる</button>}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
      <ExplainModal open={itemHelp} onClose={() => setItemHelp(false)} accent={accent} title="復元する項目の説明" source="マニュアル 4.4.2 ピックアップ機能" sections={RESTORE_ITEMS.map((i) => ({ h: i.label, body: <>{i.note}を、バックアップを作成した時点の内容に戻します。チェックを外すと、現在の内容のまま残ります。</> }))} />
    </SettingsShell>
  );
}
