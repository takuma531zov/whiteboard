import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { FirestoreService } from '../services/firestoreService';
import { AuthService } from '../services/authService';
import './MemberManagement.css';

// メンバー管理画面のプロパティ
interface MemberManagementProps {
  currentUser: User;
}

// メンバー追加フォームの型
interface MemberFormData {
  name: string;
  employeeId: string;
  password: string;
}

/**
 * メンバー管理画面コンポーネント
 * 出勤メンバーの管理と出勤状況の切替を行う
 */
export const MemberManagement: React.FC<MemberManagementProps> = ({
  currentUser
}) => {
  // 状態管理
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [updatingUserId, setUpdatingUserId] = useState<string>('');
  const [deletingUserId, setDeletingUserId] = useState<string>('');
  
  // メンバー追加関連の状態
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formData, setFormData] = useState<MemberFormData>({
    name: '',
    employeeId: '',
    password: ''
  });

  /**
   * ユーザー一覧を取得
   */
  const loadUsers = async () => {
    try {
      setLoading(true);
      const userList = await FirestoreService.getAllUsers();
      setUsers(userList);
      setError('');
    } catch (err: any) {
      console.error('ユーザー取得エラー:', err);
      setError('ユーザー情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  /**
   * コンポーネント初期化時にユーザー一覧を取得
   */
  useEffect(() => {
    loadUsers();
  }, []);

  /**
   * 出勤状況を切り替える
   */
  const toggleAttendance = async (userId: string, currentStatus: boolean) => {
    try {
      setUpdatingUserId(userId);
      await FirestoreService.updateUserAttendance(userId, !currentStatus);
      
      // ローカル状態を更新
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId 
            ? { ...user, isAttending: !currentStatus }
            : user
        )
      );
    } catch (err: any) {
      console.error('出勤状況更新エラー:', err);
      setError('出勤状況の更新に失敗しました');
    } finally {
      setUpdatingUserId('');
    }
  };

  /**
   * 出勤中のメンバー数を取得
   */
  const getAttendingCount = () => {
    return users.filter(user => user.isAttending).length;
  };

  /**
   * 出勤状況のステータス表示
   */
  const getAttendanceStatusText = (isAttending: boolean) => {
    return isAttending ? '出勤中' : '退勤';
  };

  /**
   * 出勤状況のステータスクラス
   */
  const getAttendanceStatusClass = (isAttending: boolean) => {
    return isAttending ? 'status-attending' : 'status-absent';
  };

  /**
   * フォームの入力値を更新
   */
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  /**
   * 社員番号のバリデーション
   */
  const validateEmployeeId = (employeeId: string): boolean => {
    // 社員番号は数字のみ、7桁
    return /^\d{7}$/.test(employeeId);
  };

  /**
   * 新しいメンバーを追加
   */
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('氏名を入力してください');
      return;
    }

    if (!validateEmployeeId(formData.employeeId)) {
      setError('社員番号は7桁の数字で入力してください');
      return;
    }

    if (formData.password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    try {
      setAdding(true);
      setError('');

      // 現在のユーザー情報を保存
      const originalUser = AuthService.getCurrentUser();
      if (!originalUser) {
        throw new Error('現在のログインユーザーが見つかりません');
      }

      // Firebase Authentication + Firestoreにユーザー作成（ログイン状態を保持）
      const newUser = await AuthService.registerWithoutLogin({
        employeeId: formData.employeeId,
        password: formData.password,
        name: formData.name
      }, originalUser);

      console.log('新しいメンバーが作成されました:', newUser);

      // ローカル状態に追加
      setUsers(prev => [...prev, newUser]);

      // フォームをリセット
      setFormData({
        name: '',
        employeeId: '',
        password: ''
      });
      setShowAddForm(false);

    } catch (err: any) {
      console.error('メンバー追加エラー:', err);
      setError(err.message || 'メンバーの追加に失敗しました');
    } finally {
      setAdding(false);
    }
  };

  /**
   * メンバー追加をキャンセル
   */
  const handleCancelAdd = () => {
    setFormData({
      name: '',
      employeeId: '',
      password: ''
    });
    setShowAddForm(false);
    setError('');
  };

  /**
   * メンバーを削除
   */
  const handleDeleteMember = async (user: User) => {
    // 自分自身は削除できない
    if (user.id === currentUser.id) {
      setError('自分自身は削除できません');
      return;
    }

    // 確認ダイアログ
    const confirmMessage = `本当に「${user.name}」（社員番号: ${user.employeeId}）を削除しますか？\n\nこの操作は取り消せません。`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setDeletingUserId(user.id);
      setError('');

      // Firestoreからユーザーを削除
      await FirestoreService.deleteUser(user.id);

      // ローカル状態から削除
      setUsers(prev => prev.filter(u => u.id !== user.id));

      console.log('メンバーが削除されました:', user);

    } catch (err: any) {
      console.error('メンバー削除エラー:', err);
      setError(err.message || 'メンバーの削除に失敗しました');
    } finally {
      setDeletingUserId('');
    }
  };

  // ローディング表示
  if (loading) {
    return (
      <div className="member-management">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>メンバー情報を読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="member-management">
      {/* ヘッダー */}
      <div className="management-header">
        <div className="header-left">
          <h2>メンバー管理</h2>
          <div className="summary-stats">
            <div className="stat-item">
              <span className="stat-label">総メンバー数</span>
              <span className="stat-value">{users.length}人</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">出勤中</span>
              <span className="stat-value attending">{getAttendingCount()}人</span>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setShowAddForm(true)}
          className="add-member-button"
          disabled={adding}
        >
          + 新しいメンバー
        </button>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      {/* メンバー追加フォーム */}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>新しいメンバーを追加</h3>
              <button 
                onClick={handleCancelAdd}
                className="close-button"
              >×</button>
            </div>
            
            <form onSubmit={handleAddMember} className="member-form">
              <div className="form-group">
                <label htmlFor="name">氏名 *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder="山田太郎"
                  required
                  disabled={adding}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="employeeId">社員番号 *</label>
                <input
                  type="text"
                  id="employeeId"
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleFormChange}
                  placeholder="0030228"
                  maxLength={7}
                  required
                  disabled={adding}
                />
                <small className="form-hint">7桁の数字で入力してください</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="password">初期パスワード *</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleFormChange}
                  placeholder="6文字以上"
                  minLength={6}
                  required
                  disabled={adding}
                />
              </div>
              
              <div className="email-preview">
                <label>メールアドレス (自動生成)</label>
                <div className="email-display">
                  {formData.employeeId ? `${formData.employeeId}@kanri.com` : '(社員番号)@kanri.com'}
                </div>
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={handleCancelAdd} 
                  className="cancel-button"
                  disabled={adding}
                >
                  キャンセル
                </button>
                <button 
                  type="submit" 
                  className="submit-button"
                  disabled={adding}
                >
                  {adding ? 'メンバー追加中...' : 'メンバーを追加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* メンバー一覧 */}
      <div className="member-list">
        {users.length === 0 ? (
          <div className="empty-state">
            <p>登録されているメンバーがいません</p>
          </div>
        ) : (
          users.map(user => (
            <div key={user.id} className="member-card">
              <div className="member-info">
                <div className="member-basic">
                  <h3 className="member-name">{user.name}</h3>
                  <span className="member-id">ID: {user.employeeId}</span>
                </div>
                
                <div className="member-status">
                  <span className={`status-badge ${getAttendanceStatusClass(user.isAttending)}`}>
                    {getAttendanceStatusText(user.isAttending)}
                  </span>
                </div>
              </div>

              <div className="member-actions">
                <button
                  onClick={() => toggleAttendance(user.id, user.isAttending)}
                  disabled={updatingUserId === user.id || deletingUserId === user.id}
                  className={`attendance-toggle ${user.isAttending ? 'checkout' : 'checkin'}`}
                >
                  {updatingUserId === user.id ? (
                    '更新中...'
                  ) : user.isAttending ? (
                    '退勤する'
                  ) : (
                    '出勤する'
                  )}
                </button>
                
                {user.id !== currentUser.id && (
                  <button
                    onClick={() => handleDeleteMember(user)}
                    disabled={deletingUserId === user.id || updatingUserId === user.id}
                    className="delete-member-btn"
                    title={`${user.name}を削除`}
                  >
                    {deletingUserId === user.id ? '削除中...' : '🗑️'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* フッター */}
      <div className="management-footer">
        <button onClick={loadUsers} className="refresh-button" disabled={loading}>
          <span>🔄</span> 最新情報に更新
        </button>
      </div>
    </div>
  );
};