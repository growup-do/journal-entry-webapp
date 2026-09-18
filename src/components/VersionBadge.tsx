// バージョン（システム名の隣の小さなバッジ。クリックで既存と同じ「バージョン情報」ダイアログ）
// 通常メニューとは別扱い。

import { useState } from 'react';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';

/** ライセンス情報（サンプル値。本番では登録情報をサーバーから取得） */
const LICENSE = {
  product: '社会福祉法人会計基準システム（Web版）', version: '令和8年(2026年)8月25日版', type: '年間サブスクリプション', corp: '社会福祉法人 チャイルド保育園',
  users: '5 ユーザー（同時接続 3）', expires: '2027/03/31', key: 'CHPY-24W-XXXX-XXXX-7F3A',
  oss: [['React', 'MIT License'], ['Vite', 'MIT License'], ['TypeScript', 'Apache License 2.0'], ['Firebase JavaScript SDK', 'Apache License 2.0'], ['Noto Sans JP（Google Fonts）', 'SIL Open Font License 1.1']],
};

export const VERSION = { label: '令和8年(2026年)8月25日版', updated: '2026年08月06日 13:02:26', copyright: 'Copyright (C) 2012 (株)チャイルド社' };

export function VersionBadge({ accent }: { accent: string }) {
  const [open, setOpen] = useState(false);
  const [licOpen, setLicOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const toast = useToast();
  const maskedKey = LICENSE.key.replace(/^(.{4})(.*)(.{4})$/, (_m, a: string, b: string, c: string) => a + b.replace(/[^-]/g, '＊') + c);
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
            <button type="button" className="btn-outline" onClick={() => setLicOpen(true)} style={{ padding: '8px 12px', border: '1px solid #cfd8e0', borderRadius: 8, background: '#fff', color: '#5b6773', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>ライセンス情報</button>
          </div>
        </div>
      </Modal>

      <Modal open={licOpen} onClose={() => setLicOpen(false)} width={560} title="ライセンス情報">
        <div style={{ padding: '14px 22px 18px', fontSize: 13 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {([['製品名', LICENSE.product], ['バージョン', LICENSE.version], ['ライセンス種別', LICENSE.type], ['登録法人名', LICENSE.corp], ['利用者数', LICENSE.users], ['有効期限', LICENSE.expires + '（残り ' + Math.max(0, Math.ceil((new Date(LICENSE.expires).getTime() - Date.now()) / 86400000)) + ' 日）']] as [string, string][]).map(([k, v]) => (
                <tr key={k}><th style={{ textAlign: 'left', padding: '6px 10px', width: 130, fontSize: 11.5, color: '#8290a0', background: '#f6f8fa', borderBottom: '1px solid #eef2f5', fontWeight: 700 }}>{k}</th><td style={{ padding: '6px 10px', borderBottom: '1px solid #eef2f5' }}>{v}</td></tr>
              ))}
              <tr><th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11.5, color: '#8290a0', background: '#f6f8fa', borderBottom: '1px solid #eef2f5', fontWeight: 700 }}>ライセンスキー</th><td style={{ padding: '6px 10px', borderBottom: '1px solid #eef2f5', display: 'flex', alignItems: 'center', gap: 10 }}><code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: 1 }}>{showKey ? LICENSE.key : maskedKey}</code><button type="button" onClick={() => setShowKey(!showKey)} style={{ padding: '2px 8px', border: '1px solid #cfd8e0', borderRadius: 6, background: '#fff', color: '#5b6773', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{showKey ? '隠す' : '表示'}</button></td></tr>
            </tbody>
          </table>
          <div style={{ fontWeight: 700, fontSize: 12.5, margin: '16px 0 6px' }}>使用しているオープンソースソフトウェア</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ textAlign: 'left', padding: '5px 10px', fontSize: 11, color: '#8290a0', background: '#f6f8fa', borderBottom: '1px solid #eef2f5' }}>ソフトウェア</th><th style={{ textAlign: 'left', padding: '5px 10px', fontSize: 11, color: '#8290a0', background: '#f6f8fa', borderBottom: '1px solid #eef2f5' }}>ライセンス</th></tr></thead>
            <tbody>{LICENSE.oss.map(([n, l]) => <tr key={n}><td style={{ padding: '5px 10px', borderBottom: '1px solid #eef2f5' }}>{n}</td><td style={{ padding: '5px 10px', borderBottom: '1px solid #eef2f5', color: '#5b6773' }}>{l}</td></tr>)}</tbody>
          </table>
          <div style={{ fontSize: 11.5, color: '#9aa5b1', marginTop: 10, lineHeight: 1.7 }}>各ソフトウェアの著作権はそれぞれの権利者に帰属します。ライセンス全文は配布物内の LICENSE ファイルを参照してください。{'\u00a0'}{VERSION.copyright}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" onClick={() => { navigator.clipboard?.writeText(`${LICENSE.product} / ${LICENSE.version} / ${LICENSE.corp} / 有効期限 ${LICENSE.expires}`).then(() => toast.show('ライセンス情報をコピーしました')).catch(() => toast.show('コピーできませんでした')); }} style={{ padding: '8px 14px', border: '1px solid #cfd8e0', borderRadius: 8, background: '#fff', color: '#5b6773', fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}>情報をコピー</button>
            <button type="button" onClick={() => setLicOpen(false)} style={{ padding: '8px 26px', background: accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>閉じる</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
