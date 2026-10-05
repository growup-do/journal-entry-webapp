// アプリバー右側の道具：法人メニュー（調査／印刷）
//   仕訳の年切替（当年／前年）は伝票入力の参照パネルへ、照会（元帳１／元帳２／残高照合）も参照パネルへ移した。

import { CorpMenu } from './CorpMenu';

interface Props {
  accent: string;
  page: string;
  onNavigate: (label: string) => void;
}

export function HeaderTools({ accent, page, onNavigate }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
      <CorpMenu accent={accent} active={page} onSelect={onNavigate} />
    </div>
  );
}
