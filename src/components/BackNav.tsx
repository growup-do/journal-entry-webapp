// 画面の中のボタン・リンクから別の画面へ移ったときの「← ○○に戻る」（全画面共通）
//   左のメニューや上部のメニューから開いたときは出さない。戻るボタンで戻ると、さらに前の画面への戻るボタンになる。
//   問合せ画面（ReportShell）と設定画面（SettingsShell）は、画面の枠の上端に戻るの帯を出す。
//   それ以外の画面は、上部のアプリバーの左端に戻るボタンを出す（帯を出した画面では出さない）。

import { createContext, useContext, useLayoutEffect } from 'react';
import { displayName } from '../data';

export interface BackNavValue {
  /** 戻り先の画面（なければ null） */
  from: string | null;
  back: () => void;
  /** 画面の枠に戻るの帯を出しているあいだ true（アプリバーの戻るボタンを出さない） */
  claim: (on: boolean) => void;
}
export const BackNavContext = createContext<BackNavValue>({ from: null, back: () => undefined, claim: () => undefined });
export const useBackNav = () => useContext(BackNavContext);

/** 画面の枠に戻るの帯を出していることを知らせる */
export function useBackClaim(active: boolean) {
  const { claim } = useBackNav();
  useLayoutEffect(() => {
    if (!active) return undefined;
    claim(true);
    return () => claim(false);
  }, [active, claim]);
}

/** 戻るボタン（固定資産の登録の「← 戻る」と同じ形） */
export function BackButton({ from, onBack, accent }: { from: string; onBack: () => void; accent: string }) {
  return (
    <button type="button" className="btn-outline" data-back-to={from} onClick={onBack} title={`${displayName(from)}の画面に戻ります`}
      style={{ padding: '6px 14px', border: '1px solid ' + accent, borderRadius: 8, background: '#fff', color: accent, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none' }}>
      ← {displayName(from)}に戻る
    </button>
  );
}
