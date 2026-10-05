// 区分・年度の切替（提案A）
//   ヘッダーの「令和8年度／保育事業」をクリック → 区分の組織図（法人 → 事業区分 → 拠点区分・サービス区分）と会計年度を選ぶダイアログ。
//   ログイン直後にも自動で開く。「今後1か月間、ログイン時に表示しない」にチェックすると、期限まで自動表示を休止する。
//   既存の【伝票入力区分の選択】（マニュアル 1.2.3）と合算追加（1.7）に相当。

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { DivisionInfoDialog } from './DivisionInfoDialog';
import { ToastView, useToast } from './Toast';
import { btn, input, lbl } from './ui';
import { divisionLabel, flattenDivisions, setSession, startKindOf, useSession, type DivisionNode } from '../store/session';

const YEARS = ['令和6年度', '令和7年度', '令和8年度', '令和9年度'];

/** ほかの画面から「区分・年度の切替」を開く（年度更新の完了後など） */
export const openDivisionPicker = () => window.dispatchEvent(new Event('proto-open-division'));

export function DivisionPicker({ accent, compact }: { accent: string; compact?: boolean }) {
  const s = useSession();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('proto-open-division', onOpen);
    return () => window.removeEventListener('proto-open-division', onOpen);
  }, []);
  // 起動時（ログイン直後）は、まず区分・年度の選択を表示する（依頼書 2.1／5.2.1）
  useEffect(() => {
    //   「今後1か月間、ログイン時にこの画面を表示しない」が有効な間は開かない（前回の年度・区分のまま開始）
    try { if (sessionStorage.getItem('proto-pick-division') === '1') { sessionStorage.removeItem('proto-pick-division'); if (!readSkipUntil()) setOpen(true); } } catch { /* ignore */ }
  }, []);
  const kind = startKindOf(s);
  const isPast = YEARS.indexOf(s.fiscalYear) < YEARS.indexOf(s.currentYear);
  const isFuture = YEARS.indexOf(s.fiscalYear) > YEARS.indexOf(s.currentYear);
  return (
    <>
      <button
        type="button"
        data-menu="区分・年度の切替"
        onClick={() => setOpen(true)}
        title="区分・年度を切り替える"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: compact ? '3px 9px' : '4px 10px', borderRadius: 8, border: '1px solid ' + (isPast ? '#1f7a52' : isFuture ? '#b7791f' : '#dde4ea'), background: isPast ? '#eaf5ef' : isFuture ? '#fff7e6' : '#f7f9fb', color: '#22303c', fontSize: compact ? 12 : 12.5, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        <span style={{ color: '#68757f' }}>会計期間</span>
        <b style={{ fontWeight: 700 }}>{s.fiscalYear}</b>
        {isPast && <span style={{ fontSize: 10, fontWeight: 800, color: '#1f7a52' }}>過去年度</span>}
        {isFuture && <span style={{ fontSize: 10, fontWeight: 800, color: '#b7791f' }}>翌年度</span>}
        <span style={{ color: '#c3ccd4' }}>｜</span>
        <span style={{ color: '#68757f' }}>{s.divisionPath.slice(-2, -1)[0]}</span>
        <span style={{ color: '#c3ccd4' }}>›</span>
        <b style={{ fontWeight: 700 }}>{s.division}</b>
        {kind !== '入力区分' && <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 8, background: kind === '合算区分' ? '#fbe9d0' : '#e8f0fb', color: kind === '合算区分' ? '#b45309' : '#2c5f9e' }}>{kind}</span>}
        <span style={{ color: '#9aa5b1', fontSize: 9 }}>▼</span>
      </button>
      <DivisionDialog open={open} onClose={() => setOpen(false)} accent={accent} />
    </>
  );
}

/** ログイン直後の自動表示を休止する期限（ミリ秒）。チェックを入れた日から1か月 */
const SKIP_KEY = 'proto-skip-division-until';
function readSkipUntil(): number {
  try { const v = Number(localStorage.getItem(SKIP_KEY)); return v > Date.now() ? v : 0; } catch { return 0; }
}
function writeSkipUntil(on: boolean): number {
  const d = new Date(); d.setMonth(d.getMonth() + 1);
  const until = on ? d.getTime() : 0;
  try { if (on) localStorage.setItem(SKIP_KEY, String(until)); else localStorage.removeItem(SKIP_KEY); } catch { /* ignore */ }
  return until;
}

const LINE = '#b3bfc9';
const CARD_H = 44;
const GAP = 8;
const kindOf = (n: DivisionNode) => (!!n.entry && !(n.children ?? []).some((c) => c.entry && c.use !== false) ? '入力区分' : '親区分');

export function DivisionDialog({ open, onClose, accent }: { open: boolean; onClose: () => void; accent: string }) {
  const s = useSession();
  const [year, setYear] = useState(s.fiscalYear);
  const [sel, setSel] = useState<string>(s.division);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeMembers, setMergeMembers] = useState<string[]>([]);
  const [mergeName, setMergeName] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [skipUntil, setSkipUntil] = useState(0);
  useEffect(() => { if (open) setSkipUntil(readSkipUntil()); }, [open]);
  const toast = useToast();
  const all = flattenDivisions(s.tree);
  const entries = all.filter((x) => x.node.entry && x.node.use !== false);

  const apply = (label: string = sel) => {
    const hit = all.find((x) => divisionLabel(x.node) === label);
    const merge = s.merges.find((m) => m.name === label);
    if (!hit && !merge) return toast.show('区分を選択してください');
    setSession({ fiscalYear: year, division: label, divisionPath: hit ? hit.path.slice(0, -1).concat(hit.node.name) : ['社会福祉法人 チャイルド保育園', '合算区分', label] });
    onClose();
  };
  const addMerge = () => {
    if (mergeMembers.length < 2) return toast.show('合算する部門を2つ以上選んでください');
    const name = mergeName.trim() || `合算_${String(s.merges.length + 1).padStart(3, '0')}`;
    setSession({ merges: [...s.merges, { name, members: mergeMembers }] });
    setMergeOpen(false); setMergeMembers([]); setMergeName('');
    setSel(name);
    toast.show(`合算区分「${name}」を追加しました`);
  };

  /** 組織図の1枚（法人・事業区分・拠点区分・サービス区分…）。クリックで選択、ダブルクリックで確定 */
  const card = (n: DivisionNode, tier: 'root' | 'head' | 'leaf', extra?: CSSProperties) => {
    const label = divisionLabel(n);
    const selectable = n.use !== false;
    const k = kindOf(n);
    const on = sel === label;
    // 枠線は border のショートハンド1本で指定する（選択・非使用の状態もここで切り替える）
    const off = n.use === false;
    const bw = tier === 'root' ? '2px' : tier === 'head' ? '1.5px' : '1px';
    const bc = on ? accent : off ? '#cfd8e0' : tier === 'root' ? '#22303c' : tier === 'head' ? '#7a8794' : '#cfd8e0';
    const base: CSSProperties = { border: `${bw} ${off ? 'dashed' : 'solid'} ${bc}`, background: on ? accent : off ? '#f6f8fa' : tier === 'head' ? '#f3f6f8' : '#fff', color: on ? '#fff' : off ? '#9aa5b1' : '#22303c', boxShadow: on ? `0 0 0 3px ${accent}33` : 'none' };
    return (
      <button
        type="button"
        data-division={label}
        disabled={!selectable}
        aria-pressed={on}
        onClick={() => setSel(label)}
        onDoubleClick={() => apply(label)}
        title={selectable ? 'クリックで選択、ダブルクリックで確定' : 'この区分は使用しない設定です'}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: CARD_H, padding: '0 12px', borderRadius: 10, textAlign: 'left', fontFamily: 'inherit', cursor: selectable ? 'pointer' : 'not-allowed', position: 'relative', zIndex: 1, ...base, ...extra }}
      >
        {n.color && n.use !== false && <span style={{ flex: 'none', width: 12, height: 12, borderRadius: 3, background: n.color, border: '1px solid ' + (on ? 'rgba(255,255,255,.7)' : '#c3ccd4') }} />}
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: on ? 'rgba(255,255,255,.85)' : '#8290a0', lineHeight: 1.3 }}>{n.kind}{n.code ? `　${n.code}` : ''}</span>
          <span style={{ display: 'block', fontSize: tier === 'root' ? 14.5 : 13.5, fontWeight: 700, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.name}</span>
        </span>
        <span style={{ flex: 'none', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: on ? 'rgba(255,255,255,.25)' : n.use === false ? '#eef2f6' : k === '入力区分' ? '#eaf5ef' : '#eef2f6', color: on ? '#fff' : n.use === false ? '#9aa5b1' : k === '入力区分' ? '#1f7a52' : '#5b6773' }}>{n.use === false ? '非使用' : k}</span>
      </button>
    );
  };
  /** 事業区分の下にぶら下がる区分（拠点区分 › サービス区分 › 小サービス区分）を、罫線でつないで縦に並べる */
  const branch = (nodes: DivisionNode[]) => (
    <div style={{ marginLeft: 24 }}>
      {nodes.map((c, i) => (
        <div key={c.id} style={{ position: 'relative', paddingLeft: 22, paddingTop: GAP }}>
          <span style={{ position: 'absolute', left: 0, top: 0, width: 0, borderLeft: `1.5px solid ${LINE}`, height: i === nodes.length - 1 ? GAP + CARD_H / 2 : '100%' }} />
          <span style={{ position: 'absolute', left: 0, top: GAP + CARD_H / 2, width: 22, borderTop: `1.5px solid ${LINE}` }} />
          {card(c, 'leaf')}
          {(c.children ?? []).length > 0 && branch(c.children ?? [])}
        </div>
      ))}
    </div>
  );
  const heads = s.tree.children ?? [];
  const skipDate = skipUntil ? new Date(skipUntil) : null;

  return (
    <Modal open={open} onClose={onClose} width={1000} title="伝票入力区分の選択">
      <ToastView msg={toast.msg} />
      <div style={{ padding: '12px 22px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={lbl}>現在選択されている年度</span>
          <select value={year} onChange={(e) => setYear(e.target.value)} style={{ ...input, width: 160 }}>{YEARS.map((y) => <option key={y} value={y}>{y}{y === s.currentYear ? '（当年度）' : ''}</option>)}</select>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: '#5b6773' }}>
            <span><b style={{ padding: '1px 7px', borderRadius: 8, background: '#eaf5ef', color: '#1f7a52', fontSize: 10.5 }}>入力区分</b>　伝票を入力できる</span>
            <span><b style={{ padding: '1px 7px', borderRadius: 8, background: '#eef2f6', color: '#5b6773', fontSize: 10.5 }}>親区分</b>　集計・参照用</span>
          </span>
        </div>

        {/* 組織図：法人 → 事業区分（横に並ぶ）→ 拠点区分・サービス区分（各事業区分の下に縦につながる） */}
        <div data-org-chart style={{ border: '1px solid #e2e8ee', borderRadius: 12, padding: '18px 18px 20px', maxHeight: '54vh', overflow: 'auto', background: '#fbfcfd' }}>
          <div style={{ minWidth: heads.length * 320 }}>
            <div style={{ width: 380, maxWidth: '100%', margin: '0 auto' }}>{card(s.tree, 'root')}</div>
            {heads.length > 0 && <div style={{ width: 0, height: 18, margin: '0 auto', borderLeft: `1.5px solid ${LINE}` }} />}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(heads.length, 1)}, minmax(0, 1fr))` }}>
              {heads.map((h, i) => (
                <div key={h.id} style={{ padding: '0 12px 0', minWidth: 0 }}>
                  {/* 上の横罫線（左右の事業区分とつなぐ）と、事業区分へ降りる縦罫線 */}
                  <div style={{ display: 'flex', height: 18, margin: '0 -12px' }}>
                    <span style={{ flex: 1, borderTop: i > 0 ? `1.5px solid ${LINE}` : 'none', borderRight: `1.5px solid ${LINE}`, marginRight: -0.75 }} />
                    <span style={{ flex: 1, borderTop: i < heads.length - 1 ? `1.5px solid ${LINE}` : 'none' }} />
                  </div>
                  {card(h, 'head')}
                  {(h.children ?? []).length > 0 ? branch(h.children ?? []) : <div style={{ margin: '10px 0 0 24px', fontSize: 11.5, color: '#9aa5b1' }}>この事業区分には、まだ区分がありません。</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {s.merges.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#8290a0' }}>合算区分（任意の組合せ）</span>
            {s.merges.map((m) => {
              const on = sel === m.name;
              return (
                <button key={m.name} type="button" data-division={m.name} aria-pressed={on} onClick={() => setSel(m.name)} onDoubleClick={() => apply(m.name)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 10, border: '1px solid ' + (on ? accent : '#e6c99a'), background: on ? accent : '#fffaf0', color: on ? '#fff' : '#22303c', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: on ? `0 0 0 3px ${accent}33` : 'none' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: on ? 'rgba(255,255,255,.25)' : '#fbe9d0', color: on ? '#fff' : '#b45309' }}>合算</span>
                  {m.name}
                  <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>{m.members.join('・')}</span>
                </button>
              );
            })}
          </div>
        )}
        <div style={{ fontSize: 11.5, color: '#9aa5b1', marginTop: 10 }}>親区分（法人・事業区分・拠点区分など）と合算区分で開くと、伝票入力など一部のメニューが使えなくなります。ダブルクリックでも確定できます。</div>

        <label data-skip-division style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '9px 12px', borderRadius: 10, background: '#f6f8fa', fontSize: 12.5, color: '#22303c', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!skipUntil} onChange={(e) => setSkipUntil(writeSkipUntil(e.target.checked))} style={{ width: 16, height: 16, accentColor: accent, cursor: 'pointer' }} />
          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>今後1か月間、ログイン時にこの画面を表示しない</span>
          <span style={{ fontSize: 11.5, color: '#7a8794', minWidth: 0 }}>{skipDate ? `${skipDate.getMonth() + 1}月${skipDate.getDate()}日まで表示しません。` : ''}前回の年度・区分で開始します。変更は画面上部の「会計期間／区分」から。</span>
        </label>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
          <button type="button" className="btn-outline" onClick={() => setMergeOpen(true)} style={btn()}>合算追加</button>
          <button type="button" className="btn-outline" onClick={() => setInfoOpen(true)} style={btn()}>部門情報の変更</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={btn()}>キャンセル</button>
            <button type="button" className="submit-btn" onClick={() => apply()} style={btn(accent, true)}>OK</button>
          </div>
        </div>
      </div>

      <Modal open={mergeOpen} onClose={() => setMergeOpen(false)} width={520} title="合算部門の選択" strict>
        <div style={{ padding: '14px 22px 18px' }}>
          <div style={{ fontSize: 12.5, color: '#5b6773', marginBottom: 8 }}>合算する部門をチェックし、名称を付けて完了してください（1/2 → 2/2）。</div>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: 8, maxHeight: 220, overflow: 'auto' }}>
            {entries.map(({ node }) => {
              const label = divisionLabel(node);
              const on = mergeMembers.includes(label);
              return <label key={node.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={on} onChange={() => setMergeMembers((m) => (on ? m.filter((x) => x !== label) : [...m, label]))} />{label}</label>;
            })}
          </div>
          <div style={{ marginTop: 12 }}><span style={lbl}>合算名称</span><input className="field-input ring" value={mergeName} onChange={(e) => setMergeName(e.target.value)} placeholder={`合算_${String(s.merges.length + 1).padStart(3, '0')}`} style={input} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" onClick={() => setMergeOpen(false)} style={btn()}>戻る</button>
            <button type="button" className="submit-btn" onClick={addMerge} style={btn(accent, true)}>完了</button>
          </div>
        </div>
      </Modal>
      <DivisionInfoDialog open={infoOpen} onClose={() => setInfoOpen(false)} accent={accent} />
    </Modal>
  );
}
