// 元帳（勘定元帳／資金元帳／業者元帳の共通部品）
//   指定科目（または業者）を選ぶと、該当する仕訳を日付順に並べ、繰越金額からの残高を計算して表示。
//   付箋（赤青黄緑）・チェック・表示オプションは既存どおりのチェックボックス（プロトタイプでは絞り込みのみ動作）。

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { AssistField } from './AssistField';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { CHECK, LABEL, NUM, ReportShell, TD, TH, yen } from './ReportShell';
import { EditVoucherModal, FlagCell } from './VoucherEdit';
import { FUSEN_COLORS, useVouchers, type Voucher } from '../store/journalStore';
import { getSession, setSession } from '../store/session';
import { useAssist } from '../hooks/useAssist';
import type { MonthFilter } from '../types';

export type LedgerKind = 'account' | 'fund' | 'vendor';
const TITLE: Record<LedgerKind, string> = { account: '勘定元帳', fund: '資金元帳', vendor: '業者元帳' };
const CARRY = 1_000_000;

interface Props {
  kind: LedgerKind;
  variant: 'form' | 'sheet';
  accent: string;
  accentRgb: string;
  onNavigate: (label: string) => void;
}

export function LedgerPage({ kind, variant, accent, accentRgb, onNavigate }: Props) {
  // 推移・試算表からのドリルダウン（科目・月を引き継ぐ）
  const [boot] = useState(() => getSession().ledgerTarget);
  useEffect(() => { if (boot) setSession({ ledgerTarget: null }); }, [boot]);
  const [month, setMonth] = useState<MonthFilter>(boot?.month ?? '8');
  const [target, setTarget] = useState(boot?.account ?? (kind === 'vendor' ? '中央リース' : '普通預金（保育園）'));
  const all = useVouchers();
  const [edit, setEdit] = useState<Voucher | null>(null);
  const [opts, setOpts] = useState({ check: false, red: false, blue: false, yellow: false, green: false, daily: true, spare: true, internal: false });
  const assist = useAssist();
  const isVendor = kind === 'vendor';

  const rows = all.filter((r) => (month == null || r.date.split('/')[0] === month) && (isVendor ? r.gyosha === target : r.kari === target || r.kashi === target) && (!opts.check || r.check) && (!(opts.red || opts.blue || opts.yellow || opts.green) || (opts.red && r.fusen === '赤') || (opts.blue && r.fusen === '青') || (opts.yellow && r.fusen === '黄') || (opts.green && r.fusen === '緑')));
  let bal = CARRY;
  const lines = rows.map((r) => {
    const debit = isVendor ? r.amount : r.kari === target ? r.amount : 0;
    const credit = isVendor ? 0 : r.kashi === target ? r.amount : 0;
    bal += debit - credit;
    return { r, debit, credit, bal, other: r.kari === target ? r.kashi : r.kari };
  });
  const sumD = lines.reduce((a, l) => a + l.debit, 0);
  const sumC = lines.reduce((a, l) => a + l.credit, 0);
  const m = month ?? '8';
  const toggle = (k: keyof typeof opts) => setOpts((o) => ({ ...o, [k]: !o[k] }));

  const fieldBtn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: 260, boxSizing: 'border-box', padding: '7px 10px', background: '#fff', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', color: 'inherit' };
  const stat = (label: string, value: string, hi?: boolean): CSSProperties & { label: string; value: string; hi?: boolean } => ({ label, value, hi });
  const stats = kind === 'account'
    ? [stat('実績', yen(sumD - sumC))]
    : [stat('予算', yen(3_000_000)), stat('実績', yen(sumD - sumC)), stat('残高', yen(3_000_000 - (sumD - sumC))), stat('達成率', ((sumD - sumC) / 3_000_000 * 100).toFixed(1) + '%', true)];

  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title={TITLE[kind]}
      subtitle={isVendor ? '指定した業者の取引を日付順に表示します。行をクリックすると伝票を訂正できます。' : '指定した科目の仕訳を日付順に表示し、残高を計算します。行をクリックすると伝票を訂正できます。'}
      tools={isVendor ? [{ label: '業者', onClick: () => assist.open('target', 'vendor'), primary: true }, { label: '部門色' }, { label: '部門' }, { label: '摘要' }, { label: '計算' }] : [{ label: '科目', onClick: () => assist.open('target', 'account'), primary: true }, { label: '色' }, { label: '区分色' }, { label: '区分' }, { label: '摘要' }, { label: '業者' }, { label: '計算' }]}
      onBack={() => onNavigate('伝票入力')}
      controls={
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={LABEL}>会計月</span>
            <FiscalMonthTabs current={month} accent={accent} onSelect={setMonth} />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {stats.map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', border: '1px solid #e2e8ee', borderRadius: 8, background: s.hi ? '#fff8d6' : '#fbfcfd' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8290a0' }}>{s.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12.5, color: '#48565f' }}>
            <span style={LABEL}>{isVendor ? '指定業者' : kind === 'fund' ? '指定科目（費目－区分コード）' : '指定科目'}</span>
            <AssistField
              value={target}
              placeholder={isVendor ? '業者を選択' : '科目を選択'}
              open={assist.isOpen('target')}
              onOpen={() => assist.open('target', isVendor ? 'vendor' : 'account')}
              accent={accent}
              accentRgb={accentRgb}
              buttonStyle={fieldBtn}
              panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 260, zIndex: 60 }}
              groups={assist.groups}
              query={assist.query}
              empty={assist.empty}
              onInput={assist.setQuery}
              onPick={(v) => {
                setTarget(v === '（なし）' ? '' : v);
                assist.close();
              }}
            />
            <span style={LABEL}>指定年月日</span>
            <span>令和8年 {m}月1日 〜 令和8年 {m}月末日</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <label style={CHECK}><input type="checkbox" checked={opts.check} onChange={() => toggle('check')} />チェック</label>
            <span style={{ ...LABEL, marginLeft: 4 }}>付箋</span>
            {([['red', '赤', '#c0392b'], ['blue', '青', '#2c5f9e'], ['yellow', '黄', '#b7791f'], ['green', '緑', '#1f7a52']] as const).map(([k, l, c]) => (
              <label key={k} style={{ ...CHECK, color: c }}><input type="checkbox" checked={opts[k]} onChange={() => toggle(k)} />{l}</label>
            ))}
            <label style={{ ...CHECK, marginLeft: 8 }}><input type="checkbox" checked={opts.daily} onChange={() => toggle('daily')} />残高を日計で表示する</label>
            {!isVendor && <label style={CHECK}><input type="checkbox" checked={opts.spare} onChange={() => toggle('spare')} />入力予備１，２を表示する</label>}
            {!isVendor && <label style={CHECK}><input type="checkbox" checked={opts.internal} onChange={() => toggle('internal')} />内部取引のみを表示する</label>}
          </div>
        </>
      }
    >
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: 70 }}>月日</th>
              <th style={{ ...TH, width: 84 }}>証・チ・付</th>
              <th style={{ ...TH, width: 60 }}>Seq-No</th>
              <th style={TH}>{isVendor ? '借方 ― 貸方 ／ 摘要' : '相手科目 ／ 摘要'}</th>
              <th style={{ ...TH, width: 130, textAlign: 'right' }}>{isVendor ? '金額' : '借方'}</th>
              {!isVendor && <th style={{ ...TH, width: 130, textAlign: 'right' }}>貸方</th>}
              <th style={{ ...TH, width: 140, textAlign: 'right' }}>残高</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: '#f8fafc' }}>
              <td style={TD} colSpan={isVendor ? 4 : 4}><span style={{ color: '#7a8794', fontWeight: 700 }}>繰越金額</span></td>
              <td style={NUM} />
              {!isVendor && <td style={NUM} />}
              <td style={{ ...NUM, fontWeight: 700 }}>{yen(CARRY)}</td>
            </tr>
            {!target && <tr><td colSpan={7} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 40 }}>{isVendor ? '業者' : '科目'}を指定してください。</td></tr>}
            {target && lines.length === 0 && <tr><td colSpan={7} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 40 }}>この月に該当する仕訳はありません。</td></tr>}
            {lines.map((l, i) => (
              <tr key={i} onClick={() => setEdit(l.r)} title="クリックで伝票を訂正" style={{ cursor: 'pointer', background: l.r.fusen ? FUSEN_COLORS[l.r.fusen] + '14' : 'transparent' }}>
                <td style={TD}>{l.r.date}</td>
                <td style={TD}><FlagCell v={l.r} compact /></td>
                <td style={TD}>{l.r.seq}</td>
                <td style={TD}>
                  <div style={{ fontWeight: 500 }}>{isVendor ? `${l.r.kari} ― ${l.r.kashi}` : l.other}</div>
                  <div style={{ fontSize: 11.5, color: '#7a8794' }}>{l.r.tekiyo}</div>
                </td>
                <td style={NUM}>{l.debit ? yen(l.debit) : ''}</td>
                {!isVendor && <td style={NUM}>{l.credit ? yen(l.credit) : ''}</td>}
                <td style={{ ...NUM, fontWeight: 700 }}>{yen(l.bal)}</td>
              </tr>
            ))}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f6f8fa' }}>
                <td style={{ ...TD, fontWeight: 700 }} colSpan={4}>月計</td>
                <td style={{ ...NUM, fontWeight: 700 }}>{yen(sumD)}</td>
                {!isVendor && <td style={{ ...NUM, fontWeight: 700 }}>{yen(sumC)}</td>}
                <td style={{ ...NUM, fontWeight: 700 }}>{yen(bal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <EditVoucherModal voucher={edit} onClose={() => setEdit(null)} accent={accent} returnTo={TITLE[kind]} />
    </ReportShell>
  );
}
