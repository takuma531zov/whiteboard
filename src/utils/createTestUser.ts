import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

// テストユーザーを自動作成する関数
export const createTestUser = async () => {
  try {
    console.log('テストユーザー作成開始...');
    
    // Firebase Authでユーザー作成
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      '0030228@kanri.com', 
      'password123'
    );
    
    const user = userCredential.user;
    console.log('Firebase Authユーザー作成成功:', user.uid);
    
    // Firestoreにユーザーデータ作成
    await setDoc(doc(db, 'users', user.uid), {
      employeeId: '0030228',
      name: 'テストユーザー',
      isAttending: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('Firestoreユーザーデータ作成成功');
    alert('テストユーザーの作成が完了しました！');
    
    return true;
  } catch (error: any) {
    console.error('テストユーザー作成エラー:', {
      code: error.code,
      message: error.message
    });
    
    if (error.code === 'auth/email-already-in-use') {
      alert('ユーザーは既に存在しています');
      return true;
    }
    
    alert(`ユーザー作成エラー: ${error.message}`);
    return false;
  }
};