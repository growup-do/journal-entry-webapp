// 区分階層の設定（提案A）：事業区分 › 拠点区分 › サービス区分 › 小サービス区分 の追加／名前変更／削除と、
// 伝票入力区分の詳細（区分コード・名称・使用・カラー・集計区分・事業種別・開始年度）。マニュアル 1.6 に相当。

import { useState } from 'react';
import { ToastView, useToast } from './Toast';
import { Field, Notice, btn, card, cardHead, input, lbl } from './ui';
import { divisionLabel, flattenDivisions, setSession, useSession, type DivisionNode } from '../store/session';

const CHILD_KIND: Partial<Record<DivisionNode['kind'], DivisionNode['kind']>> = { 法人: '事業区分', 事業区分: '拠点区分', 拠点区分: 'サービス区分', サービス区分: '小サービス区分' };
const CATEGORIES = ['法人本部', '保育事業', '子育て支援', '一時預かり', '地域支援', 'その他'];
const COLORS = ['#e8f0fb', '#eaf5ef', '#fff7e6', '#fdeef3', '#f1f4f6', '#efe6fb', '#fbe9d0', '#e0f4f7'];

function mapTree(n: DivisionNode, f: (x: DivisionNode) => DivisionNode | null): DivisionNode | null {
  const r = f(n);
  if (!r) return null;
  return { ...r, children: (r.children ?? []).map((c) => mapTree(c, f)).filter((c): c is DivisionNode => !!c) };
}

export function DivisionTreeEditor({ accent }: { accent: string }) {
  const s = useSession();
  const [selId, setSelId] = useState<string>('hoiku');
  const toast = useToast();
  const all = flattenDivisions(s.tree);
  const sel = all.find((x) => x.node.id === selId)?.node ?? null;
  const update = (id: string, patch: Partial<DivisionNode>) => setSession({ tree: mapTree(s.tree, (n) => (n.id === id ? { ...n, ...patch } : n))! });
  const addChild = (parent: DivisionNode) => {
    const kind = CHILD_KIND[parent.kind];
    if (!kind) return toast.show('この階層の下には追加できません');
    const id = 'd' + Date.now();
    const entry = kind === 'サービス区分' || kind === '小サービス区分' || (kind === '拠点区分' && parent.name === '社会福祉事業' && false);
    const codes = all.map((x) => parseInt(x.node.code || '0', 10)).filter(Boolean);
    const code = entry ? String(Math.max(0, ...codes) + 1).padStart(3, '0') : '';
    const child: DivisionNode = { id, code, name: `新しい${kind}`, kind, entry, use: true, color: COLORS[codes.length % COLORS.length], category: '保育事業', startYear: s.currentYear, children: [] };
    setSession({ tree: mapTree(s.tree, (n) => (n.id === parent.id ? { ...n, children: [...(n.children ?? []), child] } : n))! });
    setSelId(id);
    toast.show(`${parent.name} の下に${kind}を追加しました`);
  };
  const remove = (n: DivisionNode) => {
    if ((n.children ?? []).length) return toast.show('先に配下の区分を削除してください');
    if (!confirm(`「${n.name}」を削除しますか？`)) return;
    setSession({ tree: mapTree(s.tree, (x) => (x.id === n.id ? null : x))! });
    setSelId('hoiku');
  };
  const parents = all.filter((x) => x.node.kind === '拠点区分' || x.node.kind === '事業区分' || x.node.kind === 'サービス区分').map((x) => x.node.name);

  const Row = ({ n, depth }: { n: DivisionNode; depth: number }) => (
    <>
      <div onClick={() => setSelId(n.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', paddingLeft: 10 + depth * 20, borderRadius: 8, cursor: 'pointer', background: selId === n.id ? '#eef2f6' : 'transparent', borderLeft: '3px solid ' + (selId === n.id ? accent : 'transparent'), fontSize: 13, opacity: n.use === false ? 0.55 : 1 }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: n.entry ? (n.color ?? '#eef2f6') : '#eef2f6', color: '#5b6773', flex: 'none' }}>{n.kind}</span>
        {n.code && <span style={{ color: '#8290a0', fontVariantNumeric: 'tabular-nums' }}>{n.code}</span>}
        <span style={{ fontWeight: n.entry ? 600 : 500 }}>{n.name}</span>
        {n.use === false && <span style={{ fontSize: 10.5, color: '#9aa5b1' }}>非使用</span>}
        {CHILD_KIND[n.kind] && <button type="button" className="btn-outline" onClick={(e) => { e.stopPropagation(); addChild(n); }} title={`${CHILD_KIND[n.kind]}を追加`} style={{ ...btn(accent, false, true), marginLeft: 'auto', padding: '2px 8px' }}>＋ {CHILD_KIND[n.kind]}</button>}
      </div>
      {(n.children ?? []).map((c) => <Row key={c.id} n={c} depth={depth + 1} />)}
    </>
  );

  return (
    <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'minmax(360px, 1.1fr) minmax(320px, 1fr)', gap: 18, alignItems: 'start' }}>
      <ToastView msg={toast.msg} />
      <div style={card}>
        <div style={cardHead}>区分階層 <span style={{ fontSize: 11, fontWeight: 500, color: '#8290a0' }}>クリックで選択・各行の「＋」で配下に追加</span></div>
        <div style={{ padding: 8 }}><Row n={s.tree} depth={0} /></div>
        <div style={{ padding: '8px 14px 12px', fontSize: 11.5, color: '#9aa5b1', lineHeight: 1.6 }}>区分は階層構造に沿って順番に作成します（左上の社会福祉事業を起点に右→下）。運用開始後の階層変更は影響が大きいため、本番では確認ダイアログとバックアップを挟みます。</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={card}>
          <div style={cardHead}>{sel ? `${sel.kind}の設定` : '区分の設定'}</div>
          {!sel ? <div style={{ padding: 20, color: '#9aa5b1', fontSize: 13 }}>左の階層から区分を選んでください。</div> : (
            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="名称" span={2}><input className="field-input ring" value={sel.name} onChange={(e) => update(sel.id, { name: e.target.value })} style={input} /></Field>
              {sel.kind === '法人' && <><Field label="データ開始年月日"><input className="field-input" defaultValue="20240401" style={input} /></Field><Field label="法人税納税の有無"><select style={input} defaultValue="非課税"><option>非課税</option><option>税効果会計を適用しない</option><option>税効果会計を適用する</option></select></Field></>}
              {sel.entry && (
                <>
                  <Field label="区分コード"><input className="field-input ring" value={sel.code} onChange={(e) => update(sel.id, { code: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} style={input} /></Field>
                  <Field label="内部コード"><div style={{ ...input, background: '#f5f7f9', color: '#9aa5b1' }}>{sel.id}（自動）</div></Field>
                  <Field label="集計区分"><select value={parents.includes(sel.name) ? sel.name : (all.find((x) => x.node.id === sel.id)?.path.slice(-2, -1)[0] ?? '')} onChange={() => toast.show('集計区分の変更：本番では階層の移動として実装')} style={input}>{parents.map((p) => <option key={p}>{p}</option>)}</select></Field>
                  <Field label="事業種別"><select value={sel.category ?? ''} onChange={(e) => update(sel.id, { category: e.target.value })} style={input}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
                  <Field label="カラー（一覧・元帳の背景色）"><div style={{ display: 'flex', gap: 6 }}>{COLORS.map((c) => <span key={c} onClick={() => update(sel.id, { color: c })} style={{ width: 24, height: 24, borderRadius: 6, background: c, border: '2px solid ' + (sel.color === c ? accent : '#e2e8ee'), cursor: 'pointer' }} />)}</div></Field>
                  <Field label="開始年度"><div style={{ ...input, background: '#f5f7f9', color: '#5b6773' }}>{sel.startYear}</div></Field>
                  <label style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" checked={sel.use !== false} onChange={() => update(sel.id, { use: sel.use === false })} />使用する（区分選択画面に表示。廃園などで使わなくなった場合はチェックを外す）</label>
                  <div style={{ gridColumn: 'span 2', fontSize: 11.5, color: '#9aa5b1' }}>年度更新待ち：<b style={{ color: '#1f7a52' }}>なし</b>（{s.currentYear} まで更新済み）</div>
                </>
              )}
              {!sel.entry && sel.kind !== '法人' && <div style={{ gridColumn: 'span 2', fontSize: 12, color: '#7a8794' }}>集計用の区分です。伝票は配下の伝票入力区分（3桁コード付き）で入力します。</div>}
              {sel.kind !== '法人' && <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end' }}><button type="button" className="btn-outline" onClick={() => remove(sel)} style={btn('#c0392b')}>この区分を削除</button></div>}
            </div>
          )}
        </div>
        <div style={card}>
          <div style={cardHead}>合算区分（任意の組合せ） <span style={{ fontSize: 11, fontWeight: 500, color: '#8290a0' }}>区分選択の「合算追加」からも作成できます</span></div>
          <div style={{ padding: 14 }}>
            {s.merges.length === 0 && <div style={{ fontSize: 12.5, color: '#9aa5b1' }}>合算区分はありません。</div>}
            {s.merges.map((m) => (
              <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f1f4f6', fontSize: 13 }}>
                <b>{m.name}</b><span style={{ color: '#7a8794', fontSize: 12 }}>{m.members.join('・')}</span>
                <button type="button" className="btn-outline" onClick={() => { if (confirm(`「${m.name}」を削除しますか？`)) setSession({ merges: s.merges.filter((x) => x.name !== m.name) }); }} style={{ ...btn('#c0392b', false, true), marginLeft: 'auto' }}>削除</button>
              </div>
            ))}
            <div style={{ marginTop: 10 }}><Notice>合算区分で起動すると、試算表・決算書で配下区分の内訳を表示できます（「区分」メニュー →「区分確認」に相当する一覧は、ヘッダーの区分ボタンから確認できます）。</Notice></div>
          </div>
        </div>
      </div>
      <div style={{ gridColumn: '1 / -1', fontSize: 11.5, color: '#9aa5b1' }}><span style={lbl}>選択中の伝票入力区分</span>{all.filter((x) => x.node.entry).map((x) => divisionLabel(x.node)).join('　')}</div>
    </div>
  );
}
