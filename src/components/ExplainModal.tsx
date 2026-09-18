// 説明・マニュアル・注意事項の共通モーダル（既存の「説明」「注意事項（PDF）」「ⓘ マニュアル」ボタンの中身）
//   マニュアル本文を要約した見出し＋本文のセクションを表示する。サポートサイトへのリンク付き。

import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { SUPPORT_URL } from './SettingsMenu';
import { btn } from './ui';

export interface ExplainSection { h: string; body: ReactNode }

export function ExplainModal({ open, onClose, accent, title, sections, source, width = 640 }: { open: boolean; onClose: () => void; accent: string; title: string; sections: ExplainSection[]; /** 出典（例：マニュアル 7.6 p.180） */ source?: string; width?: number }) {
  return (
    <Modal open={open} onClose={onClose} width={width} title={title}>
      <div style={{ padding: '14px 22px 18px' }}>
        <div style={{ display: 'grid', gap: 14, maxHeight: '60vh', overflow: 'auto', paddingRight: 4 }}>
          {sections.map((s) => (
            <section key={s.h}>
              <div style={{ fontSize: 13, fontWeight: 800, color: accent, marginBottom: 4 }}>{s.h}</div>
              <div style={{ fontSize: 13, color: '#48565f', lineHeight: 1.85 }}>{s.body}</div>
            </section>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, fontSize: 11.5, color: '#9aa5b1' }}>
          {source && <span>出典：{source}</span>}
          <button type="button" className="btn-outline" onClick={() => window.open(SUPPORT_URL, '_blank', 'noopener')} style={{ ...btn('#5b6773', false, true), marginLeft: 'auto' }}>サポートサイトで詳しく見る ↗</button>
          <button type="button" onClick={onClose} style={btn(accent, true, true)}>閉じる</button>
        </div>
      </div>
    </Modal>
  );
}
