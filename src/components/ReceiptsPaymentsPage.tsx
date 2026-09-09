// オプション：収入・支出調書 印刷（既存「AccUkagai」の再現）
//   7種の伺（支出伺／収入伺／支出伺(振替)／支払伺／受入伺／他の伺／他の伺2）をタブで切替。
//   会計月の仕訳を抽出条件で絞り込み、対象にチェックした伝票を Excel 出力（出力済みに変わる）。
//   詳細設定（対象科目・決裁印影・タイトル／メッセージ）、未出力数（月別の集計）。

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { Modal } from './Modal';
import { LABEL, NUM, ReportShell, TD, TH, yen } from './ReportShell';
import { NOT_IMPL, ToastView, useToast } from './Toast';
import { JOURNAL_COUNTS, JOURNAL_ROWS, type JournalRow } from '../data';
import type { MonthFilter } from '../types';

const OPTION = '#b45309';
const isCash = (a: string) => /預金|現金/.test(a);
const isDeposit = (a: string) => /健康保険|厚生年金|所得税|住民税|預り金/.test(a);
const isPL = (a: string) => !isCash(a) && !isDeposit(a);

interface Kind { key: string; label: string; rule: string; filter: (r: JournalRow) => boolean }
const KINDS: Kind[] = [
  { key: 'exp', label: '支出伺', rule: '伝票タイプ ○ 単一・伝票・振単　× 振替\n資金 支出科目 を含む仕訳のみ', filter: (r) => r.kind !== '振替' && isCash(r.kashi) && isPL(r.kari) },
  { key: 'inc', label: '収入伺', rule: '伝票タイプ ○ 単一・伝票・振単　× 振替\n資金 収入科目 を含む仕訳のみ', filter: (r) => r.kind !== '振替' && isCash(r.kari) && isPL(r.kashi) },
  { key: 'expT', label: '支出伺（振替）', rule: '伝票タイプ ○ 振替　× 単一・伝票・振単\n資金 事業活動支出 を含む仕訳のみ', filter: (r) => r.kind === '振替' && isPL(r.kari) },
  { key: 'pay', label: '支払伺', rule: '伝票タイプ ○ 単一・伝票・振単　× 振替\n貸方が現預金科目 かつ 資金科目 を含まない仕訳のみ', filter: (r) => r.kind !== '振替' && isCash(r.kashi) && !isPL(r.kari) },
  { key: 'recv', label: '受入伺', rule: '伝票タイプ ○ 単一・伝票・振単　× 振替\n借方が現預金科目 かつ 資金科目 を含まない仕訳のみ', filter: (r) => r.kind !== '振替' && isCash(r.kari) && !isPL(r.kashi) },
  { key: 'other', label: '他の伺', rule: '伝票タイプ ○ 単一・伝票・振単・振替\n資金科目・現預金科目 を含まない仕訳のみ', filter: (r) => !isCash(r.kari) && !isCash(r.kashi) && !isPL(r.kari) && !isPL(r.kashi) },
  { key: 'other2', label: '他の伺２', rule: '伝票タイプ ○ 全て', filter: () => true },
];
const TITLES: Record<string, { title: string; msg: string }> = {
  exp: { title: '支　出　伺', msg: '上記の金額を支出してよろしいか伺います。' },
  inc: { title: '収　入　伺', msg: '上記金額の収入を伺います。' },
  expT: { title: '支　出　伺', msg: '上記の金額を支出してよろしいか伺います。' },
  pay: { title: '支　払　伺', msg: '上記金額の支払を伺います。' },
  recv: { title: '受　入　伺', msg: '上記金額の受入を伺います。' },
  other: { title: '他　の　伺', msg: '上記金額を伺います。' },
  other2: { title: '他　の　伺', msg: '上記金額を伺います。' },
};
const SUBJECT_TREE: { name: string; level: number }[] = [
  { name: '人件費支出', level: 0 }, { name: '役員報酬支出', level: 1 }, { name: '役員退職慰労金支出', level: 1 }, { name: '職員給料支出', level: 1 }, { name: '職員俸給', level: 2 }, { name: '管理職手当', level: 2 }, { name: '特殊業務手当', level: 2 }, { name: '扶養手当', level: 2 }, { name: '住居手当', level: 2 }, { name: '時間外手当', level: 2 }, { name: '通勤手当', level: 2 }, { name: 'その他手当', level: 2 },
  { name: '事業費支出', level: 0 }, { name: '給食費支出', level: 1 }, { name: '保育材料費支出', level: 1 }, { name: '水道光熱費支出', level: 1 }, { name: '事務費支出', level: 0 }, { name: '通信運搬費支出', level: 1 }, { name: '賃借料支出', level: 1 },
];

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
}

export function ReceiptsPaymentsPage({ variant, accent }: Props) {
  const [kind, setKind] = useState('exp');
  const [month, setMonth] = useState<MonthFilter>('8');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [exported, setExported] = useState<Set<string>>(new Set());
  const [detailOpen, setDetailOpen] = useState(false);
  const [countOpen, setCountOpen] = useState(false);
  const [subjects, setSubjects] = useState<Set<string>>(new Set());
  const [signers, setSigners] = useState(['会計責任者', '出納責任者', '担 当 者']);
  const [titles, setTitles] = useState(TITLES);
  const toast = useToast();
  const k = KINDS.find((x) => x.key === kind)!;
  const rowKey = (r: JournalRow) => `${r.no}:${r.kari}:${r.amount}`;
  const rows = useMemo(() => JOURNAL_ROWS.filter((r) => (month == null || r.date.split('/')[0] === month) && k.filter(r)), [month, k]);
  // 初期状態は全て対象
  const isOn = (r: JournalRow) => !checked.has('off:' + rowKey(r));
  const toggle = (r: JournalRow) => setChecked((s) => { const n = new Set(s); const key = 'off:' + rowKey(r); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const setAll = (on: boolean) => setChecked((s) => { const n = new Set(s); rows.forEach((r) => (on ? n.delete('off:' + rowKey(r)) : n.add('off:' + rowKey(r)))); return n; });
  const doExport = () => {
    const targets = rows.filter(isOn);
    if (targets.length === 0) return toast.show('対象の伝票がありません');
    setExported((s) => { const n = new Set(s); targets.forEach((r) => n.add(rowKey(r))); return n; });
    toast.show(`${k.label} ${targets.length} 件を Excel 出力しました（プロトタイプ：ファイルは作成されません）`);
  };

  const btn = (primary?: boolean): CSSProperties => ({ padding: '8px 16px', borderRadius: 8, border: primary ? 'none' : '1px solid #cfd8e0', background: primary ? accent : '#fff', color: primary ? '#fff' : '#5b6773', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid #cfd8e0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none' };
  const badge = <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: OPTION, borderRadius: 5, padding: '2px 6px', verticalAlign: 'middle', marginLeft: 6 }}>オプション</span>;

  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title="収入・支出調書 印刷"
      badge={badge}
      subtitle="伺書（支出伺・収入伺など）を出力する伝票を選び、Excelへ出力します。"
      tools={[{ label: '詳細設定', onClick: () => setDetailOpen(true) }, { label: '未出力数', onClick: () => setCountOpen(true) }, { label: 'Excel出力', onClick: doExport, primary: true }]}
      controls={
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {KINDS.map((x) => (
              <button key={x.key} type="button" className="chip" onClick={() => setKind(x.key)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid ' + (kind === x.key ? '#e8791e' : '#e0c9b8'), background: kind === x.key ? '#e8791e' : '#f6e7dd', color: kind === x.key ? '#fff' : '#8a5a3a', fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '.04em' }}>{x.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={LABEL}>会計月</span>
              <FiscalMonthTabs current={month} accent={accent} onSelect={setMonth} withAll />
            </div>
            <div style={{ marginLeft: 'auto', padding: '8px 12px', background: '#fffbe6', border: '1px solid #f3e4a6', borderRadius: 8, fontSize: 12, color: '#0a7d6b', whiteSpace: 'pre-line', lineHeight: 1.5 }}>{k.rule}</div>
          </div>
        </>
      }
    >
      <ToastView msg={toast.msg} />
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 420px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f79b2e' }}>
              {['対象', 'SeqNo／出力', '日', '伝票', '借方 ― 貸方 ／ 摘要', '金額'].map((h, i) => <th key={h} style={{ ...TH, background: '#f79b2e', color: '#fff', textAlign: i === 5 ? 'right' : 'left', width: i === 0 ? 50 : i === 1 ? 110 : i === 2 ? 70 : i === 3 ? 70 : i === 5 ? 130 : undefined }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 40 }}>この条件に該当する伝票はありません。</td></tr>}
            {rows.map((r) => {
              const on = isOn(r);
              const done = exported.has(rowKey(r));
              return (
                <tr key={rowKey(r)} style={{ background: done ? '#f1f4f6' : on ? '#f0faf3' : 'transparent' }}>
                  <td style={{ ...TD, textAlign: 'center' }}><input type="checkbox" checked={on} onChange={() => toggle(r)} /></td>
                  <td style={TD}><div style={{ fontWeight: 700 }}>{r.seq}</div><div style={{ fontSize: 11, color: done ? '#1f7a52' : '#9aa5b1', fontWeight: done ? 700 : 500 }}>{done ? '出力済' : '未出力'}</div></td>
                  <td style={TD}><div style={{ fontSize: 11, color: '#9aa5b1' }}>{r.kind}</div><div>{r.date}</div></td>
                  <td style={TD}>{r.no}</td>
                  <td style={TD}><div style={{ display: 'flex', gap: 12 }}><span style={{ fontWeight: 500, minWidth: 180 }}>{r.kari}</span><span style={{ color: '#48565f' }}>{r.kashi}</span></div><div style={{ fontSize: 11.5, color: '#7a8794' }}>{r.tekiyo}</div></td>
                  <td style={{ ...NUM, fontWeight: 700 }}>{yen(r.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 22px 16px', borderTop: '1px solid #eef2f5' }}>
        <button type="button" className="btn-outline" onClick={() => setAll(true)} style={btn()}>全てON</button>
        <button type="button" className="btn-outline" onClick={() => setAll(false)} style={btn()}>全てOFF</button>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: '#7a8794', alignSelf: 'center' }}>対象 <b style={{ color: '#22303c' }}>{rows.filter(isOn).length}</b> ／ {rows.length} 件</span>
      </div>

      {/* 詳細設定 */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} width={1000} title="詳細設定">
        <div style={{ padding: '14px 22px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>支出伺（振替伝票）対象科目</div>
              <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: 240, overflow: 'auto', padding: 6 }}>
                {SUBJECT_TREE.map((s) => (
                  <label key={s.name + s.level} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', paddingLeft: 6 + s.level * 18, fontSize: 13, color: s.level === 0 ? '#7a8794' : '#22303c', cursor: 'pointer' }}>
                    <input type="checkbox" checked={subjects.has(s.name)} onChange={() => setSubjects((set) => { const n = new Set(set); n.has(s.name) ? n.delete(s.name) : n.add(s.name); return n; })} />{s.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>決裁　名称と印影の指定</div>
              <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['左', '中', '右'].map((pos, i) => (
                  <div key={pos} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 20, fontSize: 13 }}>{pos}</span>
                    <span style={{ width: 52, height: 52, border: '1px solid #cfd8e0', borderRadius: 6, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#c3ccd4' }}>印影</span>
                    <input className="field-input" value={signers[i]} onChange={(e) => setSigners(signers.map((s, k) => (k === i ? e.target.value : s)))} style={{ ...input, flex: 1 }} />
                    <button type="button" className="btn-outline" onClick={() => toast.show('印影登録：' + NOT_IMPL)} style={btn()}>印影登録</button>
                    <button type="button" className="btn-outline" onClick={() => toast.show('印影削除：' + NOT_IMPL)} style={btn()}>印影削除</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 18 }}>
            {KINDS.map((x) => (
              <div key={x.key} style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{x.label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 6, alignItems: 'center', fontSize: 12 }}>
                  <span>タイトル</span><input className="field-input" value={titles[x.key].title} onChange={(e) => setTitles({ ...titles, [x.key]: { ...titles[x.key], title: e.target.value } })} style={input} />
                  <span>メッセージ</span><input className="field-input" value={titles[x.key].msg} onChange={(e) => setTitles({ ...titles, [x.key]: { ...titles[x.key], msg: e.target.value } })} style={input} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn-outline" onClick={() => { setTitles(TITLES); setSigners(['会計責任者', '出納責任者', '担 当 者']); setSubjects(new Set()); }} style={{ ...btn(), marginRight: 'auto' }}>リセット</button>
            <button type="button" className="submit-btn" onClick={() => { setDetailOpen(false); toast.show('詳細設定を保存しました（プロトタイプ）'); }} style={btn(true)}>決定</button>
            <button type="button" onClick={() => setDetailOpen(false)} style={btn()}>中止</button>
          </div>
        </div>
      </Modal>

      {/* 未出力数 */}
      <Modal open={countOpen} onClose={() => setCountOpen(false)} width={520} title="未出力　仕訳数の確認">
        <div style={{ padding: '6px 20px 18px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={TH}>月</th><th style={{ ...TH, textAlign: 'right' }}>仕訳数 合計</th><th style={{ ...TH, textAlign: 'right' }}>未出力 仕訳数</th><th style={{ ...TH, textAlign: 'right' }}>出力済 仕訳数</th></tr></thead>
            <tbody>
              {JOURNAL_COUNTS.map((r) => {
                const out = r.month === '8月' ? exported.size : 0;
                return <tr key={r.month} style={{ color: r.c[0] === 0 ? '#9aa5b1' : undefined }}><td style={TD}>{r.month === '決算' ? '決算月' : r.month}</td><td style={NUM}>{r.c[0]}</td><td style={NUM}>{Math.max(0, r.c[0] - out)}</td><td style={NUM}>{out}</td></tr>;
              })}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}><button type="button" onClick={() => setCountOpen(false)} style={btn()}>閉じる</button></div>
        </div>
      </Modal>
    </ReportShell>
  );
}
