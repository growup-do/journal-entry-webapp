// 仕訳一覧・元帳で共通の「区分色」「区分」（既存 F7／F8）
//   区分色 … 伝票入力区分ごとのカラー（部門情報の変更で設定）を行の背景に使う。凡例を表示。
//   区分   … 一覧に表示する伝票入力区分を選ぶ（合算区分で起動したときの内訳の絞り込みに相当）。

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { LABEL } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { btn } from './ui';
import { FUSEN_COLORS, type Voucher } from '../store/journalStore';
import { flattenDivisions, setSession, useSession, type DivisionNode } from '../store/session';
import { COLORS, mapTree } from './DivisionTreeEditor';

/** 伝票の区分コード（先頭3桁） */
export const codeOf = (r: Voucher) => r.service.slice(0, 3);

export function useDivisionTools(all: Voucher[], accent: string) {
  const s = useSession();
  const toast = useToast();
  const [colorOn, setColorOn] = useState(false);
  const [divs, setDivs] = useState<string[] | null>(null); // 表示する区分コード（null＝すべて）
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [colorOpen, setColorOpen] = useState(false);
  const setColor = (id: string, color: string) => setSession({ tree: mapTree(s.tree, (n) => (n.id === id ? { ...n, color } : n))! });
  const entries: DivisionNode[] = flattenDivisions(s.tree).map((x) => x.node).filter((n) => !!n.entry);
  const divOf = (code: string) => entries.find((n) => n.code === code);
  const usedCodes = [...new Set(all.map(codeOf))].sort();

  const openDialog = () => { setDraft(divs ?? usedCodes); setOpen(true); };
  const apply = () => {
    if (draft.length === 0) return toast.show('表示する区分を1つ以上選んでください');
    setDivs(draft.length === usedCodes.length && usedCodes.every((c) => draft.includes(c)) ? null : draft);
    setOpen(false);
  };

  /** 一覧のフィルタ */
  const visible = (r: Voucher) => !divs || divs.includes(codeOf(r));
  /** 行の背景（付箋 › 区分色） */
  const rowBg = (r: Voucher) => (r.fusen ? FUSEN_COLORS[r.fusen] + '14' : colorOn ? divOf(codeOf(r))?.color ?? '#f5f7f9' : 'transparent');
  /** Seq 下などに置く小さな色チップ */
  const chip = (r: Voucher): ReactNode => { const d = divOf(codeOf(r)); return colorOn && d ? <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: d.color, border: '1px solid #c3ccd4', marginRight: 4, verticalAlign: 'middle' }} /> : null; };

  const tools = [{ label: divs ? `区分：${divs.length}/${usedCodes.length}` : '区分', onClick: openDialog }];
  const colorSwitch = <ColorSwitch on={colorOn} onChange={setColorOn} accent={accent} />;

  const clearButton = divs ? (
    <button type="button" onClick={() => setDivs(null)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid ' + accent, background: '#fff', color: accent, fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>区分：{divs.map((c) => divOf(c)?.name ?? c).join('・')} ×解除</button>
  ) : null;

  const legend = colorOn ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11.5, color: '#5b6773' }}>
      <span style={LABEL}>区分色</span>
      {usedCodes.map((c) => { const d = divOf(c); return <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 8, background: d?.color ?? '#f1f4f6', border: '1px solid #e2e8ee' }}><span style={{ fontVariantNumeric: 'tabular-nums', color: '#8290a0' }}>{c}</span>{d?.name ?? '（区分なし）'}</span>; })}
      <button type="button" className="btn-outline" onClick={() => setColorOpen(true)} style={btn(accent, false, true)}>区分色の設定</button>
    </div>
  ) : null;

  const colorModal = (
    <Modal open={colorOpen} onClose={() => setColorOpen(false)} width={560} title="区分色の設定">
      <div style={{ padding: '12px 22px 18px' }}>
        <div style={{ fontSize: 12.5, color: '#5b6773', marginBottom: 10 }}>伝票入力区分ごとに、仕訳一覧・元帳で行の背景に使う色を設定します（「部門情報の変更」のカラーと共通）。</div>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'hidden' }}>
          {entries.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #f1f4f6', fontSize: 13, opacity: d.use === false ? 0.5 : 1 }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: d.color ?? '#f1f4f6', border: '1px solid #c3ccd4', flex: 'none' }} />
              <span style={{ fontVariantNumeric: 'tabular-nums', color: '#8290a0', width: 32 }}>{d.code}</span>
              <span style={{ fontWeight: 600, width: 120 }}>{d.name}</span>
              <span style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                {COLORS.map((c) => <span key={c} onClick={() => setColor(d.id, c)} title={c} style={{ width: 18, height: 18, borderRadius: 4, background: c, border: '2px solid ' + (d.color === c ? accent : '#e2e8ee'), cursor: 'pointer' }} />)}
                <input type="color" value={d.color ?? '#f1f4f6'} onChange={(e) => setColor(d.id, e.target.value)} title="任意の色" style={{ width: 26, height: 22, padding: 0, border: '1px solid #cfd8e0', borderRadius: 4, background: '#fff', cursor: 'pointer' }} />
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}><button type="button" className="submit-btn" onClick={() => setColorOpen(false)} style={btn(accent, true)}>閉じる</button></div>
      </div>
    </Modal>
  );

  const modal = (
    <>
    {colorModal}
    <Modal open={open} onClose={() => setOpen(false)} width={480} title="表示する区分の選択">
      <ToastView msg={toast.msg} />
      <div style={{ padding: '12px 22px 18px' }}>
        <div style={{ fontSize: 12.5, color: '#5b6773', marginBottom: 8 }}>一覧に表示する伝票入力区分をチェックします（合算区分で起動したときの内訳の絞り込みに相当）。</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button type="button" className="btn-outline" onClick={() => setDraft(usedCodes)} style={btn('#5b6773', false, true)}>すべて</button>
          <button type="button" className="btn-outline" onClick={() => setDraft([])} style={btn('#5b6773', false, true)}>解除</button>
        </div>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'hidden' }}>
          {usedCodes.map((c) => {
            const d = divOf(c);
            const n = all.filter((r) => codeOf(r) === c).length;
            const on = draft.includes(c);
            return (
              <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #f1f4f6', fontSize: 13, cursor: 'pointer', background: on ? '#fbfcfd' : '#fff' }}>
                <input type="checkbox" checked={on} onChange={() => setDraft((x) => (on ? x.filter((y) => y !== c) : [...x, c]))} />
                <span style={{ width: 14, height: 14, borderRadius: 3, background: d?.color ?? '#f1f4f6', border: '1px solid #c3ccd4', flex: 'none' }} />
                <span style={{ fontVariantNumeric: 'tabular-nums', color: '#8290a0' }}>{c}</span>
                <span style={{ fontWeight: 600 }}>{d?.name ?? '（区分なし）'}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#9aa5b1' }}>{n} 件</span>
              </label>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button type="button" onClick={() => setOpen(false)} style={btn()}>キャンセル</button>
          <button type="button" className="submit-btn" onClick={apply} style={btn(accent, true)}>OK</button>
        </div>
      </div>
    </Modal>
    </>
  );

  return { colorOn, divs, visible, rowBg, chip, tools, colorSwitch, clearButton, legend, modal, filtered: !!divs };
}

/** 区分色の切替スイッチ（既存 F7）。摘要／業者スイッチの隣に置く */
export function ColorSwitch({ on, onChange, accent }: { on: boolean; onChange: (v: boolean) => void; accent: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', border: '1px solid #e2e8ee', borderRadius: 20, background: '#fff' }}>
      <span onClick={() => onChange(!on)} style={{ fontSize: 12, fontWeight: on ? 800 : 500, color: on ? accent : '#9aa5b1', cursor: 'pointer' }}>区分色</span>
      <span role="switch" aria-checked={on} onClick={() => onChange(!on)} style={{ display: 'inline-block', width: 36, height: 20, borderRadius: 10, background: on ? accent : '#cfd8e0', position: 'relative', flex: 'none', cursor: 'pointer' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </span>
    </span>
  );
}

/** 摘要／業者の表示切替スイッチ（既存 F9／F10） */
export function BizSwitch({ on, onChange, accent }: { on: boolean; onChange: (v: boolean) => void; accent: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', border: '1px solid #e2e8ee', borderRadius: 20, background: '#fff' }}>
      <span onClick={() => onChange(false)} style={{ fontSize: 12, fontWeight: on ? 500 : 800, color: on ? '#9aa5b1' : accent, cursor: 'pointer' }}>摘要</span>
      <span role="switch" aria-checked={on} onClick={() => onChange(!on)} style={{ display: 'inline-block', width: 36, height: 20, borderRadius: 10, background: on ? accent : '#cfd8e0', position: 'relative', flex: 'none', cursor: 'pointer' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </span>
      <span onClick={() => onChange(true)} style={{ fontSize: 12, fontWeight: on ? 800 : 500, color: on ? accent : '#9aa5b1', cursor: 'pointer' }}>業者</span>
    </span>
  );
}
