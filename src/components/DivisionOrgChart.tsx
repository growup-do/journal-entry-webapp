// 区分の組織図（法人 → 事業区分〔横に並ぶ〕→ 拠点区分・サービス区分・小サービス区分〔各事業区分の下に縦につながる〕）
//   ログイン後の「伝票入力区分の選択」と、各種設定「法人・区分」の区分階層で同じ見た目を使う。

import type { CSSProperties, ReactNode } from 'react';
import { divisionLabel, type DivisionNode } from '../store/session';

const LINE = '#b3bfc9';
const CARD_H = 44;
const GAP = 8;
/** 伝票を入力できる区分か、集計・参照用の親区分か */
export const kindOf = (n: DivisionNode) => (!!n.entry && !(n.children ?? []).some((c) => c.entry && c.use !== false) ? '入力区分' : '親区分');

/** 凡例（入力区分／親区分） */
export function OrgChartLegend() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, fontWeight: 500, color: '#5b6773', flexWrap: 'wrap' }}>
      <span><b style={{ padding: '1px 7px', borderRadius: 8, background: '#eaf5ef', color: '#1f7a52', fontSize: 10.5 }}>入力区分</b>　伝票を入力できる</span>
      <span><b style={{ padding: '1px 7px', borderRadius: 8, background: '#eef2f6', color: '#5b6773', fontSize: 10.5 }}>親区分</b>　集計・参照用</span>
    </span>
  );
}

interface Props {
  tree: DivisionNode;
  accent: string;
  isSelected: (n: DivisionNode) => boolean;
  onSelect: (n: DivisionNode) => void;
  /** ダブルクリックで確定（区分の選択で使う） */
  onConfirm?: (n: DivisionNode) => void;
  /** 選べる区分か（既定：使用する区分だけ） */
  canSelect?: (n: DivisionNode) => boolean;
  /** カードの右に置く操作（区分階層の設定で「＋ 配下に追加」を出す） */
  action?: (n: DivisionNode) => ReactNode;
  /** カードのツールチップ */
  hint?: string;
  maxHeight?: number | string;
}

export function DivisionOrgChart({ tree, accent, isSelected, onSelect, onConfirm, canSelect = (n) => n.use !== false, action, hint, maxHeight = '54vh' }: Props) {
  /** 組織図の1枚（法人・事業区分・拠点区分・サービス区分…） */
  const card = (n: DivisionNode, tier: 'root' | 'head' | 'leaf') => {
    const selectable = canSelect(n);
    const k = kindOf(n);
    const on = isSelected(n);
    // 枠線は border のショートハンド1本で指定する（選択・非使用の状態もここで切り替える）
    const off = n.use === false;
    const bw = tier === 'root' ? '2px' : tier === 'head' ? '1.5px' : '1px';
    const bc = on ? accent : off ? '#cfd8e0' : tier === 'root' ? '#22303c' : tier === 'head' ? '#7a8794' : '#cfd8e0';
    const base: CSSProperties = { border: `${bw} ${off ? 'dashed' : 'solid'} ${bc}`, background: on ? accent : off ? '#f6f8fa' : tier === 'head' ? '#f3f6f8' : '#fff', color: on ? '#fff' : off ? '#9aa5b1' : '#22303c', boxShadow: on ? `0 0 0 3px ${accent}33` : 'none' };
    const act = action?.(n);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative', zIndex: 1 }}>
        <button
          type="button"
          data-division={divisionLabel(n)}
          disabled={!selectable}
          aria-pressed={on}
          onClick={() => onSelect(n)}
          onDoubleClick={onConfirm ? () => onConfirm(n) : undefined}
          title={selectable ? hint : 'この区分は使用しない設定です'}
          style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, height: CARD_H, padding: '0 12px', borderRadius: 10, textAlign: 'left', fontFamily: 'inherit', cursor: selectable ? 'pointer' : 'not-allowed', ...base }}
        >
          {n.color && n.use !== false && <span style={{ flex: 'none', width: 12, height: 12, borderRadius: 3, background: n.color, border: '1px solid ' + (on ? 'rgba(255,255,255,.7)' : '#c3ccd4') }} />}
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: on ? 'rgba(255,255,255,.85)' : '#8290a0', lineHeight: 1.3 }}>{n.kind}{n.code ? `　${n.code}` : ''}</span>
            <span style={{ display: 'block', fontSize: tier === 'root' ? 14.5 : 13.5, fontWeight: 700, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.name}</span>
          </span>
          <span style={{ flex: 'none', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: on ? 'rgba(255,255,255,.25)' : n.use === false ? '#eef2f6' : k === '入力区分' ? '#eaf5ef' : '#eef2f6', color: on ? '#fff' : n.use === false ? '#9aa5b1' : k === '入力区分' ? '#1f7a52' : '#5b6773' }}>{n.use === false ? '非使用' : k}</span>
        </button>
        {act}
      </div>
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
  const heads = tree.children ?? [];
  return (
    <div data-org-chart style={{ border: '1px solid #e2e8ee', borderRadius: 12, padding: '18px 18px 20px', maxHeight, overflow: 'auto', background: '#fbfcfd' }}>
      <div style={{ minWidth: heads.length * 320 }}>
        <div style={{ width: action ? 420 : 380, maxWidth: '100%', margin: '0 auto' }}>{card(tree, 'root')}</div>
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
  );
}
