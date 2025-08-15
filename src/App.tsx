import { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { LoginPage } from './components/LoginPage';
import { MemberManagement } from './components/MemberManagement';
import { TaskManagement } from './components/TaskManagement';
import { WhiteboardMain } from './components/WhiteboardMain';
import { AttendanceTracker } from './components/AttendanceTracker';
import { MasterDataManagement } from './components/MasterDataManagement';
import { AuthService } from './services/authService';
import { User, LoginFormData } from './types';
import { debugFirebaseConfig } from './utils/debugFirebase';
import { initializeMasterData } from './utils/initMasterData';
import './utils/manualTest'; // 手動テスト関数をロード
import './App.css';

/**
 * メインアプリケーションコンポーネント
 * 認証状態に基づいてログイン画面またはメイン画面を表示
 */
function App() {
  // 認証関連の状態
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<'main' | 'members' | 'tasks' | 'whiteboard' | 'attendance' | 'masterdata'>('whiteboard');

  /**
   * 認証状態の初期化と監視
   */
  useEffect(() => {
    // Firebase設定確認（デバッグ用）
    debugFirebaseConfig();
    
    // マスターデータ初期化（バックグラウンドで実行）
    initializeMasterData();
    
    const unsubscribe = AuthService.onAuthStateChanged(async (user) => {
      setFirebaseUser(user);
      
      if (user) {
        // ログイン済みの場合、Firestoreからユーザーデータを取得
        const userData = await AuthService.getUserData(user.uid);
        setCurrentUser(userData);
      } else {
        // ログアウト状態
        setCurrentUser(null);
      }
      
      setIsLoading(false);
    });

    // クリーンアップ関数を返す
    return () => unsubscribe();
  }, []);

  /**
   * ログイン処理
   */
  const handleLogin = async (loginData: LoginFormData) => {
    setLoginLoading(true);
    setLoginError('');
    
    try {
      const user = await AuthService.login(loginData);
      setCurrentUser(user);
      // 認証状態の変更は onAuthStateChanged で自動的に処理される
    } catch (error: any) {
      console.error('ログインエラー:', error);
      setLoginError(error.message || 'ログインに失敗しました');
    } finally {
      setLoginLoading(false);
    }
  };

  /**
   * ログアウト処理
   */
  const handleLogout = async () => {
    try {
      await AuthService.logout();
      setCurrentUser(null);
    } catch (error: any) {
      console.error('ログアウトエラー:', error);
      // ログアウトエラーは通常表示しない（強制的にログアウト状態にする）
      setCurrentUser(null);
    }
  };

  // 初期ローディング表示
  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  // 未ログイン時はログイン画面を表示
  if (!currentUser || !firebaseUser) {
    return (
      <LoginPage
        onLogin={handleLogin}
        isLoading={loginLoading}
        error={loginError}
      />
    );
  }

  // ページ別コンテンツをレンダリング
  const renderPageContent = () => {
    switch (currentPage) {
      case 'members':
        return <MemberManagement currentUser={currentUser} />;
      case 'tasks':
        return <TaskManagement currentUser={currentUser} />;
      case 'whiteboard':
        return <WhiteboardMain currentUser={currentUser} />;
      case 'attendance':
        return <AttendanceTracker currentUser={currentUser} firebaseUser={firebaseUser} />;
      case 'masterdata':
        return <MasterDataManagement />;
      default:
        return (
          <div className="welcome-message">
            <h2>ホワイトボード タスク管理システム</h2>
            <p>メニューから機能を選択してください：</p>
            <div className="feature-cards">
              <div className="feature-card" onClick={() => setCurrentPage('whiteboard')}>
                <h3>🎯 ホワイトボード</h3>
                <p>メインタスクとD&Dでのタスク管理</p>
              </div>
              <div className="feature-card" onClick={() => setCurrentPage('members')}>
                <h3>👥 メンバー管理</h3>
                <p>出勤メンバーの管理と出勤状況の切替</p>
              </div>
              <div className="feature-card" onClick={() => setCurrentPage('tasks')}>
                <h3>📋 タスク管理</h3>
                <p>日時・週次・メインタスクの作成と管理</p>
              </div>
              <div className="feature-card" onClick={() => setCurrentPage('attendance')}>
                <h3>🕰️ 出退勤打刻</h3>
                <p>KOT代替の出退勤タイムスタンプ記録</p>
              </div>
            </div>
          </div>
        );
    }
  };

  // ログイン済みの場合のメイン画面
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 onClick={() => setCurrentPage('main')} className="app-title">
            ホワイトボード タスク管理
          </h1>
          <nav className="main-nav">
            <button 
              onClick={() => setCurrentPage('whiteboard')}
              className={currentPage === 'whiteboard' ? 'nav-button active' : 'nav-button'}
            >
              🎯 ホワイトボード
            </button>
            <button 
              onClick={() => setCurrentPage('members')}
              className={currentPage === 'members' ? 'nav-button active' : 'nav-button'}
            >
              👥 メンバー管理
            </button>
            <button 
              onClick={() => setCurrentPage('tasks')}
              className={currentPage === 'tasks' ? 'nav-button active' : 'nav-button'}
            >
              📋 タスク管理
            </button>
            <button 
              onClick={() => setCurrentPage('attendance')}
              className={currentPage === 'attendance' ? 'nav-button active' : 'nav-button'}
            >
              🕰️ 出退勤
            </button>
            <button 
              onClick={() => setCurrentPage('masterdata')}
              className={currentPage === 'masterdata' ? 'nav-button active' : 'nav-button'}
            >
              ⚙️ マスタ管理
            </button>
            <button 
              onClick={() => setCurrentPage('main')}
              className={currentPage === 'main' ? 'nav-button active' : 'nav-button'}
            >
              ℹ️ ホーム
            </button>
          </nav>
        </div>
        
        <div className="user-info">
          <span>ようこそ、{currentUser.name}さん</span>
          <span className="employee-id">ID: {currentUser.employeeId}</span>
          <button onClick={handleLogout} className="logout-button">
            ログアウト
          </button>
        </div>
      </header>

      <main className="app-main">
        {renderPageContent()}
      </main>
    </div>
  );
}

export default App;