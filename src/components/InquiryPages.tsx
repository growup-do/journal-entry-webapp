// 照会画面（ヘッダー右側の「照会」から開く）：元帳１／元帳２／残高照合
//   他の帳票画面と同じ1画面構成。元帳１と元帳２は別々の条件を保持する（key で分離）。
//   元帳は科目のほか、相手勘定科目・補助科目・税区分・摘要でも絞り込める。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { AssistField } from './AssistField';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { LABEL, NUM, ReportShell, TD, TH, yen } from './ReportShell';
import { NOT_IMPL, ToastView, useToast } from './Toast';
import { BALANCE_ACCOUNTS, JOURNAL_ROWS, type JournalRow } from '../data';
import { useAssist } from '../hooks/useAssist';
import type { MonthFilter } from '../types';

const CARRY = 5_000_000;

/* ---- 税区分・補助科目（サンプルデータには持たせていないので、科目・摘要から機械的に付与） ---- */
export const TAX_OPTIONS = ['課税仕入 10%', '課税仕入 8%（軽減）', '非課税', '不課税', '対象外'];
const TAX_RULES: [RegExp, string][] = [
  [/健康保険|厚生年金|法定福利|給料|賞与|退職|預り金|租税公課|保険料/, '非課税'],
  [/補助金|寄附|措置費|委託費|収入|収益|借入|未払|未収|前払|立替|仮払|仮受/, '不課税'],
  [/給食|食材/, '課税仕入 8%（軽減）'],
  [/材料|消耗|手数料|水道光熱|修繕|通信|旅費|印刷|リース|賃借|研修|図書|広告|燃料|車両|雑費|事務|器具|備品|保守|清掃|委託/, '課税仕入 10%'],
];
export const taxOf = (r: JournalRow) => {
  for (const acc of [r.kari, r.kashi]) {
    const hit = TAX_RULES.find(([re]) => re.test(acc));
    if (hit) return hit[1];
  }
  return /預金|現金/.test(r.kari) && /預金|現金/.test(r.kashi) ? '不課税' : '対象外';
};
const SUB_RULES: [RegExp, string][] = [
  [/健康保険/, '健康保険'], [/厚生年金/, '厚生年金'], [/雇用保険|労災/, '労働保険'],
  [/水道/, '水道'], [/電気/, '電気'], [/ガス/, 'ガス'],
  [/振込手数料/, '振込手数料'], [/夏祭り|行事/, '行事'], [/給食|食材/, '給食'],
  [/コピー|用紙|文具/, '事務用品'], [/ガソリン|燃料/, '燃料'], [/電話|インターネット|通信/, '通信'],
];
export const subOf = (r: JournalRow) => SUB_RULES.find(([re]) => re.test(r.tekiyo + r.kari))?.[1] ?? '';

interface LedgerProps {
  slot: 'ledger1' | 'ledger2';
  variant: 'form' | 'sheet';
  accent: string;
  accentRgb: string;
  onNavigate: (label: string) => void;
}

interface Cond {
  other: string;
  sub: string;
  tax: string;
  tekiyo: string;
}
const EMPTY: Cond = { other: '', sub: '', tax: '', tekiyo: '' };

export function LedgerInquiryPage({ slot, variant, accent, accentRgb, onNavigate }: LedgerProps) {
  const [account, setAccount] = useState(slot === 'ledger1' ? '普通預金（保育園）' : '');
  const [month, setMonth] = useState<MonthFilter>('8');
  const [cond, setCond] = useState<Cond>(EMPTY);
  const [applied, setApplied] = useState<Cond>(EMPTY);
  const assist = useAssist();
  const title = slot === 'ledger1' ? '元帳１' : '元帳２';

  const subOptions = Array.from(new Set(JOURNAL_ROWS.map(subOf).filter(Boolean)));
  const rows = JOURNAL_ROWS.filter((r) => {
    if (month != null && r.date.split('/')[0] !== month) return false;
    if (account && r.kari !== account && r.kashi !== account) return false;
    if (applied.other) {
      const other = account ? (r.kari === account ? r.kashi : r.kari) : '';
      if (account ? other !== applied.other : r.kari !== applied.other && r.kashi !== applied.other) return false;
    }
    if (applied.sub && subOf(r) !== applied.sub) return false;
    if (applied.tax && taxOf(r) !== applied.tax) return false;
    if (applied.tekiyo && !r.tekiyo.includes(applied.tekiyo)) return false;
    return true;
  });
  let bal = CARRY;
  const lines = rows.map((r) => {
    const d = account ? (r.kari === account ? r.amount : 0) : r.amount;
    const c = account ? (r.kashi === account ? r.amount : 0) : 0;
    bal += d - c;
    return { r, d, c, bal, other: account ? (r.kari === account ? r.kashi : r.kari) : `${r.kari} ／ ${r.kashi}`, tax: taxOf(r), sub: subOf(r) };
  });
  const sumD = lines.reduce((a, l) => a + l.d, 0);
  const sumC = lines.reduce((a, l) => a + l.c, 0);
  const isFiltered = applied.other || applied.sub || applied.tax || applied.tekiyo;
  const dirty = JSON.stringify(cond) !== JSON.stringify(applied);

  const fieldBtn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: 240, boxSizing: 'border-box', padding: '7px 10px', background: '#fff', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', color: 'inherit' };
  const input: CSSProperties = { padding: '7px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#22303c', boxSizing: 'border-box' };
  const btn = (primary?: boolean): CSSProperties => ({ padding: '7px 14px', border: '1px solid ' + (primary ? accent : '#cfd8e0'), borderRadius: 8, background: primary ? accent : '#fff', color: primary ? '#fff' : '#5b6773', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' });
  const field = (label: string, node: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={LABEL}>{label}</span>
      {node}
    </div>
  );
  const assistField = (id: string, value: string, placeholder: string, onPick: (v: string) => void) => (
    <AssistField
      value={value}
      placeholder={placeholder}
      open={assist.isOpen(id)}
      onOpen={() => assist.open(id, 'account')}
      accent={accent}
      accentRgb={accentRgb}
      buttonStyle={fieldBtn}
      panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 260, zIndex: 60 }}
      groups={assist.groups}
      query={assist.query}
      empty={assist.empty}
      onInput={assist.setQuery}
      onPick={(v) => {
        onPick(v === '（なし）' ? '' : v);
        assist.close();
      }}
    />
  );

  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title={title}
      subtitle="科目を指定して仕訳と残高を照会します。相手勘定科目・補助科目・税区分・摘要でさらに絞り込めます。元帳１と元帳２は別々の条件を保持します。"
      tools={[{ label: '科目', onClick: () => assist.open('acc', 'account'), primary: true }, { label: '印刷' }, { label: 'Excel' }]}
      onBack={() => onNavigate('伝票入力')}
      controls={
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={LABEL}>会計月</span>
            <FiscalMonthTabs current={month} accent={accent} onSelect={setMonth} withAll />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {[['借方計', yen(sumD)], ['貸方計', yen(sumC)], ...(account ? [['残高', yen(bal)]] : [])].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', border: '1px solid #e2e8ee', borderRadius: 8, background: '#fbfcfd' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8290a0' }}>{l}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            {field('指定科目', assistField('acc', account, '<<科目未選択>>', setAccount))}
            <span style={{ fontSize: 12, color: '#7a8794', paddingBottom: 9 }}>未選択の場合は全科目の仕訳を一覧します（残高は計算しません）。</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', padding: '10px 12px', background: '#f8fafc', border: '1px solid #e8edf2', borderRadius: 10 }}>
            <span style={{ ...LABEL, alignSelf: 'center', marginRight: 2 }}>絞り込み</span>
            {field('相手勘定科目', assistField('other', cond.other, '指定なし', (v) => setCond((c) => ({ ...c, other: v }))))}
            {field('補助科目', (
              <select value={cond.sub} onChange={(e) => setCond((c) => ({ ...c, sub: e.target.value }))} style={{ ...input, width: 160, cursor: 'pointer' }}>
                <option value="">指定なし</option>
                {subOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ))}
            {field('税区分', (
              <select value={cond.tax} onChange={(e) => setCond((c) => ({ ...c, tax: e.target.value }))} style={{ ...input, width: 170, cursor: 'pointer' }}>
                <option value="">指定なし</option>
                {TAX_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            ))}
            {field('摘要', (
              <input
                value={cond.tekiyo}
                placeholder="部分一致"
                onChange={(e) => setCond((c) => ({ ...c, tekiyo: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) setApplied({ ...cond });
                }}
                style={{ ...input, width: 200 }}
              />
            ))}
            <button type="button" className="btn-outline" data-menu="元帳検索" onClick={() => setApplied({ ...cond })} style={{ ...btn(true), opacity: dirty ? 1 : 0.85 }}>検索</button>
            <button type="button" className="btn-outline" data-menu="元帳クリア" onClick={() => { setCond(EMPTY); setApplied(EMPTY); }} style={btn()}>クリア</button>
            {isFiltered && <span style={{ fontSize: 12, color: accent, fontWeight: 700, paddingBottom: 9 }}>絞り込み中：{lines.length} 件</span>}
          </div>
        </>
      }
    >
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 430px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: 64 }}>月日</th>
              <th style={{ ...TH, width: 60 }}>Seq</th>
              <th style={TH}>{account ? '相手勘定科目 ／ 摘要' : '借方科目 ／ 貸方科目 ／ 摘要'}</th>
              <th style={{ ...TH, width: 110 }}>補助科目</th>
              <th style={{ ...TH, width: 130 }}>税区分</th>
              <th style={{ ...TH, width: 120, textAlign: 'right' }}>借方</th>
              <th style={{ ...TH, width: 120, textAlign: 'right' }}>貸方</th>
              {account && <th style={{ ...TH, width: 130, textAlign: 'right' }}>残高</th>}
            </tr>
          </thead>
          <tbody>
            {account && (
              <tr style={{ background: '#f8fafc' }}>
                <td style={TD} colSpan={5}><span style={{ color: '#7a8794', fontWeight: 700 }}>繰越金額</span></td>
                <td style={NUM} /><td style={NUM} />
                <td style={{ ...NUM, fontWeight: 700 }}>{yen(CARRY)}</td>
              </tr>
            )}
            {lines.length === 0 && <tr><td colSpan={8} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 40 }}>条件に該当する仕訳はありません。</td></tr>}
            {lines.map((l, i) => (
              <tr key={i}>
                <td style={TD}>{l.r.date}</td>
                <td style={TD}>{l.r.seq}</td>
                <td style={TD}>
                  <div style={{ fontWeight: 500 }}>{l.other}</div>
                  <div style={{ fontSize: 11.5, color: '#7a8794' }}>{l.r.tekiyo}</div>
                </td>
                <td style={{ ...TD, color: l.sub ? '#22303c' : '#b8c2cc' }}>{l.sub || '—'}</td>
                <td style={TD}><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: l.tax.startsWith('課税') ? '#e8f0fb' : l.tax === '非課税' ? '#eaf5ef' : '#f1f4f6', color: l.tax.startsWith('課税') ? '#2c5f9e' : l.tax === '非課税' ? '#1f7a52' : '#7a8794' }}>{l.tax}</span></td>
                <td style={NUM}>{l.d ? yen(l.d) : ''}</td>
                <td style={NUM}>{l.c ? yen(l.c) : ''}</td>
                {account && <td style={{ ...NUM, fontWeight: 700 }}>{yen(l.bal)}</td>}
              </tr>
            ))}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f6f8fa' }}>
                <td style={{ ...TD, fontWeight: 700 }} colSpan={5}>{month == null ? '合計' : '月計'}</td>
                <td style={{ ...NUM, fontWeight: 700 }}>{yen(sumD)}</td>
                <td style={{ ...NUM, fontWeight: 700 }}>{yen(sumC)}</td>
                {account && <td style={{ ...NUM, fontWeight: 700 }}>{yen(bal)}</td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </ReportShell>
  );
}

/* ---- 残高照合：現預金科目ごとに通帳残高とシステム残高を突合 ---- */
export function BalanceCheckPage({ variant, accent, onNavigate }: { variant: 'form' | 'sheet'; accent: string; onNavigate: (label: string) => void }) {
  const [book, setBook] = useState<number[]>(() => BALANCE_ACCOUNTS.map(() => 0));
  const [editing, setEditing] = useState(false);
  const toast = useToast();
  const set = (i: number, v: string) => setBook((b) => b.map((x, k) => (k === i ? parseInt(v.replace(/[^0-9]/g, ''), 10) || 0 : x)));
  const ngCount = BALANCE_ACCOUNTS.filter((a, i) => book[i] !== a.system).length;
  const sumBook = book.reduce((a, b) => a + b, 0);
  const sumSys = BALANCE_ACCOUNTS.reduce((a, b) => a + b.system, 0);
  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title="残高照合"
      subtitle="現預金科目ごとに、通帳（実残高）とシステム残高を突合して OK／NG を表示します。"
      tools={[{ label: editing ? '設定を終了' : '通帳残高の設定', onClick: () => setEditing((e) => !e), primary: true }, { label: '印刷', onClick: () => toast.show(NOT_IMPL) }]}
      onBack={() => onNavigate('伝票入力')}
      controls={
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={LABEL}>照合日</span>
          <span style={{ fontSize: 12.5 }}>令和8年 8月31日 時点</span>
          <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: ngCount ? '#fdeee9' : '#eaf5ef', color: ngCount ? '#c0392b' : '#1f7a52' }}>{ngCount ? `不一致 ${ngCount} 件` : 'すべて一致'}</span>
        </div>
      }
    >
      <ToastView msg={toast.msg} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={TH}>現預金科目</th>
            <th style={{ ...TH, width: 70 }}>判定</th>
            <th style={{ ...TH, width: 180, textAlign: 'right' }}>通帳残高</th>
            <th style={{ ...TH, width: 180, textAlign: 'right' }}>システム残高</th>
            <th style={{ ...TH, width: 160, textAlign: 'right' }}>差額</th>
          </tr>
        </thead>
        <tbody>
          {BALANCE_ACCOUNTS.map((a, i) => {
            const ok = book[i] === a.system;
            const diff = book[i] - a.system;
            return (
              <tr key={a.name} style={{ background: ok ? 'transparent' : '#fff7f5' }}>
                <td style={{ ...TD, fontWeight: 500 }}>{a.name}</td>
                <td style={TD}><span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 7px', borderRadius: 6, background: ok ? '#e8f0fb' : '#c0392b', color: ok ? '#2c5f9e' : '#fff' }}>{ok ? 'OK' : 'NG'}</span></td>
                <td style={NUM}>
                  {editing ? (
                    <input className="field-input" value={yen(book[i])} onChange={(e) => set(i, e.target.value)} inputMode="numeric" style={{ width: 150, boxSizing: 'border-box', textAlign: 'right', padding: '5px 8px', border: '1px solid #cfd8e0', borderRadius: 6, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
                  ) : (
                    yen(book[i])
                  )}
                </td>
                <td style={NUM}>{yen(a.system)}</td>
                <td style={{ ...NUM, fontWeight: 700, color: ok ? '#22303c' : '#c0392b' }}>{diff < 0 ? '-' : ''}{yen(Math.abs(diff))}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f6f8fa' }}>
            <td style={{ ...TD, fontWeight: 700 }} colSpan={2}>合計</td>
            <td style={{ ...NUM, fontWeight: 700 }}>{yen(sumBook)}</td>
            <td style={{ ...NUM, fontWeight: 700 }}>{yen(sumSys)}</td>
            <td style={{ ...NUM, fontWeight: 700, color: sumBook === sumSys ? '#22303c' : '#c0392b' }}>{sumBook - sumSys < 0 ? '-' : ''}{yen(Math.abs(sumBook - sumSys))}</td>
          </tr>
        </tfoot>
      </table>
      <div style={{ padding: '12px 22px', fontSize: 11.5, color: '#9aa5b1', lineHeight: 1.6, borderTop: '1px solid #eef2f5' }}>「通帳残高の設定」で通帳の残高を入力すると、システム残高と突合して OK／NG と差額を表示します。</div>
    </ReportShell>
  );
}
