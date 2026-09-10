// 年度更新・年度切替（提案H）。マニュアル 4.6 に相当。
//   年度切替：翌年度以降＝黄色、前年度以前＝緑の確認 → 切替後は画面上部に帯を表示。連続性チェックの結果を表示。
//   年度更新：確認（バックアップ相当）→ 更新（進捗）→ 完了（注意事項）。再実行時は更新方法を選択。

import { useState } from 'react';
import { Modal } from './Modal';
import { NUM, TD, TH } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { Notice, SettingsShell, Steps, btn, card, cardHead, yen } from './ui';
import { setSession, useSession } from '../store/session';

const YEARS = ['令和6年度', '令和7年度', '令和8年度', '令和9年度'];
const CHECK_ROWS = [['現金預金', 9_812_300, 9_812_300], ['事業未収金', 1_200_000, 1_200_000], ['土地', 22_000_000, 22_000_000], ['建物', 15_400_000, 15_400_000], ['器具及び備品', 1_800_000, 1_800_000], ['事業未払金', 400_000, 400_000], ['職員預り金', 250_000, 250_000], ['基本金', 25_800_000, 25_800_000], ['次期繰越活動増減差額', 12_677_100, 12_677_100]] as const;

export function FiscalYearPage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  const s = useSession();
  const toast = useToast();
  const [confirmYear, setConfirmYear] = useState<string | null>(null);
  const [checkOpen, setCheckOpen] = useState(false);
  const [wizard, setWizard] = useState<null | { step: number; progress: number; redo: boolean; method: string }>(null);
  const idx = YEARS.indexOf(s.fiscalYear), cur = YEARS.indexOf(s.currentYear);
  const switchTo = (y: string) => { setSession({ fiscalYear: y }); setConfirmYear(null); setCheckOpen(true); };
  const startUpdate = () => {
    if (!wizard) return;
    setWizard({ ...wizard, step: 1, progress: 0 });
    const t0 = Date.now();
    const id = window.setInterval(() => {
      const p = Math.min(100, Math.round((Date.now() - t0) / 25));
      setWizard((w) => (w ? { ...w, progress: p } : w));
      if (p >= 100) { window.clearInterval(id); setTimeout(() => setWizard((w) => (w ? { ...w, step: 2 } : w)), 300); }
    }, 100);
  };
  const finishUpdate = () => {
    const next = YEARS[Math.min(YEARS.length - 1, cur + 1)];
    setSession({ currentYear: next, fiscalYear: next });
    setWizard(null);
    toast.show(`年度更新が完了しました。当年度は ${next} です`);
  };

  return (
    <SettingsShell variant={variant} title="年度更新・切替" desc="処理年度の切替（前年度以前・翌年度以降）と、新年度への年度更新を行います。過去年度に切り替えると画面上部に帯を表示して明示します。" actions={<button type="button" className="submit-btn" onClick={() => setWizard({ step: 0, progress: 0, redo: false, method: '通常の年度更新' })} style={btn(accent, true)}>年度更新を開始</button>}>
      <ToastView msg={toast.msg} />
      <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 18, alignItems: 'start' }}>
        <div style={card}>
          <div style={cardHead}>年度の切替</div>
          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 12.5, color: '#5b6773', marginBottom: 10 }}>現在の処理年度：<b style={{ color: '#22303c' }}>{s.fiscalYear}</b>　当年度：<b>{s.currentYear}</b></div>
            {YEARS.map((y, i) => {
              const on = y === s.fiscalYear;
              const past = i < cur, future = i > cur;
              return (
                <div key={y} onDoubleClick={() => !on && setConfirmYear(y)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, marginBottom: 6, border: '1px solid ' + (on ? accent : '#e2e8ee'), background: on ? '#f4f9f6' : '#fff' }}>
                  <b style={{ fontSize: 14 }}>{y}</b>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: past ? '#eaf5ef' : future ? '#fff7e6' : '#e8f0fb', color: past ? '#1f7a52' : future ? '#b7791f' : '#2c5f9e' }}>{past ? '前年度以前' : future ? '翌年度以降' : '当年度'}</span>
                  <span style={{ fontSize: 11.5, color: '#8290a0' }}>{i === 0 ? '運用開始年度' : ''}{future ? '（年度更新済み・予算入力用）' : ''}</span>
                  {!on && <button type="button" onClick={() => setConfirmYear(y)} style={{ ...btn('#5b6773', false, true), marginLeft: 'auto' }}>切り替える</button>}
                  {on && <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: accent }}>表示中</span>}
                </div>
              );
            })}
            <div style={{ marginTop: 8 }}><Notice>過去の年度に切り替えると、伝票入力は「閲覧のみ」になり、画面上部に緑の帯を表示します（既存システムのメイン画面が黒背景になる動作に相当）。年度切替の完了時に、前年決算額と当年繰越額の連続性チェック結果を表示します。</Notice></div>
            {idx !== cur && <button type="button" onClick={() => setCheckOpen(true)} style={{ ...btn(), marginTop: 10 }}>連続性チェックの結果を表示</button>}
          </div>
        </div>
        <div style={card}>
          <div style={cardHead}>年度更新</div>
          <div style={{ padding: 14, display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>新年度（{YEARS[Math.min(YEARS.length - 1, cur + 1)]}）へ更新します。更新すると次の処理が自動で行われます。</div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: '#48565f', lineHeight: 1.9 }}>
              <li>貸借科目の残高を新年度の繰越残高に設定（内部取引残高も自動セット）</li>
              <li>予算の繰り下げ：前年度予算→前々年度、当年度→前年度、次年度→当年度当初予算</li>
              <li>摘要自動補完候補のコピー、区分ごとの「年度更新待ち」を解消</li>
            </ul>
            <Notice tone="warn">データの保全のため、年度更新の前に必ずバックアップ（クラウドでは復元ポイントの作成）を行います。完了しない場合、年度更新はできません。伝票入力区分が複数ある場合、正常終了できなかった区分はエラーの内容と対処方法を表示します。</Notice>
            <div style={{ fontSize: 12.5, color: '#5b6773' }}>すでに年度更新を終えた後で再度実行する場合（再実行）は、更新方法を選択します。複数回実行すると前回と同じ結果が得られない場合があります。</div>
            <button type="button" onClick={() => setWizard({ step: 0, progress: 0, redo: true, method: '前年度の決算額で繰越残高を上書きする' })} style={btn('#b7791f')}>年度更新の再実行</button>
          </div>
        </div>
      </div>

      {/* 年度切替の確認 */}
      <Modal open={!!confirmYear} onClose={() => setConfirmYear(null)} width={480} title="年度切替確認" strict>
        {confirmYear && (() => { const i = YEARS.indexOf(confirmYear); const past = i < cur; return (
          <div style={{ padding: '16px 22px 18px', background: past ? '#eaf5ef' : '#fff7e6', display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{confirmYear} に切り替えます。</div>
            <div style={{ fontSize: 12.5, color: '#48565f', lineHeight: 1.8 }}>{past ? '前年度以前の年度です（緑背景）。伝票の閲覧・印刷はできますが、入力は「閲覧のみ」になります。' : '翌年度以降の年度です（黄色背景）。次年度予算の入力などに使用します。'}<br />切り替え後、前年データの決算額と当年データの繰越額を比較した結果を表示します。</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setConfirmYear(null)} style={btn()}>元に戻る</button><button type="button" className="submit-btn" onClick={() => switchTo(confirmYear)} style={btn(accent, true)}>年度を切り替える</button></div>
          </div>
        ); })()}
      </Modal>

      {/* 連続性チェック */}
      <Modal open={checkOpen} onClose={() => setCheckOpen(false)} width={620} title="金額の連続性チェック（前年決算額 × 当年繰越額）">
        <div style={{ padding: '12px 22px 18px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={TH}>科目</th><th style={{ ...TH, textAlign: 'right' }}>前年 決算額</th><th style={{ ...TH, textAlign: 'right' }}>当年 繰越額</th><th style={{ ...TH, width: 70, textAlign: 'center' }}>判定</th></tr></thead>
            <tbody>{CHECK_ROWS.map(([n, a, b]) => <tr key={n}><td style={TD}>{n}</td><td style={NUM}>{yen(a)}</td><td style={NUM}>{yen(b)}</td><td style={{ ...TD, textAlign: 'center' }}><span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 7px', borderRadius: 6, background: a === b ? '#e8f0fb' : '#c0392b', color: a === b ? '#2c5f9e' : '#fff' }}>{a === b ? 'OK' : 'NG'}</span></td></tr>)}</tbody></table>
          <div style={{ marginTop: 10 }}><Notice tone="ok">すべての科目で前年決算額と当年繰越額が一致しています。</Notice></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><button type="button" onClick={() => setCheckOpen(false)} style={btn(accent, true)}>OK</button></div>
        </div>
      </Modal>

      {/* 年度更新ウィザード */}
      <Modal open={!!wizard} onClose={() => setWizard(null)} closable={wizard?.step !== 1} width={640} title={wizard?.redo ? '年度更新（再実行）' : '年度更新'} strict>
        {wizard && (
          <>
            <Steps steps={['バックアップと確認', '年度更新の実行', '年次更新終了']} current={wizard.step} accent={accent} />
            <div style={{ padding: '18px 22px', display: 'grid', gap: 12 }}>
              {wizard.step === 0 && (
                <>
                  <Notice tone="warn">年度更新前に、選択されていた区分・年度の復元ポイントを作成します。作成が完了しない場合、年度更新はできません。</Notice>
                  {wizard.redo && <div><div style={{ fontSize: 12, fontWeight: 700, color: '#8290a0', marginBottom: 6 }}>年度更新方法</div>{['前年度の決算額で繰越残高を上書きする', '繰越残高は保持し、予算・摘要候補のみ再度繰り下げる', '内部取引残高のみ再設定する'].map((m) => <label key={m} style={{ display: 'flex', gap: 6, fontSize: 13, padding: '4px 0' }}><input type="radio" checked={wizard.method === m} onChange={() => setWizard({ ...wizard, method: m })} />{m}</label>)}</div>}
                  <div style={{ fontSize: 13 }}>対象：<b>{s.division}</b> ほか伝票入力区分 4 件　／　{s.currentYear} → {YEARS[Math.min(YEARS.length - 1, cur + 1)]}</div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setWizard(null)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={startUpdate} style={btn(accent, true)}>バックアップをして年度更新</button></div>
                </>
              )}
              {wizard.step === 1 && (
                <>
                  <div style={{ fontSize: 13 }}>{wizard.progress < 40 ? '復元ポイントを作成しています…' : wizard.progress < 90 ? '繰越残高・予算・摘要候補を更新しています…' : '整合性を確認しています…'}　{wizard.progress}%</div>
                  <div style={{ height: 10, background: '#eef2f5', borderRadius: 5, overflow: 'hidden' }}><div style={{ width: `${wizard.progress}%`, height: '100%', background: accent, transition: 'width .1s' }} /></div>
                </>
              )}
              {wizard.step === 2 && (
                <>
                  <Notice tone="ok">年度更新が正常に終了しました。</Notice>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: '#48565f', lineHeight: 1.9 }}><li>繰越残高を設定しました（貸借科目 14 科目・内部取引残高 0）</li><li>予算を繰り下げました（前年度／当年度当初）</li><li>摘要自動補完候補 14 件をコピーしました</li><li>注意：新年度の当初予算は「設定 › 予算」で確認・修正してください</li></ul>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" className="submit-btn" onClick={finishUpdate} style={btn(accent, true)}>Enter：閉じる</button></div>
                </>
              )}
            </div>
          </>
        )}
      </Modal>
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
