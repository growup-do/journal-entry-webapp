// 日記帳・元帳で共通の「区分色」「区分名」（合算区分・親区分で起動したときの表示切替。依頼書 5.4.3）
//   区分色 … 伝票入力区分ごとのカラー（部門情報の変更で設定）を行の背景に使う。凡例を表示。
//   区分名 … 各行に伝票入力区分の名称を表示する。
//   入力区分で起動したときは区分が1つなので、どちらも無効表示にする（区分での絞り込みは【検索条件】で行う）。

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { LABEL, SwitchPill } from './ReportShell';
import { btn } from './ui';
import { FUSEN_COLORS, type Voucher } from '../store/journalStore';
import { flattenDivisions, setSession, startKindOf, useSession, type DivisionNode } from '../store/session';
import { COLORS, mapTree } from './DivisionTreeEditor';

/** 伝票の区分コード（先頭3桁） */
export const codeOf = (r: Voucher) => r.service.slice(0, 3);

export function useDivisionTools(all: Voucher[], accent: string) {
  const s = useSession();
  const [colorRaw, setColorOn] = useState(false);
  const [nameRaw, setNameOn] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const kind = startKindOf(s);
  /** 合算区分・親区分で起動したときだけ使える */
  const enabled = kind !== '入力区分';
  const colorOn = enabled && colorRaw;
  const nameOn = enabled && nameRaw;
  const why = enabled ? undefined : '合算区分・親区分で起動したときに使えます（入力区分では区分が1つのため切り替えはありません）';
  const setColor = (id: string, color: string) => setSession({ tree: mapTree(s.tree, (n) => (n.id === id ? { ...n, color } : n))! });
  const entries: DivisionNode[] = flattenDivisions(s.tree).map((x) => x.node).filter((n) => !!n.entry);
  const divOf = (code: string) => entries.find((n) => n.code === code);
  const usedCodes = [...new Set(all.map(codeOf))].sort();

  /** 行の背景（付箋 › 区分色） */
  const rowBg = (r: Voucher) => (r.fusen ? FUSEN_COLORS[r.fusen] + '14' : colorOn ? divOf(codeOf(r))?.color ?? '#f5f7f9' : 'transparent');
  /** Seq 下などに置く小さな色チップ */
  const chip = (r: Voucher): ReactNode => { const d = divOf(codeOf(r)); return colorOn && d ? <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: d.color, border: '1px solid #c3ccd4', marginRight: 4, verticalAlign: 'middle' }} /> : null; };
  /** 区分名のタグ（区分名スイッチが ON のときだけ） */
  const nameTag = (r: Voucher): ReactNode => {
    if (!nameOn) return null;
    const d = divOf(codeOf(r));
    return <span data-division-name style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 8, background: d?.color ?? '#f1f4f6', border: '1px solid #dde4ea', fontSize: 11, fontWeight: 700, color: '#48565f', whiteSpace: 'nowrap' }}><span style={{ fontVariantNumeric: 'tabular-nums', color: '#8290a0', fontWeight: 500 }}>{codeOf(r)}</span>{d?.name ?? r.service.replace(/^\d+ /, '')}</span>;
  };

  /** 表示切替に並べるスイッチ（区分色・区分名） */
  const switches = (
    <>
      <SwitchPill label="区分色" on={colorRaw} onChange={setColorOn} accent={accent} disabled={!enabled} title={why ?? '行の背景を区分ごとの色で塗り分けます'} />
      <SwitchPill label="区分名" on={nameRaw} onChange={setNameOn} accent={accent} disabled={!enabled} title={why ?? '各行に区分の名称を表示します'} />
    </>
  );

  const legend = colorOn ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11.5, color: '#5b6773' }}>
      <span style={LABEL}>区分色</span>
      {usedCodes.map((c) => { const d = divOf(c); return <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 8, background: d?.color ?? '#f1f4f6', border: '1px solid #e2e8ee' }}><span style={{ fontVariantNumeric: 'tabular-nums', color: '#8290a0' }}>{c}</span>{d?.name ?? '（区分なし）'}</span>; })}
      <button type="button" className="btn-outline" onClick={() => setColorOpen(true)} style={btn(accent, false, true)}>区分色の設定</button>
    </div>
  ) : null;

  const modal = (
    <Modal open={colorOpen} onClose={() => setColorOpen(false)} width={560} title="区分色の設定">
      <div style={{ padding: '12px 22px 18px' }}>
        <div style={{ fontSize: 12.5, color: '#5b6773', marginBottom: 10 }}>伝票入力区分ごとに、日記帳・元帳で行の背景に使う色を設定します（「部門情報の変更」のカラーと共通）。</div>
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

  return { enabled, colorOn, nameOn, rowBg, chip, nameTag, switches, legend, modal };
}

/** 区分色の切替スイッチ（単体で使う場合） */
export function ColorSwitch({ on, onChange, accent }: { on: boolean; onChange: (v: boolean) => void; accent: string }) {
  return <SwitchPill label="区分色" on={on} onChange={onChange} accent={accent} />;
}

/** 摘要／業者の表示切替スイッチ */
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
