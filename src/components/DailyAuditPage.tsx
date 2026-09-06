// 日次調査（既存「日次調査」の再現）
//   開くと「一致・不一致検索を開始しますか？」の確認 → はい で調査が走り、
//   月ごとの調査結果（未調査 → OK同額）、当月カレンダー、資金収支／貸借／事業活動の照合結果を表示する。
//   数値はサンプル（構造確認用）。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { NOT_IMPL, ToastView, useToast } from './Toast';
import { DAILY_AUDIT_SAMPLE as S, makeSheetSeed } from '../data';

const SLOTS = ['繰越残高', '期中残高', '4月仕訳', '5月仕訳', '6月仕訳', '7月仕訳', '8月仕訳', '9月仕訳', '10月仕訳', '11月仕訳', '12月仕訳', '1月仕訳', '2月仕訳', '3月仕訳', '決算月仕訳'];
type Phase = 'confirm' | 'idle' | 'running' | 'done';
const yen = (n: number) => n.toLocaleString('ja-JP');

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  onNavigate: (label: string) => void;
}

export function DailyAuditPage({ variant, accent, onNavigate }: Props) {
  const [phase, setPhase] = useState<Phase>('confirm');
  const [doneCount, setDoneCount] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const toast = useToast();

  const run = () => {
    setPhase('running');
    setDoneCount(0);
    window.clearInterval(timer.current);
    const start = Date.now();
    // 経過時間から進捗を算出（バックグラウンドタブでタイマーが間引かれても完走する）
    timer.current = window.setInterval(() => {
      const n = Math.min(SLOTS.length, Math.floor((Date.now() - start) / 110));
      setDoneCount(n);
      if (n >= SLOTS.length) {
        window.clearInterval(timer.current);
        setPhase('done');
      }
    }, 100);
  };
  useEffect(() => () => window.clearInterval(timer.current), []);

  const done = phase === 'done';
  // 当月（8月）の仕訳件数を日ごとに集計（カレンダー用）
  const counts = new Map<number, number>();
  makeSheetSeed().forEach((e) => {
    const [m, d] = e.date.split('/');
    if (m === '8') counts.set(Number(d), (counts.get(Number(d)) ?? 0) + 1);
  });
  const first = new Date(2026, 7, 1);
  const daysInMonth = new Date(2026, 8, 0).getDate();
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const isSheet = variant === 'sheet';
  const card: CSSProperties = { background: '#fff', border: '1px solid #dde4ea', borderRadius: isSheet ? 14 : 16, boxShadow: '0 6px 26px rgba(30,50,70,.07)', overflow: 'hidden' };
  const panelTitle: CSSProperties = { fontSize: 11, fontWeight: 700, color: '#8290a0', padding: '10px 14px 0' };
  const cell = (label: string, value: number | null, opt?: { hi?: 'green' | 'yellow'; sub?: string }): CSSProperties & { label: string; value: number | null; hi?: 'green' | 'yellow'; sub?: string } => ({ label, value, ...opt });
  const Box = ({ label, value, hi, sub }: { label: string; value: number | null; hi?: 'green' | 'yellow'; sub?: string }) => (
    <div style={{ padding: '9px 12px', border: '1px solid #e2e8ee', borderRadius: 8, background: hi === 'green' ? '#e6f6ec' : hi === 'yellow' ? '#fff8d6' : '#fff', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: '#5b6773', fontWeight: 600 }}>{label}</div>
      <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums', color: value != null && value < 0 ? '#c0392b' : '#22303c' }}>{value == null ? '—' : yen(value)}</div>
      {sub && <div style={{ textAlign: 'right', fontSize: 11, color: BLUE_TXT, fontVariantNumeric: 'tabular-nums' }}>{sub}</div>}
    </div>
  );
  const Same = () => (
    <div style={{ textAlign: 'center', margin: '4px 0' }}>
      <span style={{ display: 'inline-block', padding: '2px 12px', borderRadius: 10, background: done ? '#fff1b8' : '#f1f4f6', color: done ? '#8a6d00' : '#b3bcc5', fontSize: 11.5, fontWeight: 700, letterSpacing: '.2em' }}>同額</span>
    </div>
  );
  const v = (n: number) => (done ? n : 0);

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <ToastView msg={toast.msg} />

      <Modal open={phase === 'confirm'} onClose={() => setPhase('idle')} width={440} strict>
        <div style={{ padding: '26px 28px 22px' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: '#e8f0fb', color: '#2c5f9e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>?</span>
            <div style={{ fontSize: 15, fontWeight: 700 }}>一致・不一致検索を開始しますか？</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
            <button type="button" onClick={() => setPhase('idle')} style={{ padding: '9px 22px', border: '1px solid #cfd8e0', borderRadius: 8, background: '#fff', color: '#5b6773', fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}>いいえ</button>
            <button type="button" onClick={run} style={{ padding: '9px 26px', background: accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}>はい</button>
          </div>
        </div>
      </Modal>

      <div style={{ width: '100%', maxWidth: isSheet ? 'none' : 1280, ...card }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px 14px', borderBottom: '1px solid #eef2f5', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: isSheet ? 17 : 21 }}>
              日次調査 <span style={{ fontSize: 12.5, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>社会福祉法人　チャイルド保育園 › 社会福祉事業</span>
            </div>
            <div style={{ color: '#7a8794', fontSize: 12, marginTop: 4 }}>仕訳と残高の一致・不一致を月ごとに検索し、資金収支・貸借・事業活動の整合を確認します。</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: '伝票表示', fn: () => toast.show(NOT_IMPL) },
              { label: '検査継続', fn: () => toast.show(NOT_IMPL) },
              { label: '再計算', fn: run },
              { label: '戻る', fn: () => onNavigate('伝票入力') },
            ].map((b) => (
              <button key={b.label} type="button" className="btn-outline" onClick={b.fn} style={{ padding: '8px 16px', border: '1px solid #cfd8e0', borderRadius: 8, background: b.label === '再計算' ? accent : '#fff', color: b.label === '再計算' ? '#fff' : '#5b6773', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) 360px', gap: 20, padding: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            {/* 月別の調査結果 */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8290a0', marginBottom: 8 }}>調査結果（月別）</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0,1fr))', gap: 6 }}>
                {SLOTS.map((s, i) => {
                  const st = phase === 'running' ? (i < doneCount ? 'ok' : i === doneCount ? 'busy' : 'wait') : done ? 'ok' : 'wait';
                  return (
                    <div key={s} style={{ border: '1px solid #dde4ea', borderRadius: 8, overflow: 'hidden', background: '#f6f8fa' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#5b6773', textAlign: 'center', padding: '5px 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s}</div>
                      <div style={{ margin: 4, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800, letterSpacing: '.02em', background: st === 'ok' ? '#f5a623' : st === 'busy' ? '#22303c' : '#2c5f9e', color: '#fff', transition: 'background .2s' }}>
                        {st === 'ok' ? 'OK 同額' : st === 'busy' ? '調査中…' : '？ 未調査'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* カレンダー */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8290a0', marginBottom: 8 }}>令和8年 8月　<span style={{ fontWeight: 500 }}>日付ごとの仕訳件数</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 4 }}>
                {['日', '月', '火', '水', '木', '金', '土'].map((w, i) => (
                  <div key={w} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: i === 0 ? '#c0392b' : i === 6 ? '#2c5f9e' : '#8290a0', padding: '4px 0' }}>{w}</div>
                ))}
                {cells.map((d, i) => {
                  const n = d ? counts.get(d) ?? 0 : 0;
                  return (
                    <div key={i} style={{ height: 52, border: '1px solid #e6ecf1', borderRadius: 6, background: d ? (n ? '#eaf5ef' : '#fff') : '#f6f8fa', padding: '4px 6px', fontSize: 11, color: '#5b6773', position: 'relative' }}>
                      {d}
                      {n > 0 && <span style={{ position: 'absolute', right: 5, bottom: 4, fontSize: 10.5, fontWeight: 700, color: '#1f7a52' }}>{n}件</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 照合パネル */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ border: '1px solid #dde4ea', borderRadius: 10, paddingBottom: 10 }}>
              <div style={panelTitle}>資金収支</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '8px 12px 0' }}>
                <Box {...cell('資金支出', v(S.shishutsu))} />
                <Box {...cell('前期末支払資金', v(S.zenkiShiharai))} />
                <Box {...cell('当期末支払資金', v(S.tokiShiharai), { hi: 'green' })} />
                <Box {...cell('資金収入', v(S.shunyu))} />
              </div>
            </div>
            <Same />
            <div style={{ border: '1px solid #dde4ea', borderRadius: 10, paddingBottom: 10 }}>
              <div style={panelTitle}>貸借　<span style={{ color: BLUE_TXT, fontWeight: 500 }}>青字は流動負債中の引当金の額</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '8px 12px 0' }}>
                <Box {...cell('流動資産', v(S.ryudoShisan))} />
                <Box {...cell('流動負債', v(S.ryudoFusai), { sub: done ? yen(S.hikiate) : undefined })} />
                <Box {...cell('固定資産', v(S.koteiShisan))} />
                <Box {...cell('固定負債', v(S.koteiFusai))} />
                <Box {...cell('支払資金（流動資産－流動負債＋引当金）', v(S.tokiShiharai), { hi: 'green' })} />
                <Box {...cell('純資産', v(S.junShisan))} />
                <div />
                <Box {...cell('次期繰越収支差額', v(S.jikiKurikoshi), { hi: 'yellow' })} />
              </div>
            </div>
            <Same />
            <div style={{ border: '1px solid #dde4ea', borderRadius: 10, paddingBottom: 10 }}>
              <div style={panelTitle}>事業活動</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '8px 12px 0' }}>
                <Box {...cell('事業活動支出', v(S.jigyoShishutsu))} />
                <Box {...cell('前期繰越収支差額', v(S.zenkiKurikoshi))} />
                <Box {...cell('次期繰越収支差額', v(S.jikiKurikoshi), { hi: 'yellow' })} />
                <Box {...cell('事業活動収入', v(S.jigyoShunyu))} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

const BLUE_TXT = '#2c5f9e';
