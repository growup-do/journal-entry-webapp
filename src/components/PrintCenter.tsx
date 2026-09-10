// 印刷センター（提案C）：帳票一覧 → 共通の印刷ダイアログ（期間・出力先・詳細設定）→ プレビュー。
//   マニュアル 7章の 40 超のダイアログを、1画面（帳票一覧）＋1ダイアログ（印刷条件）＋プレビューに集約。
//   一括印刷（7.10）と共通の印刷設定（7.1.2）もここに。

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { FISCAL_MONTHS } from './FiscalMonthTabs';
import { Modal } from './Modal';
import { TD, TH } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { Field, Notice, SettingsShell, Toggle, btn, card, cardHead, input, lbl, numInput } from './ui';
import { PRINT_ITEMS, setSession, useSession } from '../store/session';

export interface ReportDef { id: string; name: string; cat: string; note?: string; detail: string[]; scope?: boolean; }
const D = {
  journal: ['伝票番号：入力番号／自動連番（番号指定）／自動連番（Seq-No）／Seq指定', '印刷順序：入力順／日付順', '印刷科目：印刷用／表示用', '伝票種別：通常伝票／移行伝票', '伝票区分を印刷する', '科目コードを印刷する', '入力予備1（2）を印刷する', 'A4縦に印刷する', '摘要のフォントサイズを自動調整する'],
  voucher: ['伝票番号の種類', '印刷順序', 'タイトル印刷', 'カラー印刷時の基調色：緑／動作環境の色指定', '科目欄：科目／入力コード・科目／科目名・資金科目', '業者名を印刷する', '複写の伝票を印刷する', '証ひょうの有無を印刷する', 'A4白紙に印刷する（上下連続）', 'A5白紙に印刷する', '元号を印字する'],
  ledger: ['残高のみも印刷する', '月計を印刷する', '合計を印刷する（年間で集計）', '月次で改頁する', '月計だけ印刷する', '残高を日計で印刷する', 'Seq番号を印刷する', '現金・預金の表題を変更する', '残高0も印刷する', '証憑の有無を印刷する', '入力予備1（2）を印刷する', 'A4白紙に印刷する', '摘要行も印刷する（空白は印刷しない）', '貸借の金額が一致する行を消し込む', '伝票入力区分名を印刷する', 'カラー印刷時の基調色：緑／青／動作環境'],
  trial: ['印刷位置：大区分〜細々区分／科目毎に設定', '行の間隔', '印刷様式（タイトル）', '0データを印刷しない', '費目行を網掛け、太字にする', '区分名を印刷する', '脚注を印刷する', '科目名のフォントサイズを自動調整する', 'ページ番号・印刷時の日付'],
  closing: ['共通の印刷設定を使う', '印刷位置・行の間隔・印刷様式', '資金収支計算書予備費充当額（円）／注記の予備費充当額を自動印刷する', '貸借対照表内訳表：連続型印刷をする', '備考（決算書備考の文字）'],
  sub: ['明細表内に印刷する金額の指定（伝票を選択）', '印刷日付の指定：日付印刷しない／期首〜期末／指定月', '行の間隔：上・下空き（37行）／上のみ空き（54行）／空きなし（74行）', 'タイトル（全角20文字）', '業者コード小計：同一業者コードがあった場合集計する', '合計行を網掛け、太字にする', '区分名・捺印欄・ページ番号・印刷時の日付'],
  analysis: ['タイトル印刷', '捺印欄・伝票入力区分名・ページ番号・印刷時の日付', '単位：円／千円／百万円', 'グラフ数（1ページ 3〜8個）', '縦軸スケールを自動調整', '平均値の表示'],
};
export const REPORTS: ReportDef[] = [
  { id: 'j1', name: '仕訳日記帳', cat: '仕訳日記帳', detail: D.journal },
  { id: 'j2', name: '仕訳伝票（伝票式）', cat: '仕訳日記帳', detail: D.voucher },
  { id: 'j3', name: '振替伝票（振替式）', cat: '仕訳日記帳', detail: D.voucher },
  { id: 'l1', name: '総勘定元帳', cat: '元帳', scope: true, detail: D.ledger },
  { id: 'l2', name: '資金元帳', cat: '元帳', scope: true, detail: [...D.ledger, '合計印刷時に予算残を印刷する'] },
  { id: 'l3', name: '業者元帳', cat: '元帳', scope: true, detail: [...D.ledger, '合計印刷時に予算残を印刷する'] },
  { id: 'l4', name: '集計元帳', cat: '元帳', scope: true, detail: D.ledger },
  { id: 't1', name: '資金収支計算書（試算表）', cat: '試算表', detail: D.trial },
  { id: 't2', name: '事業活動計算書（試算表）', cat: '試算表', detail: D.trial },
  { id: 't3', name: '貸借対照表（試算表）', cat: '試算表', detail: D.trial },
  { id: 't4', name: '資金収支残高試算表', cat: '試算表', detail: D.trial },
  { id: 't5', name: '残高試算表', cat: '試算表', detail: D.trial },
  { id: 'c1', name: '資金収支計算書（第一号様式）', cat: '決算書', note: '帳票選択で有効にした様式のみ', detail: D.closing },
  { id: 'c2', name: '事業活動計算書（第二号様式）', cat: '決算書', detail: D.closing },
  { id: 'c3', name: '貸借対照表（第三号様式）', cat: '決算書', detail: D.closing },
  { id: 'c4', name: '財務諸表に対する注記', cat: '決算書', note: '注記の編集は設定「決算附属明細書」', detail: ['注記の編集（表挿入／表編集）', '既定の文章に戻す', '設定ファイルの読込／保存'] },
  { id: 'c5', name: '決算附属明細書（3①〜3⑭）', cat: '決算書', detail: ['明細入力（設定「決算附属明細書」）', ...D.closing] },
  { id: 'c6', name: '財産目録', cat: '決算書', detail: ['行設定（設定「決算附属明細書」）', '差引純資産を網掛け、太字にする', '行送り（標準6.4mm）'] },
  { id: 'c7', name: '準決算書（C別紙6〜9／C1-5〜C3-6）', cat: '決算書', detail: D.closing },
  { id: 's1', name: '補助簿（未払金・未収金）', cat: '補助簿（明細表）', detail: D.sub },
  { id: 's2', name: '補助簿（現預金・預かり金）', cat: '補助簿（明細表）', detail: D.sub },
  { id: 'o1', name: '自動按分出力（CSV）', cat: 'その他', detail: ['出力種類：貸借対照表／事業活動計算書／資金収支計算書の按分出力', '出力する列：当年度末／前年度末／増減', '合計値を印刷', '端数の加算区分'] },
  { id: 'o2', name: '収支分析表', cat: 'その他', detail: ['金額を千円単位で表示する', '設定（科目名称・金額の決定方法・色）'] },
  { id: 'a1', name: '財務分析一覧表（5年）', cat: '経営分析', detail: D.analysis },
  { id: 'a2', name: '財務分析グラフ（10年）', cat: '経営分析', detail: D.analysis },
  { id: 'a3', name: '経年推移表／経月推移表', cat: '経営分析', detail: D.analysis },
  { id: 'a4', name: '前年度同月対比表', cat: '経営分析', detail: D.analysis },
  { id: 'a5', name: '3期連続資金収支比較表', cat: '経営分析', detail: ['当年度予算予想額の算出方法：当月より倍率／当月累計＋過去の平均', '千円単位にする', ...D.analysis] },
];
const CATS = ['仕訳日記帳', '元帳', '試算表', '決算書', '補助簿（明細表）', 'その他', '経営分析'];
export const OUTPUTS = ['プリンターから印刷する', '画面へプレビューする', 'エクセル互換ファイル（CSV）へ出力する', 'Excelファイル出力', 'PDFファイル出力'];

/* ---------------- 共通の印刷ダイアログ ---------------- */
export function PrintDialog({ open, onClose, report, accent, onPreview }: { open: boolean; onClose: () => void; report: ReportDef | null; accent: string; onPreview: (title: string, opts: { from: string; to: string; output: string }) => void }) {
  const s = useSession();
  const [months, setMonths] = useState<Set<string>>(new Set(['8']));
  const [from, setFrom] = useState('令和8年8月1日');
  const [to, setTo] = useState('令和8年8月31日');
  const [output, setOutput] = useState(OUTPUTS[1]);
  const [range, setRange] = useState('範囲指定の合計を印刷');
  const [scope, setScope] = useState('全て');
  const [checks, setChecks] = useState({ check: false, red: false, blue: false, yellow: false, green: false });
  const [detail, setDetail] = useState(false);
  const [useCommon, setUseCommon] = useState(true);
  const toast = useToast();
  const toggleMonth = (m: string) => setMonths((set) => { const n = new Set(set); if (n.has(m)) n.delete(m); else n.add(m); const arr = FISCAL_MONTHS.filter((x) => n.has(x)); if (arr.length) { setFrom(`令和8年${arr[0] === '決' ? '3' : arr[0]}月1日`); setTo(`令和8年${arr[arr.length - 1] === '決' ? '3' : arr[arr.length - 1]}月末日`); } return n; });
  if (!report) return null;
  const run = () => {
    if (output === OUTPUTS[1]) { onPreview(report.name, { from, to, output }); onClose(); return; }
    toast.show(`${report.name}：${output.replace('する', '')}（プロトタイプでは動作しません）`);
    onClose();
  };
  const chip = (on: boolean): CSSProperties => ({ minWidth: 30, height: 26, padding: '0 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: on ? '#f4d03f' : '#e8f0fb', color: on ? '#22303c' : '#2c5f9e', border: '1px solid ' + (on ? '#d4b62c' : '#c9d9ec') });
  return (
    <Modal open={open} onClose={onClose} width={720} title={<>{report.name} の印刷 <span style={{ fontSize: 11.5, color: '#7a8794', fontWeight: 500, marginLeft: 8 }}>{report.cat}</span></>}>
      <ToastView msg={toast.msg} />
      <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 14 }}>
        <div>
          <span style={lbl}>年月日指定（4〜決のボタンでも指定できます：青＝無効・黄＝有効）</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>{FISCAL_MONTHS.map((m) => <button key={m} type="button" onClick={() => toggleMonth(m)} style={chip(months.has(m))}>{m}</button>)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input className="field-input" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...input, width: 170 }} /><span>〜</span><input className="field-input" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...input, width: 170 }} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <span style={lbl}>チェック、付箋</span>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12.5 }}>
              <label style={{ display: 'flex', gap: 5, alignItems: 'center' }}><input type="checkbox" checked={checks.check} onChange={() => setChecks({ ...checks, check: !checks.check })} />チェック</label>
              {([['red', '赤', '#c0392b'], ['blue', '青', '#2c5f9e'], ['yellow', '黄', '#b7791f'], ['green', '緑', '#1f7a52']] as const).map(([k, l, c]) => <label key={k} style={{ display: 'flex', gap: 5, alignItems: 'center', color: c }}><input type="checkbox" checked={checks[k]} onChange={() => setChecks({ ...checks, [k]: !checks[k] })} />{l}</label>)}
            </div>
          </div>
          {report.scope ? (
            <div><span style={lbl}>科目指定</span><div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5 }}>{['全て', '科目指定'].map((o) => <label key={o} style={{ display: 'flex', gap: 5, alignItems: 'center' }}><input type="radio" checked={scope === o} onChange={() => setScope(o)} />{o}</label>)}{scope === '科目指定' && <span style={{ color: '#7a8794' }}>スタート〜エンド（科目検索）</span>}</div></div>
          ) : report.cat === '試算表' || report.cat === '決算書' ? (
            <div><span style={lbl}>印刷範囲設定</span><div style={{ display: 'flex', gap: 8, fontSize: 12.5, flexWrap: 'wrap' }}>{['範囲指定の合計を印刷', '範囲指定の月を連続で印刷'].map((o) => <label key={o} style={{ display: 'flex', gap: 5, alignItems: 'center' }}><input type="radio" checked={range === o} onChange={() => setRange(o)} />{o}</label>)}</div></div>
          ) : <div />}
        </div>
        <div>
          <span style={lbl}>出力先（印刷）の指定</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 12.5 }}>{OUTPUTS.map((o) => <label key={o} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '5px 8px', borderRadius: 8, background: output === o ? '#eef2f6' : 'transparent' }}><input type="radio" checked={output === o} onChange={() => setOutput(o)} />{o}</label>)}</div>
        </div>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10 }}>
          <button type="button" onClick={() => setDetail((d) => !d)} style={{ width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', background: '#f8fafc', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: '#22303c', borderRadius: 10 }}>{detail ? '▾' : '▸'} 詳細設定 <span style={{ fontWeight: 500, color: '#8290a0' }}>（{report.detail.length}項目）</span></button>
          {detail && (
            <div style={{ padding: '10px 12px 12px', display: 'grid', gap: 8 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}><input type="checkbox" checked={useCommon} onChange={() => setUseCommon(!useCommon)} />共通の印刷設定を使う（印刷位置・行の間隔・印刷項目は「共通の印刷設定」に従う）</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', opacity: useCommon ? 0.55 : 1 }}>
                {report.detail.map((d) => <label key={d} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12 }}><input type="checkbox" defaultChecked={/印刷する$|自動調整|網掛け/.test(d)} disabled={useCommon} style={{ marginTop: 3 }} /><span>{d}</span></label>)}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: '#5b6773', flexWrap: 'wrap' }}>
                <span>捺印欄：{s.print.stamps.filter(Boolean).join('・') || 'なし'}</span><span>印刷位置調整：横 {s.print.offsetX}mm／縦 {s.print.offsetY}mm</span><span>印刷書式：{s.print.fontName}</span>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={btn()}>キャンセル</button>
          <button type="button" className="submit-btn" onClick={run} style={btn(accent, true)}>{output === OUTPUTS[1] ? 'プレビュー' : '印刷'}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- プレビュー ---------------- */
export function PreviewModal({ open, onClose, title, opts, pages = 3, accent, children }: { open: boolean; onClose: () => void; title: string; opts?: { from: string; to: string; output: string }; pages?: number; accent: string; children?: ReactNode }) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const toast = useToast();
  const s = useSession();
  return (
    <Modal open={open} onClose={onClose} width={900} title={<>印刷プレビュー <span style={{ fontSize: 12, color: '#7a8794', fontWeight: 500, marginLeft: 8 }}>{title}</span></>}>
      <ToastView msg={toast.msg} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderBottom: '1px solid #eef2f5', background: '#f8fafc', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => toast.show('プリンターの印刷ダイアログ：プロトタイプでは動作しません')} style={btn(accent, true, true)}>印刷</button>
        <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} style={btn('#5b6773', false, true)}>前ページ</button>
        <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{page} / {pages}</span>
        <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} style={btn('#5b6773', false, true)}>次ページ</button>
        <button type="button" onClick={() => setZoom((z) => Math.min(1.6, z + 0.2))} style={btn('#5b6773', false, true)}>拡大</button>
        <button type="button" onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} style={btn('#5b6773', false, true)}>縮小</button>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => toast.show('Excel出力（.xlsx）：プロトタイプでは動作しません')} style={btn('#1f7a52', false, true)}>Excel出力</button>
          <button type="button" onClick={() => toast.show('PDF出力：プロトタイプでは動作しません')} style={btn('#c0392b', false, true)}>PDF出力</button>
          <button type="button" onClick={onClose} style={btn('#5b6773', false, true)}>閉じる</button>
        </span>
      </div>
      <div style={{ background: '#5f6b77', padding: 20, maxHeight: '70vh', overflow: 'auto' }}>
        <div style={{ width: 640 * zoom, minHeight: 880 * zoom, margin: '0 auto', background: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,.35)', padding: 36 * zoom, fontSize: 11 * zoom, color: '#22303c', fontFamily: "'Noto Sans JP', serif", transformOrigin: 'top center' }}>
          {s.print.items.corp && <div style={{ fontSize: 10 * zoom, color: '#5b6773' }}>社会福祉法人 チャイルド保育園　{s.division}</div>}
          <div style={{ textAlign: 'center', fontSize: 15 * zoom, fontWeight: 700, margin: `${8 * zoom}px 0 ${4 * zoom}px`, letterSpacing: '.1em' }}>{title}</div>
          {opts && <div style={{ textAlign: 'center', fontSize: 10 * zoom, color: '#5b6773', marginBottom: 12 * zoom }}>（自）{opts.from}　（至）{opts.to}　　単位：円</div>}
          {children ?? <SamplePage zoom={zoom} page={page} shade={s.print.items.shade} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 * zoom, fontSize: 9 * zoom, color: '#7a8794' }}>
            <span>{s.print.items.date ? `印刷日 2026/09/10` : ''}</span>
            {s.print.items.stamp && <span style={{ display: 'flex', gap: 4 }}>{s.print.stamps.filter(Boolean).map((n) => <span key={n} style={{ width: 44 * zoom, height: 44 * zoom, border: '1px solid #9aa5b1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>)}</span>}
            <span>{s.print.items.page ? `- ${page} -` : ''}</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '8px 16px', fontSize: 11.5, color: '#9aa5b1' }}>右クリック：コピー／検索／ズーム（本番）。レイアウトはサンプルです。</div>
    </Modal>
  );
}
function SamplePage({ zoom, page, shade }: { zoom: number; page: number; shade: boolean }) {
  const rows = Array.from({ length: 22 }, (_, i) => i + (page - 1) * 22);
  const c = (i: number) => (i * 7919) % 1000000 + 12000;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 * zoom }}>
      <thead><tr>{['勘定科目', '前月繰越', '借方', '貸方', '残高'].map((h, i) => <th key={h} style={{ border: '1px solid #9aa5b1', padding: 3 * zoom, background: shade ? '#eef2f6' : '#fff', textAlign: i ? 'right' : 'left', fontWeight: 700 }}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((i) => <tr key={i} style={{ background: shade && i % 6 === 0 ? '#f6f8fa' : '#fff' }}><td style={{ border: '1px solid #c3ccd4', padding: 3 * zoom, fontWeight: i % 6 === 0 ? 700 : 400, paddingLeft: (i % 6 === 0 ? 3 : 12) * zoom }}>{i % 6 === 0 ? '流動資産' : ['現金', '普通預金', '当座預金', '事業未収金', '立替金'][i % 5]}</td>{[c(i), c(i + 1) % 90000, c(i + 2) % 70000, c(i) + (c(i + 1) % 90000) - (c(i + 2) % 70000)].map((v, k) => <td key={k} style={{ border: '1px solid #c3ccd4', padding: 3 * zoom, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString('ja-JP')}</td>)}</tr>)}</tbody>
    </table>
  );
}

/* ---------------- 印刷センター ---------------- */
export function PrintCenterPage({ variant, accent, batch }: { variant: 'form' | 'sheet'; accent: string; batch?: boolean }) {
  const [cat, setCat] = useState(batch ? 'すべて' : '仕訳日記帳');
  const [target, setTarget] = useState<ReportDef | null>(null);
  const [preview, setPreview] = useState<{ title: string; opts: { from: string; to: string; output: string } } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(['j1', 'l1', 't1', 't2', 't3']));
  const [bOutput, setBOutput] = useState(OUTPUTS[1]);
  const toast = useToast();
  const list = REPORTS.filter((r) => cat === 'すべて' || r.cat === cat);
  return (
    <SettingsShell variant={variant} title={batch ? '一括印刷' : '印刷センター'} badge="印刷" desc={batch ? '複数の帳票をまとめて印刷します。期間と出力先を1回指定するだけで、選んだ帳票を順に出力します（既存のお気に入り「帳票一括印刷」に相当）。' : 'すべての帳票をここから印刷します。帳票を選ぶと、期間・出力先・詳細設定を1つのダイアログで指定してプレビューできます。各画面の「印刷」ボタンからも同じダイアログが開きます。'} draft actions={batch ? <>
      <select value={bOutput} onChange={(e) => setBOutput(e.target.value)} style={{ ...input, width: 240 }}>{OUTPUTS.map((o) => <option key={o}>{o}</option>)}</select>
      <button type="button" className="submit-btn" onClick={() => { if (!selected.size) return toast.show('帳票を選んでください'); if (bOutput === OUTPUTS[1]) setPreview({ title: `一括印刷（${selected.size}帳票）`, opts: { from: '令和8年8月1日', to: '令和8年8月31日', output: bOutput } }); else toast.show(`${selected.size}帳票を出力（プロトタイプでは動作しません）`); }} style={btn(accent, true)}>選んだ {selected.size} 帳票を印刷</button>
    </> : <button type="button" className="btn-outline" onClick={() => toast.show('「印刷」メニュー →「共通の印刷設定」で印刷位置・行間・捺印欄などを設定できます')} style={btn()}>共通の印刷設定</button>}>
      <ToastView msg={toast.msg} />
      <div style={{ display: 'grid', gridTemplateColumns: '200px minmax(0,1fr)', minHeight: 420 }}>
        <div style={{ borderRight: '1px solid #eef2f5', padding: 10 }}>
          {['すべて', ...CATS].map((c) => {
            const n = c === 'すべて' ? REPORTS.length : REPORTS.filter((r) => r.cat === c).length;
            const on = cat === c;
            return <button key={c} type="button" onClick={() => setCat(c)} style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', borderRadius: 8, background: on ? accent : 'transparent', color: on ? '#fff' : '#22303c', fontSize: 13, fontWeight: on ? 700 : 500, fontFamily: 'inherit', cursor: 'pointer' }}>{c}<span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>{n}</span></button>;
          })}
        </div>
        <div style={{ padding: 16 }}>
          {batch && <div style={{ marginBottom: 10 }}><Notice>期間は「令和8年8月1日〜8月31日」（当月）で一括指定。帳票ごとの詳細設定は各帳票の設定値を使います。</Notice></div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {list.map((r) => {
              const on = selected.has(r.id);
              return (
                <div key={r.id} onClick={() => (batch ? setSelected((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; }) : setTarget(r))} style={{ ...card, padding: '12px 14px', cursor: 'pointer', borderColor: batch && on ? accent : '#e2e8ee', background: batch && on ? '#f4f9f6' : '#fff', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  {batch && <input type="checkbox" checked={on} readOnly style={{ marginTop: 3 }} />}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: '#8290a0', marginTop: 2 }}>{r.cat}　詳細設定 {r.detail.length} 項目{r.note ? `　${r.note}` : ''}</div>
                  </div>
                  {!batch && <span style={{ fontSize: 11.5, fontWeight: 700, color: accent, whiteSpace: 'nowrap' }}>印刷 →</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <PrintDialog open={!!target} onClose={() => setTarget(null)} report={target} accent={accent} onPreview={(title, opts) => setPreview({ title, opts })} />
      <PreviewModal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ''} opts={preview?.opts} accent={accent} />
    </SettingsShell>
  );
}

/* ---------------- 共通の印刷設定 ---------------- */
export function CommonPrintSettingsPage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  const s = useSession();
  const p = s.print;
  const set = (patch: Partial<typeof p>) => setSession({ print: { ...p, ...patch } });
  const toast = useToast();
  const [foot, setFoot] = useState<string | null>(null);
  const [footText, setFootText] = useState('');
  const [preview, setPreview] = useState(false);
  const FOOT_REPORTS = ['資金収支計算書（第一号第一様式）', '資金収支計算書（第一号第四様式）', '事業活動計算書', '貸借対照表'];
  return (
    <SettingsShell variant={variant} title="共通の印刷設定" badge="印刷" desc="すべての帳票に共通する印刷条件です。各帳票の印刷ダイアログで「共通の印刷設定を使う」にすると、ここでの設定が使われます（マニュアル 7.1.2）。" actions={<>
      <button type="button" className="btn-outline" onClick={() => setPreview(true)} style={btn()}>プレビューで確認</button>
      <button type="button" className="btn-outline" onClick={() => toast.show('他の区分の印刷設定を読み込みました（プロトタイプ）')} style={btn()}>他区分の設定を読込</button>
      <button type="button" className="submit-btn" onClick={() => toast.show('共通の印刷設定を保存しました')} style={btn(accent, true)}>決定</button>
    </>}>
      <ToastView msg={toast.msg} />
      <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={card}>
            <div style={cardHead}>印刷位置・行の間隔</div>
            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="印刷位置（印刷する勘定科目の範囲）" span={2}><select value={p.depth} onChange={(e) => set({ depth: e.target.value })} style={input}>{['大区分まで印刷', '中区分まで印刷', '小区分まで印刷', '細区分まで印刷', '細々区分まで印刷', '個別の設定を使う'].map((o) => <option key={o}>{o}</option>)}</select></Field>
              <Field label="行の間隔"><select value={p.lineGap} onChange={(e) => set({ lineGap: e.target.value })} style={input}>{['上・下空き', '上のみ空き', '空きなし', '個別の設定を使う'].map((o) => <option key={o}>{o}</option>)}</select></Field>
              <Field label="空きの間隔"><select value={p.gapSize} onChange={(e) => set({ gapSize: e.target.value })} style={input} disabled={p.lineGap === '空きなし'}>{['1mm', '2mm', '3mm', '4mm'].map((o) => <option key={o}>{o}</option>)}</select></Field>
              <Field label="内訳帳票：1ページの区分数"><select value={String(p.perPage)} onChange={(e) => set({ perPage: Number(e.target.value) })} style={input}>{[4, 5, 6, 7, 8].map((o) => <option key={o}>{o}</option>)}</select></Field>
              <div style={{ display: 'grid', gap: 6, alignSelf: 'end' }}>
                <Toggle on={p.twoLineNames} onChange={(v) => set({ twoLineNames: v })} accent={accent} label="項目名を二行で印刷する" />
                <Toggle on={p.autoFontHeader} onChange={(v) => set({ autoFontHeader: v })} accent={accent} label="項目名のフォントサイズを自動調整" />
              </div>
            </div>
          </div>
          <div style={card}>
            <div style={cardHead}>印刷位置調整・印刷書式</div>
            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="印刷位置調整（mm）">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 34px)', gap: 4, alignItems: 'center' }}>
                  <span /><button type="button" onClick={() => set({ offsetY: p.offsetY - 1 })} style={btn('#5b6773', false, true)}>↑</button><span />
                  <button type="button" onClick={() => set({ offsetX: p.offsetX - 1 })} style={btn('#5b6773', false, true)}>←</button><span style={{ fontSize: 11, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{p.offsetX},{p.offsetY}</span><button type="button" onClick={() => set({ offsetX: p.offsetX + 1 })} style={btn('#5b6773', false, true)}>→</button>
                  <span /><button type="button" onClick={() => set({ offsetY: p.offsetY + 1 })} style={btn('#5b6773', false, true)}>↓</button><span />
                </div>
              </Field>
              <div style={{ display: 'grid', gap: 8 }}>
                <Field label="印刷幅：科目（mm）"><input className="field-input" value={String(p.widthName)} onChange={(e) => set({ widthName: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })} style={numInput} /></Field>
                <Field label="印刷幅：金額（mm）"><input className="field-input" value={String(p.widthAmount)} onChange={(e) => set({ widthAmount: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })} style={numInput} /></Field>
              </div>
              {(['fontHeader', 'fontName', 'fontAmount'] as const).map((k, i) => <Field key={k} label={['ヘッダー', '科目名', '金額'][i] + 'のフォント'}><select value={p[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<typeof p>)} style={input}>{['Noto Sans JP 9pt', 'Noto Sans JP 10pt', 'Noto Sans JP 11pt', 'Noto Serif JP 10pt', 'ＭＳ 明朝 10pt', 'ＭＳ ゴシック 10pt'].map((o) => <option key={o}>{o}</option>)}</select></Field>)}
              <div style={{ alignSelf: 'end' }}><button type="button" onClick={() => set({ widthName: 60, widthAmount: 28, fontHeader: 'Noto Sans JP 11pt', fontName: 'Noto Sans JP 9pt', fontAmount: 'Noto Sans JP 9pt', offsetX: 0, offsetY: 0 })} style={btn()}>リセット</button></div>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={card}>
            <div style={cardHead}>印刷項目の切替え</div>
            <div style={{ padding: 14, display: 'grid', gap: 8 }}>
              {PRINT_ITEMS.map(([k, label]) => <Toggle key={k} on={!!p.items[k]} onChange={(v) => set({ items: { ...p.items, [k]: v } })} accent={accent} label={label} />)}
            </div>
          </div>
          <div style={card}>
            <div style={cardHead}>捺印欄（最大4名）・脚注</div>
            <div style={{ padding: 14, display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>{p.stamps.map((v, i) => <input key={i} className="field-input" value={v} onChange={(e) => set({ stamps: p.stamps.map((x, k) => (k === i ? e.target.value : x)) })} placeholder={`捺印${i + 1}`} style={input} />)}</div>
              <div style={{ fontSize: 12, color: '#7a8794' }}>脚注（（注）予備費の充当額等）を帳票ごとに編集：</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>{FOOT_REPORTS.map((r) => <tr key={r}><td style={{ ...TD, fontSize: 12.5 }}>{r}</td><td style={{ ...TD, fontSize: 11.5, color: '#7a8794' }}>{p.footnotes[r] ? p.footnotes[r].slice(0, 28) + (p.footnotes[r].length > 28 ? '…' : '') : '（未設定）'}</td><td style={{ ...TD, textAlign: 'right' }}><button type="button" onClick={() => { setFoot(r); setFootText(p.footnotes[r] ?? ''); }} style={btn('#5b6773', false, true)}>編集</button></td></tr>)}</tbody></table>
            </div>
          </div>
        </div>
      </div>
      <Modal open={!!foot} onClose={() => setFoot(null)} width={560} title={`脚注編集：${foot ?? ''}`}>
        <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 10 }}>
          <textarea value={footText} onChange={(e) => setFootText(e.target.value)} rows={5} placeholder="（注）予備費の充当額 ○○円 は …" style={{ ...input, resize: 'vertical', lineHeight: 1.7 }} />
          <Notice tone="warn">脚注は帳票の最下部に印刷されます。改行はそのまま反映されます。長すぎると2ページ目に送られることがあります。</Notice>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setFoot(null)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => { if (foot) set({ footnotes: { ...p.footnotes, [foot]: footText } }); setFoot(null); }} style={btn(accent, true)}>OK</button></div>
        </div>
      </Modal>
      <PreviewModal open={preview} onClose={() => setPreview(false)} title="資金収支計算書（共通設定の確認）" opts={{ from: '令和8年4月1日', to: '令和8年8月31日', output: OUTPUTS[1] }} accent={accent} />
    </SettingsShell>
  );
}

export function PrintTableHead({ cols }: { cols: string[] }) { return <thead><tr>{cols.map((c) => <th key={c} style={TH}>{c}</th>)}</tr></thead>; }
