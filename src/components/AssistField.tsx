// フィールドボタン（科目・区分・業者）＋ 補助ドロップダウン
// 値を表示するボタン。クリックで AssistPanel を開く。
// hover のアクセント色は CSS 変数（--field-accent / --field-accent-rgb）で切替。

import type { CSSProperties } from 'react';
import { AssistPanel } from './AssistPanel';
import type { AssistGroup } from '../types';

interface Props {
  value: string;
  placeholder: string;
  open: boolean;
  onOpen: () => void;
  /** hover 時のアクセント色（例 '#2c5f9e'） */
  accent: string;
  /** hover リングの rgb（例 '44,95,158'） */
  accentRgb: string;
  buttonStyle: CSSProperties;
  panelStyle: CSSProperties;
  groups: AssistGroup[];
  query: string;
  empty: boolean;
  onInput: (value: string) => void;
  onPick: (value: string) => void;
  /** ボタン要素の id（キーボードでのフォーカス移動用・任意） */
  buttonId?: string;
}

export function AssistField({
  value,
  placeholder,
  open,
  onOpen,
  accent,
  accentRgb,
  buttonStyle,
  panelStyle,
  groups,
  query,
  empty,
  onInput,
  onPick,
  buttonId,
}: Props) {
  return (
    <div
      style={
        {
          position: 'relative',
          '--field-accent': accent,
          '--field-accent-rgb': accentRgb,
        } as CSSProperties
      }
      data-assist
    >
      <button type="button" id={buttonId} className="field-btn" onClick={onOpen} style={buttonStyle}>
        <span
          style={{
            color: value ? '#22303c' : '#9aa5b1',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {value || placeholder}
        </span>
        <span style={{ color: '#9aa5b1', fontSize: 9, flex: 'none' }}>▼</span>
      </button>
      {open && (
        <AssistPanel
          groups={groups}
          query={query}
          empty={empty}
          onInput={onInput}
          onPick={onPick}
          style={panelStyle}
        />
      )}
    </div>
  );
}
