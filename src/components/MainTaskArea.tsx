import React from 'react';
import { Task, User, TaskColor } from '../types';
import './MainTaskArea.css';

// メインタスクエリアのプロパティ
interface MainTaskAreaProps {
  mainTasks: Task[];
  users: User[];
  currentUser: User;
  onStartTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onUpdateStatus: (taskId: string, status: Task['status']) => void;
  getUserName: (userId: string) => string;
}

/**
 * メインタスク専用枠コンポーネント
 * アサインメンバー表示と着手・完了ボタン、作業時間計測機能
 */
export const MainTaskArea: React.FC<MainTaskAreaProps> = ({
  mainTasks,
  users,
  currentUser,
  onStartTask,
  onCompleteTask,
  onUpdateStatus,
  getUserName
}) => {
  /**
   * タスクの色クラス名を取得
   */
  const getTaskColorClass = (color?: TaskColor) => {
    if (!color || color === 'default') return '';
    return `task-color-${color}`;
  };

  /**
   * 担当者名を取得
   */
  const getAssignedUsersText = (userIds?: string[]) => {
    if (!userIds || userIds.length === 0) return '未アサイン';

    if (userIds.length === 1) {
      return getUserName(userIds[0]);
    }

    if (userIds.length <= 3) {
      return userIds.map(id => getUserName(id)).join(', ');
    }

    const firstTwo = userIds.slice(0, 2).map(id => getUserName(id)).join(', ');
    return `${firstTwo} 他${userIds.length - 2}名`;
  };

  /**
   * 作業時間を計算（分単位）
   */
  const calculateWorkTime = (task: Task) => {
    if (task.status === 'completed' && task.totalWorkTime) {
      return task.totalWorkTime;
    }

    if (task.status === 'in_progress' && task.workStartTime) {
      const now = new Date();
      const workingMinutes = Math.floor((now.getTime() - task.workStartTime.getTime()) / (1000 * 60));
      return (task.totalWorkTime || 0) + workingMinutes;
    }

    return task.totalWorkTime || 0;
  };

  /**
   * 作業時間を時間:分形式で表示
   */
  const formatWorkTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}時間${mins}分`;
    }
    return `${mins}分`;
  };

  /**
   * タスクステータスの表示名を取得
   */
  const getStatusText = (status: Task['status']) => {
    switch (status) {
      case 'todo': return '未着手';
      case 'in_progress': return '進行中';
      case 'completed': return '完了';
      default: return status;
    }
  };

  /**
   * ステータスに応じたクラス名を取得
   */
  const getStatusClass = (status: Task['status']) => {
    switch (status) {
      case 'todo': return 'status-todo';
      case 'in_progress': return 'status-progress';
      case 'completed': return 'status-completed';
      default: return '';
    }
  };

  return (
    <div className="main-task-area">
      <div className="main-task-header">
        <h2>🎯 メインタスク専用枠</h2>
        <div className="main-task-summary">
          <span>総数: {mainTasks.length}</span>
          <span>進行中: {mainTasks.filter(t => t.status === 'in_progress').length}</span>
          <span>完了: {mainTasks.filter(t => t.status === 'completed').length}</span>
        </div>
      </div>

      {mainTasks.length === 0 ? (
        <div className="no-main-tasks">
          <p>メインタスクが作成されていません</p>
          <p className="no-main-tasks-hint">タスク管理画面から「メインタスク」を作成してください</p>
        </div>
      ) : (
        <div className="main-tasks-grid">
          {mainTasks.map(task => (
            <div key={task.id} className={`main-task-card ${getStatusClass(task.status)} ${getTaskColorClass(task.color)}`}>
              {/* タスクヘッダー */}
              <div className="main-task-card-header">
                <div className="main-task-title-section">
                  <h3 className="main-task-title">{task.title}</h3>
                  <span className={`main-task-status ${getStatusClass(task.status)}`}>
                    {getStatusText(task.status)}
                  </span>
                </div>

                {/* 作業時間表示 */}
                <div className="work-time-display">
                  <span className="work-time-label">作業時間:</span>
                  <span className="work-time-value">
                    {formatWorkTime(calculateWorkTime(task))}
                  </span>
                  {task.status === 'in_progress' && (
                    <span className="work-time-live">⏱️</span>
                  )}
                </div>
              </div>

              {/* タスク説明 */}
              {task.description && (
                <p className="main-task-description">{task.description}</p>
              )}

              {/* アサインメンバー表示 */}
              <div className="assigned-members">
                <span className="members-label">👥 担当者:</span>
                <div className="members-list">
                  {task.assignedUserIds && task.assignedUserIds.length > 0 ? (
                    task.assignedUserIds.map(userId => {
                      const user = users.find(u => u.id === userId);
                      return (
                        <span key={userId} className={`member-badge ${user?.isAttending ? 'attending' : 'absent'}`}>
                          {getUserName(userId)}
                          {user?.isAttending ? '🟢' : '🔴'}
                        </span>
                      );
                    })
                  ) : (
                    <span className="no-assignment">未アサイン</span>
                  )}
                </div>
              </div>

              {/* 着手・完了ボタン */}
              <div className="main-task-actions">
                {task.status === 'todo' && (
                  <button
                    onClick={() => onStartTask(task.id)}
                    className="main-action-btn start-btn"
                    title="作業を開始して時間計測を始める"
                  >
                    🚀 開始する
                  </button>
                )}

                {task.status === 'in_progress' && (
                  <>
                    <button
                      onClick={() => onCompleteTask(task.id)}
                      className="main-action-btn complete-btn"
                      title="作業を完了して時間計測を終了"
                    >
                      ✅ 完了する
                    </button>
                    <button
                      onClick={() => onUpdateStatus(task.id, 'todo')}
                      className="main-action-btn pause-btn"
                      title="一時停止（時間計測を止める）"
                    >
                      ⏸️ 一時停止
                    </button>
                  </>
                )}

                {task.status === 'completed' && (
                  <button
                    onClick={() => onUpdateStatus(task.id, 'todo')}
                    className="main-action-btn reopen-btn"
                    title="タスクを再開する"
                  >
                    🔄 再開する
                  </button>
                )}
              </div>

              {/* タスク作成情報 */}
              <div className="main-task-footer">
                <span className="task-created">
                  作成: {task.createdAt.toLocaleDateString('ja-JP')} by {getUserName(task.createdBy)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
