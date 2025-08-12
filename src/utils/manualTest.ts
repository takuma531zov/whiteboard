import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';

// 手動でのFirebaseテスト関数
export const manualFirebaseTest = async (email: string, password: string) => {
  try {
    console.log('手動テスト開始:', { email, passwordLength: password.length });
    
    // Firebaseの状態確認
    console.log('Firebase auth:', {
      currentUser: auth.currentUser,
      config: auth.config
    });
    
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log('手動テスト成功:', {
      uid: result.user.uid,
      email: result.user.email,
      emailVerified: result.user.emailVerified
    });
    
    return result;
  } catch (error: any) {
    console.error('手動テストエラー:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
      fullError: error
    });
    throw error;
  }
};

// グローバルに関数を追加（ブラウザコンソールから呼び出し可能）
(window as any).manualTest = manualFirebaseTest;