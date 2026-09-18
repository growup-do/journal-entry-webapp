// 勘定科目設定の詳細（提案G）：勘定科目／資金科目タブ、費目、使用科目設定、詳細フォーム（A〜F属性・資金科目連動・キーコード）、
//   プレビュー・Excel／CSV・印刷・仕訳の再集計。マニュアル 2.3 に相当。摘要辞書の自動補完候補もここ（SummaryDictPage）。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { ExplainModal } from './ExplainModal';
import { ExportDialog, type ExportKind, type ExportSpec } from './ExportDialog';
import { Modal } from './Modal';
import { NUM, TD, TH } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { Field, Notice, SettingsShell, Tabs, btn, card, cardHead, input, lbl } from './ui';
import { ACCOUNT_META, type AccountMeta } from '../lib/accounts';
import { SERVICES, SUMMARIES } from '../data';

const HIMOKU_BS = [[1, 'サービス活動収益計 (1)'], [2, 'サービス活動費用計 (2)'], [3, 'サービス活動増減差額 (3)=(1)-(2)'], [4, 'サービス活動外収益計 (4)'], [5, 'サービス活動外費用計 (5)'], [7, '経常増減差額 (7)=(3)+(6)'], [8, '特別収益計 (8)'], [9, '特別費用計 (9)'], [11, '当期活動増減差額 (11)'], [50, '流動資産'], [51, '基本財産'], [52, 'その他の固定資産'], [60, '流動負債'], [61, '固定負債'], [70, '基本金'], [71, '国庫補助金等特別積立金'], [72, 'その他の積立金'], [80, '次期繰越活動増減差額']] as const;
const HIMOKU_FUND = [[1, '事業活動収入計 (1)'], [2, '事業活動支出計 (2)'], [3, '事業活動資金収支差額 (3)'], [4, '施設整備等収入計 (4)'], [5, '施設整備等支出計 (5)'], [7, 'その他の活動収入計 (7)'], [8, 'その他の活動支出計 (8)'], [10, '予備費支出 (10)'], [11, '当期資金収支差額合計 (11)'], [12, '前期末支払資金残高 (12)'], [13, '当期末支払資金残高 (11)+(12)']] as const;

interface AcctRow extends AccountMeta { himoku: string; kubun: string; printName: string; dispName: string; a: '1' | '2'; b: string; c: '0' | '1'; d: '0' | '1'; e: string; f: string; internal: string; partner: string; fundHimoku: string; fundKubun: string; key: number }
const toRow = (m: AccountMeta, i: number): AcctRow => ({
  ...m, himoku: m.cls === '費用' ? '2' : m.cls === '収益' ? '1' : m.cls === '現預金' || m.cls === '資産' ? '50' : '60', kubun: `${m.code.slice(0, 3)}-${m.code.slice(3)}-00-00-00`, printName: m.name, dispName: m.name,
  a: m.cls === '収益' ? '2' : '1', b: m.cls === '現預金' ? (m.name.includes('現金') ? '1：現金科目' : '2：預金科目') : '0：科目特性無し', c: /手当|俸給/.test(m.name) ? '1' : '0', d: '1', e: m.cls === '費用' ? '2：借方減算＆貸方加算' : m.cls === '収益' ? '1：借方加算＆貸方減算' : m.cls === '現預金' ? '4：資金科目' : '0：両加算',
  f: '0', internal: '0：通常の勘定科目', partner: '', fundHimoku: m.cls === '費用' ? '2' : m.cls === '収益' ? '1' : '', fundKubun: m.cls === '費用' || m.cls === '収益' ? `${m.code.slice(0, 3)}-${m.code.slice(3)}-00-00-00` : '', key: 1000 + i,
});

export function AccountSettingsPage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  const toast = useToast();
  const [tab, setTab] = useState('勘定科目');
  const [rows, setRows] = useState<AcctRow[]>(() => ACCOUNT_META.map(toRow));
  const [selKey, setSelKey] = useState<number | null>(rows[0]?.key ?? null);
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState(false);
  const [exp, setExp] = useState<ExportSpec | null>(null);
  const [recalc, setRecalc] = useState<null | number>(null);
  const [use, setUse] = useState<Record<string, boolean>>(() => Object.fromEntries(ACCOUNT_META.flatMap((m) => SERVICES.map((s) => [m.name + '|' + s, !(s.startsWith('005') && m.cls !== '現預金')]))));
  const [link, setLink] = useState<'しない' | '区分内' | '横一列'>('しない');
  const [himokuNames, setHimokuNames] = useState<Record<number, string>>({});
  const [cautionOpen, setCautionOpen] = useState(false);
  /** ▲入換▼：選択中の科目と同じグループ（貸借／損益の区分）の並び順を編集する */
  const [swap, setSwap] = useState<{ cls: AccountMeta['cls']; keys: number[]; cur: number; drag: number | null } | null>(null);
  const sel = rows.find((r) => r.key === selKey) ?? null;
  const openSwap = () => { if (!sel) return; const keys = rows.filter((r) => r.cls === sel.cls).map((r) => r.key); setSwap({ cls: sel.cls, keys, cur: keys.indexOf(sel.key), drag: null }); };
  const moveSwap = (from: number, to: number) => setSwap((sw) => { if (!sw || to < 0 || to >= sw.keys.length || from === to) return sw; const keys = [...sw.keys]; const [k] = keys.splice(from, 1); keys.splice(to, 0, k); return { ...sw, keys, cur: to }; });
  const applySwap = () => {
    if (!swap) return;
    // グループ内の行だけを新しい順序で差し替える（他グループの位置は変えない）
    const ordered = swap.keys.map((k) => rows.find((r) => r.key === k)!);
    let i = 0;
    setRows((rs) => rs.map((r) => (r.cls === swap.cls ? ordered[i++] : r)));
    setSwap(null); toast.show(`${swap.cls}グループの並び順を更新しました（${swap.keys.length} 科目）`);
  };
  const upd = (p: Partial<AcctRow>) => sel && setRows((rs) => rs.map((r) => (r.key === sel.key ? { ...r, ...p } : r)));
  const list = rows.filter((r) => (tab === '資金科目' ? r.fund !== '—' && r.fund !== '（支払資金）' : true) && (!q || r.name.includes(q) || r.code.includes(q) || r.kana.includes(q)));
  const addNew = () => { const key = Math.max(...rows.map((r) => r.key)) + 1; const n: AcctRow = { ...toRow({ name: '新しい科目', code: '9900', kana: '', kind: 'PL', cls: '費用', fund: '新しい科目支出' }, key), key }; setRows((rs) => [...rs, n]); setSelKey(key); };
  const runRecalc = () => { setRecalc(0); const t0 = Date.now(); const id = window.setInterval(() => { const p = Math.min(100, Math.round((Date.now() - t0) / 30)); setRecalc(p); if (p >= 100) { window.clearInterval(id); setTimeout(() => { setRecalc(null); toast.show('仕訳の更新が完了しました（全伝票の勘定科目と資金科目の連動を整理）'); }, 400); } }, 100); };
  const toggleUse = (name: string, svc: string) => {
    const k = name + '|' + svc; const v = !use[k];
    setUse((u) => { const n = { ...u, [k]: v }; if (link === '区分内') ACCOUNT_META.forEach((m) => { n[m.name + '|' + svc] = v; }); if (link === '横一列') SERVICES.forEach((s) => { n[name + '|' + s] = v; }); return n; });
  };
  const small: CSSProperties = { ...input, padding: '5px 8px', fontSize: 12.5 };
  // Excel／ファイル（CSV）／印刷：表示中のタブ（勘定科目／資金科目）の一覧を出力（既存の「貸借科目 Excel 出力」「事業科目 Excel 出力」「ファイル」に相当）
  const exportList = (kind: ExportKind) => {
    const fund = tab === '資金科目';
    setExp({
      kind, title: fund ? '資金科目一覧' : '勘定科目一覧', meta: `${list.length} 件${q ? `　検索：${q}` : ''}`,
      header: ['表示コード', '費目', '区分コード', fund ? '資金科目' : '科目名', '印刷用科目名称', 'フリガナ', 'A', 'B', 'C', 'D', 'E', 'F', '内部取引', fund ? '勘定科目' : '資金科目', 'キー'],
      rows: list.map((r) => [r.code, fund ? r.fundHimoku : r.himoku, fund ? r.fundKubun : r.kubun, fund ? r.fund : r.dispName, r.printName, r.kana, r.a, r.b.split('：')[0], r.c, r.d, r.e.split('：')[0], r.f, r.internal.split('：')[0], fund ? r.dispName : r.fund, r.key]),
    });
  };
  // 使用科目設定のファイル出力（CSV）：科目 × 区分の使用可否（1＝使用）
  const exportUse = (which: 'fund' | 'bs') => {
    const metas = ACCOUNT_META.filter((m) => (which === 'fund' ? m.fund !== '—' && m.fund !== '（支払資金）' : true));
    setExp({
      kind: 'csv', title: which === 'fund' ? '資金科目（使用科目設定）' : '貸借・事業科目（使用科目設定）', meta: `${metas.length} 科目 × ${SERVICES.length} 区分`,
      header: ['科目', which === 'fund' ? '資金科目' : '区分', ...SERVICES],
      rows: metas.map((m) => [m.name, which === 'fund' ? m.fund : m.cls, ...SERVICES.map((sv) => (use[m.name + '|' + sv] ? 1 : 0))]),
    });
  };

  return (
    <SettingsShell variant={variant} title="勘定科目" desc="勘定科目・資金科目の設定（表示コード・費目・区分コード・A〜F属性・資金科目との連動・キーコード）、費目、使用科目設定。既存の【科目設定】【費目入力】【使用科目設定】に相当します。" actions={<>
      <button type="button" className="btn-outline" onClick={() => setPreview(true)} style={btn()}>プレビュー</button>
      <button type="button" className="btn-outline" onClick={() => exportList('excel')} style={btn()}>Excel出力</button>
      <button type="button" className="btn-outline" onClick={() => exportList('csv')} style={btn()}>ファイル（CSV）</button>
      <button type="button" className="btn-outline" onClick={() => exportList('print')} style={btn()}>印刷</button>
      <button type="button" className="btn-outline" onClick={() => { if (confirm('仕訳更新を開始します。1年分の全伝票を対象に、勘定科目と資金科目の連動を整理・更新します。途中で中断はできません。よろしいですか？')) runRecalc(); }} style={btn('#b7791f')}>仕訳の再集計</button>
      {(tab === '勘定科目' || tab === '資金科目') && <button type="button" className="submit-btn" onClick={addNew} style={btn(accent, true)}>＋ 科目を追加</button>}
    </>}>
      <ToastView msg={toast.msg} />
      <Tabs items={['勘定科目', '資金科目', '費目', '使用科目設定']} current={tab} onChange={setTab} accent={accent} />

      {(tab === '勘定科目' || tab === '資金科目') && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 1fr) minmax(420px, 1.1fr)', minHeight: 520 }}>
          <div style={{ borderRight: '1px solid #eef2f5' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #eef2f5', display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="科目名・コード・フリガナで検索" style={{ ...input, width: 260 }} />
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8895a3' }}>{list.length} 件　ダブルクリックで編集</span>
            </div>
            <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ ...TH, width: 70 }}>表示コード</th><th style={{ ...TH, width: 50 }}>費目</th><th style={{ ...TH, width: 130 }}>区分コード</th><th style={TH}>{tab === '資金科目' ? '資金科目' : '科目名'}</th><th style={{ ...TH, width: 50 }}>A</th><th style={{ ...TH, width: 50 }}>B</th><th style={{ ...TH, width: 60 }}>キー</th></tr></thead>
                <tbody>{list.map((r) => <tr key={r.key} onClick={() => setSelKey(r.key)} onDoubleClick={() => setSelKey(r.key)} style={{ cursor: 'pointer', background: selKey === r.key ? '#eef2f6' : 'transparent' }}><td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{r.code}</td><td style={TD}>{tab === '資金科目' ? r.fundHimoku : r.himoku}</td><td style={{ ...TD, fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{tab === '資金科目' ? r.fundKubun : r.kubun}</td><td style={{ ...TD, fontWeight: 600 }}>{tab === '資金科目' ? r.fund : r.dispName}</td><td style={TD}>{r.a}</td><td style={TD}>{r.b.split('：')[0]}</td><td style={{ ...TD, color: '#8290a0', fontVariantNumeric: 'tabular-nums' }}>{r.key}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
          <div style={{ padding: 16, overflow: 'auto', maxHeight: 'calc(100vh - 330px)' }}>
            {!sel ? <div style={{ color: '#9aa5b1' }}>左の一覧から科目を選んでください。</div> : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: '#fff1b8', color: '#8a6d00' }}>編集中</span><b>{sel.dispName}</b><span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#8290a0' }}>キーコード {sel.key}（登録順に自動付与・変更不可）</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <Field label="表示コード（1〜9桁）"><input className="field-input ring" value={sel.code} onChange={(e) => upd({ code: e.target.value.replace(/[^0-9]/g, '').slice(0, 9) })} style={small} /></Field>
                  <Field label="費目コード"><select value={sel.himoku} onChange={(e) => upd({ himoku: e.target.value })} style={small}>{HIMOKU_BS.map(([n, l]) => <option key={n} value={String(n)}>{n} {l}</option>)}</select></Field>
                  <Field label="区分コード（3-2-2-2-2）"><input className="field-input ring" value={sel.kubun} onChange={(e) => upd({ kubun: e.target.value })} style={{ ...small, fontVariantNumeric: 'tabular-nums' }} /></Field>
                  <Field label="印刷用科目名称（40文字まで）" span={2}><input className="field-input ring" value={sel.printName} onChange={(e) => upd({ printName: e.target.value.slice(0, 40), dispName: sel.dispName === sel.printName ? e.target.value.slice(0, 40) : sel.dispName })} style={small} /></Field>
                  <Field label="フリガナ（半角カナ・検索用）"><input className="field-input" value={sel.kana} onChange={(e) => upd({ kana: e.target.value })} style={small} /></Field>
                  <Field label="表示用科目名称" span={3}><input className="field-input ring" value={sel.dispName} onChange={(e) => upd({ dispName: e.target.value })} style={small} /></Field>
                  <Field label="A（貸借区分）"><select value={sel.a} onChange={(e) => upd({ a: e.target.value as '1' | '2' })} style={small}><option value="1">1：借方</option><option value="2">2：貸方</option></select></Field>
                  <Field label="B（特質指定コード）"><select value={sel.b} onChange={(e) => upd({ b: e.target.value })} style={small}>{['0：科目特性無し', '1：現金科目（小口現金連動）', '2：預金科目', '7：予算にのみ使用する科目', '8：前年度繰越額', '9：当年度繰越額'].map((o) => <option key={o}>{o}</option>)}</select></Field>
                  <Field label="C（特殊摘要科目該当）"><select value={sel.c} onChange={(e) => upd({ c: e.target.value as '0' | '1' })} style={small}><option value="0">0：通常の科目</option><option value="1">1：特殊摘要で使用</option></select></Field>
                  <Field label="D（科目として伝票入力）"><select value={sel.d} onChange={(e) => upd({ d: e.target.value as '0' | '1' })} style={small}><option value="1">1：伝票に入力する</option><option value="0">0：伝票の科目欄に入力しない</option></select></Field>
                  <Field label="E（資金区分）" span={2}><select value={sel.e} onChange={(e) => upd({ e: e.target.value })} style={small}>{['0：両加算', '1：借方加算＆貸方減算', '2：借方減算＆貸方加算', '3：資金収支と無関係（減価償却費など）', '4：資金科目（流動資産・流動負債）'].map((o) => <option key={o}>{o}</option>)}</select></Field>
                  <Field label="F（事業種別）"><select value={sel.f} onChange={(e) => upd({ f: e.target.value })} style={small}><option value="0">0：指定なし</option><option value="1">1：保育事業</option><option value="2">2：子育て支援</option></select></Field>
                  <Field label="内部取引科目指定" span={2}><select value={sel.internal} onChange={(e) => upd({ internal: e.target.value })} style={small}>{['0：通常の勘定科目', '1：事業区分間の取引', '2：拠点区分間の取引', '3：サービス区分間の取引', '4：小サービス区分間の取引'].map((o) => <option key={o}>{o}</option>)}</select></Field>
                  <Field label="相手（内部取引の相手先）" span={3}><select value={sel.partner} onChange={(e) => upd({ partner: e.target.value })} style={small} disabled={sel.internal.startsWith('0')}><option value="">伝票入力時に指定</option>{SERVICES.map((s) => <option key={s}>{s}</option>)}</select></Field>
                </div>
                <div style={{ ...card, marginTop: 12 }}>
                  <div style={cardHead}>資金科目との連動 <span style={{ fontSize: 11, fontWeight: 500, color: '#8290a0' }}>資金取引時に対応する資金収支計算書の科目</span></div>
                  <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <Field label="費目"><select value={sel.fundHimoku} onChange={(e) => upd({ fundHimoku: e.target.value })} style={small}><option value="">—</option>{HIMOKU_FUND.map(([n, l]) => <option key={n} value={String(n)}>{n} {l}</option>)}</select></Field>
                    <Field label="区分コード"><input className="field-input" value={sel.fundKubun} onChange={(e) => upd({ fundKubun: e.target.value })} style={{ ...small, fontVariantNumeric: 'tabular-nums' }} /></Field>
                    <Field label="借方資金科目／貸方資金科目"><div style={{ ...small, background: '#f5f7f9', color: sel.fund === '—' ? '#9aa5b1' : '#22303c' }}>{sel.fund}</div></Field>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setCautionOpen(true)} style={btn()}>注意事項</button>
                  <button type="button" onClick={openSwap} style={btn()}>▲入換▼</button>
                  <button type="button" onClick={() => setRows((rs) => rs.map((r) => (r.key === sel.key ? toRow(ACCOUNT_META.find((m) => m.name === r.name) ?? r, r.key - 1000) : r)))} style={btn()}>入力をクリア</button>
                  <button type="button" className="submit-btn" onClick={() => toast.show(`「${sel.dispName}」を登録／更新しました`)} style={btn(accent, true)}>登録 / 更新</button>
                </div>
                <div style={{ marginTop: 10 }}><Notice tone="warn">設定されている科目を変更する前に、担当者またはカスタマーセンターへご相談ください。変更の影響は各帳票の計算結果・印刷順に及びます。</Notice></div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === '費目' && (
        <div style={{ padding: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {[['勘定費目（貸借対照表と事業活動計算書）', HIMOKU_BS], ['資金費目（資金収支計算書）', HIMOKU_FUND]].map(([title, list]) => (
            <div key={title as string} style={card}>
              <div style={cardHead}>{title as string}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={{ ...TH, width: 70 }}>費目No</th><th style={TH}>費目名称（ダブルクリックで編集）</th></tr></thead>
                <tbody>{(list as readonly (readonly [number, string])[]).map(([n, l]) => <tr key={n}><td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{n}</td><td style={{ ...TD, background: '#fff1b8' }}>{l}</td></tr>)}
                  {[14, 15, 16].map((n) => <tr key={n}><td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{n}</td><td style={TD}><input className="field-input" value={himokuNames[n] ?? ''} onChange={(e) => setHimokuNames({ ...himokuNames, [n]: e.target.value })} placeholder="（空白）Enterで確定して新規登録" style={{ ...input, padding: '3px 8px', fontSize: 12.5 }} /></td></tr>)}
                </tbody></table>
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1' }}><Notice tone="warn">費目No.99までが固定で作成されています。設定済みの「費目」を訂正・削除すると各帳票で正しい計算結果が得られなくなります。追加は空白の費目Noに名称を入れて登録します。</Notice></div>
        </div>
      )}

      {tab === '使用科目設定' && (
        <div style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={lbl}>チェック連動</span>{(['しない', '区分内', '横一列'] as const).map((l) => <label key={l} style={{ fontSize: 12.5, display: 'flex', gap: 4 }}><input type="radio" checked={link === l} onChange={() => setLink(l)} />{l}</label>)}
            <button type="button" onClick={() => setUse(Object.fromEntries(Object.keys(use).map((k) => [k, true])))} style={{ ...btn('#5b6773', false, true), marginLeft: 8 }}>全て ON</button>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7a8794' }}>区分ごとに使用する科目をチェック（帳票の表示／非表示にも使います）</span>
          </div>
          <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={TH}>科目</th>{SERVICES.map((s) => <th key={s} style={{ ...TH, textAlign: 'center', width: 110 }}>{s}</th>)}</tr></thead>
              <tbody>{ACCOUNT_META.map((m) => <tr key={m.name}><td style={{ ...TD, fontWeight: 500 }}>{m.name}<span style={{ fontSize: 10.5, color: '#9aa5b1', marginLeft: 6 }}>{m.cls}</span></td>{SERVICES.map((s) => <td key={s} style={{ ...TD, textAlign: 'center' }}><input type="checkbox" checked={!!use[m.name + '|' + s]} onChange={() => toggleUse(m.name, s)} /></td>)}</tr>)}</tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button type="button" onClick={() => exportUse('fund')} style={btn()}>資金科目ファイル出力</button><button type="button" onClick={() => exportUse('bs')} style={btn()}>貸借・事業科目ファイル出力</button><button type="button" className="submit-btn" onClick={() => toast.show('使用科目設定を保存しました')} style={{ ...btn(accent, true), marginLeft: 'auto' }}>OK</button></div>
        </div>
      )}

      <ExportDialog spec={exp} onClose={() => setExp(null)} accent={accent} />
      <Modal open={preview} onClose={() => setPreview(false)} width={760} title="プレビュー（登録されている科目の一覧）">
        <div style={{ padding: '10px 22px 18px', maxHeight: '70vh', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={TH}>コード</th><th style={TH}>科目名</th><th style={TH}>区分</th><th style={TH}>資金科目</th><th style={{ ...TH, textAlign: 'right' }}>キー</th></tr></thead><tbody>{rows.map((r) => <tr key={r.key}><td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{r.code}</td><td style={TD}>{r.dispName}</td><td style={TD}>{r.kind}・{r.cls}</td><td style={TD}>{r.fund}</td><td style={NUM}>{r.key}</td></tr>)}</tbody></table>
        </div>
      </Modal>
      <ExplainModal open={cautionOpen} onClose={() => setCautionOpen(false)} accent={accent} title="勘定科目設定の注意事項" source="マニュアル 2.3.4 勘定科目・資金科目の設定／2.2 キーコード" sections={[
        { h: '変更前に必ずご相談ください', body: <>設定されている科目を変更する前に、担当者またはカスタマーセンター（Tel:050-3786-5432）までご相談ください。科目を変更・修正した結果の影響（帳票の計算結果・印刷順・過去伝票の表示）については補償の対象外です。</>},
        { h: '科目の追加', body: <>「＋ 科目を追加」で新規科目を作り、表示コード（1〜9桁）・費目・区分コード（3-2-2-2-2）・印刷用科目名称・A〜F属性を設定して「登録／更新」します。費用・収益の科目は「資金科目との連動」（費目・区分コード）も必ず設定してください。連動が無いと資金収支計算書に反映されません。</>},
        { h: '科目の削除・変更', body: <>伝票で使用済みの科目は削除できません（先に伝票側の科目を付け替えるか、「使用科目設定」で非表示にします）。表示コードや区分コードを変更しても過去の伝票はキーコードで紐付いているため壊れませんが、帳票上の並び順・集計位置が変わります。変更後は「仕訳の再集計」を実行してください。</>},
        { h: '科目の移動（▲入換▼）', body: <>並び順の変更は「▲入換▼」で同じグループ内の科目を上下に入れ換えます。入換画面へ移動すると編集中の入力はクリアされます。費目をまたぐ移動は費目コード・区分コードの変更で行い、費目の集計行（費目No.99まで）は固定のため訂正・削除しないでください。</>},
        { h: 'キーコード', body: <>登録された伝票が持つ科目情報は「キーコード」（登録順にシステムが自動付与・変更不可）のみです。複数の端末で運用する場合は、特定の1台でのみ科目の追加・変更を行い、全端末の科目マスターをキーコードのレベルで一致させてください。見かけ上同じ科目体系でもキーコードが異なると、法人合算で正しく集計されません。</>},
        { h: '名称・コードの制限', body: <>印刷用科目名称は最大40文字。表示用科目名称は画面表示用で、新規登録時は印刷用名称が自動入力されます。表示コードは1〜9桁の数値で、同一区分内で重複しないようにしてください。フリガナ（半角カナ）は科目検索に使われます。</>},
        { h: 'A〜F属性の意味', body: <>A：貸借区分（借方／貸方）、B：特質指定（現金・預金科目、予算専用、繰越額）、C：特殊摘要科目、D：伝票の科目欄に入力するか、E：資金区分（両加算／借方加算＆貸方減算／借方減算＆貸方加算／資金収支と無関係／資金科目）、F：事業種別。Eの設定を誤ると資金収支計算書の金額が合わなくなります。</>},
      ]} />
      <Modal open={!!swap} onClose={() => setSwap(null)} width={560} title={`▲入換▼ 科目の並び順（${swap?.cls ?? ''}グループ）`}>
        {swap && (
          <div style={{ padding: '12px 22px 18px', display: 'grid', gap: 10 }}>
            <Notice>行をドラッグするか、選択して「▲上へ」「▼下へ」で並び順を変えます。OK で一覧・帳票の印刷順に反映します（表示コードは変わりません）。</Notice>
            <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: 360, overflow: 'auto' }}>
              {swap.keys.map((k, i) => { const r = rows.find((x) => x.key === k)!; const on = i === swap.cur; return (
                <div key={k} draggable onDragStart={() => setSwap({ ...swap, drag: i, cur: i })} onDragOver={(e) => { e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); if (swap.drag != null) moveSwap(swap.drag, i); }} onDragEnd={() => setSwap((sw) => (sw ? { ...sw, drag: null } : sw))} onClick={() => setSwap({ ...swap, cur: i })}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderBottom: '1px solid #f1f4f6', background: on ? '#eef2f6' : '#fff', cursor: 'grab', fontSize: 13, opacity: swap.drag === i ? 0.4 : 1 }}>
                  <span style={{ color: '#b7c2cc', fontSize: 14 }}>⋮⋮</span><span style={{ width: 28, color: '#8290a0', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{i + 1}</span><span style={{ width: 60, fontVariantNumeric: 'tabular-nums', color: '#5b6773' }}>{r.code}</span><span style={{ flex: 1, fontWeight: on ? 700 : 500 }}>{r.dispName}</span><span style={{ fontSize: 11, color: '#9aa5b1' }}>キー {r.key}</span>
                </div>); })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => moveSwap(swap.cur, swap.cur - 1)} disabled={swap.cur <= 0} style={{ ...btn(), opacity: swap.cur <= 0 ? 0.5 : 1 }}>▲ 上へ</button>
              <button type="button" onClick={() => moveSwap(swap.cur, swap.cur + 1)} disabled={swap.cur >= swap.keys.length - 1} style={{ ...btn(), opacity: swap.cur >= swap.keys.length - 1 ? 0.5 : 1 }}>▼ 下へ</button>
              <button type="button" onClick={() => moveSwap(swap.cur, 0)} style={btn()}>先頭へ</button>
              <button type="button" onClick={() => moveSwap(swap.cur, swap.keys.length - 1)} style={btn()}>末尾へ</button>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}><button type="button" onClick={() => setSwap(null)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={applySwap} style={btn(accent, true)}>OK</button></span>
            </div>
          </div>
        )}
      </Modal>
      <Modal open={recalc != null} onClose={() => {}} closable={false} width={460} title="仕訳更新">
        <div style={{ padding: '18px 22px 22px' }}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>全仕訳の勘定科目と資金科目の連動を整理しています…　{recalc}%</div>
          <div style={{ height: 10, background: '#eef2f5', borderRadius: 5, overflow: 'hidden' }}><div style={{ width: `${recalc ?? 0}%`, height: '100%', background: accent, transition: 'width .1s' }} /></div>
          <div style={{ fontSize: 11.5, color: '#9aa5b1', marginTop: 8 }}>処理中は中断できません。伝票数によっては数分かかる場合があります。</div>
        </div>
      </Modal>
    </SettingsShell>
  );
}

/* ---------------- 摘要辞書：自動補完候補 ---------------- */
export function SummaryAutoCompleteTab({ accent }: { accent: string }) {
  const toast = useToast();
  const [cands, setCands] = useState<string[]>([...SUMMARIES, '電気代ー７月分', '園児おやつ代', '保護者会費']);
  const [text, setText] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const add = () => { const t = text.trim(); if (!t) return; if (!cands.includes(t)) setCands([...cands, t]); setText(''); };
  return (
    <div style={{ padding: 22, display: 'grid', gap: 12, maxWidth: 760 }}>
      <Notice>伝票入力時に過去に入力した摘要から候補を自動表示します（環境設定「摘要自動補完入力機能を有効にする」）。「入力された摘要を候補に追加する」が有効なら、登録した摘要がここに自動で溜まります。</Notice>
      <div style={{ display: 'flex', gap: 8 }}><input className="field-input ring" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) add(); }} placeholder="摘要文字列を入力して Enter で追加" style={input} /><button type="button" onClick={add} style={btn(accent, true)}>追加</button></div>
      <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: 320, overflow: 'auto' }}>
        {cands.map((c) => <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: '1px solid #f1f4f6', fontSize: 13 }}><input type="checkbox" checked={checked.has(c)} onChange={(e) => { const n = new Set(checked); if (e.target.checked) n.add(c); else n.delete(c); setChecked(n); }} /><span style={{ flex: 1 }}>{c}</span></label>)}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => { if (!checked.size) return toast.show('削除する候補をチェックしてください'); if (confirm(`${checked.size} 件の候補を削除しますか？`)) { setCands(cands.filter((c) => !checked.has(c))); setChecked(new Set()); } }} style={btn('#c0392b')}>削除</button>
        <button type="button" onClick={() => { setCands([...new Set([...cands, '委託費ー７月分', '委託費ー６月分', 'ガス代ー６月分'])]); toast.show('前年度の候補をコピーしました'); }} style={btn()}>前年度のデータをコピー</button>
        <button type="button" className="submit-btn" onClick={() => toast.show('追加修正を保存しました')} style={{ ...btn(accent, true), marginLeft: 'auto' }}>追加修正を保存して閉じる</button>
      </div>
      <ToastView msg={toast.msg} />
    </div>
  );
}
