// 経年グラフ／分析グラフ（共通部品）
//   骨格は ReportShell 共通：集計期間 → 表示切替 → グラフ。
//   左：部タブ（経年のみ）＋科目ツリー（チェックで選択。「すべて選択」で一括）／右：選択した科目ごとのグラフを縦に並べる。
//   表示切替（現行のファンクションキーに対応）：
//     経年グラフ … 横軸（年度／月。月のときは 月次／累計 の切替。確認メモ #104）、金額単位（円／千円／百万円。確認メモ #106）、スケール切替（確認メモ #105）
//     分析グラフ … 年度の推移だけ（横軸の切替なし。確認メモ #110）、スケール切替、平均表示（確認メモ #109）
//   値はサンプル（決定的な疑似乱数）。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { BarChart } from './BarChart';
import { LABEL, ReportShell, Segmented, SwitchPill } from './ReportShell';
import { ScreenPrintMenu } from './ScreenPrintMenu';
import { displayName, ANALYSIS_ITEMS, ERA_YEARS, GRAPH_BAR_COLOR, GRAPH_PARTS, GRAPH_TREES, MONTH_LABELS, type GraphPart } from '../data';
import { seededSeries } from '../lib/hier';

interface Props {
  mode: 'yearly' | 'analysis';
  variant: 'form' | 'sheet';
  accent: string;
  onNavigate: (label: string) => void;
}

/** 金額単位（現行の F2 単位切替：円→千円→百万円。確認メモ #106） */
const UNITS = ['円', '千円', '百万円'] as const;
type Unit = (typeof UNITS)[number];
/** サンプル値（千円単位）を表示単位に換算 */
const toUnit = (v: number, u: Unit) => (u === '円' ? v * 1000 : u === '千円' ? v : Math.round(v / 100) / 10);

export function GraphPage({ mode, variant, accent }: Props) {
  const isYearly = mode === 'yearly';
  const [part, setPart] = useState<GraphPart>('資産');
  const [selected, setSelected] = useState<string[]>(isYearly ? ['資産:1', '資産:7'] : ['0', '14']);
  const [unit, setUnit] = useState<Unit>('千円');
  const [byMonth, setByMonth] = useState(false);
  /** 月別表示のとき、累計で見る（確認メモ #104） */
  const [cumulative, setCumulative] = useState(false);
  /** スケール切替：縦軸の最低値を 0 ではなく値に合わせる（確認メモ #105） */
  const [autoMin, setAutoMin] = useState(false);
  /** 平均表示：平均値の赤い線（分析グラフ。確認メモ #109） */
  const [average, setAverage] = useState(false);

  const monthly = isYearly && byMonth;
  const labels = monthly ? MONTH_LABELS : ERA_YEARS;
  const items = isYearly
    ? GRAPH_TREES[part].map((r, i) => ({ key: `${part}:${i}`, name: r.name, level: r.level, base: r.base, unit }))
    : ANALYSIS_ITEMS.map((a, i) => ({ key: String(i), name: a.name, level: 0, base: a.base, unit: a.unit }));
  const toggle = (key: string) => setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  /** すべて選択：表示中の一覧（経年は選んでいる部、分析は全指標）をまとめて付け外し（確認メモ #103） */
  const allOn = items.length > 0 && items.every((it) => selected.includes(it.key));
  const toggleAll = () => setSelected((s) => (allOn ? s.filter((k) => !items.some((it) => it.key === k)) : [...new Set([...s, ...items.map((it) => it.key)])]));

  // 表示中のタブ（経年）または全体（分析）の選択項目
  const allItems = isYearly ? GRAPH_PARTS.flatMap((p) => GRAPH_TREES[p.key].map((r, i) => ({ key: `${p.key}:${i}`, name: r.name, base: r.base, part: p.key }))) : items.map((it) => ({ ...it, part: '資産' as GraphPart }));
  const charts = selected
    .map((k) => allItems.find((it) => it.key === k))
    .filter((it): it is NonNullable<typeof it> => !!it)
    .map((it) => {
      const analysis = !isYearly ? ANALYSIS_ITEMS[Number(it.key)] : undefined;
      let values = seededSeries(it.name + (monthly ? 'm' : 'y'), labels.length, it.base || 1);
      if (isYearly) {
        if (it.base === 0) values = values.map(() => 0);
        if (monthly && cumulative) values = values.reduce<number[]>((acc, v, i) => { acc.push((acc[i - 1] ?? 0) + v); return acc; }, []);
        values = values.map((v) => toUnit(v, unit));
      } else values = values.map((v) => (analysis!.unit === '%' ? Math.round(v * 10) / 10 : v * 1000));
      const u = isYearly ? unit : analysis!.unit;
      return { key: it.key, title: it.name, values, unit: u, color: isYearly ? GRAPH_BAR_COLOR[it.part] : accent, line: isYearly ? it.part === '資金' : true };
    });
  const fmtOf = (u: string) => (v: number) => (u === '%' || u === '百万円' ? v.toLocaleString('ja-JP', { minimumFractionDigits: u === '百万円' ? 1 : 0, maximumFractionDigits: 1 }) : v.toLocaleString('ja-JP'));

  const tabStyle = (on: boolean, color: string): CSSProperties => ({ padding: '6px 16px', borderRadius: 8, fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', background: on ? color : '#fff3c4', color: on ? '#fff' : '#7a5b00', border: '1px solid ' + (on ? color : '#f0d98a') });

  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title={displayName(isYearly ? '経年グラフ' : '分析グラフ')}
      subtitle={<>{isYearly ? '科目を選ぶと、直近8年度の推移グラフを表示します。横軸を「月」にすると当年度の月別（月次／累計）になります。' : '経営分析の指標を選ぶと、直近8年度の推移グラフを表示します。'}<span style={{ color: '#b7791f' }}>（値はサンプルです）</span></>}
      extraTools={<ScreenPrintMenu page={isYearly ? '経年グラフ' : '分析グラフ'} accent={accent} />}
      period={
        <>
          <span style={{ fontSize: 14, color: '#48565f' }}>{monthly ? `当年度の月別（4月〜3月）${cumulative ? '・累計' : ''}` : `直近${ERA_YEARS.length}年度`}</span>
        </>
      }
      targetLabel={isYearly ? '指定科目' : '指定項目'}
      target={
        <>
          {charts.length === 0 && <span style={{ color: '#9aa5b1' }}>左の一覧でチェックした{isYearly ? '科目' : '項目'}をグラフにします。</span>}
          {charts.map((c) => (
            <span key={c.key} data-picked-item={c.title} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 6px 3px 10px', borderRadius: 8, background: '#fff', border: '1px solid #cfd8e0', fontSize: 14, fontWeight: 700, color: '#22303c' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
              {c.title}
              <button type="button" aria-label={`${c.title} を外す`} onClick={() => toggle(c.key)} style={{ border: 'none', background: 'transparent', color: '#8290a0', fontSize: 14, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>×</button>
            </span>
          ))}
          {charts.length > 0 && <span style={{ fontSize: 12, color: '#9aa5b1' }}>{charts.length} 件</span>}
        </>
      }
      listNote={<span>左：{isYearly ? '部タブと科目の一覧（「すべて選択」で表示中の部をまとめて付け外し）' : '分析項目の一覧（「すべて選択」でまとめて付け外し）'}　右：選んだ{isYearly ? '科目' : '項目'}ごとのグラフ</span>}
      switches={
        <>
          {isYearly && <Segmented label="横軸" items={['年度', '月'] as const} value={byMonth ? '月' : '年度'} onChange={(v) => setByMonth(v === '月')} accent={accent} />}
          {monthly && <Segmented label="表示" items={['月次', '累計'] as const} value={cumulative ? '累計' : '月次'} onChange={(v) => setCumulative(v === '累計')} accent={accent} title="月別表示のときの累計切替" />}
          {isYearly && <Segmented label="金額単位" items={UNITS} value={unit} onChange={setUnit} accent={accent} />}
          <SwitchPill label="スケール切替" on={autoMin} onChange={setAutoMin} accent={accent} title="縦軸の最低値を 0 ではなく、値に合わせて自動調整します（現行の F11 スケール切替）" />
          {!isYearly && <SwitchPill label="平均表示" on={average} onChange={setAverage} accent={accent} title="各グラフに平均値の赤い線を表示します（現行の F4 平均表示）" />}
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0,1fr)', gap: 0, minHeight: 520 }}>
        {/* 左：部タブ＋ツリー */}
        <div style={{ borderRight: '1px solid #eef2f5', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {isYearly && (
            <div style={{ display: 'flex', gap: 6, padding: '12px 14px', borderBottom: '1px solid #eef2f5' }}>
              {GRAPH_PARTS.map((p) => (
                <button key={p.key} type="button" className="chip" role="tab" aria-selected={part === p.key} data-tab={p.key} onClick={() => setPart(p.key)} style={tabStyle(part === p.key, p.color)}>{p.key}</button>
              ))}
            </div>
          )}
          <div style={{ padding: '8px 14px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={LABEL}>{isYearly ? '科目' : '指標'}</span>
            <span style={{ fontSize: 12, color: '#9aa5b1' }}>チェックした項目のグラフを右に表示</span>
            {/* すべて選択（旧「選択解除」。付け外しで全チェックの ON／OFF。確認メモ #103） */}
            <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: allOn ? accent : '#5b6773', cursor: 'pointer', whiteSpace: 'nowrap' }} title={allOn ? '表示中の項目のチェックをすべて外します' : '表示中の項目をすべてチェックします'}>
              <input type="checkbox" checked={allOn} onChange={toggleAll} data-select-all />
              すべて選択
            </label>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 360px)', padding: '0 8px 10px' }}>
            {items.map((it) => {
              const on = selected.includes(it.key);
              return (
                <label key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', paddingLeft: 8 + it.level * 16, borderRadius: 6, background: on ? '#eef2f6' : 'transparent', cursor: 'pointer', fontSize: 14, color: on ? accent : '#22303c', fontWeight: on ? 700 : it.level === 0 ? 600 : 400 }}>
                  <input type="checkbox" checked={on} onChange={() => toggle(it.key)} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 右：グラフ */}
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, background: '#f6f8fa', overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
          {charts.length === 0 && <div style={{ padding: '60px 20px', textAlign: 'center', color: '#9aa5b1', fontSize: 14 }}>左の一覧から{isYearly ? '科目' : '指標'}をチェックしてください。</div>}
          {charts.map((c) => (
            <BarChart key={c.key} title={c.title} unit={c.unit} labels={labels} values={c.values} color={c.color} line={c.line} autoMin={autoMin} average={!isYearly && average} fmt={fmtOf(c.unit)} />
          ))}
        </div>
      </div>
    </ReportShell>
  );
}
