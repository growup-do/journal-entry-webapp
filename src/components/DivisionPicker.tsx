// 区分・年度の切替（提案A）
//   ヘッダーの「令和8年度／保育事業」をクリック → 区分の組織図（法人 → 事業区分 → 拠点区分・サービス区分）と会計年度を選ぶダイアログ。
//   ログイン直後にも自動で開く。「今後1か月間、ログイン時に表示しない」にチェックすると、期限まで自動表示を休止する。
//   既存の【伝票入力区分の選択】（マニュアル 1.2.3）と合算追加（1.7）に相当。区分はツリー（組織図）／一覧で選べる（依頼書 2.1-2）。
//   年度を変えるときは【年度切替確認】（翌年度以降＝黄、前年度以前＝緑。依頼書 2.1／5.2.1／5.5.2）を挟み、
//   起動時・年度切替後に「金額の連続性チェック」（前年度決算額と当年度繰越額の比較。依頼書 2.1-6）の結果を表示する。

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { DivisionInfoDialog } from './DivisionInfoDialog';
import { DivisionOrgChart, OrgChartLegend } from './DivisionOrgChart';
import { ToastView, useToast } from './Toast';
import { Notice, btn, input, lbl } from './ui';
import { divisionLabel, flattenDivisions, setSession, startKindOf, useSession, type DivisionNode } from '../store/session';

const YEARS = ['令和6年度', '令和7年度', '令和8年度', '令和9年度'];

/** ほかの画面から「区分・年度の切替」を開く（年度更新の完了後など） */
export const openDivisionPicker = () => window.dispatchEvent(new Event('proto-open-division'));

export function DivisionPicker({ accent, compact }: { accent: string; compact?: boolean }) {
  const s = useSession();
  const [open, setOpen] = useState(false);
  /** 起動時（自動表示）か。起動時は OK のあとに金額の連続性チェックを表示する */
  const [startup, setStartup] = useState(false);
  const [cont, setCont] = useState<{ year: string; division: string } | null>(null);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('proto-open-division', onOpen);
    return () => window.removeEventListener('proto-open-division', onOpen);
  }, []);
  // 起動時（ログイン直後）は、まず区分・年度の選択を表示する（依頼書 2.1／5.2.1）
  useEffect(() => {
    //   「今後1か月間、ログイン時にこの画面を表示しない」が有効な間は開かない（前回の年度・区分のまま開始）
    try { if (sessionStorage.getItem('proto-pick-division') === '1') { sessionStorage.removeItem('proto-pick-division'); if (!readSkipUntil()) { setOpen(true); setStartup(true); } } } catch { /* ignore */ }
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
      <DivisionDialog open={open} onClose={() => { setOpen(false); setStartup(false); }} accent={accent} startup={startup} onApplied={(info) => { if (info.yearChanged || info.startup) setCont({ year: info.year, division: info.division }); }} />
      <ContinuityCheckModal info={cont} accent={accent} onClose={() => setCont(null)} />
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


export function DivisionDialog({ open, onClose, accent, startup, onApplied }: { open: boolean; onClose: () => void; accent: string; /** 起動時の自動表示か */ startup?: boolean; /** OK で確定したあとに呼ぶ（年度を変えたかを渡す） */ onApplied?: (info: { year: string; division: string; yearChanged: boolean; startup: boolean }) => void }) {
  const s = useSession();
  const [year, setYear] = useState(s.fiscalYear);
  const [sel, setSel] = useState<string>(s.division);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeMembers, setMergeMembers] = useState<string[]>([]);
  const [mergeName, setMergeName] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [skipUntil, setSkipUntil] = useState(0);
  const [view, setView] = useState<'ツリー' | '一覧'>('ツリー');
  /** 年度を変えて OK を押したとき：【年度切替確認】を表示するための保留内容 */
  const [confirm, setConfirm] = useState<{ label: string; path: string[] } | null>(null);
  useEffect(() => { if (open) { setSkipUntil(readSkipUntil()); setConfirm(null); } }, [open]);
  const toast = useToast();
  const all = flattenDivisions(s.tree);
  const entries = all.filter((x) => x.node.entry && x.node.use !== false);

  const apply = (label: string = sel) => {
    const hit = all.find((x) => divisionLabel(x.node) === label);
    const merge = s.merges.find((m) => m.name === label);
    if (!hit && !merge) return toast.show('区分を選択してください');
    const path = hit ? hit.path.slice(0, -1).concat(hit.node.name) : ['社会福祉法人 チャイルド保育園', '合算区分', label];
    // 年度を変えるときは【年度切替確認】（翌年度以降＝黄／前年度以前＝緑）を挟む（依頼書 2.1／5.2.1／5.5.2）
    if (year !== s.fiscalYear) { setConfirm({ label, path }); return; }
    commit(label, path, false);
  };
  const commit = (label: string, path: string[], yearChanged: boolean) => {
    setSession({ fiscalYear: year, division: label, divisionPath: path });
    setConfirm(null);
    onClose();
    onApplied?.({ year, division: label, yearChanged, startup: !!startup });
  };
  const future = YEARS.indexOf(year) > YEARS.indexOf(s.fiscalYear);
  const tone = future ? { bg: '#fff7cc', bd: '#e6c94a', fg: '#7a5a00', btn: '#b7791f' } : { bg: '#eaf5ef', bd: '#8ec7a6', fg: '#1f5a3c', btn: '#1f7a52' };
  const addMerge = () => {
    if (mergeMembers.length < 2) return toast.show('合算する部門を2つ以上選んでください');
    const name = mergeName.trim() || `合算_${String(s.merges.length + 1).padStart(3, '0')}`;
    setSession({ merges: [...s.merges, { name, members: mergeMembers }] });
    setMergeOpen(false); setMergeMembers([]); setMergeName('');
    setSel(name);
    toast.show(`合算区分「${name}」を追加しました`);
  };

  const skipDate = skipUntil ? new Date(skipUntil) : null;

  return (
    <Modal open={open} onClose={onClose} width={1000} title="伝票入力区分の選択">
      <ToastView msg={toast.msg} />
      <div style={{ padding: '12px 22px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={lbl}>現在選択されている年度</span>
          <select value={year} onChange={(e) => setYear(e.target.value)} style={{ ...input, width: 160 }}>{YEARS.map((y) => <option key={y} value={y}>{y}{y === s.currentYear ? '（当年度）' : ''}</option>)}</select>
          <span role="radiogroup" aria-label="区分の表示方法" data-division-view style={{ display: 'inline-flex', border: '1px solid #cfd8e0', borderRadius: 8, overflow: 'hidden', marginLeft: 8 }}>
            {(['ツリー', '一覧'] as const).map((v) => <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)} style={{ padding: '4px 12px', border: 'none', background: view === v ? accent : '#fff', color: view === v ? '#fff' : '#5b6773', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{v}</button>)}
          </span>
          <span style={{ marginLeft: 'auto' }}>{view === 'ツリー' && <OrgChartLegend />}</span>
        </div>

        {/* 組織図：法人 → 事業区分（横に並ぶ）→ 拠点区分・サービス区分（各事業区分の下に縦につながる） */}
        {view === 'ツリー'
          ? <DivisionOrgChart tree={s.tree} accent={accent} isSelected={(n) => sel === divisionLabel(n)} onSelect={(n) => setSel(divisionLabel(n))} onConfirm={(n) => apply(divisionLabel(n))} hint="クリックで選択、ダブルクリックで確定" />
          : <DivisionList items={all} accent={accent} selected={sel} onSelect={setSel} onConfirm={apply} />}

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

      {/* 年度切替確認（既存と同じ：翌年度以降＝黄色、前年度以前＝緑。「年度を切り替える」「元に戻る」の2択） */}
      {confirm && (
        <Modal open width={560} onClose={() => setConfirm(null)} title="年度切替確認">
          <div data-year-confirm={future ? '翌年度以降' : '前年度以前'} style={{ padding: '18px 22px', background: tone.bg, borderTop: `3px solid ${tone.bd}`, display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: tone.fg }}>{s.fiscalYear} から {year} に切り替えます</div>
            <div style={{ fontSize: 13, color: tone.fg, lineHeight: 1.8 }}>
              {future ? '翌年度以降の年度です。年度更新前の翌年度は予算の入力などに使います。伝票の入力はできません。' : '前年度以前の年度です。過去の年度を参照している間は画面上部に帯を表示し、伝票の入力・訂正はできません（閲覧のみ）。'}
              <br />切り替えたあと、前年度の決算額と繰越額を比べる「金額の連続性チェック」の結果を表示します。
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setConfirm(null)} style={btn()}>元に戻る</button>
              <button type="button" className="submit-btn" data-year-switch onClick={() => commit(confirm.label, confirm.path, true)} style={btn(tone.btn, true)}>年度を切り替える</button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

const cellS: CSSProperties = { padding: '7px 10px', borderBottom: '1px solid #eef2f5', fontSize: 12.5, color: 'inherit', whiteSpace: 'nowrap' };
/** 区分の一覧表示（ツリーの代わり。依頼書 2.1-2「ツリー（階層表示）または一覧表示」） */
function DivisionList({ items, accent, selected, onSelect, onConfirm }: { items: { node: DivisionNode; path: string[] }[]; accent: string; selected: string; onSelect: (label: string) => void; onConfirm: (label: string) => void }) {
  return (
    <div data-division-list style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: '54vh', overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr>{['区分', '種類', 'コード', '上位区分', '伝票入力'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11, color: '#8290a0', background: '#f6f8fa', borderBottom: '1px solid #e2e8ee', position: 'sticky', top: 0 }}>{h}</th>)}</tr></thead>
        <tbody>
          {items.map(({ node, path }) => {
            const label = divisionLabel(node);
            const on = selected === label;
            const disabled = node.use === false;
            return (
              <tr key={node.id} data-division={label} aria-selected={on} onClick={() => !disabled && onSelect(label)} onDoubleClick={() => !disabled && onConfirm(label)} title={disabled ? '非使用の区分' : 'クリックで選択、ダブルクリックで確定'} style={{ background: on ? accent + '1a' : undefined, cursor: disabled ? 'default' : 'pointer', color: disabled ? '#b8c2cc' : '#22303c' }}>
                <td style={{ ...cellS, paddingLeft: 10 + (path.length - 1) * 18, fontWeight: on ? 800 : 500, whiteSpace: 'normal' }}>{node.name}</td>
                <td style={cellS}>{node.kind}</td>
                <td style={cellS}>{node.code || '—'}</td>
                <td style={cellS}>{path.length > 1 ? path[path.length - 2] : '—'}</td>
                <td style={cellS}>{node.entry ? (disabled ? '非使用' : '○ 入力区分') : '集計・参照'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 金額の連続性チェック（依頼書 2.1-6）：起動時・年度切替時に、前年度の決算額と当年度の繰越額を比べた結果を表示する（サンプルでは一致） */
export function ContinuityCheckModal({ info, accent, onClose }: { info: { year: string; division: string } | null; accent: string; onClose: () => void }) {
  const s = useSession();
  if (!info) return null;
  const idx = YEARS.indexOf(info.year);
  const prev = idx > 0 ? YEARS[idx - 1] : null;
  const future = idx > YEARS.indexOf(s.currentYear);
  const ROWS: [string, number][] = [['資産合計', 128_450_000], ['負債合計', 21_300_000], ['純資産合計', 107_150_000], ['支払資金残高（当期末）', 9_500_000]];
  const th: CSSProperties = { textAlign: 'left', padding: '7px 10px', fontSize: 11, color: '#8290a0', background: '#f6f8fa', borderBottom: '1px solid #e2e8ee' };
  const td: CSSProperties = { padding: '7px 10px', borderBottom: '1px solid #eef2f5', fontSize: 13 };
  const num: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  return (
    <Modal open width={640} onClose={onClose} title="金額の連続性チェック" dismissible>
      <div data-continuity-check style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
        {!prev ? (
          <Notice tone="warn">{info.year} は最初の年度のため、前年度との比較はできません。</Notice>
        ) : future ? (
          <Notice tone="warn">{info.year} は年度更新前のため、繰越額はまだ確定していません。年度更新を実行したあとにチェックします。</Notice>
        ) : (
          <>
            <Notice tone="ok"><b>{prev} の決算額と {info.year} の繰越額は一致しています。</b>（{info.division}）</Notice>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>項目</th><th style={{ ...th, textAlign: 'right' }}>{prev} 決算額</th><th style={{ ...th, textAlign: 'right' }}>{info.year} 繰越額</th><th style={{ ...th, textAlign: 'right' }}>差額</th></tr></thead>
              <tbody>{ROWS.map(([n, v]) => <tr key={n}><td style={td}>{n}</td><td style={num}>{v.toLocaleString('ja-JP')}</td><td style={num}>{v.toLocaleString('ja-JP')}</td><td style={{ ...num, color: '#1f7a52', fontWeight: 700 }}>0</td></tr>)}</tbody>
            </table>
            <div style={{ fontSize: 12, color: '#7a8794' }}>差額があるときは金額を赤で表示し、「開始残高」を開くボタンを出します（サンプルの数値はすべて一致）。</div>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={onClose} style={btn(accent, true)}>OK</button></div>
      </div>
    </Modal>
  );
}
