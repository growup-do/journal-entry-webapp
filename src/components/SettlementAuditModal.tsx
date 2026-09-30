// 決算チェック（決算調査）＋ 決算チェック設定・結果詳細・結果印刷（依頼書 5.4.5／5.5.6）
//   28項目を一覧し「調査開始」で順に調査 → 各項目の状態（未調査／調査中／OK／要調査／スキップ）をアイコン＋色で表示。
//   上部に状態ごとの件数（凡例を兼ねる）と「要調査のみ」の絞り込み。要調査の行からは「説明」「結果詳細」に1クリックで到達。
//   見出しの「決算チェック設定」から、項目のON/OFFと項目ごとの勘定科目選択を開く。
//   「説明」は項目ごとの解説ページ（表示中は「一覧に戻る」のみ）。結果詳細＝トレース情報（コピー可）、結果印刷＝プレビュー。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { PreviewModal } from './PrintCenter';
import { Notice, btn as uiBtn } from './ui';
import { AUDIT_EXPLANATIONS, AUDIT_ITEMS, displayName } from '../data';
import { ACCOUNT_META } from '../lib/accounts';
import { setSession, useSession } from '../store/session';

type Status = '未調査' | '調査中' | 'OK' | '要調査' | 'スキップ';
const STATES: Status[] = ['未調査', '調査中', 'OK', '要調査', 'スキップ'];
/** 状態ごとのアイコン・配色（一覧・凡例・印刷で共通） */
const STATE_STYLE: Record<Status, { icon: string; bg: string; fg: string; bd: string }> = {
  未調査: { icon: '？', bg: '#eef2f6', fg: '#5b6773', bd: '#d3dbe3' },
  調査中: { icon: '…', bg: '#fff1b8', fg: '#8a6d00', bd: '#ecd98a' },
  OK: { icon: '✓', bg: '#eaf5ef', fg: '#1f7a52', bd: '#bfe0cf' },
  要調査: { icon: '！', bg: '#c0392b', fg: '#ffffff', bd: '#c0392b' },
  スキップ: { icon: '－', bg: '#ffffff', fg: '#9aa5b1', bd: '#dde4ea' },
};
/** サンプルとして「要調査」になる項目（構造確認用） */
const NEEDS_CHECK = new Set([3, 14, 20]);
/** オプション連動（減価償却 15〜17／小口現金 28）。プロトタイプでは有効扱い */
const OPTION_ITEMS = new Set([15, 16, 17, 28]);

interface Props {
  open: boolean;
  onClose: () => void;
  /** 各種設定の「決算チェック設定」画面へ移動する（渡されたときだけ、設定ダイアログ内にリンクを表示） */
  onNavigate?: (page: string) => void;
}

export function SettlementAuditModal({ open, onClose, onNavigate }: Props) {
  const s = useSession();
  const [status, setStatus] = useState<Record<number, Status>>({});
  const [running, setRunning] = useState(false);
  const [explain, setExplain] = useState<number | null>(null);
  const [settings, setSettings] = useState(false);
  const [corpTab, setCorpTab] = useState<'区分' | '法人'>('区分');
  const [itemCfg, setItemCfg] = useState<number | null>(null);
  /** 結果詳細（トレース情報）：'all'＝全項目／番号＝その項目のみ */
  const [trace, setTrace] = useState<number | 'all' | null>(null);
  const [onlyNg, setOnlyNg] = useState(false);
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
        next[it.no] = !enabled(it.no) ? 'スキップ' : NEEDS_CHECK.has(it.no) ? '要調査' : 'OK';
      });
      if (n < AUDIT_ITEMS.length) next[AUDIT_ITEMS[n].no] = '調査中';
      setStatus(next);
      if (n >= AUDIT_ITEMS.length) {
        window.clearInterval(timer.current);
        setRunning(false); setDone(true);
      }
    }, 100);
  };

  /** 項目の現在の状態（設定で無効の項目は、調査前でもスキップ扱い） */
  const stateOf = (no: number): Status => status[no] ?? (enabled(no) ? '未調査' : 'スキップ');
  const badge = (st: Status): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center', minWidth: 72, height: 22, padding: '0 6px', borderRadius: 6, fontSize: 11, fontWeight: 700, flex: 'none', boxSizing: 'border-box',
    background: STATE_STYLE[st].bg, color: STATE_STYLE[st].fg, border: '1px solid ' + STATE_STYLE[st].bd,
  });
  const StateBadge = ({ st }: { st: Status }) => <span data-state={st} style={badge(st)}><span aria-hidden style={{ fontWeight: 800 }}>{STATE_STYLE[st].icon}</span>{st}</span>;
  const btn = (primary?: boolean): CSSProperties => ({ padding: '10px 22px', borderRadius: 9, border: primary ? 'none' : '1px solid #cfd8e0', background: primary ? '#1f7a52' : '#fff', color: primary ? '#fff' : '#5b6773', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const counts = STATES.reduce<Record<Status, number>>((acc, st) => ({ ...acc, [st]: AUDIT_ITEMS.filter((it) => stateOf(it.no) === st).length }), { 未調査: 0, 調査中: 0, OK: 0, 要調査: 0, スキップ: 0 });
  const shown = AUDIT_ITEMS.filter((it) => !onlyNg || stateOf(it.no) === '要調査');
  const half = onlyNg ? shown.length : 20;
  const rowBtn = (color: string, solid?: boolean): CSSProperties => ({ flex: 'none', padding: '3px 9px', borderRadius: 6, border: '1px solid ' + color, background: solid ? color : '#fff', color: solid ? '#fff' : color, fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' });

  const Item = ({ no, name }: { no: number; name: string }) => {
    const st = stateOf(no);
    const ng = st === '要調査';
    return (
      <div data-audit-item={no} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderBottom: '1px solid #f1f4f6', background: ng ? '#fdf3f1' : 'transparent', borderLeft: '3px solid ' + (ng ? '#c0392b' : 'transparent'), opacity: st === 'スキップ' ? 0.6 : 1 }}>
        <span style={{ width: 26, fontSize: 13, fontWeight: 800, color: '#22303c', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{String(no).padStart(2, '0')}</span>
        <StateBadge st={st} />
        <span title={name} style={{ flex: 1, fontSize: 13, color: '#22303c', fontWeight: ng ? 700 : 400, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}{OPTION_ITEMS.has(no) && <span title="別売オプションと連動する項目" style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 700, color: '#b45309', background: '#fbe9d0', padding: '1px 5px', borderRadius: 4 }}>オプション</span>}</span>
        {ng && <button type="button" className="btn-outline" data-action="結果詳細" onClick={() => setTrace(no)} style={rowBtn('#c0392b', true)}>結果詳細</button>}
        <button type="button" className="btn-outline" data-action="説明" onClick={() => setExplain(no)} style={rowBtn(ng ? '#c0392b' : '#8290a0')}>説明</button>
      </div>
    );
  };

  useEffect(() => {
    if (!open || explain == null) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setExplain(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, explain]);
  const ex = explain != null ? AUDIT_EXPLANATIONS[explain] : undefined;
  const exItem = explain != null ? AUDIT_ITEMS.find((a) => a.no === explain) : undefined;

  const detailOf = (no: number, st: Status) => (st === '要調査' ? (no === 3 ? '資金収支計算書(11) 当期資金収支差額合計 △1,100,000 ≠ 貸借対照表の支払資金残高の増減 △1,150,000（差額 50,000）' : no === 14 ? '10万円以上の費用 3 件：Seq16 委託費収益 2,732,430／Seq17 職員俸給 1,502,512／Seq2 法定福利費 670,361 → 固定資産計上の要否を確認' : '前年度決算額と当年度繰越額：次期繰越活動増減差額 12,662,300 ≠ 12,677,100（差額 14,800）') : st === 'OK' ? '条件式：一致' : st === 'スキップ' ? '設定で無効' : '');
  const traceItems = AUDIT_ITEMS.filter((it) => trace === 'all' || it.no === trace);
  const traceText = traceItems.map((it) => {
    const st = stateOf(it.no);
    const detail = detailOf(it.no, st);
    return `[${String(it.no).padStart(2, '0')}] ${st.padEnd(4, '　')} ${it.name}${detail ? '\n      ' + detail : ''}`;
  }).join('\n');
  const traceItem = typeof trace === 'number' ? AUDIT_ITEMS.find((a) => a.no === trace) : undefined;

  return (
    <>
    {/* 説明を表示している間はモーダルを閉じられない（「一覧に戻る」のみ）。Esc も一覧に戻る扱い */}
    <Modal
      open={open}
      onClose={onClose}
      closable={explain == null}
      width={1040}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>{displayName('決算調査')}</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#7a8794' }}>{s.fiscalYear}　4月1日 〜 3月31日　{corpTab === '法人' ? '法人全体' : s.division}</span>
          {explain == null && (
            <button type="button" className="btn-outline" data-action="決算チェック設定" onClick={() => setSettings(true)} title="チェックする項目と、項目ごとの条件（勘定科目）を設定します" style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, border: '1px solid #1f7a52', background: '#fff', color: '#1f7a52', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              決算チェック設定
            </button>
          )}
        </span>
      }
    >
      <ToastView msg={toast.msg} />
      {explain == null ? (
        <div style={{ padding: '12px 22px 20px' }}>
          {/* 状態ごとの件数（凡例を兼ねる）＋ 要調査のみ */}
          <div data-audit-summary style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 12px', marginBottom: 10, background: '#f8fafc', border: '1px solid #e8edf2', borderRadius: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#8290a0' }}>状態</span>
            {STATES.map((st) => (
              <span key={st} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                <StateBadge st={st} />
                <b style={{ fontVariantNumeric: 'tabular-nums', color: st === '要調査' && counts[st] > 0 ? '#c0392b' : '#22303c' }}>{counts[st]}</b>
              </span>
            ))}
            <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, border: '1px solid ' + (onlyNg ? '#c0392b' : '#dde4ea'), background: onlyNg ? '#fdeee9' : '#fff', color: onlyNg ? '#c0392b' : '#5b6773', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              <input type="checkbox" checked={onlyNg} onChange={(e) => setOnlyNg(e.target.checked)} />
              要調査のみ
            </label>
          </div>
          {onlyNg && shown.length === 0 && (
            <div style={{ padding: '28px 12px', textAlign: 'center', color: '#9aa5b1', fontSize: 13 }}>{done ? '要調査の項目はありません。' : '要調査の項目はまだありません（「調査開始」で調査します）。'}</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: onlyNg ? '1fr' : '1fr 1fr', gap: '0 24px' }}>
            <div>{shown.slice(0, half).map((a) => <Item key={a.no} {...a} />)}</div>
            {!onlyNg && (
              <div>
                {shown.slice(half).map((a) => <Item key={a.no} {...a} />)}
                {[29, 30].map((n) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderBottom: '1px solid #f1f4f6', opacity: 0.45 }}>
                    <span style={{ width: 26, fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                    <span style={{ fontSize: 12, color: '#9aa5b1' }}>（予備）</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: '#7a8794', minHeight: 18 }}>
              {running ? '調査中…' : done ? (counts.要調査 > 0 ? <>要調査が <b style={{ color: '#c0392b' }}>{counts.要調査} 件</b> あります。行の「結果詳細」「説明」で内容を確認してください。</> : 'すべての項目が OK です。') : '「調査開始」で全項目を調査します（決算チェック設定で無効にした項目はスキップ）'}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-outline" onClick={() => window.open('https://www.child.co.jp/', '_blank', 'noopener')} style={btn()}>サポートサイト</button>
              <span title={done ? '' : '調査が終わると使えます'}><button type="button" className="btn-outline" disabled={!done} onClick={() => setPrint(true)} style={{ ...btn(), opacity: done ? 1 : 0.5 }}>結果印刷</button></span>
              <span title={done ? '' : '調査が終わると使えます'}><button type="button" className="btn-outline" disabled={!done} onClick={() => setTrace('all')} style={{ ...btn(), opacity: done ? 1 : 0.5 }}>結果詳細表示（全項目）</button></span>
              {done && <button type="button" className="btn-outline" onClick={start} style={btn()}>再調査</button>}
              {done ? <button type="button" className="submit-btn" onClick={onClose} style={btn(true)}>調査終了</button> : <button type="button" className="submit-btn" onClick={start} disabled={running} style={{ ...btn(true), opacity: running ? 0.6 : 1 }}>調査開始</button>}
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
            {stateOf(explain) === '要調査' && <div style={{ marginTop: 16 }}><Notice tone="warn">この項目は「要調査」です。{detailOf(explain, '要調査')}</Notice></div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            {stateOf(explain) === '要調査' && <button type="button" className="btn-outline" onClick={() => setTrace(explain)} style={btn()}>結果詳細を表示</button>}
            <button type="button" className="btn-outline" onClick={() => setExplain(null)} style={btn()}>一覧に戻る</button>
          </div>
        </div>
      )}
    </Modal>

    {/* 決算チェック設定 */}
    <Modal open={settings} onClose={() => setSettings(false)} width={760} title="決算チェック設定">
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          {onNavigate && <button type="button" data-action="設定画面で開く" onClick={() => { setSettings(false); onClose(); onNavigate('決算チェック設定'); }} title="決算調査を閉じて、各種設定の「決算チェック設定」画面へ移動します" style={uiBtn('#1f7a52')}>各種設定の「決算チェック設定」画面で開く ›</button>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}><button type="button" onClick={() => setSettings(false)} style={uiBtn()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => { setSettings(false); toast.show('決算チェック設定を保存しました'); }} style={uiBtn('#1f7a52', true)}>OK</button></div>
        </div>
      </div>
    </Modal>

    {/* 項目ごとの勘定科目選択 */}
    <Modal open={itemCfg != null} onClose={() => setItemCfg(null)} width={620} title={`決算チェック設定 - ${itemCfg != null ? String(itemCfg).padStart(2, '0') + '. ' + (AUDIT_ITEMS.find((a) => a.no === itemCfg)?.name ?? '') : ''}`}>
      <div style={{ padding: '12px 22px 18px' }}>
        <div style={{ fontSize: 12.5, color: '#5b6773', marginBottom: 8 }}>診断用条件式の各要素を構成する勘定科目を、チェックにより有効／無効に切り替えます。</div>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: 320, overflow: 'auto' }}>
          {ACCOUNT_META.map((m, i) => <label key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid #f1f4f6', fontSize: 12.5 }}><input type="checkbox" defaultChecked={m.kind === 'BS' || i % 3 === 0} /><span style={{ width: 120, color: '#8290a0', fontVariantNumeric: 'tabular-nums' }}>{m.code.slice(0, 3)}-{m.code.slice(3)}-00-00-00</span><span>{m.name}</span></label>)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}><button type="button" onClick={() => setItemCfg(null)} style={uiBtn()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => setItemCfg(null)} style={uiBtn('#1f7a52', true)}>OK</button></div>
      </div>
    </Modal>

    {/* 結果詳細（トレース情報） */}
    <Modal open={trace != null} onClose={() => setTrace(null)} width={760} title={traceItem ? `結果詳細 - ${String(traceItem.no).padStart(2, '0')}. ${traceItem.name}` : '結果詳細（決算チェックトレース情報）'}>
      <div style={{ padding: '12px 22px 18px' }}>
        {traceItem && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12.5 }}><StateBadge st={stateOf(traceItem.no)} /><span style={{ color: '#5b6773' }}>対象の金額・伝票を確認してください。</span></div>}
        <pre style={{ margin: 0, padding: 14, background: '#1e2630', color: '#d7dee6', borderRadius: 10, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 420, overflow: 'auto', fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace" }}>{traceText}</pre>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button type="button" onClick={() => navigator.clipboard?.writeText(traceText).then(() => toast.show('テキストとしてコピーしました（メモ帳やExcelに貼り付けできます）')).catch(() => toast.show('コピーできませんでした'))} style={uiBtn()}>コピー</button>
          {traceItem && <button type="button" onClick={() => { const no = traceItem.no; setTrace(null); setExplain(no); }} style={uiBtn()}>この項目の説明</button>}
          {traceItem && <button type="button" onClick={() => setTrace('all')} style={uiBtn()}>全項目を表示</button>}
          <button type="button" onClick={() => setTrace(null)} style={uiBtn('#1f7a52', true)}>閉じる</button>
        </div>
      </div>
    </Modal>

    {/* 結果印刷 */}
    <PreviewModal open={print} onClose={() => setPrint(false)} title="決算チェック結果" opts={{ from: `${s.fiscalYear} 4月1日`, to: '3月31日', output: '画面へプレビューする' }} pages={1} accent="#1f7a52">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead><tr>{['No', '項目', '結果', '内容'].map((h) => <th key={h} style={{ border: '1px solid #9aa5b1', padding: 3, textAlign: 'left', background: '#eef2f6' }}>{h}</th>)}</tr></thead>
        <tbody>{AUDIT_ITEMS.map((it) => <tr key={it.no}><td style={{ border: '1px solid #c3ccd4', padding: 3 }}>{String(it.no).padStart(2, '0')}</td><td style={{ border: '1px solid #c3ccd4', padding: 3 }}>{it.name}</td><td style={{ border: '1px solid #c3ccd4', padding: 3, fontWeight: 700, color: stateOf(it.no) === '要調査' ? '#c0392b' : '#22303c' }}>{STATE_STYLE[stateOf(it.no)].icon} {stateOf(it.no)}</td><td style={{ border: '1px solid #c3ccd4', padding: 3, color: '#5b6773' }}>{stateOf(it.no) === '要調査' ? '要調査（結果詳細を参照）' : stateOf(it.no) === 'OK' ? '一致' : ''}</td></tr>)}</tbody>
      </table>
    </PreviewModal>
    </>
  );
}
