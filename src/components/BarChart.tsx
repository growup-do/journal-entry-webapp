// 棒グラフ（既存の3D円柱グラフをフラットな棒グラフに置換）。ライブラリ不使用のSVG。
// line=true で折れ線を重ねる（既存の「資金」グラフ相当）。

interface Props {
  title: string;
  unit: string;
  labels: string[];
  values: number[];
  color: string;
  line?: boolean;
  /** 縦軸の上限（スケール共通化用）。省略時は自動 */
  yMax?: number;
  /** 値の表示フォーマット */
  fmt?: (v: number) => string;
}

export function BarChart({ title, unit, labels, values, color, line, yMax, fmt = (v) => v.toLocaleString('ja-JP') }: Props) {
  const W = 720, H = 250, L = 20, R = 78, T = 26, B = 34;
  const n = values.length;
  const maxRaw = yMax ?? Math.max(...values, 0);
  const step = niceStep(maxRaw);
  const max = Math.max(step, Math.ceil((maxRaw || 1) / step) * step);
  const iw = W - L - R, ih = H - T - B;
  const bw = (iw / n) * 0.56;
  const x = (i: number) => L + (iw / n) * (i + 0.5);
  const y = (v: number) => T + ih - (v / max) * ih;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);

  return (
    <div style={{ background: '#fff', border: '1px solid #dde4ea', borderRadius: 12, padding: '12px 14px 6px', boxShadow: '0 4px 16px rgba(30,50,70,.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 6px 4px' }}>
        <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 14.5 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: '#7a8794', fontWeight: 600 }}>単位：{unit}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#c3ccd4' : '#e6ecf1'} strokeDasharray={t === 0 ? undefined : '3 3'} />
            <text x={W - R + 8} y={y(t) + 4} fontSize="11" fill="#8290a0" fontFamily="inherit">{fmt(t)}</text>
          </g>
        ))}
        {values.map((v, i) => (
          <g key={i}>
            <rect x={x(i) - bw / 2} y={y(v)} width={bw} height={Math.max(0, y(0) - y(v))} rx="3" fill={color} opacity="0.9" />
            <text x={x(i)} y={y(v) - 6} fontSize="11.5" fontWeight="700" fill="#c0392b" textAnchor="middle" fontFamily="inherit">{fmt(v)}</text>
            <text x={x(i)} y={H - 10} fontSize="11.5" fill="#48565f" textAnchor="middle" fontFamily="inherit">{labels[i]}</text>
          </g>
        ))}
        {line && (
          <>
            <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="#2c5f9e" strokeWidth="2" />
            {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="#2c5f9e" />)}
          </>
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
