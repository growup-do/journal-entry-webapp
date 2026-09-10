// 決算調査（既存「決算チェック」モーダルの再現）＋ 設定・結果詳細・結果印刷（提案K）
//   28項目を一覧し「調査開始」で順に調査 → 各項目に結果（OK／要確認／スキップ）を表示。
//   「説明」で項目ごとの解説ページ（既存の見開き表示に相当）。設定で項目のON/OFFと項目ごとの勘定科目選択。
//   結果詳細表示＝トレース情報（コピー可）、結果印刷＝プレビュー。既存の「連絡先表示」はサポートサイトへ。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { PreviewModal } from './PrintCenter';
import { Notice, btn as uiBtn } from './ui';
import { AUDIT_EXPLANATIONS, AUDIT_ITEMS } from '../data';
import { ACCOUNT_META } from '../lib/accounts';
import { setSession, useSession } from '../store/session';

type Status = '未調査' | '調査中' | 'OK' | '要確認' | 'スキップ';
/** サンプルとして「要確認」になる項目（構造確認用） */
const NEEDS_CHECK = new Set([3, 14, 20]);
/** オプション連動（減価償却 15〜17／小口現金 28）。プロトタイプでは有効扱い */
const OPTION_ITEMS = new Set([15, 16, 17, 28]);

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettlementAuditModal({ open, onClose }: Props) {
  const s = useSession();
  const [status, setStatus] = useState<Record<number, Status>>({});
  const [running, setRunning] = useState(false);
  const [explain, setExplain] = useState<number | null>(null);
  const [settings, setSettings] = useState(false);
  const [corpTab, setCorpTab] = useState<'区分' | '法人'>('区分');
  const [itemCfg, setItemCfg] = useState<number | null>(null);
  const [trace, setTrace] = useState(false);
  const [print, setPrint] = useState(false);
  const [done, setDone] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const toast = useToast();
  const enabled = (no: number) => s.auditEnabled[no] !== false;

  useEffect(() => () => window.clearInterval(timer.current), []);

  const start = () => {
    if (running) return;
    setRunning(true); setDone(false);
    setStatus({});
    const t0 = Date.now();
    window.clearInterval(timer.current);
    // 経過時間から進捗を算出（バックグラウンドタブでタイマーが間引かれても完走する）
    timer.current = window.setInterval(() => {
      const n = Math.min(AUDIT_ITEMS.length, Math.floor((Date.now() - t0) / 90));
      const next: Record<number, Status> = {};
      AUDIT_ITEMS.slice(0, n).forEach((it) => {
        next[it.no] = !enabled(it.no) ? 'スキップ' : NEEDS_CHECK.has(it.no) ? '要確認' : 'OK';
      });
      if (n < AUDIT_ITEMS.length) next[AUDIT_ITEMS[n].no] = '調査中';
      setStatus(next);
      if (n >= AUDIT_ITEMS.length) {
        window.clearInterval(timer.current);
        setRunning(false); setDone(true);
      }
    }, 100);
  };

  const badge = (st: Status | undefined): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 54, height: 22, borderRadius: 6, fontSize: 11, fontWeight: 700, flex: 'none',
    background: st === 'OK' ? '#eaf5ef' : st === '要確認' ? '#fdeee9' : st === '調査中' ? '#fff1b8' : st === 'スキップ' ? '#eef2f6' : '#f1f4f6',
    color: st === 'OK' ? '#1f7a52' : st === '要確認' ? '#c0392b' : st === '調査中' ? '#8a6d00' : st === 'スキップ' ? '#9aa5b1' : '#8290a0',
  });
  const btn = (primary?: boolean): CSSProperties => ({ padding: '10px 22px', borderRadius: 9, border: primary ? 'none' : '1px solid #cfd8e0', background: primary ? '#1f7a52' : '#fff', color: primary ? '#fff' : '#5b6773', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const okCount = Object.values(status).filter((x) => x === 'OK').length;
  const ngCount = Object.values(status).filter((x) => x === '要確認').length;
  const skipCount = Object.values(status).filter((x) => x === 'スキップ').length;

  const Item = ({ no, name }: { no: number; name: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f4f6', opacity: enabled(no) ? 1 : 0.55 }}>
      <span style={{ width: 26, fontSize: 13, fontWeight: 800, color: '#22303c', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{String(no).padStart(2, '0')}</span>
      <span style={badge(status[no])}>{status[no] ?? (enabled(no) ? '未調査' : 'スキップ')}</span>
      <span style={{ flex: 1, fontSize: 13, color: '#22303c', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}{OPTION_ITEMS.has(no) && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 700, color: '#b45309', background: '#fbe9d0', padding: '1px 5px', borderRadius: 4 }}>OP</span>}</span>
      <button type="button" className="btn-outline" onClick={() => setExplain(no)} style={{ flex: 'none', padding: '3px 9px', borderRadius: 6, border: '1px solid #f2c9c2', background: '#fff', color: '#c0392b', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
        説明
      </button>
    </div>
  );

  useEffect(() => {
    if (!open || explain == null) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setExplain(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, explain]);
  const ex = explain != null ? AUDIT_EXPLANATIONS[explain] : undefined;
  const exItem = explain != null ? AUDIT_ITEMS.find((a) => a.no === explain) : undefined;

  const traceText = AUDIT_ITEMS.map((it) => {
    const st = status[it.no] ?? '未調査';
    const detail = st === '要確認' ? (it.no === 3 ? '資金収支計算書(11) 当期資金収支差額合計 △1,100,000 ≠ 貸借対照表の支払資金残高の増減 △1,150,000（差額 50,000）' : it.no === 14 ? '10万円以上の費用 3 件：Seq16 委託費収益 2,732,430／Seq17 職員俸給 1,502,512／Seq2 法定福利費 670,361 → 固定資産計上の要否を確認' : '前年度決算額と当年度繰越額：次期繰越活動増減差額 12,662,300 ≠ 12,677,100（差額 14,800）') : st === 'OK' ? '条件式：一致' : st === 'スキップ' ? '設定で無効' : '';
    return `[${String(it.no).padStart(2, '0')}] ${st.padEnd(4, '　')} ${it.name}${detail ? '\n      ' + detail : ''}`;
  }).join('\n');

  return (
    <>
    {/* 説明を表示している間はモーダルを閉じられない（「一覧に戻る」のみ）。Esc も一覧に戻る扱い */}
    <Modal open={open} onClose={onClose} closable={explain == null} width={1000} title={<>決算調査 <span style={{ fontSize: 12, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>{s.fiscalYear}　4月1日 〜 3月31日　{corpTab === '法人' ? '法人全体' : s.division}</span></>}>
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
                  {running ? '調査中…' : done ? <>結果：<b style={{ color: '#1f7a52' }}>OK {okCount}</b>　<b style={{ color: '#c0392b' }}>要確認 {ngCount}</b>{skipCount > 0 && <>　<span style={{ color: '#9aa5b1' }}>スキップ {skipCount}</span></>}</> : '「調査開始」で全項目を調査します（設定で無効にした項目はスキップ）'}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-outline" onClick={() => setSettings(true)} style={btn()}>設定</button>
                  <button type="button" className="btn-outline" onClick={() => window.open('https://www.child.co.jp/', '_blank', 'noopener')} style={btn()}>サポートサイト</button>
                  <button type="button" className="btn-outline" disabled={!done} onClick={() => setPrint(true)} style={{ ...btn(), opacity: done ? 1 : 0.5 }}>結果印刷</button>
                  <button type="button" className="btn-outline" disabled={!done} onClick={() => setTrace(true)} style={{ ...btn(), opacity: done ? 1 : 0.5 }}>結果詳細表示</button>
                  {done ? <button type="button" className="submit-btn" onClick={onClose} style={btn(true)}>調査終了</button> : <button type="button" className="submit-btn" onClick={start} disabled={running} style={{ ...btn(true), opacity: running ? 0.6 : 1 }}>調査開始</button>}
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
            {status[explain] === '要確認' && <div style={{ marginTop: 16 }}><Notice tone="warn">この項目は「要確認」です。結果詳細表示（トレース情報）で対象の金額・伝票を確認してください。</Notice></div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button type="button" className="btn-outline" onClick={() => setExplain(null)} style={btn()}>一覧に戻る</button>
          </div>
        </div>
      )}
    </Modal>

    {/* 決算チェック設定 */}
    <Modal open={settings} onClose={() => setSettings(false)} width={760} title="決算チェックシステム - 設定">
      <div style={{ padding: '12px 22px 18px' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>{(['区分', '法人'] as const).map((t) => <button key={t} type="button" onClick={() => setCorpTab(t)} style={uiBtn(corpTab === t ? '#1f7a52' : '#5b6773', corpTab === t, true)}>{t === '区分' ? '決算チェック設定（表示中の区分）' : '法人決算チェック設定（法人全体）'}</button>)}</div>
        <div style={{ fontSize: 12, color: '#7a8794', marginBottom: 8 }}>チェックする項目を有効／無効に切り替え、項目名をクリックすると診断用条件式を構成する勘定科目を選択できます。</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', maxHeight: 400, overflow: 'auto' }}>
          {AUDIT_ITEMS.map((it) => (
            <div key={it.no} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #f1f4f6' }}>
              <span style={{ width: 24, fontSize: 12.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{String(it.no).padStart(2, '0')}</span>
              <input type="checkbox" checked={enabled(it.no)} onChange={(e) => setSession({ auditEnabled: { ...s.auditEnabled, [it.no]: e.target.checked } })} />
              <button type="button" onClick={() => setItemCfg(it.no)} style={{ flex: 1, textAlign: 'left', border: '1px solid #e2e8ee', background: '#fff', borderRadius: 7, padding: '5px 10px', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', color: enabled(it.no) ? '#22303c' : '#9aa5b1' }}>{it.name}</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}><button type="button" onClick={() => setSettings(false)} style={uiBtn()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => { setSettings(false); toast.show('決算チェック設定を保存しました'); }} style={uiBtn('#1f7a52', true)}>OK</button></div>
      </div>
    </Modal>

    {/* 項目ごとの勘定科目選択 */}
    <Modal open={itemCfg != null} onClose={() => setItemCfg(null)} width={620} title={`決算チェックシステム - 設定 - ${itemCfg != null ? String(itemCfg).padStart(2, '0') + '. ' + (AUDIT_ITEMS.find((a) => a.no === itemCfg)?.name ?? '') : ''}`}>
      <div style={{ padding: '12px 22px 18px' }}>
        <div style={{ fontSize: 12.5, color: '#5b6773', marginBottom: 8 }}>診断用条件式の各要素を構成する勘定科目を、チェックにより有効／無効に切り替えます。</div>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: 320, overflow: 'auto' }}>
          {ACCOUNT_META.map((m, i) => <label key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid #f1f4f6', fontSize: 12.5 }}><input type="checkbox" defaultChecked={m.kind === 'BS' || i % 3 === 0} /><span style={{ width: 120, color: '#8290a0', fontVariantNumeric: 'tabular-nums' }}>{m.code.slice(0, 3)}-{m.code.slice(3)}-00-00-00</span><span>{m.name}</span></label>)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}><button type="button" onClick={() => setItemCfg(null)} style={uiBtn()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => setItemCfg(null)} style={uiBtn('#1f7a52', true)}>OK</button></div>
      </div>
    </Modal>

    {/* 結果詳細（トレース情報） */}
    <Modal open={trace} onClose={() => setTrace(false)} width={760} title="決算チェックトレース情報">
      <div style={{ padding: '12px 22px 18px' }}>
        <pre style={{ margin: 0, padding: 14, background: '#1e2630', color: '#d7dee6', borderRadius: 10, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 420, overflow: 'auto', fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace" }}>{traceText}</pre>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button type="button" onClick={() => navigator.clipboard?.writeText(traceText).then(() => toast.show('テキストとしてコピーしました（メモ帳やExcelに貼り付けできます）')).catch(() => toast.show('コピーできませんでした'))} style={uiBtn()}>コピー</button>
          <button type="button" onClick={() => setTrace(false)} style={uiBtn('#1f7a52', true)}>閉じる</button>
        </div>
      </div>
    </Modal>

    {/* 結果印刷 */}
    <PreviewModal open={print} onClose={() => setPrint(false)} title="決算チェック結果" opts={{ from: `${s.fiscalYear} 4月1日`, to: '3月31日', output: '画面へプレビューする' }} pages={1} accent="#1f7a52">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead><tr>{['No', '項目', '結果', '内容'].map((h) => <th key={h} style={{ border: '1px solid #9aa5b1', padding: 3, textAlign: 'left', background: '#eef2f6' }}>{h}</th>)}</tr></thead>
        <tbody>{AUDIT_ITEMS.map((it) => <tr key={it.no}><td style={{ border: '1px solid #c3ccd4', padding: 3 }}>{String(it.no).padStart(2, '0')}</td><td style={{ border: '1px solid #c3ccd4', padding: 3 }}>{it.name}</td><td style={{ border: '1px solid #c3ccd4', padding: 3, fontWeight: 700, color: status[it.no] === '要確認' ? '#c0392b' : '#22303c' }}>{status[it.no] ?? '未調査'}</td><td style={{ border: '1px solid #c3ccd4', padding: 3, color: '#5b6773' }}>{status[it.no] === '要確認' ? '要確認（トレース情報参照）' : status[it.no] === 'OK' ? '一致' : ''}</td></tr>)}</tbody>
      </table>
    </PreviewModal>
    </>
  );
}
