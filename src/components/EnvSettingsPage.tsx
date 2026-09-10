// 環境設定（提案I）：既存【動作環境】（マニュアル 4.2）と【ワイド画面 設定】（5.5.1）をWeb向けに整理。
//   入力／表示／帳票／右パネル の4区分。金額書式はプレビューつき。

import { useState } from 'react';
import { NOT_IMPL, ToastView, useToast } from './Toast';
import { Field, Notice, SettingsShell, Tabs, Toggle, btn, card, cardHead, input } from './ui';
import { DEFAULT_ENV, setSession, useSession, type EnvSettings } from '../store/session';
import { ACCOUNTS } from '../data';

export function EnvSettingsPage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  const s = useSession();
  const [v, setV] = useState<EnvSettings>(s.env);
  const [tab, setTab] = useState('入力');
  const toast = useToast();
  const set = (p: Partial<EnvSettings>) => setV((x) => ({ ...x, ...p }));
  const fmt = (n: number) => {
    const abs = Math.abs(n).toLocaleString('ja-JP');
    const body = v.thousandsSep === 'なし' ? abs.replace(/,/g, '') : v.thousandsSep === '点線' ? abs.replace(/,/g, '.') : abs;
    return n < 0 ? `${v.negativeSign}${body}` : body;
  };
  const save = () => { setSession({ env: v }); toast.show('環境設定を保存しました'); };
  const T = (k: keyof EnvSettings, label: string) => <Toggle on={!!v[k]} onChange={(x) => set({ [k]: x } as Partial<EnvSettings>)} accent={accent} label={label} />;

  return (
    <SettingsShell variant={variant} title="環境設定" desc="入力時の確認・補完、金額や帳票の表示、試算表の計算方式、右パネルの初期表示など、区分ごとの動作条件を設定します。" actions={<>
      <button type="button" className="btn-outline" onClick={() => toast.show('設定の保存（.ini）／読込：' + NOT_IMPL)} style={btn()}>設定の保存／読込</button>
      <button type="button" className="btn-outline" onClick={() => { setV(DEFAULT_ENV); toast.show('初期値に戻しました（未保存）'); }} style={btn()}>初期値に戻す</button>
      <button type="button" className="submit-btn" onClick={save} style={btn(accent, true)}>OK（保存）</button>
    </>}>
      <ToastView msg={toast.msg} />
      <Tabs items={['入力', '表示・金額書式', '帳票・試算表', '右パネル（ワイド画面）']} current={tab} onChange={setTab} accent={accent} />
      <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 18, alignItems: 'start' }}>
        {tab === '入力' && (
          <>
            <div style={card}><div style={cardHead}>伝票入力時の確認画面</div><div style={{ padding: 14, display: 'grid', gap: 10 }}>
              {T('confirmGeneral', '伝票入力時に確認画面を出す（一般：誤った伝票・通常入力しない伝票）')}
              {T('confirmIncome', '伝票入力時に確認画面を出す（収益間の振替）')}
              {T('confirmExpense', '伝票入力時に確認画面を出す（費用間の振替）')}
              <Notice>確認画面で「今後、この画面を表示しない」をチェックすると、ここでの設定が無効になります。再表示したい場合はここで有効に戻してください。</Notice>
            </div></div>
            <div style={card}><div style={cardHead}>摘要・科目の入力補助</div><div style={{ padding: 14, display: 'grid', gap: 10 }}>
              {T('autoComplete', '摘要自動補完入力機能を有効にする')}
              <div style={{ paddingLeft: 46, display: 'flex', gap: 14, fontSize: 12.5 }}>{[true, false].map((b) => <label key={String(b)} style={{ display: 'flex', gap: 4 }}><input type="radio" checked={v.autoCompleteAdd === b} disabled={!v.autoComplete} onChange={() => set({ autoCompleteAdd: b })} />入力された摘要を候補に{b ? '追加する' : '追加しない'}</label>)}</div>
              {T('specialPopup', '特殊摘要入力時のポップアップを有効にする（入力可能な科目候補を表示）')}
              {T('oneSideInternal', '借方側（貸方側）のみの内部取引仕訳を有効にする')}
              {T('searchTotal', '仕訳一覧の検索合計を有効にする（検索時に金額合計を右上に表示）')}
            </div></div>
            <div style={card}><div style={cardHead}>予算チェック機能</div><div style={{ padding: 14, display: 'grid', gap: 10 }}>
              {T('budgetCheck', '予算チェック機能を使う（科目入力時に予算執行額をチェック）')}
              <Field label={`閾値（しきい値）：${v.budgetThreshold}%`}><input type="range" min={0} max={100} step={1} value={v.budgetThreshold} disabled={!v.budgetCheck} onChange={(e) => set({ budgetThreshold: Number(e.target.value) })} style={{ width: '100%' }} /></Field>
              <div style={{ fontSize: 12, color: '#7a8794' }}>達成率が閾値以上の科目を選ぶと、伝票入力の「予算残／達成率」を赤く表示します。</div>
            </div></div>
          </>
        )}
        {tab === '表示・金額書式' && (
          <>
            <div style={card}><div style={cardHead}>金額 書式設定</div><div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="桁区切り"><select value={v.thousandsSep} onChange={(e) => set({ thousandsSep: e.target.value as EnvSettings['thousandsSep'] })} style={input}>{['カンマ', '点線', 'なし'].map((o) => <option key={o}>{o}</option>)}</select></Field>
              <Field label="負の記号"><select value={v.negativeSign} onChange={(e) => set({ negativeSign: e.target.value as EnvSettings['negativeSign'] })} style={input}><option value="-">ー（半角）</option><option value="△">△（全角）</option><option value="▲">▲（全角）</option></select></Field>
              <Field label="負の表示色"><select value={v.negativeColor} onChange={(e) => set({ negativeColor: e.target.value as EnvSettings['negativeColor'] })} style={input}><option>黒</option><option>赤</option></select></Field>
              <div style={{ alignSelf: 'end' }}>{T('zeroCut', '0項目カット（相殺結果が0円の項目を印刷しない）')}</div>
              <div style={{ gridColumn: 'span 2', padding: '10px 12px', background: '#f8fafc', borderRadius: 10, fontSize: 13, display: 'flex', gap: 24 }}><span>表示例：</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(1234567)}</span><span style={{ fontVariantNumeric: 'tabular-nums', color: v.negativeColor === '赤' ? '#c0392b' : '#22303c' }}>{fmt(-89012)}</span></div>
            </div></div>
            <div style={card}><div style={cardHead}>その他の表示</div><div style={{ padding: 14, display: 'grid', gap: 10 }}>
              {T('eraGannen', '和暦の1年を「元年」と表記する')}
              <Field label="帳票色（決算表・予算表・試算表・仕訳日記帳の罫線と網掛け）"><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{T('colorReports', 'カラー帳票を有効にする')}<label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>罫線<input type="color" value={v.lineColor} onChange={(e) => set({ lineColor: e.target.value })} disabled={!v.colorReports} /></label><label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>網掛け<input type="color" value={v.shadeColor} onChange={(e) => set({ shadeColor: e.target.value })} disabled={!v.colorReports} /></label></div></Field>
              <Notice>背景色・ビットマップ、画面サイズ、印刷速度優先など、Web版では不要な項目は省いています。</Notice>
            </div></div>
          </>
        )}
        {tab === '帳票・試算表' && (
          <>
            <div style={card}><div style={cardHead}>試算表（全区分共通）</div><div style={{ padding: 14, display: 'grid', gap: 12 }}>
              <Field label="費目行の計算方式"><select value={v.trialCalc} onChange={(e) => set({ trialCalc: e.target.value })} style={input}>{['費目行に表記されている計算方式で計算する', '収入の借方と支出の借方を加算する（貸方も同様）'].map((o) => <option key={o}>{o}</option>)}</select></Field>
              <Field label="予備費出力の選択"><select value={v.reserveOutput} onChange={(e) => set({ reserveOutput: e.target.value })} style={input}>{['予備費を標準方式で印字', '予備費の差異に計算結果を印字', '予備費の1行目に充当前の予算額を印字'].map((o) => <option key={o}>{o}</option>)}</select></Field>
              <div style={{ fontSize: 12, color: '#7a8794', lineHeight: 1.7 }}>標準方式：差異欄に予備費充当額を含めない　／　差異に計算結果：差異欄に充当額を含める　／　1行目：充当前の予算額を表示</div>
            </div></div>
            <div style={card}><div style={cardHead}>帳票・繰入金・注意書き</div><div style={{ padding: 14, display: 'grid', gap: 10 }}>
              <Toggle on={true} onChange={() => toast.show('予算の内部取引消去の切替：' + NOT_IMPL)} accent={accent} label="予算の内部取引消去（内部取引を相殺する）" />
              <Toggle on={false} onChange={() => toast.show(NOT_IMPL)} accent={accent} label="1行の改ページ制御（改行せず1ページに収める）" />
              <Toggle on={false} onChange={() => toast.show(NOT_IMPL)} accent={accent} label="タームボタン押下時に、期首より月を選択する" />
              <Field label="繰入金明細表の監視"><div style={{ display: 'flex', gap: 14, fontSize: 12.5 }}>{['収入で監視', '支払いで監視'].map((o, i) => <label key={o} style={{ display: 'flex', gap: 4 }}><input type="radio" defaultChecked={i === 0} />{o}</label>)}</div></Field>
              {T('noteOnExcel', 'Excel／PDF出力で明細書の注意書きを印字する')}
              <Toggle on={false} onChange={() => toast.show(NOT_IMPL)} accent={accent} label="決算書の「社会福祉法人名」を印刷しない" />
            </div></div>
          </>
        )}
        {tab === '右パネル（ワイド画面）' && (
          <div style={card}><div style={cardHead}>伝票入力時の右パネル（既存のワイド画面）</div><div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="初期表示画面"><select value={v.wideInitial} onChange={(e) => set({ wideInitial: e.target.value })} style={input}>{['仕訳日記帳', '仕訳日記帳（前年度参照）', '勘定元帳1', '勘定元帳2', '残高照合'].map((o) => <option key={o}>{o}</option>)}</select></Field>
            <Field label="初期表示選択月"><select value={v.wideMonth} onChange={(e) => set({ wideMonth: e.target.value })} style={input}>{['最新月', '最終入力月', '選択なし（前回終了時の月）'].map((o) => <option key={o}>{o}</option>)}</select></Field>
            <Field label="勘定元帳1 初期選択科目"><select value={v.ledger1Init} onChange={(e) => set({ ledger1Init: e.target.value })} style={input}><option value="">（未選択）</option>{ACCOUNTS.flatMap((g) => g.items).map((o) => <option key={o}>{o}</option>)}</select></Field>
            <Field label="勘定元帳2 初期選択科目"><select value={v.ledger2Init} onChange={(e) => set({ ledger2Init: e.target.value })} style={input}><option value="">（未選択）</option>{ACCOUNTS.flatMap((g) => g.items).map((o) => <option key={o}>{o}</option>)}</select></Field>
            <Field label="データ表示順序"><div style={{ display: 'flex', gap: 14, fontSize: 12.5, paddingTop: 8 }}>{(['日付順', '入力順'] as const).map((o) => <label key={o} style={{ display: 'flex', gap: 4 }}><input type="radio" checked={v.order === o} onChange={() => set({ order: o })} />{o}</label>)}</div></Field>
            <div style={{ gridColumn: 'span 2' }}><Notice>Web版では右パネルは「伝票入力」画面の右側の仕訳帳に相当します。元帳１／２・残高照合はヘッダーの「照会」から1画面で開きます。</Notice></div>
          </div></div>
        )}
      </div>
    </SettingsShell>
  );
}
