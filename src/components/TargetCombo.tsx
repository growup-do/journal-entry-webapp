// 指定科目（指定取引先）の入力欄：問合せ画面（日記帳・各元帳・各推移表など）で共通に使う部品。
//   伝票入力と同じコンボ（ComboField）を問合せ画面用に包んだもの（確認メモ #160／#94）。
//   ・科目コード（前方一致）・名称（部分一致）・フリガナ（前方一致）を入力して絞り込める。コードを入力して Enter で確定できる
//   ・候補の各行に科目コードを表示する。選んでいる科目のコードは入力欄の左に表示する
//   ・候補は Esc で閉じる（入力内容を持たないドロップダウン）。Enter は IME の変換確定を無視する（ComboField 側で対応）

import type { CSSProperties } from 'react';
import { ComboField, EntryStyles, scopeStyle } from './EntryCommon';

interface Props {
  /** 入力欄の id（「科目検索」ボタンからフォーカスを移すときに使う） */
  id: string;
  /** 科目／取引先。既定は科目 */
  kind?: 'account' | 'vendor';
  value: string;
  onChange: (v: string) => void;
  accent: string;
  placeholder?: string;
  /** 入力欄の幅の上限（px）。既定 380 */
  width?: number;
  /** 候補リストの幅（px）。既定 400 */
  listWidth?: number;
  /** 入力欄の右に出す補足。false で出さない。既定は「コードを入力するか、候補から選びます」 */
  hint?: string | false;
  /** 指定を外す「×」ボタンを出す（指定が任意の画面用。日記帳など） */
  clearable?: boolean;
}

export function TargetCombo({ id, kind = 'account', value, onChange, accent, placeholder, width = 380, listWidth = 400, hint, clearable }: Props) {
  const isVendor = kind === 'vendor';
  const clearBtn: CSSProperties = { flex: 'none', padding: '4px 10px', borderRadius: 8, border: '1px solid ' + accent, background: '#fff', color: accent, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' };
  return (
    <>
      <div className="ef-scope" data-target-combo={kind} style={{ ...scopeStyle(accent), flex: `0 1 ${width}px`, minWidth: Math.min(240, width) }}>
        <EntryStyles />
        <div className="ef-field">
          <ComboField id={id} kind={kind} value={value} onChange={onChange} placeholder={placeholder ?? (isVendor ? 'コード・取引先名で指定' : 'コード・科目名・フリガナで指定')} listWidth={listWidth} fontSize={14} padY={7} />
        </div>
      </div>
      {clearable && value && <button type="button" onClick={() => onChange('')} title={`${isVendor ? '取引先' : '科目'}の指定を外します`} style={clearBtn}>{isVendor ? '取引先' : '科目'}の指定 ×解除</button>}
      {hint !== false && <span style={{ fontSize: 12, color: '#8290a0' }}>{hint ?? 'コードを入力するか、候補から選びます'}</span>}
    </>
  );
}

/** 「科目検索」ボタンなどから：入力欄へフォーカスを移し、候補リストを開く */
export function openTargetCombo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.focus();
  el.dispatchEvent(new Event('combo-open'));
}
