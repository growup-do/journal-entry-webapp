// 他の区分の設定を読み込む（既存【動作印刷設定の読込】）：
//   区分を選ぶ → 上書きの確認（元に戻せない旨） → 実行。動作環境と共通の印刷設定の両方から使う。

import { useState } from 'react';
import { Modal } from './Modal';
import { Notice, btn, input } from './ui';
import { SERVICES } from '../data';
import { useSession } from '../store/session';

export function LoadDivisionSettings({ accent, kind, onDone, small }: { accent: string; /** 読み込む設定の種類（文言に使う） */ kind: '動作設定' | '印刷設定' | '動作設定・印刷設定'; onDone: (from: string) => void; small?: boolean }) {
  const s = useSession();
  const others = SERVICES.filter((x) => x !== s.division);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(others[0] ?? '');
  const [confirm, setConfirm] = useState(false);
  const close = () => { setOpen(false); setConfirm(false); };
  return (
    <>
      <button type="button" className="btn-outline" onClick={() => { setFrom(others[0] ?? ''); setOpen(true); }} style={btn('#5b6773', false, small)} data-load-division-settings>他の区分の設定を読み込む</button>
      <Modal open={open} onClose={close} width={560} title={`他の区分の${kind}を読み込む`}>
        <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
          {!confirm ? (
            <>
              <div style={{ fontSize: 12.5, color: '#3d4a56' }}>読み込み元の伝票入力区分を選んでください。選んだ区分の{kind}を、起動中の区分「<b>{s.division}</b>」の設定として読み込みます。</div>
              <select value={from} onChange={(e) => setFrom(e.target.value)} style={input} aria-label="読み込み元の区分" data-load-from>{others.map((o) => <option key={o}>{o}</option>)}</select>
              <Notice tone="warn">起動中の区分の現在の設定は上書きされます。元に戻せないため、必要なら先に「設定の保存」でファイルに書き出してください。</Notice>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={close} style={btn()}>キャンセル</button>
                <button type="button" onClick={() => setConfirm(true)} disabled={!from} style={btn(accent, true)}>次へ</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 700 }}>「{s.division}」の{kind}は、「{from}」の設定で上書きされます。</div>
              <div style={{ fontSize: 12.5, color: '#5b6773' }}>実行してもよろしいですか？（この操作は取り消せません）</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setConfirm(false)} style={btn()}>戻る</button>
                <button type="button" className="submit-btn" onClick={() => { close(); onDone(from); }} style={btn('#c0392b', true)} data-load-run>上書きして読み込む</button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
