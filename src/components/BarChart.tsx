// 棒グラフ（既存の3D円柱グラフをフラットな棒グラフに置換）。ライブラリ不使用のSVG。
// line=true で折れ線を重ねる（既存の「資金」グラフ相当）。
// autoMin=true で縦軸の最低値を 0 ではなく値に合わせて自動調整（現行の F11「スケール切替」。確認メモ #105）。
// average=true で平均値の赤い線を重ねる（現行の F4「平均表示」。確認メモ #109）。

interface Props {
  title: string;
  unit: string;
  labels: string[];
  values: number[];
  color: string;
  line?: boolean;
  /** 縦軸の上限（スケール共通化用）。省略時は自動 */
  yMax?: number;
  /** 縦軸の最低値を 0 ではなく、値に合わせて自動調整する（スケール切替） */
  autoMin?: boolean;
  /** 平均値の線を表示する（平均表示） */
  average?: boolean;
  /** 値の表示フォーマット */
  fmt?: (v: number) => string;
}

export function BarChart({ title, unit, labels, values, color, line, yMax, autoMin, average, fmt = (v) => v.toLocaleString('ja-JP') }: Props) {
  const W = 720, H = 250, L = 20, R = 78, T = 26, B = 34;
  const n = values.length;
  const maxRaw = yMax ?? Math.max(...values, 0);
  const minRaw = autoMin && values.length ? Math.min(...values) : 0;
  // 目盛りの刻み：自動調整のときは「最大−最小」の幅に合わせる（値の差が見えるように）
  const step = niceStep(autoMin ? Math.max(maxRaw - minRaw, maxRaw * 0.05) : maxRaw);
  const max = Math.max(step, Math.ceil((maxRaw || 1) / step) * step);
  const min = autoMin ? Math.min(Math.floor(minRaw / step) * step, max - step) : 0;
  const iw = W - L - R, ih = H - T - B;
  const bw = (iw / n) * 0.56;
  const x = (i: number) => L + (iw / n) * (i + 0.5);
  const y = (v: number) => T + ih - ((v - min) / (max - min)) * ih;
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step);
  const avg = values.length ? values.reduce((a, v) => a + v, 0) / values.length : 0;

  return (
    <div style={{ background: '#fff', border: '1px solid #dde4ea', borderRadius: 12, padding: '12px 14px 6px', boxShadow: '0 4px 16px rgba(30,50,70,.06)' }} data-chart={title}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 6px 4px', gap: 10 }}>
        <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 14.5 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#7a8794', fontWeight: 600, display: 'flex', gap: 12 }}>
          {average && <span style={{ color: '#c0392b' }}>平均 {fmt(Math.round(avg * 10) / 10)}</span>}
          {autoMin && <span title="スケール切替：縦軸の最低値を値に合わせて自動調整しています">縦軸 {fmt(min)} から</span>}
          <span>単位：{unit}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === min ? '#c3ccd4' : '#e6ecf1'} strokeDasharray={t === min ? undefined : '3 3'} />
            <text x={W - R + 8} y={y(t) + 4} fontSize="11" fill="#8290a0" fontFamily="inherit">{fmt(t)}</text>
          </g>
        ))}
        {values.map((v, i) => (
          <g key={i}>
            <rect x={x(i) - bw / 2} y={y(Math.max(v, min))} width={bw} height={Math.max(0, y(min) - y(Math.max(v, min)))} rx="3" fill={color} opacity="0.9" />
            <text x={x(i)} y={y(Math.max(v, min)) - 6} fontSize="11.5" fontWeight="700" fill="#c0392b" textAnchor="middle" fontFamily="inherit">{fmt(v)}</text>
            <text x={x(i)} y={H - 10} fontSize="11.5" fill="#48565f" textAnchor="middle" fontFamily="inherit">{labels[i]}</text>
          </g>
        ))}
        {line && (
          <>
            <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="#2c5f9e" strokeWidth="2" />
            {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="#2c5f9e" />)}
          </>
        )}
        {average && values.length > 0 && (
          <g data-average-line>
            <line x1={L} x2={W - R} y1={y(avg)} y2={y(avg)} stroke="#c0392b" strokeWidth="2" strokeDasharray="8 4" />
            <text x={L + 4} y={y(avg) - 5} fontSize="11" fontWeight="700" fill="#c0392b" fontFamily="inherit">平均</text>
          </g>
        )}
      </svg>
    </div>
  );
}

function niceStep(max: number): number {
  if (max <= 0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / p;
  const s = f <= 1 ? 0.2 : f <= 2 ? 0.5 : f <= 5 ? 1 : 2;
  return s * p;
}
