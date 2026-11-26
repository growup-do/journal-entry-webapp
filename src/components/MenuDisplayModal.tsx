// メニューボタン表示設定（各種設定 › 各種設定）。左のメニュー（サイドバー）の出し方を選ぶ。
//   アイコンだけ：細い列（分類にマウスを載せると項目が出る）／表示しない：ヘッダーのロゴの左の ≡ から開く。名前付きの形は廃止（確認メモ #387）。
//   選んだ時点で画面に反映し、ブラウザに覚える。閉じるのは「閉じる」か × だけ（Esc・外側のクリックでは閉じない）。

import { Modal } from './Modal';
import { setSideNavMode, useSideNavMode, type SideNavMode } from './SideNav';

const MODES: { key: SideNavMode; label: string; note: string }[] = [
  { key: 'アイコンだけ', label: 'サイドバーを表示する（アイコンだけ）', note: '左に細い列でアイコンだけを表示します。分類にマウスを載せると項目が出ます。' },
  { key: '表示しない', label: 'サイドバーを表示しない', note: '画面を広く使えます。メニューは、左上の会計基準システムのアイコンの左にある ≡ から開きます。' },
];

/** サイドバーの見本（2つの出し方を小さな図で見せる） */
function Sample({ mode, accent }: { mode: SideNavMode; accent: string }) {
  const bar = (w: number) => <span style={{ display: 'block', height: 4, width: w, borderRadius: 2, background: '#cfd8e0' }} />;
  return (
    <span aria-hidden style={{ display: 'flex', flexDirection: 'column', width: 92, height: 60, border: '1px solid #dde4ea', borderRadius: 6, overflow: 'hidden', background: '#f7f9fa', flex: 'none' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 3, height: 12, padding: '0 4px', background: '#fff', borderBottom: '1px solid #e2e8ee' }}>
        {mode === '表示しない' && <span style={{ fontSize: 9, lineHeight: 1, color: '#3d4a56' }}>≡</span>}
        <span style={{ width: 6, height: 6, borderRadius: 2, background: accent }} />{bar(22)}
      </span>
      <span style={{ display: 'flex', flex: 1 }}>
        {mode !== '表示しない' && <span style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 4, width: 10, background: '#fff', borderRight: '1px solid #e2e8ee', boxSizing: 'border-box' }}>{[0, 1, 2, 3].map((i) => <span key={i} style={{ display: 'block', height: 3, borderRadius: 2, background: '#cfd8e0', width: 3 }} />)}</span>}
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, padding: 5 }}>{bar(34)}{bar(24)}{bar(30)}</span>
      </span>
    </span>
  );
}

export function MenuDisplayModal({ open, onClose, accent }: { open: boolean; onClose: () => void; accent: string }) {
  const mode = useSideNavMode();
  return (
    <Modal open={open} onClose={onClose} width={600} title="メニューボタン表示設定">
      <div data-menu-display style={{ padding: '14px 22px 18px', display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>左のメニュー（サイドバー）</div>
          <div style={{ fontSize: 12, color: '#7a8794' }}>選ぶとすぐに画面へ反映します。この設定は、使っているブラウザごとに覚えます。</div>
        </div>
        <div role="radiogroup" aria-label="サイドバーの表示" style={{ border: '1px solid #e2e8ee', borderRadius: 10 }}>
          {MODES.map((m, i) => {
            const on = mode === m.key;
            return (
              <label key={m.key} data-sidenav-mode={m.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', borderTop: i ? '1px solid #f1f4f6' : 'none', cursor: 'pointer', background: on ? '#f2f8f4' : 'transparent' }}>
                <input type="radio" name="sidenav-mode" checked={on} onChange={() => setSideNavMode(m.key)} style={{ width: 17, height: 17, accentColor: accent, flex: 'none' }} />
                <Sample mode={m.key} accent={accent} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 14 }}>{m.label}</b>
                  <span style={{ display: 'block', fontSize: 12, color: '#7a8794', marginTop: 2, lineHeight: 1.6 }}>{m.note}</span>
                </span>
              </label>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" data-menu-display-close onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>閉じる</button></div>
      </div>
    </Modal>
  );
}
