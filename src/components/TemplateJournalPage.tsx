// 仕訳辞書（提案E）：連続定型仕訳／自動按分仕訳／特殊金額の按分率／自動按分出力
//   マニュアル 5.3・5.4・7.6 に相当。テンプレートはセッションに保存し、伝票入力から呼び出す。

import { useState } from 'react';
import { NUM, TD, TH } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { Field, Notice, SettingsShell, Tabs, btn, input, numInput, toInt, yen } from './ui';
import { SERVICES } from '../data';
import { setSession, useSession, type AllocationTemplate, type JournalTemplate } from '../store/session';
import { allocate } from './EntryExtras';
import { AllocationWizardModal, TemplateWizardModal, blankAllocation, blankTemplate } from './TemplateWizards';


export function TemplateJournalPage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  const s = useSession();
  const [tab, setTab] = useState('連続定型仕訳');
  const toast = useToast();
  // 連続定型ウィザード
  const [wiz, setWiz] = useState<{ step: number; t: JournalTemplate } | null>(null);
  // 自動按分ウィザード
  const [awiz, setAwiz] = useState<{ step: number; t: AllocationTemplate } | null>(null);
  const [testAmount, setTestAmount] = useState('12000');


  return (
    <SettingsShell variant={variant} title="仕訳辞書" desc="定型仕訳（連続定型）と自動按分仕訳のテンプレート、特殊金額入力の按分率を管理します。伝票入力の「連続定型」「自動按分」ボタンから呼び出せます。" actions={
      tab === '連続定型仕訳' ? <button type="button" className="submit-btn" onClick={() => setWiz({ step: 0, t: blankTemplate() })} style={btn(accent, true)}>＋ 追加</button>
        : tab === '自動按分仕訳' ? <button type="button" className="submit-btn" onClick={() => setAwiz({ step: 0, t: blankAllocation() })} style={btn(accent, true)}>＋ 追加</button>
          : tab === '自動按分出力' ? <button type="button" className="submit-btn" onClick={() => toast.show('CSVを出力しました（プロトタイプでは動作しません）')} style={btn(accent, true)}>出力（CSV）</button>
            : <button type="button" className="submit-btn" onClick={() => toast.show('按分率を保存しました')} style={btn(accent, true)}>保存</button>
    }>
      <ToastView msg={toast.msg} />
      <Tabs items={['連続定型仕訳', '自動按分仕訳', '特殊金額の按分率', '自動按分出力']} current={tab} onChange={setTab} accent={accent} />

      {tab === '連続定型仕訳' && (
        <div style={{ padding: 22 }}>
          <Notice>事前に登録した仕訳を伝票入力の「連続定型（F9）」で呼び出し、日付・金額を入れて登録できます。伝票形式ごとにテンプレートを持てます（伝票追加／挿入／削除、強制資金に対応）。</Notice>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <thead><tr><th style={TH}>名称</th><th style={{ ...TH, width: 110 }}>伝票の形式</th><th style={TH}>内容</th><th style={{ ...TH, width: 70, textAlign: 'right' }}>行数</th><th style={{ ...TH, width: 150, textAlign: 'right' }}>操作</th></tr></thead>
            <tbody>
              {s.templates.map((t) => (
                <tr key={t.id}>
                  <td style={{ ...TD, fontWeight: 700 }}>{t.name}</td><td style={TD}>{t.form}</td>
                  <td style={{ ...TD, fontSize: 12, color: '#5b6773' }}>{t.lines.map((l) => `${l.kari}／${l.kashi}${l.amount ? ` ${yen(Number(l.amount))}` : ''}`).join('、')}</td>
                  <td style={NUM}>{t.lines.length}</td>
                  <td style={{ ...TD, textAlign: 'right' }}><div style={{ display: 'inline-flex', gap: 6 }}><button type="button" onClick={() => setWiz({ step: 2, t: JSON.parse(JSON.stringify(t)) })} style={btn('#5b6773', false, true)}>訂正</button><button type="button" onClick={() => { if (confirm(`「${t.name}」を削除しますか？`)) setSession({ templates: s.templates.filter((x) => x.id !== t.id) }); }} style={btn('#c0392b', false, true)}>削除</button></div></td>
                </tr>
              ))}
              {s.templates.length === 0 && <tr><td colSpan={5} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 30 }}>定型仕訳がありません。「＋ 追加」で登録してください。</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === '自動按分仕訳' && (
        <div style={{ padding: 22 }}>
          <Notice>水道代・ガス代などを、あらかじめ設定した比率で複数の区分（事務費／事業費など）の伝票に分けて登録します。伝票入力の「自動按分（F7）」で総金額と日付を入れると、1回の操作で複数枚の伝票を登録できます。</Notice>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <thead><tr><th style={TH}>名称</th><th style={{ ...TH, width: 90 }}>形式</th><th style={TH}>按分（区分：率）</th><th style={{ ...TH, width: 90 }}>端数処理</th><th style={{ ...TH, width: 200, textAlign: 'right' }}>操作</th></tr></thead>
            <tbody>
              {s.allocations.map((a) => (
                <tr key={a.id}>
                  <td style={{ ...TD, fontWeight: 700 }}>{a.name}</td><td style={TD}>{a.form}</td>
                  <td style={{ ...TD, fontSize: 12, color: '#5b6773' }}>{a.lines.map((l) => `${l.division}：${l.mode === '残り' ? '残り' : l.rate + '%'}（${l.kari}）`).join('　')}</td>
                  <td style={TD}>{a.rounding}</td>
                  <td style={{ ...TD, textAlign: 'right' }}><div style={{ display: 'inline-flex', gap: 6 }}><button type="button" onClick={() => setAwiz({ step: 3, t: JSON.parse(JSON.stringify(a)) })} style={btn('#5b6773', false, true)}>訂正</button><button type="button" onClick={() => { if (confirm(`「${a.name}」を削除しますか？`)) setSession({ allocations: s.allocations.filter((x) => x.id !== a.id) }); }} style={btn('#c0392b', false, true)}>削除</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#5b6773' }}>
            <span>計算例：</span><input className="field-input" value={yen(toInt(testAmount))} onChange={(e) => setTestAmount(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" style={{ ...numInput, width: 120, padding: '5px 8px' }} /><span>円を「{s.allocations[0]?.name}」で按分 →</span>
            {s.allocations[0] && allocate(s.allocations[0], toInt(testAmount)).map((r, i) => <span key={i} style={{ padding: '3px 8px', background: '#eef2f6', borderRadius: 6 }}>{r.division.split(' ')[1]} {yen(r.amount)}</span>)}
          </div>
        </div>
      )}

      {tab === '特殊金額の按分率' && (
        <div style={{ padding: 22, maxWidth: 640 }}>
          <Notice>配下に伝票入力区分を含む集合区分で起動したとき、金額の先頭に「＋」を付けて入力すると【特殊金額入力】が開き、ここで設定した按分率を初期値として区分別の金額を入力できます（合計100%）。</Notice>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <thead><tr><th style={TH}>伝票入力区分</th><th style={{ ...TH, width: 140, textAlign: 'right' }}>按分率（%）</th></tr></thead>
            <tbody>
              {s.specialRates.map((r, i) => <tr key={r.division}><td style={TD}>{r.division}</td><td style={NUM}><input className="field-input ring" value={String(r.rate)} onChange={(e) => setSession({ specialRates: s.specialRates.map((x, k) => (k === i ? { ...x, rate: toInt(e.target.value) } : x)) })} inputMode="numeric" style={{ ...numInput, width: 90, padding: '4px 8px' }} /></td></tr>)}
              <tr style={{ background: '#f3f6f9' }}><td style={{ ...TD, fontWeight: 700 }}>合計</td><td style={{ ...NUM, fontWeight: 700, color: s.specialRates.reduce((a, r) => a + r.rate, 0) === 100 ? '#1f7a52' : '#c0392b' }}>{s.specialRates.reduce((a, r) => a + r.rate, 0)}%</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === '自動按分出力' && (
        <div style={{ padding: 22, display: 'grid', gap: 12, maxWidth: 820 }}>
          <Notice>科目ごとに任意の区分間で金額を按分した額を、エクセル互換ファイル（CSV）として出力します（義務となる備付書類向け。摘要も出力）。</Notice>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="出力種類"><select style={input} defaultValue="貸借対照表の按分出力">{['貸借対照表の按分出力', '事業活動計算書の按分出力', '資金収支計算書の按分出力'].map((o) => <option key={o}>{o}</option>)}</select></Field>
            <Field label="出力する列"><div style={{ display: 'flex', gap: 10, fontSize: 12.5, paddingTop: 8 }}>{['当年度末', '前年度末', '増減'].map((o) => <label key={o} style={{ display: 'flex', gap: 4 }}><input type="checkbox" defaultChecked={o !== '増減'} />{o}</label>)}</div></Field>
            <Field label="端数の加算区分"><select style={input} defaultValue="002 保育事業">{SERVICES.map((o) => <option key={o}>{o}</option>)}</select></Field>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...TH, width: 70 }}>費目</th><th style={{ ...TH, width: 110 }}>区分コード</th><th style={TH}>科目名</th>{SERVICES.slice(0, 3).map((sv) => <th key={sv} style={{ ...TH, textAlign: 'right', width: 90 }}>{sv.split(' ')[1]}</th>)}<th style={{ ...TH, width: 160 }}>備考</th></tr></thead>
            <tbody>{[['50', '001-01-01', '現金預金', 20, 70, 10], ['52', '002-01-01', '器具及び備品', 0, 100, 0], ['60', '001-02-01', '事業未払金', 30, 60, 10], ['70', '001-00-00', '基本金', 0, 100, 0]].map((r) => <tr key={r[1] as string}><td style={TD}>{r[0]}</td><td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{r[1]}</td><td style={TD}>{r[2]}</td>{[3, 4, 5].map((i) => <td key={i} style={NUM}><input className="field-input" defaultValue={String(r[i])} style={{ ...numInput, width: 60, padding: '3px 6px', fontSize: 12 }} />%</td>)}<td style={TD}><input className="field-input" placeholder="編集" style={{ ...input, padding: '3px 6px', fontSize: 12 }} /></td></tr>)}</tbody>
          </table>
          <label style={{ fontSize: 12.5, display: 'flex', gap: 6 }}><input type="checkbox" defaultChecked />合計値を印刷</label>
        </div>
      )}

      <TemplateWizardModal wiz={wiz} setWiz={setWiz} accent={accent} />
      <AllocationWizardModal awiz={awiz} setAwiz={setAwiz} accent={accent} />
    </SettingsShell>
  );
}
