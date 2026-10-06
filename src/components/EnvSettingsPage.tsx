// 環境設定（提案I）：既存【動作環境】（マニュアル 4.2）と【ワイド画面 設定】（5.5.1）をWeb向けに整理。
//   依頼書 5.5.1／6.3：全項目を「全区分共通（システム全体）」と「区分ごと（起動中の区分）」の2区画に分けて表示する。
//   他画面へ移した項目の対応表は「確認事項・やりとり」のスレッドに記録（画面には出さない）。金額書式はプレビューつき。

import { useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ToastView, useToast } from './Toast';
import { DivisionInfoDialog } from './DivisionInfoDialog';
import { Modal } from './Modal';
import { Field, Notice, SettingsShell, Tabs, Toggle, btn, card, cardHead, input } from './ui';
import { DEFAULT_ENV, setSession, useSession, type EnvSettings } from '../store/session';
import { displayName } from '../data';
import { ScopeBlock } from './PrintCenter';
import { LoadDivisionSettings } from './DivisionSettingsLoad';
import { FUSEN_COLORS } from '../store/journalStore';

const DIV_TABS = ['金額書式', '伝票入力', '画面・バックアップ'];
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14, alignItems: 'start' };
const colorLbl: CSSProperties = { fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' };

export function EnvSettingsPage({ variant, accent, onNavigate }: { variant: 'form' | 'sheet'; accent: string; /** 他画面を開く（印刷の詳細設定） */ onNavigate?: (page: string) => void }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const s = useSession();
  const [v, setV] = useState<EnvSettings>(s.env);
  const [tab, setTab] = useState(DIV_TABS[0]);
  const toast = useToast();
  const set = (p: Partial<EnvSettings>) => setV((x) => ({ ...x, ...p }));
  /** 金額の表示例。点線は3桁ごとの区切り線（位取り線）として描く */
  const sample = (n: number): ReactNode => {
    const digits = String(Math.abs(n));
    const groups: string[] = [];
    for (let i = digits.length; i > 0; i -= 3) groups.unshift(digits.slice(Math.max(0, i - 3), i));
    const body: ReactNode = v.thousandsSep === 'なし' ? digits : v.thousandsSep === 'カンマ' ? groups.join(',') : groups.map((g, i) => <span key={i} style={{ padding: '0 3px', borderLeft: i ? '1px dotted #7a8794' : 'none' }}>{g}</span>);
    const sign = n < 0 ? v.negativeSign : '';
    return <span style={{ fontVariantNumeric: 'tabular-nums', color: n < 0 && v.negativeColor === '赤' ? '#c0392b' : '#22303c', display: 'inline-flex', alignItems: 'center' }}>{v.negativePos === '前' && sign}{body}{v.negativePos === '後' && sign}</span>;
  };
  function radios<O extends string>(opts: readonly O[], cur: O, on: (o: O) => void, text?: (o: O) => string) {
    return <div style={{ display: 'flex', gap: 14, fontSize: 12.5, flexWrap: 'wrap', paddingTop: 2 }}>{opts.map((o) => <label key={o} style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="radio" checked={cur === o} onChange={() => on(o)} />{text ? text(o) : o}</label>)}</div>;
  }
  /** この画面から移した項目（補正予算の入力方式・参照パネルの初期表示）は、移動先の画面で保存した値を維持する */
  const save = () => { setSession((x) => ({ env: { ...v, supplementMode: x.env.supplementMode, wideInitial: x.env.wideInitial, wideMonth: x.env.wideMonth, ledger1Init: x.env.ledger1Init, ledger2Init: x.env.ledger2Init, order: x.env.order } })); toast.show(`${displayName('環境設定')}を保存しました（全区分共通の設定はすべての区分に反映されます）`); };
  /** 設定の保存：現在の環境条件を JSON でダウンロード（既存の .ini に相当） */
  const saveFile = () => {
    const d = new Date();
    const name = `環境設定_${s.division.split(' ')[0]}_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    const blob = new Blob([JSON.stringify({ type: 'chappy-env', division: s.division, savedAt: d.toISOString(), env: v }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    setFileOpen(false); toast.show(`${name} を保存しました`);
  };
  /** 設定の読込：JSON を解析して未保存の下書きへ反映（OK（保存）で確定） */
  const applyLoaded = (obj: unknown, label: string) => {
    const env = (obj && typeof obj === 'object' && 'env' in (obj as Record<string, unknown>)) ? (obj as { env: unknown }).env : obj;
    if (!env || typeof env !== 'object') { toast.show('環境設定ファイルの形式が正しくありません'); return; }
    const known = Object.keys(DEFAULT_ENV) as (keyof EnvSettings)[];
    const picked: Partial<EnvSettings> = {};
    known.forEach((k) => { const val = (env as Record<string, unknown>)[k]; if (val !== undefined && typeof val === typeof DEFAULT_ENV[k]) (picked as Record<string, unknown>)[k] = val; });
    if (!Object.keys(picked).length) { toast.show('環境設定の項目が見つかりませんでした'); return; }
    setV({ ...DEFAULT_ENV, ...picked });
    setFileOpen(false); toast.show(`${label} から ${Object.keys(picked).length} 項目を読み込みました（未保存：OK（保存）で確定）`);
  };
  const onFile = (f: File | undefined) => {
    if (!f) return;
    f.text().then((t) => { try { applyLoaded(JSON.parse(t), f.name); } catch { toast.show('JSON として読み込めませんでした'); } });
    if (fileRef.current) fileRef.current.value = '';
  };
  const SAMPLE_ENV: EnvSettings = { ...DEFAULT_ENV, confirmGeneral: false, autoCompleteAdd: false, budgetThreshold: 80, thousandsSep: 'カンマ', negativeSign: '▲', negativeColor: '黒', zeroCut: false, colorReports: false, eraGannen: false, onePageRow: true, hideCorpName: true };
  const T = (k: keyof EnvSettings, label: string) => <Toggle on={!!v[k]} onChange={(x) => set({ [k]: x } as Partial<EnvSettings>)} accent={accent} label={label} />;

  return (
    <SettingsShell variant={variant} title={displayName('環境設定')} desc="システムの動作条件を設定します。「全区分共通」（システム全体）と「区分ごと」（起動中の区分のみ）に分けて表示しています。" actions={<>
      <button type="button" className="btn-outline" onClick={() => setInfoOpen(true)} style={btn()}>部門情報の変更</button>
      <button type="button" className="btn-outline" onClick={() => setFileOpen(true)} style={btn()}>設定の保存／読込</button>
      <LoadDivisionSettings accent={accent} kind="動作設定" onDone={(from) => toast.show(`「${from}」の動作設定を読み込みました（未保存：OK（保存）で確定）`)} />
      {onNavigate && <button type="button" className="btn-outline" onClick={() => onNavigate('共通の印刷設定')} style={btn()} data-open-print-settings>印刷の詳細設定（全帳票共通）</button>}
      <button type="button" className="btn-outline" onClick={() => { setV(DEFAULT_ENV); toast.show('初期値に戻しました（未保存）'); }} style={btn()}>初期値に戻す</button>
      <button type="button" className="submit-btn" onClick={save} style={btn(accent, true)}>OK（保存）</button>
    </>}>
      <ToastView msg={toast.msg} />
      <DivisionInfoDialog open={infoOpen} onClose={() => setInfoOpen(false)} accent={accent} />
      <Modal open={fileOpen} onClose={() => setFileOpen(false)} width={520} title={`${displayName('環境設定')}の保存／読込`}>
        <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
          <Notice>区分「{s.division}」の環境条件を設定ファイルとして保存し、別の区分・別の端末で読み込めます（既存の「動作設定ファイル（.ini）」に相当。Web版では JSON 形式）。</Notice>
          <div style={card}><div style={cardHead}>設定の保存</div><div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5 }}><span style={{ flex: 1, color: '#5b6773' }}>現在設定中（未保存分を含む）の条件をファイルに書き出します。</span><button type="button" onClick={saveFile} style={btn(accent, true)}>保存（ダウンロード）</button></div></div>
          <div style={card}><div style={cardHead}>設定の読込</div><div style={{ padding: 14, display: 'grid', gap: 10, fontSize: 12.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ flex: 1, color: '#5b6773' }}>保存した設定ファイルを選んで読み込みます。読み込んだ内容は「OK（保存）」で確定します。</span><button type="button" onClick={() => fileRef.current?.click()} style={btn(accent)}>ファイルを選択…</button></div>
            <input ref={fileRef} type="file" accept=".json,application/json" onChange={(e) => onFile(e.target.files?.[0])} style={{ display: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ flex: 1, color: '#9aa5b1' }}>手元にファイルがない場合は、サンプルの設定を読み込んで動作を確認できます。</span><button type="button" onClick={() => applyLoaded(SAMPLE_ENV, 'サンプル設定')} style={btn()}>サンプルを読み込む</button></div>
            <Notice tone="warn">一度読み込んだ環境条件は元に戻せません（保存前なら「初期値に戻す」または画面の再表示で破棄できます）。</Notice>
          </div></div>
        </div>
      </Modal>
      <div style={{ padding: 22, display: 'grid', gap: 18 }}>
        <Notice>設定は影響範囲で2つに分けています。<b>全区分共通</b>＝どの区分で起動しても同じ設定、<b>区分ごと</b>＝いま起動している区分だけの設定です。印刷に関わる設定（0データを表示しない・印刷位置・フォント・捺印欄など）は、各帳票の「印刷」画面の詳細設定に集約しました。</Notice>

        <ScopeBlock kind="全区分共通" title="システム全体の設定" desc="すべての区分に同じ内容が適用されます。変更すると他の区分の画面・帳票にも反映されます。">
          <div style={grid}>
            <div style={card}><div style={cardHead}>試算表・繰入金明細の集計方法</div><div style={{ padding: 14, display: 'grid', gap: 12 }}>
              <Field label="試算表：費目行の計算方式"><select value={v.trialCalc} onChange={(e) => set({ trialCalc: e.target.value })} style={input}>{['費目行に表記されている計算方式で計算する', '収入の借方と支出の借方を加算する（貸方も同様）'].map((o) => <option key={o}>{o}</option>)}</select></Field>
              <Field label="繰入金明細の集計方法">{radios(['収入で監視', '支払いで監視'] as const, v.transferWatch, (o) => set({ transferWatch: o }))}</Field>
              {T('budgetInternalOffset', '予算の内部取引消去（内部取引を相殺する）')}
              {T('termFromStart', '月範囲の選択で、期首から月を選択する')}
            </div></div>
            <div style={card}><div style={cardHead}>付箋の色の意味</div><div style={{ padding: 14, display: 'grid', gap: 8 }}>
              {(['赤', '青', '黄', '緑'] as const).map((f) => (
                <label key={f} style={{ display: 'grid', gridTemplateColumns: '16px 24px minmax(0, 1fr)', gap: 8, alignItems: 'center', fontSize: 12.5 }}>
                  <span aria-hidden style={{ width: 14, height: 14, borderRadius: 3, background: FUSEN_COLORS[f] }} /><span>{f}</span>
                  <input className="field-input" value={v.fusenNames[f]} onChange={(e) => set({ fusenNames: { ...v.fusenNames, [f]: e.target.value } })} placeholder="この色の付箋の意味" aria-label={`${f}の付箋の意味`} style={{ ...input, padding: '5px 8px', fontSize: 12.5 }} data-fusen-name={f} />
                </label>
              ))}
              <div style={{ fontSize: 12, color: '#7a8794' }}>伝票入力・日記帳・元帳の付箋ボタンのツールチップと、検索条件・印刷の絞り込みに「赤（{v.fusenNames.赤 || '…'}）」のように表示します。付箋の色は4色固定です。</div>
            </div></div>
            <div style={card}><div style={cardHead}>検索・日付の表記</div><div style={{ padding: 14, display: 'grid', gap: 10 }}>
              {T('noFurigana', 'フリガナ検索を無効にする（科目・業者・摘要の検索でフリガナを使わない）')}
              {T('eraGannen', '和暦の1年を「元年」と表記する')}
            </div></div>
            <div style={card}><div style={cardHead}>伝票入力時の通知</div><div style={{ padding: 14, display: 'grid', gap: 10 }}>
              {T('sufficiencyNotice', '充実残額発生の可能性を伝票入力画面に表示する')}
              <div style={{ fontSize: 12, color: '#7a8794' }}>既存の「充実残額発生の可能性確認設定」。前年度決算の簡易判定で社会福祉充実残額が発生しそうなとき、伝票入力画面の上部に案内を出します（「充実残額」で算定できます）。</div>
            </div></div>
          </div>
        </ScopeBlock>

        <ScopeBlock kind="区分ごと" title={`起動中の区分：${s.division}`} desc="この区分だけに適用されます。他の区分には影響しません（区分を切り替えると、その区分の設定が表示されます）。">
          <Tabs items={DIV_TABS} current={tab} onChange={setTab} accent={accent} small />
          <div style={{ ...grid, marginTop: 12 }}>
            {tab === '金額書式' && (
              <div style={card}><div style={cardHead}>金額 書式設定</div><div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="桁区切り"><select value={v.thousandsSep} onChange={(e) => set({ thousandsSep: e.target.value as EnvSettings['thousandsSep'] })} style={input}>{['カンマ', '点線', 'なし'].map((o) => <option key={o}>{o}</option>)}</select></Field>
                <Field label="負の記号"><select value={v.negativeSign} onChange={(e) => set({ negativeSign: e.target.value as EnvSettings['negativeSign'] })} style={input}><option value="-">ー（半角）</option><option value="△">△（全角）</option><option value="▲">▲（全角）</option></select></Field>
                <Field label="負の記号の位置">{radios(['前', '後'] as const, v.negativePos, (o) => set({ negativePos: o }), (o) => `数字の${o}`)}</Field>
                <Field label="負の表示色"><select value={v.negativeColor} onChange={(e) => set({ negativeColor: e.target.value as EnvSettings['negativeColor'] })} style={input}><option>黒</option><option>赤</option></select></Field>
                <div style={{ gridColumn: 'span 2' }}>{T('zeroCut', '0項目カット（相殺結果が0円の項目を表示・印刷しない）')}</div>
                <div style={{ gridColumn: 'span 2' }}>{T('autoAmountFont', '金額フォントサイズを自動調整する（桁数が多い金額を欄内に収める）')}</div>
                <div style={{ gridColumn: 'span 2', padding: '10px 12px', background: '#f8fafc', borderRadius: 10, fontSize: 14, display: 'flex', gap: 24, alignItems: 'center' }}><span style={{ fontSize: 12, color: '#5b6773' }}>表示例：</span>{sample(1234567)}{sample(-89012)}</div>
                {v.thousandsSep === '点線' && <div style={{ gridColumn: 'span 2', fontSize: 12, color: '#7a8794' }}>点線：3桁ごとに点線の区切り線を引きます（金額欄の位取り線。文字としての記号は入りません）。</div>}
              </div></div>
            )}
            {tab === '伝票入力' && (
              <>
                <div style={card}><div style={cardHead}>伝票入力時の確認画面</div><div style={{ padding: 14, display: 'grid', gap: 10 }}>
                  {T('confirmGeneral', '確認画面を出す（一般：誤った伝票・通常入力しない伝票）')}
                  {T('confirmIncome', '確認画面を出す（収益間の振替）')}
                  {T('confirmExpense', '確認画面を出す（費用間の振替）')}
                  <Notice>確認画面で「今後、この画面を表示しない」をチェックすると、ここでの設定が無効になります。再表示したい場合はここで有効に戻してください。</Notice>
                </div></div>
                <div style={card}><div style={cardHead}>摘要・仕訳の入力補助</div><div style={{ padding: 14, display: 'grid', gap: 10 }}>
                  {T('autoComplete', '摘要自動補完入力機能を有効にする')}
                  <div style={{ paddingLeft: 46, display: 'flex', gap: 14, fontSize: 12.5, flexWrap: 'wrap' }}>{[true, false].map((b) => <label key={String(b)} style={{ display: 'flex', gap: 4 }}><input type="radio" checked={v.autoCompleteAdd === b} disabled={!v.autoComplete} onChange={() => set({ autoCompleteAdd: b })} />入力された摘要を候補に{b ? '追加する' : '追加しない'}</label>)}</div>
                  {T('specialPopup', '特殊摘要入力時のポップアップを有効にする（入力可能な科目候補を表示）')}
                  {T('oneSideInternal', '借方側（貸方側）のみの内部取引仕訳を許可する')}
                  {T('searchTotal', '仕訳一覧の検索合計を有効にする（検索時に金額合計を右上に表示）')}
                </div></div>
                <div style={card}><div style={cardHead}>予算チェック</div><div style={{ padding: 14, display: 'grid', gap: 10 }}>
                  {T('budgetCheck', '予算チェック機能を使う（科目入力時に予算執行額をチェック）')}
                  <Field label={`しきい値：${v.budgetThreshold}%`}><input type="range" min={0} max={100} step={1} value={v.budgetThreshold} disabled={!v.budgetCheck} onChange={(e) => set({ budgetThreshold: Number(e.target.value) })} style={{ width: '100%' }} /></Field>
                  <div style={{ fontSize: 12, color: '#7a8794' }}>達成率がしきい値以上の科目を選ぶと、伝票入力の「予算残／達成率」を赤く表示します。</div>
                </div></div>
              </>
            )}
            {tab === '画面・バックアップ' && (
              <>
                <div style={card}><div style={cardHead}>バックアップ先</div><div style={{ padding: 14, display: 'grid', gap: 10 }}>
                  <Field label="保存先">{radios(['クラウド（標準）', 'フォルダ指定', 'Dropbox'] as const, v.backupDest, (o) => set({ backupDest: o }))}</Field>
                  {v.backupDest === 'フォルダ指定' && <Field label="保存フォルダ"><input className="field-input" value={v.backupFolder} onChange={(e) => set({ backupFolder: e.target.value })} placeholder="例：ダウンロード／会計バックアップ" style={input} /></Field>}
                  <div style={{ fontSize: 12, color: '#7a8794' }}>「データのバックアップ」を実行したときの保存先です。区分ごとに指定できます。</div>
                </div></div>
                <div style={card}><div style={cardHead}>画面背景</div><div style={{ padding: 14, display: 'grid', gap: 10 }}>
                  <Field label="背景の種類">{radios(['色', '画像'] as const, v.bgMode, (o) => set({ bgMode: o }))}</Field>
                  {v.bgMode === '色' ? (
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={colorLbl}>背景色<input type="color" value={v.bgColor} onChange={(e) => set({ bgColor: e.target.value })} /></label>
                      <label style={colorLbl}>右側（参照パネル）<input type="color" value={v.bgColorRight} onChange={(e) => set({ bgColorRight: e.target.value })} /></label>
                      <span style={{ display: 'inline-flex', width: 120, height: 34, borderRadius: 8, overflow: 'hidden', border: '1px solid #cfd8e0' }}><span style={{ flex: 2, background: v.bgColor }} /><span style={{ flex: 1, background: v.bgColorRight }} /></span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><button type="button" className="btn-outline" onClick={() => toast.show('背景画像の選択（プロトタイプでは未対応）')} style={btn()}>画像を選択…</button><span style={{ fontSize: 12, color: '#7a8794' }}>未選択</span></div>
                  )}
                  <div style={{ fontSize: 12, color: '#7a8794' }}>区分ごとに背景を変えると、起動中の区分を取り違えにくくなります。</div>
                </div></div>
              </>
            )}
          </div>
        </ScopeBlock>

      </div>
    </SettingsShell>
  );
}
