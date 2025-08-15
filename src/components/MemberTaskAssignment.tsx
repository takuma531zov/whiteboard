import React, { useState, useEffect } from 'react';
import { User, Task, TaskType, TaskStatus, TaskTypeFilter } from '../types';
import { FirestoreService } from '../services/firestoreService';
import './MemberTaskAssignment.css';

// コンポーネントのプロパティ
interface MemberTaskAssignmentProps {
  currentUser: User;
}

// タスク割り当て情報の型（現在未使用）
// interface TaskAssignment {
//   taskId: string;
//   memberId: string;
//   assignedAt: Date;
// }

/**
 * メンバー別タスク割り当て画面コンポーネント
 * メンバーを中心としたタスク管理を行う
 */
export const MemberTaskAssignment: React.FC<MemberTaskAssignmentProps> = ({
  // currentUser
}) => {
  // 状態管理
  const [members, setMembers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [selectedTaskType, setSelectedTaskType] = useState<TaskType | 'all'>('all');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);

  /**
   * 初期データの読み込み
   */
  useEffect(() => {
    loadInitialData();
  }, []);

  /**
   * 初期データの読み込み
   */
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [membersData, tasksData] = await Promise.all([
        FirestoreService.getAllUsers(),
        FirestoreService.getAllTasks()
      ]);
      
      setMembers(membersData);
      setTasks(tasksData);
      setError('');
    } catch (err: any) {
      console.error('データ読み込みエラー:', err);
      setError('データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  /**
   * メンバーに割り当て済みのタスクを取得
   */
  const getMemberTasks = (memberId: string, taskType?: TaskTypeFilter) => {
    let memberTasks = tasks.filter(task => 
      task.assignedUserIds && task.assignedUserIds.includes(memberId)
    );

    if (taskType && taskType !== 'all') {
      memberTasks = memberTasks.filter(task => task.type === taskType);
    }

    return memberTasks;
  };

  /**
   * 未アサインのタスクを取得
   */
  const getUnassignedTasks = (taskType?: TaskTypeFilter) => {
    let unassignedTasks = tasks.filter(task => 
      !task.assignedUserIds || task.assignedUserIds.length === 0
    );

    if (taskType && taskType !== 'all') {
      unassignedTasks = unassignedTasks.filter(task => task.type === taskType);
    }

    return unassignedTasks;
  };

  /**
   * タスク割り当てモーダルを開く
   */
  const openAssignModal = (member: User) => {
    setSelectedMember(member);
    // 該当メンバーに未割り当てのタスクを取得
    const memberTaskIds = getMemberTasks(member.id).map(t => t.id);
    const available = tasks.filter(task => !memberTaskIds.includes(task.id));
    setAvailableTasks(available);
    setShowAssignModal(true);
  };

  /**
   * タスクをメンバーに割り当て
   */
  const assignTaskToMember = async (taskId: string, memberId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error('タスクが見つかりません');
      }

      const newAssignedUserIds = task.assignedUserIds ? [...task.assignedUserIds] : [];
      if (!newAssignedUserIds.includes(memberId)) {
        newAssignedUserIds.push(memberId);
      } else {
        // 既に割り当て済みの場合は何もしない
        return;
      }

      // Firestore更新を実行
      await FirestoreService.updateTask(taskId, {
        assignedUserIds: newAssignedUserIds
      });

      // Firestore更新成功後にローカル状態を更新
      setTasks(prev => 
        prev.map(t => 
          t.id === taskId 
            ? { ...t, assignedUserIds: newAssignedUserIds, updatedAt: new Date() }
            : t
        )
      );

      setError('');
    } catch (err: any) {
      console.error('タスク割り当てエラー:', err);
      const errorMessage = err.message || 'タスクの割り当てに失敗しました';
      setError(errorMessage);
      throw err; // 呼び出し元でもエラーハンドリングできるよう再throw
    }
  };

  /**
   * メンバーからタスクを解除
   */
  const unassignTaskFromMember = async (taskId: string, memberId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task || !task.assignedUserIds) return;

      const newAssignedUserIds = task.assignedUserIds.filter(id => id !== memberId);

      await FirestoreService.updateTask(taskId, {
        assignedUserIds: newAssignedUserIds.length > 0 ? newAssignedUserIds : []
      });

      // ローカル状態を更新
      setTasks(prev => 
        prev.map(t => 
          t.id === taskId 
            ? { ...t, assignedUserIds: newAssignedUserIds.length > 0 ? newAssignedUserIds : [], updatedAt: new Date() }
            : t
        )
      );

      setError('');
    } catch (err: any) {
      console.error('タスク解除エラー:', err);
      setError('タスクの解除に失敗しました');
    }
  };

  /**
   * タスクステータスを更新
   */
  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await FirestoreService.updateTask(taskId, { status: newStatus });
      
      // ローカル状態を更新
      setTasks(prev => 
        prev.map(task => 
          task.id === taskId 
            ? { ...task, status: newStatus, updatedAt: new Date() }
            : task
        )
      );
    } catch (err: any) {
      console.error('ステータス更新エラー:', err);
      setError('ステータスの更新に失敗しました');
    }
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
   * 期限切れかどうかをチェック
   */
  const isOverdue = (task: Task) => {
    if (task.type !== 'weekly' || !task.dueDate || task.status === 'completed') {
      return false;
    }
    return new Date() > task.dueDate;
  };

  // ローディング表示
  if (loading) {
    return (
      <div className="member-task-assignment">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>メンバー情報を読み込み中...</p>
        </div>
      </div>
    );
  }

  const unassignedTasks = getUnassignedTasks(selectedTaskType !== 'all' ? selectedTaskType : undefined);

  return (
    <div className="member-task-assignment">
      {/* ヘッダー */}
      <div className="assignment-header">
        <div className="header-left">
          <h2>メンバー別タスク管理</h2>
          <div className="assignment-summary">
            <span className="summary-item">
              メンバー: {members.length}名
            </span>
            <span className="summary-item">
              タスク: {tasks.length}件
            </span>
            <span className="summary-item">
              未アサイン: {unassignedTasks.length}件
            </span>
          </div>
        </div>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      {/* タスク種別フィルター */}
      <div className="filter-bar">
        <div className="filter-buttons">
          <button 
            onClick={() => setSelectedTaskType('all')}
            className={selectedTaskType === 'all' ? 'filter-btn active' : 'filter-btn'}
          >
            すべて
          </button>
          <button 
            onClick={() => setSelectedTaskType('daily')}
            className={selectedTaskType === 'daily' ? 'filter-btn active' : 'filter-btn'}
          >
            日時タスク
          </button>
          <button 
            onClick={() => setSelectedTaskType('weekly')}
            className={selectedTaskType === 'weekly' ? 'filter-btn active' : 'filter-btn'}
          >
            週次タスク
          </button>
          <button 
            onClick={() => setSelectedTaskType('main')}
            className={selectedTaskType === 'main' ? 'filter-btn active' : 'filter-btn'}
          >
            メインタスク
          </button>
        </div>
      </div>

      {/* メンバー一覧とタスク */}
      <div className="assignment-content">
        <div className="members-grid">
          {members.map(member => {
            const memberTasks = getMemberTasks(member.id, selectedTaskType !== 'all' ? selectedTaskType : undefined);
            const completedTasks = memberTasks.filter(t => t.status === 'completed');
            // const inProgressTasks = memberTasks.filter(t => t.status === 'in_progress');
            const overdueTask = memberTasks.filter(t => isOverdue(t));

            return (
              <div key={member.id} className={`member-card ${member.isAttending ? 'attending' : 'absent'}`}>
                <div className="member-header">
                  <div className="member-info">
                    <h3 className="member-name">{member.name}</h3>
                    <div className="member-details">
                      <span className="member-id">ID: {member.employeeId}</span>
                      <span className={`attendance-status ${member.isAttending ? 'attending' : 'absent'}`}>
                        {member.isAttending ? '出勤中' : '不在'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="member-stats">
                    <div className="stat-item">
                      <span className="stat-label">割当</span>
                      <span className="stat-value">{memberTasks.length}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">完了</span>
                      <span className="stat-value">{completedTasks.length}</span>
                    </div>
                    {overdueTask.length > 0 && (
                      <div className="stat-item overdue">
                        <span className="stat-label">遅延</span>
                        <span className="stat-value">{overdueTask.length}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="member-actions">
                  <button 
                    onClick={() => openAssignModal(member)}
                    className="assign-button"
                  >
                    タスクを割り当て
                  </button>
                </div>

                <div className="member-tasks">
                  {memberTasks.length === 0 ? (
                    <div className="no-tasks">
                      <p>割り当てられたタスクがありません</p>
                    </div>
                  ) : (
                    <div className="task-list">
                      {memberTasks.map(task => (
                        <div key={task.id} className={`task-item ${getTaskStatusClass(task.status)} ${isOverdue(task) ? 'overdue' : ''}`}>
                          <div className="task-info">
                            <div className="task-title">{task.title}</div>
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
                            {task.dueDate && task.type === 'weekly' && (
                              <div className="task-due-date">
                                期限: {task.dueDate.toLocaleDateString('ja-JP')}
                              </div>
                            )}
                          </div>
                          
                          <div className="task-actions">
                            {task.status === 'todo' && (
                              <button
                                onClick={() => updateTaskStatus(task.id, 'in_progress')}
                                className="action-btn start-btn"
                                title="開始"
                              >
                                ▶️
                              </button>
                            )}
                            {task.status === 'in_progress' && (
                              <button
                                onClick={() => updateTaskStatus(task.id, 'completed')}
                                className="action-btn complete-btn"
                                title="完了"
                              >
                                ✅
                              </button>
                            )}
                            {task.status === 'completed' && (
                              <button
                                onClick={() => updateTaskStatus(task.id, 'todo')}
                                className="action-btn reopen-btn"
                                title="再開"
                              >
                                🔄
                              </button>
                            )}
                            <button
                              onClick={() => unassignTaskFromMember(task.id, member.id)}
                              className="action-btn unassign-btn"
                              title="割り当て解除"
                            >
                              ❌
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 未アサインタスク */}
        {unassignedTasks.length > 0 && (
          <div className="unassigned-section">
            <h3>未アサインタスク ({unassignedTasks.length}件)</h3>
            <div className="unassigned-tasks">
              {unassignedTasks.map(task => (
                <div key={task.id} className={`unassigned-task ${getTaskStatusClass(task.status)} ${isOverdue(task) ? 'overdue' : ''}`}>
                  <div className="task-info">
                    <div className="task-title">{task.title}</div>
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
                    {task.dueDate && task.type === 'weekly' && (
                      <div className="task-due-date">
                        期限: {task.dueDate.toLocaleDateString('ja-JP')}
                      </div>
                    )}
                    {task.description && (
                      <div className="task-description">{task.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* タスク割り当てモーダル */}
      {showAssignModal && selectedMember && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{selectedMember.name}さんにタスクを割り当て</h3>
              <button 
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedMember(null);
                  setAvailableTasks([]);
                }}
                className="close-button"
              >×</button>
            </div>
            
            <div className="assign-modal-content">
              {availableTasks.length === 0 ? (
                <div className="no-available-tasks">
                  <p>割り当て可能なタスクがありません</p>
                  <p className="subtext">すべてのタスクが既に割り当てられています。</p>
                </div>
              ) : (
                <div className="available-tasks">
                  <h4>割り当て可能なタスク ({availableTasks.length}件)</h4>
                  <div className="tasks-list">
                    {availableTasks.map(task => (
                      <div key={task.id} className={`task-option ${getTaskStatusClass(task.status)}`}>
                        <div className="task-option-info">
                          <div className="task-option-title">{task.title}</div>
                          <div className="task-option-meta">
                            <span className={`task-type type-${task.type}`}>
                              {getTaskTypeLabel(task.type)}
                            </span>
                            <span className={`task-status ${getTaskStatusClass(task.status)}`}>
                              {getTaskStatusLabel(task.status)}
                            </span>
                          </div>
                          {task.description && (
                            <div className="task-option-description">{task.description}</div>
                          )}
                          {task.dueDate && task.type === 'weekly' && (
                            <div className="task-option-due">
                              期限: {task.dueDate.toLocaleDateString('ja-JP')}
                            </div>
                          )}
                        </div>
                        
                        <button
                          onClick={async () => {
                            try {
                              await assignTaskToMember(task.id, selectedMember.id);
                              // 成功時のみUIを更新
                              setAvailableTasks(prev => prev.filter(t => t.id !== task.id));
                            } catch (error) {
                              console.error('タスク割り当て失敗:', error);
                              // エラーは assignTaskToMember 内で設定される
                            }
                          }}
                          className="assign-task-btn"
                        >
                          割り当て
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};