import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Firebase設定
// 環境変数から設定を読み込み
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Firebase設定の検証
console.log('Firebase初期化開始:', {
  hasApiKey: !!firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId
});

// Firebaseアプリを初期化
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log('Firebaseアプリ初期化成功');
} catch (error) {
  console.error('Firebaseアプリ初期化エラー:', error);
  throw error;
}

// Firebase Authenticationを初期化
export const auth = getAuth(app);

// Firestoreを初期化
export const db = getFirestore(app);

// Firebase Functionsを初期化
export const functions = getFunctions(app, 'asia-northeast1');

// デフォルトエクスポート
export default app;