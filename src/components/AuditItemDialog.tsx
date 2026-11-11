// 決算チェック設定の項目ごとの設定画面（確認メモ #117：現行の構成に合わせる。マニュアル 6.10.2「決算項目の詳細条件設定」）
//   ① データ範囲確認（設定先の区分を図で確認 → OK）
//   ② 項目の設定：上段に診断用条件式（①＝②＋③＋④ など）、下段に条件式の要素ごとの勘定科目一覧（チェックで有効／無効）
//   各種設定の「決算チェック設定」と、決算調査から開く「決算チェック設定」の両方で使う。設定値はこのファイルの小さな store で共有する。
//   ボタン名称は一覧画面と同じ「すべて有効」「すべて無効」（確認メモ #119）。参照のみ権限では表示だけ（確認メモ #118）。

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { btn } from './ui';
import { AUDIT_ITEMS } from '../data';
import { ACCOUNT_META } from '../lib/accounts';
import { divisionLabel, flattenDivisions, isViewOnly, useSession, type DivisionNode } from '../store/session';

export type AuditScope = '区分' | '法人';
interface Acct { code: string; name: string }
interface Elem { label: string; group: string; accounts: Acct[]; def: string[] }
interface ItemDef { formula?: { ops: string[] }; elems: Elem[]; /** 現行画面で構成を確認できていない項目（科目の一覧は仮） */ provisional?: boolean }

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥'];
const no2 = (n: number) => String(n).padStart(2, '0');

/* ---------- 項目の定義 ---------- */
/** 純資産の積立金（06 の②〜④で共通の候補） */
const RESERVES: Acct[] = [
  { code: '00102000000', name: '人件費積立金' }, { code: '00103000000', name: '修繕費積立金' }, { code: '00104000000', name: '備品等購入積立金' },
  { code: '00105000000', name: '保育所施設・設備整備積立金' }, { code: '00106000000', name: 'その他の積立金' },
];
/** その他の固定資産（06 の①の候補）。マニュアルの画面に見える科目＋その下に続く積立資産 */
const OTHER_FIXED: Acct[] = [
  { code: '01101000000', name: '土地　－その他－' }, { code: '01102000000', name: '建物　－その他－' }, { code: '01103000000', name: '構築物' },
  { code: '01104000000', name: '機械及び装置' }, { code: '01105000000', name: '車輌運搬具' }, { code: '01106000000', name: '器具及び備品' },
  { code: '01107000000', name: '建設仮勘定' }, { code: '01108000000', name: '有形リース資産' }, { code: '01109000000', name: '権利' },
  { code: '01110000000', name: 'ソフトウェア' }, { code: '01111000000', name: '投資有価証券' }, { code: '01112000000', name: '長期貸付金' },
  { code: '01113000000', name: '退職給付引当資産' }, { code: '01114000000', name: '人件費積立資産' }, { code: '01115000000', name: '修繕積立資産' },
  { code: '01116000000', name: '備品等購入積立資産' }, { code: '01117000000', name: '保育所繰越積立資産' },
];
/** 構成を確認できていない項目の仮の候補（プロトタイプの科目マスタ） */
const SAMPLE: Acct[] = ACCOUNT_META.map((m) => ({ code: m.code, name: m.name }));
const sampleDefault = (no: number) => ACCOUNT_META.filter((m, i) => (no >= 20 ? m.kind === 'BS' : m.kind === 'BS' || (i + no) % 3 === 0)).map((m) => m.name);

export function auditItemDef(no: number): ItemDef {
  if (no === 6) {
    // マニュアル p.144 の画面どおり：①保育所繰越積立資産 ＝ ②人件費積立金 ＋ ③修繕積立金 ＋ ④備品等購入積立金
    return {
      formula: { ops: ['＝', '＋', '＋'] },
      elems: [
        { label: '保育所繰越積立資産', group: 'その他の固定資産', accounts: OTHER_FIXED, def: ['保育所繰越積立資産'] },
        { label: '人件費積立金', group: '純資産', accounts: RESERVES, def: ['人件費積立金'] },
        { label: '修繕積立金', group: '純資産', accounts: RESERVES, def: ['修繕費積立金'] },
        { label: '備品等購入積立金', group: '純資産', accounts: RESERVES, def: ['備品等購入積立金'] },
      ],
    };
  }
  return { provisional: true, elems: [{ label: '対象科目', group: '勘定科目', accounts: SAMPLE, def: sampleDefault(no) }] };
}

/** しきい値を持つ項目。14 の抽出金額は変更不可（確認メモ #116） */
export const AUDIT_PARAMS: Record<number, { label: string; unit: string; def: number; fixed?: boolean }> = {
  14: { label: '抽出する金額（この金額以上の費用を一覧にします）', unit: '円', def: 100000, fixed: true },
  26: { label: '予備費の予算額の上限（事業活動支出の予算に対する割合）', unit: '％', def: 3 },
  27: { label: '支払資金残高率の上限', unit: '％', def: 30 },
};

/* ---------- 設定値の store（区分／法人 × 項目） ---------- */
type Store = { picks: Record<string, string[][]>; params: Record<string, number> };
let store: Store = { picks: {}, params: {} };
const subs = new Set<() => void>();
const keyOf = (scope: AuditScope, no: number) => `${scope}:${no}`;
function useAuditStore() { return useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, () => store, () => store); }
function save(scope: AuditScope, no: number, picks: string[][], param?: number) {
  const k = keyOf(scope, no);
  store = { picks: { ...store.picks, [k]: picks }, params: param == null ? store.params : { ...store.params, [k]: param } };
  subs.forEach((l) => l());
}
const picksOf = (s: Store, scope: AuditScope, no: number) => s.picks[keyOf(scope, no)] ?? auditItemDef(no).elems.map((e) => e.def);
const paramOf = (s: Store, scope: AuditScope, no: number) => (AUDIT_PARAMS[no]?.fixed ? AUDIT_PARAMS[no].def : s.params[keyOf(scope, no)] ?? AUDIT_PARAMS[no]?.def);

/** 一覧に出す要約（対象科目の件数・しきい値） */
export function useAuditSummary(scope: AuditScope) {
  const s = useAuditStore();
  return (no: number) => {
    const n = picksOf(s, scope, no).reduce((a, p) => a + p.length, 0);
    const pr = AUDIT_PARAMS[no];
    const v = paramOf(s, scope, no);
    return `対象科目 ${n} 件${pr ? `　／　${pr.unit === '円' ? v.toLocaleString('ja-JP') + ' 円以上' : v + ' ％'}${pr.fixed ? '（固定）' : ''}` : ''}`;
  };
}

/* ---------- 項目の一覧（現行【決算チェックシステム ― 設定】と同じ 3 列の並び。確認メモ #117） ----------
 * 左＝01〜14、中＝15〜19 と説明、右＝20〜28。各項目は「番号・チェック・項目名ボタン」。
 * 下に、この設定がどの区分に対するものかを示し、法人決算チェック設定との切り替えを置く。
 * 各種設定の「決算チェック設定」と、決算調査から開く設定画面の両方で使う。 */
const CHECK_COLS: number[][] = [
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24, 25, 26, 27, 28],
];
export function AuditChecklist({ scope, isOn, setOn, onOpen, onSwitch, accent = '#1f7a52' }: { scope: AuditScope; isOn: (no: number) => boolean; setOn: (no: number, v: boolean) => void; onOpen: (no: number) => void; onSwitch: () => void; accent?: string }) {
  const s = useSession();
  const viewOnly = isViewOnly(s);
  const summary = useAuditSummary(scope);
  const node = flattenDivisions(s.tree).find((x) => divisionLabel(x.node) === s.division)?.node;
  const target = scope === '法人' ? `［法人］ ${s.tree.name}` : `［${node?.kind ?? '合算区分'}］ ${s.division}`;
  const col = (nos: number[]) => (
    <div style={{ display: 'grid', gap: 5, alignContent: 'start' }}>
      {nos.map((no) => {
        const it = AUDIT_ITEMS.find((a) => a.no === no);
        if (!it) return null;
        const on = isOn(no);
        const nn = String(no).padStart(2, '0');
        return (
          <div key={no} data-audit-item={nn} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ width: 28, flex: 'none', textAlign: 'right', fontSize: 14, fontVariantNumeric: 'tabular-nums', color: on ? '#3d4a56' : '#9aa5b1' }}>{nn}.</span>
            <input type="checkbox" checked={on} disabled={viewOnly} onChange={(e) => setOn(no, e.target.checked)} aria-label={`${nn} ${it.name} を有効にする`} style={{ width: 17, height: 17, flex: 'none', accentColor: accent }} />
            <button type="button" onClick={() => onOpen(no)} title={`${it.name}（${summary(no)}）。クリックで設定内容を${viewOnly ? '表示' : '開く'}`} style={{ flex: 1, minWidth: 0, height: 30, padding: '0 10px', textAlign: 'left', border: '1px solid #d5dde5', background: '#fff', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', color: on ? '#22303c' : '#9aa5b1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</button>
          </div>
        );
      })}
    </div>
  );
  const p: CSSProperties = { margin: 0, fontSize: 14, lineHeight: 1.6, color: '#5b6773' };
  return (
    <div data-audit-checklist={scope} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px 28px' }}>
      <div style={{ gridColumn: 1, gridRow: '1 / span 2' }}>{col(CHECK_COLS[0])}</div>
      <div style={{ gridColumn: 2, gridRow: 1, display: 'grid', gap: 12, alignContent: 'start' }}>
        {col(CHECK_COLS[1])}
        <div style={{ display: 'grid', gap: 6 }}>
          <p style={p}>01〜14、18〜19 は会計システムのデータ同士を比較してチェックするものです。15〜17 は減価償却システムのデータと会計システムのデータを比較してチェックするものです。</p>
          <p style={p}>減価償却データの指定は「法人・区分」の設定で行います。各項目の具体的な内容は、項目名のボタンをクリックしてください。</p>
          <p style={p}>各項目で使っている科目の区分コードを変更した場合は、再設定を行ってください。</p>
        </div>
      </div>
      <div style={{ gridColumn: 3, gridRow: 1 }}>{col(CHECK_COLS[2])}</div>
      <div data-audit-target style={{ gridColumn: '2 / span 2', gridRow: 2, alignSelf: 'end', display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#3d4a56' }}>
          <span aria-hidden style={{ width: 22, height: 22, flex: 'none', borderRadius: 999, background: '#2c6fbd', color: '#fff', fontSize: 14, fontWeight: 800, fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>i</span>
          この画面のチェックボックスの設定は、以下の{scope === '区分' ? '区分のみ' : '法人全体'}に対する設定となります。
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0, padding: '6px 12px', background: '#f1f4f6', border: '1px solid #e2e8ee', borderRadius: 6, fontSize: 14, fontWeight: 700, color: '#22303c' }}>{target}</div>
          <button type="button" data-action="対象切替" onClick={onSwitch} style={btn(accent)}>{scope === '区分' ? '法人決算チェック設定' : '区分の決算チェック設定に戻る'}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- データ範囲確認の図 ---------- */
const PILL: Record<string, CSSProperties> = {
  拠点区分: { background: '#fbe4ee', borderColor: '#e6b3c8' },
  サービス区分: { background: '#e5f2d6', borderColor: '#b9d79a' },
  小サービス区分: { background: '#fde9d2', borderColor: '#efc396' },
  法人: { background: '#e8f0fb', borderColor: '#b6c9e6' },
};
function Pill({ node, on }: { node: DivisionNode | { name: string; kind: string; code?: string }; on: boolean }) {
  const label = 'code' in node && node.code ? `${node.code} ${node.name}` : node.name;
  return <span style={{ display: 'inline-block', minWidth: 150, padding: '6px 14px', borderRadius: 999, border: '2px solid', fontSize: 14, fontWeight: on ? 800 : 500, color: on ? '#22303c' : '#6b7782', boxShadow: on ? '0 0 0 2px rgba(31,122,82,.35)' : 'none', ...(PILL[node.kind] ?? PILL.法人) }}>{label}</span>;
}
function RangeChart({ scope }: { scope: AuditScope }) {
  const s = useSession();
  if (scope === '法人') return <div style={{ display: 'flex', justifyContent: 'center', padding: '18px 0' }}><Pill node={{ name: s.tree.name + '（法人全体）', kind: '法人' }} on /></div>;
  // 起動中の区分の道筋をたどり、拠点区分から下を図にする
  let node: DivisionNode = s.tree;
  let base: DivisionNode | null = null;
  for (const name of s.divisionPath.slice(1)) {
    const next = (node.children ?? []).find((c) => c.name === name);
    if (!next) break;
    node = next;
    if (next.kind === '拠点区分') base = next;
  }
  const root = base ?? node;
  const onPath = (n: DivisionNode) => s.divisionPath.includes(n.name) || divisionLabel(n) === s.division;
  const head: CSSProperties = { fontSize: 14, fontWeight: 700, color: '#7a8794', textAlign: 'center' };
  const kids = root.children ?? [];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px 18px', alignItems: 'center', padding: '6px 4px 14px' }}>
      <div style={head}>拠点区分</div><div style={head}>サービス区分</div><div style={head}>小サービス区分</div>
      {kids.length === 0 ? (
        <><div style={{ textAlign: 'center' }}><Pill node={root} on /></div><div /><div /></>
      ) : kids.map((c, i) => {
        const gk = c.children ?? [];
        return (
          <div key={c.id} style={{ display: 'contents' }}>
            <div style={{ textAlign: 'center' }}>{i === 0 && <Pill node={root} on={onPath(root)} />}</div>
            <div style={{ textAlign: 'center' }}><Pill node={c} on={onPath(c)} /></div>
            <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>{gk.map((g) => <Pill key={g.id} node={g} on={onPath(g)} />)}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- 設定画面 ---------- */
export function AuditItemDialog({ no, scope, onClose, onSaved, accent = '#1f7a52' }: { no: number | null; scope: AuditScope; onClose: () => void; onSaved?: (msg: string) => void; accent?: string }) {
  const sess = useSession();
  const st = useAuditStore();
  const viewOnly = isViewOnly(sess);
  const [stage, setStage] = useState<'range' | 'edit'>('range');
  const [draft, setDraft] = useState<string[][]>([]);
  const [param, setParam] = useState('');
  useEffect(() => {
    if (no == null) return;
    // 参照のみ権限は設定しないので、設定先の確認は出さずに内容を表示する
    setStage(viewOnly ? 'edit' : 'range');
    setDraft(picksOf(st, scope, no).map((p) => [...p]));
    setParam(AUDIT_PARAMS[no] ? String(paramOf(st, scope, no)) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [no, scope]);
  if (no == null) return null;
  const def = auditItemDef(no);
  const item = AUDIT_ITEMS.find((a) => a.no === no);
  const pr = AUDIT_PARAMS[no];
  const title = `${no2(no)}. ${item?.name ?? ''}`;
  const toggle = (ei: number, name: string) => setDraft((d) => d.map((p, i) => (i !== ei ? p : p.includes(name) ? p.filter((x) => x !== name) : [...p, name])));
  const setAll = (on: boolean) => setDraft(def.elems.map((e) => (on ? e.accounts.map((a) => a.name) : [])));
  const ok = () => {
    save(scope, no, draft.map((p, i) => def.elems[i].accounts.filter((a) => p.includes(a.name)).map((a) => a.name)), pr && !pr.fixed ? parseInt(param.replace(/[^0-9]/g, '') || '0', 10) : undefined);
    onSaved?.(`${title} の設定を保存しました`);
    onClose();
  };
  const two = def.elems.length > 1;

  if (stage === 'range') {
    return (
      <Modal open onClose={onClose} width={760} title="データ範囲確認">
        <div style={{ padding: '14px 22px 18px' }} data-audit-range>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: '10px 14px 4px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#3d4a56', marginBottom: 8 }}>{scope === '法人' ? '法人決算チェック設定' : '決算チェック設定'}　設定先の確認</div>
            <RangeChart scope={scope} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <span aria-hidden style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontSize: 14, color: '#22303c' }}>上の図の区分に対する設定となります。よろしいですか？</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button type="button" onClick={onClose} style={btn()}>キャンセル</button>
              <button type="button" className="submit-btn" onClick={() => setStage('edit')} style={btn(accent, true)}>OK</button>
            </span>
          </div>
        </div>
      </Modal>
    );
  }

  const box: CSSProperties = { padding: '6px 14px', border: '1px solid #9aa5b1', borderRadius: 4, background: '#fff', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' };
  return (
    <Modal open onClose={onClose} width={two ? 900 : 640} title={`決算チェック設定 ― ${title}`}>
      <div style={{ padding: '12px 22px 18px', display: 'grid', gap: 12 }} data-audit-item-dialog={no}>
        <div style={{ fontSize: 14, color: '#5b6773' }}>
          <span style={{ padding: '2px 8px', borderRadius: 6, background: '#eef2f6', fontWeight: 700, color: '#3d4a56', marginRight: 8 }}>{scope === '法人' ? '法人全体' : `この区分のみ：${sess.division}`}</span>
          {viewOnly ? '参照のみの権限のため、設定内容の表示だけができます。' : '診断用条件式の各要素を構成する勘定科目を、チェックにより有効または無効に切り替えます。'}
        </div>
        {def.formula && (
          <div data-audit-formula style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {def.elems.map((e, i) => (
              <span key={e.label} style={{ display: 'contents' }}>
                {i > 0 && <span style={{ fontSize: 18, fontWeight: 700, color: '#3d4a56' }}>{def.formula!.ops[i - 1]}</span>}
                <span style={box}>{CIRCLED[i]}{e.label}</span>
              </span>
            ))}
          </div>
        )}
        {pr && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
            <span style={{ color: '#3d4a56', fontWeight: 700 }}>{pr.label}</span>
            {pr.fixed || viewOnly ? (
              <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{paramOf(st, scope, no).toLocaleString('ja-JP')} {pr.unit}{pr.unit === '円' ? '以上' : ''}{pr.fixed && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: '#8290a0' }}>変更できません</span>}</span>
            ) : (
              <><input className="field-input ring" inputMode="numeric" value={param ? parseInt(param, 10).toLocaleString('ja-JP') : ''} onChange={(e) => setParam(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} style={{ width: 120, textAlign: 'right', padding: '6px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }} /><span style={{ color: '#7a8794' }}>{pr.unit}</span></>
            )}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: two ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)', gap: 12 }}>
          {def.elems.map((e, ei) => (
            <div key={e.label} data-audit-elem={ei + 1}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#3d4a56', marginBottom: 4 }}>{def.formula ? CIRCLED[ei] : ''}{e.label}（{e.group}）</div>
              <div style={{ border: '1px solid #cfd8e0', borderRadius: 6, height: two ? 170 : 320, overflowY: 'auto', background: '#fff' }}>
                {e.accounts.map((a) => {
                  const on = (draft[ei] ?? []).includes(a.name);
                  return (
                    <label key={a.code + a.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 10px', fontSize: 14, cursor: viewOnly ? 'default' : 'pointer', background: on ? '#f3f8fd' : 'transparent' }}>
                      <input type="checkbox" checked={on} disabled={viewOnly} onChange={() => toggle(ei, a.name)} style={{ width: 15, height: 15 }} />
                      <span style={{ width: 100, flex: 'none', color: '#5b6773', fontVariantNumeric: 'tabular-nums' }}>{a.code}</span>
                      <span style={{ fontWeight: on ? 700 : 400, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {def.provisional && <div style={{ fontSize: 12, color: '#9aa5b1' }}>※ この項目の条件式の構成は、現行画面を確認でき次第そろえます。科目の一覧はサンプルです。</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!viewOnly && <>
            <button type="button" onClick={() => setAll(true)} style={btn('#5b6773', false, true)}>すべて有効</button>
            <button type="button" onClick={() => setAll(false)} style={btn('#5b6773', false, true)}>すべて無効</button>
          </>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {viewOnly ? <button type="button" onClick={onClose} style={btn(accent, true)}>閉じる</button> : <>
              <button type="button" onClick={onClose} style={btn()}>キャンセル</button>
              <button type="button" className="submit-btn" onClick={ok} style={btn(accent, true)}>OK</button>
            </>}
          </span>
        </div>
      </div>
    </Modal>
  );
}
