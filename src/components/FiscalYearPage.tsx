// 年度更新（依頼書 5.5.2・6.4、マニュアル 4.6）
//   参照する年度の切替は、ヘッダーの「会計期間」（区分・年度の切替）で行う。各種設定の「年度の切替」画面は廃止。
//   年度更新　：次年度へ繰り越す（取り消しできない）。バックアップの確認 → 翌年度データの確認 →（親区分・合算区分）構成区分の確認 → 最終確認 → 実行 → 完了。
//   年度更新（減価のみ）：同じ流れの簡易版。

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { openDivisionPicker } from './DivisionPicker';
import { TD, TH } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { Notice, SettingsShell, Steps, btn, card, cardHead, input } from './ui';
import { divisionLabel, flattenDivisions, setSession, startKindOf, useSession } from '../store/session';

export type FiscalOp = 'update' | 'dep';
const OP_LABEL: Record<FiscalOp, string> = { update: '年度更新', dep: '年度更新（減価のみ）' };
const DANGER = '#c0392b';
const YEARS = ['令和6年度', '令和7年度', '令和8年度', '令和9年度'];

function WarnIcon({ size = 20, color = DANGER }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v5" /><path d="M12 17.5v.5" /></svg>;
}
/** 最下部に置く、もう一方の操作への控えめなリンク */
function OtherLinks({ items }: { items: { label: string; note: string; onClick: () => void }[] }) {
  return (
    <div style={{ borderTop: '1px solid #eef2f5', padding: '12px 22px 16px', display: 'flex', gap: '6px 22px', flexWrap: 'wrap', fontSize: 12, color: '#8290a0' }}>
      <span>別の操作：</span>
      {items.map((it) => <span key={it.label}><button type="button" onClick={it.onClick} style={{ border: 'none', background: 'transparent', padding: 0, color: '#5b6773', textDecoration: 'underline', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>{it.label}</button>（{it.note}）</span>)}
    </div>
  );
}

export function FiscalYearPage({ variant, initial = 'update', onNavigate }: { variant: 'form' | 'sheet'; accent: string; /** 開く操作：年度更新／年度更新（減価のみ） */ initial?: FiscalOp; /** メニュー項目名で別画面へ移動（省略時はこの画面内で表示を切り替える） */ onNavigate?: (label: string) => void }) {
  const [op, setOp] = useState<FiscalOp>(initial);
  useEffect(() => { setOp(initial); }, [initial]);
  const go = (to: FiscalOp) => { if (onNavigate) onNavigate(OP_LABEL[to]); else setOp(to); };
  return <UpdateView key={op} variant={variant} depOnly={op === 'dep'} go={go} onNavigate={onNavigate} />;
}

/* ================= 年度更新（取り消しできない操作） ================= */
type StepKey = 'backup' | 'next' | 'members' | 'final' | 'run' | 'done';
const REDO_METHODS = ['前年度の決算額で繰越残高を上書きする', '繰越残高は保持し、予算・摘要候補のみ再度繰り下げる', '内部取引残高のみ再設定する'];
const SAMPLE_MEMBERS = ['001 本部', '002 保育事業', '003 子育て支援', '004 一時預かり'];
type MemberState = '更新済み' | '未更新' | '要確認';

function UpdateView({ variant, depOnly, go, onNavigate }: { variant: 'form' | 'sheet'; depOnly: boolean; go: (to: FiscalOp) => void; onNavigate?: (label: string) => void }) {
  const s = useSession();
  const toast = useToast();
  const kind = startKindOf(s);
  const [demoMulti, setDemoMulti] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const multi = kind !== '入力区分' || demoMulti;
  const keys: StepKey[] = ['backup', 'next', ...(multi ? ['members' as StepKey] : []), 'final', 'run', 'done'];
  const LABEL: Record<StepKey, string> = { backup: 'バックアップの確認', next: depOnly ? '翌年度の減価データの確認' : '翌年度データの確認', members: '構成区分の確認', final: '最終確認', run: '実行', done: '完了' };
  const [at, setAt] = useState<StepKey>('backup');
  const [backup, setBackup] = useState<{ checked: boolean; at: string | null; progress: number | null }>({ checked: false, at: null, progress: null });
  const [method, setMethod] = useState(REDO_METHODS[0]);
  const [agreeNext, setAgreeNext] = useState(false);
  const [word, setWord] = useState('');
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearInterval(timer.current), []);

  const cur = YEARS.indexOf(s.currentYear);
  const nextYear = YEARS[cur + 1] ?? `令和${(parseInt(s.currentYear.replace(/[^0-9]/g, ''), 10) || 0) + 1}年度`;
  const title = OP_LABEL[depOnly ? 'dep' : 'update'];
  const node = flattenDivisions(s.tree).find((x) => divisionLabel(x.node) === s.division)?.node;
  const realMembers = kind === '合算区分' ? s.merges.find((m) => m.name === s.division)?.members ?? [] : node ? flattenDivisions(node).filter((x) => x.node.entry && x.node.use !== false && x.node !== node).map((x) => divisionLabel(x.node)) : [];
  const members = realMembers.length >= 2 ? realMembers : SAMPLE_MEMBERS;
  const stateOf = (i: number): MemberState => (i === 0 ? '更新済み' : i === 2 ? '要確認' : '未更新');
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const isPicked = (m: string, i: number) => picked[m] ?? stateOf(i) === '未更新';
  const targets = multi ? members.filter((m, i) => stateOf(i) !== '要確認' && isPicked(m, i)) : [s.division];

  const idx = keys.indexOf(at);
  const move = (d: 1 | -1) => setAt(keys[Math.max(0, Math.min(keys.length - 1, idx + d))]);
  const canNext = at === 'backup' ? backup.checked : at === 'next' ? !hasNext || agreeNext : at === 'members' ? targets.length > 0 : true;
  const now = () => { const d = new Date(); return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const tick = (onTick: (p: number) => void, onEnd: () => void, ms: number) => {
    const t0 = Date.now();
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - t0) / ms) * 100));
      onTick(p);
      if (p >= 100) { window.clearInterval(timer.current); window.setTimeout(onEnd, 300); }
    }, 100);
  };
  const runBackup = () => { setBackup((b) => ({ ...b, progress: 0 })); tick((p) => setBackup((b) => ({ ...b, progress: p })), () => setBackup({ checked: true, at: now(), progress: null }), 1600); };
  const execute = () => { if (word.trim() !== '更新') return; setAt('run'); setProgress(0); tick(setProgress, () => setAt('done'), 2600); };
  const nav = (label: string) => { if (onNavigate) onNavigate(label); else toast.show(`「${label}」を開きます（メニューから選べます）`); };

  const row = (k: string, v: ReactNode) => <tr key={k}><td style={{ ...TD, width: 150, fontSize: 12, fontWeight: 700, color: '#5b6773' }}>{k}</td><td style={TD}>{v}</td></tr>;
  const running = at === 'run';
  /** 完了後に行うこと（年度の切替、繰越残高の確認 など） */
  const todo: [string, string, () => void, string][] = depOnly ? [
    ['年度の切替', `画面上部の「会計期間」から ${nextYear} に切り替えて、新年度のデータを開きます。`, openDivisionPicker, '会計期間を開く'],
    ['減価償却の確認', `${nextYear} の期首帳簿価額と償却予定額を確認します。`, () => nav('減価償却'), '減価償却を開く'],
  ] : [
    ['年度の切替', `画面上部の「会計期間」から ${nextYear} に切り替えて、新年度のデータを開きます。`, openDivisionPicker, '会計期間を開く'],
    ['繰越残高の確認', `${nextYear} の繰越残高が ${s.currentYear} の決算額と合っているか確認します。`, () => nav('開始残高'), '残高（繰越）を開く'],
    ['当初予算の確認', '次年度予算から移した当初予算を確認・修正します。', () => nav('予算'), '予算を開く'],
  ];

  return (
    <SettingsShell variant={variant} title={title} badge="取り消しできません" desc={depOnly ? '減価償却のデータだけを次年度へ繰り越します。伝票・残高・予算は変更しません。' : '当年度のデータを締めて、次年度へ繰り越します（繰越残高・予算・摘要候補を次年度へ設定）。'} draft>
      <ToastView msg={toast.msg} />
      <div style={{ margin: '16px 22px 0', display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', border: '1px solid #ecc5bf', borderLeft: '5px solid ' + DANGER, borderRadius: 10, background: '#fdf3f2' }}>
        <WarnIcon size={24} />
        <div style={{ fontSize: 12.5, lineHeight: 1.8, color: '#5c2018' }}>
          <b style={{ fontSize: 13.5, color: DANGER }}>{title}は、実行すると取り消しできません。</b><br />
          実行の前に必ずバックアップを取ります。参照する年度を変えるだけの場合は、この操作ではなく、画面上部の「会計期間」から切り替えます。
        </div>
      </div>
      <Steps steps={keys.map((k) => LABEL[k])} current={idx} accent={DANGER} />

      <div style={{ padding: '18px 22px 6px', display: 'grid', gap: 14, maxWidth: 920 }}>
        {at === 'backup' && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700 }}>① バックアップの確認</div>
            <div style={{ fontSize: 12.5, color: '#48565f', lineHeight: 1.8 }}>データを守るため、{title}の前にバックアップが必要です。バックアップが済んでいない場合、先へ進めません。</div>
            <div style={{ ...card, padding: 14, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
                <span>最後のバックアップ：<b>{backup.at ?? '2026/09/24 18:02'}</b>{backup.at ? <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#eaf5ef', color: '#1f7a52' }}>いま取得しました</span> : <span style={{ marginLeft: 8, fontSize: 11.5, color: '#8a5a00' }}>（そのあとに伝票が登録されています）</span>}</span>
                <button type="button" onClick={runBackup} disabled={backup.progress != null} style={{ ...btn('#22303c'), marginLeft: 'auto', opacity: backup.progress != null ? 0.5 : 1 }}>今すぐバックアップ</button>
              </div>
              {backup.progress != null && <div><div style={{ fontSize: 12, color: '#5b6773', marginBottom: 4 }}>バックアップを取得しています…　{backup.progress}%</div><div style={{ height: 8, background: '#eef2f5', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${backup.progress}%`, height: '100%', background: '#22303c', transition: 'width .1s' }} /></div></div>}
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, background: backup.checked ? '#eaf5ef' : '#f6f8fa' }}>
                <input type="checkbox" checked={backup.checked} onChange={(e) => setBackup((b) => ({ ...b, checked: e.target.checked }))} style={{ marginTop: 3 }} />
                <span><b>バックアップを取得済みであることを確認しました</b>（必須）</span>
              </label>
            </div>
          </>
        )}

        {at === 'next' && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700 }}>② {LABEL.next}</div>
            {!hasNext ? (
              <Notice tone="ok">{nextYear} の{depOnly ? '減価償却データ' : 'データ'}はまだありません。<b>{nextYear} を新しく作成します</b>（初めての{title}）。</Notice>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, padding: '10px 12px', background: '#fdf3f2', border: '1px solid #ecc5bf', borderRadius: 10, fontSize: 12.5, color: '#5c2018', lineHeight: 1.8 }}><WarnIcon /><div><b>{nextYear} の{depOnly ? '減価償却データ' : 'データ'}がすでにあります（年度更新の再実行）。</b><br />再実行すると、{nextYear} にすでに入力した内容の一部が上書きされます。複数回実行すると、前回と同じ結果にならない場合があります。</div></div>
                {!depOnly && <div style={{ ...card, padding: 14 }}><div style={{ fontSize: 12, fontWeight: 700, color: '#8290a0', marginBottom: 6 }}>年度更新の方法</div>{REDO_METHODS.map((m) => <label key={m} style={{ display: 'flex', gap: 6, fontSize: 13, padding: '4px 0', cursor: 'pointer' }}><input type="radio" checked={method === m} onChange={() => setMethod(m)} />{m}</label>)}</div>}
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, background: agreeNext ? '#fdf3f2' : '#f6f8fa' }}><input type="checkbox" checked={agreeNext} onChange={(e) => setAgreeNext(e.target.checked)} style={{ marginTop: 3 }} /><span><b>{nextYear} のデータが上書きされることを確認しました</b>（必須）</span></label>
              </div>
            )}
            <div style={{ fontSize: 12.5, color: '#48565f' }}>
              <b>{title}で行われること</b>
              <ul style={{ margin: '4px 0 0', paddingLeft: 20, lineHeight: 1.9 }}>
                {depOnly ? <><li>固定資産の期末帳簿価額を、{nextYear} の期首帳簿価額に設定</li><li>{nextYear} の減価償却費の予定額を計算</li><li>伝票・繰越残高・予算は変更しません</li></> : <><li>貸借科目の残高を {nextYear} の繰越残高に設定（内部取引残高も自動で設定）</li><li>予算の繰り下げ：前年度予算→前々年度、当年度→前年度、次年度→当年度当初予算</li><li>摘要の自動補完候補を {nextYear} へコピー</li></>}
              </ul>
            </div>
          </>
        )}

        {at === 'members' && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700 }}>③ 構成区分の年度更新状況の確認</div>
            <div style={{ fontSize: 12.5, color: '#48565f', lineHeight: 1.8 }}>{kind === '入力区分' ? '合算区分・親区分' : kind}で起動しているため、構成する区分ごとに年度更新の状況を確認します。今回更新する区分を選んでください。</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ ...TH, width: 90, textAlign: 'center' }}>今回更新</th><th style={TH}>区分</th><th style={{ ...TH, width: 130 }}>年度更新の状況</th><th style={TH}>説明</th></tr></thead>
              <tbody>{members.map((m, i) => {
                const st = stateOf(i);
                const c = st === '更新済み' ? { bg: '#eaf5ef', fg: '#1f7a52' } : st === '要確認' ? { bg: '#fdf3f2', fg: DANGER } : { bg: '#fff7e6', fg: '#8a5a00' };
                return (
                  <tr key={m}>
                    <td style={{ ...TD, textAlign: 'center' }}><input type="checkbox" aria-label={`${m} を今回更新する`} checked={st !== '要確認' && isPicked(m, i)} disabled={st === '要確認'} onChange={(e) => setPicked({ ...picked, [m]: e.target.checked })} /></td>
                    <td style={{ ...TD, fontWeight: 600 }}>{m}</td>
                    <td style={TD}><span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 8, background: c.bg, color: c.fg }}>{st === '未更新' ? '未更新（年度更新待ち）' : st}</span></td>
                    <td style={{ ...TD, fontSize: 12, color: '#5b6773' }}>{st === '更新済み' ? `${nextYear} へ更新済みです。選ぶと再実行になります。` : st === '要確認' ? '貸借が一致しない伝票があるため更新できません。伝票・科目チェックで確認してください。' : '今回の年度更新の対象です。'}</td>
                  </tr>
                );
              })}</tbody>
            </table>
            <div style={{ fontSize: 12.5 }}>今回更新する区分：<b>{targets.length}</b> 件{targets.length === 0 && <span style={{ color: DANGER, marginLeft: 8 }}>更新する区分を1つ以上選んでください</span>}</div>
          </>
        )}

        {at === 'final' && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{multi ? '④' : '③'} 実行の最終確認</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ecc5bf' }}>
              <tbody>
                {row('法人名', <b>{s.tree.name}</b>)}
                {row('区分', <><b>{s.division}</b>{multi && <span style={{ color: '#5b6773' }}>　対象：{targets.join('、')}（{targets.length} 件）</span>}</>)}
                {row('年度', <><b>{s.currentYear}</b> → <b style={{ color: DANGER }}>{nextYear}</b> へ繰り越す</>)}
                {row('実行する操作', <>{title}{hasNext ? `（再実行${depOnly ? '' : `：${method}`}）` : ''}</>)}
                {row('バックアップ', backup.at ? `${backup.at} に取得` : '取得済みであることを確認')}
              </tbody>
            </table>
            <div style={{ ...card, padding: 14, borderColor: '#ecc5bf', display: 'grid', gap: 8 }}>
              <label htmlFor="fy-confirm-word" style={{ fontSize: 13, fontWeight: 700 }}>確認のため、下の欄に「更新」と入力してください。</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input id="fy-confirm-word" className="field-input" value={word} onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) execute(); }} placeholder="更新" autoComplete="off" style={{ ...input, width: 160 }} />
                <button type="button" onClick={execute} disabled={word.trim() !== '更新'} style={{ ...btn(DANGER, true), opacity: word.trim() === '更新' ? 1 : 0.4, cursor: word.trim() === '更新' ? 'pointer' : 'not-allowed' }}>{title}を実行する</button>
                <span style={{ fontSize: 11.5, color: '#8290a0' }}>実行後は取り消しできません。</span>
              </div>
            </div>
          </>
        )}

        {at === 'run' && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{title}を実行しています</div>
            <div style={{ fontSize: 13 }}>{progress < 35 ? (depOnly ? '固定資産の帳簿価額を繰り越しています…' : '繰越残高を設定しています…') : progress < 75 ? (depOnly ? '減価償却費の予定額を計算しています…' : '予算・摘要候補を繰り下げています…') : '結果を確認しています…'}　<b style={{ fontVariantNumeric: 'tabular-nums' }}>{progress}%</b>{multi && <span style={{ color: '#5b6773' }}>　（{Math.min(targets.length, Math.floor((progress / 100) * targets.length) + 1)} / {targets.length} 区分）</span>}</div>
            <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} style={{ height: 12, background: '#eef2f5', borderRadius: 6, overflow: 'hidden' }}><div style={{ width: `${progress}%`, height: '100%', background: DANGER, transition: 'width .1s' }} /></div>
            <Notice tone="warn">処理が終わるまで、この画面を閉じたり、ほかの画面へ移動したりしないでください。</Notice>
          </>
        )}

        {at === 'done' && (
          <>
            <Notice tone="ok"><b>{title}が完了しました。</b>　{s.currentYear} → {nextYear}（{multi ? `${targets.length} 区分` : s.division}）</Notice>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: '#48565f', lineHeight: 1.9 }}>
              {depOnly ? <><li>固定資産 12 件の期首帳簿価額を設定しました</li><li>{nextYear} の減価償却費の予定額を計算しました</li></> : <><li>繰越残高を設定しました（貸借科目 14 科目・内部取引残高 0）</li><li>予算を繰り下げました（前年度／当年度当初）</li><li>摘要の自動補完候補 14 件をコピーしました</li></>}
            </ul>
            <div style={card}>
              <div style={cardHead}>次に行うこと</div>
              <div style={{ padding: 14, display: 'grid', gap: 8 }}>
                {todo.map(([t, d, fn, b], i) => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#22303c', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flex: 'none' }}>{i + 1}</span>
                    <span style={{ flex: '1 1 260px', minWidth: 0 }}><b style={{ fontSize: 13 }}>{t}</b><span style={{ display: 'block', fontSize: 12, color: '#5b6773' }}>{d}</span></span>
                    <button type="button" onClick={fn} style={btn('#22303c', i === 0, true)}>{b}</button>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: '#9aa5b1' }}>プロトタイプのため、実際のデータは変更していません。</div>
          </>
        )}
      </div>

      {!running && at !== 'done' && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 22px 18px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => move(-1)} disabled={idx === 0} style={{ ...btn(), opacity: idx === 0 ? 0.45 : 1 }}>戻る</button>
          {at !== 'final' && <button type="button" onClick={() => move(1)} disabled={!canNext} style={{ ...btn('#22303c', true), opacity: canNext ? 1 : 0.4, cursor: canNext ? 'pointer' : 'not-allowed' }}>次へ：{LABEL[keys[idx + 1]]}</button>}
          {!canNext && at === 'backup' && <span style={{ fontSize: 12, color: '#8a5a00' }}>バックアップ済みのチェックを入れると進めます</span>}
        </div>
      )}

      {!running && (
        <>
          <div style={{ padding: '0 22px 10px', display: 'flex', gap: '4px 18px', flexWrap: 'wrap', fontSize: 11.5, color: '#9aa5b1' }}>
            <span>プロトタイプ確認用：</span>
            <label style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={hasNext} onChange={(e) => { setHasNext(e.target.checked); setAgreeNext(false); }} disabled={at === 'done'} />翌年度データがある場合（再実行）の表示</label>
            {kind === '入力区分' && <label style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={demoMulti} onChange={(e) => { setDemoMulti(e.target.checked); setAt('backup'); }} disabled={at === 'done'} />合算区分・親区分で起動した場合の表示</label>}
          </div>
          <OtherLinks items={[
            depOnly ? { label: '年度更新', note: '伝票・残高・予算を含めて次年度へ繰り越す', onClick: () => go('update') } : { label: '年度更新（減価のみ）', note: '減価償却のデータだけを繰り越す', onClick: () => go('dep') },
          ]} />
        </>
      )}
    </SettingsShell>
  );
}

/** 過去年度／翌年度を表示中に画面上部へ出す帯 */
export function FiscalYearBanner() {
  const s = useSession();
  const idx = YEARS.indexOf(s.fiscalYear), cur = YEARS.indexOf(s.currentYear);
  if (idx === cur) return null;
  const past = idx < cur;
  return (
    <div style={{ background: past ? '#1f7a52' : '#b7791f', color: '#fff', fontSize: 12.5, fontWeight: 700, textAlign: 'center', padding: '5px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <span>{past ? '過去の年度' : '翌年度'}（{s.fiscalYear}）を表示中{past ? '：伝票の入力・訂正はできません（閲覧のみ）' : '：予算入力などに使用します'}</span>
      <button type="button" onClick={() => setSession({ fiscalYear: s.currentYear })} style={{ padding: '2px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.7)', background: 'transparent', color: '#fff', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>当年度（{s.currentYear}）に戻す</button>
    </div>
  );
}
