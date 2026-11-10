// ダッシュボード表示オプション（確認メモ #152）。
//   以前はホームの右上から開いていたが、ヘッダーの「各種設定」にまとめた。
//   最初に表示する画面（伝票入力／ホーム）と、ホームに表示するメニューを選ぶ。
//   変更はその場で保存するので、閉じるのは「閉じる」か × だけ（Esc・外側のクリックでは閉じない）。

import { useState } from 'react';
import { Modal } from './Modal';
import { FavoritesEditModal } from './FavoritesEditModal';
import { HOME_SECTIONS, setSession, useSession } from '../store/session';

interface Props {
  open: boolean;
  onClose: () => void;
  accent: string;
}

export function HomeOptionsModal({ open, onClose, accent }: Props) {
  const s = useSession();
  const show = s.homeSections;
  const [favEdit, setFavEdit] = useState(false);

  return (
    <>
      <Modal open={open} onClose={onClose} width={620} title="ダッシュボード表示オプション">
        <div data-home-options style={{ padding: '14px 22px 18px', display: 'grid', gap: 18 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>最初に表示する画面</div>
            <div style={{ fontSize: 12, color: '#7a8794', marginBottom: 8 }}>ログインして区分を選んだあと、最初に開く画面です（既定は伝票入力画面）。次回のログインから反映します。</div>
            <div role="radiogroup" aria-label="最初に表示する画面" data-start-slider style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 4, background: '#e6ecf0', borderRadius: 13, maxWidth: 420 }}>
              <span aria-hidden style={{ position: 'absolute', top: 4, bottom: 4, left: 4, width: 'calc(50% - 4px)', borderRadius: 10, background: accent, boxShadow: '0 2px 8px rgba(31,122,82,.35)', transform: s.startScreen === 'ホーム' ? 'translateX(100%)' : 'translateX(0)', transition: 'transform .22s ease' }} />
              {([['伝票入力', '伝票入力画面'], ['ホーム', 'ホーム画面']] as const).map(([key, label]) => {
                const on = s.startScreen === key;
                return <button key={key} type="button" role="radio" aria-checked={on} data-start-screen={key} onClick={() => setSession({ startScreen: key })} style={{ position: 'relative', zIndex: 1, padding: '10px 12px', border: 'none', borderRadius: 10, background: 'transparent', color: on ? '#fff' : '#48565f', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', transition: 'color .2s' }}>{label}</button>;
              })}
            </div>
            <div style={{ fontSize: 12, color: '#5b6773', marginTop: 8 }}>{s.startScreen === 'ホーム' ? 'ホーム画面：機能の一覧やお気に入りメニューから作業を始めます。' : '伝票入力画面：すぐに伝票（仕訳伝票形式）の入力を始めます。'}</div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>ダッシュボードに表示するメニュー</div>
            <div style={{ fontSize: 12, color: '#7a8794', marginBottom: 8 }}>チェックを外したメニューは、ホーム画面に表示しません。「機能から探す」（検索ボックスと機能の一覧）は常に表示します。</div>
            <div style={{ border: '1px solid #e2e8ee', borderRadius: 10 }}>
              {HOME_SECTIONS.map((sec, i) => (
                <label key={sec.key} data-home-section={sec.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: i ? '1px solid #f1f4f6' : 'none', cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={show[sec.key]} onChange={(e) => setSession({ homeSections: { ...show, [sec.key]: e.target.checked } })} style={{ width: 17, height: 17, accentColor: accent }} />
                  <b style={{ width: 210, flex: 'none' }}>{sec.label}</b>
                  <span style={{ fontSize: 12, color: '#7a8794', flex: 1 }}>{sec.note}</span>
                  {sec.key === 'favorites' && <button type="button" onClick={(e) => { e.preventDefault(); setFavEdit(true); }} style={{ flex: 'none', padding: '5px 10px', borderRadius: 7, border: '1px solid ' + accent, background: '#fff', color: accent, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>登録する画面を編集</button>}
                </label>
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#7a8794', marginTop: 8, lineHeight: 1.7 }}>お知らせは、画面右上のベルから開きます。預金残高は「推移・分析」の「預金残高」で確認できます。</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" data-home-options-close onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>閉じる</button></div>
        </div>
      </Modal>
      <FavoritesEditModal open={favEdit} onClose={() => setFavEdit(false)} accent={accent} />
    </>
  );
}
