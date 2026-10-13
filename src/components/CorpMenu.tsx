// アプリバー右側のメニュー：「この区分」の調査（決算調査）・印刷（印刷センター）と、「法人」の印刷（法人全体の一括印刷）。
//   旧「法人調査」は、起動中の区分を対象にした決算調査に置き換えた（確認メモ #44：法人調査→今入っている区分、法人印刷→残す、区分の印刷ボタンを追加）。

import { useSession } from '../store/session';

interface Props {
  accent: string;
  active: string;
  onSelect: (label: string) => void;
}

const GROUPS: { caption: string; items: { label: string; target: string; title: string }[] }[] = [
  { caption: '', items: [{ label: '調査', target: '決算調査', title: '起動中の区分の決算調査（28項目の決算チェック）' }, { label: '印刷', target: '印刷センター', title: '起動中の区分の帳票の印刷（印刷センター）' }] },
  { caption: '法人', items: [{ label: '印刷', target: '法人印刷', title: '法人全体の決算書・附属明細書の一括印刷' }] },
];

export function CorpMenu({ accent, active, onSelect }: Props) {
  // 見出しは起動中の区分の名称（例「本部」「チャイルド保育園」）。コードは付けない
  const s = useSession();
  const divisionName = s.division.replace(/^\d+\s*/, '');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
      {GROUPS.map((g) => (
        <div key={g.caption} data-corp-group={g.caption || '区分'} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 2, background: '#f4f6f8', border: '1px solid #e2e8ee', borderRadius: 8, flex: 'none' }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: '#8290a0', padding: '0 4px', letterSpacing: '.02em', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }} title={g.caption || s.division}>{g.caption || divisionName}</span>
          {g.items.map((it) => {
            const on = active === it.target;
            return (
              <button key={it.target} type="button" className="btn-outline" onClick={() => onSelect(it.target)} data-menu={it.target} title={it.title} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid ' + (on ? accent : '#d3dbe3'), background: on ? accent : '#fff', color: on ? '#fff' : '#3d4a56', fontSize: 11.5, fontWeight: 700, lineHeight: 1.3, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {it.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
