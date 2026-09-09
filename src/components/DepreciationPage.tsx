// オプション：減価償却（既存「Chappy24 減価償却オプションシステム」の再現）
//   トップ（機能メニュー＋固定資産／備品一覧）から各機能へ：
//   固定資産 新規登録・変更／備品 新規登録・変更／一括処理（除却・売却・移管）／決算機能（伝票一覧→伝票作成→決算処理）
//   全項目手入力／移管（先）取込み／固定資産・備品データ削除／帳票印刷／動作環境設定／操作ログ
//   値はサンプル。定額法の年間償却額＝（取得価額－残存価額）÷耐用年数 で自動計算。

import { Fragment, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { NUM, TD, TH } from './ReportShell';
import { NOT_IMPL, ToastView, useToast } from './Toast';

const OPTION = '#b45309';
const yen = (n: number) => n.toLocaleString('ja-JP');
type View = 'top' | 'asset' | 'equip' | 'batch' | 'closing' | 'transfer' | 'delete';

interface Asset { code: string; name: string; account: string; acquired: string; life: number; cost: number; status: '償却中' | '償却終了' | '対象外'; opening: number; subsidy: number; method: string; qty: number }
const ASSETS: Asset[] = [
  { code: '00001', name: '園舎', account: '建物　－基本財産－', acquired: '昭和54年 4月 1日', life: 47, cost: 27580000, status: '償却中', opening: 4349772, subsidy: 2934626, method: '定額法', qty: 1 },
  { code: '00002', name: '哺乳びん殺菌乾燥保管庫', account: '器具及び備品', acquired: '平成30年 2月 5日', life: 5, cost: 203040, status: '償却終了', opening: 33840, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00003', name: '調理室エアコン', account: '器具及び備品', acquired: '平成30年 3月31日', life: 6, cost: 467000, status: '償却中', opening: 148545, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00004', name: '事務室エアコン', account: '器具及び備品', acquired: '平成30年 3月31日', life: 6, cost: 548200, status: '償却中', opening: 174375, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00005', name: '木製下駄箱', account: '器具及び備品', acquired: '平成30年10月 5日', life: 8, cost: 155000, status: '償却中', opening: 87188, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00006', name: 'うんてい', account: '構築物', acquired: '平成31年 3月31日', life: 5, cost: 432000, status: '償却中', opening: 165600, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00007', name: '門扉', account: '構築物', acquired: '平成31年 3月 6日', life: 10, cost: 342360, status: '償却中', opening: 236799, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00008', name: 'フェンス', account: '構築物', acquired: '平成31年 3月31日', life: 10, cost: 529200, status: '償却中', opening: 366030, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00028', name: '立看板', account: '構築物', acquired: '平成15年 5月 1日', life: 15, cost: 147000, status: '償却中', opening: 5880, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00030', name: '未満児用ソフト滑り台', account: '器具及び備品', acquired: '平成17年 3月25日', life: 5, cost: 120000, status: '償却終了', opening: 1, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00032', name: '給湯器', account: '器具及び備品', acquired: '平成18年 1月 8日', life: 6, cost: 231000, status: '償却終了', opening: 1, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00039', name: '防犯用　街灯設置', account: '構築物', acquired: '平成20年 3月31日', life: 10, cost: 247800, status: '償却終了', opening: 4956, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00040', name: 'ミニパトカー', account: '器具及び備品', acquired: '平成22年 3月 5日', life: 8, cost: 350000, status: '償却終了', opening: 7000, subsidy: 0, method: '定額法', qty: 1 },
  { code: '10001', name: '砂場', account: '構築物', acquired: '昭和54年 2月 1日', life: 10, cost: 200000, status: '償却終了', opening: 1, subsidy: 0, method: '定額法', qty: 1 },
  { code: '10004', name: '土地', account: '土地　－基本財産－', acquired: '昭和54年 4月 1日', life: 0, cost: 5803427, status: '対象外', opening: 5803427, subsidy: 0, method: '非償却', qty: 1 },
  { code: '20002', name: 'ピアノ', account: '器具及び備品', acquired: '昭和55年 2月 1日', life: 5, cost: 383000, status: '償却終了', opening: 1, subsidy: 0, method: '定額法', qty: 1 },
];
interface Equip { code: string; name: string; acquired: string; cost: number }
const EQUIPS: Equip[] = [
  { code: '00001', name: 'ノートパソコン（事務室）', acquired: '令和6年 4月10日', cost: 98000 },
  { code: '00002', name: '掃除機', acquired: '令和7年 6月 2日', cost: 32800 },
];
interface Voucher { name: string; date: string; format: string; proc: string }
const PRINT_REPORTS = ['基本財産及びその他の固定資産（有形・無形固定資産）の明細書', '固定資産管理台帳(新会計版)', '固定資産管理台帳', '個別固定資産管理台帳', '当期変更情報一覧表', '固定資産タックシール', '備品一覧表（1）', '備品一覧表（2）', '固定資産管理台帳（施設設備管理用）', '取得固定資産一覧表', '除却固定資産一覧表', '移管(元)固定資産一覧表', '移管(先)固定資産一覧表', '売却固定資産一覧表'];
const LOGS = ASSETS.map((a) => `2026/07/13 16:02:16 [${Number(a.code)}:${a.name}] C24へコンバート`);

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  onNavigate: (label: string) => void;
}

export function DepreciationPage({ variant, accent, onNavigate }: Props) {
  const [view, setView] = useState<View>('top');
  const [assets, setAssets] = useState<Asset[]>(ASSETS);
  const [equips, setEquips] = useState<Equip[]>(EQUIPS);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [manual, setManual] = useState(false);
  const [listTab, setListTab] = useState<'asset' | 'equip'>('asset');
  const [q, setQ] = useState('');
  const [printOpen, setPrintOpen] = useState(false);
  const [envOpen, setEnvOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const toast = useToast();
  const isSheet = variant === 'sheet';

  const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '8px 16px', borderRadius: 8, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#fff', color: solid ? '#fff' : color, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' });
  const card: CSSProperties = { background: '#fff', border: '1px solid #dde4ea', borderRadius: 14, boxShadow: '0 6px 26px rgba(30,50,70,.06)', overflow: 'hidden' };
  const listRows = assets.filter((a) => !q || a.name.includes(q) || a.code.includes(q));
  const openAsset = (a: Asset | null, isManual = false) => { setEditing(a); setManual(isManual); setView('asset'); };

  const header = (title: string, back = true) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px 12px', borderBottom: '1px solid #eef2f5', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: isSheet ? 17 : 20 }}>
          {title}
          <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: OPTION, borderRadius: 5, padding: '2px 6px', verticalAlign: 'middle', marginLeft: 8 }}>オプション</span>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>減価償却オプションシステム　社会福祉法人 チャイルド保育園　区分：チャイルド保育園</span>
        </div>
        <div style={{ fontSize: 12, color: '#7a8794', marginTop: 3 }}>現在処理中の年度：令和8年度（2026年）</div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        {back && <button type="button" className="btn-outline" onClick={() => setView('top')} style={btn()}>トップへ戻る</button>}
        {!back && <button type="button" className="btn-outline" onClick={() => onNavigate('ホーム')} style={btn()}>終了</button>}
      </div>
    </div>
  );

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <ToastView msg={toast.msg} />
      <div style={{ width: '100%', maxWidth: isSheet ? 'none' : 1320, ...card, display: 'flex', flexDirection: 'column' }}>
        {view === 'top' && (
          <>
            {header('減価償却', false)}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)', gap: 0 }}>
              {/* 機能メニュー */}
              <div style={{ padding: 22, borderRight: '1px solid #eef2f5', background: 'linear-gradient(135deg,#fff8e6,#fff)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}>
                  {[
                    { top: '固定資産', label: '新規登録\n変更', color: '#e8791e', fn: () => openAsset(null) },
                    { top: '一括処理', label: '除却／売却\n移管', color: '#2c8fd6', fn: () => setView('batch') },
                    { top: '', label: '帳票印刷', color: '#1f9a4e', fn: () => setPrintOpen(true) },
                  ].map((c) => (
                    <button key={c.label} type="button" className="btn-outline" onClick={c.fn} style={{ aspectRatio: '1', borderRadius: '50%', border: `4px solid ${c.color}`, background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,.08)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      {c.top && <span style={{ fontSize: 11.5, fontWeight: 800, color: c.color, letterSpacing: '.2em' }}>{c.top}</span>}
                      <span style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'pre-line', lineHeight: 1.3, color: '#22303c' }}>{c.label}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { tag: '備品', label: '新規登録・変更', fn: () => setView('equip') },
                    { tag: '', label: '', fn: () => {} },
                    { tag: '', label: '動作環境設定', fn: () => setEnvOpen(true) },
                    { tag: '', label: '決算機能', fn: () => setView('closing') },
                    { tag: '', label: '移管（先）取込み', fn: () => setView('transfer') },
                    { tag: '', label: '', fn: () => {} },
                    { tag: '固定資産', label: '全項目手入力', fn: () => openAsset(null, true) },
                    { tag: '', label: '固定資産／備品\nデータ削除', fn: () => setView('delete') },
                    { tag: '', label: '操作ログ', fn: () => setLogOpen(true) },
                  ].map((b, i) => b.label ? (
                    <button key={i} type="button" className="btn-outline" onClick={b.fn} style={{ padding: '12px 10px', borderRadius: 10, border: '1px solid #dde4ea', borderTop: '3px solid #d9534f', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', fontSize: 13.5, fontWeight: 800, whiteSpace: 'pre-line', lineHeight: 1.35, color: '#22303c', position: 'relative' }}>
                      {b.tag && <span style={{ position: 'absolute', left: 8, top: 8, fontSize: 9.5, color: '#d9534f', fontWeight: 800, writingMode: 'vertical-rl' }}>{b.tag}</span>}
                      {b.label}
                    </button>
                  ) : <div key={i} />)}
                </div>
              </div>
              {/* 一覧 */}
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid #eef2f5' }}>
                  {(['asset', 'equip'] as const).map((t) => <button key={t} type="button" className="chip" onClick={() => setListTab(t)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid ' + (listTab === t ? accent : '#d3dbe3'), background: listTab === t ? accent : '#fff', color: listTab === t ? '#fff' : '#5b6773', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{t === 'asset' ? '固定資産一覧' : '備品一覧'}</button>)}
                  <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="検索（名称・コード）" autoComplete="off" style={{ marginLeft: 'auto', width: 220, padding: '7px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
                </div>
                <div style={{ overflow: 'auto', maxHeight: 520 }}>
                  {listTab === 'asset' ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><th style={TH}>償却状態</th><th style={TH}>資産コード</th><th style={TH}>固定資産名称</th><th style={TH}>取得年月日</th><th style={{ ...TH, textAlign: 'right' }}>取得価額</th></tr></thead>
                      <tbody>
                        {listRows.map((a) => (
                          <tr key={a.code} onClick={() => openAsset(a)} style={{ cursor: 'pointer' }} className="menu-sub">
                            <td style={TD}><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: a.status === '償却中' ? '#eaf5ef' : a.status === '対象外' ? '#f1f4f6' : '#fff1b8', color: a.status === '償却中' ? '#1f7a52' : a.status === '対象外' ? '#7a8794' : '#8a6d00' }}>{a.status}</span></td>
                            <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{a.code}</td><td style={{ ...TD, fontWeight: 500 }}>{a.name}</td><td style={TD}>{a.acquired}</td><td style={NUM}>{yen(a.cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><th style={TH}>備品コード</th><th style={TH}>備品名称</th><th style={TH}>取得年月日</th><th style={{ ...TH, textAlign: 'right' }}>取得価額</th></tr></thead>
                      <tbody>
                        {equips.filter((e) => !q || e.name.includes(q)).map((e) => <tr key={e.code} onClick={() => setView('equip')} style={{ cursor: 'pointer' }} className="menu-sub"><td style={TD}>{e.code}</td><td style={{ ...TD, fontWeight: 500 }}>{e.name}</td><td style={TD}>{e.acquired}</td><td style={NUM}>{yen(e.cost)}</td></tr>)}
                        {equips.length === 0 && <tr><td colSpan={4} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 30 }}>備品は登録されていません。</td></tr>}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {view === 'asset' && <>{header(manual ? '固定資産　全項目手入力' : '固定資産登録')}<AssetForm accent={accent} asset={editing} manual={manual} onSave={(a) => { setAssets((as) => (as.some((x) => x.code === a.code) ? as.map((x) => (x.code === a.code ? a : x)) : [...as, a])); setView('top'); toast.show(`固定資産「${a.name}」を登録しました`); }} onCancel={() => setView('top')} toast={toast.show} /></>}
        {view === 'equip' && <>{header('備品登録')}<EquipForm accent={accent} equips={equips} onSave={(e) => { setEquips((es) => [...es, e]); toast.show(`備品「${e.name}」を登録しました`); }} onCancel={() => setView('top')} toast={toast.show} /></>}
        {view === 'batch' && <>{header('除却・売却・移管(元) 一括処理／移管ファイル出力')}<BatchView accent={accent} assets={assets} onDone={(n) => { setView('top'); toast.show(`${n} 件の処理を登録しました`); }} toast={toast.show} /></>}
        {view === 'closing' && <>{header('決算機能')}<ClosingView accent={accent} vouchers={vouchers} setVouchers={setVouchers} onExit={() => setView('top')} toast={toast.show} /></>}
        {view === 'transfer' && <>{header('固定資産　移管ファイル取り込み')}<TransferView accent={accent} onRegister={(n) => { setView('top'); toast.show(`移管資産 ${n} 件を登録しました`); }} toast={toast.show} /></>}
        {view === 'delete' && <>{header('固定資産／備品 データ削除')}<DeleteView accent={accent} assets={assets} equips={equips} onDelete={(codes, kind) => { if (kind === 'asset') setAssets((as) => as.filter((a) => !codes.has(a.code))); else setEquips((es) => es.filter((e) => !codes.has(e.code))); toast.show(`${codes.size} 件を削除しました`); }} onExit={() => setView('top')} /></>}
      </div>

      {/* 帳票印刷 */}
      <Modal open={printOpen} onClose={() => setPrintOpen(false)} width={900} title="印刷選択画面">
        <div style={{ padding: '14px 22px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {PRINT_REPORTS.map((r) => <button key={r} type="button" className="btn-outline" onClick={() => { setPrintOpen(false); toast.show(`${r}：${NOT_IMPL}`); }} style={{ padding: '14px 12px', borderRadius: 10, border: '1px solid #cfd8e0', background: '#eef0fa', color: '#22303c', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', lineHeight: 1.4 }}>{r}</button>)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><button type="button" onClick={() => setPrintOpen(false)} style={btn()}>閉じる</button></div>
        </div>
      </Modal>

      {/* 動作環境設定 */}
      <Modal open={envOpen} onClose={() => setEnvOpen(false)} width={860} title="動作環境設定画面">
        <EnvSettings accent={accent} onClose={() => setEnvOpen(false)} toast={toast.show} />
      </Modal>

      {/* 操作ログ */}
      <Modal open={logOpen} onClose={() => setLogOpen(false)} width={760} title="操作ログ">
        <div style={{ padding: '12px 22px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12.5 }}>年度選択</span>
            <select style={{ padding: '6px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontFamily: 'inherit', fontSize: 12.5 }}><option>令和 08年度（2026年）</option><option>令和 07年度（2025年）</option></select>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>{['資産', 'システム'].map((t, i) => <span key={t} style={{ padding: '4px 12px', borderRadius: 7, background: i === 0 ? accent : '#f1f4f6', color: i === 0 ? '#fff' : '#5b6773', fontSize: 12, fontWeight: 700 }}>{t}</span>)}</span>
          </div>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, background: '#f4f9ff', padding: '8px 12px', maxHeight: 360, overflow: 'auto', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: '#1f3a8a', lineHeight: 1.7 }}>
            {LOGS.map((l, i) => <div key={i}>{l}</div>)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}><button type="button" onClick={() => setLogOpen(false)} style={btn()}>閉じる</button></div>
        </div>
      </Modal>
    </main>
  );
}

/* ================= 固定資産登録 ================= */
function AssetForm({ accent, asset, manual, onSave, onCancel, toast }: { accent: string; asset: Asset | null; manual: boolean; onSave: (a: Asset) => void; onCancel: () => void; toast: (m: string) => void }) {
  const [f, setF] = useState({
    code: asset?.code ?? String(ASSETS.length + 1).padStart(5, '0'),
    sort: '土地',
    account: asset?.account ?? '器具及び備品',
    name: asset?.name ?? '',
    acquired: asset?.acquired ?? '令和8年 4月 1日',
    life: asset ? String(asset.life) : '',
    method: asset?.method ?? '定額法',
    qty: asset ? String(asset.qty) : '1',
    unit: asset ? String(asset.cost) : '',
    memo: '1',
    residual: '0',
    subsidy: asset ? String(asset.subsidy) : '0',
    disposal: '設定なし',
    place: '',
    purpose: '',
    afterLife: true,
    useStart: false,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const num = (s: string) => parseInt(String(s).replace(/[^0-9]/g, ''), 10) || 0;
  const cost = num(f.qty) * num(f.unit);
  const life = num(f.life);
  const rate = life ? Math.round((1 / life) * 1000) / 1000 : 0;
  const annual = life && f.method === '定額法' ? Math.floor((cost - num(f.residual) - num(f.memo)) / life) : 0;
  const opening = asset?.opening ?? cost;
  const c = Math.min(annual, Math.max(0, opening - num(f.memo)));
  const [manualVals, setManualVals] = useState({ A: opening, B: 0, C: c, D: 0 });
  const A = manual ? manualVals.A : opening;
  const B = manual ? manualVals.B : asset ? 0 : cost;
  const C = manual ? manualVals.C : asset ? c : 0;
  const D = manual ? manualVals.D : 0;
  const E = A + B - C - D;
  const F = cost - E;
  const G = E + F;
  const sub = num(f.subsidy);
  const subC = cost ? Math.floor((C * sub) / cost) : 0;

  const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '6px 9px', border: '1px solid #cfd8e0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' };
  const numIn: CSSProperties = { ...input, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  const lbl: CSSProperties = { fontSize: 11, fontWeight: 700, color: '#8290a0', marginBottom: 4, display: 'block' };
  const sec = (t: string): CSSProperties => ({ fontSize: 11.5, fontWeight: 800, color: '#b7791f', background: '#fff7dc', display: 'inline-block', padding: '2px 8px', borderRadius: 6, marginBottom: 8, ...(t ? {} : {}) });
  const box: CSSProperties = { border: '1px solid #f0c8cc', background: '#fff5f6', borderRadius: 10, padding: 12 };
  const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '7px 12px', borderRadius: 7, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#fff', color: solid ? '#fff' : color, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' });
  const save = () => {
    if (!f.name.trim()) return toast('資産名称を入力してください');
    if (!cost) return toast('取得価額（数量×単価）を入力してください');
    if (f.method !== '非償却' && !life) return toast('耐用年数を入力してください');
    onSave({ code: f.code, name: f.name.trim(), account: f.account, acquired: f.acquired, life, cost, status: life ? '償却中' : '対象外', opening: E, subsidy: sub, method: f.method, qty: num(f.qty) });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(300px,1fr)', gap: 0 }}>
      <div style={{ padding: 18, borderRight: '1px solid #eef2f5', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {manual && <div style={{ padding: '8px 12px', background: '#fff1b8', borderRadius: 8, fontSize: 12.5, color: '#8a6d00', fontWeight: 700 }}>全項目手入力：自動計算を行わず、期首帳簿価額・当期増加額・当期減価償却額・当期減少額を直接入力します。</div>}
        <div style={box}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div><span style={lbl}>資産コード</span><input className="field-input" value={f.code} onChange={(e) => set('code', e.target.value)} style={{ ...input, background: '#fff9c4', fontWeight: 700 }} /></div>
            <div><span style={lbl}>並び順項目</span><select value={f.sort} onChange={(e) => set('sort', e.target.value)} style={input}>{['土地', '建物', '構築物', '器具及び備品', 'ソフトウェア'].map((o) => <option key={o}>{o}</option>)}</select></div>
            <div><span style={lbl}>科目</span><select value={f.account} onChange={(e) => set('account', e.target.value)} style={input}>{['土地　－基本財産－', '建物　－基本財産－', '建物　－その他－', '構築物', '器具及び備品', 'ソフトウェア'].map((o) => <option key={o}>{o}</option>)}</select></div>
            <div style={{ gridColumn: 'span 2' }}><span style={lbl}>資産名称</span><input className="field-input ring" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="例：調理室エアコン" style={input} /></div>
            <div><span style={lbl}>取得年月日</span><input className="field-input" value={f.acquired} onChange={(e) => set('acquired', e.target.value)} style={input} /></div>
            <div style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'center', gap: 14, fontSize: 12.5 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={f.useStart} onChange={() => set('useStart', !f.useStart)} />償却開始年月日を使用する</label>
              <span style={{ color: '#9aa5b1' }}>（償却開始年月日：{f.useStart ? '入力可' : '取得年月日と同じ'}）</span>
            </div>
            <div><span style={lbl}>耐用年数</span><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input className="field-input" value={f.life} onChange={(e) => set('life', e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" style={{ ...numIn, width: 70 }} /><span style={{ fontSize: 12 }}>年</span><button type="button" className="btn-outline" onClick={() => toast('耐用年数辞書：' + NOT_IMPL)} style={btn()}>辞書</button></div></div>
            <div><span style={lbl}>償却方法</span><select value={f.method} onChange={(e) => set('method', e.target.value)} style={input}>{['定額法', '旧定額法', 'リース定額法', '非償却'].map((o) => <option key={o}>{o}</option>)}</select></div>
            <div><span style={lbl}>償却率</span><div style={{ ...input, background: '#f5f7f9', textAlign: 'right' }}>{f.method} {life}年　<b>{rate}</b></div></div>
            <div style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'center', gap: 14, fontSize: 12.5 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={f.afterLife} onChange={() => set('afterLife', !f.afterLife)} />耐用年数経過後も償却する</label>
              <button type="button" className="btn-outline" onClick={() => toast('端数処理設定：' + NOT_IMPL)} style={btn()}>端数処理設定</button>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" />移管先固定資産として新規登録</label>
            </div>
            <div style={{ gridColumn: 'span 2' }}><span style={lbl}>場所・物量等</span><input className="field-input" value={f.place} onChange={(e) => set('place', e.target.value)} style={input} /></div>
            <div><span style={lbl}>使用目的</span><input className="field-input" value={f.purpose} onChange={(e) => set('purpose', e.target.value)} style={input} /></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={box}>
            <span style={sec('取得価額')}>取得価額</span>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 20px 1fr', gap: 6, alignItems: 'end' }}>
              <div><span style={lbl}>数量</span><input className="field-input" value={f.qty} onChange={(e) => set('qty', e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" style={numIn} /></div>
              <div style={{ textAlign: 'center', paddingBottom: 8 }}>×</div>
              <div><span style={lbl}>単価</span><input className="field-input ring" value={f.unit ? yen(num(f.unit)) : ''} onChange={(e) => set('unit', e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="0" style={numIn} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8 }}>
              <div><span style={lbl}>取得価額合計</span><div style={{ ...numIn, background: '#f5f7f9' }}>{yen(cost)}</div></div>
              <div><span style={lbl}>備忘価額</span><input className="field-input" value={f.memo} onChange={(e) => set('memo', e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" style={numIn} /></div>
              <div><span style={lbl}>残存価額</span><input className="field-input" value={f.residual} onChange={(e) => set('residual', e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" style={numIn} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'end', marginTop: 8 }}>
              <div style={{ flex: 1 }}><span style={lbl}>補助金総合計（うち償還補助金額）</span><input className="field-input" value={yen(sub)} onChange={(e) => set('subsidy', e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" style={numIn} /></div>
              <button type="button" className="btn-outline" onClick={() => toast('補助金設定：' + NOT_IMPL)} style={btn()}>補助金設定</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={box}>
              <span style={sec('資産処分等')}>資産処分等</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <select value={f.disposal} onChange={(e) => set('disposal', e.target.value)} style={input}>{['設定なし', '除却', '売却', '移管(元)'].map((o) => <option key={o}>{o}</option>)}</select>
                <div><input className="field-input" placeholder="除却／売却／移管(元)額" disabled={f.disposal === '設定なし'} style={{ ...numIn, background: f.disposal === '設定なし' ? '#f5f7f9' : '#fff' }} /></div>
                <input className="field-input" placeholder="令和　年　月　日" disabled={f.disposal === '設定なし'} style={{ ...input, background: f.disposal === '設定なし' ? '#f5f7f9' : '#fff' }} />
                <button type="button" className="btn-outline" onClick={() => toast('一部 除却／売却／移管(元)：' + NOT_IMPL)} style={btn()}>一部 除却／売却／移管(元)</button>
              </div>
            </div>
            <div style={box}>
              <span style={sec('計算変更等')}>計算変更等</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="btn-outline" onClick={() => toast('計算変更：' + NOT_IMPL)} style={btn()}>計算変更</button>
                <button type="button" className="btn-outline" onClick={() => toast('資本的支出：' + NOT_IMPL)} style={btn()}>資本的支出</button>
                <button type="button" className="btn-outline" onClick={() => toast('操作ログ／詳細情報：' + NOT_IMPL)} style={btn()}>操作ログ・詳細情報</button>
                <button type="button" className="btn-outline" onClick={() => toast('資産画像の添付：' + NOT_IMPL)} style={btn()}>資産画像</button>
              </div>
            </div>
          </div>
        </div>

        {/* 償却計算表 */}
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={TH} /><th style={{ ...TH, textAlign: 'right' }}>期首帳簿価額 (A)</th><th style={{ ...TH, textAlign: 'right' }}>当期増加額 (B)</th><th style={{ ...TH, textAlign: 'right' }}>当期減価償却額 (C)</th><th style={{ ...TH, textAlign: 'right' }}>当期減少額 (D)</th><th style={{ ...TH, textAlign: 'right' }}>期末帳簿価額 (E=A+B-C-D)</th><th style={{ ...TH, textAlign: 'right' }}>減価償却累計額 (F)</th><th style={{ ...TH, textAlign: 'right' }}>期末取得原価 (G=E+F)</th></tr></thead>
            <tbody>
              <tr>
                <td style={{ ...TD, fontWeight: 700 }}>取得価額</td>
                {(['A', 'B', 'C', 'D'] as const).map((k) => <td key={k} style={NUM}>{manual ? <input className="field-input" value={yen(manualVals[k])} onChange={(e) => setManualVals({ ...manualVals, [k]: num(e.target.value) })} inputMode="numeric" style={{ ...numIn, width: 110 }} /> : yen({ A, B, C, D }[k])}</td>)}
                <td style={{ ...NUM, fontWeight: 700 }}>{yen(E)}</td><td style={NUM}>{yen(F)}</td><td style={NUM}>{yen(G)}</td>
              </tr>
              <tr><td style={TD}>国庫補助金等の額</td><td style={NUM}>{yen(cost ? Math.floor((A * sub) / cost) : 0)}</td><td style={NUM}>{yen(cost ? Math.floor((B * sub) / cost) : 0)}</td><td style={NUM}>{yen(subC)}</td><td style={NUM}>0</td><td style={NUM}>{yen(cost ? Math.floor((E * sub) / cost) : 0)}</td><td style={NUM}>{yen(cost ? Math.floor((F * sub) / cost) : 0)}</td><td style={NUM}>{yen(sub)}</td></tr>
              <tr><td style={{ ...TD, color: '#7a8794' }}>（うち償還補助金の額）</td><td style={NUM}>0</td><td style={NUM}>0</td><td style={NUM}>0</td><td style={NUM}>0</td><td style={NUM}>0</td><td style={NUM} /><td style={NUM} /></tr>
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={sec('帳票')}>帳票</span>
          {['個別固定資産管理台帳', '別紙３(⑧)', '固定資産管理台帳'].map((r) => <button key={r} type="button" className="btn-outline" onClick={() => toast(`${r}：${NOT_IMPL}`)} style={btn()}>{r}</button>)}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="submit-btn" onClick={save} style={{ ...btn(accent, true), padding: '9px 26px', fontSize: 13.5 }}>登録</button>
            <button type="button" onClick={onCancel} style={{ ...btn(), padding: '9px 20px', fontSize: 13.5 }}>キャンセル</button>
          </div>
        </div>
      </div>

      {/* 右：経年表示 */}
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>選択中の固定資産　経年表示</div>
        <div style={{ display: 'flex', gap: 10, fontSize: 12, marginBottom: 8 }}>{['数量／減価償却', '国庫補助金', '償還補助金'].map((t, i) => <label key={t} style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="radio" name="yr" defaultChecked={i === 0} />{t}</label>)}</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={TH}>年度</th><th style={TH}>状態</th><th style={{ ...TH, textAlign: 'right' }}>期首帳簿価額</th><th style={{ ...TH, textAlign: 'right' }}>当期減価償却額</th><th style={{ ...TH, textAlign: 'right' }}>期末帳簿価額</th></tr></thead>
          <tbody>
            {(() => {
              if (!cost || !life || f.method === '非償却') return <tr><td colSpan={5} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 24 }}>取得価額と耐用年数を入力すると年度ごとの推移を表示します。</td></tr>;
              const rows = [];
              let bal = cost;
              for (let y = 0; y < Math.min(life, 12); y++) {
                const dep = Math.min(annual, bal - num(f.memo));
                rows.push(<tr key={y}><td style={TD}>{y + 1}年目</td><td style={TD}><span style={{ fontSize: 10.5, color: '#1f7a52', fontWeight: 700 }}>償却中</span></td><td style={NUM}>{yen(bal)}</td><td style={NUM}>{yen(dep)}</td><td style={NUM}>{yen(bal - dep)}</td></tr>);
                bal -= dep;
              }
              return rows;
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= 備品登録 ================= */
function EquipForm({ accent, equips, onSave, onCancel, toast }: { accent: string; equips: Equip[]; onSave: (e: Equip) => void; onCancel: () => void; toast: (m: string) => void }) {
  const [f, setF] = useState({ code: String(equips.length + 1).padStart(5, '0'), account: '', name: '', acquired: '令和8年 4月 1日', qty: '1', unit: '', subsidy: '0', disposal: '設定なし' });
  const num = (s: string) => parseInt(String(s).replace(/[^0-9]/g, ''), 10) || 0;
  const total = num(f.qty) * num(f.unit);
  const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '6px 9px', border: '1px solid #cfd8e0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' };
  const lbl: CSSProperties = { fontSize: 11, fontWeight: 700, color: '#8290a0', marginBottom: 4, display: 'block' };
  const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '7px 12px', borderRadius: 7, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#fff', color: solid ? '#fff' : color, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(300px,1fr)' }}>
      <div style={{ padding: 18, borderRight: '1px solid #eef2f5', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ border: '1px solid #f0c8cc', background: '#fff5f6', borderRadius: 10, padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div><span style={lbl}>備品コード</span><input className="field-input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} style={{ ...input, fontWeight: 700 }} /></div>
          <div><span style={lbl}>並び順項目</span><select style={input}><option>（なし）</option><option>事務用品</option><option>保育用品</option></select></div>
          <div><span style={lbl}>科目</span><select value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })} style={input}><option value="">選択</option><option>消耗器具備品費</option><option>器具及び備品</option></select></div>
          <div style={{ gridColumn: 'span 2' }}><span style={lbl}>備品名称</span><input className="field-input ring" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="例：ノートパソコン" style={input} /></div>
          <div><span style={lbl}>取得年月日</span><input className="field-input" value={f.acquired} onChange={(e) => setF({ ...f, acquired: e.target.value })} style={input} /></div>
          <div><span style={lbl}>備品処分等</span><select value={f.disposal} onChange={(e) => setF({ ...f, disposal: e.target.value })} style={input}>{['設定なし', '除却', '売却', '移管(元)'].map((o) => <option key={o}>{o}</option>)}</select></div>
          <div><span style={lbl}>除却／売却／移管元額</span><input className="field-input" disabled={f.disposal === '設定なし'} style={{ ...input, textAlign: 'right', background: f.disposal === '設定なし' ? '#f5f7f9' : '#fff' }} /></div>
          <div><span style={lbl}>処分年月日</span><input className="field-input" disabled={f.disposal === '設定なし'} placeholder="令和　年　月　日" style={{ ...input, background: f.disposal === '設定なし' ? '#f5f7f9' : '#fff' }} /></div>
        </div>
        <div style={{ border: '1px solid #f0c8cc', background: '#fff5f6', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#b7791f', background: '#fff7dc', display: 'inline-block', padding: '2px 8px', borderRadius: 6, marginBottom: 8 }}>取得価額</div>
          <div style={{ display: 'grid', gridTemplateColumns: '70px 20px 160px 40px 160px 1fr', gap: 6, alignItems: 'end' }}>
            <div><span style={lbl}>数量</span><input className="field-input" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" style={{ ...input, textAlign: 'right' }} /></div>
            <div style={{ textAlign: 'center', paddingBottom: 8 }}>×</div>
            <div><span style={lbl}>単価</span><input className="field-input ring" value={f.unit ? yen(num(f.unit)) : ''} onChange={(e) => setF({ ...f, unit: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" placeholder="0" style={{ ...input, textAlign: 'right' }} /></div>
            <div style={{ textAlign: 'center', paddingBottom: 8 }}>＝</div>
            <div><span style={lbl}>合計額</span><div style={{ ...input, textAlign: 'right', background: '#f5f7f9' }}>{yen(total)}</div></div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'end' }}><div style={{ flex: 1 }}><span style={lbl}>うち補助金</span><input className="field-input" value={yen(num(f.subsidy))} onChange={(e) => setF({ ...f, subsidy: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" style={{ ...input, textAlign: 'right' }} /></div><button type="button" className="btn-outline" onClick={() => toast('補助金設定：' + NOT_IMPL)} style={btn()}>補助金設定</button></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#b7791f', background: '#fff7dc', padding: '2px 8px', borderRadius: 6 }}>帳票</span>
          {['備品一覧表(1)', '備品一覧表(2)'].map((r) => <button key={r} type="button" className="btn-outline" onClick={() => toast(`${r}：${NOT_IMPL}`)} style={btn()}>{r}</button>)}
          <button type="button" className="btn-outline" onClick={() => toast('操作ログ／詳細情報：' + NOT_IMPL)} style={btn()}>操作ログ・詳細情報</button>
          <button type="button" className="btn-outline" onClick={() => toast('備品画像の添付：' + NOT_IMPL)} style={btn()}>備品画像</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="submit-btn" onClick={() => { if (!f.name.trim()) return toast('備品名称を入力してください'); if (!total) return toast('取得価額を入力してください'); onSave({ code: f.code, name: f.name.trim(), acquired: f.acquired, cost: total }); setF({ ...f, code: String(num(f.code) + 1).padStart(5, '0'), name: '', unit: '' }); }} style={{ ...btn(accent, true), padding: '9px 26px', fontSize: 13.5 }}>登録</button>
            <button type="button" onClick={onCancel} style={{ ...btn(), padding: '9px 20px', fontSize: 13.5 }}>キャンセル</button>
          </div>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>備品一覧</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={TH}>備品コード</th><th style={TH}>備品名称</th><th style={TH}>取得年月日</th><th style={{ ...TH, textAlign: 'right' }}>取得価額</th></tr></thead>
          <tbody>{equips.map((e) => <tr key={e.code}><td style={TD}>{e.code}</td><td style={TD}>{e.name}</td><td style={TD}>{e.acquired}</td><td style={NUM}>{yen(e.cost)}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= 一括処理 ================= */
function BatchView({ accent, assets, onDone, toast }: { accent: string; assets: Asset[]; onDone: (n: number) => void; toast: (m: string) => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [proc, setProc] = useState<Record<string, string>>({});
  const [amt, setAmt] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState('設定なし');
  const [date, setDate] = useState('');
  const num = (s: string) => parseInt(String(s || '').replace(/[^0-9]/g, ''), 10) || 0;
  const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#fff', color: solid ? '#fff' : color, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' });
  const input: CSSProperties = { padding: '5px 8px', border: '1px solid #cfd8e0', borderRadius: 6, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', background: '#fff' };
  const applyBulk = () => { if (sel.size === 0) return toast('固定資産を選択してください'); setProc((p) => { const n = { ...p }; sel.forEach((c) => (n[c] = bulk)); return n; }); toast(`${sel.size} 件に「${bulk}」をセットしました`); };
  const targets = assets.filter((a) => (proc[a.code] ?? '設定なし') !== '設定なし');
  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', gap: 12 }}>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: 12, fontSize: 12.5, lineHeight: 1.8 }}><b>処理の手順</b><br />①固定資産の選択<br />②一括セット<br />③固定資産ごとの調整<br />④登録で完了</div>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>登録前の一括セット</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
            処理の選択 <select value={bulk} onChange={(e) => setBulk(e.target.value)} style={input}>{['設定なし', '除却', '売却', '移管(元)'].map((o) => <option key={o}>{o}</option>)}</select>
            処分年月日 <input className="field-input" value={date} onChange={(e) => setDate(e.target.value)} placeholder="令和8年 9月30日" style={{ ...input, width: 140 }} />
            <button type="button" className="btn-outline" onClick={applyBulk} style={btn(accent, true)}>一括セット</button>
          </div>
        </div>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: 12, fontSize: 12.5, lineHeight: 1.7 }}>
          <div><b>除却・売却・移管 固定資産当期減価償却額の設定状態</b></div>
          <div>除却月／移管月まで（月按分する）</div>
          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            <button type="button" className="btn-outline" onClick={() => { setProc({}); setSel(new Set()); toast('処理を取り消しました'); }} style={btn()}>処理取消</button>
            <button type="button" className="btn-outline" onClick={() => toast('移管(元)ファイル出力：' + NOT_IMPL)} style={btn()}>移管(元)ファイル出力</button>
            <button type="button" className="btn-outline" onClick={() => toast('出力履歴：' + NOT_IMPL)} style={btn()}>出力履歴</button>
          </div>
        </div>
      </div>
      <div style={{ overflow: 'auto', maxHeight: 460, border: '1px solid #e2e8ee', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={{ ...TH, width: 36 }}><input type="checkbox" checked={sel.size === assets.length} onChange={(e) => setSel(e.target.checked ? new Set(assets.map((a) => a.code)) : new Set())} /></th><th style={TH}>処理</th><th style={TH}>資産コード</th><th style={TH}>固定資産名称</th><th style={{ ...TH, textAlign: 'right' }}>取得価額</th><th style={{ ...TH, textAlign: 'right' }}>耐用年数</th><th style={TH}>処理年月日</th><th style={{ ...TH, textAlign: 'right' }}>期首帳簿価額</th><th style={{ ...TH, textAlign: 'right' }}>うち国庫補助金等</th><th style={{ ...TH, textAlign: 'right' }}>処分額または売却額</th></tr></thead>
          <tbody>
            {assets.map((a) => {
              const p = proc[a.code] ?? '設定なし';
              return (
                <tr key={a.code} style={{ background: p !== '設定なし' ? '#fff8c4' : 'transparent' }}>
                  <td style={TD}><input type="checkbox" checked={sel.has(a.code)} onChange={() => setSel((s) => { const n = new Set(s); n.has(a.code) ? n.delete(a.code) : n.add(a.code); return n; })} /></td>
                  <td style={TD}><select value={p} onChange={(e) => setProc({ ...proc, [a.code]: e.target.value })} style={input}>{['設定なし', '除却', '売却', '移管(元)'].map((o) => <option key={o}>{o}</option>)}</select></td>
                  <td style={TD}>{a.code}</td><td style={{ ...TD, fontWeight: 500 }}>{a.name}</td><td style={NUM}>{yen(a.cost)}</td><td style={NUM}>{a.life}</td>
                  <td style={TD}>{p !== '設定なし' ? date || '（未入力）' : ''}</td>
                  <td style={NUM}>{yen(a.opening)}</td><td style={NUM}>{yen(a.subsidy)}</td>
                  <td style={NUM}><input className="field-input" value={amt[a.code] ? yen(num(amt[a.code])) : ''} onChange={(e) => setAmt({ ...amt, [a.code]: e.target.value.replace(/[^0-9]/g, '') })} disabled={p !== '売却'} placeholder="0" inputMode="numeric" style={{ ...input, width: 110, textAlign: 'right', background: p === '売却' ? '#fff' : '#f5f7f9' }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <span style={{ fontSize: 12.5, color: '#7a8794', alignSelf: 'center' }}>処理対象 {targets.length} 件</span>
        <button type="button" className="submit-btn" onClick={() => { if (targets.length === 0) return toast('処理を設定した固定資産がありません'); if (!date) return toast('処分年月日を入力してください'); onDone(targets.length); }} style={btn(accent, true)}>登録</button>
      </div>
    </div>
  );
}

/* ================= 決算機能 ================= */
function ClosingView({ accent, vouchers, setVouchers, onExit, toast }: { accent: string; vouchers: Voucher[]; setVouchers: (f: (v: Voucher[]) => Voucher[]) => void; onExit: () => void; toast: (m: string) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [v, setV] = useState({ name: '', format: '仕訳伝票形式', proc: '減価償却', acc: false, one: false, date: '令和9年 3月31日' });
  const [add, setAdd] = useState<Set<string>>(new Set(['土地', '建物', '構築物', '器具及び備品', 'ソフト等']));
  const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '9px 22px', borderRadius: 8, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#eef0fa', color: solid ? '#fff' : '#22303c', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid #cfd8e0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' };
  const ROWS: { g?: string; name: string; account: string; A: number; As: number; B: number; Bs: number; C: number; Cs: number }[] = [
    { g: '基本財産', name: '土地', account: '土地　－基本財産－', A: 5803427, As: 0, B: 0, Bs: 0, C: 0, Cs: 0 },
    { name: '建物', account: '建物　－基本財産－', A: 4349772, As: 2934626, B: 0, Bs: 0, C: 546084, Cs: 391018 },
    { g: 'その他固定資産財産(有形)', name: '構築物', account: '構築物', A: 613666, As: 0, B: 1667600, Bs: 0, C: 114918, Cs: 0 },
    { name: '器具及び備品', account: '器具及び備品', A: 2408668, As: 0, B: 628670, Bs: 0, C: 726229, Cs: 0 },
    { g: 'その他固定資産財産(無形)', name: 'ソフト等', account: 'ソフトウェア', A: 0, As: 0, B: 440000, Bs: 299200, C: 14666, Cs: 9973 },
  ];
  const finish = () => {
    setVouchers((vs) => [...vs, { name: v.name || '決算伝票', date: v.date, format: v.format, proc: v.proc }]);
    toast(`「${v.name || '決算伝票'}」を作成し、仕訳伝票へ登録しました（対象 ${add.size} 科目）`);
    setStep(1);
    setV({ ...v, name: '' });
  };
  if (step === 1) return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>【決算処理】<span style={{ fontWeight: 500, marginLeft: 8 }}>決算処理設定済みの伝票一覧</span></div>
      <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, marginTop: 8, minHeight: 220 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={TH}>伝票の名称</th><th style={TH}>伝票年月日</th><th style={TH}>伝票形式</th><th style={TH}>決算処理</th><th style={{ ...TH, width: 80 }}>削除</th></tr></thead>
          <tbody>
            {vouchers.length === 0 && <tr><td colSpan={5} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 40 }}>登録済みの決算伝票はありません。「新しい伝票を作成」から作成してください。</td></tr>}
            {vouchers.map((x, i) => <tr key={i}><td style={{ ...TD, fontWeight: 600 }}>{x.name}</td><td style={TD}>{x.date}</td><td style={TD}>{x.format}</td><td style={TD}>{x.proc}</td><td style={TD}><button type="button" className="btn-outline" onClick={() => setVouchers((vs) => vs.filter((_, k) => k !== i))} style={{ ...btn('#c0392b'), padding: '4px 10px', fontSize: 11.5, background: '#fff' }}>削除</button></td></tr>)}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <button type="button" className="btn-outline" onClick={() => setStep(2)} style={btn()}>新しい伝票を作成</button>
        <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" />集計期間設定</label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" onClick={onExit} style={btn()}>キャンセル</button>
          <button type="button" className="submit-btn" disabled={vouchers.length === 0} onClick={() => toast('選択した伝票の内容を表示します：' + NOT_IMPL)} style={{ ...btn(accent, true), opacity: vouchers.length ? 1 : 0.5 }}>次へ</button>
        </div>
      </div>
    </div>
  );
  if (step === 2) return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>【決算処理】伝票の登録編集</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><div style={{ fontSize: 11.5, fontWeight: 700, color: '#8290a0', marginBottom: 4 }}>伝票の名称</div><input className="field-input ring" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="例：令和8年度 減価償却" style={input} /></div>
          <div><div style={{ fontSize: 11.5, fontWeight: 700, color: '#8290a0', marginBottom: 4 }}>【伝票形式】</div><select value={v.format} onChange={(e) => setV({ ...v, format: e.target.value })} style={input}><option>仕訳伝票形式</option><option>振替伝票形式</option></select></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>伝票年月日 <input className="field-input" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} style={{ ...input, width: 180 }} /></div>
        </div>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#8290a0', marginBottom: 4 }}>【処理選択】</div>
          {['減価償却', '国庫補助金取崩', '処分(除却・売却・移管元)', '売却損益'].map((p) => <label key={p} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', fontSize: 13.5, cursor: 'pointer' }}><input type="radio" name="proc" checked={v.proc === p} onChange={() => setV({ ...v, proc: p })} />{p}</label>)}
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', fontSize: 13 }}><input type="checkbox" checked={v.acc} onChange={() => setV({ ...v, acc: !v.acc })} />減価償却累計額を出力</label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', fontSize: 13 }}><input type="checkbox" checked={v.one} onChange={() => setV({ ...v, one: !v.one })} />一枚伝票に登録</label>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
        <button type="button" onClick={() => setStep(1)} style={btn()}>キャンセル</button>
        <button type="button" className="submit-btn" disabled={!v.name.trim()} onClick={() => setStep(3)} style={{ ...btn(accent, true), opacity: v.name.trim() ? 1 : 0.5 }}>次へ</button>
      </div>
    </div>
  );
  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>【決算処理】{v.name}　—　{v.proc}</div>
      <div style={{ overflow: 'auto', border: '1px solid #e2e8ee', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
          <thead><tr><th style={TH}>資産の種類または名称</th><th style={{ ...TH, textAlign: 'center' }}>伝票へ追加</th><th style={TH}>借方科目の設定</th><th style={TH}>貸方科目の設定</th><th style={TH}>摘要</th><th style={{ ...TH, textAlign: 'right' }}>期首帳簿価額 (A)</th><th style={{ ...TH, textAlign: 'right' }}>うち国庫補助金等</th><th style={{ ...TH, textAlign: 'right' }}>当期増加額 (B)</th><th style={{ ...TH, textAlign: 'right' }}>うち国庫補助金等</th><th style={{ ...TH, textAlign: 'right' }}>当期減価償却額 (C)</th><th style={{ ...TH, textAlign: 'right' }}>うち国庫補助金等</th></tr></thead>
          <tbody>
            {ROWS.map((r) => (
              <Fragment key={r.name}>
                {r.g && <tr><td colSpan={11} style={{ ...TD, fontWeight: 700, background: '#f8fafc' }}>{r.g}</td></tr>}
                <tr style={{ background: add.has(r.name) ? '#fff' : '#fafbfc', opacity: add.has(r.name) ? 1 : 0.6 }}>
                  <td style={{ ...TD, paddingLeft: 26 }}>{r.name}</td>
                  <td style={{ ...TD, textAlign: 'center' }}><input type="checkbox" checked={add.has(r.name)} onChange={() => setAdd((s) => { const n = new Set(s); n.has(r.name) ? n.delete(r.name) : n.add(r.name); return n; })} /></td>
                  <td style={TD}><button type="button" className="btn-outline" onClick={() => toast('借方科目の選択：' + NOT_IMPL)} style={{ ...btn(), padding: '4px 10px', fontSize: 11.5 }}>減価償却費</button></td>
                  <td style={TD}><button type="button" className="btn-outline" onClick={() => toast('貸方科目の選択：' + NOT_IMPL)} style={{ ...btn(), padding: '4px 10px', fontSize: 11.5 }}>{r.account}</button></td>
                  <td style={TD}><button type="button" className="btn-outline" onClick={() => toast('摘要選択：' + NOT_IMPL)} style={{ ...btn(), padding: '4px 10px', fontSize: 11.5 }}>当期減価償却</button></td>
                  <td style={NUM}>{yen(r.A)}</td><td style={NUM}>{yen(r.As)}</td><td style={NUM}>{yen(r.B)}</td><td style={NUM}>{yen(r.Bs)}</td><td style={{ ...NUM, fontWeight: 700 }}>{yen(r.C)}</td><td style={NUM}>{yen(r.Cs)}</td>
                </tr>
              </Fragment>
            ))}
            <tr style={{ background: '#e9eef3' }}><td style={{ ...TD, fontWeight: 700 }} colSpan={5}>合計（伝票へ追加する科目）</td>
              {(['A', 'As', 'B', 'Bs', 'C', 'Cs'] as const).map((k) => <td key={k} style={{ ...NUM, fontWeight: 700 }}>{yen(ROWS.filter((r) => add.has(r.name)).reduce((a, r) => a + r[k], 0))}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" onClick={() => setStep(2)} style={btn()}>戻る</button>
        <button type="button" className="submit-btn" onClick={finish} style={btn(accent, true)}>伝票を作成する</button>
      </div>
    </div>
  );
}

/* ================= 移管取込 ================= */
function TransferView({ accent, onRegister, toast }: { accent: string; onRegister: (n: number) => void; toast: (m: string) => void }) {
  const [rows, setRows] = useState<{ code: string; from: string; name: string; date: string; qty: number; inQty: number; unit: number; cost: number; subsidy: number }[]>([]);
  const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '8px 16px', borderRadius: 8, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#eef0fa', color: solid ? '#fff' : '#22303c', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const load = () => { setRows([{ code: '', from: 'ひまわり保育園', name: '遊具（複合滑り台）', date: '令和8年 4月 1日', qty: 1, inQty: 1, unit: 1250000, cost: 1250000, subsidy: 600000 }, { code: '', from: 'ひまわり保育園', name: '業務用冷蔵庫', date: '令和8年 4月 1日', qty: 1, inQty: 1, unit: 380000, cost: 380000, subsidy: 0 }]); toast('移管データを読み込みました（サンプル2件）'); };
  const number = () => setRows((rs) => rs.map((r, i) => ({ ...r, code: String(30001 + i) })));
  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button type="button" className="btn-outline" onClick={number} style={btn()}>コード自動採番</button>
        <button type="button" className="btn-outline" onClick={load} style={btn()}>移管データ読込</button>
        <button type="button" className="btn-outline" onClick={() => setRows([])} style={btn()}>処理の取消</button>
        <button type="button" className="btn-outline" onClick={() => toast('取込み履歴：' + NOT_IMPL)} style={btn()}>取込み履歴</button>
        <div style={{ marginLeft: 'auto' }}><button type="button" className="submit-btn" onClick={() => { if (rows.length === 0) return toast('移管データを読み込んでください'); if (rows.some((r) => !r.code)) return toast('「コード自動採番」で資産コードを付番してください'); onRegister(rows.length); }} style={btn(accent, true)}>登録</button></div>
      </div>
      <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, minHeight: 260 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['資産コード', '移管元名称', '固定資産名称', '移管年月日', '数量', '取込み数量', '単価', '取得移管価額', 'うち国庫補助金等'].map((h, i) => <th key={h} style={{ ...TH, textAlign: i >= 4 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 60 }}>「移管データ読込」で移管（元）ファイルを読み込みます。</td></tr>}
            {rows.map((r, i) => <tr key={i}><td style={{ ...TD, color: r.code ? '#22303c' : '#c0392b' }}>{r.code || '未採番'}</td><td style={TD}>{r.from}</td><td style={{ ...TD, fontWeight: 500 }}>{r.name}</td><td style={TD}>{r.date}</td><td style={NUM}>{r.qty}</td><td style={NUM}>{r.inQty}</td><td style={NUM}>{yen(r.unit)}</td><td style={NUM}>{yen(r.cost)}</td><td style={NUM}>{yen(r.subsidy)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= データ削除 ================= */
function DeleteView({ accent, assets, equips, onDelete, onExit }: { accent: string; assets: Asset[]; equips: Equip[]; onDelete: (codes: Set<string>, kind: 'asset' | 'equip') => void; onExit: () => void }) {
  const [tab, setTab] = useState<'asset' | 'equip'>('asset');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '8px 22px', borderRadius: 8, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#eef0fa', color: solid ? '#fff' : '#22303c', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const list = tab === 'asset' ? assets.filter((a) => !q || a.name.includes(q) || a.code.includes(q)) : [];
  const elist = tab === 'equip' ? equips.filter((e) => !q || e.name.includes(q)) : [];
  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {(['asset', 'equip'] as const).map((t) => <button key={t} type="button" className="chip" onClick={() => { setTab(t); setSel(new Set()); }} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid ' + (tab === t ? accent : '#d3dbe3'), background: tab === t ? accent : '#fff', color: tab === t ? '#fff' : '#5b6773', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{t === 'asset' ? '固定資産一覧' : '備品一覧'}</button>)}
        <span style={{ fontSize: 12.5, marginLeft: 8 }}>検索</span><input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220, padding: '6px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: '#c0392b', fontWeight: 700 }}>削除対象 {sel.size} 件</span>
      </div>
      <div style={{ overflow: 'auto', maxHeight: 460, border: '1px solid #e2e8ee', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={{ ...TH, width: 50 }}>削除</th><th style={TH}>状態</th><th style={TH}>資産コード</th><th style={TH}>名称</th><th style={TH}>取得年月日</th><th style={{ ...TH, textAlign: 'right' }}>耐用年数</th><th style={{ ...TH, textAlign: 'right' }}>取得価額</th></tr></thead>
          <tbody>
            {list.map((a) => <tr key={a.code} style={{ background: sel.has(a.code) ? '#fdeee9' : 'transparent' }}><td style={TD}><input type="checkbox" checked={sel.has(a.code)} onChange={() => setSel((s) => { const n = new Set(s); n.has(a.code) ? n.delete(a.code) : n.add(a.code); return n; })} /></td><td style={TD}>{a.status}</td><td style={TD}>{a.code}</td><td style={TD}>{a.name}</td><td style={TD}>{a.acquired}</td><td style={NUM}>{a.life}</td><td style={NUM}>{yen(a.cost)}</td></tr>)}
            {elist.map((e) => <tr key={e.code} style={{ background: sel.has(e.code) ? '#fdeee9' : 'transparent' }}><td style={TD}><input type="checkbox" checked={sel.has(e.code)} onChange={() => setSel((s) => { const n = new Set(s); n.has(e.code) ? n.delete(e.code) : n.add(e.code); return n; })} /></td><td style={TD}>—</td><td style={TD}>{e.code}</td><td style={TD}>{e.name}</td><td style={TD}>{e.acquired}</td><td style={NUM}>—</td><td style={NUM}>{yen(e.cost)}</td></tr>)}
            {list.length + elist.length === 0 && <tr><td colSpan={7} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 40 }}>該当するデータがありません。</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14 }}>
        <button type="button" className="submit-btn" onClick={() => { if (sel.size === 0) return; if (confirm(`${sel.size} 件を削除します。よろしいですか？（取り消せません）`)) { onDelete(sel, tab); setSel(new Set()); } }} style={btn('#c0392b', true)}>OK（削除）</button>
        <button type="button" onClick={onExit} style={btn()}>終了</button>
      </div>
    </div>
  );
}

/* ================= 動作環境設定 ================= */
function EnvSettings({ accent, onClose, toast }: { accent: string; onClose: () => void; toast: (m: string) => void }) {
  const [s, setS] = useState({ method: '定額法', dep: '償却率を乗ずる方法', sub: '償却率を乗ずる方法', byDate: false, disposal: '除却月／移管月まで（月按分する）', zero: true, gengo: true, size: 100 });
  const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '7px 12px', borderRadius: 7, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#eef0fa', color: solid ? '#fff' : '#22303c', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const box: CSSProperties = { border: '1px solid #e2e8ee', borderRadius: 10, padding: 12 };
  const radio = (name: string, opts: string[], val: string, set: (v: string) => void) => opts.map((o) => <label key={o} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, padding: '2px 0' }}><input type="radio" name={name} checked={val === o} onChange={() => set(o)} />{o}</label>);
  return (
    <div style={{ padding: '14px 22px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={box}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>主とする計算</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, marginBottom: 8 }}>①償却方法 <select value={s.method} onChange={(e) => setS({ ...s, method: e.target.value })} style={{ padding: '6px 10px', border: '1px solid #cfd8e0', borderRadius: 7, fontFamily: 'inherit', fontSize: 12.5, width: 260 }}>{['定額法', '旧定額法', 'リース定額法'].map((o) => <option key={o}>{o}</option>)}</select></div>
        <div style={{ fontSize: 12.5, marginBottom: 6 }}>②端数処理その他設定</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12.5 }}>
          {['定額法', '旧定額法(備忘価額まで)', '旧定額法(残存価額まで)', 'リース定額法'].map((m) => <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ flex: 1 }}>{m}</span><button type="button" className="btn-outline" onClick={() => toast(`${m} の詳細設定：${NOT_IMPL}`)} style={btn()}>詳細設定</button></div>)}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div style={box}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>定額法の計算方法</div>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, marginBottom: 8 }}><input type="checkbox" checked={s.byDate} onChange={() => setS({ ...s, byDate: !s.byDate })} />取得年月日で指定する <button type="button" className="btn-outline" disabled={!s.byDate} style={{ ...btn(), opacity: s.byDate ? 1 : 0.4 }}>取得年月日指定</button></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>減価償却費</div>{radio('dep', ['旧償却率を乗ずる方法', '耐用年数で除算する方法', '償却率を乗ずる方法'], s.dep, (v) => setS({ ...s, dep: v }))}</div>
            <div><div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>国庫補助金等取崩</div>{radio('sub', ['旧償却率を乗ずる方法', '耐用年数で除算する方法', '償却率を乗ずる方法'], s.sub, (v) => setS({ ...s, sub: v }))}</div>
          </div>
        </div>
        <div style={box}><div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>諸設定</div><button type="button" className="btn-outline" onClick={() => toast('並び順項目マスタ：' + NOT_IMPL)} style={btn()}>並び順項目マスタ</button></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={box}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>除却物件および移管物件の当期減価償却額</div>
          {radio('disp', ['計算しない（期首価額を除却損／移管損とする）', '除却月／移管月まで（月按分する）'], s.disposal, (v) => setS({ ...s, disposal: v }))}
          <label style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12.5, marginTop: 8, borderTop: '1px solid #eef2f5', paddingTop: 8 }}><input type="checkbox" checked={s.zero} onChange={() => setS({ ...s, zero: !s.zero })} />除却及び、移管（元）固定資産の当期減価償却累計額を「０」円にする</label>
        </div>
        <div style={box}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>印刷関係</div>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}><input type="checkbox" checked={s.gengo} onChange={() => setS({ ...s, gengo: !s.gengo })} />和暦の１年を元年と表記する</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}><span style={{ width: 36, height: 20, background: '#eef9fb', border: '1px solid #cfd8e0' }} /><button type="button" className="btn-outline" onClick={() => toast('帳票の網掛色：' + NOT_IMPL)} style={btn()}>帳票の網掛色</button><span style={{ width: 36, height: 20, background: '#ff7a00', border: '1px solid #cfd8e0' }} /><button type="button" className="btn-outline" onClick={() => toast('帳票の罫線色：' + NOT_IMPL)} style={btn()}>帳票の罫線色</button></div>
          <div style={{ fontSize: 12.5, fontWeight: 700, margin: '10px 0 4px' }}>画面サイズ</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="range" min={80} max={150} value={s.size} onChange={(e) => setS({ ...s, size: Number(e.target.value) })} style={{ flex: 1 }} /><span style={{ fontSize: 12.5, width: 44 }}>{s.size}%</span><button type="button" className="btn-outline" onClick={() => setS({ ...s, size: 100 })} style={btn()}>100%に戻す</button></div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="submit-btn" onClick={() => { onClose(); toast('動作環境設定を登録しました（プロトタイプ）'); }} style={{ ...btn(accent, true), padding: '9px 26px', fontSize: 13 }}>登録</button>
        <button type="button" onClick={onClose} style={{ ...btn(), padding: '9px 20px', fontSize: 13 }}>キャンセル</button>
      </div>
    </div>
  );
}
