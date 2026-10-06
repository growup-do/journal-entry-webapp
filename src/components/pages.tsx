// メニュー項目 → ページ部品の振り分け（フォーム型／スプレッドシート型の両シェルから共用）
// 伝票入力は各シェル固有のレイアウトなので、ここでは扱わない。

import { BudgetComparePage } from './BudgetComparePage';
import { CashbookPage } from './CashbookPage';
import { DepreciationPage } from './DepreciationPage';
import { ReceiptsPaymentsPage } from './ReceiptsPaymentsPage';
import { GraphPage } from './GraphPage';
import { HomePage } from './HomePage';
import { MembersPage } from './MembersPage';
import { UserSettingsPage } from './UserSettingsPage';
import { SufficiencyPage } from './SufficiencyPage';
import { JournalListPage } from './JournalListPage';
import { LedgerPage } from './LedgerPage';
import { BalanceCheckPage, LedgerInquiryPage } from './InquiryPages';
import { CommonPrintSettingsPage, PrintCenterPage } from './PrintCenter';
import { TrendPage } from './TrendPage';
import { TrialBalancePage } from './TrialBalancePage';
import { PlaceholderPage } from './PlaceholderPage';
import { OptionGate } from './OptionGuidePage';
import { FunctionFinderPage } from './FunctionFinder';
import { FiscalYearPage } from './FiscalYearPage';
import { AppendixPrintPage } from './AppendixPrintPage';
import { AuditSettingsPage, BackupPage, FinancialAnalysisSettingsPage, JournalRefreshPage, PasswordSettingsPage } from './MaintenancePages';
import { renderSettingsPage } from './SettingsPages';
import { SETTINGS_MENU } from '../data';
import { SingleEntryPage } from './SingleEntryPage';
import { TransferEntryPage } from './TransferEntryPage';

export function renderPage(page: string, variant: 'form' | 'sheet', accent: string, accentRgb: string, onNavigate: (label: string) => void, _onLogout: () => void = () => {}) {
  // 各種設定のうち、依頼書対応で追加・分離した画面（年度更新、保守・運用、別紙）
  switch (page) {
    case '年度更新':
      return <FiscalYearPage key="fy-update" variant={variant} accent={accent} initial="update" onNavigate={onNavigate} />;
    case '年度更新（減価のみ）':
      return <FiscalYearPage key="fy-dep" variant={variant} accent={accent} initial="dep" onNavigate={onNavigate} />;
    case '財務分析設定':
      return <FinancialAnalysisSettingsPage variant={variant} accent={accent} onNavigate={onNavigate} />;
    case '決算チェック設定':
      return <AuditSettingsPage variant={variant} accent={accent} onNavigate={onNavigate} />;
    case 'パスワード':
      return <PasswordSettingsPage variant={variant} accent={accent} />;
    case '仕訳更新':
      return <JournalRefreshPage variant={variant} accent={accent} onNavigate={onNavigate} />;
    case 'データのバックアップ':
      return <BackupPage variant={variant} accent={accent} />;
    case '別紙（注記・明細書・財産目録）':
      return <AppendixPrintPage variant={variant} accent={accent} onNavigate={onNavigate} />;
  }
  if (SETTINGS_MENU.includes(page)) return renderSettingsPage(page, variant, accent);
  switch (page) {
    case 'ホーム':
      return <HomePage variant={variant} accent={accent} onNavigate={onNavigate} />;
    case '機能から探す':
      return <FunctionFinderPage accent={accent} onNavigate={onNavigate} />;
    case 'ユーザー設定':
      return <UserSettingsPage variant={variant} accent={accent} />;
    case 'メンバーの追加、管理':
      return <MembersPage variant={variant} accent={accent} />;
    case '単一入力':
      return <SingleEntryPage variant={variant} accent={accent} accentRgb={accentRgb} onNavigate={onNavigate} />;
    case '振替入力':
      return <TransferEntryPage key="transfer" variant={variant} accent={accent} accentRgb={accentRgb} onNavigate={onNavigate} />;
    case '振替単一':
      return <TransferEntryPage key="transfer-single" variant={variant} accent={accent} accentRgb={accentRgb} single onNavigate={onNavigate} />;
    case '仕訳一覧':
      return <JournalListPage variant={variant} accent={accent} onNavigate={onNavigate} />;
    case '勘定元帳':
      return <LedgerPage kind="account" variant={variant} accent={accent} accentRgb={accentRgb} onNavigate={onNavigate} />;
    case '資金元帳':
      return <LedgerPage kind="fund" variant={variant} accent={accent} accentRgb={accentRgb} onNavigate={onNavigate} />;
    case '業者元帳':
      return <LedgerPage kind="vendor" variant={variant} accent={accent} accentRgb={accentRgb} onNavigate={onNavigate} />;
    case '印刷センター':
      return <PrintCenterPage variant={variant} accent={accent} />;
    case '共通の印刷設定':
      return <CommonPrintSettingsPage variant={variant} accent={accent} />;
    case '元帳１':
      return <LedgerInquiryPage key="ledger1" slot="ledger1" variant={variant} accent={accent} accentRgb={accentRgb} onNavigate={onNavigate} />;
    case '元帳２':
      return <LedgerInquiryPage key="ledger2" slot="ledger2" variant={variant} accent={accent} accentRgb={accentRgb} onNavigate={onNavigate} />;
    case '残高照合':
      return <BalanceCheckPage variant={variant} accent={accent} onNavigate={onNavigate} />;
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
      return <OptionGate label="小口現金" accent={accent} onNavigate={onNavigate}><CashbookPage key="petty" kind="petty" variant={variant} accent={accent} accentRgb={accentRgb} /></OptionGate>;
    case '預金出納':
      return <OptionGate label="預金出納" accent={accent} onNavigate={onNavigate}><CashbookPage key="bank" kind="bank" variant={variant} accent={accent} accentRgb={accentRgb} /></OptionGate>;
    case '収入支出':
      return <OptionGate label="収入支出" accent={accent} onNavigate={onNavigate}><ReceiptsPaymentsPage variant={variant} accent={accent} /></OptionGate>;
    case '減価償却':
      return <OptionGate label="減価償却" accent={accent} onNavigate={onNavigate}><DepreciationPage variant={variant} accent={accent} /></OptionGate>;
    case '電子印':
      return <OptionGate label="電子印" accent={accent} onNavigate={onNavigate}><PlaceholderPage title="電子印" accent={accent} /></OptionGate>;
    case '予算対比':
      return <BudgetComparePage variant={variant} accent={accent} onNavigate={onNavigate} />;
    default:
      return <PlaceholderPage title={page} accent={accent} />;
  }
}
