// 決算調査（既存「決算チェック」モーダルの再現）
//   28項目を一覧し「調査開始」で順に調査 → 各項目に結果（OK／要確認）を表示。
//   「説明」で項目ごとの解説ページ（既存の見開き表示に相当）を開く。
//   既存の「連絡先表示」は不要と判断し未反映（確認メモに記載）。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { NOT_IMPL, ToastView, useToast } from './Toast';
import { AUDIT_EXPLANATIONS, AUDIT_ITEMS } from '../data';

type Status = '未調査' | '調査中' | 'OK' | '要確認';
/** サンプルとして「要確認」になる項目（構造確認用） */
const NEEDS_CHECK = new Set([3, 14, 20]);

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettlementAuditModal({ open, onClose }: Props) {
  const [status, setStatus] = useState<Record<number, Status>>({});
  const [running, setRunning] = useState(false);
  const [explain, setExplain] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const toast = useToast();

  useEffect(() => () => window.clearInterval(timer.current), []);

  const start = () => {
    if (running) return;
    setRunning(true);
    setStatus({});
    const start = Date.now();
    window.clearInterval(timer.current);
    // 経過時間から進捗を算出（バックグラウンドタブでタイマーが間引かれても完走する）
    timer.current = window.setInterval(() => {
      const n = Math.min(AUDIT_ITEMS.length, Math.floor((Date.now() - start) / 90));
      const next: Record<number, Status> = {};
      AUDIT_ITEMS.slice(0, n).forEach((it) => {
        next[it.no] = NEEDS_CHECK.has(it.no) ? '要確認' : 'OK';
      });
      setStatus(next);
      if (n >= AUDIT_ITEMS.length) {
        window.clearInterval(timer.current);
        setRunning(false);
      }
    }, 100);
  };

  const badge = (st: Status | undefined): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
    height: 22,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    flex: 'none',
    background: st === 'OK' ? '#eaf5ef' : st === '要確認' ? '#fdeee9' : '#f1f4f6',
    color: st === 'OK' ? '#1f7a52' : st === '要確認' ? '#c0392b' : '#8290a0',
  });
  const btn = (primary?: boolean): CSSProperties => ({
    padding: '10px 22px',
    borderRadius: 9,
    border: primary ? 'none' : '1px solid #cfd8e0',
    background: primary ? '#1f7a52' : '#fff',
    color: primary ? '#fff' : '#5b6773',
    fontSize: 13.5,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  });
  const okCount = Object.values(status).filter((s) => s === 'OK').length;
  const ngCount = Object.values(status).filter((s) => s === '要確認').length;

  const Item = ({ no, name }: { no: number; name: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f4f6' }}>
      <span style={{ width: 26, fontSize: 13, fontWeight: 800, color: '#22303c', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{String(no).padStart(2, '0')}</span>
      <span style={badge(status[no])}>{status[no] ?? '未調査'}</span>
      <span style={{ flex: 1, fontSize: 13, color: '#22303c', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <button type="button" className="btn-outline" onClick={() => setExplain(no)} style={{ flex: 'none', padding: '3px 9px', borderRadius: 6, border: '1px solid #f2c9c2', background: '#fff', color: '#c0392b', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
        説明
      </button>
    </div>
  );

  useEffect(() => {
    if (!open || explain == null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExplain(null);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, explain]);
  const ex = explain != null ? AUDIT_EXPLANATIONS[explain] : undefined;
  const exItem = explain != null ? AUDIT_ITEMS.find((a) => a.no === explain) : undefined;

  return (
    // 説明を表示している間はモーダルを閉じられない（「一覧に戻る」のみ）。Esc も一覧に戻る扱い
    <Modal open={open} onClose={onClose} closable={explain == null} width={1000} title={<>決算調査 <span style={{ fontSize: 12, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>令和8年 4月1日 〜 令和9年 3月31日　社会福祉事業</span></>}>
      <ToastView msg={toast.msg} />
      {explain == null ? (
        <div style={{ padding: '14px 22px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
            <div>{AUDIT_ITEMS.filter((a) => a.no <= 20).map((a) => <Item key={a.no} {...a} />)}</div>
            <div>
              {AUDIT_ITEMS.filter((a) => a.no > 20).map((a) => <Item key={a.no} {...a} />)}
              {[29, 30].map((n) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f4f6', opacity: 0.45 }}>
                  <span style={{ width: 26, fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                  <span style={{ fontSize: 12, color: '#9aa5b1' }}>（予備）</span>
                </div>
              ))}
              <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                <div style={{ fontSize: 12, color: '#7a8794', minHeight: 18 }}>
                  {running ? '調査中…' : okCount + ngCount > 0 ? <>結果：<b style={{ color: '#1f7a52' }}>OK {okCount}</b>　<b style={{ color: '#c0392b' }}>要確認 {ngCount}</b></> : '「調査開始」で全項目を調査します'}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-outline" onClick={() => toast.show(NOT_IMPL)} style={btn()}>結果印刷</button>
                  <button type="button" className="btn-outline" onClick={() => toast.show(NOT_IMPL)} style={btn()}>結果詳細表示</button>
                  <button type="button" className="submit-btn" onClick={start} disabled={running} style={{ ...btn(true), opacity: running ? 0.6 : 1 }}>調査開始</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 説明（既存の見開きページに相当） */
        <div style={{ padding: '18px 26px 24px' }}>
          <div style={{ background: '#fbfaf5', border: '1px solid #e8e2cf', borderRadius: 12, padding: '26px 32px 30px' }}>
            <div style={{ textAlign: 'center', fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 19, color: '#1f5a3a', letterSpacing: '.06em', marginBottom: 22 }}>
              {String(explain).padStart(2, '0')}. {exItem?.name}
            </div>
            {ex ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, marginBottom: 22 }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#1f5a3a', marginBottom: 3 }}>BS</div>
                    <div style={{ border: '1.5px solid #4c6b57', borderRadius: 10, padding: '14px 18px', fontSize: 13, textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.6, background: '#fff' }}>{ex.left}</div>
                  </div>
                  <div style={{ fontSize: 26, color: '#c0392b', fontWeight: 700 }}>＝</div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#1f5a3a', marginBottom: 3 }}>PL</div>
                    <div style={{ border: '1.5px solid #4c6b57', borderRadius: 10, padding: '14px 18px', fontSize: 13, textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.6, background: '#fff' }}>{ex.right}</div>
                  </div>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.9, color: '#22303c', margin: 0, textIndent: '1em' }}>{ex.text}</p>
              </>
            ) : (
              <p style={{ fontSize: 13.5, lineHeight: 1.9, color: '#7a8794', margin: 0, textAlign: 'center' }}>
                この項目の説明文は、既存システムの画面をご提供いただき次第転記します。
                <br />
                （現在は「04. 次期繰越活動増減差額」のみ転記済み）
              </p>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button type="button" className="btn-outline" onClick={() => setExplain(null)} style={btn()}>一覧に戻る</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
