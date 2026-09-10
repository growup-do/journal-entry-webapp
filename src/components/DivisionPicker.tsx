// 区分・年度の切替（提案A）
//   ヘッダーの「令和8年度／保育事業」をクリック → 区分ツリー（階層表示／一覧表示）と会計年度を選ぶダイアログ。
//   既存の【伝票入力区分の選択】（マニュアル 1.2.3）と合算追加（1.7）に相当。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { btn, input, lbl } from './ui';
import { divisionLabel, flattenDivisions, setSession, useSession, type DivisionNode } from '../store/session';

const YEARS = ['令和6年度', '令和7年度', '令和8年度', '令和9年度'];

export function DivisionPicker({ accent, compact }: { accent: string; compact?: boolean }) {
  const s = useSession();
  const [open, setOpen] = useState(false);
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
        <span style={{ color: '#9aa5b1', fontSize: 9 }}>▼</span>
      </button>
      <DivisionDialog open={open} onClose={() => setOpen(false)} accent={accent} />
    </>
  );
}

export function DivisionDialog({ open, onClose, accent }: { open: boolean; onClose: () => void; accent: string }) {
  const s = useSession();
  const [mode, setMode] = useState<'階層表示' | '一覧表示'>('階層表示');
  const [year, setYear] = useState(s.fiscalYear);
  const [sel, setSel] = useState<string>(s.division);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeMembers, setMergeMembers] = useState<string[]>([]);
  const [mergeName, setMergeName] = useState('');
  const toast = useToast();
  const all = flattenDivisions(s.tree);
  const entries = all.filter((x) => x.node.entry && x.node.use !== false);

  const apply = () => {
    const hit = all.find((x) => divisionLabel(x.node) === sel);
    const merge = s.merges.find((m) => m.name === sel);
    if (!hit && !merge) return toast.show('区分を選択してください');
    setSession({ fiscalYear: year, division: sel, divisionPath: hit ? hit.path.slice(0, -1).concat(hit.node.name) : ['社会福祉法人 チャイルド保育園', '合算区分', sel] });
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

  const Node = ({ n, depth }: { n: DivisionNode; depth: number }) => {
    const label = divisionLabel(n);
    const selectable = !!n.entry && n.use !== false;
    const on = sel === label;
    return (
      <>
        <div
          onClick={() => selectable && setSel(label)}
          onDoubleClick={() => { if (selectable) { setSel(label); setTimeout(apply, 0); } }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', paddingLeft: 10 + depth * 22, borderRadius: 8, cursor: selectable ? 'pointer' : 'default', background: on ? accent : 'transparent', color: on ? '#fff' : selectable ? '#22303c' : '#7a8794', fontSize: 13, fontWeight: selectable ? 600 : 500, opacity: n.use === false ? 0.5 : 1 }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: on ? 'rgba(255,255,255,.25)' : '#eef2f6', color: on ? '#fff' : '#5b6773', flex: 'none' }}>{n.kind}</span>
          {n.code && <span style={{ fontVariantNumeric: 'tabular-nums', color: on ? '#fff' : '#8290a0' }}>{n.code}</span>}
          <span>{n.name}</span>
          {n.use === false && <span style={{ fontSize: 10.5 }}>（非使用）</span>}
        </div>
        {(n.children ?? []).map((c) => <Node key={c.id} n={c} depth={depth + 1} />)}
      </>
    );
  };

  const chip = (on: boolean): CSSProperties => ({ ...btn(on ? accent : '#5b6773', on, true) });

  return (
    <Modal open={open} onClose={onClose} width={760} title="伝票入力区分の選択">
      <ToastView msg={toast.msg} />
      <div style={{ padding: '12px 22px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={lbl}>現在選択されている年度</span>
          <select value={year} onChange={(e) => setYear(e.target.value)} style={{ ...input, width: 160 }}>{YEARS.map((y) => <option key={y}>{y}{y === s.currentYear ? '（当年度）' : ''}</option>)}</select>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {(['階層表示', '一覧表示'] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} style={chip(mode === m)}>{m}</button>)}
          </div>
        </div>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 12, padding: 8, maxHeight: 360, overflow: 'auto', background: '#fbfcfd' }}>
          {mode === '階層表示' ? (
            <>
              <Node n={s.tree} depth={0} />
              {s.merges.length > 0 && (
                <>
                  <div style={{ padding: '8px 10px 4px', fontSize: 11, fontWeight: 700, color: '#8290a0' }}>合算区分（任意）</div>
                  {s.merges.map((m) => (
                    <div key={m.name} onClick={() => setSel(m.name)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', paddingLeft: 32, borderRadius: 8, cursor: 'pointer', background: sel === m.name ? accent : 'transparent', color: sel === m.name ? '#fff' : '#22303c', fontSize: 13, fontWeight: 600 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: sel === m.name ? 'rgba(255,255,255,.25)' : '#fbe9d0', color: sel === m.name ? '#fff' : '#b45309' }}>合算</span>{m.name}<span style={{ fontSize: 11, opacity: 0.8 }}>（{m.members.join('・')}）</span>
                    </div>
                  ))}
                </>
              )}
            </>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {entries.map(({ node, path }) => {
                  const label = divisionLabel(node);
                  const on = sel === label;
                  return (
                    <tr key={node.id} onClick={() => setSel(label)} onDoubleClick={() => { setSel(label); setTimeout(apply, 0); }} style={{ cursor: 'pointer', background: on ? accent : 'transparent', color: on ? '#fff' : '#22303c' }}>
                      <td style={{ padding: '7px 10px', width: 60, fontVariantNumeric: 'tabular-nums' }}>{node.code}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 600 }}>{node.name}</td>
                      <td style={{ padding: '7px 10px', fontSize: 11.5, opacity: 0.8 }}>{path.slice(1, -1).join(' › ')}</td>
                      <td style={{ padding: '7px 10px', width: 90 }}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: node.kind === '小サービス区分' ? '#e8791e' : '#c0392b', marginRight: 6 }} />{node.kind === '小サービス区分' ? '階層合算' : '通常合算'}</td>
                    </tr>
                  );
                })}
                {s.merges.map((m) => (
                  <tr key={m.name} onClick={() => setSel(m.name)} style={{ cursor: 'pointer', background: sel === m.name ? accent : 'transparent', color: sel === m.name ? '#fff' : '#22303c' }}>
                    <td style={{ padding: '7px 10px' }}>合算</td><td style={{ padding: '7px 10px', fontWeight: 600 }}>{m.name}</td><td style={{ padding: '7px 10px', fontSize: 11.5, opacity: 0.8 }} colSpan={2}>{m.members.join('・')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: '#9aa5b1', marginTop: 8 }}>先頭に3桁コードのある区分（伝票入力区分）を選べます。ダブルクリックでも確定できます。赤＝通常の合算、橙＝階層で合算する会計単位。</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
          <button type="button" className="btn-outline" onClick={() => setMergeOpen(true)} style={btn()}>合算追加</button>
          <button type="button" className="btn-outline" onClick={() => { onClose(); toast.show('設定「事業者」の「区分階層」で編集できます'); }} style={btn()}>部門情報の変更</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={btn()}>キャンセル</button>
            <button type="button" className="submit-btn" onClick={apply} style={btn(accent, true)}>OK</button>
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
    </Modal>
  );
}
