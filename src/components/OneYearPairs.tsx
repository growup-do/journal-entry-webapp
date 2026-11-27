// １年基準科目設定（確認メモ #454。現行：保守 › 決算チェック設定 › 23.１年基準科目 期中残高チェック ›［１年基準科目設定］、
//   および 決算附属明細書設定 ›［１年基準科目設定］。どちらも同じ画面・同じ設定）
//   上の表で「流動資産科目／固定資産科目」、下の表で「流動負債科目／固定負債科目」の対応するペアを選ぶ。
//   行番号付きの行が最初から並び、1 行が 1 ペア。科目はセルの一覧から選ぶ（先頭は空欄。空欄を選ぶとその行のペアを外す）。
//   設定は法人全体で 1 つ（法人全体の決算チェックと借入金明細書で共有）。ボタンは［デフォルト設定にする］［OK］［キャンセル］。

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { Notice, btn } from './ui';

export const CURRENT_ASSETS = ['現金預金', '有価証券', '事業未収金', '未収金', '未収補助金', '未収収益', '受取手形', '貯蔵品', '医薬品', '給食用材料', '商品・製品', '仕掛品', '原材料', '立替金', '前払金', '前払費用', '１年以内回収予定長期貸付金', '１年以内回収予定事業区分間長期貸付金', '１年以内回収予定拠点区分間長期貸付金', '短期貸付金', '事業区分間貸付金', '拠点区分間貸付金', '仮払金', 'その他の流動資産', '徴収不能引当金'];
export const FIXED_ASSETS = ['土地', '建物', '構築物', '機械及び装置', '車輌運搬具', '器具及び備品', '建設仮勘定', '有形リース資産', '権利', 'ソフトウェア', '無形リース資産', '投資有価証券', '長期貸付金', '事業区分間長期貸付金', '拠点区分間長期貸付金', '退職給付引当資産', '長期預り金積立資産', '施設整備等積立資産', '差入保証金', '長期前払費用', 'その他の固定資産'];
export const CURRENT_LIABS = ['短期運営資金借入金', '事業未払金', 'その他の未払金', '支払手形', '役員等短期借入金', '１年以内返済予定設備資金借入金', '１年以内返済予定長期運営資金借入金', '１年以内返済予定リース債務', '１年以内返済予定役員等長期借入金', '１年以内返済予定事業区分間長期借入金', '１年以内返済予定拠点区分間長期借入金', '１年以内支払予定長期未払金', '未払費用', '預り金', '職員預り金', '前受金', '前受収益', '事業区分間借入金', '拠点区分間借入金', '仮受金', '賞与引当金', 'その他の流動負債'];
export const FIXED_LIABS = ['設備資金借入金', '長期運営資金借入金', 'リース債務', '役員等長期借入金', '事業区分間長期借入金', '拠点区分間長期借入金', '退職給付引当金', '役員退職慰労引当金', '長期未払金', '長期預り金', 'その他の固定負債'];

/** 1 行＝1 ペア（左：流動、右：固定）。'' は未選択 */
type Pair = [string, string];
export interface OneYearConf { assets: Pair[]; liabs: Pair[] }
const ROWS = 10;
const pad = (list: Pair[]): Pair[] => [...list, ...Array.from({ length: Math.max(0, ROWS - list.length) }, (): Pair => ['', ''])];
/** ［デフォルト設定にする］の内容：１年以内回収予定・返済予定の科目と、対応する長期の科目 */
export const ONE_YEAR_DEFAULT = (): OneYearConf => ({
  assets: pad([
    ['１年以内回収予定長期貸付金', '長期貸付金'],
    ['１年以内回収予定事業区分間長期貸付金', '事業区分間長期貸付金'],
    ['１年以内回収予定拠点区分間長期貸付金', '拠点区分間長期貸付金'],
  ]),
  liabs: pad([
    ['１年以内返済予定設備資金借入金', '設備資金借入金'],
    ['１年以内返済予定長期運営資金借入金', '長期運営資金借入金'],
    ['１年以内返済予定リース債務', 'リース債務'],
    ['１年以内返済予定役員等長期借入金', '役員等長期借入金'],
    ['１年以内返済予定事業区分間長期借入金', '事業区分間長期借入金'],
    ['１年以内返済予定拠点区分間長期借入金', '拠点区分間長期借入金'],
    ['１年以内支払予定長期未払金', '長期未払金'],
  ]),
});

/* ---------- 法人全体で 1 つの設定（決算チェックと借入金明細書で共有） ---------- */
let conf: OneYearConf = ONE_YEAR_DEFAULT();
const subs = new Set<() => void>();
export const getOneYear = () => conf;
const setOneYear = (c: OneYearConf) => { conf = c; subs.forEach((f) => f()); };
export const useOneYear = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => conf);
/** 設定済みのペアの数 */
export const pairCount = (c: OneYearConf) => [...c.assets, ...c.liabs].filter(([a, b]) => a && b).length;

const clone = (c: OneYearConf): OneYearConf => ({ assets: c.assets.map((p) => [...p] as Pair), liabs: c.liabs.map((p) => [...p] as Pair) });

export function OneYearPairsDialog({ open, onClose, onSaved, accent, viewOnly }: { open: boolean; onClose: () => void; onSaved?: (msg: string) => void; accent: string; viewOnly?: boolean }) {
  const cur = useOneYear();
  const [d, setD] = useState<OneYearConf>(() => clone(cur));
  useEffect(() => { if (open) setD(clone(getOneYear())); }, [open]);
  if (!open) return null;
  const setCell = (side: 'assets' | 'liabs', i: number, j: 0 | 1, v: string) => setD((x) => ({ ...x, [side]: x[side].map((p, k) => (k === i ? (j === 0 ? [v, p[1]] : [p[0], v]) : p)) as Pair[] }));
  /** 片方だけ選んだ行（ペアにならない） */
  const half = [...d.assets, ...d.liabs].some(([a, b]) => (a && !b) || (!a && b));
  const th: CSSProperties = { padding: '6px 8px', fontSize: 12, fontWeight: 700, color: '#5b6773', background: '#f6f8fa', borderBottom: '1px solid #e2e8ee', textAlign: 'left' };
  const td: CSSProperties = { padding: '3px 6px', borderBottom: '1px solid #f1f4f6' };
  const sel: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '5px 8px', border: '1px solid #cfd8e0', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', background: '#fff' };
  const table = (side: 'assets' | 'liabs', left: string, right: string, lopts: string[], ropts: string[]) => (
    <div data-one-year={side} style={{ border: '1px solid #e2e8ee', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0 }}><tr><th style={{ ...th, width: 36, textAlign: 'right' }} /><th style={th}>{left}</th><th style={th}>{right}</th></tr></thead>
          <tbody>
            {d[side].map(([a, b], i) => (
              <tr key={i}>
                <td style={{ ...td, textAlign: 'right', fontSize: 12, color: '#8290a0', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</td>
                <td style={td}><select aria-label={`${i + 1} 行目の${left}`} value={a} disabled={viewOnly} onChange={(e) => setCell(side, i, 0, e.target.value)} style={{ ...sel, borderColor: !a && b ? '#c0392b' : '#cfd8e0' }}><option value="" />{lopts.map((o) => <option key={o}>{o}</option>)}</select></td>
                <td style={td}><select aria-label={`${i + 1} 行目の${right}`} value={b} disabled={viewOnly} onChange={(e) => setCell(side, i, 1, e.target.value)} style={{ ...sel, borderColor: a && !b ? '#c0392b' : '#cfd8e0' }}><option value="" />{ropts.map((o) => <option key={o}>{o}</option>)}</select></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
  return (
    <Modal open onClose={onClose} width={820} title="１年基準科目設定">
      <div data-one-year-dialog style={{ padding: '12px 22px 18px', display: 'grid', gap: 10 }}>
        <Notice>法人全体の設定で、決算チェック（23. １年基準科目 期中残高チェック）と借入金明細書で同じものを使います。</Notice>
        {table('assets', '流動資産科目', '固定資産科目', CURRENT_ASSETS, FIXED_ASSETS)}
        {table('liabs', '流動負債科目', '固定負債科目', CURRENT_LIABS, FIXED_LIABS)}
        {half && <div style={{ fontSize: 12, color: '#b03a2e' }}>片方だけ選んだ行があります。両方の科目を選ぶか、両方を空欄にしてください。</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!viewOnly && <button type="button" data-one-year-default onClick={() => setD(ONE_YEAR_DEFAULT())} style={btn('#5b6773')}>デフォルト設定にする</button>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {viewOnly ? <button type="button" onClick={onClose} style={btn(accent, true)}>閉じる</button> : <>
              <button type="button" className="submit-btn" disabled={half} onClick={() => { setOneYear(d); onSaved?.(`１年基準科目設定を保存しました（ペア ${pairCount(d)} 件）`); onClose(); }} style={{ ...btn(accent, true), opacity: half ? 0.5 : 1 }}>保存</button>
              <button type="button" onClick={onClose} style={btn()}>キャンセル</button>
            </>}
          </span>
        </div>
      </div>
    </Modal>
  );
}
