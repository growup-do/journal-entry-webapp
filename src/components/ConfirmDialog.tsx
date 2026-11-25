// 削除などの確認を、画面の中央に大きく出すダイアログ（確認メモ #300）。window.confirm の代わりに使う。
//   askConfirm(...) は、押したボタンに応じて true／false を返す Promise。App に置いた <ConfirmHost /> が表示する。
//   Esc・外側のクリックでは閉じない（全システム共通の既定）。閉じるのはボタンだけ。

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { Icon, btn } from './ui';

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  /** 実行のボタンの名前（例「削除する」） */
  okLabel?: string;
  cancelLabel?: string;
  /** 削除など取り消せない操作（赤いボタン・警告のアイコン） */
  danger?: boolean;
}
type Req = ConfirmOptions & { resolve: (ok: boolean) => void };

let show: ((r: Req) => void) | null = null;

/** 確認ダイアログを出す。ホストがないとき（テストなど）は window.confirm で代わりに聞く */
export function askConfirm(o: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (show) show({ ...o, resolve });
    else resolve(window.confirm(typeof o.message === 'string' ? o.message : o.title));
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<Req | null>(null);
  useEffect(() => {
    show = (r) => setReq(r);
    return () => { show = null; };
  }, []);
  const done = (ok: boolean) => { req?.resolve(ok); setReq(null); };
  const color = req?.danger ? '#c0392b' : '#1f7a52';
  return (
    <Modal open={!!req} onClose={() => done(false)} width={560} title={req?.title}>
      {req && (
        <div data-confirm-dialog style={{ padding: '22px 28px 24px', display: 'grid', gap: 22 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ flex: 'none', width: 48, height: 48, borderRadius: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: req.danger ? '#fdecea' : '#eaf5ef', color }}>
              <Icon name={req.danger ? 'alert' : 'approve'} size={24} />
            </span>
            <div style={{ fontSize: 16, lineHeight: 1.85, color: '#22303c', paddingTop: 8 }}>{req.message}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" autoFocus onClick={() => done(false)} style={{ ...btn(), padding: '10px 22px', fontSize: 15 }}>{req.cancelLabel ?? 'キャンセル'}</button>
            <button type="button" data-confirm-ok onClick={() => done(true)} style={{ ...btn(color, true), padding: '10px 26px', fontSize: 15 }}>{req.okLabel ?? 'OK'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
