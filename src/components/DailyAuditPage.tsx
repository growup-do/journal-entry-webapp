// 日次調査（既存「日次調査」の再現）
//   開くと「一致・不一致検索を開始しますか？」の確認 → はい で調査が走り、
//   月ごとの調査結果（未調査 → OK同額）、当月カレンダー、資金収支／貸借／事業活動の照合結果を表示する。
//   数値はサンプル（構造確認用）。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { FlagCell } from './VoucherEdit';
import { useVouchers } from '../store/journalStore';
import { DAILY_AUDIT_SAMPLE as S } from '../data';

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
  // 検査対象の会計月（4〜12, 1〜3）。「検査継続」で翌月へ進む
  const [month, setMonth] = useState(8);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [continueOpen, setContinueOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const toast = useToast();
  const vouchers = useVouchers();
  const monthVouchers = vouchers.filter((v) => Number(v.date.split('/')[0]) === month);
  const continueNext = () => {
    setContinueOpen(false);
    if (month === 3) { toast.show('年度末（3月）です。決算月の検査は「決算調査」で行ってください'); return; }
    const next = month === 12 ? 1 : month + 1;
    setMonth(next);
    run();
    toast.show(`${next}月の検査を開始しました`);
  };

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
  // 当月の仕訳件数を日ごとに集計（カレンダー用。仕訳ストアと共有）
  const counts = new Map<number, number>();
  monthVouchers.forEach((v) => { const d = Number(v.date.split('/')[1]); counts.set(d, (counts.get(d) ?? 0) + 1); });
  const calYear = month >= 4 ? 2026 : 2027; // 令和8年度
  const era = calYear - 2018;
  const first = new Date(calYear, month - 1, 1);
  const daysInMonth = new Date(calYear, month, 0).getDate();
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
              { label: '伝票表示', fn: () => setVoucherOpen(true) },
              { label: '検査継続', fn: () => setContinueOpen(true) },
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
                  const isCur = s === `${month}月仕訳`;
                  return (
                    <div key={s} style={{ border: '1px solid ' + (isCur ? accent : '#dde4ea'), borderRadius: 8, overflow: 'hidden', background: isCur ? '#fff' : '#f6f8fa', boxShadow: isCur ? `0 0 0 2px ${accent}33` : 'none' }}>
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
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8290a0', marginBottom: 8 }}>令和{era}年 {month}月　<span style={{ fontWeight: 500 }}>日付ごとの仕訳件数</span><span style={{ fontWeight: 500, marginLeft: 8 }}>（検査対象月：{month}月　仕訳 {monthVouchers.length} 件）</span></div>
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

      {/* 伝票表示：検査対象月の仕訳一覧 */}
      <Modal open={voucherOpen} onClose={() => setVoucherOpen(false)} width={980} title={`伝票表示 ― 令和${era}年 ${month}月の仕訳（${monthVouchers.length} 件）`}>
        <div style={{ padding: '10px 18px 16px' }}>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: '62vh', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr>{['Seq', '日付', '伝票', '借方科目', '貸方科目', '摘要', '金額', '証憑／✓／付箋'].map((h, i) => <th key={h} style={{ position: 'sticky', top: 0, padding: '7px 10px', background: '#f6f8fa', textAlign: i === 6 ? 'right' : 'left', fontSize: 11.5, color: '#5b6773', borderBottom: '1px solid #e2e8ee', whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {monthVouchers.length === 0 && <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center', color: '#9aa5b1' }}>{month}月の仕訳はありません。</td></tr>}
                {monthVouchers.map((v) => (
                  <tr key={v.id} style={{ background: v.fusen ? '#fffdf5' : 'transparent' }}>
                    <td style={{ padding: '5px 10px', borderBottom: '1px solid #f1f4f6', fontVariantNumeric: 'tabular-nums' }}>{v.seq}</td>
                    <td style={{ padding: '5px 10px', borderBottom: '1px solid #f1f4f6', whiteSpace: 'nowrap' }}>{v.date}</td>
                    <td style={{ padding: '5px 10px', borderBottom: '1px solid #f1f4f6', whiteSpace: 'nowrap' }}><span style={{ fontSize: 10.5, color: '#9aa5b1', marginRight: 4 }}>{v.kind}</span>{v.no}</td>
                    <td style={{ padding: '5px 10px', borderBottom: '1px solid #f1f4f6' }}>{v.kari}</td>
                    <td style={{ padding: '5px 10px', borderBottom: '1px solid #f1f4f6' }}>{v.kashi}</td>
                    <td style={{ padding: '5px 10px', borderBottom: '1px solid #f1f4f6', color: '#48565f' }}>{v.tekiyo}{v.gyosha && <span style={{ fontSize: 10.5, color: '#9aa5b1', marginLeft: 6 }}>{v.gyosha}</span>}</td>
                    <td style={{ padding: '5px 10px', borderBottom: '1px solid #f1f4f6', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{yen(v.amount)}</td>
                    <td style={{ padding: '3px 10px', borderBottom: '1px solid #f1f4f6' }}><FlagCell v={v} compact /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 12, color: '#7a8794' }}>
            <span>合計 <b style={{ color: '#22303c', fontVariantNumeric: 'tabular-nums' }}>{yen(monthVouchers.reduce((a, v) => a + v.amount, 0))}</b> 円　証憑・チェック・付箋はクリックで切り替えられます（仕訳一覧と共有）。</span>
            <button type="button" onClick={() => { setVoucherOpen(false); onNavigate('仕訳一覧'); }} style={{ marginLeft: 'auto', padding: '8px 14px', border: '1px solid #cfd8e0', borderRadius: 8, background: '#fff', color: '#5b6773', fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}>仕訳一覧で開く</button>
            <button type="button" onClick={() => setVoucherOpen(false)} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: accent, color: '#fff', fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}>閉じる</button>
          </div>
        </div>
      </Modal>

      {/* 検査継続：翌月へ */}
      <Modal open={continueOpen} onClose={() => setContinueOpen(false)} width={440} strict>
        <div style={{ padding: '26px 28px 22px' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: '#e8f0fb', color: '#2c5f9e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>?</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>翌月の検査を続けますか？</div>
              <div style={{ fontSize: 12.5, color: '#7a8794', marginTop: 4 }}>{month === 3 ? '3月は年度末のため、続きは「決算調査」で行います。' : `${month}月の検査結果を保持したまま、${month === 12 ? 1 : month + 1}月の一致・不一致検索を開始します。`}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
            <button type="button" onClick={() => setContinueOpen(false)} style={{ padding: '9px 22px', border: '1px solid #cfd8e0', borderRadius: 8, background: '#fff', color: '#5b6773', fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}>いいえ</button>
            <button type="button" onClick={continueNext} style={{ padding: '9px 26px', background: accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}>はい</button>
          </div>
        </div>
      </Modal>
    </main>
  );
}

const BLUE_TXT = '#2c5f9e';
