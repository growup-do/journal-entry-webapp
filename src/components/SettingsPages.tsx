// 設定メニューの各画面
//   マスタ系（勘定科目／税区分／部門／タグ／摘要辞書／仕訳辞書／取引先）… 共通のマスタ管理画面（検索・追加・編集・有効/無効・削除・CSV）
//   事業者 … 法人情報・会計期間・拠点区分／サービス区分
//   開始残高 … 期首の貸借残高を拠点ごとに入力（貸借一致チェック）

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ExportDialog, type ExportSpec } from './ExportDialog';
import { Modal } from './Modal';
import { NUM, TD, TH } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { ACCOUNTS, JOURNAL_ROWS, SUMMARIES, VENDORS, displayName } from '../data';
import { Tabs } from './ui';
import { TAX_MODES, setSession, setTaxMode, taxModeUsesTax, useSession, type TaxMode } from '../store/session';
import { DivisionTreeEditor } from './DivisionTreeEditor';
import { ScreenPrintMenu } from './ScreenPrintMenu';
import { BudgetPage } from './BudgetPage';
import { AccountSettingsPage, SummaryAutoCompleteTab } from './AccountSettingsPage';
import { TemplateJournalPage } from './TemplateJournalPage';
import { FiscalYearPage } from './FiscalYearPage';
import { EnvSettingsPage } from './EnvSettingsPage';
import { IntegrityCheckPage } from './IntegrityCheckPage';
import { AttachedStatementsPage } from './AttachedStatementsPage';

const yen = (n: number) => n.toLocaleString('ja-JP');

/* ---------------- 共通シェル ---------------- */
function Shell({ variant, title, desc, actions, children }: { variant: 'form' | 'sheet'; title: string; desc: string; actions?: ReactNode; children: ReactNode }) {
  const isSheet = variant === 'sheet';
  return (
    <main style={{ flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: isSheet ? 'none' : 1200, background: '#fff', border: '1px solid #dde4ea', borderRadius: 14, boxShadow: '0 6px 26px rgba(30,50,70,.06)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 22px 14px', borderBottom: '1px solid #eef2f5', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: isSheet ? 17 : 21 }}>
              {title} <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#eef2f6', color: '#3d4a56', verticalAlign: 'middle', marginLeft: 6 }}>設定</span>
            </div>
            <div style={{ color: '#7a8794', fontSize: 14, marginTop: 4 }}>{desc}</div>
          </div>
          {actions && <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>{actions}</div>}
        </div>
        {children}
      </div>
    </main>
  );
}
const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#fff', color: solid ? '#fff' : color, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' });
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' };
const lbl: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#8290a0', marginBottom: 5 };

/* ---------------- マスタ管理（汎用） ---------------- */
interface Field { key: string; label: string; type?: 'text' | 'number' | 'select' | 'color'; options?: string[]; width?: number; align?: 'right'; /** 編集画面で入力させない（ほかの画面で決まる項目） */ readOnly?: boolean; /** 編集画面の入力欄の下に出す説明 */ hint?: string; /** 編集画面で横いっぱいに置く */ wide?: boolean }
interface MasterConfig { title: string; desc: string; fields: Field[]; rows: Record<string, string>[]; addLabel: string }
type Row = Record<string, string>; // _id（空なら新規）・_on（'1'=有効）を含む

/** CSV テキストを行×列に分解（BOM・CRLF・ダブルクォート内のカンマ／改行／""に対応） */
function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
/** 1行目を見出しとして項目に対応付け（ラベル／キー名で一致。どれも一致しなければ列順） */
function csvToRows(fields: Field[], table: string[][]): { rows: Row[]; byHeader: boolean } {
  if (!table.length) return { rows: [], byHeader: false };
  const head = table[0].map((h) => h.trim());
  const idx = fields.map((f) => head.findIndex((h) => h === f.label || h === f.key));
  const byHeader = idx.some((i) => i >= 0);
  const body = byHeader ? table.slice(1) : table;
  const onIdx = head.findIndex((h) => h === '有効');
  const rows = body.map((r, n) => {
    const row: Row = { _id: `${Date.now()}_${n}`, _on: byHeader && onIdx >= 0 ? (/^(0|無効|false|×)$/i.test(r[onIdx]?.trim() ?? '') ? '0' : '1') : '1' };
    fields.forEach((f, k) => { const i = byHeader ? idx[k] : k; row[f.key] = (i >= 0 ? r[i] ?? '' : '').trim() || (f.type === 'color' ? '#2c5f9e' : ''); });
    return row;
  });
  return { rows, byHeader };
}

const acctRows = (): Record<string, string>[] => {
  let code = 1000;
  const out: Record<string, string>[] = [];
  ACCOUNTS.forEach((g) => {
    const kind = /現金|未収/.test(g.group) ? 'BS 資産' : /収益/.test(g.group) ? 'PL 収益' : 'PL 費用';
    g.items.forEach((name) => { code += 10; out.push({ code: String(code), name, group: g.group, kind, fund: kind === 'BS 資産' ? '—' : '資金科目あり' }); });
  });
  return out;
};
/** 取引先のフリガナ（サンプル。確認メモ #91） */
const VENDOR_KANA: Record<string, string> = { 東京電力: 'トウキョウデンリョク', 'ＮＴＴ東日本': 'エヌティティヒガシニホン', 中央リース: 'チュウオウリース', みどり商店: 'ミドリショウテン', 市役所: 'シヤクショ', 保護者: 'ホゴシャ' };
/** 摘要のフリガナ（サンプル。SUMMARIES の順。確認メモ #92） */
const SUMMARY_KANA = ['シャカイホケンリョウ', 'コウセイネンキン', 'ケンコウホケン', 'ショクインホウキュウ', 'イタクヒ', 'デンワリョウキン', 'デンキダイ', 'フクショクヒ', 'インサツダイ', 'ホイクザイリョウ', 'フリコミテスウリョウ'];
/** 合算集計用の取引先（サンプル）。「取引先」の画面で、区分の取引先ごとにこの名簿から対応先を選ぶ（確認メモ #220） */
const SUM_VENDORS: Record<string, string>[] = [
  { code: '901', name: '東京電力', kana: 'トウキョウデンリョク', map: '001：101 ／ 002：101 ／ 004：101' },
  { code: '902', name: 'ＮＴＴ東日本', kana: 'エヌティティヒガシニホン', map: '001：102 ／ 002：102' },
  { code: '903', name: '中央リース', kana: 'チュウオウリース', map: '002：103 ／ 003：104 ／ 004：102' },
];
const sumVendorLabel = (v: Record<string, string>) => `${v.code} ${v.name}`;
/** 取引先（この区分）→ 対応する合算集計用の取引先（サンプル。同じ名前のものだけ対応づけ済み） */
const sumVendorOf = (name: string) => { const hit = SUM_VENDORS.find((v) => v.name === name); return hit ? sumVendorLabel(hit) : ''; };
const MASTERS: Record<string, MasterConfig> = {
  勘定科目: { title: '勘定科目', desc: '仕訳で使う勘定科目の一覧。分類・区分・資金科目の対応を管理します。', addLabel: '科目を追加', fields: [{ key: 'code', label: 'コード', width: 90 }, { key: 'name', label: '科目名' }, { key: 'group', label: '分類', type: 'select', options: ACCOUNTS.map((g) => g.group) }, { key: 'kind', label: '区分', type: 'select', options: ['BS 資産', 'BS 負債', 'BS 純資産', 'PL 収益', 'PL 費用'], width: 110 }, { key: 'fund', label: '資金科目', width: 120 }], rows: acctRows() },
  // 名称は「印刷名称」（帳票に印字）と「入力名称」（伝票入力の候補に表示）の2種類。「表示順」は候補・一覧の並び順（確認メモ #177）。課税区分に「不明」を追加（現行の消費税コード「課税区分不明」用。確認メモ #178）
  税区分: { title: '税区分', desc: '消費税の区分と税率。仕訳入力時の既定値として使われます。名称は、帳票に印字する「印刷名称」と、伝票入力の候補に出す「入力名称」の2種類を持ちます。一覧と入力時の候補は「表示順」の小さい順に並びます。', addLabel: '税区分を追加', fields: [{ key: 'code', label: 'コード', width: 90 }, { key: 'name', label: '印刷名称' }, { key: 'iname', label: '入力名称' }, { key: 'rate', label: '税率', type: 'number', width: 90, align: 'right' }, { key: 'kind', label: '課税区分', type: 'select', options: ['課税', '非課税', '不課税', '免税', '不明'], width: 120 }, { key: 'order', label: '表示順', type: 'number', width: 90, align: 'right' }], rows: [{ code: '10', name: '課税売上 10%', iname: '課売10%', rate: '10', kind: '課税', order: '1' }, { code: '11', name: '課税仕入 10%', iname: '課仕10%', rate: '10', kind: '課税', order: '2' }, { code: '08', name: '軽減税率 8%', iname: '軽減8%', rate: '8', kind: '課税', order: '3' }, { code: '20', name: '非課税', iname: '非課税', rate: '0', kind: '非課税', order: '4' }, { code: '30', name: '不課税', iname: '不課税', rate: '0', kind: '不課税', order: '5' }, { code: '40', name: '免税', iname: '免税', rate: '0', kind: '免税', order: '6' }, { code: '99', name: '課税区分不明', iname: '不明', rate: '0', kind: '不明', order: '99' }] },
  // 摘要はショートカットではなくコードを持つ（現行の摘要コードと同じ。確認メモ #92）
  摘要辞書: { title: '摘要辞書', desc: 'よく使う摘要の候補。コードを入力するか、入力時のドロップダウンから選べます。', addLabel: '摘要を追加', fields: [{ key: 'code', label: 'コード', width: 90 }, { key: 'name', label: '摘要' }, { key: 'kana', label: 'フリガナ' }, { key: 'acct', label: 'よく使う科目', type: 'select', options: ACCOUNTS.flatMap((g) => g.items) }], rows: SUMMARIES.map((s, i) => ({ code: String(i + 1).padStart(3, '0'), name: s, kana: SUMMARY_KANA[i] ?? '', acct: ['法定福利費', '法定福利費', '法定福利費', '職員俸給', '委託費収益', '通信運搬費', '水道光熱費（事業）', 'その他の利用料収益', '印刷製本費', '保育材料費', '手数料'][i] ?? '' })) },
  仕訳辞書: { title: '仕訳辞書', desc: '定型仕訳のひな形。単一入力・伝票入力で呼び出して金額だけ入力できます（既存の「連続定型」に相当）。', addLabel: '定型仕訳を追加', fields: [{ key: 'name', label: '名称' }, { key: 'kari', label: '借方科目', type: 'select', options: ACCOUNTS.flatMap((g) => g.items) }, { key: 'kashi', label: '貸方科目', type: 'select', options: ACCOUNTS.flatMap((g) => g.items) }, { key: 'tekiyo', label: '摘要' }, { key: 'amount', label: '金額（任意）', type: 'number', width: 110, align: 'right' }], rows: [{ name: '電話料金', kari: '通信運搬費', kashi: '普通預金（保育園）', tekiyo: '電話料金', amount: '' }, { name: '給与支給（本俸）', kari: '職員俸給', kashi: '普通預金（保育園）', tekiyo: '職員俸給', amount: '' }, { name: '副食費 保護者より', kari: '現金（収入）', kashi: 'その他の利用料収益', tekiyo: '副食費ー保護者より', amount: '4500' }, { name: 'コピー機リース', kari: '賃借料（事業）', kashi: '普通預金（保育園）', tekiyo: 'コピー機リース代', amount: '10995' }] },
  '取引先（合算集計用）': { title: '取引先（合算集計用）', desc: '合算区分（法人全体・事業区分）で取引先元帳・取引先推移表を集計するときに、各区分の取引先をまとめて扱うための名簿です。区分ごとの取引先コードが違っていても、ここで同じ取引先として対応づけます。', addLabel: '合算用の取引先を追加', fields: [{ key: 'code', label: 'コード', width: 90 }, { key: 'name', label: '取引先名' }, { key: 'kana', label: 'フリガナ' }, { key: 'map', label: '対応する区分の取引先（区分：コード）', readOnly: true, wide: true, hint: '対応づけは、各区分の「取引先」の画面で「対応する合算集計用の取引先」を選んで行います。ここでは結果の確認だけができます。' }], rows: SUM_VENDORS },
  // 取引先は現行の業者登録と同じ コード・名称・フリガナ（種別・連絡先・備考は持たない。確認メモ #91）。
  // 「対応する合算集計用の取引先」は、現行と同じくこの画面で合算集計用の名簿から選ぶ（確認メモ #220）
  取引先: { title: '取引先', desc: '仕入先・保護者・行政などの取引先。仕訳の「取引先」欄と取引先元帳に使われます。フリガナは入力時のカナ検索に使います。合算区分で取引先をまとめて集計するときは、「編集」で「対応する合算集計用の取引先」を選びます。', addLabel: '取引先を追加', fields: [{ key: 'code', label: 'コード', width: 90 }, { key: 'name', label: '取引先名' }, { key: 'kana', label: 'フリガナ' }, { key: 'sum', label: '対応する合算集計用の取引先', type: 'select', options: SUM_VENDORS.map(sumVendorLabel), wide: true, hint: '合算区分（法人全体・事業区分）の取引先元帳・取引先推移表では、ここで選んだ取引先にまとめて集計します。候補は「取引先（合算集計用）」のタブに登録した取引先です。' }], rows: VENDORS.filter((v) => v !== '（なし）').map((v, i) => ({ code: String(101 + i), name: v, kana: VENDOR_KANA[v] ?? '', sum: sumVendorOf(v) })) },
};

/** 消費税の方式ごとの説明（確認メモ #175） */
const TAX_MODE_NOTE: Record<TaxMode, string> = {
  通常モード: '消費税の処理を行いません。伝票入力に税区分・税額の欄は表示しません（消費税の申告が不要な法人）。',
  簡易課税方式: '課税売上にかかる税額に、みなし仕入率を掛けて納付税額を計算する方式です。伝票入力に税区分・税額の欄を表示します。',
  本則課税の一括比例配分方式: '課税仕入にかかる税額の全体に、課税売上割合を掛けて控除額を計算する方式です。伝票入力に税区分・税額の欄を表示します。',
  本則課税の個別対応方式: '課税仕入を用途（課税売上対応・非課税売上対応・共通対応）ごとに分けて控除額を計算する方式です。伝票入力に税区分・税額の欄を表示します。',
};

function MasterPage({ variant, accent, label, tabs, title }: { variant: 'form' | 'sheet'; accent: string; label: string; tabs?: ReactNode; /** 画面タイトル（省略時は表示名） */ title?: string }) {
  const cfg = MASTERS[label];
  const sess = useSession();
  const [rows, setRows] = useState<Row[]>(() => cfg.rows.map((r, i) => ({ ...r, _id: String(i + 1), _on: '1' })));
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Row | null>(null);
  const [exp, setExp] = useState<ExportSpec | null>(null);
  const [imp, setImp] = useState<{ open: boolean; name: string; rows: Row[]; byHeader: boolean; error: string }>({ open: false, name: '', rows: [], byHeader: false, error: '' });
  const toast = useToast();
  // 「表示順」を持つマスター（税区分）は、表示順の小さい順に並べる（未入力は末尾。確認メモ #177）
  const hasOrder = cfg.fields.some((f) => f.key === 'order');
  const orderOf = (r: Row) => (r.order ? Number(r.order) : Number.MAX_SAFE_INTEGER);
  const filtered = rows.filter((r) => !q || cfg.fields.some((f) => String(r[f.key] ?? '').includes(q)));
  const list = hasOrder ? [...filtered].sort((a, b) => orderOf(a) - orderOf(b)) : filtered;
  const cell = (r: Row, f: Field) => (f.type === 'number' && f.key !== 'rate' && r[f.key] ? Number(r[f.key]) : r[f.key] ?? '');
  // CSV出力：表示中（検索後）の一覧。見出しは画面の項目名＋「有効」
  const exportCsv = () => setExp({ kind: 'csv', title: cfg.title, fileName: `${cfg.title}一覧`, meta: `${list.length} 件${q ? `　検索：${q}` : ''}`, header: [...cfg.fields.map((f) => f.label), '有効'], rows: list.map((r) => [...cfg.fields.map((f) => cell(r, f)), r._on === '1' ? 1 : 0]) });
  // 印刷：取引先・取引先（合算集計用）のそれぞれに置く（確認メモ #221）。表示中（検索後）の一覧を印刷する
  const isVendor = label === '取引先' || label === '取引先（合算集計用）';
  const printList = () => {
    if (list.length === 0) return toast.show('印刷する行がありません');
    setExp({ kind: 'print', title: `${cfg.title}一覧表`, meta: `${label === '取引先' ? `${sess.division}　` : ''}${list.length} 件${q ? `　検索：${q}` : ''}`, header: [...cfg.fields.map((f) => f.label), '有効'], rows: list.map((r) => [...cfg.fields.map((f) => cell(r, f)), r._on === '1' ? '有効' : '無効']) });
  };
  // 削除：ブラウザー標準の確認ではなく、影響と注意事項を示す確認画面を出す（確認メモ #219）
  const [del, setDel] = useState<Row | null>(null);
  const [delAck, setDelAck] = useState(false);
  const askDelete = (r: Row) => { setDelAck(false); setDel(r); };
  const closeDelete = () => setDel(null);
  const nameOf = (r: Row) => r.name ?? r[cfg.fields[0].key] ?? '';
  /** この取引先を使っている伝票の数（サンプルの伝票から数える） */
  const usedCount = del && label === '取引先' ? JOURNAL_ROWS.filter((j) => j.gyosha === del.name).length : 0;
  const delImpacts: string[] = !del ? [] : label === '取引先' ? [
    usedCount > 0 ? `この取引先を使っている伝票が ${usedCount} 件あります。伝票そのものは消えませんが、取引先元帳・取引先推移表で、この取引先の名前では集計できなくなります。` : 'この取引先を使っている伝票はありません。',
    '伝票入力・単一入力などの「取引先」の候補から消え、コードを入力しても呼び出せなくなります。',
    ...(del.sum ? [`合算集計用の取引先「${del.sum}」との対応づけが外れ、合算区分（法人全体・事業区分）の集計に含まれなくなります。`] : []),
    '削除した取引先は元に戻せません。',
  ] : label === '取引先（合算集計用）' ? [
    del.map ? `対応づけている区分の取引先（${del.map}）との対応が、すべて外れます。` : 'この取引先に対応づけている区分の取引先はありません。',
    '合算区分（法人全体・事業区分）の取引先元帳・取引先推移表で、各区分の取引先をまとめて集計できなくなります。区分ごとの取引先と伝票は消えません。',
    '削除した取引先は元に戻せません。',
  ] : [
    `この${cfg.title}を使っている伝票や設定がある場合、入力時の候補や帳票に表示されなくなります。`,
    '削除したデータは元に戻せません。',
  ];
  const doDelete = () => {
    if (!del || !delAck) return;
    setRows((rs) => rs.filter((x) => x._id !== del._id));
    toast.show(`「${nameOf(del)}」を削除しました`);
    setDel(null);
  };
  const disableInstead = () => {
    if (!del) return;
    setRows((rs) => rs.map((x) => (x._id === del._id ? { ...x, _on: '0' } : x)));
    toast.show(`「${nameOf(del)}」を無効にしました（削除はしていません）`);
    setDel(null);
  };
  // CSV取込：ファイルを読んで対応付け → プレビュー → 取り込む（一覧の末尾に追加）
  const loadCsvText = (name: string, text: string) => {
    const parsed = csvToRows(cfg.fields, parseCsv(text));
    setImp({ open: true, name, rows: parsed.rows, byHeader: parsed.byHeader, error: parsed.rows.length ? '' : '読み込める行がありません' });
  };
  const readFile = (file: File) => {
    const fr = new FileReader();
    fr.onload = () => loadCsvText(file.name, String(fr.result ?? ''));
    fr.onerror = () => setImp((i) => ({ ...i, error: 'ファイルを読み込めませんでした' }));
    fr.readAsText(file, 'utf-8');
  };
  const sampleCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [[...cfg.fields.map((f) => f.label), '有効'].map(esc).join(',')];
    cfg.rows.slice(0, 3).forEach((r, i) => lines.push([...cfg.fields.map((f) => (f.key === 'name' ? `${r.name}（取込${i + 1}）` : f.key === 'code' ? String(9000 + i) : r[f.key] ?? '')), '1'].map(esc).join(',')));
    loadCsvText(`${cfg.title}_サンプル.csv`, lines.join('\r\n'));
  };
  const doImport = () => {
    if (!imp.rows.length) return;
    setRows((rs) => [...rs, ...imp.rows]);
    toast.show(`${imp.rows.length} 件を取り込みました`);
    setImp({ open: false, name: '', rows: [], byHeader: false, error: '' });
  };
  const blank = (): Row => ({ ...Object.fromEntries(cfg.fields.map((f) => [f.key, f.type === 'color' ? '#2c5f9e' : ''])), _id: '', _on: '1' });
  const save = () => {
    if (!edit) return;
    const nameKey = cfg.fields.find((f) => f.key === 'name')?.key ?? cfg.fields[0].key;
    if (!String(edit[nameKey] ?? '').trim()) return toast.show(`${cfg.fields.find((f) => f.key === nameKey)?.label}を入力してください`);
    setRows((rs) => (edit._id ? rs.map((r) => (r._id === edit._id ? edit : r)) : [...rs, { ...edit, _id: String(Date.now()) }]));
    toast.show(edit._id ? '更新しました' : '追加しました');
    setEdit(null);
  };
  return (
    <Shell variant={variant} title={title ?? displayName(cfg.title)} desc={cfg.desc} actions={<>
      {/* CSV取込・出力：部門は簡単に変更できない項目のため不要（チャイルド社回答 2026/10/2）。税区分は検討中のため暫定で表示 */}
      {label === '税区分' && <ScreenPrintMenu page="税区分" accent={accent} />}
      {isVendor && <button type="button" className="btn-outline" data-master-print={label} onClick={printList} title={`${cfg.title}の一覧表を印刷します（表示中の ${list.length} 件）`} style={{ ...btn(), display: 'inline-flex', alignItems: 'center', gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="9" rx="2" /><path d="M7 14h10v7H7z" /></svg>印刷</button>}
      {label !== '部門' && <button type="button" className="btn-outline" onClick={() => setImp({ open: true, name: '', rows: [], byHeader: false, error: '' })} style={btn()}>CSV取込</button>}
      {label !== '部門' && <button type="button" className="btn-outline" onClick={exportCsv} style={btn()}>CSV出力</button>}
      <button type="button" className="submit-btn" onClick={() => setEdit(blank())} style={btn(accent, true)}>＋ {cfg.addLabel}</button>
    </>}>
      <ToastView msg={toast.msg} />
      {tabs}
      {label === '税区分' && (
        /* 旧 保守メニュー＞動作環境＞消費税動作環境（確認メモ #55）：消費税対応の設定。法人単位。
           On／Off ではなく 4 つの方式から選ぶ（確認メモ #175）。「通常モード」以外では、すべての伝票形式に税区分・税額の欄を出す（確認メモ #176。今回はラベルの変更まで） */
        <div data-tax-entry style={{ display: 'grid', gap: 8, padding: '12px 22px', background: '#f8fafc', borderBottom: '1px solid #eef2f5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#3d4a56' }}>消費税対応（すべての伝票形式に税区分・税額の欄を表示する）</span>
            <div role="radiogroup" aria-label="消費税の方式" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TAX_MODES.map((m) => {
                const on = sess.taxMode === m;
                return (
                  <button key={m} type="button" role="radio" aria-checked={on} className="chip" data-tax-mode={m} title={TAX_MODE_NOTE[m]} onClick={() => { if (on) return; setTaxMode(m); toast.show(taxModeUsesTax(m) ? `消費税の方式を「${m}」にしました。伝票入力に税区分・税額の欄を表示します` : '消費税の方式を「通常モード」にしました。税区分・税額の欄は表示しません'); }} style={{ padding: '5px 14px', borderRadius: 14, border: '1px solid ' + (on ? accent : '#d3dbe3'), background: on ? accent : '#fff', color: on ? '#fff' : '#5b6773', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>{m}</button>
                );
              })}
            </div>
          </div>
          <div data-tax-mode-note style={{ fontSize: 12, color: '#7a8794', lineHeight: 1.7 }}>
            <b style={{ color: '#3d4a56' }}>{sess.taxMode}</b>：{TAX_MODE_NOTE[sess.taxMode]}
            　旧「消費税動作環境」。税率は下の税区分ごとに持ち、税額は 金額 × 税率 ÷（100 ＋ 税率）の切り捨てで計算します（手入力で変更可）。
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 22px', borderBottom: '1px solid #eef2f5' }}>
        <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="検索" autoComplete="off" style={{ ...input, width: 260 }} />
        <span style={{ marginLeft: 'auto', fontSize: 14, color: '#8895a3' }}>{list.length} 件（無効 {rows.filter((r) => r._on !== '1').length}）</span>
      </div>
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 330px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{cfg.fields.map((f) => <th key={f.key} style={{ ...TH, width: f.width, textAlign: f.align ?? 'left' }}>{f.label}</th>)}<th style={{ ...TH, width: 70 }}>有効</th><th style={{ ...TH, width: 130, textAlign: 'right' }}>操作</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r._id} style={{ opacity: r._on === '1' ? 1 : 0.5 }}>
                {cfg.fields.map((f) => <td key={f.key} style={f.align === 'right' ? NUM : TD}>{f.type === 'color' ? <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 4, background: r[f.key], verticalAlign: 'middle' }} /> : f.type === 'number' && r[f.key] ? (f.key === 'rate' ? `${r[f.key]}%` : yen(Number(r[f.key]))) : f.key === 'sum' && !r[f.key] ? <span style={{ color: '#9aa5b1' }}>（未設定）</span> : r[f.key]}</td>)}
                <td style={TD}><span onClick={() => setRows((rs) => rs.map((x) => (x._id === r._id ? { ...x, _on: x._on === '1' ? '0' : '1' } : x)))} role="switch" aria-checked={r._on === '1'} style={{ display: 'inline-block', width: 34, height: 18, borderRadius: 9, background: r._on === '1' ? accent : '#cfd8e0', position: 'relative', cursor: 'pointer' }}><span style={{ position: 'absolute', top: 2, left: r._on === '1' ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} /></span></td>
                <td style={{ ...TD, textAlign: 'right' }}><div style={{ display: 'inline-flex', gap: 6 }}><button type="button" className="btn-outline" onClick={() => setEdit({ ...r })} style={{ ...btn(), padding: '4px 10px', fontSize: 12 }}>編集</button><button type="button" className="btn-outline" data-master-del={r.code ?? r._id} onClick={() => askDelete(r)} style={{ ...btn('#c0392b'), padding: '4px 10px', fontSize: 12 }}>削除</button></div></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={cfg.fields.length + 2} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 40 }}>該当するデータがありません。</td></tr>}
          </tbody>
        </table>
      </div>
      <ExportDialog spec={exp} onClose={() => setExp(null)} accent={accent} />
      <Modal open={imp.open} onClose={() => setImp((i) => ({ ...i, open: false }))} width={720} title={`${cfg.title}のCSV取込`}>
        <div style={{ padding: '14px 22px 20px', display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 14, color: '#5b6773', lineHeight: 1.7 }}>1行目を見出し（{cfg.fields.map((f) => f.label).join('／')}／有効）として読み込みます。見出しがない場合はこの列順で取り込みます。文字コードは UTF-8（本番では Shift_JIS も対応）。</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ''; }} style={{ fontSize: 14, fontFamily: 'inherit' }} />
            <button type="button" className="btn-outline" onClick={sampleCsv} style={btn()}>サンプルCSVを読み込む</button>
            {imp.name && <span style={{ fontSize: 14, color: '#7a8794' }}>{imp.name}　{imp.rows.length} 行{imp.byHeader ? '（見出し行あり）' : '（列順で対応付け）'}</span>}
          </div>
          {imp.error && <div style={{ fontSize: 14, color: '#c0392b' }}>{imp.error}</div>}
          {imp.rows.length > 0 && (
            <div style={{ border: '1px solid #e2e8ee', borderRadius: 8, overflow: 'auto', maxHeight: 300 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{cfg.fields.map((f) => <th key={f.key} style={{ ...TH, textAlign: f.align ?? 'left' }}>{f.label}</th>)}<th style={{ ...TH, width: 60 }}>有効</th></tr></thead>
                <tbody>{imp.rows.slice(0, 50).map((r) => <tr key={r._id}>{cfg.fields.map((f) => <td key={f.key} style={f.align === 'right' ? NUM : TD}>{f.type === 'color' ? <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 4, background: r[f.key], verticalAlign: 'middle' }} /> : r[f.key]}</td>)}<td style={TD}>{r._on === '1' ? '有効' : '無効'}</td></tr>)}</tbody>
              </table>
              {imp.rows.length > 50 && <div style={{ padding: '6px 12px', fontSize: 12, color: '#9aa5b1' }}>…ほか {imp.rows.length - 50} 行</div>}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setImp((i) => ({ ...i, open: false }))} style={btn()}>キャンセル</button>
            <button type="button" className="submit-btn" disabled={!imp.rows.length} onClick={doImport} style={{ ...btn(accent, true), opacity: imp.rows.length ? 1 : 0.5 }}>取り込む（{imp.rows.length} 件を追加）</button>
          </div>
        </div>
      </Modal>
      <Modal open={!!edit} onClose={() => setEdit(null)} width={560} title={edit?._id ? `${cfg.title}の編集` : cfg.addLabel}>
        {edit && (
          <div style={{ padding: '14px 22px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {cfg.fields.map((f) => (
              <div key={f.key} data-master-field={f.key} style={{ gridColumn: f.wide || f.key === 'name' || f.key === 'tekiyo' || f.key === 'use' || f.key === 'note' ? 'span 2' : undefined }}>
                <span style={lbl}>{f.label}</span>
                {f.readOnly ? <div style={{ ...input, background: '#f4f6f8', color: '#5b6773', minHeight: 36 }}>{edit[f.key] || '（まだ対応づけがありません）'}</div>
                  : f.type === 'select' ? <select value={edit[f.key] ?? ''} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} style={input}><option value="">{f.key === 'sum' ? '（対応づけない）' : '選択'}</option>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
                  : f.type === 'color' ? <input type="color" value={edit[f.key] || '#2c5f9e'} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} style={{ width: 60, height: 36, border: '1px solid #cfd8e0', borderRadius: 8, padding: 2, background: '#fff' }} />
                  : <input className="field-input ring" value={edit[f.key] ?? ''} onChange={(e) => setEdit({ ...edit, [f.key]: f.type === 'number' ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value })} inputMode={f.type === 'number' ? 'decimal' : undefined} style={{ ...input, textAlign: f.align }} />}
                {f.hint && <div style={{ fontSize: 12, color: '#7a8794', lineHeight: 1.6, marginTop: 5 }}>{f.hint}</div>}
              </div>
            ))}
            <label style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}><input type="checkbox" checked={edit._on === '1'} onChange={() => setEdit({ ...edit, _on: edit._on === '1' ? '0' : '1' })} />有効（入力時の候補に表示する）</label>
            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={() => setEdit(null)} style={btn()}>キャンセル</button>
              <button type="button" className="submit-btn" onClick={save} style={btn(accent, true)}>保存</button>
            </div>
          </div>
        )}
      </Modal>
      {/* 削除の確認（確認メモ #219）。Esc・外側クリックでは閉じない。影響を確認するチェックを入れるまで「削除する」は押せない */}
      <Modal open={!!del} onClose={closeDelete} width={620} title={`${cfg.title}の削除`}>
        {del && (
          <div data-master-delete style={{ padding: '14px 22px 20px', display: 'grid', gap: 14 }}>
            <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 10, background: '#fdecea', border: '1px solid #f1b5ae', color: '#96281b' }}>
              <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>⚠</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>削除すると元に戻せません</div>
                <div style={{ fontSize: 14, lineHeight: 1.7, marginTop: 2 }}>下の「削除すると起きること」を確認してから、削除してください。</div>
              </div>
              {label === '取引先' && <span data-delete-level style={{ marginLeft: 'auto', flex: 'none', fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: usedCount > 0 ? '#c0392b' : '#fff', color: usedCount > 0 ? '#fff' : '#96281b', border: '1px solid #c0392b', whiteSpace: 'nowrap' }}>{usedCount > 0 ? `影響：大（使用中の伝票 ${usedCount} 件）` : '影響：小（使用中の伝票なし）'}</span>}
            </div>
            <div>
              <span style={lbl}>削除する{cfg.title}</span>
              <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap', padding: '10px 14px', border: '1px solid #dde4ea', borderRadius: 10, background: '#f8fafc' }}>
                {del.code && <span style={{ fontSize: 14, color: '#5b6773', fontVariantNumeric: 'tabular-nums' }}>コード {del.code}</span>}
                <span style={{ fontSize: 17, fontWeight: 800, color: '#22303c' }}>{nameOf(del)}</span>
                {del.kana && <span style={{ fontSize: 12, color: '#8290a0' }}>{del.kana}</span>}
              </div>
            </div>
            <div>
              <span style={lbl}>削除すると起きること</span>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6, fontSize: 14, lineHeight: 1.7, color: '#22303c' }}>
                {delImpacts.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: '#f1f6fb', border: '1px solid #d5e2ef' }}>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: '#3d4a56' }}>
                <b>今後使わないだけなら、削除ではなく「無効」にできます。</b><br />無効にすると、入力時の候補には出なくなりますが、これまでの伝票と帳票はそのまま残り、いつでも有効に戻せます。
              </div>
              {del._on === '1' && <button type="button" className="btn-outline" data-delete-act="disable" onClick={disableInstead} style={{ ...btn(accent), marginLeft: 'auto', flex: 'none' }}>無効にする</button>}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#22303c', cursor: 'pointer' }}>
              <input type="checkbox" data-delete-ack checked={delAck} onChange={(e) => setDelAck(e.target.checked)} />上の内容を確認しました。この{cfg.title}を削除します
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" data-delete-act="cancel" onClick={closeDelete} style={btn()}>キャンセル</button>
              <button type="button" data-delete-act="run" disabled={!delAck} onClick={doDelete} style={{ ...btn('#c0392b', true), opacity: delAck ? 1 : 0.45, cursor: delAck ? 'pointer' : 'not-allowed' }}>削除する</button>
            </div>
          </div>
        )}
      </Modal>
    </Shell>
  );
}

/* ---------------- 法人・区分（画面キーは「事業者」） ---------------- */
/** 「法人情報」タブは廃止（確認メモ #67）。法人名は区分階層の法人のカードを選んで変更する */
function OrgPage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  return (
    <Shell variant={variant} title={displayName('事業者')} desc="区分階層（法人 › 事業区分 › 拠点区分 › サービス区分 › 小サービス区分）と合算区分を管理します。法人名は、区分階層で法人のカードを選んで変更します。">
      <DivisionTreeEditor accent={accent} />
    </Shell>
  );
}

/* ---------------- 開始残高 ---------------- */
/** 内部取引の内訳（現行「貸借対照表 繰越 内部取引残高」と同じ 4 階層。確認メモ #168） */
const INNER_LEVELS = ['事業区分間', '拠点区分間', 'サービス区分間', '小サービス区分間'] as const;
/** 既定のタブ（確認メモ #167） */
const OPENING_BASE_TABS = ['貸借科目繰越残高', '事業科目前年実績'];
/** 「期中入力を行う」のときだけ追加されるタブ（期の途中から導入する場合。確認メモ #167）。旧「資金科目当期実績」は「資金科目期中入力」 */
const OPENING_MID_TABS = ['貸借科目期中入力', '事業科目期中入力', '資金科目期中入力'];
const OPENING_SITES = ['本部', 'チャイルド保育園'];
/** 1 科目ぶんの入力値。l＝借方（資金科目は収入）、r＝貸方（資金科目は支出）、inner＝内部取引の額（INNER_LEVELS の順） */
interface OpenCell { l: number; r: number; inner: number[] }
/** 貸借科目（主要なもの）。v＝繰越残高、prior＝前年度（令和7年度）決算の期末残高。いずれも拠点ごと（サンプル）。本番では前年度データの貸借対照表から取得 */
const OPEN_BS: { code: string; name: string; side: 'l' | 'r'; v: number[]; prior: number[] }[] = [
  { code: '111', name: '小口現金', side: 'l', v: [0, 26500], prior: [0, 31200] },
  { code: '112', name: '普通預金（本部）', side: 'l', v: [14800, 0], prior: [21500, 0] },
  { code: '113', name: '普通預金（保育園）', side: 'l', v: [0, 9630000], prior: [0, 9870500] },
  { code: '114', name: '当座預金（保育園）', side: 'l', v: [0, 155800], prior: [0, 142300] },
  { code: '121', name: '事業未収金', side: 'l', v: [0, 1200000], prior: [0, 1350000] },
  { code: '151', name: '土地', side: 'l', v: [0, 22000000], prior: [0, 22000000] },
  { code: '152', name: '建物', side: 'l', v: [0, 15400000], prior: [0, 15100000] },
  { code: '153', name: '器具及び備品', side: 'l', v: [0, 1800000], prior: [0, 1620000] },
  { code: '211', name: '事業未払金', side: 'r', v: [0, 400000], prior: [0, 385000] },
  { code: '212', name: '職員預り金', side: 'r', v: [0, 250000], prior: [0, 262000] },
  { code: '221', name: '賞与引当金', side: 'r', v: [0, 1500000], prior: [0, 1550000] },
  { code: '311', name: '基本金', side: 'r', v: [0, 25800000], prior: [0, 25800000] },
  { code: '321', name: '国庫補助金等特別積立金', side: 'r', v: [0, 9600000], prior: [0, 9300000] },
  { code: '331', name: '次期繰越活動増減差額', side: 'r', v: [14800, 12662300], prior: [21500, 12817000] },
];
/** 事業活動科目。v＝前年実績、mid＝期中（導入月の前月まで）の実績。拠点ごと（サンプル） */
const OPEN_PL: { code: string; name: string; side: 'l' | 'r'; v: number[]; mid: number[] }[] = [
  { code: '400', name: '保育事業収益', side: 'r', v: [0, 40200000], mid: [0, 13746150] },
  { code: '410', name: '補助金事業収益', side: 'r', v: [0, 700000], mid: [0, 660000] },
  { code: '420', name: '人件費', side: 'l', v: [0, 28100000], mid: [0, 9600000] },
  { code: '430', name: '事業費', side: 'l', v: [0, 5050000], mid: [0, 1720000] },
  { code: '440', name: '事務費', side: 'l', v: [0, 3480000], mid: [0, 1150000] },
  { code: '450', name: '減価償却費', side: 'l', v: [0, 3034380], mid: [0, 0] },
];
/** 資金科目。mid＝期中（導入月の前月まで）の実績。l＝収入、r＝支出。拠点ごと（サンプル） */
const OPEN_FUND: { code: string; name: string; side: 'l' | 'r'; mid: number[] }[] = [
  { code: '100', name: '委託費収入', side: 'l', mid: [0, 13662150] },
  { code: '110', name: '利用者等利用料収入', side: 'l', mid: [0, 84000] },
  { code: '120', name: '補助金事業収入', side: 'l', mid: [0, 660000] },
  { code: '130', name: '人件費支出', side: 'r', mid: [0, 9600000] },
  { code: '140', name: '事業費支出', side: 'r', mid: [0, 1720000] },
  { code: '150', name: '事務費支出', side: 'r', mid: [0, 1150000] },
];
/** 内部取引の額のサンプル（チャイルド保育園。INNER_LEVELS の順） */
const OPEN_BS_INNER: Record<string, number[] | undefined> = { 事業未収金: [0, 0, 50000, 0], 事業未払金: [0, 0, 50000, 0] };
const OPEN_BS_PRIOR_INNER: Record<string, number[] | undefined> = { 事業未収金: [0, 0, 60000, 0], 事業未払金: [0, 0, 60000, 0] };
const OPEN_PL_INNER: Record<string, number[] | undefined> = { 保育事業収益: [0, 0, 180000, 0], 事業費: [0, 0, 180000, 0] };
/** 貸借科目の期中の発生額［借方, 貸方］のサンプル（チャイルド保育園） */
const OPEN_BS_MID: Record<string, [number, number] | undefined> = { 小口現金: [120000, 98400], '普通預金（保育園）': [14406150, 12470000], 職員預り金: [610000, 655000] };
const openCell = (l = 0, r = 0, inner?: number[]): OpenCell => ({ l, r, inner: inner ? [...inner] : INNER_LEVELS.map(() => 0) });
const openSided = (side: 'l' | 'r', v: number, inner?: number[]): OpenCell => (side === 'l' ? openCell(v, 0, inner) : openCell(0, v, inner));
/** タブ → 拠点 → 科目 の入力値（初期値） */
const initOpening = (): Record<string, OpenCell[][]> => ({
  貸借科目繰越残高: OPENING_SITES.map((_, s) => OPEN_BS.map((it) => openSided(it.side, it.v[s], s === 1 ? OPEN_BS_INNER[it.name] : undefined))),
  事業科目前年実績: OPENING_SITES.map((_, s) => OPEN_PL.map((it) => openSided(it.side, it.v[s], s === 1 ? OPEN_PL_INNER[it.name] : undefined))),
  貸借科目期中入力: OPENING_SITES.map((_, s) => OPEN_BS.map((it) => { const m = s === 1 ? OPEN_BS_MID[it.name] : undefined; return openCell(m?.[0] ?? 0, m?.[1] ?? 0); })),
  事業科目期中入力: OPENING_SITES.map((_, s) => OPEN_PL.map((it) => openSided(it.side, it.mid[s]))),
  資金科目期中入力: OPENING_SITES.map((_, s) => OPEN_FUND.map((it) => openSided(it.side, it.mid[s]))),
});
/** タブごとの表の定義。inner＝内部取引の列を出す（繰越残高・前年実績だけ。期中入力は内部取引の入力に対応しない＝現行と同じ） */
const OPENING_DEFS: Record<string, { items: { code: string; name: string }[]; cols: [string, string]; inner: boolean; note: string }> = {
  貸借科目繰越残高: { items: OPEN_BS, cols: ['借方', '貸方'], inner: true, note: '期首（前年度末）の貸借対照表科目の残高を登録します。年度更新をすると自動で設定されるため、通常は初年度のみ入力します。' },
  事業科目前年実績: { items: OPEN_PL, cols: ['借方', '貸方'], inner: true, note: '事業活動計算書の前年度実績（前年度決算額）を登録します。年度更新をすると自動で設定されるため、通常は初年度のみ入力します。' },
  貸借科目期中入力: { items: OPEN_BS, cols: ['借方', '貸方'], inner: false, note: '期の途中から導入する場合に、期首から導入月の前月までの貸借科目の発生額（借方・貸方）を登録します。' },
  事業科目期中入力: { items: OPEN_PL, cols: ['借方', '貸方'], inner: false, note: '期の途中から導入する場合に、期首から導入月の前月までの事業活動科目の実績（借方・貸方）を登録します。' },
  資金科目期中入力: { items: OPEN_FUND, cols: ['収入', '支出'], inner: false, note: '期の途中から導入する場合に、期首から導入月の前月までの資金収支科目の実績（収入・支出）を登録します（旧「資金科目当期実績」）。' },
};

function OpeningBalancePage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  const toast = useToast();
  /** 期中入力を行うか（期の途中から導入する場合だけ On。確認メモ #167） */
  const mid = useSession().openingMidTerm;
  const [data, setData] = useState(initOpening);
  const [site, setSite] = useState(0);
  const [tabRaw, setTab] = useState(OPENING_BASE_TABS[0]);
  const [importOpen, setImportOpen] = useState(false);
  /** 期中入力の切替の確認（'on'＝始める／'off'＝やめる） */
  const [midConfirm, setMidConfirm] = useState<'on' | 'off' | null>(null);
  const tabs = mid ? [...OPENING_BASE_TABS, ...OPENING_MID_TABS] : OPENING_BASE_TABS;
  const tab = tabs.includes(tabRaw) ? tabRaw : OPENING_BASE_TABS[0];
  const def = OPENING_DEFS[tab];
  const rows = data[tab][site];
  const num = (v: string) => parseInt(v.replace(/[^0-9]/g, ''), 10) || 0;
  const patch = (i: number, f: (c: OpenCell) => OpenCell) => setData((x) => ({ ...x, [tab]: x[tab].map((rs, s) => (s === site ? rs.map((c, k) => (k === i ? f(c) : c)) : rs)) }));
  // 貸借一致は、貸借科目繰越残高（表示中の拠点）で判定する
  const bs = data['貸借科目繰越残高'][site];
  const d = bs.reduce((a, x) => a + x.l, 0), c = bs.reduce((a, x) => a + x.r, 0);
  const ok = d === c;
  const sumL = rows.reduce((a, x) => a + x.l, 0), sumR = rows.reduce((a, x) => a + x.r, 0);
  const importPrior = () => {
    setData((x) => ({ ...x, 貸借科目繰越残高: OPENING_SITES.map((_, s) => OPEN_BS.map((it) => openSided(it.side, it.prior[s], s === 1 ? OPEN_BS_PRIOR_INNER[it.name] : undefined))) }));
    setImportOpen(false); setTab('貸借科目繰越残高');
    toast.show('前年度（令和7年度）の決算残高を貸借科目繰越残高に取り込みました（「OK」で確定）');
  };
  const applyMid = () => {
    const on = midConfirm === 'on';
    setSession({ openingMidTerm: on });
    setMidConfirm(null);
    setTab(on ? OPENING_MID_TABS[0] : OPENING_BASE_TABS[0]);
    toast.show(on ? '期中入力のタブ（貸借科目・事業科目・資金科目）を追加しました' : '期中入力のタブを閉じました');
  };
  const ctd: CSSProperties = { ...TD, padding: '4px 10px' };
  const cnum: CSSProperties = { ...NUM, padding: '4px 10px' };
  const cellIn: CSSProperties = { ...input, textAlign: 'right', padding: '5px 8px', fontVariantNumeric: 'tabular-nums', background: '#fffbe6' };
  const total: CSSProperties = { ...cnum, fontWeight: 700, paddingRight: 19 };
  return (
    <Shell variant={variant} title="開始残高" desc="運用開始時点（期首）の貸借科目の繰越残高と、事業科目の前年実績を拠点ごとに登録します。各科目には内部取引の金額も入力します。期の途中から導入する場合は「期中入力を行う」をチェックすると、期中入力のタブが追加されます。" actions={<>
      <button type="button" className="btn-outline" onClick={() => setImportOpen(true)} style={btn()}>前年度決算から取込</button>
      {/* 期中入力の切替（確認を挟む。確認メモ #167）。旧「借貸残高（期中）」ボタンの置き換え */}
      <label data-opening-midterm title="期の途中から導入する場合だけチェックします。通常は使用しません" style={{ ...btn(mid ? accent : undefined), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <input type="checkbox" checked={mid} onChange={() => setMidConfirm(mid ? 'off' : 'on')} style={{ margin: 0 }} />期中入力を行う（期の途中から導入する場合）
      </label>
      <button type="button" className="submit-btn" disabled={!ok} onClick={() => toast.show('開始残高を確定しました（プロトタイプ）')} style={{ ...btn(accent, true), opacity: ok ? 1 : 0.5 }}>OK</button>
    </>}>
      <ToastView msg={toast.msg} />
      <Modal open={importOpen} onClose={() => setImportOpen(false)} width={480} title="前年度決算から取込" strict>
        <div style={{ padding: '16px 22px 18px', fontSize: 14, lineHeight: 1.8 }}>
          <div>前年度（令和7年度）の決算残高を貸借科目繰越残高に取り込みます（内部取引の金額を含みます）。</div>
          <div style={{ color: '#c0392b', fontWeight: 700 }}>現在の入力値は上書きされます。</div>
          <div style={{ fontSize: 14, color: '#7a8794', marginTop: 6 }}>対象：本部／チャイルド保育園の全拠点。取り込み後は貸借一致を確認し「OK」で確定してください。</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={() => setImportOpen(false)} style={btn()}>キャンセル</button>
            <button type="button" className="submit-btn" onClick={importPrior} style={btn(accent, true)}>OK（取り込む）</button>
          </div>
        </div>
      </Modal>
      <Modal open={midConfirm !== null} onClose={() => setMidConfirm(null)} width={520} title={midConfirm === 'off' ? '期中入力をやめる' : '期中入力を行う'}>
        <div data-opening-midterm-confirm style={{ padding: '16px 22px 18px', fontSize: 14, lineHeight: 1.8 }}>
          {midConfirm === 'off' ? <>
            <div>期中入力をやめて、期中入力のタブ（貸借科目期中入力・事業科目期中入力・資金科目期中入力）を閉じます。</div>
            <div style={{ fontSize: 14, color: '#7a8794', marginTop: 6 }}>入力済みの期中の金額は残ります。もう一度チェックすると、同じ内容で表示されます。</div>
          </> : <>
            <div>期中入力は、<b>期の途中から導入する場合</b>に使う画面です。通常は使用しません。</div>
            <div>期中入力のタブ（貸借科目期中入力・事業科目期中入力・資金科目期中入力）を追加しますか？</div>
            <div style={{ fontSize: 14, color: '#7a8794', marginTop: 6 }}>期首から導入月の前月までの実績を、科目ごとの合計額で登録します。</div>
          </>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={() => setMidConfirm(null)} style={btn()}>キャンセル</button>
            <button type="button" className="submit-btn" data-opening-midterm-ok onClick={applyMid} style={btn(accent, true)}>{midConfirm === 'off' ? '期中入力をやめる' : '期中入力を行う'}</button>
          </div>
        </div>
      </Modal>
      <Tabs items={tabs} current={tab} onChange={setTab} accent={accent} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 22px', borderBottom: '1px solid #eef2f5', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#8290a0' }}>拠点</span>
        {OPENING_SITES.map((s, i) => <button key={s} type="button" className="chip" onClick={() => setSite(i)} style={{ padding: '5px 14px', borderRadius: 14, border: '1px solid ' + (site === i ? accent : '#d3dbe3'), background: site === i ? accent : '#fff', color: site === i ? '#fff' : '#5b6773', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{s}</button>)}
        <span style={{ fontSize: 12, color: '#7a8794', flex: 1, minWidth: 240 }}>{def.note}</span>
        {tab === '貸借科目繰越残高' && <span style={{ fontSize: 14, padding: '4px 12px', borderRadius: 10, background: ok ? '#eaf5ef' : '#fdeee9', color: ok ? '#1f7a52' : '#c0392b', fontWeight: 700, whiteSpace: 'nowrap' }}>{ok ? '貸借一致' : `差額 ${yen(Math.abs(d - c))}（${d > c ? '借方' : '貸方'}が多い）`}</span>}
      </div>
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 330px)' }}>
        <table data-opening-table={tab} style={{ width: '100%', borderCollapse: 'collapse', maxWidth: def.inner ? undefined : 760 }}>
          <thead>
            <tr>
              <th rowSpan={def.inner ? 2 : 1} style={{ ...TH, width: 70 }}>コード</th>
              <th rowSpan={def.inner ? 2 : 1} style={TH}>科目名</th>
              <th rowSpan={def.inner ? 2 : 1} style={{ ...TH, width: 150, textAlign: 'right' }}>{def.cols[0]}</th>
              <th rowSpan={def.inner ? 2 : 1} style={{ ...TH, width: 150, textAlign: 'right' }}>{def.cols[1]}</th>
              {def.inner && <th colSpan={INNER_LEVELS.length} style={{ ...TH, textAlign: 'center', padding: '6px 10px', borderLeft: '1px solid #e2e8ee' }}>内部取引（左の金額のうち、内部取引にあたる額）</th>}
            </tr>
            {def.inner && <tr>{INNER_LEVELS.map((l, k) => <th key={l} style={{ ...TH, width: 128, textAlign: 'right', fontSize: 12, padding: '6px 10px', borderLeft: k === 0 ? '1px solid #e2e8ee' : undefined }}>{l}</th>)}</tr>}
          </thead>
          <tbody>
            {def.items.map((it, i) => {
              const cl = rows[i];
              // 内部取引の合計が金額（借方＋貸方）を超えていたら赤字で知らせる
              const over = def.inner && cl.inner.reduce((a, x) => a + x, 0) > cl.l + cl.r;
              return (
                <tr key={it.code}>
                  <td style={{ ...ctd, color: '#8290a0' }}>{it.code}</td>
                  <td style={ctd}>{it.name}</td>
                  <td style={cnum}><input className="field-input ring" value={cl.l ? yen(cl.l) : ''} onChange={(e) => patch(i, (x) => ({ ...x, l: num(e.target.value) }))} inputMode="numeric" aria-label={`${it.name}の${def.cols[0]}`} style={cellIn} /></td>
                  <td style={cnum}><input className="field-input ring" value={cl.r ? yen(cl.r) : ''} onChange={(e) => patch(i, (x) => ({ ...x, r: num(e.target.value) }))} inputMode="numeric" aria-label={`${it.name}の${def.cols[1]}`} style={cellIn} /></td>
                  {def.inner && INNER_LEVELS.map((l, k) => (
                    <td key={l} style={{ ...cnum, borderLeft: k === 0 ? '1px solid #e2e8ee' : undefined }}><input className="field-input ring" data-opening-inner value={cl.inner[k] ? yen(cl.inner[k]) : ''} onChange={(e) => patch(i, (x) => ({ ...x, inner: x.inner.map((v, n) => (n === k ? num(e.target.value) : v)) }))} inputMode="numeric" aria-label={`${it.name}の内部取引（${l}）`} title={over ? '内部取引の合計が、この科目の金額を超えています' : undefined} style={{ ...cellIn, color: over ? '#c0392b' : undefined }} /></td>
                  ))}
                </tr>
              );
            })}
            <tr style={{ background: '#f3f6f9' }}>
              <td style={{ ...ctd, fontWeight: 700, padding: '9px 10px' }} colSpan={2}>合計</td>
              <td style={total}>{yen(sumL)}</td>
              <td style={total}>{yen(sumR)}</td>
              {def.inner && INNER_LEVELS.map((l, k) => <td key={l} style={{ ...total, borderLeft: k === 0 ? '1px solid #e2e8ee' : undefined }}>{yen(rows.reduce((a, x) => a + x.inner[k], 0))}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 22px 16px', fontSize: 12, color: '#9aa5b1', lineHeight: 1.7 }}>
        {def.inner
          ? <>※ 内部取引：その科目の金額のうち、区分間の内部取引にあたる額を階層（{INNER_LEVELS.join('／')}）ごとに入力します。合算区分で集計するときの内部取引消去に使います。勘定科目そのものが内部取引の科目として設定されている場合は、入力不要です。<br /></>
          : <>※ 期中入力は、内部取引の金額の入力には対応していません。<br /></>}
        ※ 科目は主要なもののみ表示しています。{tab === '貸借科目繰越残高' && '確定後は前年仕訳の「繰越」として各元帳に反映されます。'}
      </div>
    </Shell>
  );
}

/* ---------------- 取引先（取引先＋合算集計用） ---------------- */
function VendorPage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  const [tab, setTab] = useState('取引先');
  const tabs = <Tabs items={['取引先', '取引先（合算集計用）']} current={tab} onChange={setTab} accent={accent} />;
  if (tab === '取引先') return <MasterPage key="取引先" variant={variant} accent={accent} label="取引先" tabs={tabs} />;
  return <MasterPage key="取引先（合算集計用）" variant={variant} accent={accent} label="取引先（合算集計用）" tabs={tabs} title={displayName('取引先')} />;
}

/* ---------------- 摘要辞書（辞書＋自動補完候補） ---------------- */
function SummaryDictPage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  const [tab, setTab] = useState('摘要辞書');
  if (tab === '摘要辞書') return <MasterPage key="摘要辞書" variant={variant} accent={accent} label="摘要辞書" tabs={<Tabs items={['摘要辞書', '自動補完候補']} current={tab} onChange={setTab} accent={accent} />} />;
  return (
    <Shell variant={variant} title={displayName('摘要辞書')} desc="摘要の自動補完候補を管理します（伝票入力時に過去の摘要から候補を表示）。">
      <Tabs items={['摘要辞書', '自動補完候補']} current={tab} onChange={setTab} accent={accent} />
      <SummaryAutoCompleteTab accent={accent} />
    </Shell>
  );
}

/* ---------------- 振り分け ---------------- */
export function renderSettingsPage(label: string, variant: 'form' | 'sheet', accent: string, onNavigate?: (page: string) => void) {
  if (label === '事業者') return <OrgPage variant={variant} accent={accent} />;
  if (label === '開始残高') return <OpeningBalancePage variant={variant} accent={accent} />;
  if (label === '予算') return <BudgetPage variant={variant} accent={accent} />;
  if (label === '年度更新・切替') return <FiscalYearPage variant={variant} accent={accent} />;
  if (label === '環境設定') return <EnvSettingsPage variant={variant} accent={accent} onNavigate={onNavigate} />;
  if (label === '取引先') return <VendorPage variant={variant} accent={accent} />;
  if (label === '決算附属明細書') return <AttachedStatementsPage variant={variant} accent={accent} />;
  if (label === '整合性チェック') return <IntegrityCheckPage variant={variant} accent={accent} />;
  if (label === '勘定科目') return <AccountSettingsPage variant={variant} accent={accent} />;
  if (label === '仕訳辞書') return <TemplateJournalPage variant={variant} accent={accent} />;
  if (label === '摘要辞書') return <SummaryDictPage variant={variant} accent={accent} />;
  if (MASTERS[label]) return <MasterPage key={label} variant={variant} accent={accent} label={label} />;
  return null;
}
