// 決算附属明細書（提案L）：設定1〜3（科目設定・伝票入力時の監視）、明細書ごとの明細入力、財産目録の行設定、注記編集、合算テーブル作成。
//   マニュアル 7.5.2・7.5.3・7.8・4.7 に相当。

import { useRef, useState } from 'react';
import { runExport } from './ExportDialog';
import { Modal } from './Modal';
import { NUM, TD, TH } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { Field, Notice, SettingsShell, Tabs, Toggle, btn, card, cardHead, input, lbl, numInput, toInt, yen } from './ui';
import { ACCOUNT_META, accountMatches } from '../lib/accounts';
import { SERVICES } from '../data';

/** 附属明細書で使う科目の候補（伝票の勘定科目 ＋ 明細書向けの貸借・純資産科目） */
const EXTRA_ACCTS = ['国庫補助金等特別積立金', '国庫補助金等特別積立金取崩額', '国庫補助金等特別積立金積立額', '基本金', '基本金組入額', '基本金取崩額', '賞与引当金', '退職給付引当金', '徴収不能引当金', '寄附金収益', '施設整備等寄附金収益', '市区町村補助金収益', '都道府県補助金収益', 'その他の補助金収益', '拠点区分間繰入金収益', '拠点区分間繰入金費用', 'サービス区分間繰入金収益', 'サービス区分間繰入金費用', '施設整備等積立金', '施設整備等積立資産', '人件費積立金', '人件費積立資産', '拠点区分間貸付金', '拠点区分間借入金', 'サービス区分間貸付金', 'サービス区分間借入金', '設備資金借入金', '長期運営資金借入金', '役員等長期借入金', '役員等短期借入金', '1年以内返済予定設備資金借入金', '1年以内返済予定長期運営資金借入金'];
const ALL_ACCTS = [...EXTRA_ACCTS, ...ACCOUNT_META.map((m) => m.name)];
const KOKKO_TITLES_DEFAULT = ['国庫補助金', '都道府県補助金', '市町村補助金', 'その他の補助金'];

const downloadJson = (name: string, obj: unknown) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
};
const stamp = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };

const TABS = ['設定（科目・監視）', '明細入力', '財産目録の行設定', '注記編集', '合算テーブル'];

const WATCH = [
  { key: 'kokko', label: '国庫補助金等特別積立金明細書', accts: ['国庫補助金等特別積立金', '国庫補助金等特別積立金取崩額'], watch: true, extra: '合計タイトル（積立合計行）' },
  { key: 'kihon', label: '基本金明細書', accts: ['基本金', '基本金組入額', '基本金取崩額'], watch: true },
  { key: 'hikiate', label: '引当金明細書', accts: ['賞与引当金', '退職給付引当金'], watch: false },
  { key: 'kifu', label: '寄附金収益明細書', accts: ['寄附金収益', '施設整備等寄附金収益'], watch: true },
  { key: 'hojo', label: '補助金事業等収益明細書', accts: ['市区町村補助金収益', '都道府県補助金収益', 'その他の補助金収益'], watch: true, extra: '科目から明細を作成する／「○○事業」を置き換える' },
  { key: 'kurii', label: '事業区分間及び拠点区分間繰入金明細書・サービス区分間繰入金明細書（設定2）', accts: ['拠点区分間繰入金収益', '拠点区分間繰入金費用', 'サービス区分間繰入金収益'], watch: true },
  { key: 'tsumitate', label: '積立金・積立資産明細書（設定2）', accts: ['施設整備等積立金', '施設整備等積立資産', '人件費積立金'], watch: false },
  { key: 'kashitsuke', label: '事業区分間及び拠点区分間貸付金（借入金）残高明細書・サービス区分間貸付金（借入金）残高明細書（設定3）', accts: ['拠点区分間貸付金', '拠点区分間借入金', 'サービス区分間貸付金'], watch: false },
  { key: 'kariire', label: '借入金明細書用 中区分項目', accts: ['設備資金借入金', '長期運営資金借入金', '役員等長期借入金', '役員等短期借入金'], watch: false, extra: '1年基準科目設定' },
];

const DETAILS: Record<string, { cols: string[]; rows: string[][] }> = {
  引当金明細書: { cols: ['科目', '期首残高', '当期増加額', '当期減少額（目的使用）', '当期減少額（その他）', '期末残高'], rows: [['賞与引当金', '1500000', '1693000', '1500000', '0', '1693000'], ['退職給付引当金', '0', '0', '0', '0', '0']] },
  借入金明細書: { cols: ['借入先', '期首残高', '当期借入', '当期償還', '期末残高', '利率', '返済期限', '使途'], rows: [['○○銀行（設備資金）', '0', '0', '0', '0', '—', '—', '—']] },
  補助金事業等収益明細書: { cols: ['拠点名', '補助金の種類', '交付者', '目的', '当期収益額', '備考'], rows: [['チャイルド保育園', '市区町村補助金', '○○市', '延長保育事業', '660000', ''], ['チャイルド保育園', '市区町村補助金', '○○市', '障害児保育事業', '0', '']] },
  '区分間貸付金（借入金）残高明細書': { cols: ['貸付元区分', '貸付先区分', '前年残高', '当期増加', '当期減少', '期末残高', '使用目的'], rows: [['本部', '保育事業', '0', '0', '0', '0', '運転資金']] },
  基本金明細書: { cols: ['区分', '前期末残高', '当期組入額', '当期取崩額', '当期末残高'], rows: [['第1号基本金', '25800000', '0', '0', '25800000'], ['第2号基本金', '0', '0', '0', '0'], ['第3号基本金', '0', '0', '0', '0']] },
  積立金・積立資産明細書: { cols: ['積立金・積立資産の名称', '前期末残高', '当期増加', '当期減少', '当期末残高', '摘要'], rows: [['施設整備等積立金／積立資産', '0', '0', '0', '0', ''], ['人件費積立金／積立資産', '0', '0', '0', '0', '']] },
};

const INVENTORY_TABS = ['流動資産', '固定資産（基本財産）', '固定資産（その他の固定資産）', '流動負債', '固定負債'];
const INVENTORY_DEFAULT: Record<string, string[][]> = {
  流動資産: [['現金預金', '現金手許有高', '44,200'], ['現金預金', '普通預金 みどり銀行本店', '8,610,000'], ['現金預金', '当座預金 みどり銀行本店', '468,100'], ['事業未収金', '8月分委託費', '1,200,000']],
  '固定資産（基本財産）': [['土地', '○○市○○町1-1　320㎡', '22,000,000'], ['建物', '園舎 鉄筋コンクリート造2階建', '15,300,000']],
  '固定資産（その他の固定資産）': [['器具及び備品', '遊具・厨房設備ほか', '1,750,000'], ['ソフトウェア', '会計システム', '340,000']],
  流動負債: [['事業未払金', '8月分給食材料費ほか', '400,000'], ['職員預り金', '社会保険料・税', '250,000']],
  固定負債: [],
};

const NOTE_DEFAULT = `1. 継続事業の前提に関する注記
　該当なし。
2. 重要な会計方針
（1）有価証券の評価基準及び評価方法　満期保有目的の債券等：償却原価法（定額法）
（2）固定資産の減価償却の方法　建物・器具及び備品：定額法
（3）引当金の計上基準　賞与引当金：職員に対する賞与の支給に備えるため、支給見込額のうち当期に帰属する額を計上。
3. 重要な会計方針の変更
　該当なし。
4. 法人で採用する退職給付制度
　独立行政法人福祉医療機構の社会福祉施設職員等退職手当共済制度を採用している。
5. 法人が作成する財務諸表等と拠点区分、サービス区分
　当法人の作成する財務諸表等は以下のとおりになっている。
[表]
6. 基本財産の増減の内容及び金額
[表]`;

export function AttachedStatementsPage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  const toast = useToast();
  const [tab, setTab] = useState(TABS[0]);
  const [watch, setWatch] = useState<Record<string, boolean>>(Object.fromEntries(WATCH.map((w) => [w.key, w.watch])));
  const [accts, setAccts] = useState<Record<string, string[]>>(Object.fromEntries(WATCH.map((w) => [w.key, [...w.accts]])));
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [pickQ, setPickQ] = useState('');
  const [pickSel, setPickSel] = useState<Set<string>>(new Set());
  const [fromAcct, setFromAcct] = useState(true);
  const [hojoReplace, setHojoReplace] = useState('');
  const [extraFor, setExtraFor] = useState<string | null>(null);
  const [kokkoTitles, setKokkoTitles] = useState<string[]>(KOKKO_TITLES_DEFAULT);
  const [kokkoDraft, setKokkoDraft] = useState<string[]>(KOKKO_TITLES_DEFAULT);
  const [oneYear, setOneYear] = useState({ apply: true, long: '役員等長期借入金', short: '役員等短期借入金', setsubi: '1年以内返済予定設備資金借入金', unei: '1年以内返済予定長期運営資金借入金' });
  const [oneYearDraft, setOneYearDraft] = useState(oneYear);
  const [load, setLoad] = useState<'inv' | 'note' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLInputElement>(null);
  // 合算テーブルの印刷書式
  const [fmtOpen, setFmtOpen] = useState(false);
  const [fmt, setFmt] = useState({ orient: '縦', perPage: 6, font: 'Noto Sans JP 9pt', shade: true, corp: true, page: true });
  const [detail, setDetail] = useState(Object.keys(DETAILS)[0]);
  const [detailRows, setDetailRows] = useState<Record<string, string[][]>>(Object.fromEntries(Object.entries(DETAILS).map(([k, v]) => [k, v.rows.map((r) => [...r])])));
  const [invTab, setInvTab] = useState(INVENTORY_TABS[0]);
  const [inv, setInv] = useState<Record<string, string[][]>>(JSON.parse(JSON.stringify(INVENTORY_DEFAULT)));
  const [invSel, setInvSel] = useState<number | null>(null);
  const [note, setNote] = useState(NOTE_DEFAULT);
  const [noteKind, setNoteKind] = useState('財務諸表に対する注記（法人全体用）');
  const [tableOpen, setTableOpen] = useState(false);
  const [merge, setMerge] = useState<{ code: string; name: string; formula: string }[]>([{ code: '001', name: '本部', formula: '' }, { code: '002', name: '保育事業', formula: '' }, { code: '004', name: '一時預かり', formula: '' }, { code: '小計', name: '保育園計', formula: '2+3' }, { code: '003', name: '子育て支援', formula: '' }, { code: '合計', name: '社会福祉事業計', formula: '1+4+5' }]);
  const [perPage, setPerPage] = useState(6);
  const [remark, setRemark] = useState('');

  const rowsOf = detailRows[detail] ?? [];
  const setCell = (ri: number, ci: number, v: string) => setDetailRows((d) => ({ ...d, [detail]: d[detail].map((r, i) => (i === ri ? r.map((c, k) => (k === ci ? v : c)) : r)) }));
  const invRows = inv[invTab] ?? [];
  const openPick = (key: string) => { setPickFor(key); setPickQ(''); setPickSel(new Set()); };
  const applyPick = () => { if (!pickFor) return; const add = [...pickSel]; setAccts((a) => ({ ...a, [pickFor]: [...a[pickFor], ...add.filter((x) => !a[pickFor].includes(x))] })); toast.show(add.length ? `${add.length} 科目を追加しました` : '科目は追加されませんでした'); setPickFor(null); };
  const pickList = pickFor ? ALL_ACCTS.filter((n) => !accts[pickFor].includes(n) && accountMatches(n, pickQ)) : [];
  const openExtra = (key: string) => { setExtraFor(key); setKokkoDraft([...kokkoTitles]); setOneYearDraft(oneYear); };
  const applyExtra = () => { if (extraFor === 'kokko') { const t = kokkoDraft.map((x) => x.trim()).filter(Boolean); setKokkoTitles(t.length ? t : KOKKO_TITLES_DEFAULT); toast.show('積立合計行タイトルを保存しました'); } if (extraFor === 'kariire') { setOneYear(oneYearDraft); toast.show('1年基準科目設定を保存しました'); } setExtraFor(null); };
  /** 設定ファイル保存（財産目録の行設定／注記）：JSON をダウンロード */
  const saveFile = (kind: 'inv' | 'note') => {
    if (kind === 'inv') { downloadJson(`財産目録行設定_${stamp()}.json`, { type: 'chappy-inventory', savedAt: new Date().toISOString(), rows: inv }); toast.show('財産目録の行設定を保存しました'); }
    else { downloadJson(`注記_${stamp()}.json`, { type: 'chappy-note', savedAt: new Date().toISOString(), noteKind, note, remark }); toast.show('注記および表を保存しました'); }
  };
  const applyLoaded = (obj: unknown, label: string) => {
    const o = (obj ?? {}) as Record<string, unknown>;
    if (load === 'inv') {
      const rows = o.rows as Record<string, unknown> | undefined;
      if (!rows || typeof rows !== 'object') return toast.show('財産目録の行設定ファイルではありません');
      const next: Record<string, string[][]> = {};
      INVENTORY_TABS.forEach((t) => { const r = rows[t]; next[t] = Array.isArray(r) ? r.filter((x): x is string[] => Array.isArray(x)).map((x) => [String(x[0] ?? ''), String(x[1] ?? ''), String(x[2] ?? '')]) : []; });
      setInv(next); setInvSel(null); toast.show(`${label} から財産目録の行設定を読み込みました（${Object.values(next).reduce((a, r) => a + r.length, 0)} 行）`);
    } else {
      if (typeof o.note !== 'string') return toast.show('注記の設定ファイルではありません');
      setNote(o.note); if (typeof o.remark === 'string') setRemark(o.remark); if (typeof o.noteKind === 'string') setNoteKind(o.noteKind);
      toast.show(`${label} から注記および表を読み込みました`);
    }
    setLoad(null);
  };
  const onFile = (f: File | undefined) => { if (!f) return; f.text().then((t) => { try { applyLoaded(JSON.parse(t), f.name); } catch { toast.show('JSON として読み込めませんでした'); } }); if (fileRef.current) fileRef.current.value = ''; };
  const loadSample = () => {
    if (load === 'inv') applyLoaded({ rows: { ...INVENTORY_DEFAULT, 流動資産: [...INVENTORY_DEFAULT.流動資産, ['立替金', '職員立替分', '12,000']], 固定負債: [['設備資金借入金', '○○銀行（園舎改修）', '3,000,000']] } }, 'サンプル');
    else applyLoaded({ noteKind, note: NOTE_DEFAULT + '\n7. 担保に供している資産\n　該当なし。\n8. 満期保有目的の債券の内訳並びに帳簿価額、時価及び評価損益\n　該当なし。', remark: '（注）予備費の充当額 0 円' }, 'サンプル');
  };
  /** 合算テーブルを CSV へ書き出す（テーブル読込で使う形式） */
  const exportTable = () => { const msg = runExport({ kind: 'csv', title: '合算テーブル', fileName: `合算テーブル_${stamp()}`, header: ['No.', 'コード', '部門名称', '計算式', '1ページ中の項目数'], rows: merge.map((m, i) => [i + 1, m.code, m.name, m.formula, i === 0 ? perPage : '']) }); toast.show(msg); };
  /** テーブル読込：「テーブル書出」の CSV（No.,コード,部門名称,計算式,1ページ中の項目数）を読み込む */
  const onTableFile = (f: File | undefined) => {
    if (!f) return;
    f.text().then((t) => {
      const lines = t.replace(/^\ufeff/, '').split(/\r?\n/).filter((l) => l.trim());
      const cells = (l: string) => { const out: string[] = []; let cur = ''; let q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
      const body = lines.map(cells).filter((r) => r[1] && r[0] !== 'No.');
      if (!body.length) return toast.show('合算テーブルの行が見つかりませんでした（テーブル書出の CSV を選んでください）');
      setMerge(body.map((r) => ({ code: r[1], name: r[2] ?? '', formula: r[3] ?? '' })));
      const pp = parseInt(body[0][4] ?? '', 10); if (pp >= 3 && pp <= 10) setPerPage(pp);
      toast.show(`${f.name} から合算テーブルを読み込みました（${body.length} 行）`);
    });
    if (tableRef.current) tableRef.current.value = '';
  };
  const moveInv = (dir: -1 | 1) => { if (invSel == null) return; const j = invSel + dir; if (j < 0 || j >= invRows.length) return; const n = [...invRows]; [n[invSel], n[j]] = [n[j], n[invSel]]; setInv({ ...inv, [invTab]: n }); setInvSel(j); };

  return (
    <SettingsShell variant={variant} title="決算附属明細書" badge="決算" desc="附属明細書の科目設定と伝票入力時の監視、明細書ごとの明細入力、財産目録の行設定、注記の編集、内訳書の合算テーブルを管理します。印刷は「印刷センター › 決算書」から。" actions={<button type="button" className="submit-btn" onClick={() => toast.show('保存しました（プロトタイプ）')} style={btn(accent, true)}>保存</button>}>
      <ToastView msg={toast.msg} />
      <Tabs items={TABS} current={tab} onChange={setTab} accent={accent} />

      {tab === TABS[0] && (
        <div style={{ padding: 22, display: 'grid', gap: 12 }}>
          <Notice>「伝票入力時に監視する」を有効にすると、該当科目の伝票を登録したときに「明細表へ追加しますか？」の確認が出て、その場で明細データを登録できます（連続定型仕訳で登録した伝票は対象外）。</Notice>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={TH}>明細書</th><th style={TH}>使用する科目</th><th style={{ ...TH, width: 180 }}>伝票入力時に監視する</th><th style={{ ...TH, width: 240 }}>追加設定</th></tr></thead>
            <tbody>{WATCH.map((w) => (
              <tr key={w.key}>
                <td style={{ ...TD, fontWeight: 600 }}>{w.label}</td>
                <td style={TD}><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>{accts[w.key].map((a) => <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 4px 2px 8px', background: '#eef2f6', borderRadius: 6, fontSize: 11.5 }}>{a}<button type="button" title="外す" onClick={() => setAccts((x) => ({ ...x, [w.key]: x[w.key].filter((n) => n !== a) }))} style={{ border: 'none', background: 'transparent', color: '#9aa5b1', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: '0 2px', fontFamily: 'inherit' }}>×</button></span>)}<button type="button" onClick={() => openPick(w.key)} title="科目を追加" style={{ ...btn('#5b6773', false, true), padding: '1px 8px' }}>＋</button></div></td>
                <td style={TD}><Toggle on={!!watch[w.key]} onChange={(v) => setWatch({ ...watch, [w.key]: v })} accent={accent} label={watch[w.key] ? '監視する' : '監視しない'} /></td>
                <td style={{ ...TD, fontSize: 12 }}>{w.key === 'hojo' ? <div style={{ display: 'grid', gap: 6 }}><label style={{ display: 'flex', gap: 5 }}><input type="checkbox" checked={fromAcct} onChange={(e) => setFromAcct(e.target.checked)} />科目から明細を作成する</label><label style={{ display: 'flex', gap: 5, alignItems: 'center', whiteSpace: 'nowrap' }}>「○○事業」を<input className="field-input" value={hojoReplace} onChange={(e) => setHojoReplace(e.target.value)} placeholder="例：保育事業" style={{ ...input, padding: '3px 8px', fontSize: 12, width: 120 }} />に置き換える</label></div> : w.extra ? <div style={{ display: 'grid', gap: 4 }}><button type="button" onClick={() => openExtra(w.key)} style={btn('#5b6773', false, true)}>{w.extra}</button><span style={{ fontSize: 11, color: '#9aa5b1' }}>{w.key === 'kokko' ? kokkoTitles.join('／') : oneYear.apply ? `1年基準を適用（${oneYear.long}／${oneYear.short}）` : '1年基準を適用しない'}</span></div> : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
          <div style={{ fontSize: 12, color: '#7a8794' }}>設定2・3は「収入」に合わせた設定です。「支出」に合わせる場合は環境設定の「繰入金明細表の監視」で切り替えます。</div>
        </div>
      )}

      {tab === '明細入力' && (
        <div style={{ padding: 22, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{Object.keys(DETAILS).map((k) => <button key={k} type="button" onClick={() => setDetail(k)} style={btn(detail === k ? accent : '#5b6773', detail === k, true)}>{k}</button>)}</div>
          <div style={card}>
            <div style={cardHead}>{detail} ― 明細入力 <button type="button" onClick={() => setDetailRows((d) => ({ ...d, [detail]: [...d[detail], DETAILS[detail].cols.map(() => '')] }))} style={{ ...btn(accent, false, true), marginLeft: 'auto' }}>＋ 行を追加</button></div>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{DETAILS[detail].cols.map((c) => <th key={c} style={TH}>{c}</th>)}<th style={{ ...TH, width: 50 }} /></tr></thead>
                <tbody>{rowsOf.map((r, ri) => <tr key={ri}>{r.map((c, ci) => { const numeric = /^\d+$/.test(DETAILS[detail].rows[0]?.[ci] ?? '') ; return <td key={ci} style={numeric ? NUM : TD}><input className="field-input" value={numeric && c ? yen(toInt(c)) : c} onChange={(e) => setCell(ri, ci, numeric ? String(toInt(e.target.value)) : e.target.value)} style={{ ...(numeric ? numInput : input), padding: '4px 8px', fontSize: 12.5 }} /></td>; })}<td style={TD}><button type="button" onClick={() => setDetailRows((d) => ({ ...d, [detail]: d[detail].filter((_, i) => i !== ri) }))} style={btn('#c0392b', false, true)}>×</button></td></tr>)}</tbody>
              </table>
            </div>
            <div style={{ padding: '8px 14px', fontSize: 11.5, color: '#9aa5b1' }}>{detail === '補助金事業等収益明細書' ? (fromAcct ? '「科目から明細を作成する」が有効：科目ごとに拠点名・目的を設定します。' : '伝票登録時に登録した明細データを一覧し、ここで修正できます。') : detail === '基本金明細書' ? '組入・取崩が発生していなくても印刷する場合は、印刷の詳細設定で指定します。' : '金額を入力すると明細書に出力されます。'}</div>
          </div>
        </div>
      )}

      {tab === '財産目録の行設定' && (
        <div style={{ padding: 22, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{INVENTORY_TABS.map((t) => <button key={t} type="button" onClick={() => { setInvTab(t); setInvSel(null); }} style={btn(invTab === t ? accent : '#5b6773', invTab === t, true)}>{t}</button>)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 170px', gap: 14, alignItems: 'start' }}>
            <div style={card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ ...TH, width: 40 }}>#</th><th style={TH}>貸借対照表科目</th><th style={TH}>場所・物量等</th><th style={{ ...TH, textAlign: 'right', width: 140 }}>金額</th></tr></thead>
                <tbody>{invRows.map((r, i) => <tr key={i} onClick={() => setInvSel(i)} style={{ background: invSel === i ? '#eef2f6' : 'transparent', cursor: 'pointer' }}><td style={TD}>{i + 1}</td>{r.map((c, k) => <td key={k} style={k === 2 ? NUM : TD}><input className="field-input" value={c} onChange={(e) => setInv({ ...inv, [invTab]: invRows.map((x, xi) => (xi === i ? x.map((y, yi) => (yi === k ? e.target.value : y)) : x)) })} style={{ ...(k === 2 ? numInput : input), padding: '4px 8px', fontSize: 12.5 }} /></td>)}</tr>)}{invRows.length === 0 && <tr><td colSpan={4} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 24 }}>行がありません。「行挿入」または「既定に戻す」で追加してください。</td></tr>}</tbody>
              </table>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <button type="button" onClick={() => moveInv(-1)} style={btn()}>上へ移動</button><button type="button" onClick={() => moveInv(1)} style={btn()}>下へ移動</button>
              <button type="button" onClick={() => setInv({ ...inv, [invTab]: [...invRows.slice(0, invSel ?? invRows.length), ['', '', ''], ...invRows.slice(invSel ?? invRows.length)] })} style={btn()}>行挿入</button>
              <button type="button" onClick={() => invSel != null && setInv({ ...inv, [invTab]: invRows.filter((_, i) => i !== invSel) })} style={btn('#c0392b')}>行削除</button>
              <button type="button" onClick={() => { if (confirm(`${invTab} の全行を削除しますか？`)) setInv({ ...inv, [invTab]: [] }); }} style={btn('#c0392b')}>全行削除</button>
              <button type="button" onClick={() => setInv(JSON.parse(JSON.stringify(INVENTORY_DEFAULT)))} style={btn()}>既定に戻す</button>
              <button type="button" onClick={() => setLoad('inv')} style={btn()}>設定ファイル読込</button><button type="button" onClick={() => saveFile('inv')} style={btn()}>設定ファイル保存</button>
            </div>
          </div>
          <Notice>初期状態では全て空のため、最初に「既定に戻す」で貸借対照表の科目から行を作成します。印刷側の設定（差引純資産の網掛け・行送り 6.4mm など）は印刷センターの財産目録から。</Notice>
        </div>
      )}

      {tab === '注記編集' && (
        <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 220px', gap: 14, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <Field label="対象の注記"><select value={noteKind} onChange={(e) => setNoteKind(e.target.value)} style={input}>{['財務諸表に対する注記（法人全体用）', '財務諸表に対する注記（拠点区分用：チャイルド保育園）'].map((o) => <option key={o}>{o}</option>)}</select></Field>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={18} style={{ ...input, resize: 'vertical', lineHeight: 1.8, fontSize: 12.5 }} />
            <Field label="決算書備考（資金収支計算書 第一号第一様式／第四様式の備考欄）"><input className="field-input" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="備考に出力したい文字" style={input} /></Field>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <button type="button" onClick={() => setTableOpen(true)} style={btn(accent)}>表挿入</button>
            <button type="button" onClick={() => setTableOpen(true)} style={btn()}>表編集</button>
            <button type="button" onClick={() => { if (confirm('注記および表を既定の設定に戻しますか？')) setNote(NOTE_DEFAULT); }} style={btn()}>既定の設定に戻す</button>
            <button type="button" onClick={() => setLoad('note')} style={btn()}>設定ファイル読込</button>
            <button type="button" onClick={() => saveFile('note')} style={btn()}>設定ファイル保存</button>
            <div style={{ fontSize: 11.5, color: '#9aa5b1', lineHeight: 1.6, marginTop: 6 }}>[表] の位置に、表挿入で作成した表が入ります。印刷・PDF出力は印刷センター › 決算書 › 財務諸表に対する注記。</div>
          </div>
          <Modal open={tableOpen} onClose={() => setTableOpen(false)} width={640} title="表の挿入／編集">
            <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['拠点区分', 'サービス区分', '資金収支計算書', '事業活動計算書', '貸借対照表'].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead><tbody>{[['本部', '本部', '○', '○', '○'], ['チャイルド保育園', '保育事業／一時預かり', '○', '○', '○'], ['チャイルド保育園', '子育て支援', '○', '○', '○']].map((r, i) => <tr key={i}>{r.map((c, k) => <td key={k} style={TD}><input className="field-input" defaultValue={c} style={{ ...input, padding: '4px 8px', fontSize: 12.5 }} /></td>)}</tr>)}</tbody></table>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setTableOpen(false)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => { setTableOpen(false); toast.show('表を注記に挿入しました'); }} style={btn(accent, true)}>OK</button></div>
            </div>
          </Modal>
        </div>
      )}

      {tab === '合算テーブル' && (
        <div style={{ padding: 22, display: 'grid', gap: 12 }}>
          <Notice>内訳の決算附属明細書（内訳表）を印刷する前に、横軸となる区分と小計・合計の計算式を設定します。作成しないまま内訳表を印刷するとエラーになります。</Notice>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#8290a0' }}>1ページ中の項目数</span>
            <button type="button" onClick={() => setPerPage((p) => Math.max(3, p - 1))} style={btn('#5b6773', false, true)}>▼</button><b style={{ fontVariantNumeric: 'tabular-nums' }}>{perPage}</b><button type="button" onClick={() => setPerPage((p) => Math.min(10, p + 1))} style={btn('#5b6773', false, true)}>▲</button>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}><button type="button" onClick={exportTable} style={btn()}>テーブル書出</button><button type="button" onClick={() => tableRef.current?.click()} style={btn()}>テーブル読込</button><input ref={tableRef} type="file" accept=".csv,text/csv" onChange={(e) => onTableFile(e.target.files?.[0])} style={{ display: 'none' }} /><button type="button" onClick={() => setFmtOpen(true)} style={btn()}>印刷書式</button></span>
          </div>
          <div style={card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ ...TH, width: 50 }}>No.</th><th style={{ ...TH, width: 140 }}>コード（区分／小計／合計）</th><th style={TH}>部門名称</th><th style={{ ...TH, width: 200 }}>計算式（No.で指定）</th><th style={{ ...TH, width: 50 }} /></tr></thead>
              <tbody>{merge.map((m, i) => <tr key={i} style={{ background: m.code === '小計' ? '#fff8d6' : m.code === '合計' ? '#efe6fb' : 'transparent' }}><td style={TD}>{i + 1}</td><td style={TD}><select value={m.code} onChange={(e) => setMerge(merge.map((x, k) => (k === i ? { ...x, code: e.target.value } : x)))} style={{ ...input, padding: '4px 8px', fontSize: 12.5 }}>{[...SERVICES.map((s) => s.split(' ')[0]), '小計', '合計'].map((o) => <option key={o}>{o}</option>)}</select></td><td style={TD}><input className="field-input" value={m.name} onChange={(e) => setMerge(merge.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} style={{ ...input, padding: '4px 8px', fontSize: 12.5 }} /></td><td style={TD}>{(m.code === '小計' || m.code === '合計') ? <input className="field-input" value={m.formula} onChange={(e) => setMerge(merge.map((x, k) => (k === i ? { ...x, formula: e.target.value } : x)))} placeholder="例：2+3" style={{ ...input, padding: '4px 8px', fontSize: 12.5 }} /> : <span style={{ color: '#9aa5b1', fontSize: 12 }}>—</span>}</td><td style={TD}><button type="button" onClick={() => setMerge(merge.filter((_, k) => k !== i))} style={btn('#c0392b', false, true)}>×</button></td></tr>)}</tbody>
            </table>
            <div style={{ padding: 10 }}><button type="button" onClick={() => setMerge([...merge, { code: SERVICES[0].split(' ')[0], name: '', formula: '' }])} style={btn(accent, false, true)}>＋ 行を追加</button></div>
          </div>
          <div style={{ fontSize: 12, color: '#7a8794' }}>黄色＝小計、紫＝合計。「始め」と「終わり」を No. で指定して範囲の小計を求めます（計算式欄に 2+3 のように入力）。</div>
        </div>
      )}

      {/* 科目の追加（科目検索） */}
      <Modal open={!!pickFor} onClose={() => setPickFor(null)} width={560} title={`科目の追加 ― ${WATCH.find((w) => w.key === pickFor)?.label ?? ''}`}>
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
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ width: 24, fontSize: 12, color: '#8290a0' }}>{i + 1}</span><input className="field-input" value={t} onChange={(e) => setKokkoDraft(kokkoDraft.map((x, k) => (k === i ? e.target.value : x)))} placeholder="例：国庫補助金" style={input} /><button type="button" onClick={() => setKokkoDraft(kokkoDraft.filter((_, k) => k !== i))} style={btn('#c0392b', false, true)}>×</button></div>
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

      {/* 設定ファイル読込（財産目録の行設定／注記） */}
      <Modal open={!!load} onClose={() => setLoad(null)} width={480} title={load === 'inv' ? '設定ファイル読込 ― 財産目録の行設定' : '設定ファイル読込 ― 注記および表'}>
        <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
          <Notice>「設定ファイル保存」で書き出した設定ファイル（JSON）を読み込み、現在の内容を置き換えます。読み込んだ内容は画面上部の「保存」で確定します。</Notice>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5 }}><span style={{ flex: 1, color: '#5b6773' }}>保存した設定ファイルを選択します。</span><button type="button" onClick={() => fileRef.current?.click()} style={btn(accent)}>ファイルを選択…</button></div>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={(e) => onFile(e.target.files?.[0])} style={{ display: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5 }}><span style={{ flex: 1, color: '#9aa5b1' }}>手元にファイルがない場合は、サンプルを読み込んで動作を確認できます。</span><button type="button" onClick={loadSample} style={btn()}>サンプルを読み込む</button></div>
          <Notice tone="warn">一度読み込んだ内容は元に戻せません（「既定に戻す」で初期状態には戻せます）。</Notice>
        </div>
      </Modal>
      <Modal open={fmtOpen} onClose={() => setFmtOpen(false)} width={520} title="合算テーブルの印刷書式">
        <div style={{ padding: '14px 22px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="用紙の向き"><select value={fmt.orient} onChange={(e) => setFmt({ ...fmt, orient: e.target.value })} style={input}><option>縦</option><option>横</option></select></Field>
          <Field label="1ページ中の項目数"><input className="field-input" value={String(fmt.perPage)} onChange={(e) => setFmt({ ...fmt, perPage: toInt(e.target.value) })} inputMode="numeric" style={numInput} /></Field>
          <Field label="フォント" span={2}><select value={fmt.font} onChange={(e) => setFmt({ ...fmt, font: e.target.value })} style={input}>{['Noto Sans JP 9pt', 'Noto Sans JP 10pt', 'ＭＳ 明朝 9pt', 'ＭＳ ゴシック 9pt'].map((o) => <option key={o}>{o}</option>)}</select></Field>
          <div style={{ gridColumn: 'span 2', display: 'grid', gap: 8 }}>
            <Toggle on={fmt.shade} onChange={(v) => setFmt({ ...fmt, shade: v })} accent={accent} label="合計行を網掛けにする" />
            <Toggle on={fmt.corp} onChange={(v) => setFmt({ ...fmt, corp: v })} accent={accent} label="法人名を印刷する" />
            <Toggle on={fmt.page} onChange={(v) => setFmt({ ...fmt, page: v })} accent={accent} label="ページ番号を印刷する" />
          </div>
          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setFmtOpen(false)} style={btn()}>キャンセル</button>
            <button type="button" className="submit-btn" onClick={() => { setFmtOpen(false); toast.show('印刷書式を保存しました'); }} style={btn(accent, true)}>OK</button>
          </div>
        </div>
      </Modal>
    </SettingsShell>
  );
}
