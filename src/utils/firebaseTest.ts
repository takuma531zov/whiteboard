import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';

// Firebase接続テスト用関数
export const testFirebaseConnection = async () => {
  try {
    console.log('Firebase Auth オブジェクト:', auth);
    console.log('Firebase設定:', {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.substring(0, 10) + '...',
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID
    });

    // 複数のパターンでテスト
    const testCases = [
      { email: '0030228@kanri.com', password: '0030228xx', label: 'ケース1' },
      { email: '0030228@kanri.com', password: 'password123', label: 'ケース2' }
    ];

    for (const testCase of testCases) {
      try {
        console.log(`${testCase.label}を試行:`, testCase.email);
        const result = await signInWithEmailAndPassword(auth, testCase.email, testCase.password);
        console.log(`${testCase.label} ログイン成功:`, result.user.uid);
        return true;
      } catch (error: any) {
        console.log(`${testCase.label} 失敗:`, error.code);
      }
    }

    throw new Error('全てのテストケースが失敗');
  } catch (error: any) {
    console.error('Firebase接続テストエラー:', {
      code: error.code,
      message: error.message
    });
    return false;
  }
};