// 区分階層の設定：事業区分 › 拠点区分 › サービス区分 › 小サービス区分 の追加／名前変更／削除と、
// 伝票入力区分の詳細（区分コード・名称・使用・カラー・集計区分・事業種別・開始年度）。マニュアル 1.6 に相当。
//   ・事業区分は「社会福祉事業」「公益事業」「収益事業」の3つだけ・この順（確認メモ #68）
//   ・入力区分／親区分は追加するときに決め、後から変えられない（#69／#70／#71）
//   ・区分の設定欄は、伝票入力の参照パネルと同じく画面の右側に出す（#74）
//   ・区分の削除は、削除できる条件を確かめたうえで警告を出す（#75）

import { useLayoutEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { Field, Notice, btn, card, cardHead, input, lbl } from './ui';
import { DivisionOrgChart, OrgChartLegend, kindOf } from './DivisionOrgChart';
import { WIDE_NARROW, WIDE_WIDTH } from './WidePanel';
import { divisionLabel, flattenDivisions, setSession, useSession, type DivisionNode } from '../store/session';

const CHILD_KIND: Partial<Record<DivisionNode['kind'], DivisionNode['kind']>> = { 法人: '事業区分', 事業区分: '拠点区分', 拠点区分: 'サービス区分', サービス区分: '小サービス区分' };
export const CATEGORIES = ['法人本部', '保育事業', '子育て支援', '一時預かり', '地域支援', 'その他'];
export const COLORS = ['#e8f0fb', '#eaf5ef', '#fff7e6', '#fdeef3', '#f1f4f6', '#efe6fb', '#fbe9d0', '#e0f4f7'];
/** 事業区分はこの3つだけ。並び順もこの順に固定（社会福祉事業は必ず存在し、削除できない） */
export const BUSINESS_KINDS = ['社会福祉事業', '公益事業', '収益事業'];
const bizOrder = (n: DivisionNode) => { const i = BUSINESS_KINDS.indexOf(n.name); return i < 0 ? 99 : i; };

export function mapTree(n: DivisionNode, f: (x: DivisionNode) => DivisionNode | null): DivisionNode | null {
  const r = f(n);
  if (!r) return null;
  return { ...r, children: (r.children ?? []).map((c) => mapTree(c, f)).filter((c): c is DivisionNode => !!c) };
}

type AddType = '入力区分' | '親区分';

export function DivisionTreeEditor({ accent, compact }: { accent: string; compact?: boolean }) {
  const s = useSession();
  // 通常：カードを押すと右側に設定パネルを開く（初期は閉じている）。compact（区分ダイアログ内）：組織図の下に表示
  const [selId, setSelId] = useState<string | null>(compact ? 'hoiku' : null);
  const [adding, setAdding] = useState<DivisionNode | null>(null);
  const [addType, setAddType] = useState<AddType>('入力区分');
  const [addName, setAddName] = useState('');
  const [addBiz, setAddBiz] = useState('');
  const [deleting, setDeleting] = useState<DivisionNode | null>(null);
  const [delChecked, setDelChecked] = useState(false);
  const toast = useToast();
  const all = flattenDivisions(s.tree);
  const sel = all.find((x) => x.node.id === selId)?.node ?? null;
  const update = (id: string, patch: Partial<DivisionNode>) => setSession({ tree: mapTree(s.tree, (n) => (n.id === id ? { ...n, ...patch } : n))! });
  const remainingBiz = BUSINESS_KINDS.filter((b) => !(s.tree.children ?? []).some((c) => c.name === b));
  /** 配下に区分を追加できるか：入力区分の下には追加できない。法人の下は、まだ無い事業区分があるときだけ */
  const canAddUnder = (n: DivisionNode) => !n.entry && !!CHILD_KIND[n.kind] && (n.kind !== '法人' || remainingBiz.length > 0);

  const openAdd = (parent: DivisionNode) => {
    setAdding(parent);
    setAddType('入力区分');
    setAddName('');
    setAddBiz(remainingBiz[0] ?? '');
  };
  const confirmAdd = () => {
    const parent = adding;
    if (!parent) return;
    const kind = CHILD_KIND[parent.kind];
    if (!kind) return;
    const id = 'd' + Date.now();
    let child: DivisionNode;
    if (kind === '事業区分') {
      if (!addBiz) return;
      child = { id, code: '', name: addBiz, kind, children: [] };
    } else if (addType === '入力区分') {
      const codes = all.map((x) => parseInt(x.node.code || '0', 10)).filter(Boolean);
      const code = String(Math.max(0, ...codes) + 1).padStart(3, '0');
      child = { id, code, name: addName.trim(), kind, entry: true, use: true, color: COLORS[codes.length % COLORS.length], category: '保育事業', startYear: s.currentYear, children: [] };
    } else {
      child = { id, code: '', name: addName.trim(), kind, children: [] };
    }
    setSession({ tree: mapTree(s.tree, (n) => {
      if (n.id !== parent.id) return n;
      const children = [...(n.children ?? []), child];
      return { ...n, children: kind === '事業区分' ? [...children].sort((x, y) => bizOrder(x) - bizOrder(y)) : children };
    })! });
    setSelId(id);
    setAdding(null);
    toast.show(`${parent.name} の下に「${child.name}」（${kind === '事業区分' ? '事業区分' : `${kind}・${addType}`}）を追加しました`);
  };

  /** 削除できない理由（1つでもあれば削除させない） */
  const blockers = (n: DivisionNode): string[] => {
    const out: string[] = [];
    if ((n.children ?? []).length) out.push(`配下に区分が ${(n.children ?? []).length} 件あります。先に配下の区分を削除してください。`);
    // プロトタイプ：初期データの入力区分は伝票が登録済みとして扱う（本番では伝票・開始残高・予算の有無を調べる）
    if (n.entry && !n.id.startsWith('d')) out.push('この区分には伝票が登録されています（開始残高・予算も含む）。');
    const merged = s.merges.filter((m) => m.members.includes(divisionLabel(n))).map((m) => m.name);
    if (merged.length) out.push(`合算区分「${merged.join('」「')}」に含まれています。先に合算区分から外してください。`);
    if (divisionLabel(n) === s.division) out.push('現在この区分で起動しています。別の区分に切り替えてから操作してください。');
    return out;
  };
  const openDelete = (n: DivisionNode) => { setDeleting(n); setDelChecked(false); };
  const confirmDelete = () => {
    const n = deleting;
    if (!n || blockers(n).length || !delChecked) return;
    setSession({ tree: mapTree(s.tree, (x) => (x.id === n.id ? null : x))! });
    setSelId(null);
    setDeleting(null);
    toast.show(`「${n.name}」を削除しました`);
  };

  // 集計区分（格納先）に選べるのは親区分だけ
  const parents = all.filter((x) => !x.node.entry && (x.node.kind === '拠点区分' || x.node.kind === '事業区分' || x.node.kind === 'サービス区分')).map((x) => x.node.name);
  const parentNameOf = (id: string) => all.find((x) => x.node.id === id)?.path.slice(-2, -1)[0] ?? '';

  /** カードの右に置く「＋」（配下に区分を追加）。入力区分には出さない */
  const addButton = (n: DivisionNode) => {
    if (!canAddUnder(n)) return null;
    const kind = CHILD_KIND[n.kind];
    return <button type="button" className="btn-outline" data-add-child={n.id} onClick={() => openAdd(n)} title={`${n.name} の下に${kind}を追加`} aria-label={`${n.name} の下に${kind}を追加`} style={{ flex: 'none', width: 28, height: 28, borderRadius: 8, border: '1px dashed ' + accent, background: '#fff', color: accent, fontSize: 16, fontWeight: 700, lineHeight: 1, fontFamily: 'inherit', cursor: 'pointer', padding: 0 }}>＋</button>;
  };

  /* ---- 右側パネルの位置と、パネルに隠れないための余白 ---- */
  const rootRef = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(102);
  const [pad, setPad] = useState(0);
  const panelOpen = !compact && !!sel;
  useLayoutEffect(() => {
    if (compact) return;
    const measure = () => {
      const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-zoom')) || 1;
      setTop(document.querySelector<HTMLElement>('[data-app-top]')?.offsetHeight ?? 0);
      const el = rootRef.current;
      if (!el || !panelOpen || window.innerWidth < WIDE_NARROW) { setPad(0); return; }
      const over = el.getBoundingClientRect().right - (window.innerWidth - WIDE_WIDTH * z);
      setPad(Math.max(0, Math.round(over / z) + 12));
    };
    measure();
    const t = window.setTimeout(measure, 320);
    window.addEventListener('resize', measure);
    return () => { window.clearTimeout(t); window.removeEventListener('resize', measure); };
  }, [compact, panelOpen]);

  const startYear = s.corpStartDate.slice(0, 4);
  const ro = { ...input, background: '#f5f7f9', color: '#5b6773' };
  const badge = (k: string) => <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: k === '入力区分' ? '#eaf5ef' : '#eef2f6', color: k === '入力区分' ? '#1f7a52' : '#5b6773' }}>{k}</span>;

  /** 選択中の区分の設定欄（通常は右側パネル、compact では組織図の下） */
  const settings = !sel ? null : (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {sel.kind === '事業区分' ? (
        <Field label="名称" span={2}>
          <div style={ro}>{sel.name}</div>
          <div style={{ fontSize: 12, color: '#7a8794', marginTop: 6, lineHeight: 1.7 }}>事業区分の名称は「社会福祉事業」「公益事業」「収益事業」の3つに決まっています（並び順もこの順）。</div>
        </Field>
      ) : (
        <Field label={sel.kind === '法人' ? '法人名' : '名称'} span={2}><input className="field-input ring" value={sel.name} onChange={(e) => update(sel.id, { name: e.target.value })} style={input} /></Field>
      )}
      {sel.kind === '法人' && (
        <>
          <Field label="データ開始年（西暦）">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input className="field-input ring" data-start-year value={startYear} inputMode="numeric" onChange={(e) => setSession({ corpStartDate: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) + '0401' })} style={{ ...input, width: 96, fontVariantNumeric: 'tabular-nums' }} />
              <span style={{ fontSize: 14, color: '#5b6773' }}>年</span>
            </div>
          </Field>
          <Field label="法人税納税の有無"><select value={s.corpTax} onChange={(e) => setSession({ corpTax: e.target.value })} style={input}>{['非課税', '税効果会計を適用しない', '税効果会計を適用する'].map((o) => <option key={o}>{o}</option>)}</select></Field>
          <div style={{ gridColumn: 'span 2', fontSize: 12, color: '#7a8794', lineHeight: 1.7 }}>会計年度は4月1日から始まるため、データ開始は年だけを指定します（{startYear || '----'}年4月1日から）。</div>
        </>
      )}
      {sel.kind !== '法人' && sel.kind !== '事業区分' && (
        <Field label="区分の種類" span={2}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14 }}>{badge(kindOf(sel))}<span style={{ color: '#7a8794', fontSize: 12, lineHeight: 1.7 }}>{sel.entry ? '伝票を入力する区分です。配下に区分は作れません。' : '配下の区分を集計・参照する区分です。伝票は入力できません。'}種類は後から変更できません。</span></div>
        </Field>
      )}
      {sel.entry && (
        <>
          <Field label="区分コード"><input className="field-input ring" value={sel.code} onChange={(e) => update(sel.id, { code: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} style={input} /></Field>
          <Field label="内部コード"><div style={{ ...input, background: '#f5f7f9', color: '#9aa5b1' }}>{sel.id}（自動）</div></Field>
          <Field label="集計区分"><select value={parentNameOf(sel.id)} onChange={() => toast.show('集計区分の変更：本番では階層の移動として実装')} style={input}>{parents.map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="事業種別"><select value={sel.category ?? ''} onChange={(e) => update(sel.id, { category: e.target.value })} style={input}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="カラー（一覧・元帳の背景色）" span={2}><div style={{ display: 'flex', gap: 6 }}>{COLORS.map((c) => <span key={c} onClick={() => update(sel.id, { color: c })} style={{ width: 24, height: 24, borderRadius: 6, background: c, border: '2px solid ' + (sel.color === c ? accent : '#e2e8ee'), cursor: 'pointer' }} />)}</div></Field>
          <Field label="開始年度"><div style={ro}>{sel.startYear}</div></Field>
          <label style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, lineHeight: 1.6 }}><input type="checkbox" checked={sel.use !== false} onChange={() => update(sel.id, { use: sel.use === false })} style={{ marginTop: 4 }} /><span>使用する（区分選択画面に表示。廃園などで使わなくなった場合はチェックを外す）</span></label>
          <div style={{ gridColumn: 'span 2', fontSize: 12, color: '#9aa5b1' }}>年度更新待ち：<b style={{ color: '#1f7a52' }}>なし</b>（{s.currentYear} まで更新済み）</div>
        </>
      )}
      {!sel.entry && sel.kind !== '法人' && (
        <div style={{ gridColumn: 'span 2', fontSize: 14, color: '#7a8794', lineHeight: 1.7 }}>
          集計用の区分です。伝票は配下の入力区分（3桁コード付き）で入力します。
          {(sel.children ?? []).length === 0 && <><br />配下にまだ区分がありません。{canAddUnder(sel) ? '下の「＋ 配下に追加」から追加してください。' : ''}</>}
        </div>
      )}
      <div style={{ gridColumn: 'span 2', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4, paddingTop: 12, borderTop: '1px solid #eef2f5' }}>
        {canAddUnder(sel) && <button type="button" className="btn-outline" onClick={() => openAdd(sel)} style={btn(accent, false, true)}>＋ 配下に{CHILD_KIND[sel.kind]}を追加</button>}
        {sel.kind === '事業区分' && sel.name === '社会福祉事業' && <span style={{ fontSize: 12, color: '#9aa5b1' }}>社会福祉事業は必ず必要な事業区分のため、削除できません。</span>}
        {sel.kind !== '法人' && !(sel.kind === '事業区分' && sel.name === '社会福祉事業') && <button type="button" className="btn-outline" data-delete-division onClick={() => openDelete(sel)} style={{ ...btn('#c0392b', false, true), marginLeft: 'auto' }}>この区分を削除…</button>}
      </div>
    </div>
  );

  const addKind = adding ? CHILD_KIND[adding.kind] : undefined;
  const addOk = addKind === '事業区分' ? !!addBiz : !!addName.trim();
  const delBlock = deleting ? blockers(deleting) : [];
  const radioRow = (on: boolean, disabled = false) => ({ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', border: '1px solid ' + (on ? accent : '#dde4ea'), borderRadius: 10, background: disabled ? '#f6f8fa' : on ? '#f3f9f5' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 } as const);

  return (
    <div ref={rootRef} style={{ padding: compact ? 16 : 22, paddingRight: (compact ? 16 : 22) + pad, display: 'grid', gap: 18, transition: 'padding-right .28s ease' }}>
      <ToastView msg={toast.msg} />
      {/* 区分階層：ログイン後の「伝票入力区分の選択」と同じ組織図。カードを押すと、その区分の設定欄を表示する */}
      <div style={card}>
        <div style={{ ...cardHead, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          区分階層
          <span style={{ fontSize: 12, fontWeight: 500, color: '#8290a0' }}>カードを押すと{compact ? '下' : '右側'}に設定欄を表示・親区分の右の「＋」で配下に追加</span>
          <span style={{ marginLeft: 'auto' }}><OrgChartLegend /></span>
        </div>
        <div style={{ padding: 12 }}>
          <DivisionOrgChart tree={s.tree} accent={accent} isSelected={(n) => n.id === selId} onSelect={(n) => setSelId(n.id)} canSelect={() => true} action={addButton} hint={compact ? '押すと、下の設定欄にこの区分の内容を表示します' : '押すと、右側にこの区分の設定欄を表示します'} maxHeight={compact ? '38vh' : 'none'} />
        </div>
        <div style={{ padding: '0 14px 12px', fontSize: 12, color: '#9aa5b1', lineHeight: 1.6 }}>区分は階層構造に沿って順番に作成します（法人 → 事業区分 → 拠点区分 → サービス区分 → 小サービス区分）。事業区分は「社会福祉事業」「公益事業」「収益事業」の3つまでです。入力区分か親区分かは追加するときに選び、後から変更できません。</div>
      </div>
      {compact && (
        <div style={card}>
          <div style={{ ...cardHead, display: 'flex', alignItems: 'center', gap: 8 }}>
            {sel ? <>{sel.kind}の設定<span style={{ fontSize: 14, fontWeight: 500, color: '#5b6773' }}>{sel.code ? `${sel.code} ` : ''}{sel.name}</span></> : '区分の設定'}
          </div>
          {!sel ? <div style={{ padding: 20, color: '#9aa5b1', fontSize: 14 }}>上の組織図から区分を選んでください。</div> : <div style={{ padding: 14 }}>{settings}</div>}
        </div>
      )}
      {!compact && <div style={card}>
        <div style={cardHead}>合算区分（任意の組合せ） <span style={{ fontSize: 12, fontWeight: 500, color: '#8290a0' }}>区分選択の「合算追加」からも作成できます</span></div>
        <div style={{ padding: 14 }}>
          {s.merges.length === 0 && <div style={{ fontSize: 14, color: '#9aa5b1' }}>合算区分はありません。</div>}
          {s.merges.map((m) => (
            <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f1f4f6', fontSize: 14, flexWrap: 'wrap' }}>
              <b>{m.name}</b><span style={{ color: '#7a8794', fontSize: 14 }}>{m.members.join('・')}</span>
              <button type="button" className="btn-outline" onClick={() => { if (confirm(`「${m.name}」を削除しますか？`)) setSession({ merges: s.merges.filter((x) => x.name !== m.name) }); }} style={{ ...btn('#c0392b', false, true), marginLeft: 'auto' }}>削除</button>
            </div>
          ))}
          <div style={{ marginTop: 10 }}><Notice>合算区分で起動すると、試算表・決算書で配下区分の内訳を表示できます（「区分」メニュー →「区分確認」に相当する一覧は、ヘッダーの区分ボタンから確認できます）。</Notice></div>
        </div>
      </div>}
      {!compact && <div style={{ fontSize: 12, color: '#9aa5b1' }}><span style={lbl}>現在の入力区分</span>{all.filter((x) => x.node.entry).map((x) => divisionLabel(x.node)).join('　')}</div>}

      {/* 区分の設定パネル：伝票入力の参照パネルと同じく、画面の右側に固定して表示する（スクロールせずに設定できる。確認メモ #74）。閉じるのは「閉じる」ボタンだけ */}
      {panelOpen && sel && (
        <aside data-division-panel aria-label="区分の設定" data-memo-panel="区分の設定" data-memo-anchor="区分の設定" style={{ position: 'fixed', top, right: 0, bottom: 0, width: WIDE_WIDTH, maxWidth: '94vw', background: '#fff', borderLeft: '1px solid #dde4ea', boxShadow: '-8px 0 28px rgba(30,50,70,.12)', display: 'flex', flexDirection: 'column', zIndex: 90, animation: 'drawer-in .28s ease', fontFamily: "'Noto Sans JP', sans-serif" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #eef2f5', background: '#f6f8fa' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#8290a0' }}>{sel.kind}の設定</div>
              <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel.code ? `${sel.code} ` : ''}{sel.name}</div>
            </div>
            <button type="button" className="btn-outline" data-division-panel-close onClick={() => setSelId(null)} style={btn('#5b6773', false, true)}>閉じる</button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px 130px' }}>{settings}</div>
        </aside>
      )}

      {/* 区分の追加：追加する区分の種類（入力区分／親区分）を選ぶ（確認メモ #71）。事業区分は残っている候補から選ぶ（#68） */}
      <Modal open={!!adding} onClose={() => setAdding(null)} width={560} title={adding ? `${adding.name} の下に${addKind ?? '区分'}を追加` : ''}>
        {adding && (
          <div style={{ padding: '16px 22px 20px', display: 'grid', gap: 14 }}>
            {addKind === '事業区分' ? (
              <>
                <div>
                  <span style={lbl}>追加する事業区分</span>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {remainingBiz.map((b) => (
                      <label key={b} style={radioRow(addBiz === b)}><input type="radio" name="add-biz" checked={addBiz === b} onChange={() => setAddBiz(b)} style={{ marginTop: 3 }} /><span style={{ fontSize: 14, fontWeight: 700 }}>{b}</span></label>
                    ))}
                  </div>
                </div>
                <Notice>事業区分は「社会福祉事業」「公益事業」「収益事業」の3つまでです。追加した事業区分は、この順に並びます。</Notice>
              </>
            ) : (
              <>
                <div>
                  <span style={lbl}>区分の種類</span>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <label style={radioRow(addType === '入力区分')}>
                      <input type="radio" name="add-type" checked={addType === '入力区分'} onChange={() => setAddType('入力区分')} style={{ marginTop: 3 }} />
                      <span><span style={{ fontSize: 14, fontWeight: 700 }}>入力区分</span><span style={{ display: 'block', fontSize: 12, color: '#7a8794', marginTop: 2 }}>伝票を入力する区分です。3桁の区分コードが付きます。配下に区分は作れません。</span></span>
                    </label>
                    <label style={radioRow(addType === '親区分', addKind === '小サービス区分')} title={addKind === '小サービス区分' ? '小サービス区分はいちばん下の階層のため、入力区分だけ追加できます' : undefined}>
                      <input type="radio" name="add-type" disabled={addKind === '小サービス区分'} checked={addType === '親区分'} onChange={() => setAddType('親区分')} style={{ marginTop: 3 }} />
                      <span><span style={{ fontSize: 14, fontWeight: 700 }}>親区分</span><span style={{ display: 'block', fontSize: 12, color: '#7a8794', marginTop: 2 }}>{addKind === '小サービス区分' ? '小サービス区分はいちばん下の階層のため、親区分は追加できません。' : '配下の区分を集計・参照する区分です。伝票は入力できません。配下に区分を追加して使います。'}</span></span>
                    </label>
                  </div>
                </div>
                <div><span style={lbl}>名称</span><input className="field-input ring" data-add-name autoFocus value={addName} maxLength={32} onChange={(e) => setAddName(e.target.value)} placeholder={`${addKind}の名称`} style={input} /></div>
                <Notice tone="warn">入力区分か親区分かは、追加した後で変更できません。</Notice>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setAdding(null)} style={btn()}>キャンセル</button>
              <button type="button" className="submit-btn" data-add-confirm disabled={!addOk} onClick={confirmAdd} style={{ ...btn(accent, true), opacity: addOk ? 1 : 0.45, cursor: addOk ? 'pointer' : 'not-allowed' }}>追加する</button>
            </div>
          </div>
        )}
      </Modal>

      {/* 区分の削除：削除できる条件を満たすときだけ、警告を確認したうえで削除できる（確認メモ #75） */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} width={560} title={deleting ? (delBlock.length ? 'この区分は削除できません' : '区分の削除') : ''}>
        {deleting && (
          <div style={{ padding: '16px 22px 20px', display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid #e2e8ee', borderRadius: 10, background: '#fbfcfd' }}>
              {badge(kindOf(deleting))}
              <span style={{ fontSize: 14, fontWeight: 700 }}>{deleting.kind}　{divisionLabel(deleting)}</span>
            </div>
            {delBlock.length > 0 ? (
              <>
                <div role="alert" style={{ padding: '12px 14px', background: '#fdeee9', border: '1px solid #f2c9c2', borderRadius: 10, color: '#c0392b', fontSize: 14, lineHeight: 1.8 }}>
                  <b>次の理由で削除できません。</b>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>{delBlock.map((b) => <li key={b}>{b}</li>)}</ul>
                </div>
                {deleting.entry && <Notice>廃園などで使わなくなった区分は、削除せずに「使用する」のチェックを外してください。区分選択画面に表示されなくなり、データはそのまま残ります。</Notice>}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={() => setDeleting(null)} style={btn(accent, true)}>閉じる</button></div>
              </>
            ) : (
              <>
                <div role="alert" style={{ padding: '12px 14px', background: '#fdeee9', border: '1px solid #f2c9c2', borderRadius: 10, color: '#c0392b', fontSize: 14, lineHeight: 1.8 }}>
                  <b>区分を削除すると元に戻せません。</b><br />
                  削除した区分は、区分選択・帳票・集計のすべてから無くなります。{deleting.entry ? '使わなくなっただけの区分は、削除せずに「使用する」のチェックを外してください。' : ''}
                </div>
                <div style={{ fontSize: 14, color: '#48565f', lineHeight: 1.8 }}>
                  <b>確認した内容</b>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 20, color: '#1f7a52' }}>
                    <li>配下に区分がない</li>
                    <li>伝票・開始残高・予算が登録されていない</li>
                    <li>合算区分に含まれていない</li>
                    <li>この区分で起動していない</li>
                  </ul>
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, lineHeight: 1.6, padding: '10px 12px', border: '1px solid #dde4ea', borderRadius: 10 }}>
                  <input type="checkbox" data-delete-check checked={delChecked} onChange={() => setDelChecked(!delChecked)} style={{ marginTop: 4 }} />
                  <span>元に戻せないことを確認しました。「{deleting.name}」を削除します。</span>
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" onClick={() => setDeleting(null)} style={btn()}>キャンセル</button>
                  <button type="button" data-delete-confirm disabled={!delChecked} onClick={confirmDelete} style={{ ...btn('#c0392b', true), opacity: delChecked ? 1 : 0.45, cursor: delChecked ? 'pointer' : 'not-allowed' }}>削除する</button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
