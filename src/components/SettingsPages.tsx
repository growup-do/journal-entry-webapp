// 設定メニューの各画面（叩き台）
//   マスタ系（勘定科目／税区分／部門／タグ／摘要辞書／仕訳辞書／取引先）… 共通のマスタ管理画面（検索・追加・編集・有効/無効・削除・CSV）
//   事業者 … 法人情報・会計期間・拠点区分／サービス区分
//   開始残高 … 期首の貸借残高を拠点ごとに入力（貸借一致チェック）
//   他社ソフトデータの移行 … 4ステップのウィザード

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Modal } from './Modal';
import { NUM, TD, TH } from './ReportShell';
import { NOT_IMPL, ToastView, useToast } from './Toast';
import { ACCOUNTS, SERVICES, SUMMARIES, VENDORS } from '../data';

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
              {title} <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#eef2f6', color: '#3d4a56', verticalAlign: 'middle', marginLeft: 6 }}>設定</span>
            </div>
            <div style={{ color: '#7a8794', fontSize: 12, marginTop: 4 }}>{desc}<span style={{ color: '#b7791f' }}>（叩き台）</span></div>
          </div>
          {actions && <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>{actions}</div>}
        </div>
        {children}
      </div>
    </main>
  );
}
const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#fff', color: solid ? '#fff' : color, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' });
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' };
const lbl: CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#8290a0', marginBottom: 5 };

/* ---------------- マスタ管理（汎用） ---------------- */
interface Field { key: string; label: string; type?: 'text' | 'number' | 'select' | 'color'; options?: string[]; width?: number; align?: 'right' }
interface MasterConfig { title: string; desc: string; fields: Field[]; rows: Record<string, string>[]; addLabel: string }
type Row = Record<string, string>; // _id（空なら新規）・_on（'1'=有効）を含む

const acctRows = (): Record<string, string>[] => {
  let code = 1000;
  const out: Record<string, string>[] = [];
  ACCOUNTS.forEach((g) => {
    const kind = /現金|未収/.test(g.group) ? 'BS 資産' : /収益/.test(g.group) ? 'PL 収益' : 'PL 費用';
    g.items.forEach((name) => { code += 10; out.push({ code: String(code), name, group: g.group, kind, fund: kind === 'BS 資産' ? '—' : '資金科目あり' }); });
  });
  return out;
};
const MASTERS: Record<string, MasterConfig> = {
  勘定科目: { title: '勘定科目', desc: '仕訳で使う勘定科目の一覧。分類・区分・資金科目の対応を管理します。', addLabel: '科目を追加', fields: [{ key: 'code', label: 'コード', width: 90 }, { key: 'name', label: '科目名' }, { key: 'group', label: '分類', type: 'select', options: ACCOUNTS.map((g) => g.group) }, { key: 'kind', label: '区分', type: 'select', options: ['BS 資産', 'BS 負債', 'BS 純資産', 'PL 収益', 'PL 費用'], width: 110 }, { key: 'fund', label: '資金科目', width: 120 }], rows: acctRows() },
  税区分: { title: '税区分', desc: '消費税の区分と税率。仕訳入力時の既定値として使われます。', addLabel: '税区分を追加', fields: [{ key: 'code', label: 'コード', width: 90 }, { key: 'name', label: '名称' }, { key: 'rate', label: '税率', type: 'number', width: 90, align: 'right' }, { key: 'kind', label: '課税区分', type: 'select', options: ['課税', '非課税', '不課税', '免税'], width: 120 }], rows: [{ code: '10', name: '課税売上 10%', rate: '10', kind: '課税' }, { code: '11', name: '課税仕入 10%', rate: '10', kind: '課税' }, { code: '08', name: '軽減税率 8%', rate: '8', kind: '課税' }, { code: '20', name: '非課税', rate: '0', kind: '非課税' }, { code: '30', name: '不課税', rate: '0', kind: '不課税' }, { code: '40', name: '免税', rate: '0', kind: '免税' }] },
  部門: { title: '部門', desc: '拠点区分・サービス区分に対応する部門。集計や権限の単位になります。', addLabel: '部門を追加', fields: [{ key: 'code', label: 'コード', width: 90 }, { key: 'name', label: '部門名' }, { key: 'site', label: '拠点区分', type: 'select', options: ['本部', 'チャイルド保育園'] }, { key: 'head', label: '責任者' }], rows: SERVICES.map((s) => { const [code, ...rest] = s.split(' '); return { code, name: rest.join(' '), site: code === '001' ? '本部' : 'チャイルド保育園', head: code === '001' ? '園長 太郎' : '事務 花子' }; }) },
  タグ: { title: 'タグ', desc: '仕訳に付ける任意のタグ。検索・絞り込み・付箋の色分けに使います。', addLabel: 'タグを追加', fields: [{ key: 'name', label: 'タグ名' }, { key: 'color', label: '色', type: 'color', width: 80 }, { key: 'use', label: '用途' }], rows: [{ name: '要確認', color: '#c0392b', use: '内容を確認してから確定する仕訳' }, { name: '補助金対象', color: '#2c5f9e', use: '補助金の実績報告に含める支出' }, { name: '内部取引', color: '#b7791f', use: '拠点間・サービス区分間の取引' }, { name: '決算整理', color: '#1f7a52', use: '決算整理仕訳' }] },
  摘要辞書: { title: '摘要辞書', desc: 'よく使う摘要の候補。入力時のドロップダウンに表示されます。', addLabel: '摘要を追加', fields: [{ key: 'name', label: '摘要' }, { key: 'acct', label: 'よく使う科目', type: 'select', options: ACCOUNTS.flatMap((g) => g.items) }, { key: 'key', label: 'ショートカット', width: 120 }], rows: SUMMARIES.map((s, i) => ({ name: s, acct: ['法定福利費', '法定福利費', '法定福利費', '職員俸給', '委託費収益', '通信運搬費', '水道光熱費（事業）', 'その他の利用料収益', '印刷製本費', '保育材料費', '手数料'][i] ?? '', key: `;${i + 1}` })) },
  仕訳辞書: { title: '仕訳辞書', desc: '定型仕訳のひな形。単一入力・伝票入力で呼び出して金額だけ入力できます（既存の「連続定型」に相当）。', addLabel: '定型仕訳を追加', fields: [{ key: 'name', label: '名称' }, { key: 'kari', label: '借方科目', type: 'select', options: ACCOUNTS.flatMap((g) => g.items) }, { key: 'kashi', label: '貸方科目', type: 'select', options: ACCOUNTS.flatMap((g) => g.items) }, { key: 'tekiyo', label: '摘要' }, { key: 'amount', label: '金額（任意）', type: 'number', width: 110, align: 'right' }], rows: [{ name: '電話料金', kari: '通信運搬費', kashi: '普通預金（保育園）', tekiyo: '電話料金', amount: '' }, { name: '給与支給（本俸）', kari: '職員俸給', kashi: '普通預金（保育園）', tekiyo: '職員俸給', amount: '' }, { name: '副食費 保護者より', kari: '現金（収入）', kashi: 'その他の利用料収益', tekiyo: '副食費ー保護者より', amount: '4500' }, { name: 'コピー機リース', kari: '賃借料（事業）', kashi: '普通預金（保育園）', tekiyo: 'コピー機リース代', amount: '10995' }] },
  取引先: { title: '取引先', desc: '業者・保護者・行政などの取引先。仕訳の「業者」欄と業者元帳に使われます。', addLabel: '取引先を追加', fields: [{ key: 'code', label: 'コード', width: 90 }, { key: 'name', label: '取引先名' }, { key: 'kind', label: '種別', type: 'select', options: ['業者', '保護者', '行政', 'その他'], width: 100 }, { key: 'tel', label: '連絡先' }, { key: 'note', label: '備考' }], rows: VENDORS.filter((v) => v !== '（なし）').map((v, i) => ({ code: String(101 + i), name: v, kind: v === '保護者' ? '保護者' : v === '市役所' ? '行政' : '業者', tel: v === '保護者' ? '—' : `03-0000-00${10 + i}`, note: '' })) },
};

function MasterPage({ variant, accent, label }: { variant: 'form' | 'sheet'; accent: string; label: string }) {
  const cfg = MASTERS[label];
  const [rows, setRows] = useState<Row[]>(() => cfg.rows.map((r, i) => ({ ...r, _id: String(i + 1), _on: '1' })));
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Row | null>(null);
  const toast = useToast();
  const list = rows.filter((r) => !q || cfg.fields.some((f) => String(r[f.key] ?? '').includes(q)));
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
    <Shell variant={variant} title={cfg.title} desc={cfg.desc} actions={<>
      <button type="button" className="btn-outline" onClick={() => toast.show('CSV取込：' + NOT_IMPL)} style={btn()}>CSV取込</button>
      <button type="button" className="btn-outline" onClick={() => toast.show('CSV出力：' + NOT_IMPL)} style={btn()}>CSV出力</button>
      <button type="button" className="submit-btn" onClick={() => setEdit(blank())} style={btn(accent, true)}>＋ {cfg.addLabel}</button>
    </>}>
      <ToastView msg={toast.msg} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 22px', borderBottom: '1px solid #eef2f5' }}>
        <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="検索" autoComplete="off" style={{ ...input, width: 260 }} />
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8895a3' }}>{list.length} 件（無効 {rows.filter((r) => r._on !== '1').length}）</span>
      </div>
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 330px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{cfg.fields.map((f) => <th key={f.key} style={{ ...TH, width: f.width, textAlign: f.align ?? 'left' }}>{f.label}</th>)}<th style={{ ...TH, width: 70 }}>有効</th><th style={{ ...TH, width: 130, textAlign: 'right' }}>操作</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r._id} style={{ opacity: r._on === '1' ? 1 : 0.5 }}>
                {cfg.fields.map((f) => <td key={f.key} style={f.align === 'right' ? NUM : TD}>{f.type === 'color' ? <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 4, background: r[f.key], verticalAlign: 'middle' }} /> : f.type === 'number' && r[f.key] ? (f.key === 'rate' ? `${r[f.key]}%` : yen(Number(r[f.key]))) : r[f.key]}</td>)}
                <td style={TD}><span onClick={() => setRows((rs) => rs.map((x) => (x._id === r._id ? { ...x, _on: x._on === '1' ? '0' : '1' } : x)))} role="switch" aria-checked={r._on === '1'} style={{ display: 'inline-block', width: 34, height: 18, borderRadius: 9, background: r._on === '1' ? accent : '#cfd8e0', position: 'relative', cursor: 'pointer' }}><span style={{ position: 'absolute', top: 2, left: r._on === '1' ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} /></span></td>
                <td style={{ ...TD, textAlign: 'right' }}><div style={{ display: 'inline-flex', gap: 6 }}><button type="button" className="btn-outline" onClick={() => setEdit({ ...r })} style={{ ...btn(), padding: '4px 10px', fontSize: 11.5 }}>編集</button><button type="button" className="btn-outline" onClick={() => { if (confirm('削除しますか？')) setRows((rs) => rs.filter((x) => x._id !== r._id)); }} style={{ ...btn('#c0392b'), padding: '4px 10px', fontSize: 11.5 }}>削除</button></div></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={cfg.fields.length + 2} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 40 }}>該当するデータがありません。</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} width={560} title={edit?._id ? `${cfg.title}の編集` : cfg.addLabel}>
        {edit && (
          <div style={{ padding: '14px 22px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {cfg.fields.map((f) => (
              <div key={f.key} style={{ gridColumn: f.key === 'name' || f.key === 'tekiyo' || f.key === 'use' || f.key === 'note' ? 'span 2' : undefined }}>
                <span style={lbl}>{f.label}</span>
                {f.type === 'select' ? <select value={edit[f.key]} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} style={input}><option value="">選択</option>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
                  : f.type === 'color' ? <input type="color" value={edit[f.key] || '#2c5f9e'} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} style={{ width: 60, height: 36, border: '1px solid #cfd8e0', borderRadius: 8, padding: 2, background: '#fff' }} />
                  : <input className="field-input ring" value={edit[f.key] ?? ''} onChange={(e) => setEdit({ ...edit, [f.key]: f.type === 'number' ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value })} inputMode={f.type === 'number' ? 'decimal' : undefined} style={{ ...input, textAlign: f.align }} />}
              </div>
            ))}
            <label style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" checked={edit._on === '1'} onChange={() => setEdit({ ...edit, _on: edit._on === '1' ? '0' : '1' })} />有効（入力時の候補に表示する）</label>
            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={() => setEdit(null)} style={btn()}>キャンセル</button>
              <button type="button" className="submit-btn" onClick={save} style={btn(accent, true)}>保存</button>
            </div>
          </div>
        )}
      </Modal>
    </Shell>
  );
}

/* ---------------- 事業者 ---------------- */
function OrgPage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '社会福祉法人 チャイルド保育園', kana: 'シャカイフクシホウジン チャイルドホイクエン', no: '1234567890123', zip: '100-0001', addr: '東京都千代田区千代田1-1-1', tel: '03-0000-0000', rep: '園長 太郎', fyStart: '4月1日', fyEnd: '3月31日', std: '社会福祉法人会計基準（令和8年度）', rounding: '切り捨て', tax: '税込経理' });
  const [sites, setSites] = useState([{ code: '01', name: '本部', kind: '法人本部' }, { code: '02', name: 'チャイルド保育園', kind: '保育所' }]);
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });
  const card: CSSProperties = { border: '1px solid #e2e8ee', borderRadius: 12, overflow: 'hidden' };
  const h: CSSProperties = { padding: '10px 14px', background: '#f6f8fa', fontSize: 12.5, fontWeight: 700, borderBottom: '1px solid #eef2f5' };
  return (
    <Shell variant={variant} title="事業者" desc="法人の基本情報・会計期間・拠点区分／サービス区分を管理します。" actions={<button type="button" className="submit-btn" onClick={() => toast.show('事業者情報を保存しました（プロトタイプ）')} style={btn(accent, true)}>保存</button>}>
      <ToastView msg={toast.msg} />
      <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 18, alignItems: 'start' }}>
        <div style={card}>
          <div style={h}>法人情報</div>
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: 'span 2' }}><span style={lbl}>法人名</span><input className="field-input ring" value={f.name} onChange={(e) => set('name', e.target.value)} style={input} /></div>
            <div style={{ gridColumn: 'span 2' }}><span style={lbl}>法人名（カナ）</span><input className="field-input ring" value={f.kana} onChange={(e) => set('kana', e.target.value)} style={input} /></div>
            <div><span style={lbl}>法人番号</span><input className="field-input ring" value={f.no} onChange={(e) => set('no', e.target.value)} style={input} /></div>
            <div><span style={lbl}>代表者</span><input className="field-input ring" value={f.rep} onChange={(e) => set('rep', e.target.value)} style={input} /></div>
            <div><span style={lbl}>郵便番号</span><input className="field-input ring" value={f.zip} onChange={(e) => set('zip', e.target.value)} style={input} /></div>
            <div><span style={lbl}>電話番号</span><input className="field-input ring" value={f.tel} onChange={(e) => set('tel', e.target.value)} style={input} /></div>
            <div style={{ gridColumn: 'span 2' }}><span style={lbl}>所在地</span><input className="field-input ring" value={f.addr} onChange={(e) => set('addr', e.target.value)} style={input} /></div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={card}>
            <div style={h}>会計期間・会計方針</div>
            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><span style={lbl}>期首</span><input className="field-input" value={f.fyStart} onChange={(e) => set('fyStart', e.target.value)} style={input} /></div>
              <div><span style={lbl}>期末</span><input className="field-input" value={f.fyEnd} onChange={(e) => set('fyEnd', e.target.value)} style={input} /></div>
              <div style={{ gridColumn: 'span 2' }}><span style={lbl}>適用する会計基準</span><select value={f.std} onChange={(e) => set('std', e.target.value)} style={input}><option>社会福祉法人会計基準（令和8年度）</option><option>社会福祉法人会計基準（令和7年度）</option></select></div>
              <div><span style={lbl}>端数処理</span><select value={f.rounding} onChange={(e) => set('rounding', e.target.value)} style={input}>{['切り捨て', '四捨五入', '切り上げ'].map((o) => <option key={o}>{o}</option>)}</select></div>
              <div><span style={lbl}>消費税の経理方式</span><select value={f.tax} onChange={(e) => set('tax', e.target.value)} style={input}>{['税込経理', '税抜経理'].map((o) => <option key={o}>{o}</option>)}</select></div>
            </div>
          </div>
          <div style={card}>
            <div style={{ ...h, display: 'flex', alignItems: 'center' }}>拠点区分 <button type="button" className="btn-outline" onClick={() => setSites([...sites, { code: String(sites.length + 1).padStart(2, '0'), name: '', kind: '保育所' }])} style={{ ...btn(), marginLeft: 'auto', padding: '4px 10px', fontSize: 11.5 }}>＋ 追加</button></div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ ...TH, width: 70 }}>コード</th><th style={TH}>拠点名</th><th style={{ ...TH, width: 140 }}>種別</th><th style={{ ...TH, width: 60 }} /></tr></thead>
              <tbody>{sites.map((s, i) => <tr key={i}><td style={TD}>{s.code}</td><td style={TD}><input className="field-input" value={s.name} onChange={(e) => setSites(sites.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} placeholder="拠点名" style={{ ...input, padding: '5px 8px' }} /></td><td style={TD}><select value={s.kind} onChange={(e) => setSites(sites.map((x, k) => (k === i ? { ...x, kind: e.target.value } : x)))} style={{ ...input, padding: '5px 8px' }}>{['法人本部', '保育所', '認定こども園', '子育て支援', 'その他'].map((o) => <option key={o}>{o}</option>)}</select></td><td style={TD}><button type="button" className="btn-outline" onClick={() => setSites(sites.filter((_, k) => k !== i))} style={{ ...btn('#c0392b'), padding: '3px 8px', fontSize: 11 }}>削除</button></td></tr>)}</tbody>
            </table>
            <div style={{ padding: '8px 14px', fontSize: 11.5, color: '#9aa5b1' }}>サービス区分は「部門」で管理します。</div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/* ---------------- 開始残高 ---------------- */
function OpeningBalancePage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  const toast = useToast();
  const SITES = ['本部', 'チャイルド保育園'];
  const ITEMS: { name: string; side: '借方' | '貸方'; v: number[] }[] = [
    { name: '小口現金', side: '借方', v: [0, 26500] }, { name: '普通預金（本部）', side: '借方', v: [14800, 0] }, { name: '普通預金（保育園）', side: '借方', v: [0, 9630000] }, { name: '当座預金（保育園）', side: '借方', v: [0, 155800] }, { name: '事業未収金', side: '借方', v: [0, 1200000] }, { name: '土地', side: '借方', v: [0, 22000000] }, { name: '建物', side: '借方', v: [0, 15400000] }, { name: '器具及び備品', side: '借方', v: [0, 1800000] },
    { name: '事業未払金', side: '貸方', v: [0, 400000] }, { name: '職員預り金', side: '貸方', v: [0, 250000] }, { name: '賞与引当金', side: '貸方', v: [0, 1500000] }, { name: '基本金', side: '貸方', v: [0, 25800000] }, { name: '国庫補助金等特別積立金', side: '貸方', v: [0, 9600000] }, { name: '次期繰越活動増減差額', side: '貸方', v: [14800, 12662300] },
  ];
  const [vals, setVals] = useState(ITEMS.map((i) => [...i.v]));
  const [site, setSite] = useState(0);
  const sum = (side: '借方' | '貸方') => ITEMS.reduce((s, it, i) => s + (it.side === side ? vals[i][site] : 0), 0);
  const d = sum('借方'), c = sum('貸方');
  const ok = d === c;
  const set = (i: number, v: string) => setVals((vs) => vs.map((row, k) => (k === i ? row.map((x, s) => (s === site ? parseInt(v.replace(/[^0-9]/g, ''), 10) || 0 : x)) : row)));
  return (
    <Shell variant={variant} title="開始残高" desc="運用開始時点（期首）の貸借残高を拠点ごとに登録します。借方合計と貸方合計が一致すると確定できます。" actions={<>
      <button type="button" className="btn-outline" onClick={() => toast.show('前年度決算から取込：' + NOT_IMPL)} style={btn()}>前年度決算から取込</button>
      <button type="button" className="submit-btn" disabled={!ok} onClick={() => toast.show('開始残高を確定しました（プロトタイプ）')} style={{ ...btn(accent, true), opacity: ok ? 1 : 0.5 }}>確定</button>
    </>}>
      <ToastView msg={toast.msg} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 22px', borderBottom: '1px solid #eef2f5', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#8290a0' }}>拠点</span>
        {SITES.map((s, i) => <button key={s} type="button" className="chip" onClick={() => setSite(i)} style={{ padding: '5px 14px', borderRadius: 14, border: '1px solid ' + (site === i ? accent : '#d3dbe3'), background: site === i ? accent : '#fff', color: site === i ? '#fff' : '#5b6773', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{s}</button>)}
        <span style={{ marginLeft: 'auto', fontSize: 12.5, padding: '4px 12px', borderRadius: 10, background: ok ? '#eaf5ef' : '#fdeee9', color: ok ? '#1f7a52' : '#c0392b', fontWeight: 700 }}>{ok ? '貸借一致' : `差額 ${yen(Math.abs(d - c))}（${d > c ? '借方' : '貸方'}が多い）`}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        {(['借方', '貸方'] as const).map((side) => (
          <div key={side} style={{ borderRight: side === '借方' ? '1px solid #eef2f5' : 'none' }}>
            <div style={{ padding: '9px 18px', background: side === '借方' ? '#eaf2fb' : '#fdeef3', color: side === '借方' ? '#2c5f9e' : '#b0426a', fontSize: 12.5, fontWeight: 700 }}>{side}（{side === '借方' ? '資産' : '負債・純資産'}）</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {ITEMS.map((it, i) => it.side === side && (
                  <tr key={it.name}><td style={TD}>{it.name}</td><td style={{ ...NUM, width: 180 }}><input className="field-input ring" value={yen(vals[i][site])} onChange={(e) => set(i, e.target.value)} inputMode="numeric" style={{ ...input, textAlign: 'right', padding: '5px 8px', fontVariantNumeric: 'tabular-nums' }} /></td></tr>
                ))}
                <tr style={{ background: '#f3f6f9' }}><td style={{ ...TD, fontWeight: 700 }}>合計</td><td style={{ ...NUM, fontWeight: 700, fontSize: 14 }}>{yen(sum(side))}</td></tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 22px 16px', fontSize: 11.5, color: '#9aa5b1' }}>※ 科目は主要なもののみ表示しています（叩き台）。確定後は前年仕訳の「繰越」として各元帳に反映されます。</div>
    </Shell>
  );
}

/* ---------------- 他社ソフトデータの移行 ---------------- */
function MigrationPage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [soft, setSoft] = useState('');
  const [file, setFile] = useState('');
  const SOFTS = ['既存システム（Chappy）', '弥生会計', '勘定奉行', 'freee会計', 'マネーフォワード クラウド会計', 'PCA会計', 'その他（CSV）'];
  const MAP = [['取引日', 'date', '伝票日付'], ['借方科目', 'kari', '借方勘定科目'], ['貸方科目', 'kashi', '貸方勘定科目'], ['摘要', 'tekiyo', '摘要'], ['金額', 'amount', '金額'], ['部門', 'dept', 'サービス区分'], ['取引先', 'vendor', '業者']];
  const steps = ['移行元の選択', 'ファイルの取込', '項目の対応づけ', '確認・実行'];
  const card: CSSProperties = { border: '1px solid #e2e8ee', borderRadius: 12, padding: 18 };
  return (
    <Shell variant={variant} title="他社ソフトデータの移行" desc="他の会計ソフトや既存システムから、仕訳・マスタ・開始残高を取り込みます。">
      <ToastView msg={toast.msg} />
      <div style={{ display: 'flex', gap: 0, padding: '16px 22px 0' }}>
        {steps.map((s, i) => (
          <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: i <= step ? accent : '#e2e8ee', color: i <= step ? '#fff' : '#8290a0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{i + 1}</span>
            <span style={{ fontSize: 12.5, fontWeight: i === step ? 700 : 500, color: i === step ? '#22303c' : '#7a8794' }}>{s}</span>
            {i < steps.length - 1 && <span style={{ flex: 1, height: 2, background: i < step ? accent : '#e2e8ee', margin: '0 10px' }} />}
          </div>
        ))}
      </div>
      <div style={{ padding: 22 }}>
        {step === 0 && (
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>移行元のソフトを選んでください</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {SOFTS.map((s) => <button key={s} type="button" className="btn-outline" onClick={() => setSoft(s)} style={{ ...btn(soft === s ? accent : '#22303c', soft === s), padding: '14px 12px', textAlign: 'left' }}>{s}</button>)}
            </div>
            <div style={{ fontSize: 12, color: '#7a8794', marginTop: 12 }}>移行できるデータ：仕訳（当年・前年）／勘定科目／取引先／摘要辞書／開始残高</div>
          </div>
        )}
        {step === 1 && (
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{soft} からエクスポートしたファイルを取り込みます</div>
            <div onClick={() => setFile('shiwake_2026.csv（1,248行）')} style={{ border: '2px dashed #cfd8e0', borderRadius: 12, padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: file ? '#eaf5ef' : '#fbfcfd' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{file || 'ここにファイルをドロップ、またはクリックして選択'}</div>
              <div style={{ fontSize: 12, color: '#7a8794', marginTop: 6 }}>CSV／Excel（xlsx）・文字コードは自動判定・最大50MB</div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>取り込んだ列を、このシステムの項目に対応づけます（自動判定済み・必要なら変更）</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={TH}>ファイルの列</th><th style={TH}>サンプル値</th><th style={TH}>このシステムの項目</th><th style={TH}>状態</th></tr></thead>
              <tbody>{MAP.map(([col, , to], i) => <tr key={col}><td style={{ ...TD, fontWeight: 600 }}>{col}</td><td style={{ ...TD, color: '#7a8794' }}>{['2026/08/01', '法定福利費', '普通預金（保育園）', '健康保険・厚生年金', '670,361', '002', '—'][i]}</td><td style={TD}><select defaultValue={to} style={{ ...input, padding: '5px 8px' }}>{['伝票日付', '借方勘定科目', '貸方勘定科目', '摘要', '金額', 'サービス区分', '業者', '（取り込まない）'].map((o) => <option key={o}>{o}</option>)}</select></td><td style={TD}><span style={{ fontSize: 11, fontWeight: 700, color: '#1f7a52' }}>自動判定</span></td></tr>)}</tbody>
            </table>
            <div style={{ fontSize: 12, color: '#7a8794', marginTop: 10 }}>科目名が一致しないものは次のステップで「勘定科目の変換表」として確認できます。</div>
          </div>
        )}
        {step === 3 && (
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>取り込み内容の確認</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 10, marginBottom: 12 }}>
              {[['取込対象', '1,248 仕訳'], ['期間', '令和8年 4月〜8月'], ['科目の未対応', '3 件（要確認）'], ['取引先の新規', '12 件（自動登録）']].map(([l, v]) => <div key={l} style={{ padding: '10px 12px', border: '1px solid #e2e8ee', borderRadius: 10, background: '#fbfcfd' }}><div style={{ fontSize: 10.5, color: '#8290a0', fontWeight: 700 }}>{l}</div><div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{v}</div></div>)}
            </div>
            <div style={{ padding: '10px 12px', background: '#fff7e6', border: '1px solid #f3d9b0', borderRadius: 10, fontSize: 12.5, color: '#8a5a00' }}>未対応の科目：「福利厚生費（旧）」「事務用消耗品費」「雑収入」→ 変換先の科目を指定してください（未指定は「諸口」として取り込みます）。</div>
            <div style={{ fontSize: 12, color: '#7a8794', marginTop: 10 }}>取り込みは元に戻せます（「取込履歴」から一括削除）。</div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)} style={{ ...btn(), opacity: step === 0 ? 0.4 : 1 }}>戻る</button>
          {step < 3 ? (
            <button type="button" className="submit-btn" disabled={(step === 0 && !soft) || (step === 1 && !file)} onClick={() => setStep((s) => s + 1)} style={{ ...btn(accent, true), opacity: (step === 0 && !soft) || (step === 1 && !file) ? 0.5 : 1 }}>次へ</button>
          ) : (
            <button type="button" className="submit-btn" onClick={() => { toast.show('取り込みを実行しました（プロトタイプ：データは変更されません）'); setStep(0); setSoft(''); setFile(''); }} style={btn(accent, true)}>取り込みを実行</button>
          )}
        </div>
      </div>
    </Shell>
  );
}

/* ---------------- 振り分け ---------------- */
export function renderSettingsPage(label: string, variant: 'form' | 'sheet', accent: string) {
  if (label === '事業者') return <OrgPage variant={variant} accent={accent} />;
  if (label === '開始残高') return <OpeningBalancePage variant={variant} accent={accent} />;
  if (label === '他社ソフトデータの移行') return <MigrationPage variant={variant} accent={accent} />;
  if (MASTERS[label]) return <MasterPage key={label} variant={variant} accent={accent} label={label} />;
  return null;
}
