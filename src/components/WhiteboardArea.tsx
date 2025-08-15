import React, { useState } from 'react';
import { Task, User, TaskColor, DayOfWeek } from '../types';
import './WhiteboardArea.css';

// ホワイトボード領域のプロパティ
interface WhiteboardAreaProps {
  dailyTasks: Task[];
  weeklyTasks: Task[];
  attendingUsers: User[];
  currentUser: User;
  onUpdateTaskAssignment: (taskId: string, assignedUserIds: string[]) => void;
  onUpdateTaskStatus: (taskId: string, status: Task['status']) => void;
}

/**
 * ホワイトボード領域コンポーネント
 * 日時・週次タスクの疑似ホワイトボード表示とD&D管理
 */
export const WhiteboardArea: React.FC<WhiteboardAreaProps> = ({
  dailyTasks,
  weeklyTasks,
  attendingUsers,
  // currentUser,
  onUpdateTaskAssignment,
  onUpdateTaskStatus
}) => {
  const [selectedTab, setSelectedTab] = useState<'daily' | 'weekly'>('daily');
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  /**
   * 現在選択されているタスクを取得
   */
  const getCurrentTasks = () => {
    return selectedTab === 'daily' ? dailyTasks : weeklyTasks;
  };

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

  //   if (userIds.length <= 2) {
  //     return userIds.map(id => getUserName(id)).join(', ');
  //   }

  //   const firstName = getUserName(userIds[0]);
  //   return `${firstName} 他${userIds.length - 1}名`;
  // };

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
   * ユーザー別のタスクを取得（最大10タスクまで）
   */
  const getTasksForUser = (userId: string) => {
    const tasks = getCurrentTasks().filter(task =>
      task.assignedUserIds && task.assignedUserIds.includes(userId)
    );
    // 最大10タスクまで表示、優先度: 進行中 > 未着手 > 完了
    return tasks
      .sort((a, b) => {
        const statusOrder: Record<string, number> = { 'in_progress': 0, 'todo': 1, 'completed': 2, 'resumable': 1 };
        return (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
      })
      .slice(0, 10);
  };

  /**
   * 未アサインのタスクを取得（担当者不在のタスクも含む）
   */
  const getUnassignedTasks = () => {
    return getCurrentTasks().filter(task => {
      // 従来の未アサインタスク
      if (!task.assignedUserIds || task.assignedUserIds.length === 0) {
        return true;
      }
      
      // 担当者全員が不在（出勤していない）場合も未アサインとして扱う
      const hasAttendingAssignee = task.assignedUserIds.some(userId => {
        const user = attendingUsers.find(u => u.id === userId);
        return user?.isAttending;
      });
      
      return !hasAttendingAssignee; // 出勤中の担当者がいない場合
    });
  };


  /**
   * ドラッグ開始
   */
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  /**
   * ドラッグオーバー（ドロップゾーン）
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  /**
   * ドロップ処理
   */
  const handleDrop = (e: React.DragEvent, targetUserId: string | null) => {
    e.preventDefault();

    if (!draggedTask) return;

    // 新しい担当者IDを設定
    const newAssignedUserIds = targetUserId ? [targetUserId] : [];

    // 担当者を更新
    onUpdateTaskAssignment(draggedTask.id, newAssignedUserIds);

    setDraggedTask(null);
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
    <div className="whiteboard-area">
      {/* ヘッダー */}
      <div className="whiteboard-header">
        <div className="whiteboard-title">
          <h2>📋ホワイトボード</h2>
          <p className="whiteboard-subtitle">タスクをドラッグして出勤メンバーに割り当て</p>
        </div>

        {/* タブ */}
        <div className="task-type-tabs">
          <button
            onClick={() => setSelectedTab('daily')}
            className={selectedTab === 'daily' ? 'tab-btn active' : 'tab-btn'}
          >
            日時タスク ({dailyTasks.length})
          </button>
          <button
            onClick={() => setSelectedTab('weekly')}
            className={selectedTab === 'weekly' ? 'tab-btn active' : 'tab-btn'}
          >
            週次タスク ({weeklyTasks.length})
          </button>
        </div>
      </div>

      <div className="whiteboard-content">
        {/* 出勤メンバー列（最大10人表示） */}
        <div className="member-columns">
          {attendingUsers.slice(0, 10).map(user => {
            const userTasks = getTasksForUser(user.id);
            const allUserTasks = getCurrentTasks().filter(task =>
              task.assignedUserIds && task.assignedUserIds.includes(user.id)
            );
            
            return (
            <div
              key={user.id}
              className="member-column"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, user.id)}
            >
              <div className="member-column-header">
                <div className="member-info">
                  <span className="member-name">{user.name}</span>
                  <span className="member-id">ID: {user.employeeId}</span>
                </div>
                <span className="task-count">
                  {userTasks.length}
                  {allUserTasks.length > 10 && `/${allUserTasks.length}`}
                </span>
              </div>

              <div className="member-tasks">
                {userTasks.map(task => (
                  <div
                    key={task.id}
                    className={`task-card ${getStatusClass(task.status)} ${isOverdue(task) ? 'overdue' : ''} ${getTaskColorClass(task.color)}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                  >
                    <div className="task-card-header">
                      <h4 className="task-title">{task.title}</h4>
                      <div className="task-meta">
                        <span className={`task-status ${getStatusClass(task.status)}`}>
                          {getStatusText(task.status)}
                        </span>
                        {isOverdue(task) && (
                          <span className="overdue-badge">期限切れ</span>
                        )}
                      </div>
                    </div>

                    {task.description && (
                      <p className="task-description">{task.description}</p>
                    )}

                    {task.type === 'weekly' && (
                      <div className="task-due-date">
                        {task.weeklyDayOfWeek ? (
                          `毎週${getDayOfWeekLabel(task.weeklyDayOfWeek)}`
                        ) : task.dueDate ? (
                          `期限: ${task.dueDate.toLocaleDateString('ja-JP')}`
                        ) : null}
                      </div>
                    )}

                    <div className="task-actions">
                      {task.status === 'todo' && (
                        <button
                          onClick={() => onUpdateTaskStatus(task.id, 'in_progress')}
                          className="task-action-btn start-btn"
                        >
                          開始
                        </button>
                      )}
                      {task.status === 'in_progress' && (
                        <button
                          onClick={() => onUpdateTaskStatus(task.id, 'completed')}
                          className="task-action-btn complete-btn"
                        >
                          完了
                        </button>
                      )}
                      {task.status === 'completed' && (
                        <button
                          onClick={() => onUpdateTaskStatus(task.id, 'todo')}
                          className="task-action-btn reopen-btn"
                        >
                          再開
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            );
          })}
        </div>

        {/* 未アサインタスク列 */}
        <div
          className="unassigned-column"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, null)}
        >
          <div className="unassigned-header">
            <h3>📝 未アサイン</h3>
            <span className="task-count">{getUnassignedTasks().length}件</span>
          </div>

          <div className="unassigned-tasks">
            {getUnassignedTasks().slice(0, 20).map(task => {
              return (
                <div
                  key={task.id}
                  className={`unassigned-task-card ${getStatusClass(task.status)} ${getTaskColorClass(task.color)}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  title={`${task.title}${task.description ? ` - ${task.description}` : ''}`}
                >
                  <span className="unassigned-task-title">{task.title}</span>
                </div>
              );
            })}

            {getUnassignedTasks().length === 0 && (
              <div className="no-unassigned-tasks">
                <p>未アサインのタスクはありません</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ドラッグ中のヒント */}
      {draggedTask && (
        <div className="drag-hint">
          「{draggedTask.title}」を移動中...
          出勤メンバーの列にドロップして割り当ててください
        </div>
      )}
    </div>
  );
};
