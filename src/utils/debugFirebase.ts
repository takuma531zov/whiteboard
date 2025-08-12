// Firebase設定の確認用デバッグユーティリティ
export const debugFirebaseConfig = () => {
  console.log('Firebase設定確認:', {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? '設定済み' : '未設定',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ? '設定済み' : '未設定',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ? '設定済み' : '未設定'
  });
};