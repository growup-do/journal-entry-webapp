// メニュー項目 → ページ部品の振り分け（フォーム型／スプレッドシート型の両シェルから共用）
// 伝票入力は各シェル固有のレイアウトなので、ここでは扱わない。

import { BudgetComparePage } from './BudgetComparePage';
import { CashbookPage } from './CashbookPage';
import { DepreciationPage } from './DepreciationPage';
import { ReceiptsPaymentsPage } from './ReceiptsPaymentsPage';
import { DailyAuditPage } from './DailyAuditPage';
import { GraphPage } from './GraphPage';
import { HomePage } from './HomePage';
import { LogoutPage } from './LogoutPage';
import { MembersPage } from './MembersPage';
import { UserSettingsPage } from './UserSettingsPage';
import { SufficiencyPage } from './SufficiencyPage';
import { JournalListPage } from './JournalListPage';
import { LedgerPage } from './LedgerPage';
import { TrendPage } from './TrendPage';
import { TrialBalancePage } from './TrialBalancePage';
import { PlaceholderPage } from './PlaceholderPage';
import { SingleEntryPage } from './SingleEntryPage';
import { TransferEntryPage } from './TransferEntryPage';

export function renderPage(page: string, variant: 'form' | 'sheet', accent: string, accentRgb: string, onNavigate: (label: string) => void, year: 'current' | 'prev' = 'current') {
  switch (page) {
    case 'ホーム':
      return <HomePage variant={variant} accent={accent} onNavigate={onNavigate} />;
    case 'ユーザー設定':
      return <UserSettingsPage variant={variant} accent={accent} />;
    case 'メンバーの追加、管理':
      return <MembersPage variant={variant} accent={accent} />;
    case 'ログアウト':
      return <LogoutPage accent={accent} onNavigate={onNavigate} />;
    case '単一入力':
      return <SingleEntryPage variant={variant} accent={accent} accentRgb={accentRgb} prevYear={year === 'prev'} />;
    case '振替入力':
      return <TransferEntryPage variant={variant} accent={accent} accentRgb={accentRgb} />;
    case '振替単一':
      return <TransferEntryPage variant={variant} accent={accent} accentRgb={accentRgb} single />;
    case '日次調査':
      return <DailyAuditPage variant={variant} accent={accent} onNavigate={onNavigate} />;
    case '仕訳一覧':
      return <JournalListPage variant={variant} accent={accent} onNavigate={onNavigate} />;
    case '勘定元帳':
      return <LedgerPage kind="account" variant={variant} accent={accent} accentRgb={accentRgb} onNavigate={onNavigate} />;
    case '資金元帳':
      return <LedgerPage kind="fund" variant={variant} accent={accent} accentRgb={accentRgb} onNavigate={onNavigate} />;
    case '業者元帳':
      return <LedgerPage kind="vendor" variant={variant} accent={accent} accentRgb={accentRgb} onNavigate={onNavigate} />;
    case '科目推移':
      return <TrendPage kind="account" variant={variant} accent={accent} accentRgb={accentRgb} onNavigate={onNavigate} />;
    case '資金推移':
      return <TrendPage kind="fund" variant={variant} accent={accent} accentRgb={accentRgb} onNavigate={onNavigate} />;
    case '業者推移':
      return <TrendPage kind="vendor" variant={variant} accent={accent} accentRgb={accentRgb} onNavigate={onNavigate} />;
    case '月次試算':
      return <TrialBalancePage mode="trial" variant={variant} accent={accent} onNavigate={onNavigate} />;
    case '月次決算':
      return <TrialBalancePage mode="closing" variant={variant} accent={accent} onNavigate={onNavigate} />;
    case '経年グラフ':
      return <GraphPage key="yearly" mode="yearly" variant={variant} accent={accent} onNavigate={onNavigate} />;
    case '分析グラフ':
      return <GraphPage key="analysis" mode="analysis" variant={variant} accent={accent} onNavigate={onNavigate} />;
    case '充実残額':
      return <SufficiencyPage variant={variant} accent={accent} onNavigate={onNavigate} />;
    case '小口現金':
      return <CashbookPage key="petty" kind="petty" variant={variant} accent={accent} accentRgb={accentRgb} />;
    case '預金出納':
      return <CashbookPage key="bank" kind="bank" variant={variant} accent={accent} accentRgb={accentRgb} />;
    case '収入支出':
      return <ReceiptsPaymentsPage variant={variant} accent={accent} />;
    case '減価償却':
      return <DepreciationPage variant={variant} accent={accent} />;
    case '予算対比':
      return <BudgetComparePage variant={variant} accent={accent} onNavigate={onNavigate} />;
    default:
      return <PlaceholderPage title={page} accent={accent} />;
  }
}
