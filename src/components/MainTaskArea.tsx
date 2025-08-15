import React, { useState, useEffect } from 'react';
import { Task, User, TaskColor, WorkSession } from '../types';
import { FirestoreService } from '../services/firestoreService';
import './MainTaskArea.css';

// メインタスクエリアのプロパティ
interface MainTaskAreaProps {
  mainTasks: Task[];
  users: User[];
  currentUser: User;
  onStartTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onResumeTask: (taskId: string) => void;
  onUpdateStatus: (taskId: string, status: Task['status']) => void;
  getUserName: (userId: string) => string;
}

/**
 * メインタスク専用枠コンポーネント
 * アサインメンバー表示と開始・完了・再開ボタン、累積作業時間計測機能
 */
export const MainTaskArea: React.FC<MainTaskAreaProps> = ({
  mainTasks,
  users,
  currentUser,
  onStartTask,
  onCompleteTask,
  onResumeTask,
  // onUpdateStatus,
  getUserName
}) => {
  // 作業時間関連の状態管理
  // const [workSessions, setWorkSessions] = useState<Record<string, WorkSession[]>>({});
  const [activeWorkSessions, setActiveWorkSessions] = useState<Record<string, WorkSession | null>>({});
  const [dailyWorkTimes, setDailyWorkTimes] = useState<Record<string, number>>({});

  /**
   * 作業セッションデータを読み込み
   */
  const loadWorkSessionData = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    for (const task of mainTasks) {
      try {
        // アクティブなセッションを取得
        const activeSession = await FirestoreService.getActiveWorkSession(task.id, currentUser.id);
        setActiveWorkSessions(prev => ({
          ...prev,
          [task.id]: activeSession
        }));

        // 当日の総作業時間を取得
        const dailyTime = await FirestoreService.getDailyWorkTime(task.id, today);
        setDailyWorkTimes(prev => ({
          ...prev,
          [task.id]: dailyTime
        }));

        // 作業セッション履歴を取得
        // const sessions = await FirestoreService.getWorkSessionHistory(task.id, today);
        // setWorkSessions(prev => ({
        //   ...prev,
        //   [task.id]: sessions
        // }));

      } catch (error) {
        console.error(`タスク ${task.id} の作業セッションデータ取得エラー:`, error);
      }
    }
  };

  // コンポーネント初期化時とタスクリスト変更時にデータを読み込み
  useEffect(() => {
    if (mainTasks.length > 0) {
      loadWorkSessionData();
    }
  }, [mainTasks]);

  /**
   * タスクの色クラス名を取得
   */
  const getTaskColorClass = (color?: TaskColor | null) => {
    if (!color || color === 'default' || color === null) return '';
    return `task-color-${color}`;
  };

  /**
   * 担当者名を取得
   */
  // const getAssignedUsersText = (userIds?: string[]) => {
  //   if (!userIds || userIds.length === 0) return '未アサイン';

  //   if (userIds.length === 1) {
  //     return getUserName(userIds[0]);
  //   }

  //   if (userIds.length <= 3) {
  //     return userIds.map(id => getUserName(id)).join(', ');
  //   }

  //   const firstTwo = userIds.slice(0, 2).map(id => getUserName(id)).join(', ');
  //   return `${firstTwo} 他${userIds.length - 2}名`;
  // };

  /**
   * 作業開始処理
   */
  const handleStartWork = async (taskId: string) => {
    try {
      await FirestoreService.startWorkSession(taskId, currentUser.id);
      onStartTask(taskId);
      loadWorkSessionData(); // データを再読み込み
    } catch (error) {
      console.error('作業開始エラー:', error);
      alert('作業の開始に失敗しました');
    }
  };

  /**
   * 作業完了処理
   */
  const handleCompleteWork = async (taskId: string) => {
    try {
      const activeSession = activeWorkSessions[taskId];
      if (activeSession) {
        await FirestoreService.endWorkSession(taskId, currentUser.id);
      }
      onCompleteTask(taskId);
      loadWorkSessionData(); // データを再読み込み
    } catch (error) {
      console.error('作業完了エラー:', error);
      alert('作業の完了に失敗しました');
    }
  };

  /**
   * 作業再開処理
   */
  const handleResumeWork = async (taskId: string) => {
    try {
      await FirestoreService.startWorkSession(taskId, currentUser.id);
      onResumeTask(taskId);
      loadWorkSessionData(); // データを再読み込み
    } catch (error) {
      console.error('作業再開エラー:', error);
      alert('作業の再開に失敗しました');
    }
  };

  /**
   * 現在の作業時間を計算（アクティブセッション + 完了セッション）
   */
  const getCurrentWorkTime = (taskId: string): number => {
    let totalMinutes = dailyWorkTimes[taskId] || 0;
    
    // アクティブなセッションがあれば現在の経過時間を加算
    const activeSession = activeWorkSessions[taskId];
    if (activeSession) {
      const now = new Date();
      const currentMinutes = Math.floor((now.getTime() - activeSession.startTime.getTime()) / (1000 * 60));
      totalMinutes += currentMinutes;
    }
    
    return totalMinutes;
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
   * タスクに適したボタンを取得
   */
  const getActionButton = (task: Task) => {
    const isAssigned = task.assignedUserIds?.includes(currentUser.id);
    if (!isAssigned) {
      return null;
    }

    const activeSession = activeWorkSessions[task.id];
    
    // アクティブなセッションがある場合（作業中）
    if (activeSession) {
      return (
        <button 
          onClick={() => handleCompleteWork(task.id)} 
          className="task-action-button complete-button"
          title="作業を完了"
        >
          完了
        </button>
      );
    }

    // ステータス別のボタン表示
    switch (task.status) {
      case 'todo':
        return (
          <button 
            onClick={() => handleStartWork(task.id)} 
            className="task-action-button start-button"
            title="作業を開始"
          >
            開始
          </button>
        );
      
      case 'in_progress':
        return (
          <button 
            onClick={() => handleCompleteWork(task.id)} 
            className="task-action-button complete-button"
            title="作業を完了"
          >
            完了
          </button>
        );
      
      case 'resumable':
        return (
          <button 
            onClick={() => handleResumeWork(task.id)} 
            className="task-action-button resume-button"
            title="作業を再開"
          >
            再開
          </button>
        );
      
      case 'completed':
        return (
          <button 
            onClick={() => handleResumeWork(task.id)} 
            className="task-action-button resume-button"
            title="作業を再開"
          >
            再開
          </button>
        );
      
      default:
        return null;
    }
  };

  /**
   * タスクステータスの表示名を取得
   */
  const getStatusText = (task: Task) => {
    const activeSession = activeWorkSessions[task.id];
    
    if (activeSession) {
      return '作業中';
    }
    
    switch (task.status) {
      case 'todo': return '未着手';
      case 'in_progress': return '進行中';
      case 'completed': return '完了';
      case 'resumable': return '再開可能';
      default: return task.status;
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
                    {getStatusText(task)}
                  </span>
                </div>

                {/* 作業時間表示 */}
                <div className="work-time-display">
                  <span className="work-time-label">本日の作業時間:</span>
                  <span className="work-time-value">
                    {formatWorkTime(getCurrentWorkTime(task.id))}
                  </span>
                  {activeWorkSessions[task.id] && (
                    <span className="work-time-live">⏱️ 進行中</span>
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
                  {(() => {
                    if (!task.assignedUserIds || task.assignedUserIds.length === 0) {
                      return <span className="no-assignment">未アサイン</span>;
                    }
                    
                    const attendingAssignees = task.assignedUserIds
                      .filter(userId => {
                        const user = users.find(u => u.id === userId);
                        return user?.isAttending; // 出勤者のみ表示
                      });
                    
                    if (attendingAssignees.length === 0) {
                      return <span className="no-assignment">出勤中の担当者なし</span>;
                    }
                    
                    return attendingAssignees.map(userId => {
                      return (
                        <span key={userId} className="member-badge attending">
                          {getUserName(userId)}
                          🟢
                        </span>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* 開始・完了・再開ボタン */}
              <div className="main-task-actions">
                {getActionButton(task)}
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
