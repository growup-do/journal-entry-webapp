// 勘定科目の付随情報（コード・フリガナ・貸借／損益の別・資金科目の対応）と、
// 仕訳の「取引区分」判定・資金科目の自動表示。サンプル用の簡易ルール。

import { ACCOUNTS } from '../data';

export interface AccountMeta { name: string; code: string; kana: string; kind: 'BS' | 'PL'; cls: '現預金' | '資産' | '負債' | '費用' | '収益'; fund: string }

const KANA: Record<string, string> = {
  現金: 'ゲンキン', '普通預金（保育園）': 'フツウヨキン', '当座預金（保育園）': 'トウザヨキン', 小口現金: 'コグチゲンキン',
  事業未収金: 'ジギョウミシュウキン', 未収金: 'ミシュウキン', 立替金: 'タテカエキン', 仮払金: 'カリバライキン',
  保育材料費: 'ホイクザイリョウヒ', 給食費: 'キュウショクヒ', '水道光熱費（事業）': 'スイドウコウネツヒ', 通信運搬費: 'ツウシンウンパンヒ', '賃借料（事業）': 'チンシャクリョウ', 印刷製本費: 'インサツセイホンヒ', 消耗品費: 'ショウモウヒンヒ',
  職員俸給: 'ショクインホウキュウ', 法定福利費: 'ホウテイフクリヒ', 特殊業務手当: 'トクシュギョウムテアテ', 扶養手当: 'フヨウテアテ', 時間外手当: 'ジカンガイテアテ', 通勤手当: 'ツウキンテアテ', その他手当: 'ソノタテアテ',
  委託費収益: 'イタクヒシュウエキ', その他の利用料収益: 'ソノタノリヨウリョウシュウエキ', '現金（収入）': 'ゲンキンシュウニュウ', 受託事業収益: 'ジュタクジギョウシュウエキ', 補助金収益: 'ホジョキンシュウエキ',
};

export const ACCOUNT_META: AccountMeta[] = (() => {
  const out: AccountMeta[] = [];
  const base: Record<string, number> = { 現金及び預金: 1100, 事業未収金: 1200, 事業費: 5200, 人件費: 5100, 事業収益: 4100 };
  ACCOUNTS.forEach((g) => {
    let code = base[g.group] ?? 9000;
    g.items.forEach((name) => {
      code += 10;
      const cls: AccountMeta['cls'] = g.group === '現金及び預金' || name === '現金（収入）' ? '現預金' : g.group === '事業未収金' ? '資産' : g.group === '事業収益' ? '収益' : '費用';
      const kind: AccountMeta['kind'] = cls === '費用' || cls === '収益' ? 'PL' : 'BS';
      const fund = cls === '費用' ? name.replace(/（.*）/, '') + '支出' : cls === '収益' ? name.replace(/収益$/, '収入').replace('補助金収入', '補助金事業収入') : cls === '現預金' ? '（支払資金）' : '—';
      out.push({ name, code: String(code), kana: KANA[name] ?? '', kind, cls, fund });
    });
  });
  return out;
})();
export const metaOf = (name: string) => ACCOUNT_META.find((m) => m.name === name);

/** ひらがな → カタカナ（フリガナ検索用） */
export const toKatakana = (s: string) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

/** 科目名・コード・フリガナのいずれかに一致するか */
export function accountMatches(name: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (name.includes(q)) return true;
  const m = metaOf(name);
  if (!m) return false;
  if (/^\d+$/.test(q)) return m.code.startsWith(q);
  return m.kana.startsWith(toKatakana(q));
}

export type Torihiki7 = '資金＋事業' | '資金のみ' | '事業のみ' | '移動なし' | '強制資金' | '要確認' | '内部取引';
export const TORIHIKI_COLOR: Record<Torihiki7, { bg: string; fg: string; note: string }> = {
  '資金＋事業': { bg: '#eaf5ef', fg: '#1f7a52', note: '資金収支と事業活動収支の両方に出る仕訳（通常の支出・収入）' },
  '資金のみ': { bg: '#e8f0fb', fg: '#2c5f9e', note: '資金収支にのみ出る仕訳（借入金の償還など）' },
  '事業のみ': { bg: '#fff1b8', fg: '#8a6d00', note: '事業活動収支にのみ出る仕訳（減価償却費など）' },
  移動なし: { bg: '#f1f4f6', fg: '#5b6773', note: '資金収支・事業活動収支のどちらにも出ない仕訳（預金間の振替など）' },
  強制資金: { bg: '#efe6fb', fg: '#6b3fb5', note: '強制資金の機能を使用中（資金収支への反映を手動で指定）' },
  要確認: { bg: '#fdeee9', fg: '#c0392b', note: '通常は入力しない組合せです。内容を確認してください（登録できません）' },
  内部取引: { bg: '#fbe9d0', fg: '#b45309', note: '内部取引科目を使用した伝票' },
};

/** 借方・貸方の科目から取引区分を判定（既存の7種の表示に相当） */
export function judgeTorihiki(kari: string, kashi: string, forceFund = false): { kind: Torihiki7; reason?: '費用間' | '収益間' | '誤伝票' } {
  if (!kari || !kashi) return { kind: '資金＋事業' };
  if (/区分間/.test(kari) || /区分間/.test(kashi)) return { kind: '内部取引' };
  if (forceFund) return { kind: '強制資金' };
  const a = metaOf(kari), b = metaOf(kashi);
  const ca = a?.cls ?? '費用', cb = b?.cls ?? '現預金';
  if (ca === '費用' && cb === '費用') return { kind: '要確認', reason: '費用間' };
  if (ca === '収益' && cb === '収益') return { kind: '要確認', reason: '収益間' };
  if (ca === '収益' && cb === '現預金') return { kind: '要確認', reason: '誤伝票' }; // 収益が借方
  if (ca === '現預金' && cb === '費用') return { kind: '要確認', reason: '誤伝票' }; // 費用が貸方
  const cashA = ca === '現預金', cashB = cb === '現預金';
  const plA = ca === '費用' || ca === '収益', plB = cb === '費用' || cb === '収益';
  if (cashA && cashB) return { kind: '移動なし' };
  if ((cashA && plB) || (plA && cashB)) return { kind: '資金＋事業' };
  if (cashA || cashB) return { kind: '資金のみ' };
  if (plA || plB) return { kind: '事業のみ' };
  return { kind: '移動なし' };
}

/** 仕訳に対応する資金収支計算書の科目（自動表示） */
export function fundAccountOf(kari: string, kashi: string): string {
  const a = metaOf(kari), b = metaOf(kashi);
  if (a && (a.cls === '費用' || a.cls === '収益') && b?.cls === '現預金') return a.fund;
  if (b && (b.cls === '費用' || b.cls === '収益') && a?.cls === '現預金') return b.fund;
  return '';
}

/** 予算残・達成率のサンプル（科目名から決定的に生成） */
export function budgetSample(name: string): { budget: number; actual: number; remain: number; rate: number } | null {
  const m = metaOf(name);
  if (!m || (m.cls !== '費用' && m.cls !== '収益')) return null;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 1000003;
  const budget = 600000 + (h % 30) * 100000;
  const actual = Math.round(budget * (0.35 + (h % 60) / 100));
  return { budget, actual, remain: budget - actual, rate: actual / budget };
}
