// 経年グラフ／分析グラフ（共通部品）
//   左：部タブ（経年のみ）＋科目ツリー（チェックで選択）／右：選択した科目ごとのグラフを縦に並べる。
//   既存Fキー：F1選択解除・F2単位切替（千円⇄円）・F3年月切替（年度⇄月）・F11スケール切替（個別⇄共通）。
//   値はサンプル（決定的な疑似乱数）。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { BarChart } from './BarChart';
import { LABEL, ReportShell } from './ReportShell';
import { ANALYSIS_ITEMS, ERA_YEARS, GRAPH_BAR_COLOR, GRAPH_PARTS, GRAPH_TREES, MONTH_LABELS, type GraphPart } from '../data';
import { seededSeries } from '../lib/hier';

interface Props {
  mode: 'yearly' | 'analysis';
  variant: 'form' | 'sheet';
  accent: string;
  onNavigate: (label: string) => void;
}

export function GraphPage({ mode, variant, accent, onNavigate }: Props) {
  const isYearly = mode === 'yearly';
  const [part, setPart] = useState<GraphPart>('資産');
  const [selected, setSelected] = useState<string[]>(isYearly ? ['資産:1', '資産:7'] : ['0', '14']);
  const [unitK, setUnitK] = useState(true);
  const [byMonth, setByMonth] = useState(false);
  const [commonScale, setCommonScale] = useState(false);

  const labels = byMonth ? MONTH_LABELS : ERA_YEARS;
  const items = isYearly
    ? GRAPH_TREES[part].map((r, i) => ({ key: `${part}:${i}`, name: r.name, level: r.level, base: r.base, unit: unitK ? '千円' : '円' }))
    : ANALYSIS_ITEMS.map((a, i) => ({ key: String(i), name: a.name, level: 0, base: a.base, unit: a.unit }));
  const toggle = (key: string) => setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  // 表示中のタブ（経年）または全体（分析）の選択項目
  const allItems = isYearly ? GRAPH_PARTS.flatMap((p) => GRAPH_TREES[p.key].map((r, i) => ({ key: `${p.key}:${i}`, name: r.name, base: r.base, part: p.key }))) : items.map((it) => ({ ...it, part: '資産' as GraphPart }));
  const charts = selected
    .map((k) => allItems.find((it) => it.key === k))
    .filter((it): it is NonNullable<typeof it> => !!it)
    .map((it) => {
      const analysis = !isYearly ? ANALYSIS_ITEMS[Number(it.key)] : undefined;
      let values = seededSeries(it.name + (byMonth ? 'm' : 'y'), labels.length, it.base || 1);
      if (isYearly) values = values.map((v) => (it.base === 0 ? 0 : unitK ? v : v * 1000));
      else values = values.map((v) => (analysis!.unit === '%' ? Math.round(v * 10) / 10 : v * 1000));
      const unit = isYearly ? (unitK ? '千円' : '円') : analysis!.unit;
      return { key: it.key, title: it.name, values, unit, color: isYearly ? GRAPH_BAR_COLOR[it.part] : accent, line: isYearly ? it.part === '資金' : true };
    });
  const yMax = commonScale ? Math.max(1, ...charts.flatMap((c) => c.values)) : undefined;

  const tabStyle = (on: boolean, color: string): CSSProperties => ({ padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', background: on ? color : '#fff3c4', color: on ? '#fff' : '#7a5b00', border: '1px solid ' + (on ? color : '#f0d98a') });

  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title={isYearly ? '経年グラフ' : '分析グラフ'}
      subtitle={<>{isYearly ? '科目を選ぶと、直近8年度の推移グラフを表示します。' : '経営分析の指標を選ぶと、直近8年度の推移グラフを表示します。'}<span style={{ color: '#b7791f' }}>（値はサンプルです）</span></>}
      tools={[
        { label: '選択解除', onClick: () => setSelected([]) },
        ...(isYearly ? [{ label: unitK ? '単位切替（千円→円）' : '単位切替（円→千円）', onClick: () => setUnitK((u) => !u) }] : []),
        { label: byMonth ? '年月切替（月→年度）' : '年月切替（年度→月）', onClick: () => setByMonth((b) => !b) },
        { label: commonScale ? 'スケール切替（共通→個別）' : 'スケール切替（個別→共通）', onClick: () => setCommonScale((c) => !c) },
      ]}
      onBack={() => onNavigate('伝票入力')}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0,1fr)', gap: 0, minHeight: 520 }}>
        {/* 左：部タブ＋ツリー */}
        <div style={{ borderRight: '1px solid #eef2f5', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {isYearly && (
            <div style={{ display: 'flex', gap: 6, padding: '12px 14px', borderBottom: '1px solid #eef2f5' }}>
              {GRAPH_PARTS.map((p) => (
                <button key={p.key} type="button" className="chip" onClick={() => setPart(p.key)} style={tabStyle(part === p.key, p.color)}>{p.key}</button>
              ))}
            </div>
          )}
          <div style={{ padding: '8px 14px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={LABEL}>{isYearly ? '科目' : '指標'}</span>
            <span style={{ fontSize: 11, color: '#9aa5b1' }}>チェックした項目のグラフを右に表示</span>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 360px)', padding: '0 8px 10px' }}>
            {items.map((it) => {
              const on = selected.includes(it.key);
              return (
                <label key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', paddingLeft: 8 + it.level * 16, borderRadius: 6, background: on ? '#eef2f6' : 'transparent', cursor: 'pointer', fontSize: 12.5, color: on ? accent : '#22303c', fontWeight: on ? 700 : it.level === 0 ? 600 : 400 }}>
                  <input type="checkbox" checked={on} onChange={() => toggle(it.key)} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 右：グラフ */}
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, background: '#f6f8fa', overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
          {charts.length === 0 && <div style={{ padding: '60px 20px', textAlign: 'center', color: '#9aa5b1', fontSize: 13 }}>左の一覧から{isYearly ? '科目' : '指標'}をチェックしてください。</div>}
          {charts.map((c) => (
            <BarChart key={c.key} title={c.title} unit={c.unit} labels={labels} values={c.values} color={c.color} line={c.line} yMax={yMax} fmt={(v) => (c.unit === '%' ? String(Math.round(v * 10) / 10) : v.toLocaleString('ja-JP'))} />
          ))}
        </div>
      </div>
    </ReportShell>
  );
}
