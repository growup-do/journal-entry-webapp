// バージョン（システム名の隣の小さなバッジ。クリックで既存と同じ「バージョン情報」ダイアログ）
// 通常メニューとは別扱い。

import { useState } from 'react';
import { Modal } from './Modal';
import { NOT_IMPL, ToastView, useToast } from './Toast';

export const VERSION = { label: '令和8年(2026年)8月25日版', updated: '2026年08月06日 13:02:26', copyright: 'Copyright (C) 2012 (株)チャイルド社' };

export function VersionBadge({ accent }: { accent: string }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <>
      <button
        type="button"
        className="btn-outline"
        onClick={() => setOpen(true)}
        title="バージョン情報"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 10, border: '1px solid #dde4ea', background: '#f7f9fb', color: '#68757f', fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
        バージョン
      </button>

      <Modal open={open} onClose={() => setOpen(false)} width={520} title="バージョン情報">
        <ToastView msg={toast.msg} />
        <div style={{ display: 'flex', gap: 18, padding: '18px 22px 20px' }}>
          <span style={{ flex: 'none', width: 56, height: 56, borderRadius: 12, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 26 }}>会</span>
          <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.9 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>社会福祉法人会計基準システム</div>
            <div style={{ color: '#2c5f9e', fontWeight: 600 }}>{VERSION.label}</div>
            <div>更新日時　<span style={{ color: '#2c5f9e' }}>{VERSION.updated}</span></div>
            <div style={{ color: '#5b6773' }}>{VERSION.copyright}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'space-between' }}>
            <button type="button" onClick={() => setOpen(false)} style={{ padding: '8px 26px', background: accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>OK</button>
            <button type="button" className="btn-outline" onClick={() => toast.show(NOT_IMPL)} style={{ padding: '8px 12px', border: '1px solid #cfd8e0', borderRadius: 8, background: '#fff', color: '#5b6773', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>ライセンス情報</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
