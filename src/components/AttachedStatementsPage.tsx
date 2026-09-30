// 決算附属明細書設定（依頼書 5.5.4、マニュアル 7.8）
//   現行の 3 画面（設定／設定2／設定3）を 1 画面に統合し、タブで切り替える。
//   設定2・3 の「収入に合わせる／支出に合わせる」の切替は、動作環境ではなくこの画面内で行う（全区分共通の設定）。
//   明細入力・財産目録の行設定・注記の編集・合算テーブルは、印刷の準備として「別紙」画面（AppendixPrintPage）へ移した（5.5.3）。

import { useState } from 'react';
import { Modal } from './Modal';
import { ScopeBadge } from './PrintCenter';
import { TD, TH } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { Notice, SettingsShell, Tabs, Toggle, btn, input, lbl } from './ui';
import { ACCOUNT_META, accountMatches } from '../lib/accounts';
import { displayName } from '../data';
import { setSession, useSession } from '../store/session';

/** 附属明細書で使う科目の候補（伝票の勘定科目 ＋ 明細書向けの貸借・純資産科目） */
const EXTRA_ACCTS = ['国庫補助金等特別積立金', '国庫補助金等特別積立金取崩額', '国庫補助金等特別積立金積立額', '基本金', '基本金組入額', '基本金取崩額', '賞与引当金', '退職給付引当金', '徴収不能引当金', '寄附金収益', '施設整備等寄附金収益', '市区町村補助金収益', '都道府県補助金収益', 'その他の補助金収益', '拠点区分間繰入金収益', '拠点区分間繰入金費用', 'サービス区分間繰入金収益', 'サービス区分間繰入金費用', '施設整備等積立金', '施設整備等積立資産', '人件費積立金', '人件費積立資産', '拠点区分間貸付金', '拠点区分間借入金', 'サービス区分間貸付金', 'サービス区分間借入金', '設備資金借入金', '長期運営資金借入金', '役員等長期借入金', '役員等短期借入金', '1年以内返済予定設備資金借入金', '1年以内返済予定長期運営資金借入金'];
const ALL_ACCTS = [...EXTRA_ACCTS, ...ACCOUNT_META.map((m) => m.name)];
const KOKKO_TITLES_DEFAULT = ['国庫補助金', '都道府県補助金', '市町村補助金', 'その他の補助金'];

const TABS = ['設定1　借入金・補助金・基本金・引当金・寄附金', '設定2　繰入金・積立金', '設定3　区分間の貸付金・借入金'];
const TAB_DESC = [
  '借入金明細書・国庫補助金等特別積立金明細書・基本金明細書・引当金明細書・寄附金収益明細書・補助金事業等収益明細書で使う科目を設定します。',
  '事業区分間及び拠点区分間繰入金明細書・サービス区分間繰入金明細書と、積立金・積立資産明細書で使う科目を設定します。',
  '事業区分間及び拠点区分間貸付金（借入金）残高明細書・サービス区分間貸付金（借入金）残高明細書で使う科目を設定します。',
];
type Side = '収入' | '支出';
interface WatchDef { key: string; tab: number; label: string; accts: string[]; /** 支出に合わせた場合の科目（設定2・3） */ acctsOut?: string[]; watch?: boolean; extra?: string }
const WATCH: WatchDef[] = [
  { key: 'kariire', tab: 0, label: '借入金明細書（中区分項目）', accts: ['設備資金借入金', '長期運営資金借入金', '役員等長期借入金', '役員等短期借入金'], extra: '1年基準科目設定' },
  { key: 'kokko', tab: 0, label: '国庫補助金等特別積立金明細書', accts: ['国庫補助金等特別積立金', '国庫補助金等特別積立金取崩額'], watch: true, extra: '合計タイトル（積立合計行）' },
  { key: 'kihon', tab: 0, label: '基本金明細書', accts: ['基本金', '基本金組入額', '基本金取崩額'], watch: true },
  { key: 'hikiate', tab: 0, label: '引当金明細書', accts: ['賞与引当金', '退職給付引当金', '徴収不能引当金'] },
  { key: 'kifu', tab: 0, label: '寄附金収益明細書', accts: ['寄附金収益', '施設整備等寄附金収益'], watch: true },
  { key: 'hojo', tab: 0, label: '補助金事業等収益明細書', accts: ['市区町村補助金収益', '都道府県補助金収益', 'その他の補助金収益'], watch: true },
  { key: 'kurii', tab: 1, label: '繰入金明細書（事業区分間及び拠点区分間／サービス区分間）', accts: ['拠点区分間繰入金収益', 'サービス区分間繰入金収益'], acctsOut: ['拠点区分間繰入金費用', 'サービス区分間繰入金費用'], watch: true },
  { key: 'tsumitate', tab: 1, label: '積立金・積立資産明細書', accts: ['施設整備等積立金', '施設整備等積立資産', '人件費積立金', '人件費積立資産'] },
  { key: 'kashitsuke', tab: 2, label: '貸付金（借入金）残高明細書（事業区分間及び拠点区分間／サービス区分間）', accts: ['拠点区分間貸付金', 'サービス区分間貸付金'], acctsOut: ['拠点区分間借入金', 'サービス区分間借入金'] },
];
/** 科目リストの保持キー（収入／支出で科目が変わる明細書は、合わせ方ごとに別々に保持する） */
const acctKey = (w: WatchDef, side: Side) => (w.acctsOut ? `${w.key}:${side}` : w.key);
const MOVED = ['明細入力', '財産目録の行設定', '注記の編集', '合算テーブル'];

export function AttachedStatementsPage({ variant, accent, onNavigate }: { variant: 'form' | 'sheet'; accent: string; /** メニュー項目名で別画面へ移動（「別紙」画面へのリンクに使用） */ onNavigate?: (label: string) => void }) {
  const s = useSession();
  const toast = useToast();
  const [tab, setTab] = useState(TABS[0]);
  const ti = TABS.indexOf(tab);
  const side: Side = s.env.transferWatch === '支払いで監視' ? '支出' : '収入';
  const setSide = (v: Side) => { setSession({ env: { ...s.env, transferWatch: v === '支出' ? '支払いで監視' : '収入で監視' } }); toast.show(`設定2・設定3 を「${v}に合わせる」に切り替えました（全区分共通）`); };
  const [watch, setWatch] = useState<Record<string, boolean>>(Object.fromEntries(WATCH.filter((w) => w.watch !== undefined).map((w) => [w.key, !!w.watch])));
  const [accts, setAccts] = useState<Record<string, string[]>>(() => Object.fromEntries(WATCH.flatMap((w) => (w.acctsOut ? [[`${w.key}:収入`, [...w.accts]], [`${w.key}:支出`, [...w.acctsOut]]] : [[w.key, [...w.accts]]]))));
  const [pickFor, setPickFor] = useState<WatchDef | null>(null);
  const [pickQ, setPickQ] = useState('');
  const [pickSel, setPickSel] = useState<Set<string>>(new Set());
  const [fromAcct, setFromAcct] = useState(true);
  const [hojoReplace, setHojoReplace] = useState('');
  const [extraFor, setExtraFor] = useState<string | null>(null);
  const [kokkoTitles, setKokkoTitles] = useState<string[]>(KOKKO_TITLES_DEFAULT);
  const [kokkoDraft, setKokkoDraft] = useState<string[]>(KOKKO_TITLES_DEFAULT);
  const [oneYear, setOneYear] = useState({ apply: true, long: '役員等長期借入金', short: '役員等短期借入金', setsubi: '1年以内返済予定設備資金借入金', unei: '1年以内返済予定長期運営資金借入金' });
  const [oneYearDraft, setOneYearDraft] = useState(oneYear);

  const listOf = (w: WatchDef) => accts[acctKey(w, side)] ?? [];
  const openPick = (w: WatchDef) => { setPickFor(w); setPickQ(''); setPickSel(new Set()); };
  const applyPick = () => { if (!pickFor) return; const k = acctKey(pickFor, side); const add = [...pickSel]; setAccts((a) => ({ ...a, [k]: [...(a[k] ?? []), ...add.filter((x) => !(a[k] ?? []).includes(x))] })); toast.show(add.length ? `${add.length} 科目を追加しました` : '科目は追加されませんでした'); setPickFor(null); };
  const pickList = pickFor ? ALL_ACCTS.filter((n) => !listOf(pickFor).includes(n) && accountMatches(n, pickQ)) : [];
  const openExtra = (key: string) => { setExtraFor(key); setKokkoDraft([...kokkoTitles]); setOneYearDraft(oneYear); };
  const applyExtra = () => { if (extraFor === 'kokko') { const t = kokkoDraft.map((x) => x.trim()).filter(Boolean); setKokkoTitles(t.length ? t : KOKKO_TITLES_DEFAULT); toast.show('積立合計行タイトルを保存しました'); } if (extraFor === 'kariire') { setOneYear(oneYearDraft); toast.show('1年基準科目設定を保存しました'); } setExtraFor(null); };
  const resetTab = () => { setAccts((a) => ({ ...a, ...Object.fromEntries(WATCH.filter((w) => w.tab === ti).map((w) => [acctKey(w, side), [...(side === '支出' && w.acctsOut ? w.acctsOut : w.accts)]])) })); toast.show(`${tab.split('　')[0]} の科目を既定の内容に戻しました`); };
  const goAppendix = () => { if (onNavigate) onNavigate('別紙（注記・明細書・財産目録）'); else toast.show('「帳票・印刷 ＞ 別紙（注記・明細書・財産目録）」を開いてください'); };

  return (
    <SettingsShell variant={variant} title={displayName('決算附属明細書')} badge="決算" desc="決算附属明細書に集計する科目と、伝票入力時の監視を設定します。これまで 3 つに分かれていた画面（設定／設定2／設定3）を、1 つの画面にまとめました。" actions={<button type="button" className="submit-btn" onClick={() => toast.show('決算附属明細書設定を保存しました（プロトタイプ）')} style={btn(accent, true)}>保存</button>}>
      <ToastView msg={toast.msg} />
      <Tabs items={TABS} current={tab} onChange={setTab} accent={accent} />

      <div style={{ padding: 22, display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 12.5, color: '#48565f', lineHeight: 1.8 }}>{TAB_DESC[ti]}</div>

        {/* 設定2・3：収入に合わせる／支出に合わせる（これまで動作環境にあった切替） */}
        {ti >= 1 && (
          <div style={{ border: '1px solid #bfdcd9', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#e4f1f0', flexWrap: 'wrap' }}>
              <ScopeBadge kind="全区分共通" />
              <b style={{ fontSize: 13 }}>科目の合わせ方（設定2・設定3 共通）</b>
              <div role="radiogroup" aria-label="科目の合わせ方" style={{ display: 'inline-flex', border: '1px solid #1f6f6b', borderRadius: 9, overflow: 'hidden', marginLeft: 'auto' }}>
                {(['収入', '支出'] as const).map((v) => <button key={v} type="button" role="radio" aria-checked={side === v} onClick={() => side !== v && setSide(v)} style={{ padding: '8px 18px', border: 'none', background: side === v ? '#1f6f6b' : '#fff', color: side === v ? '#fff' : '#1f6f6b', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{v}に合わせる</button>)}
              </div>
            </div>
            <div style={{ padding: '10px 14px', fontSize: 12, color: '#48565f', lineHeight: 1.8 }}>
              繰入金・貸付金（借入金）の明細書で、監視・集計する科目を<b>{side === '収入' ? '収入側（繰入金収益・貸付金）' : '支出側（繰入金費用・借入金）'}</b>に合わせています。切り替えると、下の「使用する科目」が{side === '収入' ? '支出' : '収入'}側の科目に変わります（科目の設定は、合わせ方ごとに別々に保存されます）。
              <span style={{ color: '#8290a0' }}>　※ これまで「{displayName('環境設定')}」にあった切替です。すべての区分に共通で反映されます。</span>
            </div>
          </div>
        )}

        {ti === 0 && <Notice>「伝票入力時に監視する」を有効にすると、該当する科目の伝票を登録したときに「明細表へ追加しますか？」の確認が出て、その場で明細データを登録できます（連続定型仕訳で登録した伝票は対象外）。</Notice>}

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={{ ...TH, width: '26%' }}>明細書</th><th style={TH}>使用する科目{ti >= 1 && <span style={{ fontWeight: 500 }}>（{side}に合わせた科目）</span>}</th><th style={{ ...TH, width: 170 }}>伝票入力時に監視する</th><th style={{ ...TH, width: 250 }}>追加設定</th></tr></thead>
          <tbody>{WATCH.filter((w) => w.tab === ti).map((w) => (
            <tr key={w.key}>
              <td style={{ ...TD, fontWeight: 600, lineHeight: 1.6 }}>{w.label}</td>
              <td style={TD}><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>{listOf(w).map((a) => <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 4px 2px 8px', background: '#eef2f6', borderRadius: 6, fontSize: 11.5 }}>{a}<button type="button" title={`${a} を外す`} onClick={() => setAccts((x) => ({ ...x, [acctKey(w, side)]: (x[acctKey(w, side)] ?? []).filter((n) => n !== a) }))} style={{ border: 'none', background: 'transparent', color: '#9aa5b1', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: '0 2px', fontFamily: 'inherit' }}>×</button></span>)}<button type="button" onClick={() => openPick(w)} title="科目を追加" style={{ ...btn('#5b6773', false, true), padding: '1px 8px' }}>＋ 科目</button></div></td>
              <td style={TD}>{w.watch !== undefined ? <Toggle on={!!watch[w.key]} onChange={(v) => setWatch({ ...watch, [w.key]: v })} accent={accent} label={watch[w.key] ? '監視する' : '監視しない'} /> : <span style={{ fontSize: 12, color: '#9aa5b1' }}>—（監視の対象外）</span>}</td>
              <td style={{ ...TD, fontSize: 12 }}>{w.key === 'hojo' ? <div style={{ display: 'grid', gap: 6 }}><label style={{ display: 'flex', gap: 5 }}><input type="checkbox" checked={fromAcct} onChange={(e) => setFromAcct(e.target.checked)} />科目から明細を作成する</label><label style={{ display: 'flex', gap: 5, alignItems: 'center', whiteSpace: 'nowrap' }}>「○○事業」を<input className="field-input" value={hojoReplace} onChange={(e) => setHojoReplace(e.target.value)} placeholder="例：保育事業" style={{ ...input, padding: '3px 8px', fontSize: 12, width: 120 }} />に置き換える</label></div> : w.extra ? <div style={{ display: 'grid', gap: 4 }}><button type="button" onClick={() => openExtra(w.key)} style={btn('#5b6773', false, true)}>{w.extra}</button><span style={{ fontSize: 11, color: '#9aa5b1' }}>{w.key === 'kokko' ? kokkoTitles.join('／') : oneYear.apply ? `1年基準を適用（${oneYear.long}／${oneYear.short}）` : '1年基準を適用しない'}</span></div> : <span style={{ color: '#9aa5b1' }}>—</span>}</td>
            </tr>
          ))}</tbody>
        </table>
        <div><button type="button" onClick={resetTab} style={btn('#5b6773', false, true)}>このタブの科目を既定の内容に戻す</button></div>
      </div>

      <div style={{ borderTop: '1px solid #eef2f5', padding: '12px 22px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12, color: '#5b6773' }}>
        <span style={{ fontWeight: 700, color: '#8290a0' }}>移動した機能</span>
        {MOVED.map((m) => <span key={m} style={{ padding: '2px 8px', borderRadius: 8, background: '#f3f6f9', border: '1px solid #dde4ea' }}>{m}</span>)}
        <span>は、印刷の準備として「帳票・印刷 ＞ 別紙」にまとめました。</span>
        <button type="button" onClick={goAppendix} style={btn('#5b6773', false, true)}>別紙を開く</button>
      </div>

      {/* 科目の追加（科目検索） */}
      <Modal open={!!pickFor} onClose={() => setPickFor(null)} width={560} title={`科目の追加 ― ${pickFor?.label ?? ''}`}>
        {pickFor && (
          <div style={{ padding: '12px 22px 18px', display: 'grid', gap: 10 }}>
            <input className="search-input" autoFocus value={pickQ} onChange={(e) => setPickQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && pickList.length === 1) { const n = new Set(pickSel); n.add(pickList[0]); setPickSel(n); setPickQ(''); } }} placeholder="科目名・コード・フリガナで検索（Enter で候補が1件なら選択）" style={input} />
            <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: 320, overflow: 'auto' }}>
              {pickList.map((n) => { const m = ACCOUNT_META.find((x) => x.name === n); const on = pickSel.has(n); return (
                <label key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderBottom: '1px solid #f1f4f6', fontSize: 13, background: on ? '#eef2f6' : '#fff', cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} onChange={(e) => { const s2 = new Set(pickSel); if (e.target.checked) s2.add(n); else s2.delete(n); setPickSel(s2); }} />
                  <span style={{ width: 52, color: '#8290a0', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{m?.code ?? '—'}</span><span style={{ flex: 1 }}>{n}</span><span style={{ fontSize: 11, color: '#9aa5b1' }}>{m ? `${m.kind}・${m.cls}` : '明細書用'}</span>
                </label>); })}
              {pickList.length === 0 && <div style={{ padding: 18, textAlign: 'center', color: '#9aa5b1', fontSize: 12.5 }}>該当する科目がありません</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 12, color: '#7a8794' }}>{pickSel.size} 科目を選択中</span><span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}><button type="button" onClick={() => setPickFor(null)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={applyPick} disabled={!pickSel.size} style={{ ...btn(accent, true), opacity: pickSel.size ? 1 : 0.5 }}>追加</button></span></div>
          </div>
        )}
      </Modal>

      {/* 追加設定：国庫補助金明細書 積立合計行タイトル入力 */}
      <Modal open={extraFor === 'kokko'} onClose={() => setExtraFor(null)} width={480} title="国庫補助金明細書 積立合計行タイトル入力">
        <div style={{ padding: '12px 22px 18px', display: 'grid', gap: 10 }}>
          <Notice>明細書に出力する国庫補助金等のグループ名（積立合計行のタイトル）を設定します。グループごとに積立額・取崩額の合計行が印刷されます。</Notice>
          {kokkoDraft.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ width: 24, fontSize: 12, color: '#8290a0' }}>{i + 1}</span><input className="field-input" value={t} onChange={(e) => setKokkoDraft(kokkoDraft.map((x, k) => (k === i ? e.target.value : x)))} placeholder="例：国庫補助金" style={input} /><button type="button" title="この行を削除" onClick={() => setKokkoDraft(kokkoDraft.filter((_, k) => k !== i))} style={btn('#c0392b', false, true)}>×</button></div>
          ))}
          <div><button type="button" onClick={() => setKokkoDraft([...kokkoDraft, ''])} style={btn(accent, false, true)}>＋ 行を追加</button></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setExtraFor(null)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={applyExtra} style={btn(accent, true)}>OK</button></div>
        </div>
      </Modal>

      {/* 追加設定：1年基準科目設定 */}
      <Modal open={extraFor === 'kariire'} onClose={() => setExtraFor(null)} width={560} title="１年基準科目設定（借入金明細書）">
        <div style={{ padding: '12px 22px 18px', display: 'grid', gap: 12 }}>
          <Notice>1年基準（ワン・イヤー・ルール）で長期借入金のうち1年以内に返済予定の額を流動負債へ振り替える際の科目対応を設定します。「役員等長期借入金」「役員等短期借入金」の2項目を設定しなくても他の条件を設定できます。</Notice>
          <Toggle on={oneYearDraft.apply} onChange={(v) => setOneYearDraft({ ...oneYearDraft, apply: v })} accent={accent} label="借入金明細書で1年基準を適用する（1年以内返済予定額を別掲する）" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, opacity: oneYearDraft.apply ? 1 : 0.5 }}>
            {([['設備資金借入金 → 1年以内返済予定', 'setsubi'], ['長期運営資金借入金 → 1年以内返済予定', 'unei'], ['役員等長期借入金（任意）', 'long'], ['役員等短期借入金（任意）', 'short']] as [string, keyof typeof oneYearDraft][]).map(([label, k]) => (
              <div key={k}><span style={lbl}>{label}</span><select value={String(oneYearDraft[k])} disabled={!oneYearDraft.apply} onChange={(e) => setOneYearDraft({ ...oneYearDraft, [k]: e.target.value })} style={input}><option value="">（設定しない）</option>{EXTRA_ACCTS.filter((n) => /借入金/.test(n)).map((n) => <option key={n}>{n}</option>)}</select></div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setExtraFor(null)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={applyExtra} style={btn(accent, true)}>OK</button></div>
        </div>
      </Modal>
    </SettingsShell>
  );
}
