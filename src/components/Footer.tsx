// フッター：コピーライト／利用規約／個人情報保護方針／機能一覧。
// 全画面（ログイン画面を含む）の最下部に置く。リンク先は同じタブで開く静的ページ（?page=…）。

export type StaticPage = 'features' | 'terms' | 'privacy';

/** 静的ページへ移動（同じタブ）。アプリの状態は sessionStorage に保持しているので戻れば元の画面に復帰する。 */
export const goStatic = (key: StaticPage) => {
  window.location.assign(window.location.pathname + '?page=' + key);
};

/** 静的ページからシステムへ戻る */
export const backToApp = () => {
  window.location.assign(window.location.pathname);
};

const LINKS: { label: string; key: StaticPage }[] = [
  { label: '利用規約', key: 'terms' },
  { label: '個人情報保護方針', key: 'privacy' },
  { label: '機能一覧', key: 'features' },
];

export function Footer({ compact, vertical }: { compact?: boolean; vertical?: boolean }) {
  // 縦型：スプレッドシート型の左サイドバー最下部用（リンクを縦に並べ、最後にコピーライト）
  if (vertical) {
    return (
      <footer style={{ padding: '10px 12px 12px', borderTop: '1px solid #eef2f5', fontSize: 11, color: '#8290a0' }}>
        <nav style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, marginBottom: 6 }}>
          {LINKS.map((l) => (
            <button
              key={l.key}
              type="button"
              data-footer={l.label}
              onClick={() => goStatic(l.key)}
              style={{ border: 'none', background: 'transparent', padding: '3px 6px', font: 'inherit', fontFamily: 'inherit', fontSize: 11.5, color: '#5b6b7b', cursor: 'pointer', borderRadius: 6 }}
              onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; e.currentTarget.style.color = '#22303c'; }}
              onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; e.currentTarget.style.color = '#5b6b7b'; }}
            >
              {l.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: '0 6px', lineHeight: 1.5 }}>© 2026 社会福祉法人<br />会計基準システム</div>
      </footer>
    );
  }
  return (
    <footer
      style={{
        marginTop: 'auto',
        borderTop: compact ? 'none' : '1px solid #dde4ea',
        background: compact ? 'transparent' : '#fff',
        padding: compact ? '18px 0 0' : '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        fontSize: 11.5,
        color: '#8290a0',
      }}
    >
      <span style={{ whiteSpace: 'nowrap' }}>© 2026 社会福祉法人会計基準システム</span>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {LINKS.map((l, i) => (
          <span key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <span style={{ color: '#c3ccd4' }}>｜</span>}
            <button
              type="button"
              data-footer={l.label}
              onClick={() => goStatic(l.key)}
              style={{ border: 'none', background: 'transparent', padding: '2px 6px', font: 'inherit', fontFamily: 'inherit', color: '#5b6b7b', cursor: 'pointer', borderRadius: 6 }}
              onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; e.currentTarget.style.color = '#22303c'; }}
              onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; e.currentTarget.style.color = '#5b6b7b'; }}
            >
              {l.label}
            </button>
          </span>
        ))}
      </nav>
    </footer>
  );
}
