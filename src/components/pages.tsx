// メニュー項目 → ページ部品の振り分け（フォーム型／スプレッドシート型の両シェルから共用）
// 伝票入力は各シェル固有のレイアウトなので、ここでは扱わない。

import { DailyAuditPage } from './DailyAuditPage';
import { PlaceholderPage } from './PlaceholderPage';
import { SingleEntryPage } from './SingleEntryPage';
import { TransferEntryPage } from './TransferEntryPage';

export function renderPage(page: string, variant: 'form' | 'sheet', accent: string, accentRgb: string, onNavigate: (label: string) => void) {
  switch (page) {
    case '単一入力':
      return <SingleEntryPage variant={variant} accent={accent} accentRgb={accentRgb} />;
    case '振替入力':
      return <TransferEntryPage variant={variant} accent={accent} accentRgb={accentRgb} />;
    case '日次調査':
      return <DailyAuditPage variant={variant} accent={accent} onNavigate={onNavigate} />;
    default:
      return <PlaceholderPage title={page} accent={accent} />;
  }
}
