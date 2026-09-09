// アプリバー右側の道具：仕訳の年切替（当年／前年）、照会（元帳１／元帳２／残高照合＝1画面で開く）、法人メニュー
// 通常メニューと別枠に置く。

import { CorpMenu } from './CorpMenu';
import { INQUIRY_MENU } from '../data';

export type JournalYear = 'current' | 'prev';

interface Props {
  accent: string;
  page: string;
  onNavigate: (label: string) => void;
  year: JournalYear;
  onYear: (y: JournalYear) => void;
}

const seg = (on: boolean, accent: string) => ({
  padding: '4px 8px',
  borderRadius: 6,
  border: '1px solid ' + (on ? accent : '#d3dbe3'),
  background: on ? accent : '#fff',
  color: on ? '#fff' : '#3d4a56',
  fontSize: 11.5,
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
  lineHeight: 1.3,
});
const groupStyle = { display: 'flex', alignItems: 'center', gap: 2, padding: 2, background: '#f4f6f8', border: '1px solid #e2e8ee', borderRadius: 8, flex: 'none' as const };
const groupLabel = { fontSize: 9.5, fontWeight: 700, color: '#8290a0', padding: '0 4px 0 4px', letterSpacing: '.02em' };

export function HeaderTools({ accent, page, onNavigate, year, onYear }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
      <div style={groupStyle}>
        <span style={groupLabel}>仕訳</span>
        <button type="button" className="btn-outline" data-menu="当年仕訳" onClick={() => onYear('current')} style={seg(year === 'current', accent)}>当年</button>
        <button type="button" className="btn-outline" data-menu="前年仕訳" onClick={() => onYear('prev')} style={seg(year === 'prev', '#b7791f')}>前年</button>
      </div>
      <div style={groupStyle}>
        <span style={groupLabel}>照会</span>
        {INQUIRY_MENU.map((label) => (
          <button key={label} type="button" className="btn-outline" data-menu={label} onClick={() => onNavigate(label)} style={seg(page === label, accent)}>
            {label}
          </button>
        ))}
      </div>
      <CorpMenu accent={accent} active={page} onSelect={onNavigate} />
    </div>
  );
}
