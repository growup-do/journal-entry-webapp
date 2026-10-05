// 同額・不一致検索（ツールバー名：日次調査）
//   仕訳数の問合せ・決算チェックと同じく、モーダルで開く（ホームの「調査・チェック」などから）。
//   見出し・年度／区分の表示・機能ボタンは ReportShell 共通。
//   開くと「一致・不一致検索を開始しますか？」の確認 → はい で調査が走り、
//   月ごとの調査結果（未調査 → OK同額）、当月カレンダー、資金収支／貸借／事業活動の照合結果を表示する。
//   不一致が見つかると、その「日」で検査を止める（チャイルド社回答 2026/10）：
//     伝票表示＝不一致が見つかった日の伝票すべてを日記帳で開く（そこから伝票の訂正へ進める）。
//     検査継続＝日記帳で訂正して戻ったあと、不一致が見つかった日から再検査する。
//   数値はサンプル（構造確認用）。プロトタイプでは最初の検査で 8月5日 に不一致が出て、検査継続で同額になる。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { ReportShell } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { useVouchers } from '../store/journalStore';
import { DAILY_AUDIT_SAMPLE as S, displayName } from '../data';
import { setSession } from '../store/session';

const SLOTS = ['繰越残高', '期中残高', '4月仕訳', '5月仕訳', '6月仕訳', '7月仕訳', '8月仕訳', '9月仕訳', '10月仕訳', '11月仕訳', '12月仕訳', '1月仕訳', '2月仕訳', '3月仕訳', '決算月仕訳'];
type Phase = 'confirm' | 'idle' | 'running' | 'stopped' | 'done';
/** サンプルの不一致：8月仕訳の 5日で、資金収支と貸借の支払資金に差額が出る */
const STOP = { slot: SLOTS.indexOf('8月仕訳'), month: 8, day: 5, diff: 18_000 };
const RED = '#c0392b';
/** 日記帳へ移動して戻ってきたときに検査の状態を引き継ぐ（画面を離れても保持。再読み込みで初期化） */
const memory: { phase: 'stopped' | 'done' | null; fixed: boolean } = { phase: null, fixed: false };
const yen = (n: number) => n.toLocaleString('ja-JP');

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  onNavigate: (label: string) => void;
  /** モーダルで開いているとき：閉じる */
  onClose?: () => void;
}

/** 同額・不一致検索をモーダルで開く。開くたびに開始確認から始める（不一致で止まっている間は、その状態を復元） */
export function DailyAuditModal({ open, onClose, onNavigate, accent }: { open: boolean; onClose: () => void; onNavigate: (label: string) => void; accent: string }) {
  return (
    <Modal open={open} onClose={onClose} width={1180} strict>
      {open && <DailyAuditPage variant="form" accent={accent} onNavigate={onNavigate} onClose={onClose} />}
    </Modal>
  );
}

export function DailyAuditPage({ variant, accent, onNavigate, onClose }: Props) {
  // 日記帳から戻ってきたときは、不一致で止まった状態をそのまま復元する（開始確認は出さない）
  const [phase, setPhaseV] = useState<Phase>(memory.phase === 'stopped' ? 'stopped' : 'confirm');
  const [doneCount, setDoneCount] = useState(memory.phase === 'stopped' ? STOP.slot : 0);
  // カレンダーに表示する会計月（不一致が見つかった月）
  const month = STOP.month;
  const [continueOpen, setContinueOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const toast = useToast();
  const vouchers = useVouchers();
  const monthVouchers = vouchers.filter((v) => Number(v.date.split('/')[0]) === month);
  const setPhase = (p: Phase) => { setPhaseV(p); memory.phase = p === 'stopped' || p === 'done' ? p : null; };

  /** from 番目の区分から検査する。未訂正のうちは不一致の日で止まる */
  const run = (from = 0) => {
    setPhase('running');
    setDoneCount(from);
    window.clearInterval(timer.current);
    const start = Date.now();
    // 経過時間から進捗を算出（バックグラウンドタブでタイマーが間引かれても完走する）
    timer.current = window.setInterval(() => {
      const n = Math.min(SLOTS.length, from + Math.floor((Date.now() - start) / 110));
      if (!memory.fixed && n >= STOP.slot) {
        window.clearInterval(timer.current);
        setDoneCount(STOP.slot);
        setPhase('stopped');
        return;
      }
      setDoneCount(n);
      if (n >= SLOTS.length) {
        window.clearInterval(timer.current);
        setPhase('done');
      }
    }, 100);
  };
  useEffect(() => () => window.clearInterval(timer.current), []);

  // 伝票表示：不一致が見つかった日の伝票すべてを日記帳で開く（日記帳から訂正へ進み、戻って検査継続）
  const showVouchers = () => {
    setSession({ journalTarget: { month: String(STOP.month), day: STOP.day, from: '日次調査' } });
    onNavigate('仕訳一覧');
  };
  // 検査継続：不一致が見つかった日から再検査する
  const resume = () => {
    setContinueOpen(false);
    memory.fixed = true;
    run(STOP.slot);
    toast.show(`${STOP.month}月${STOP.day}日から検査を再開しました`);
  };

  const done = phase === 'done';
  const stopped = phase === 'stopped';
  const shown = done || stopped;
  const stopDay = `${STOP.month}月${STOP.day}日`;
  // 当月の仕訳件数を日ごとに集計（カレンダー用。仕訳ストアと共有）
  const counts = new Map<number, number>();
  monthVouchers.forEach((v) => { const d = Number(v.date.split('/')[1]); counts.set(d, (counts.get(d) ?? 0) + 1); });
  const calYear = month >= 4 ? 2026 : 2027; // 令和8年度
  const era = calYear - 2018;
  const first = new Date(calYear, month - 1, 1);
  const daysInMonth = new Date(calYear, month, 0).getDate();
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const panelTitle: CSSProperties = { fontSize: 11, fontWeight: 700, color: '#8290a0', padding: '10px 14px 0' };
  const cell = (label: string, value: number | null, opt?: { hi?: 'green' | 'yellow'; sub?: string }): CSSProperties & { label: string; value: number | null; hi?: 'green' | 'yellow'; sub?: string } => ({ label, value, ...opt });
  const Box = ({ label, value, hi, sub }: { label: string; value: number | null; hi?: 'green' | 'yellow'; sub?: string }) => (
    <div style={{ padding: '9px 12px', border: '1px solid #e2e8ee', borderRadius: 8, background: hi === 'green' ? '#e6f6ec' : hi === 'yellow' ? '#fff8d6' : '#fff', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: '#5b6773', fontWeight: 600 }}>{label}</div>
      <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums', color: value != null && value < 0 ? '#c0392b' : '#22303c' }}>{value == null ? '—' : yen(value)}</div>
      {sub && <div style={{ textAlign: 'right', fontSize: 11, color: BLUE_TXT, fontVariantNumeric: 'tabular-nums' }}>{sub}</div>}
    </div>
  );
  const Same = ({ ng }: { ng?: boolean }) => (
    <div style={{ textAlign: 'center', margin: '4px 0' }}>
      {ng ? (
        <span style={{ display: 'inline-block', padding: '2px 12px', borderRadius: 10, background: '#fdecea', border: '1px solid #f1b9b2', color: RED, fontSize: 11.5, fontWeight: 700 }}>不一致　差額 {yen(STOP.diff)}</span>
      ) : (
        <span style={{ display: 'inline-block', padding: '2px 12px', borderRadius: 10, background: shown ? '#fff1b8' : '#f1f4f6', color: shown ? '#8a6d00' : '#b3bcc5', fontSize: 11.5, fontWeight: 700, letterSpacing: '.2em' }}>同額</span>
      )}
    </div>
  );
  const v = (n: number) => (shown ? n : 0);
  const miniBtn: CSSProperties = { padding: '4px 12px', borderRadius: 8, border: '1px solid ' + RED, background: '#fff', color: RED, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' };
  const onlyStopped = `不一致が見つかったときに使います`;

  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title={displayName('日次調査')}
      subtitle="仕訳と残高の同額・不一致を月ごとに検索し、資金収支・貸借・事業活動の整合を確認します。合算区分の内訳確認にも使います。"
      tools={[
        { label: '再計算', onClick: () => run(0), primary: true, title: '最初から検査し直します' },
        { label: '伝票表示', onClick: showVouchers, disabled: !stopped, title: stopped ? `${stopDay}の伝票を日記帳で開きます` : onlyStopped },
        { label: '検査継続', onClick: () => setContinueOpen(true), disabled: !stopped, title: stopped ? `${stopDay}から再検査します` : onlyStopped },
        ...(onClose ? [{ label: '閉じる', onClick: onClose }] : []),
      ]}
      embedded={!!onClose}
      notice={stopped ? (
        <>
          <b style={{ color: RED }}>{stopDay}の仕訳で不一致が見つかり、検査を止めています。</b>
          <span>「伝票表示」でこの日の伝票を日記帳で開いて訂正し、戻ってから「検査継続」で{stopDay}以降を再検査します。</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button type="button" onClick={showVouchers} style={{ ...miniBtn, background: RED, color: '#fff' }}>伝票表示（{stopDay}の伝票）</button>
            <button type="button" onClick={() => setContinueOpen(true)} style={miniBtn}>検査継続</button>
          </span>
        </>
      ) : undefined}
      period={
        <>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#8290a0' }}>集計期間</span>
          <span style={{ fontSize: 12.5, color: '#48565f' }}>令和8年度　繰越残高 〜 決算月仕訳{stopped ? `（${stopDay}で停止中）` : ''}</span>
        </>
      }
      periodAside={<span style={{ fontSize: 12.5, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: stopped ? '#fdecea' : done ? '#fff1b8' : '#f1f4f6', color: stopped ? RED : done ? '#8a6d00' : '#8290a0' }}>{phase === 'running' ? '調査中…' : stopped ? `${stopDay}で不一致` : done ? 'すべて同額（OK）' : '未調査'}</span>}
    >
      <ToastView msg={toast.msg} />

      <Modal open={phase === 'confirm'} onClose={() => { setPhase('idle'); onClose?.(); }} width={440} strict>
        <div style={{ padding: '26px 28px 22px' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: '#e8f0fb', color: '#2c5f9e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>?</span>
            <div style={{ fontSize: 15, fontWeight: 700 }}>一致・不一致検索を開始しますか？</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
            <button type="button" onClick={() => { setPhase('idle'); onClose?.(); }} style={{ padding: '9px 22px', border: '1px solid #cfd8e0', borderRadius: 8, background: '#fff', color: '#5b6773', fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}>いいえ</button>
            <button type="button" onClick={() => run(0)} style={{ padding: '9px 26px', background: accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}>はい</button>
          </div>
        </div>
      </Modal>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) 360px', gap: 20, padding: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            {/* 月別の調査結果 */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8290a0', marginBottom: 8 }}>調査結果（月別）</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0,1fr))', gap: 6 }}>
                {SLOTS.map((s, i) => {
                  const st = phase === 'running' ? (i < doneCount ? 'ok' : i === doneCount ? 'busy' : 'wait') : stopped ? (i < STOP.slot ? 'ok' : i === STOP.slot ? 'ng' : 'wait') : done ? 'ok' : 'wait';
                  const isCur = s === `${month}月仕訳`;
                  return (
                    <div key={s} style={{ border: '1px solid ' + (isCur ? accent : '#dde4ea'), borderRadius: 8, overflow: 'hidden', background: isCur ? '#fff' : '#f6f8fa', boxShadow: isCur ? `0 0 0 2px ${accent}33` : 'none' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#5b6773', textAlign: 'center', padding: '5px 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s}</div>
                      <div style={{ margin: 4, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800, letterSpacing: '.02em', background: st === 'ok' ? '#f5a623' : st === 'ng' ? RED : st === 'busy' ? '#22303c' : '#2c5f9e', color: '#fff', transition: 'background .2s' }}>
                        {st === 'ok' ? 'OK 同額' : st === 'ng' ? `× 不一致` : st === 'busy' ? '調査中…' : '？ 未調査'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* カレンダー */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8290a0', marginBottom: 8 }}>令和{era}年 {month}月　<span style={{ fontWeight: 500 }}>日付ごとの仕訳件数</span><span style={{ fontWeight: 500, marginLeft: 8 }}>（仕訳 {monthVouchers.length} 件）</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 4 }}>
                {['日', '月', '火', '水', '木', '金', '土'].map((w, i) => (
                  <div key={w} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: i === 0 ? '#c0392b' : i === 6 ? '#2c5f9e' : '#8290a0', padding: '4px 0' }}>{w}</div>
                ))}
                {cells.map((d, i) => {
                  const n = d ? counts.get(d) ?? 0 : 0;
                  const ng = stopped && d === STOP.day;
                  if (ng) return (
                    <button key={i} type="button" onClick={showVouchers} title={`${stopDay}の伝票を日記帳で開く`} style={{ height: 52, border: '2px solid ' + RED, borderRadius: 6, background: '#fdecea', padding: '3px 5px', fontSize: 11, color: RED, fontWeight: 700, position: 'relative', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', display: 'block', width: '100%' }}>
                      {d}<span style={{ marginLeft: 6, padding: '0 6px', borderRadius: 6, background: RED, color: '#fff', fontSize: 10 }}>不一致</span>
                      <span style={{ position: 'absolute', right: 5, bottom: 3, fontSize: 10.5 }}>{n}件</span>
                    </button>
                  );
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
                <Box {...cell('当期末支払資金', v(S.tokiShiharai - (stopped ? STOP.diff : 0)), { hi: 'green' })} />
                <Box {...cell('資金収入', v(S.shunyu - (stopped ? STOP.diff : 0)))} />
              </div>
            </div>
            <Same ng={stopped} />
            <div style={{ border: '1px solid #dde4ea', borderRadius: 10, paddingBottom: 10 }}>
              <div style={panelTitle}>貸借　<span style={{ color: BLUE_TXT, fontWeight: 500 }}>青字は流動負債中の引当金の額</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '8px 12px 0' }}>
                <Box {...cell('流動資産', v(S.ryudoShisan))} />
                <Box {...cell('流動負債', v(S.ryudoFusai), { sub: shown ? yen(S.hikiate) : undefined })} />
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

      {/* 検査継続：不一致が見つかった日から再検査 */}
      <Modal open={continueOpen} onClose={() => setContinueOpen(false)} width={460} strict>
        <div style={{ padding: '26px 28px 22px' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: '#e8f0fb', color: '#2c5f9e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>?</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{stopDay}から検査を続けますか？</div>
              <div style={{ fontSize: 12.5, color: '#7a8794', marginTop: 4 }}>{stopDay}以降の仕訳をもう一度検査します。伝票の訂正がまだのときは、先に「伝票表示」から訂正してください。</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
            <button type="button" onClick={() => setContinueOpen(false)} style={{ padding: '9px 22px', border: '1px solid #cfd8e0', borderRadius: 8, background: '#fff', color: '#5b6773', fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}>いいえ</button>
            <button type="button" onClick={resume} style={{ padding: '9px 26px', background: accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}>はい</button>
          </div>
        </div>
      </Modal>
    </ReportShell>
  );
}

const BLUE_TXT = '#2c5f9e';
