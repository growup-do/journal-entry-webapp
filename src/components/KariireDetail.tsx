// 借入金明細書（別紙3①）の明細入力（現行の「借入金明細表」に合わせる。確認メモ #394）
//   行は「決算附属明細書設定」の「借入金明細書用　中区分項目の指定」から自動で作る。
//   指定したものが科目ならその科目を1行、項目ならその下の科目の数だけ行を出す。行はそれぞれ科目に結び付き、
//   期首残高・当期借入金・当期償還額・期末残高は印刷時にその科目の会計データから集計する（この画面では入力しない）。
//   入力するのは 借入先／拠点区分／元金償還補助金／利率／支払利息（支出・収入）／返済期限／使途／担保資産（種類・地番・内容・帳簿価額）。
//   現行と同じく行の追加・削除はない（行を増やすときは設定で科目を指定する）。

import type { CSSProperties } from 'react';
import { GRAPH_TREES } from '../data';
import type { DivisionNode } from '../store/session';
import { HelpTip, input, numInput, toInt, yen } from './ui';

/** 入力する列（先頭は結び付いた科目） */
export const KARIIRE_COLS = ['科目', '借入先', '拠点区分', '元金償還補助金', '利率（%）', '支払利息（支出）', '支払利息（収入）', '返済期限', '使途', '担保資産（種類）', '担保資産（地番・内容）', '担保資産（帳簿価額）'];
export const KARIIRE_NUM = [3, 5, 6, 11];
/** 明細の初期値（サンプル） */
export const KARIIRE_ROWS: string[][] = [['設備資金借入金', '○○銀行', 'チャイルド保育園', '600000', '1.20', '36000', '0', 'R18.3', '園舎改修', '土地', '○○市○○町1-1', '22000000']];
/** 印刷時に集計する科目の金額（サンプル）：期首残高・当期借入金・当期償還額 */
const BALANCE: Record<string, [number, number, number]> = { 設備資金借入金: [3_600_000, 0, 600_000] };

/** 設定で指定した科目・項目から、行に結び付ける科目を出す（項目はその下の科目に展開する） */
export function kariireAccounts(sel: string[]): string[] {
  const tree = GRAPH_TREES.負債;
  const out: string[] = [];
  sel.filter(Boolean).forEach((name) => {
    const i = tree.findIndex((r) => r.name === name);
    const kids: string[] = [];
    if (i >= 0) for (let j = i + 1; j < tree.length && tree[j].level > tree[i].level; j++) if (tree[j].level === tree[i].level + 1) kids.push(tree[j].name);
    (kids.length ? kids : [name]).forEach((n) => { if (!out.includes(n)) out.push(n); });
  });
  return out;
}
/** 科目ごとの行（保存済みの行がなければ空の行） */
const rowOf = (rows: string[][], acct: string) => rows.find((r) => r[0] === acct) ?? [acct, '', '', '0', '', '0', '0', '', '', '', '', '0'];

/** 印刷に使う表（期首残高〜期末残高は科目の会計データから集計） */
export function kariireTable(rows: string[][], accts: string[]) {
  return {
    header: ['借入先', '拠点区分', '期首残高', '当期借入金', '当期償還額', 'うち元金償還補助金', '差引期末残高', '利率（%）', '支払利息（支出）', '支払利息（収入）', '返済期限', '使途', '担保資産（種類）', '担保資産（地番・内容）', '担保資産（帳簿価額）'],
    rows: kariireAccounts(accts).map((a): (string | number)[] => {
      const r = rowOf(rows, a); const [open, add, repay] = BALANCE[a] ?? [0, 0, 0];
      return [r[1] || a, r[2], open, add, repay, toInt(r[3]), open + add - repay, r[4], toInt(r[5]), toInt(r[6]), r[7], r[8], r[9], r[10], toInt(r[11])];
    }),
  };
}

/** 拠点区分の候補（区分ツリーから。見本のダミーは除く） */
function basesOf(tree: DivisionNode): string[] {
  const out: string[] = [];
  const walk = (n: DivisionNode) => { if (n.kind === '拠点区分' && !n.name.includes('ダミー')) out.push(n.name); (n.children ?? []).forEach(walk); };
  walk(tree);
  return out;
}

const TH: CSSProperties = { position: 'sticky', top: 0, background: '#f3f6f9', padding: '6px 8px', fontSize: 12, fontWeight: 700, color: '#5b6773', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8ee', textAlign: 'left' };
const TD: CSSProperties = { padding: '4px 6px', borderBottom: '1px solid #f1f4f6', verticalAlign: 'middle' };
const cell: CSSProperties = { ...input, padding: '4px 8px', fontSize: 14 };

export function KariireDetail({ rows, accts, tree, accent, onChange, onOpenSettings }: { rows: string[][]; accts: string[]; tree: DivisionNode; accent: string; onChange: (rows: string[][]) => void; onOpenSettings: () => void }) {
  const list = kariireAccounts(accts);
  const bases = basesOf(tree);
  const put = (acct: string, ci: number, v: string) => {
    const cur = rowOf(rows, acct).map((x, i) => (i === ci ? v : x));
    onChange(rows.some((r) => r[0] === acct) ? rows.map((r) => (r[0] === acct ? cur : r)) : [...rows, cur]);
  };
  const num = (acct: string, ci: number, v: string, w = 110) => <input className="field-input" data-kariire-cell={ci} aria-label={`${acct}の${KARIIRE_COLS[ci]}`} inputMode="numeric" value={v ? yen(toInt(v)) : ''} onChange={(e) => put(acct, ci, String(toInt(e.target.value)))} style={{ ...numInput, padding: '4px 8px', fontSize: 14, width: w }} />;
  const txt = (acct: string, ci: number, v: string, w: number, max?: number) => <input className="field-input" data-kariire-cell={ci} aria-label={`${acct}の${KARIIRE_COLS[ci]}`} value={v} maxLength={max} onChange={(e) => put(acct, ci, e.target.value)} style={{ ...cell, width: w }} />;
  return (
    <div data-kariire style={{ border: '1px solid #e2e8ee', borderRadius: 12, background: '#fff', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #eef2f5', fontSize: 14, fontWeight: 800 }}>
        明細入力
        <HelpTip text={['行は「決算附属明細書設定」の「借入金明細書用　中区分項目の指定」で指定した科目から作ります。項目を指定したときは、その下の科目の数だけ行が出ます', '期首残高・当期借入金・当期償還額・期末残高は、印刷するときに行の科目の会計データから集計します', '行を増やすときは、設定で科目を指定します', '返済期限は半角6文字まで入力できます']} />
        <span style={{ fontWeight: 500, fontSize: 12, color: '#8290a0' }}>{list.length} 科目</span>
      </div>
      {list.length === 0 ? (
        <div style={{ padding: '24px 14px', display: 'grid', justifyItems: 'center', gap: 10, fontSize: 14, color: '#5b6773' }}>
          借入金明細書に使う科目が指定されていません。
          <button type="button" onClick={onOpenSettings} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${accent}`, background: '#fff', color: accent, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>決算附属明細書設定で科目を指定する</button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ ...TH, left: 0, zIndex: 2 }}>科目</th>
                <th rowSpan={2} style={TH}>借入先</th>
                <th rowSpan={2} style={TH}>拠点区分</th>
                <th rowSpan={2} style={{ ...TH, textAlign: 'right' }}>元金償還補助金</th>
                <th rowSpan={2} style={{ ...TH, textAlign: 'right' }}>利率（%）</th>
                <th colSpan={2} style={{ ...TH, textAlign: 'center', borderBottom: '1px solid #e2e8ee' }}>支払利息</th>
                <th rowSpan={2} style={TH}>返済期限</th>
                <th rowSpan={2} style={TH}>使途</th>
                <th colSpan={3} style={{ ...TH, textAlign: 'center' }}>担保資産</th>
              </tr>
              <tr>
                <th style={{ ...TH, top: 29, textAlign: 'right' }}>支出</th>
                <th style={{ ...TH, top: 29, textAlign: 'right' }}>収入</th>
                <th style={{ ...TH, top: 29 }}>種類</th>
                <th style={{ ...TH, top: 29 }}>地番・内容</th>
                <th style={{ ...TH, top: 29, textAlign: 'right' }}>帳簿価額</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const r = rowOf(rows, a);
                return (
                  <tr key={a} data-kariire-row={a}>
                    <td style={{ ...TD, position: 'sticky', left: 0, background: '#f9fafb', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>{a}</td>
                    <td style={TD}>{txt(a, 1, r[1], 170, 18)}</td>
                    <td style={TD}><select aria-label={`${a}の拠点区分`} data-kariire-cell={2} value={r[2]} onChange={(e) => put(a, 2, e.target.value)} style={{ ...cell, width: 150, background: '#fff' }}><option value="">（空）</option>{bases.map((b) => <option key={b}>{b}</option>)}</select></td>
                    <td style={TD}>{num(a, 3, r[3])}</td>
                    <td style={TD}><input className="field-input" data-kariire-cell={4} aria-label={`${a}の利率`} inputMode="decimal" value={r[4]} placeholder="0.00" onChange={(e) => put(a, 4, e.target.value.replace(/[^0-9.]/g, ''))} style={{ ...cell, width: 72, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} /></td>
                    <td style={TD}>{num(a, 5, r[5], 100)}</td>
                    <td style={TD}>{num(a, 6, r[6], 100)}</td>
                    <td style={TD}>{txt(a, 7, r[7], 84, 6)}</td>
                    <td style={TD}>{txt(a, 8, r[8], 150)}</td>
                    <td style={TD}>{txt(a, 9, r[9], 90)}</td>
                    <td style={TD}>{txt(a, 10, r[10], 170)}</td>
                    <td style={TD}>{num(a, 11, r[11], 120)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
