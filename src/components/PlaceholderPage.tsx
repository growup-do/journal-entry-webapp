// プロトタイプ範囲外のメニューを選んだときの案内

import { IMPLEMENTED_MENU } from '../data';

interface Props {
  title: string;
  accent: string;
}

export function PlaceholderPage({ title, accent }: Props) {
  return (
    <main style={{ flex: 1, padding: 28, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div style={{ width: 560, background: '#fff', border: '1px dashed #cfd8e0', borderRadius: 16, padding: '40px 36px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, background: '#f1f4f6', color: '#7a8794', fontSize: 11, fontWeight: 700, marginBottom: 14 }}>プロトタイプ未作成</div>
        <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 22, color: accent }}>{title}</div>
        <p style={{ color: '#7a8794', fontSize: 13, lineHeight: 1.8, margin: '12px 0 0' }}>
          この画面はまだプロトタイプに含まれていません。
          <br />
          作成済みの画面：{IMPLEMENTED_MENU.join('・')}
        </p>
      </div>
    </main>
  );
}
