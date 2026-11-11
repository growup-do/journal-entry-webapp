// 保存されていない変更の管理（確認メモ #224・#225）。
//   設定画面で値を変えたまま保存していないあいだ、その画面が useUnsaved で登録する。
//   App はほかの画面へ移る前に unsavedLabel() を見て、残っていれば確認のモーダルを出す。
//   ブラウザの再読み込み・タブを閉じる操作でも、ブラウザ標準の確認を出す。

import { useEffect } from 'react';

const dirty = new Map<string, string>();

function onBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
  e.returnValue = '';
}

function sync() {
  if (dirty.size) window.addEventListener('beforeunload', onBeforeUnload);
  else window.removeEventListener('beforeunload', onBeforeUnload);
}

/** 未保存の変更を登録・解除する。label は確認のモーダルに出す名称（例「財務分析設定の人数設定」）。null で解除 */
export function setUnsaved(key: string, label: string | null) {
  if (label) dirty.set(key, label);
  else dirty.delete(key);
  sync();
}

/** 保存されていない変更がある画面の名称（なければ空文字） */
export function unsavedLabel(): string {
  return [...dirty.values()].join('、');
}

/** 移動を選んだあとに、登録をまとめて解除する */
export function clearUnsaved() {
  dirty.clear();
  sync();
}

/** 画面側で使う：isDirty のあいだ登録し、画面を離れたら解除する */
export function useUnsaved(key: string, label: string, isDirty: boolean) {
  useEffect(() => {
    setUnsaved(key, isDirty ? label : null);
    return () => setUnsaved(key, null);
  }, [key, label, isDirty]);
}

/** 未保存のときの画面の色（画面全体を薄い暖色に。入力欄の黄色 #fffbe6 より薄くして、変更した欄が埋もれないようにする） */
export const UNSAVED_BG = '#fff9f1';
/** 変更された入力欄の色（仕訳入力の入力可能枠と同じ黄色） */
export const CHANGED_BG = '#fffbe6';
/** 変更された入力欄の枠の色 */
export const CHANGED_BORDER = '#d4a72c';
/** 「保存されていません。」の文字色 */
export const UNSAVED_FG = '#c2410c';
