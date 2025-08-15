import React, { useState, useEffect } from 'react';
import { User, Department, Division, EmployeeType, MasterData } from '../types';
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
  department?: Department;
  division?: Division;
  employeeType?: EmployeeType;
  role?: string;
}

// デフォルトのマスターデータ（フォールバック用）
const DEFAULT_DEPARTMENTS: Department[] = [
  '総務部', '人事部', '経理部', '開発部', '営業部', 
  'マーケティング部', '品質管理部', '情報システム部'
];

const DEFAULT_DIVISIONS: Division[] = [
  '業務課', '総務課', '人事課', '経理企画課', 'システム開発課',
  'フロントエンド開発課', 'バックエンド開発課', '営業企画課', '顧客対応課',
  'デジタルマーケティング課', 'PR広報課', 'QA課', 'インフラ管理課'
];

const DEFAULT_EMPLOYEE_TYPES: EmployeeType[] = [
  '正社員', '契約社員', 'パートタイム', 'アルバイト', 
  '派遣社員', '業務委託', 'インターン'
];

const DEFAULT_ROLES: string[] = [
  '管理者', '部長', '課長', '主任', 'メンバー'
];

/**
 * メンバー管理画面コンポーネント
 * メンバーの一覧表示、新規登録、削除機能を提供
 * （出退勤打刻は専用ページで管理）
 */
export const MemberManagement: React.FC<MemberManagementProps> = ({
  currentUser
}) => {
  // 状態管理
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [deletingUserId, setDeletingUserId] = useState<string>('');
  
  // 動的マスターデータの状態
  const [masterData, setMasterData] = useState<{
    departments: string[];
    divisions: string[];
    employeeTypes: string[];
    roles: string[];
  }>({
    departments: DEFAULT_DEPARTMENTS,
    divisions: DEFAULT_DIVISIONS,
    employeeTypes: DEFAULT_EMPLOYEE_TYPES,
    roles: DEFAULT_ROLES
  });
  
  // メンバー追加関連の状態
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formData, setFormData] = useState<MemberFormData>({
    name: '',
    employeeId: '',
    password: '',
    department: undefined,
    division: undefined,
    employeeType: undefined,
    role: undefined
  });

  // メンバー編集関連の状態
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editing, setEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    department?: Department;
    division?: Division;
    employeeType?: EmployeeType;
    role?: string;
  }>({
    name: '',
    department: undefined,
    division: undefined,
    employeeType: undefined,
    role: undefined
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
   * マスターデータを読み込み
   */
  const loadMasterData = async () => {
    try {
      const [departments, divisions, employeeTypes, roles] = await Promise.all([
        FirestoreService.getMasterData('department').catch(() => []),
        FirestoreService.getMasterData('division').catch(() => []),
        FirestoreService.getMasterData('employeeType').catch(() => []),
        FirestoreService.getMasterData('role').catch(() => [])
      ]);

      setMasterData({
        departments: departments.length > 0 
          ? departments.map((d: MasterData) => d.value as Department)
          : DEFAULT_DEPARTMENTS,
        divisions: divisions.length > 0 
          ? divisions.map((d: MasterData) => d.value as Division)
          : DEFAULT_DIVISIONS,
        employeeTypes: employeeTypes.length > 0 
          ? employeeTypes.map((d: MasterData) => d.value as EmployeeType)
          : DEFAULT_EMPLOYEE_TYPES,
        roles: roles.length > 0 
          ? roles.map((d: MasterData) => d.value)
          : DEFAULT_ROLES
      });
    } catch (err: any) {
      console.error('マスターデータ取得エラー:', err);
      // エラーの場合はデフォルト値を使用
    }
  };

  /**
   * コンポーネント初期化時にユーザー一覧とマスターデータを取得
   */
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([loadUsers(), loadMasterData()]);
    };
    initializeData();
  }, []);


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
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value || undefined
    }));
  };

  /**
   * 編集フォームの入力値を更新
   */
  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value || undefined
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
        name: formData.name,
        department: formData.department,
        division: formData.division,
        employeeType: formData.employeeType,
        role: formData.role
      }, originalUser);

      console.log('新しいメンバーが作成されました:', newUser);

      // ローカル状態に追加
      setUsers(prev => [...prev, newUser]);

      // フォームをリセット
      setFormData({
        name: '',
        employeeId: '',
        password: '',
        department: undefined,
        division: undefined,
        employeeType: undefined,
        role: undefined
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
      password: '',
      department: undefined,
      division: undefined,
      employeeType: undefined,
      role: undefined
    });
    setShowAddForm(false);
    setError('');
  };

  /**
   * メンバー編集を開始
   */
  const handleStartEdit = (user: User) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name,
      department: user.department,
      division: user.division,
      employeeType: user.employeeType,
      role: user.role
    });
    setShowEditForm(true);
    setError('');
  };

  /**
   * メンバー編集をキャンセル
   */
  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditFormData({
      name: '',
      department: undefined,
      division: undefined,
      employeeType: undefined,
      role: undefined
    });
    setShowEditForm(false);
    setError('');
  };

  /**
   * メンバー情報を更新
   */
  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingUser) return;
    
    if (!editFormData.name.trim()) {
      setError('氏名を入力してください');
      return;
    }

    try {
      setEditing(true);
      setError('');

      // Firestoreでユーザー情報を更新
      const updatedUser: User = {
        ...editingUser,
        name: editFormData.name,
        department: editFormData.department,
        division: editFormData.division,
        employeeType: editFormData.employeeType,
        role: editFormData.role as any,
        updatedAt: new Date()
      };

      await FirestoreService.updateUser(editingUser.id, {
        name: editFormData.name,
        department: editFormData.department,
        division: editFormData.division,
        employeeType: editFormData.employeeType,
        role: editFormData.role as any,
        updatedAt: new Date()
      });

      // ローカル状態を更新
      setUsers(prev => prev.map(user => 
        user.id === editingUser.id ? updatedUser : user
      ));

      console.log('メンバー情報が更新されました:', updatedUser);

      // フォームを閉じる
      handleCancelEdit();

    } catch (err: any) {
      console.error('メンバー更新エラー:', err);
      setError(err.message || 'メンバー情報の更新に失敗しました');
    } finally {
      setEditing(false);
    }
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
              
              {/* 新しいステータスフィールド */}
              <div className="form-group">
                <label htmlFor="department">所属部署</label>
                <select
                  id="department"
                  name="department"
                  value={formData.department || ''}
                  onChange={handleFormChange}
                  disabled={adding}
                >
                  <option value="">未選択</option>
                  {masterData.departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="division">所属課</label>
                <select
                  id="division"
                  name="division"
                  value={formData.division || ''}
                  onChange={handleFormChange}
                  disabled={adding}
                >
                  <option value="">未選択</option>
                  {masterData.divisions.map(div => (
                    <option key={div} value={div}>{div}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="employeeType">従業員区分</label>
                <select
                  id="employeeType"
                  name="employeeType"
                  value={formData.employeeType || ''}
                  onChange={handleFormChange}
                  disabled={adding}
                >
                  <option value="">未選択</option>
                  {masterData.employeeTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="role">権限</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role || ''}
                  onChange={handleFormChange}
                  disabled={adding}
                >
                  <option value="">未選択</option>
                  {masterData.roles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
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

      {/* メンバー編集フォーム */}
      {showEditForm && editingUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>メンバー情報を編集</h3>
              <button 
                onClick={handleCancelEdit}
                className="close-button"
              >×</button>
            </div>
            
            <form onSubmit={handleUpdateMember} className="member-form">
              <div className="form-group">
                <label htmlFor="edit-name">氏名 *</label>
                <input
                  type="text"
                  id="edit-name"
                  name="name"
                  value={editFormData.name}
                  onChange={handleEditFormChange}
                  placeholder="山田太郎"
                  required
                  disabled={editing}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="edit-employeeId">社員番号</label>
                <input
                  type="text"
                  id="edit-employeeId"
                  value={editingUser.employeeId}
                  placeholder="0030228"
                  disabled
                  className="readonly-field"
                />
                <small className="form-hint">社員番号は変更できません</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="edit-department">所属部署</label>
                <select
                  id="edit-department"
                  name="department"
                  value={editFormData.department || ''}
                  onChange={handleEditFormChange}
                  disabled={editing}
                >
                  <option value="">未選択</option>
                  {masterData.departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="edit-division">所属課</label>
                <select
                  id="edit-division"
                  name="division"
                  value={editFormData.division || ''}
                  onChange={handleEditFormChange}
                  disabled={editing}
                >
                  <option value="">未選択</option>
                  {masterData.divisions.map(div => (
                    <option key={div} value={div}>{div}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="edit-employeeType">従業員区分</label>
                <select
                  id="edit-employeeType"
                  name="employeeType"
                  value={editFormData.employeeType || ''}
                  onChange={handleEditFormChange}
                  disabled={editing}
                >
                  <option value="">未選択</option>
                  {masterData.employeeTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit-role">権限</label>
                <select
                  id="edit-role"
                  name="role"
                  value={editFormData.role || ''}
                  onChange={handleEditFormChange}
                  disabled={editing}
                >
                  <option value="">未選択</option>
                  {masterData.roles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={handleCancelEdit} 
                  className="cancel-button"
                  disabled={editing}
                >
                  キャンセル
                </button>
                <button 
                  type="submit" 
                  className="submit-button"
                  disabled={editing}
                >
                  {editing ? '更新中...' : '更新する'}
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
                
                {/* 新しいステータス情報表示 */}
                <div className="member-details">
                  {user.department && (
                    <span className="status-info department">
                      🏢 {user.department}
                    </span>
                  )}
                  {user.division && (
                    <span className="status-info division">
                      📋 {user.division}
                    </span>
                  )}
                  {user.employeeType && (
                    <span className="status-info employee-type">
                      👤 {user.employeeType}
                    </span>
                  )}
                </div>
                
                <div className="member-status">
                  <span className={`status-badge ${getAttendanceStatusClass(user.isAttending)}`}>
                    {getAttendanceStatusText(user.isAttending)}
                  </span>
                </div>
              </div>

              <div className="member-actions">
                <button
                  onClick={() => handleStartEdit(user)}
                  disabled={editing}
                  className="edit-member-btn"
                  title={`${user.name}を編集`}
                >
                  ✏️
                </button>
                {user.id !== currentUser.id && (
                  <button
                    onClick={() => handleDeleteMember(user)}
                    disabled={deletingUserId === user.id}
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