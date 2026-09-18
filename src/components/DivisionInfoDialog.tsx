// 【法人名の変更、及び区分の追加、変更】ダイアログ（マニュアル 1.6 部門情報の変更）
//   伝票入力区分の選択の「部門情報の変更」／環境設定（動作環境）の「部門情報の変更」から開く。
//   3つの設定項目 … 集計区分の設定（階層の追加・名前変更・削除）／法人情報の設定／伝票入力区分の設定（区分ごとの詳細）
//   変更はその場でセッションに反映し、「キャンセル」で開いた時点の階層に戻す。

import { useState } from 'react';
import { Modal } from './Modal';
import { BellMark } from './BellMark';
import { ToastView, useToast } from './Toast';
import { Field, Notice, Tabs, btn, input, lbl } from './ui';
import { CATEGORIES, COLORS, DivisionTreeEditor, mapTree } from './DivisionTreeEditor';
import { divisionLabel, flattenDivisions, getSession, setSession, useSession, type DivisionNode } from '../store/session';

const TABS = ['集計区分の設定', '法人情報の設定', '伝票入力区分の設定'];
const TH = { padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#8290a0', background: '#f6f8fa', borderBottom: '1px solid #e2e8ee', textAlign: 'left' as const, whiteSpace: 'nowrap' as const };
const TD = { padding: '6px 8px', fontSize: 12.5, borderBottom: '1px solid #f1f4f6', verticalAlign: 'middle' as const };

export function DivisionInfoDialog({ open, onClose, accent }: { open: boolean; onClose: () => void; accent: string }) {
  const s = useSession();
  const toast = useToast();
  const [tab, setTab] = useState(TABS[0]);
  const [caution, setCaution] = useState(false);
  // 開いた時点の階層・法人情報（キャンセルで戻す）
  const [snap] = useState(() => { const g = getSession(); return { tree: g.tree, corpStartDate: g.corpStartDate, corpTax: g.corpTax }; });
  const all = flattenDivisions(s.tree);
  const entries = all.filter((x) => x.node.entry);
  const parents = all.filter((x) => x.node.kind === '事業区分' || x.node.kind === '拠点区分' || x.node.kind === 'サービス区分');
  const parentOf = (id: string) => all.find((x) => x.node.id === id)?.path.slice(-2, -1)[0] ?? '';
  const update = (id: string, patch: Partial<DivisionNode>) => setSession({ tree: mapTree(s.tree, (n) => (n.id === id ? { ...n, ...patch } : n))! });
  /** 集計区分の変更＝階層上の移動（元の親から外し、新しい親の末尾に追加） */
  const move = (n: DivisionNode, parentName: string) => {
    const parent = parents.find((p) => p.node.name === parentName)?.node;
    if (!parent || parent.id === n.id) return;
    if (parentOf(n.id) === parentName) return;
    const kind: DivisionNode['kind'] = parent.kind === '事業区分' ? '拠点区分' : parent.kind === '拠点区分' ? 'サービス区分' : '小サービス区分';
    const without = mapTree(s.tree, (x) => (x.id === n.id ? null : x))!;
    setSession({ tree: mapTree(without, (x) => (x.id === parent.id ? { ...x, children: [...(x.children ?? []), { ...n, kind }] } : x))! });
    toast.show(`「${n.name}」を ${parentName} の下に移動しました`);
  };
  const addEntry = () => {
    const parent = parents.find((p) => p.node.kind === '拠点区分' && (p.node.children ?? []).length > 0)?.node ?? parents[0]?.node;
    if (!parent) return;
    const codes = entries.map((x) => parseInt(x.node.code || '0', 10)).filter(Boolean);
    const code = String(Math.max(0, ...codes) + 1).padStart(3, '0');
    const child: DivisionNode = { id: 'd' + Date.now(), code, name: '新しい伝票入力区分', kind: 'サービス区分', entry: true, use: true, color: COLORS[codes.length % COLORS.length], category: '保育事業', startYear: s.currentYear, children: [] };
    setSession({ tree: mapTree(s.tree, (n) => (n.id === parent.id ? { ...n, children: [...(n.children ?? []), child] } : n))! });
    toast.show(`伝票入力区分 ${code} を追加しました。「集計区分」で格納先を選んでください`);
  };
  const cancel = () => { setSession({ tree: snap.tree, corpStartDate: snap.corpStartDate, corpTax: snap.corpTax }); onClose(); };
  const ok = () => {
    if (!/^\d{4}0401$/.test(s.corpStartDate)) { toast.show('データ開始年月日は 西暦8桁で、下4桁は必ず「0401」です（例：20240401）'); setTab('法人情報の設定'); return; }
    if (entries.some((x) => !x.node.code || !x.node.name.trim())) { toast.show('区分コードと名称が空の伝票入力区分があります'); setTab('伝票入力区分の設定'); return; }
    onClose();
    toast.show('法人および区分の設定を保存しました');
  };
  const [corpKind, corpName] = (() => { const i = s.tree.name.indexOf(' '); return i < 0 ? [s.tree.name, ''] : [s.tree.name.slice(0, i), s.tree.name.slice(i + 1)]; })();

  return (
    <Modal open={open} onClose={cancel} width={1000} title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>法人名の変更、及び区分の追加、変更 <BellMark note="右クリック操作を＋ボタンとフォームに置換、集計区分の変更＝階層の移動として解釈（要確認）" /></span>} strict>
      <ToastView msg={toast.msg} />
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1 }}><Tabs items={TABS} current={tab} onChange={setTab} accent={accent} /></div>
        <button type="button" className="btn-outline" onClick={() => setCaution(true)} style={{ ...btn('#b7791f', false, true), marginRight: 22 }}>区分追加時の注意</button>
      </div>

      {tab === '集計区分の設定' && (
        <>
          <div style={{ padding: '12px 22px 0' }}><Notice tone="warn">階層は「左上（社会福祉事業）を起点に右→下」の順に作成します。運用開始後に階層を変更する場合は、担当者またはカスタマーセンターへご相談ください（本番では確認ダイアログとバックアップを挟みます）。</Notice></div>
          <DivisionTreeEditor accent={accent} compact />
        </>
      )}

      {tab === '法人情報の設定' && (
        <div style={{ padding: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxWidth: 720 }}>
          <Field label="社会福祉法人名" span={2}>
            <input className="field-input ring" value={s.tree.name} onChange={(e) => update(s.tree.id, { name: e.target.value })} style={input} />
            <div style={{ fontSize: 11.5, color: '#7a8794', marginTop: 6 }}>最初のスペースの前を「法人種別」、後を「法人名称」として区分選択画面に表示します → 法人種別 <b style={{ color: '#22303c' }}>{corpKind}</b>／法人名称 <b style={{ color: '#22303c' }}>{corpName || '（未設定）'}</b></div>
          </Field>
          <Field label="データ開始年月日（西暦8桁・下4桁は 0401）">
            <input className="field-input ring" value={s.corpStartDate} onChange={(e) => setSession({ corpStartDate: e.target.value.replace(/[^0-9]/g, '').slice(0, 8) })} placeholder="20240401" style={{ ...input, fontVariantNumeric: 'tabular-nums', borderColor: /^\d{4}0401$/.test(s.corpStartDate) ? '#cfd8e0' : '#e0997c' }} />
          </Field>
          <Field label="法人税納税の有無">
            <select value={s.corpTax} onChange={(e) => setSession({ corpTax: e.target.value })} style={input}>{['非課税', '税効果会計を適用しない', '税効果会計を適用する'].map((o) => <option key={o}>{o}</option>)}</select>
          </Field>
          <div style={{ gridColumn: 'span 2' }}><Notice>会計年度は 4月1日〜3月31日に限定されます。大部分の社会福祉法人では「非課税」を選択します（運用指針 20(5)）。法人番号・所在地などは設定「事業者」で管理します。</Notice></div>
        </div>
      )}

      {tab === '伝票入力区分の設定' && (
        <div style={{ padding: '14px 22px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 12.5, color: '#5b6773' }}>集計区分の設定画面で追加した区分の詳細条件を設定します。行の「集計区分」を変えると格納先が移動します。</span>
            <button type="button" className="submit-btn" onClick={addEntry} style={{ ...btn(accent, true, true), marginLeft: 'auto' }}>伝票入力区分追加</button>
          </div>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'auto', maxHeight: 420 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead><tr><th style={TH}>内部コード</th><th style={{ ...TH, width: 70 }}>区分コード</th><th style={{ ...TH, minWidth: 180 }}>名称</th><th style={{ ...TH, width: 44 }}>使用</th><th style={{ ...TH, width: 110 }}>カラー</th><th style={{ ...TH, width: 150 }}>集計区分</th><th style={{ ...TH, width: 120 }}>事業種別</th><th style={{ ...TH, width: 90 }}>開始年度</th><th style={{ ...TH, width: 90 }}>年度更新待ち</th></tr></thead>
              <tbody>
                {entries.map(({ node: n }) => (
                  <tr key={n.id} style={{ opacity: n.use === false ? 0.6 : 1 }}>
                    <td style={{ ...TD, color: '#9aa5b1', fontSize: 11.5 }}>{n.id}</td>
                    <td style={TD}><input className="field-input ring" value={n.code} onChange={(e) => update(n.id, { code: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} style={{ ...input, padding: '5px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} /></td>
                    <td style={TD}><input className="field-input ring" value={n.name} maxLength={32} onChange={(e) => update(n.id, { name: e.target.value })} style={{ ...input, padding: '5px 8px' }} /></td>
                    <td style={{ ...TD, textAlign: 'center' }}><input type="checkbox" checked={n.use !== false} onChange={() => update(n.id, { use: n.use === false })} title="区分選択画面に表示する" /></td>
                    <td style={TD}><div style={{ display: 'flex', gap: 3 }}>{COLORS.map((c) => <span key={c} onClick={() => update(n.id, { color: c })} title={c} style={{ width: 12, height: 12, borderRadius: 3, background: c, border: '1px solid ' + (n.color === c ? accent : '#dde4ea'), boxShadow: n.color === c ? `0 0 0 1px ${accent}` : 'none', cursor: 'pointer' }} />)}</div></td>
                    <td style={TD}><select value={parentOf(n.id)} onChange={(e) => move(n, e.target.value)} style={{ ...input, padding: '5px 6px', fontSize: 12 }}>{parents.filter((p) => p.node.id !== n.id).map((p) => <option key={p.node.id}>{p.node.name}</option>)}</select></td>
                    <td style={TD}><select value={n.category ?? ''} onChange={(e) => update(n.id, { category: e.target.value })} style={{ ...input, padding: '5px 6px', fontSize: 12 }}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></td>
                    <td style={{ ...TD, color: '#5b6773', fontSize: 12 }}>{n.startYear}</td>
                    <td style={{ ...TD, fontSize: 12 }}><span style={{ color: '#1f7a52', fontWeight: 700 }}>なし</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11.5, color: '#9aa5b1', marginTop: 8, lineHeight: 1.7 }}>内部コード＝システムが自動設定する区分のキー（変更不可。伝票はこのコードで区分を保持）。区分コード＝画面表示用の3桁。名称＝全角32文字まで。使用＝廃園などで使わなくなったらチェックを外す。カラー＝仕訳一覧・元帳の背景色（10区分まで自動配色）。事業種別＝資金収支計算書のサービス活動収入の大区分科目（科目表示設定に反映）。</div>
          <div style={{ marginTop: 8 }}><span style={lbl}>現在の伝票入力区分</span><span style={{ fontSize: 12, color: '#5b6773' }}>{entries.map((x) => divisionLabel(x.node)).join('　')}</span></div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, padding: '12px 22px 18px', borderTop: '1px solid #eef2f5', alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, color: '#9aa5b1' }}>通常は基本情報を登録した状態で納品するため、ここでの設定は不要です。</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" onClick={cancel} style={btn()}>キャンセル</button>
          <button type="button" className="submit-btn" onClick={ok} style={btn(accent, true)}>OK</button>
        </div>
      </div>

      <Modal open={caution} onClose={() => setCaution(false)} width={560} title="区分追加時の注意">
        <div style={{ padding: '14px 22px 18px', fontSize: 13, color: '#48565f', lineHeight: 1.9 }}>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li>区分は階層構造に沿って順番に作成してください（社会福祉事業を起点に、右方向→下方向）。単独での追加はできません。</li>
            <li>区分を削除する前に、配下の拠点区分・サービス区分・小サービス区分を先に削除してください。</li>
            <li>伝票が登録済みの区分を削除・移動すると、集計結果に影響します。必ずバックアップを取ってから操作してください。</li>
            <li>「使用」のチェックを外した区分は区分選択画面に表示されませんが、データは保持されます。廃園などの場合は削除ではなくこちらをお使いください。</li>
            <li>開始年度より前の年度では、その区分で起動できません。</li>
            <li>設定や変更操作の途中で不明な点や間違いがあった場合は、直ちに操作を中止し、担当者またはカスタマーセンターへご相談ください。</li>
          </ol>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}><button type="button" onClick={() => setCaution(false)} style={btn(accent, true)}>確認しました</button></div>
        </div>
      </Modal>
    </Modal>
  );
}
