import React, { useState, useEffect } from 'react';
import { User, Task, TaskType, TaskStatus, TaskColor, DayOfWeek } from '../types';
import { FirestoreService } from '../services/firestoreService';
import './TaskManagement.css';

// タスク管理画面のプロパティ
interface TaskManagementProps {
  currentUser: User;
}

// タスク作成フォームの型
interface TaskFormData {
  title: string;
  description: string;
  type: TaskType;
  assignedUserIds: string[];
  dueDate: string; // 週次タスク用（非推奨、後方互換性のため残存）
  weeklyDayOfWeek: DayOfWeek; // 週次タスクの曜日
  color: TaskColor; // タスクの背景色
}

/**
 * タスク管理画面コンポーネント
 * タスクの作成・編集・削除を行う
 */
export const TaskManagement: React.FC<TaskManagementProps> = ({
  currentUser
}) => {
  // 状態管理
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTaskType, setSelectedTaskType] = useState<TaskType | 'all'>('all');
  const [showEditAssignModal, setShowEditAssignModal] = useState(false);
  const [editingAssignTask, setEditingAssignTask] = useState<Task | null>(null);
  const [tempAssignedUserIds, setTempAssignedUserIds] = useState<string[]>([]);
  
  // タスク編集関連
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editFormData, setEditFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    type: 'daily',
    assignedUserIds: [],
    dueDate: '',
    weeklyDayOfWeek: 'friday',
    color: 'default'
  });

  // フォーム状態
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    type: 'daily',
    assignedUserIds: [],
    dueDate: '',
    weeklyDayOfWeek: 'friday',
    color: 'default'
  });

  /**
   * 初期データの読み込み
   */
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    
    const setupSubscriptions = async () => {
      cleanup = await loadInitialData();
    };
    
    setupSubscriptions();
    
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  /**
   * 初期データの読み込み（リアルタイム更新対応）
   */
  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // リアルタイム更新を設定
      const unsubscribeTasks = FirestoreService.subscribeToTasks((updatedTasks) => {
        console.log('タスクリアルタイム更新:', updatedTasks);
        // 各タスクの担当者情報をログ出力
        updatedTasks.forEach(task => {
          if (task.assignedUserIds && task.assignedUserIds.length > 0) {
            console.log(`タスク ${task.title} の担当者:`, task.assignedUserIds);
          }
        });
        setTasks(updatedTasks);
      });
      
      const unsubscribeUsers = FirestoreService.subscribeToUsers((updatedUsers) => {
        console.log('ユーザーリアルタイム更新:', updatedUsers);
        setUsers(updatedUsers);
      });
      
      // クリーンアップ関数を保存
      return () => {
        unsubscribeTasks();
        unsubscribeUsers();
      };
      
    } catch (err: any) {
      console.error('データ読み込みエラー:', err);
      setError('データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  /**
   * フォームの入力値を更新
   */
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  /**
   * 担当者選択の変更を処理
   */
  const handleAssignedUsersChange = (userId: string) => {
    setFormData(prev => {
      const newAssignedUserIds = prev.assignedUserIds.includes(userId)
        ? prev.assignedUserIds.filter(id => id !== userId)
        : [...prev.assignedUserIds, userId];
      
      return {
        ...prev,
        assignedUserIds: newAssignedUserIds
      };
    });
  };

  /**
   * 担当者編集モーダル用の選択変更を処理
   */
  const handleTempAssignedUsersChange = (userId: string) => {
    setTempAssignedUserIds(prev => {
      return prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId];
    });
  };

  /**
   * 担当者編集を開始
   */
  const startEditAssign = (task: Task) => {
    setEditingAssignTask(task);
    
    // 存在するユーザーIDのみをフィルタリング
    const validUserIds = (task.assignedUserIds || []).filter(id => {
      const user = users.find(u => u.id === id);
      return user !== undefined;
    });
    
    setTempAssignedUserIds(validUserIds);
    setShowEditAssignModal(true);
  };

  /**
   * 担当者編集をキャンセル
   */
  const cancelEditAssign = () => {
    setShowEditAssignModal(false);
    setEditingAssignTask(null);
    setTempAssignedUserIds([]);
  };

  /**
   * タスク編集を開始
   */
  const startEditTask = (task: Task) => {
    setEditingTask(task);
    setEditFormData({
      title: task.title,
      description: task.description || '',
      type: task.type,
      assignedUserIds: task.assignedUserIds || [],
      dueDate: task.dueDate ? task.dueDate.toISOString().split('T')[0] : '',
      weeklyDayOfWeek: task.weeklyDayOfWeek || 'friday',
      color: task.color || 'default'
    });
    setShowEditTaskModal(true);
  };

  /**
   * タスク編集をキャンセル
   */
  const cancelEditTask = () => {
    setShowEditTaskModal(false);
    setEditingTask(null);
    setEditFormData({
      title: '',
      description: '',
      type: 'daily',
      assignedUserIds: [],
      dueDate: '',
      weeklyDayOfWeek: 'friday',
      color: 'default'
    });
  };

  /**
   * タスク編集を保存
   */
  const saveTaskEdit = async () => {
    if (!editingTask) return;

    if (!editFormData.title.trim()) {
      setError('タスク名を入力してください');
      return;
    }

    try {
      const updateData = {
        title: editFormData.title,
        description: editFormData.description,
        type: editFormData.type,
        assignedUserIds: editFormData.assignedUserIds.length > 0 ? editFormData.assignedUserIds : undefined,
        dueDate: editFormData.dueDate && editFormData.type === 'weekly' ? new Date(editFormData.dueDate) : undefined,
        weeklyDayOfWeek: editFormData.type === 'weekly' ? editFormData.weeklyDayOfWeek : undefined,
        color: editFormData.color !== 'default' ? editFormData.color : undefined
      };

      await FirestoreService.updateTask(editingTask.id, updateData);

      cancelEditTask();
      setError('');
    } catch (err: any) {
      console.error('タスク更新エラー:', err);
      setError('タスクの更新に失敗しました');
    }
  };

  /**
   * 編集フォームの入力値を更新
   */
  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  /**
   * 編集フォームの担当者選択変更
   */
  const handleEditAssignedUsersChange = (userId: string) => {
    setEditFormData(prev => {
      const newAssignedUserIds = prev.assignedUserIds.includes(userId)
        ? prev.assignedUserIds.filter(id => id !== userId)
        : [...prev.assignedUserIds, userId];
      
      return {
        ...prev,
        assignedUserIds: newAssignedUserIds
      };
    });
  };

  /**
   * 担当者編集を保存
   */
  const saveAssignEdit = async () => {
    if (!editingAssignTask) return;

    try {
      // 存在するユーザーIDのみをフィルタリング
      const validUserIds = tempAssignedUserIds.filter(id => {
        const user = users.find(u => u.id === id);
        return user !== undefined;
      });

      console.log('担当者更新:', {
        taskId: editingAssignTask.id,
        validUserIds,
        originalIds: tempAssignedUserIds
      });

      await FirestoreService.updateTask(editingAssignTask.id, {
        assignedUserIds: validUserIds.length > 0 ? validUserIds : undefined
      });

      // リアルタイム購読が変更を自動で反映するため、
      // ローカル状態の手動更新は不要

      cancelEditAssign();
      setError('');
    } catch (err: any) {
      console.error('担当者更新エラー:', err);
      setError('担当者の更新に失敗しました');
    }
  };

  /**
   * 新しいタスクを作成
   */
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('タスク名を入力してください');
      return;
    }

    try {
      const taskData = {
        title: formData.title,
        description: formData.description,
        type: formData.type,
        status: 'todo' as TaskStatus,
        assignedUserIds: formData.assignedUserIds.length > 0 ? formData.assignedUserIds : undefined,
        createdBy: currentUser.id,
        dueDate: formData.dueDate && formData.type === 'weekly' ? new Date(formData.dueDate) : undefined,
        weeklyDayOfWeek: formData.type === 'weekly' ? formData.weeklyDayOfWeek : undefined,
        color: formData.color !== 'default' ? formData.color : undefined
      };

      await FirestoreService.createTask(taskData);
      
      // リアルタイム購読がタスクの追加を自動で反映するため、
      // ローカル状態の手動更新は不要
      
      // フォームをリセット
      setFormData({
        title: '',
        description: '',
        type: 'daily',
        assignedUserIds: [],
        dueDate: '',
        weeklyDayOfWeek: 'friday',
        color: 'default'
      });
      setShowCreateForm(false);
      setError('');
      
    } catch (err: any) {
      console.error('タスク作成エラー:', err);
      setError('タスクの作成に失敗しました');
    }
  };


  /**
   * タスクを削除
   */
  const deleteTask = async (taskId: string) => {
    if (!window.confirm('このタスクを削除しますか？')) {
      return;
    }

    try {
      await FirestoreService.deleteTask(taskId);
      // リアルタイム購読が削除を自動で反映するため、
      // ローカル状態の手動更新は不要
    } catch (err: any) {
      console.error('タスク削除エラー:', err);
      setError('タスクの削除に失敗しました');
    }
  };

  /**
   * フィルター済みタスク一覧を取得
   */
  const getFilteredTasks = () => {
    return selectedTaskType === 'all' 
      ? tasks 
      : tasks.filter(task => task.type === selectedTaskType);
  };

  /**
   * ユーザー名を取得（単一ユーザー用）
   */
  const getUserName = (userId?: string) => {
    if (!userId) return '不明なユーザー';
    const user = users.find(u => u.id === userId);
    return user?.name || '不明なユーザー';
  };

  /**
   * 担当者名を取得（複数ユーザー対応）
   */
  const getAssignedUsersText = (userIds?: string[]) => {
    if (!userIds || userIds.length === 0) return '未アサイン';
    
    // 存在するユーザーのみをフィルタリング
    const validUserIds = userIds.filter(id => {
      const user = users.find(u => u.id === id);
      return user !== undefined;
    });
    
    if (validUserIds.length === 0) return '未アサイン（無効なユーザー）';
    
    if (validUserIds.length === 1) {
      return getUserName(validUserIds[0]);
    }
    
    if (validUserIds.length <= 3) {
      return validUserIds.map(id => getUserName(id)).join(', ');
    }
    
    // 4人以上の場合は省略表示
    const firstTwo = validUserIds.slice(0, 2).map(id => getUserName(id)).join(', ');
    return `${firstTwo} 他${validUserIds.length - 2}名`;
  };

  /**
   * タスク種別の表示名を取得
   */
  const getTaskTypeLabel = (type: TaskType) => {
    switch (type) {
      case 'daily': return '日時';
      case 'weekly': return '週次';
      case 'main': return 'メイン';
      default: return type;
    }
  };

  /**
   * タスクステータスの表示名を取得
   */
  const getTaskStatusLabel = (status: TaskStatus) => {
    switch (status) {
      case 'todo': return '未着手';
      case 'in_progress': return '進行中';
      case 'completed': return '完了';
      default: return status;
    }
  };

  /**
   * タスクステータスのクラス名を取得
   */
  const getTaskStatusClass = (status: TaskStatus) => {
    switch (status) {
      case 'todo': return 'status-todo';
      case 'in_progress': return 'status-progress';
      case 'completed': return 'status-completed';
      default: return '';
    }
  };

  /**
   * 期限切れかどうかをチェック（週次タスクの場合）
   */
  const isOverdue = (task: Task) => {
    if (task.type !== 'weekly' || task.status === 'completed') {
      return false;
    }
    
    // 曜日ベースの期限切れチェック
    if (task.weeklyDayOfWeek) {
      const today = new Date();
      const dayOfWeekMap = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6
      };
      
      const targetDayOfWeek = dayOfWeekMap[task.weeklyDayOfWeek];
      const todayDayOfWeek = today.getDay();
      
      // 設定曜日を過ぎているかチェック
      return todayDayOfWeek > targetDayOfWeek;
    }
    
    // 従来の日付ベース（後方互換性）
    if (task.dueDate) {
      return new Date() > task.dueDate;
    }
    
    return false;
  };

  /**
   * タスクの色クラス名を取得
   */
  const getTaskColorClass = (color?: TaskColor) => {
    if (!color || color === 'default') return '';
    return `task-color-${color}`;
  };

  /**
   * 曜日の表示名を取得
   */
  const getDayOfWeekLabel = (dayOfWeek: DayOfWeek) => {
    switch (dayOfWeek) {
      case 'monday': return '月曜日';
      case 'tuesday': return '火曜日';
      case 'wednesday': return '水曜日';
      case 'thursday': return '木曜日';
      case 'friday': return '金曜日';
      case 'saturday': return '土曜日';
      case 'sunday': return '日曜日';
      default: return dayOfWeek;
    }
  };

  /**
   * 曜日の選択肢を取得
   */
  const getDayOfWeekOptions = (): { value: DayOfWeek; label: string }[] => [
    { value: 'monday', label: '毎週月曜日' },
    { value: 'tuesday', label: '毎週火曜日' },
    { value: 'wednesday', label: '毎週水曜日' },
    { value: 'thursday', label: '毎週木曜日' },
    { value: 'friday', label: '毎週金曜日' },
    { value: 'saturday', label: '毎週土曜日' },
    { value: 'sunday', label: '毎週日曜日' }
  ];

  /**
   * 色の選択肢を取得
   */
  const getColorOptions = (): { value: TaskColor; label: string; preview: string }[] => [
    { value: 'default', label: 'デフォルト', preview: '#ffffff' },
    { value: 'blue', label: 'ブルー', preview: '#dbeafe' },
    { value: 'green', label: 'グリーン', preview: '#dcfce7' },
    { value: 'purple', label: 'パープル', preview: '#f3e8ff' },
    { value: 'pink', label: 'ピンク', preview: '#fce7f3' },
    { value: 'orange', label: 'オレンジ', preview: '#fed7aa' }
  ];

  // ローディング表示
  if (loading) {
    return (
      <div className="task-management">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>タスク情報を読み込み中...</p>
        </div>
      </div>
    );
  }

  const filteredTasks = getFilteredTasks();

  return (
    <div className="task-management">
      {/* ヘッダー */}
      <div className="management-header">
        <div className="header-left">
          <h2>タスク管理</h2>
          <div className="task-summary">
            <span className="summary-item">
              全体: {tasks.length}件
            </span>
            <span className="summary-item">
              未完了: {tasks.filter(t => t.status !== 'completed').length}件
            </span>
          </div>
        </div>
        
        <button 
          onClick={() => setShowCreateForm(true)}
          className="create-button"
        >
          + 新しいタスク
        </button>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      {/* フィルター */}
      <div className="filter-bar">
        <div className="filter-buttons">
          <button 
            onClick={() => setSelectedTaskType('all')}
            className={selectedTaskType === 'all' ? 'filter-btn active' : 'filter-btn'}
          >
            すべて ({tasks.length})
          </button>
          <button 
            onClick={() => setSelectedTaskType('daily')}
            className={selectedTaskType === 'daily' ? 'filter-btn active' : 'filter-btn'}
          >
            日時 ({tasks.filter(t => t.type === 'daily').length})
          </button>
          <button 
            onClick={() => setSelectedTaskType('weekly')}
            className={selectedTaskType === 'weekly' ? 'filter-btn active' : 'filter-btn'}
          >
            週次 ({tasks.filter(t => t.type === 'weekly').length})
          </button>
          <button 
            onClick={() => setSelectedTaskType('main')}
            className={selectedTaskType === 'main' ? 'filter-btn active' : 'filter-btn'}
          >
            メイン ({tasks.filter(t => t.type === 'main').length})
          </button>
        </div>
      </div>

      {/* 担当者編集モーダル */}
      {showEditAssignModal && editingAssignTask && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>担当者を編集 - {editingAssignTask.title}</h3>
              <button 
                onClick={cancelEditAssign}
                className="close-button"
              >×</button>
            </div>
            
            <div className="assign-edit-content">
              <div className="current-assignment">
                <h4>現在の担当者</h4>
                <div className="current-users">
                  {editingAssignTask.assignedUserIds && editingAssignTask.assignedUserIds.length > 0 ? (
                    editingAssignTask.assignedUserIds.map(userId => (
                      <span key={userId} className="current-user-badge">
                        {getUserName(userId)}
                      </span>
                    ))
                  ) : (
                    <span className="no-assignment">未アサイン</span>
                  )}
                </div>
              </div>
              
              <div className="new-assignment">
                <h4>新しい担当者を選択</h4>
                <div className="user-selection">
                  {users.map(user => (
                    <label key={user.id} className="user-checkbox">
                      <input
                        type="checkbox"
                        checked={tempAssignedUserIds.includes(user.id)}
                        onChange={() => handleTempAssignedUsersChange(user.id)}
                      />
                      <span className="checkbox-label">
                        {user.name} (ID: {user.employeeId})
                      </span>
                    </label>
                  ))}
                </div>
                
                {tempAssignedUserIds.length > 0 && (
                  <div className="selected-users">
                    変更後: {getAssignedUsersText(tempAssignedUserIds)}
                  </div>
                )}
                
                {tempAssignedUserIds.length === 0 && (
                  <div className="selected-users warning">
                    ⚠️ 担当者が未アサインになります
                  </div>
                )}
              </div>
              
              <div className="modal-actions">
                <button 
                  onClick={cancelEditAssign} 
                  className="cancel-button"
                >
                  キャンセル
                </button>
                <button 
                  onClick={saveAssignEdit} 
                  className="submit-button"
                >
                  担当者を更新
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* タスク作成フォーム */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>新しいタスクを作成</h3>
              <button 
                onClick={() => setShowCreateForm(false)}
                className="close-button"
              >×</button>
            </div>
            
            <form onSubmit={handleCreateTask} className="task-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="title">タスク名 *</label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleFormChange}
                    placeholder="タスク名を入力"
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="description">説明</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="タスクの詳細説明（オプション）"
                  rows={3}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="type">種別</label>
                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleFormChange}
                  >
                    <option value="daily">日時タスク</option>
                    <option value="weekly">週次タスク</option>
                    <option value="main">メインタスク</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="color">背景色</label>
                  <div className="color-selection">
                    {getColorOptions().map(colorOption => (
                      <label key={colorOption.value} className="color-option">
                        <input
                          type="radio"
                          name="color"
                          value={colorOption.value}
                          checked={formData.color === colorOption.value}
                          onChange={handleFormChange}
                        />
                        <div 
                          className="color-preview" 
                          style={{ backgroundColor: colorOption.preview }}
                          title={colorOption.label}
                        />
                        <span className="color-label">{colorOption.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="form-group">
                  <label>担当者（複数選択可）</label>
                  <div className="user-selection">
                    {users.map(user => (
                      <label key={user.id} className="user-checkbox">
                        <input
                          type="checkbox"
                          checked={formData.assignedUserIds.includes(user.id)}
                          onChange={() => handleAssignedUsersChange(user.id)}
                        />
                        <span className="checkbox-label">
                          {user.name} (ID: {user.employeeId})
                        </span>
                      </label>
                    ))}
                  </div>
                  {formData.assignedUserIds.length > 0 && (
                    <div className="selected-users">
                      選択中: {getAssignedUsersText(formData.assignedUserIds)}
                    </div>
                  )}
                </div>
              </div>
              
              {formData.type === 'weekly' && (
                <div className="form-group">
                  <label htmlFor="weeklyDayOfWeek">繰り返し曜日</label>
                  <select
                    id="weeklyDayOfWeek"
                    name="weeklyDayOfWeek"
                    value={formData.weeklyDayOfWeek}
                    onChange={handleFormChange}
                  >
                    {getDayOfWeekOptions().map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowCreateForm(false)} className="cancel-button">
                  キャンセル
                </button>
                <button type="submit" className="submit-button">
                  タスクを作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* タスク編集モーダル */}
      {showEditTaskModal && editingTask && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>タスクを編集</h3>
              <button 
                onClick={cancelEditTask}
                className="close-button"
              >×</button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); saveTaskEdit(); }} className="task-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="editTitle">タスク名 *</label>
                  <input
                    type="text"
                    id="editTitle"
                    name="title"
                    value={editFormData.title}
                    onChange={handleEditFormChange}
                    placeholder="タスク名を入力"
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="editDescription">説明</label>
                <textarea
                  id="editDescription"
                  name="description"
                  value={editFormData.description}
                  onChange={handleEditFormChange}
                  placeholder="タスクの詳細説明（オプション）"
                  rows={3}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="editType">種別</label>
                  <select
                    id="editType"
                    name="type"
                    value={editFormData.type}
                    onChange={handleEditFormChange}
                  >
                    <option value="daily">日時タスク</option>
                    <option value="weekly">週次タスク</option>
                    <option value="main">メインタスク</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="editColor">背景色</label>
                  <div className="color-selection">
                    {getColorOptions().map(colorOption => (
                      <label key={colorOption.value} className="color-option">
                        <input
                          type="radio"
                          name="color"
                          value={colorOption.value}
                          checked={editFormData.color === colorOption.value}
                          onChange={handleEditFormChange}
                        />
                        <div 
                          className="color-preview" 
                          style={{ backgroundColor: colorOption.preview }}
                          title={colorOption.label}
                        />
                        <span className="color-label">{colorOption.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="form-group">
                  <label>担当者（複数選択可）</label>
                  <div className="user-selection">
                    {users.map(user => (
                      <label key={user.id} className="user-checkbox">
                        <input
                          type="checkbox"
                          checked={editFormData.assignedUserIds.includes(user.id)}
                          onChange={() => handleEditAssignedUsersChange(user.id)}
                        />
                        <span className="checkbox-label">
                          {user.name} (ID: {user.employeeId})
                        </span>
                      </label>
                    ))}
                  </div>
                  {editFormData.assignedUserIds.length > 0 && (
                    <div className="selected-users">
                      選択中: {getAssignedUsersText(editFormData.assignedUserIds)}
                    </div>
                  )}
                </div>
              </div>
              
              {editFormData.type === 'weekly' && (
                <div className="form-group">
                  <label htmlFor="editWeeklyDayOfWeek">繰り返し曜日</label>
                  <select
                    id="editWeeklyDayOfWeek"
                    name="weeklyDayOfWeek"
                    value={editFormData.weeklyDayOfWeek}
                    onChange={handleEditFormChange}
                  >
                    {getDayOfWeekOptions().map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="form-actions">
                <button type="button" onClick={cancelEditTask} className="cancel-button">
                  キャンセル
                </button>
                <button type="submit" className="submit-button">
                  タスクを更新
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* タスク一覧 */}
      <div className="task-list">
        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <p>タスクがありません</p>
            {selectedTaskType !== 'all' && (
              <p className="empty-subtext">
                {getTaskTypeLabel(selectedTaskType as TaskType)}タスクは作成されていません
              </p>
            )}
          </div>
        ) : (
          filteredTasks.map(task => (
            <div key={task.id} className={`task-card ${isOverdue(task) ? 'overdue' : ''} ${getTaskColorClass(task.color)}`}>
              <div className="task-header">
                <div className="task-title-section">
                  <h3 className="task-title">{task.title}</h3>
                  <div className="task-meta">
                    <span className={`task-type type-${task.type}`}>
                      {getTaskTypeLabel(task.type)}
                    </span>
                    <span className={`task-status ${getTaskStatusClass(task.status)}`}>
                      {getTaskStatusLabel(task.status)}
                    </span>
                    {isOverdue(task) && (
                      <span className="overdue-badge">期限切れ</span>
                    )}
                  </div>
                </div>
                
                <div className="task-actions">
                  <button
                    onClick={() => startEditTask(task)}
                    className="action-btn edit-btn"
                  >
                    編集する
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="action-btn delete-btn"
                  >
                    削除
                  </button>
                </div>
              </div>
              
              {task.description && (
                <p className="task-description">{task.description}</p>
              )}
              
              <div className="task-footer">
                <div 
                  className={`task-assignment ${(!task.assignedUserIds || task.assignedUserIds.length === 0) ? 'unassigned' : ''}`}
                  onClick={() => startEditAssign(task)}
                  title="クリックして担当者を変更"
                >
                  <span className="assignment-label">担当者:</span>
                  <span className="assignment-value">{getAssignedUsersText(task.assignedUserIds)}</span>
                  <span className="edit-icon">✏️</span>
                </div>
                
                {task.type === 'weekly' && (
                  <div className="task-due-date">
                    {task.weeklyDayOfWeek ? (
                      <>
                        <span className="due-date-label">繰り返し:</span>
                        <span className="due-date-value">
                          毎週{getDayOfWeekLabel(task.weeklyDayOfWeek)}
                        </span>
                      </>
                    ) : task.dueDate ? (
                      <>
                        <span className="due-date-label">期限:</span>
                        <span className="due-date-value">
                          {task.dueDate.toLocaleDateString('ja-JP')}
                        </span>
                      </>
                    ) : null}
                  </div>
                )}
                
                <div className="task-timestamps">
                  <span className="timestamp">
                    作成: {task.createdAt.toLocaleDateString('ja-JP')}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};