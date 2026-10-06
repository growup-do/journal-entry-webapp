// 旧 保守メニューのうち、Web版に未収録だった設定画面：
//   CarryoverJudgmentPage … 繰越判断の基準（収支分析表／高額繰越／前期末支払資金残高の取り扱い（委託費）／取崩による事前協議）
//   DepreciationLinkPage  … 減価償却との連動設定（固定資産科目の連動／借入元金償還補助の連動／国庫補助金等特別積立金の自動積立）
//   どちらも「科目の指定（チェックリスト）＋端数処理・監視の設定」という共通の形。判断の目安をその場で計算して見せる。

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { Field, Notice, SettingsShell, Tabs, Toggle, btn, card, cardHead, input, lbl, yen } from './ui';
import { ACCOUNT_META } from '../lib/accounts';
import { ScopeBar, type MaintenancePageProps } from './MaintenancePages';

/* ---------------- 共通部品 ---------------- */
interface Item { code: string; name: string }
const meta = (f: (m: (typeof ACCOUNT_META)[number]) => boolean): Item[] => ACCOUNT_META.filter(f).map((m) => ({ code: m.code, name: m.name }));
const extra = (list: [string, string][]): Item[] => list.map(([code, name]) => ({ code, name }));
const codes = (items: Item[], re: RegExp) => items.filter((i) => re.test(i.name)).map((i) => i.code);

/** 科目のチェックリスト（旧画面の「―― ○○に集計する科目 ――」の枠） */
function PickList({ title, items, value, onChange, height = 220, note }: { title: string; items: Item[]; value: string[]; onChange: (v: string[]) => void; height?: number; note?: ReactNode }) {
  const toggle = (c: string) => onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  return (
    <div style={card}>
      <div style={cardHead}>{title}<span style={{ fontSize: 11, fontWeight: 600, color: value.length ? '#5b6773' : '#c0392b', marginLeft: 6 }}>{value.length ? `${value.length} 科目` : '未設定'}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => onChange(items.map((i) => i.code))} style={btn('#5b6773', false, true)}>全て ON</button>
          <button type="button" onClick={() => onChange([])} style={btn('#5b6773', false, true)}>全て OFF</button>
        </span>
      </div>
      <div style={{ maxHeight: height, overflow: 'auto' }}>
        {items.map((i) => (
          <label key={i.code} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', fontSize: 12.5, borderTop: '1px solid #f1f4f7', background: value.includes(i.code) ? '#fffbe6' : '#fff', cursor: 'pointer' }}>
            <input type="checkbox" checked={value.includes(i.code)} onChange={() => toggle(i.code)} />
            <span style={{ fontVariantNumeric: 'tabular-nums', color: '#7a8794', width: 48, fontSize: 11.5 }}>{i.code}</span>
            <span>{i.name}</span>
          </label>
        ))}
      </div>
      {note && <div style={{ padding: '8px 12px', fontSize: 11.5, color: '#5b6773', borderTop: '1px solid #eef2f5', background: '#fbfcfd' }}>{note}</div>}
    </div>
  );
}

type Rounding = '切り上げ' | '切り捨て' | '四捨五入';
const ROUNDINGS: Rounding[] = ['切り上げ', '切り捨て', '四捨五入'];
const roundBy = (n: number, r: Rounding) => (r === '切り上げ' ? Math.ceil(n) : r === '切り捨て' ? Math.floor(n) : Math.round(n));
function RoundingField({ label, value, onChange }: { label: string; value: Rounding; onChange: (r: Rounding) => void }) {
  return (
    <Field label={label}>
      <div style={{ display: 'flex', gap: 14, fontSize: 12.5, paddingTop: 2 }}>{ROUNDINGS.map((r) => <label key={r} style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="radio" checked={value === r} onChange={() => onChange(r)} />{r}</label>)}</div>
    </Field>
  );
}

/** 判断の目安（設定した端数処理をその場で反映して見せる） */
function Guide({ rows }: { rows: { label: string; value: ReactNode; strong?: boolean }[] }) {
  return (
    <div style={{ ...card, background: '#f7f9fb' }}>
      <div style={cardHead}>判断の目安<span style={{ fontSize: 11, fontWeight: 500, color: '#7a8794', marginLeft: 6 }}>サンプルデータで計算</span></div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}><tbody>
        {rows.map((r) => <tr key={r.label}><td style={{ padding: '7px 12px', borderTop: '1px solid #eef2f5', color: '#5b6773' }}>{r.label}</td><td style={{ padding: '7px 12px', borderTop: '1px solid #eef2f5', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: r.strong ? 800 : 500 }}>{r.value}</td></tr>)}
      </tbody></table>
    </div>
  );
}

/* ---------------- 関連資料（通知文） ---------------- */
const NOTICE_TEXT = `平成29年4月6日　府子本第225号　雇児発0406第2号
「子ども・子育て支援法附則第6条の規定による私立保育所に対する委託費の経理等について」の一部改正について　より

5　委託費の経理に係る指導監督
　委託費の経理に係る指導監督については、社会福祉施設に対する指導監督に係る関係通知と併せ、以下の点を徹底されたいこと。
　　〜 中略 〜
（2）設置者から提出された計算書類等が以下のいずれかに該当する場合については、別表6の収支分析表の提出を求め、「1　委託費の使途範囲」から「4　委託費の管理・運用」までに示された事項の遵守状況を確認すること。
　　〜 中略 〜
　④　委託費に係る当該会計年度の各種積立資産への積立支出及び当期資金収支差額合計が、当該施設に係る拠点区分の事業活動収入計（決算額）の5％相当額を上回る場合`;

/* ==================================================================
 * 繰越判断の基準
 * ================================================================== */
const SAMPLE = { income: 40_120_000, prevIncome: 42_300_000, fundEnd: 9_500_000, itaku: 37_500_000, budgetIncome: 40_800_000, reserveOut: 1_200_000, fundDiff: 650_000 };
const TABS_C = ['収支分析表', '高額繰越', '前期末支払資金残高の取り扱い（委託費）', '取崩による事前協議'];
const INCOME_ITEMS = meta((m) => m.cls === '収益');
const EXPENSE_ITEMS = [...extra([['5810', '施設整備等積立資産積立支出'], ['5820', '人件費積立資産積立支出'], ['5830', '修繕積立資産積立支出'], ['5840', '備品等購入積立資産積立支出'], ['5850', '保育所施設・設備整備積立資産積立支出']]), ...meta((m) => m.cls === '費用')];
const RESERVE_ITEMS = extra([['3310', '施設整備等積立金'], ['3320', '人件費積立金'], ['3330', '修繕積立金'], ['3340', '備品等購入積立金'], ['3350', '保育所施設・設備整備積立金'], ['3390', 'その他の積立金']]);

export function CarryoverJudgmentPage({ variant, accent, onNavigate }: MaintenancePageProps) {
  const toast = useToast();
  const [tab, setTab] = useState(TABS_C[0]);
  const [noticeOpen, setNoticeOpen] = useState(false);
  // 収支分析表
  const [reserveOut, setReserveOut] = useState<string[]>(codes(EXPENSE_ITEMS, /積立資産積立支出/));
  const [incomeAll, setIncomeAll] = useState<string[]>(codes(INCOME_ITEMS, /委託費|利用料|補助金/));
  const [r5, setR5] = useState<Rounding>('切り上げ');
  // 高額繰越
  const [otherReserve, setOtherReserve] = useState<string[]>(codes(RESERVE_ITEMS, /その他の積立金/));
  const [incomeSrc, setIncomeSrc] = useState<'システムより集計する' | '手入力する'>('システムより集計する');
  const [incomeManual, setIncomeManual] = useState(SAMPLE.prevIncome);
  const [incomePrev, setIncomePrev] = useState<string[]>(codes(INCOME_ITEMS, /委託費|利用料|補助金/));
  const [r50, setR50] = useState<Rounding>('切り上げ');
  // 委託費 30%
  const [itaku, setItaku] = useState<string[]>(codes(INCOME_ITEMS, /委託費/));
  const [r30, setR30] = useState<Rounding>('切り上げ');
  // 事前協議 3%
  const [r3, setR3] = useState<Rounding>('切り上げ');

  const prevIncome = incomeSrc === '手入力する' ? incomeManual : SAMPLE.prevIncome;
  const limit5 = roundBy(SAMPLE.income * 0.05, r5);
  const limit50 = roundBy(prevIncome * 0.5, r50);
  const limit30 = roundBy(SAMPLE.itaku * 0.3, r30);
  const limit3 = roundBy(SAMPLE.budgetIncome * 0.03, r3);
  const total5 = SAMPLE.reserveOut + SAMPLE.fundDiff;
  const judge = (over: boolean, yes: string, no: string) => <span style={{ color: over ? '#c0392b' : '#1f7a52' }}>{over ? yes : no}</span>;

  return (
    <SettingsShell variant={variant} title="繰越判断の基準" badge="マスター設定" draft={false} desc="委託費の繰越・積立に関する判断（収支分析表の提出、高額繰越、前期末支払資金残高の取り扱い、取崩しの事前協議）の基準となる科目と端数処理を設定します。設定した内容は、決算チェック・収支分析表の印刷で使います。" actions={<>
      <button type="button" className="btn-outline" onClick={() => setNoticeOpen(true)} style={btn()}>関連資料（通知文）</button>
      <button type="button" className="submit-btn" onClick={() => toast.show(`「${tab}」の基準を保存しました`)} style={btn(accent, true)}>設定を保存</button>
    </>}>
      <ToastView msg={toast.msg} />
      <Modal open={noticeOpen} onClose={() => setNoticeOpen(false)} width={640} title="通知文（関連資料）">
        <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.8, color: '#22303c' }}>{NOTICE_TEXT}</pre>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={() => setNoticeOpen(false)} style={btn(accent, true)}>OK</button></div>
        </div>
      </Modal>
      <Tabs items={TABS_C} current={tab} onChange={setTab} accent={accent} />
      <ScopeBar scope="この区分のみ" note="拠点区分ごとに判断" right={onNavigate && <button type="button" className="btn-outline" onClick={() => onNavigate('印刷センター')} style={btn('#5b6773', false, true)}>収支分析表を印刷 →</button>}>
        判断は拠点区分（施設）ごとに行います。当期資金収支差額・当期末支払資金残高はシステムが自動計算します。
      </ScopeBar>

      {tab === '収支分析表' && (
        <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }}>
          <PickList title="各積立資産積立支出に集計する科目" items={EXPENSE_ITEMS} value={reserveOut} onChange={setReserveOut} />
          <PickList title="当期事業活動収入計に集計する科目" items={INCOME_ITEMS} value={incomeAll} onChange={setIncomeAll} />
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={card}><div style={cardHead}>端数処理</div><div style={{ padding: 14 }}><RoundingField label="当期事業活動収入計の 5% を算出する際の端数処理" value={r5} onChange={setR5} /></div></div>
            <Guide rows={[
              { label: '当期事業活動収入計', value: yen(SAMPLE.income) },
              { label: `5% 相当額（${r5}）`, value: yen(limit5), strong: true },
              { label: '各積立資産への積立支出', value: yen(SAMPLE.reserveOut) },
              { label: '当期資金収支差額合計', value: yen(SAMPLE.fundDiff) },
              { label: '合計', value: yen(total5) },
              { label: '判定', value: judge(total5 > limit5, '5% を超える：収支分析表の提出が必要', '5% 以内：提出不要') },
            ]} />
            <Notice>積立支出と当期資金収支差額の合計が、事業活動収入計の 5% 相当額を上回る場合は収支分析表の提出が必要です（通知文 5（2）④）。</Notice>
          </div>
        </div>
      )}

      {tab === '高額繰越' && (
        <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }}>
          <PickList title="「その他の積立金」の指定" items={RESERVE_ITEMS} value={otherReserve} onChange={setOtherReserve} note="当期末支払資金残高は、流動資産 − 流動負債 の計算によりシステムが自動集計します。" />
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={card}><div style={cardHead}>収入決算額</div><div style={{ padding: 14, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 14, fontSize: 12.5 }}>{(['システムより集計する', '手入力する'] as const).map((o) => <label key={o} style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="radio" checked={incomeSrc === o} onChange={() => setIncomeSrc(o)} />{o}</label>)}</div>
              {incomeSrc === '手入力する' && <Field label="前年度の収入決算額"><input className="field-input" value={incomeManual.toLocaleString('ja-JP')} onChange={(e) => setIncomeManual(parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)} style={{ ...input, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} /></Field>}
            </div></div>
            {incomeSrc === 'システムより集計する' && <PickList title="収入決算額に集計する科目" items={INCOME_ITEMS} value={incomePrev} onChange={setIncomePrev} height={180} />}
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={card}><div style={cardHead}>端数処理</div><div style={{ padding: 14 }}><RoundingField label="前年度収入決算額の 6 か月分（50%）の処理" value={r50} onChange={setR50} /></div></div>
            <Guide rows={[
              { label: '前年度の収入決算額', value: yen(prevIncome) },
              { label: `6 か月分（50%・${r50}）`, value: yen(limit50), strong: true },
              { label: '当期末支払資金残高', value: yen(SAMPLE.fundEnd) },
              { label: '判定', value: judge(SAMPLE.fundEnd > limit50, '高額繰越に該当', '高額繰越には該当しない') },
            ]} />
          </div>
        </div>
      )}

      {tab === '前期末支払資金残高の取り扱い（委託費）' && (
        <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }}>
          <PickList title="委託費科目" items={INCOME_ITEMS} value={itaku} onChange={setItaku} />
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={card}><div style={cardHead}>端数処理</div><div style={{ padding: 14 }}><RoundingField label="委託費収入の 30% を算出する際の端数処理" value={r30} onChange={setR30} /></div></div>
            <Guide rows={[
              { label: '委託費収入（当年度）', value: yen(SAMPLE.itaku) },
              { label: `30% 相当額（${r30}）`, value: yen(limit30), strong: true },
              { label: '前期末支払資金残高', value: yen(SAMPLE.fundEnd) },
              { label: '判定', value: judge(SAMPLE.fundEnd > limit30, '30% を超える：取り扱いの確認が必要', '30% 以内') },
            ]} />
          </div>
        </div>
      )}

      {tab === '取崩による事前協議' && (
        <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={card}><div style={cardHead}>端数処理</div><div style={{ padding: 14 }}><RoundingField label="事業活動収入（予算額）の 3% を算出する際の端数処理" value={r3} onChange={setR3} /></div></div>
            <Notice>前期末支払資金残高を取り崩して使う額が、事業活動収入（予算額）の 3% を超える場合は、あらかじめ所轄庁との協議が必要です。この画面では 3% を算出するときの端数処理だけを設定します。</Notice>
          </div>
          <Guide rows={[
            { label: '事業活動収入（当年度予算額）', value: yen(SAMPLE.budgetIncome) },
            { label: `3% 相当額（${r3}）`, value: yen(limit3), strong: true },
          ]} />
        </div>
      )}
    </SettingsShell>
  );
}

/* ==================================================================
 * 減価償却との連動設定
 * ================================================================== */
const TABS_D = ['固定資産科目の連動', '借入元金償還補助の連動', '国庫補助金等特別積立金の自動積立'];
const FIXED_ITEMS = [...meta((m) => m.cls === '資産' && !/定期預金|有価証券/.test(m.name)), ...extra([['1530', '構築物'], ['1540', '機械及び装置'], ['1550', '車輌運搬具'], ['1560', '建物附属設備'], ['1570', '建設仮勘定'], ['1580', '有形リース資産'], ['1591', '建物減価償却累計額'], ['1592', '構築物減価償却累計額'], ['1593', '器具及び備品減価償却累計額']])];
const EQUIP_ITEMS = meta((m) => m.cls === '費用');
const CASH_ITEMS = meta((m) => m.cls === '現預金');
const SUBSIDY_INCOME_ITEMS = [...extra([['4810', '施設整備等補助金収益'], ['4815', '設備資金借入金元金償還補助金収益'], ['4830', '施設整備等寄附金収益'], ['4840', '設備資金借入金元金償還寄附金収益']]), ...meta((m) => m.cls === '収益' && /補助金/.test(m.name))];
const RESERVE_IN_ITEMS = extra([['6810', '国庫補助金等特別積立金積立額'], ['6510', '国庫補助金等特別積立金取崩額（除却等）'], ['6710', '建物売却損・処分損'], ['6720', '器具及び備品売却損・処分損'], ['6730', 'ソフトウェア売却損・処分損']]);
const RESERVE_ACCT_ITEMS = extra([['3210', '国庫補助金等特別積立金']]);
const DEFAULTS = {
  fixed: codes(FIXED_ITEMS, /土地|建物|構築物|機械|車輌|器具|ソフトウェア|リース|累計額|仮勘定/),
  equip: codes(EQUIP_ITEMS, /消耗器具|器具|備品|修繕/),
  reserveIn: codes(RESERVE_IN_ITEMS, /積立額$/),
  cash: CASH_ITEMS.map((i) => i.code),
  subsidy: codes(SUBSIDY_INCOME_ITEMS, /元金償還補助金/),
  autoIn: codes(RESERVE_IN_ITEMS, /積立額$/),
  autoAcct: RESERVE_ACCT_ITEMS.map((i) => i.code),
};

export function DepreciationLinkPage({ variant, accent, onNavigate }: MaintenancePageProps) {
  const toast = useToast();
  const [tab, setTab] = useState(TABS_D[0]);
  const [fixed, setFixed] = useState(DEFAULTS.fixed);
  const [equip, setEquip] = useState(DEFAULTS.equip);
  const [reserveIn, setReserveIn] = useState(DEFAULTS.reserveIn);
  const [cash, setCash] = useState(DEFAULTS.cash);
  const [subsidy, setSubsidy] = useState(DEFAULTS.subsidy);
  const [watch, setWatch] = useState(true);
  const [autoIn, setAutoIn] = useState(DEFAULTS.autoIn);
  const [autoAcct, setAutoAcct] = useState(DEFAULTS.autoAcct);
  const [autoOn, setAutoOn] = useState(false);
  const [tekiyo, setTekiyo] = useState('国庫補助金等特別積立金 積立（自動）');
  const reset = () => { setFixed(DEFAULTS.fixed); setEquip(DEFAULTS.equip); setReserveIn(DEFAULTS.reserveIn); setCash(DEFAULTS.cash); setSubsidy(DEFAULTS.subsidy); setAutoIn(DEFAULTS.autoIn); setAutoAcct(DEFAULTS.autoAcct); toast.show('デフォルト設定に戻しました（未保存）'); };
  const go = (p: string) => (onNavigate ? onNavigate(p) : toast.show(`「${p}」を開きます（プロトタイプ）`));
  const cols3 = { padding: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' } as const;
  return (
    <SettingsShell variant={variant} title="減価償却との連動設定" badge="マスター設定" draft={false} desc="会計の仕訳と減価償却（別売オプション）をつなぐ設定です。固定資産の取得・備品購入の仕訳を減価償却へ連動させる科目、借入元金償還補助の仕訳を認識する科目、国庫補助金等特別積立金を自動で積み立てる仕訳の科目を指定します。" actions={<>
      <button type="button" className="btn-outline" onClick={reset} style={btn()}>デフォルト設定にする</button>
      <button type="button" className="submit-btn" onClick={() => toast.show(`「${tab}」の設定を保存しました`)} style={btn(accent, true)}>OK（保存）</button>
    </>}>
      <ToastView msg={toast.msg} />
      <Tabs items={TABS_D} current={tab} onChange={setTab} accent={accent} />
      <ScopeBar scope="全区分共通" note="法人全体で共有" right={<><button type="button" className="btn-outline" onClick={() => go('勘定科目')} style={btn('#5b6773', false, true)}>科目設定で確認 →</button><button type="button" className="btn-outline" onClick={() => go('減価償却')} style={btn('#5b6773', false, true)}>減価償却を開く →</button></>}>
        ここで指定した科目は、科目設定の各科目にある「減価償却連動」と同じ設定です。どちらで変更しても同じ内容になります。
      </ScopeBar>

      {tab === '固定資産科目の連動' && (
        <div style={cols3}>
          <PickList title="固定資産科目" items={FIXED_ITEMS} value={fixed} onChange={setFixed} height={300} note="これらの科目を借方にした仕訳は、減価償却の「移管・取込み」に資産候補として表示されます。" />
          <PickList title="備品科目" items={EQUIP_ITEMS} value={equip} onChange={setEquip} height={300} note="10 万円未満の備品の購入を減価償却の「備品台帳」へ連動させる科目です。" />
          <div style={{ display: 'grid', gap: 12 }}>
            <PickList title="国庫補助金等特別積立金積立額" items={RESERVE_IN_ITEMS.filter((i) => /積立額$/.test(i.name))} value={reserveIn} onChange={setReserveIn} height={120} />
            <Notice>連動の対象となる仕訳は、伝票入力の「取引種別」に「償却」の印が付きます。連動を解除しても登録済みの資産は消えません。</Notice>
          </div>
        </div>
      )}

      {tab === '借入元金償還補助の連動' && (
        <div style={cols3}>
          <PickList title="補助金収入を受ける流動資産の科目" items={CASH_ITEMS} value={cash} onChange={setCash} height={300} />
          <PickList title="設備資金借入金元金償還補助金収益の科目" items={SUBSIDY_INCOME_ITEMS} value={subsidy} onChange={setSubsidy} height={300} />
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={card}><div style={cardHead}>監視</div><div style={{ padding: 14, display: 'grid', gap: 10 }}>
              <Toggle on={watch} onChange={setWatch} accent={accent} label="伝票入力時に監視（機能を有効に）する" />
              <div style={{ fontSize: 12, color: '#7a8794' }}>左の 2 つの科目を組み合わせた仕訳を登録すると、減価償却の「補助金」に償還補助金として記録するか確認します。</div>
            </div></div>
            <Notice>借入金元金償還補助金は、国庫補助金等特別積立金の積立の対象になります。積立の仕訳を自動で起こす場合は、次のタブで設定します。</Notice>
          </div>
        </div>
      )}

      {tab === '国庫補助金等特別積立金の自動積立' && (
        <div style={cols3}>
          <PickList title="国庫補助金等特別積立金積立額の科目" items={RESERVE_IN_ITEMS} value={autoIn} onChange={setAutoIn} height={260} />
          <PickList title="国庫補助金等特別積立金の科目" items={RESERVE_ACCT_ITEMS} value={autoAcct} onChange={setAutoAcct} height={120} />
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={card}><div style={cardHead}>自動積立</div><div style={{ padding: 14, display: 'grid', gap: 10 }}>
              <Toggle on={autoOn} onChange={setAutoOn} accent={accent} label="自動積立機能を有効とする" />
              <Field label="自動で起こす仕訳の摘要"><input className="field-input" value={tekiyo} onChange={(e) => setTekiyo(e.target.value)} disabled={!autoOn} style={{ ...input, background: autoOn ? '#fff' : '#eef2f5' }} /></Field>
              <div style={{ fontSize: 12, color: '#7a8794' }}>有効にすると、補助金で取得した資産の登録時に「{RESERVE_IN_ITEMS.find((i) => autoIn.includes(i.code))?.name ?? '積立額の科目'} ／ {RESERVE_ACCT_ITEMS[0].name}」の仕訳を自動で作成します。</div>
            </div></div>
            <div style={{ fontSize: 11.5, color: '#7a8794', padding: '0 4px' }}><span style={lbl}>補足</span>自動で作成した仕訳は日記帳に「自動」の印が付き、通常の仕訳と同じように訂正・削除できます。</div>
          </div>
        </div>
      )}
    </SettingsShell>
  );
}
