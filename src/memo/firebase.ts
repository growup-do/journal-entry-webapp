// 確認メモ用 Firebase 初期化（工数管理と同じ Firebase プロジェクトを共用）
// Web用 apiKey は公開前提の値。ログインなし・URLを知っていれば読み書き可（プロトタイプ用途）。

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDyRUn0xQ7G-gEcD9V6sEn9DL5uAPnMxRk',
  authDomain: 'kosu-tracker.firebaseapp.com',
  projectId: 'kosu-tracker',
  storageBucket: 'kosu-tracker.firebasestorage.app',
  messagingSenderId: '268316180926',
  appId: '1:268316180926:web:50af50adca1adbfe9a79ef',
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
