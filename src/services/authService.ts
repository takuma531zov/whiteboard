import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser,
  onAuthStateChanged,
  updateCurrentUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User, LoginFormData } from '../types';

/**
 * 認証サービス
 * Firebase Authenticationを使用したユーザー認証機能を提供
 */
export class AuthService {
  
  /**
   * 社員番号とパスワードでログイン
   * 社員番号をメールアドレス形式に変換してFirebase Authenticationで認証
   */
  static async login(loginData: LoginFormData): Promise<User> {
    try {
      const { employeeId, password } = loginData;
      
      // 社員番号をメールアドレス形式に変換
      // 例: 社員番号0030228 → 0030228@kanri.com
      const email = `${employeeId}@kanri.com`;
      
      console.log('ログイン試行開始:', { employeeId, email, passwordLength: password.length });
      console.log('Firebase auth オブジェクト:', auth);
      
      // Firebase Authenticationでログイン
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      console.log('Firebase認証成功:', firebaseUser.uid);
      
      // Firestoreからユーザー情報を取得
      const userData = await this.getUserData(firebaseUser.uid);
      
      if (!userData) {
        console.log('Firestoreにユーザーデータが存在しません。自動作成を試行します。');
        
        // ユーザーデータが存在しない場合は自動作成
        const newUserData = {
          employeeId,
          name: `ユーザー${employeeId}`,
          isAttending: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await setDoc(doc(db, 'users', firebaseUser.uid), newUserData);
        console.log('Firestoreにユーザーデータを自動作成しました');
        
        return {
          id: firebaseUser.uid,
          ...newUserData
        };
      }
      
      console.log('ログイン完了:', userData);
      return userData;
      
    } catch (error: any) {
      console.error('ログインエラー詳細:', {
        error: error,
        code: error?.code,
        message: error?.message,
        email: `${loginData.employeeId}@kanri.com`,
        errorType: typeof error,
        errorString: String(error)
      });
      
      // エラーオブジェクトが正しく取得できない場合
      if (!error || typeof error !== 'object') {
        throw new Error(`予期しないエラーが発生しました: ${String(error)}`);
      }
      
      // Firebase Authのエラーコードに応じてユーザー向けメッセージを返す
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          throw new Error('社員番号またはパスワードが正しくありません');
        case 'auth/too-many-requests':
          throw new Error('ログイン試行回数が上限に達しました。しばらく待ってから再試行してください');
        case 'auth/network-request-failed':
          throw new Error('ネットワークエラーが発生しました。接続を確認してください');
        case 'auth/invalid-email':
          throw new Error('メールアドレスの形式が正しくありません');
        default:
          throw new Error(`ログインに失敗しました: ${error.code || 'unknown error'}`);
      }
    }
  }
  
  /**
   * 新規ユーザー登録（セルフサインアップ）
   * 通常は管理者のみが実行すべき処理
   */
  static async register(registrationData: {
    employeeId: string;
    password: string;
    name: string;
  }): Promise<User> {
    try {
      const { employeeId, password, name } = registrationData;
      const email = `${employeeId}@kanri.com`;
      
      // Firebase Authenticationでユーザー作成
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Firestoreにユーザーデータ作成
      const userData = {
        employeeId,
        name,
        isAttending: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await setDoc(doc(db, 'users', firebaseUser.uid), userData);
      
      return {
        id: firebaseUser.uid,
        ...userData
      };
      
    } catch (error: any) {
      console.error('ユーザー登録エラー:', error);
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          throw new Error('この社員番号は既に使用されています');
        case 'auth/weak-password':
          throw new Error('パスワードは6文字以上で入力してください');
        default:
          throw new Error('ユーザー登録に失敗しました');
      }
    }
  }

  /**
   * 管理者として新しいユーザーを作成（現在のログインユーザーを保持）
   */
  static async registerWithoutLogin(registrationData: {
    employeeId: string;
    password: string;
    name: string;
  }, originalUser: FirebaseUser): Promise<User> {
    try {
      const { employeeId, password, name } = registrationData;
      const email = `${employeeId}@kanri.com`;
      
      // Firebase Authenticationでユーザー作成
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Firestoreにユーザーデータ作成
      const userData = {
        employeeId,
        name,
        isAttending: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await setDoc(doc(db, 'users', firebaseUser.uid), userData);
      
      // 元のユーザーに戻す
      await updateCurrentUser(auth, originalUser);
      
      return {
        id: firebaseUser.uid,
        ...userData
      };
      
    } catch (error: any) {
      console.error('ユーザー登録エラー:', error);
      
      // 元のユーザーに戻そうとする
      try {
        await updateCurrentUser(auth, originalUser);
      } catch (restoreError) {
        console.error('元のユーザーに戻すことができませんでした:', restoreError);
      }
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          throw new Error('この社員番号は既に使用されています');
        case 'auth/weak-password':
          throw new Error('パスワードは6文字以上で入力してください');
        default:
          throw new Error('ユーザー登録に失敗しました');
      }
    }
  }
  
  /**
   * ログアウト
   */
  static async logout(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('ログアウトエラー:', error);
      throw new Error('ログアウトに失敗しました');
    }
  }
  
  /**
   * Firestoreからユーザーデータを取得
   */
  static async getUserData(uid: string): Promise<User | null> {
    try {
      console.log('Firestoreからユーザーデータを取得中:', uid);
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        console.log('Firestoreからユーザーデータを取得成功:', data);
        return {
          id: uid,
          employeeId: data.employeeId,
          name: data.name,
          isAttending: data.isAttending || false,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        };
      }
      
      console.log('Firestoreにユーザーデータが存在しません');
      return null;
    } catch (error) {
      console.error('ユーザーデータ取得エラー詳細:', {
        error,
        uid,
        message: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
  
  /**
   * 新規ユーザーをFirestoreに作成
   * 注意: 実際の運用では管理者権限が必要
   */
  static async createUser(userData: {
    uid: string;
    employeeId: string;
    name: string;
  }): Promise<void> {
    try {
      const userRef = doc(db, 'users', userData.uid);
      await setDoc(userRef, {
        employeeId: userData.employeeId,
        name: userData.name,
        isAttending: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('ユーザー作成エラー:', error);
      throw new Error('ユーザーの作成に失敗しました');
    }
  }
  
  /**
   * 認証状態の変更を監視
   */
  static onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  }
  
  /**
   * 現在のログインユーザーを取得
   */
  static getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }
}