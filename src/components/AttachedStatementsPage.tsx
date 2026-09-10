// 決算附属明細書（提案L）：設定1〜3（科目設定・伝票入力時の監視）、明細書ごとの明細入力、財産目録の行設定、注記編集、合算テーブル作成。
//   マニュアル 7.5.2・7.5.3・7.8・4.7 に相当。

import { useState } from 'react';
import { Modal } from './Modal';
import { NUM, TD, TH } from './ReportShell';
import { NOT_IMPL, ToastView, useToast } from './Toast';
import { Field, Notice, SettingsShell, Tabs, Toggle, btn, card, cardHead, input, numInput, toInt, yen } from './ui';
import { SERVICES } from '../data';

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
  const [fromAcct, setFromAcct] = useState(true);
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
                <td style={TD}><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{w.accts.map((a) => <span key={a} style={{ padding: '2px 8px', background: '#eef2f6', borderRadius: 6, fontSize: 11.5 }}>{a}</span>)}<button type="button" onClick={() => toast.show('科目の追加：' + NOT_IMPL)} style={{ ...btn('#5b6773', false, true), padding: '1px 8px' }}>＋</button></div></td>
                <td style={TD}><Toggle on={!!watch[w.key]} onChange={(v) => setWatch({ ...watch, [w.key]: v })} accent={accent} label={watch[w.key] ? '監視する' : '監視しない'} /></td>
                <td style={{ ...TD, fontSize: 12 }}>{w.key === 'hojo' ? <label style={{ display: 'flex', gap: 5 }}><input type="checkbox" checked={fromAcct} onChange={(e) => setFromAcct(e.target.checked)} />科目から明細を作成する</label> : w.extra ? <button type="button" onClick={() => toast.show(`${w.extra}：` + NOT_IMPL)} style={btn('#5b6773', false, true)}>{w.extra}</button> : '—'}</td>
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
              <button type="button" onClick={() => toast.show('設定ファイル読込：' + NOT_IMPL)} style={btn()}>設定ファイル読込</button><button type="button" onClick={() => toast.show('設定ファイル保存：' + NOT_IMPL)} style={btn()}>設定ファイル保存</button>
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
            <button type="button" onClick={() => toast.show('設定ファイル読込：' + NOT_IMPL)} style={btn()}>設定ファイル読込</button>
            <button type="button" onClick={() => toast.show('設定ファイル保存：' + NOT_IMPL)} style={btn()}>設定ファイル保存</button>
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
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}><button type="button" onClick={() => toast.show('テーブル書出：' + NOT_IMPL)} style={btn()}>テーブル書出</button><button type="button" onClick={() => toast.show('テーブル読込：' + NOT_IMPL)} style={btn()}>テーブル読込</button><button type="button" onClick={() => toast.show('印刷書式：' + NOT_IMPL)} style={btn()}>印刷書式</button></span>
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
    </SettingsShell>
  );
}
