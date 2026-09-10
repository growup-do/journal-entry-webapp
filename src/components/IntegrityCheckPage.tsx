// 整合性チェック（提案K）：科目チェック／伝票チェック／帳票別 非使用科目チェック を1画面に集約（マニュアル 6.10.2）。
//   実行 → 進捗 → 結果（テキスト）。ファイル出力・コピー。

import { useState } from 'react';
import { ToastView, useToast } from './Toast';
import { Notice, SettingsShell, btn, card, cardHead } from './ui';

type Kind = '科目チェック' | '伝票チェック' | '帳票別 非使用科目チェック';
const DEFS: { kind: Kind; desc: string; result: string[]; ok: boolean }[] = [
  { kind: '科目チェック', desc: '現在の勘定科目マスターのデータとの整合性を診断します（費目・区分コードの重複、資金科目連動の欠落、キーコードの不整合）。', ok: true, result: ['科目チェック 2026/09/10 10:02', '対象：勘定科目 27・資金科目 15', '区分コードの重複：0 件', '資金科目の連動なし（費用・収益）：0 件', '印刷用科目名称 40文字超：0 件', '結果：異常なし'] },
  { kind: '伝票チェック', desc: '登録した伝票データとの整合性を診断します（存在しない科目キー、貸借不一致、日付の範囲外、資金科目の不整合）。', ok: false, result: ['伝票チェック 2026/09/10 10:03', '対象：令和8年度 伝票 208 件', '存在しない科目キー：0 件', '貸借合計の不一致（振替伝票）：0 件', '期間外の日付：1 件　Seq 16（8/19 委託費収益）… 伝票日付が集計期間と一致しません', '資金科目の不整合：0 件', '結果：要確認 1 件'] },
  { kind: '帳票別 非使用科目チェック', desc: '科目表示設定で「非表示」にした科目に対し、予算または実績の有無を診断します（法人の全区分・全印刷物が対象のため時間がかかる場合があります）。', ok: false, result: ['帳票別 非使用科目チェック 2026/09/10 10:05', '対象：全区分 5・帳票 27', '非表示科目に実績あり：2 件', '　005 地域支援／貸借対照表：立替金 12,000', '　003 子育て支援／事業活動計算書：印刷製本費 10,287', '非表示科目に予算あり：0 件', '結果：要確認 2 件'] },
];

export function IntegrityCheckPage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  const toast = useToast();
  const [running, setRunning] = useState<Kind | null>(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Partial<Record<Kind, string[]>>>({});
  const run = (k: Kind) => {
    if (running) return;
    setRunning(k); setProgress(0);
    const t0 = Date.now();
    const id = window.setInterval(() => {
      const p = Math.min(100, Math.round((Date.now() - t0) / (k === '帳票別 非使用科目チェック' ? 40 : 18)));
      setProgress(p);
      if (p >= 100) { window.clearInterval(id); setResults((r) => ({ ...r, [k]: DEFS.find((d) => d.kind === k)!.result })); setRunning(null); }
    }, 100);
  };
  const copy = (k: Kind) => { const t = (results[k] ?? []).join('\n'); navigator.clipboard?.writeText(t).then(() => toast.show('診断結果をコピーしました（メモ帳やExcelに貼り付けできます）')).catch(() => toast.show('コピーできませんでした')); };
  return (
    <SettingsShell variant={variant} title="整合性チェック" badge="保守" desc="科目・伝票・帳票の整合性を診断します。決算前や科目を変更した後に実行してください。結果はテキストとしてコピー／ファイル出力できます。">
      <ToastView msg={toast.msg} />
      <div style={{ padding: 22, display: 'grid', gap: 14 }}>
        <Notice>決算チェック（28項目）は「調査 › 決算調査」から。ここでは既存の「科目チェック」「伝票チェック」「帳票別 非使用科目チェック」をまとめています。</Notice>
        {DEFS.map((d) => {
          const res = results[d.kind];
          const busy = running === d.kind;
          return (
            <div key={d.kind} style={card}>
              <div style={cardHead}>
                {d.kind}
                {res && <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: d.ok ? '#eaf5ef' : '#fdeee9', color: d.ok ? '#1f7a52' : '#c0392b' }}>{d.ok ? '正常終了' : '要確認あり'}</span>}
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  {res && <button type="button" onClick={() => copy(d.kind)} style={btn('#5b6773', false, true)}>コピー</button>}
                  {res && <button type="button" onClick={() => toast.show('テキストファイルを出力しました（プロトタイプでは動作しません）')} style={btn('#5b6773', false, true)}>ファイル出力</button>}
                  <button type="button" className="submit-btn" disabled={!!running} onClick={() => run(d.kind)} style={{ ...btn(accent, true, true), opacity: running ? 0.5 : 1 }}>{busy ? 'チェック中…' : res ? '再実行' : '開始'}</button>
                </span>
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ fontSize: 12.5, color: '#5b6773', marginBottom: busy || res ? 10 : 0 }}>{d.desc}</div>
                {busy && <div style={{ height: 8, background: '#eef2f5', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${progress}%`, height: '100%', background: accent, transition: 'width .1s' }} /></div>}
                {res && <pre style={{ margin: 0, padding: 12, background: '#1e2630', color: '#d7dee6', borderRadius: 10, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace" }}>{res.join('\n')}</pre>}
              </div>
            </div>
          );
        })}
      </div>
    </SettingsShell>
  );
}
