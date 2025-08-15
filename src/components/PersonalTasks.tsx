import React, { useState } from 'react';
import { Task, User, TaskType } from '../types';
import './PersonalTasks.css';

// 個人タスクページのプロパティ
interface PersonalTasksProps {
  currentUser: User;
  allTasks: Task[];
  onUpdateTaskStatus: (taskId: string, status: Task['status']) => void;
  onUpdateTaskPriority: (taskId: string, isPriority: boolean) => void;
}

/**
 * 個人タスクページコンポーネント
 * ログインユーザーに割り当てられたタスクのみを表示
 */
export const PersonalTasks: React.FC<PersonalTasksProps> = ({
  currentUser,
  allTasks,
  onUpdateTaskStatus,
  onUpdateTaskPriority,
}) => {
  const [selectedTaskType, setSelectedTaskType] = useState<TaskType | 'all'>('all');

  /**
   * 自分に割り当てられたタスクを取得
   */
  const getMyTasks = () => {
    return allTasks.filter(task => 
      task.assignedUserIds && task.assignedUserIds.includes(currentUser.id)
    );
  };

  /**
   * フィルターとソート済みタスクを取得
   */
  const getFilteredAndSortedTasks = () => {
    const myTasks = getMyTasks();
    const filtered = selectedTaskType === 'all' 
      ? myTasks 
      : myTasks.filter(task => task.type === selectedTaskType);
    
    // 優先度と作成日でソート
    return filtered.sort((a, b) => {
      const priorityA = a.isPriority === true ? 1 : 0;
      const priorityB = b.isPriority === true ? 1 : 0;
      if (priorityA !== priorityB) {
        return priorityB - priorityA; // 1(true) の方が先に来るように降順ソート
      }
      // 優先度が同じ場合は作成日の降順（新しいものが上）
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  };

  /**
   * タスクの色クラス名を取得
   */
  const getTaskColorClass = (color?: string | null) => {
    if (!color || color === 'default' || color === null) return '';
    return `task-color-${color}`;
  };

  /**
   * タスクステータスの表示名を取得
   */
  const getStatusText = (status: Task['status']) => {
    switch (status) {
      case 'todo': return '未着手';
      case 'in_progress': return '進行中';
      case 'completed': return '完了';
      case 'resumable': return '再開可能';
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
      case 'resumable': return 'status-resumable';
      default: return '';
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
      
      return todayDayOfWeek > targetDayOfWeek;
    }
    
    return false;
  };

  /**
   * 曜日の表示名を取得
   */
  const getDayOfWeekLabel = (dayOfWeek: string) => {
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

  const myTasks = getMyTasks();
  const finalTasks = getFilteredAndSortedTasks();

  return (
    <div className="personal-tasks">
      {/* ヘッダー */}
      <div className="personal-header">
        <div className="header-left">
          <h2>📋 個人タスク</h2>
          <div className="user-info">
            <span className="user-name">{currentUser.name}</span>
            <span className="user-id">ID: {currentUser.employeeId}</span>
          </div>
          <div className="task-summary">
            <span className="summary-item">
              全体: {myTasks.length}件
            </span>
            <span className="summary-item">
              未完了: {myTasks.filter(t => t.status !== 'completed').length}件
            </span>
            <span className="summary-item">
              進行中: {myTasks.filter(t => t.status === 'in_progress').length}件
            </span>
          </div>
        </div>
      </div>

      {/* フィルター */}
      <div className="filter-bar">
        <div className="filter-buttons">
          <button 
            onClick={() => setSelectedTaskType('all')}
            className={selectedTaskType === 'all' ? 'filter-btn active' : 'filter-btn'}
          >
            すべて ({myTasks.length})
          </button>
          <button 
            onClick={() => setSelectedTaskType('daily')}
            className={selectedTaskType === 'daily' ? 'filter-btn active' : 'filter-btn'}
          >
            日時 ({myTasks.filter(t => t.type === 'daily').length})
          </button>
          <button 
            onClick={() => setSelectedTaskType('weekly')}
            className={selectedTaskType === 'weekly' ? 'filter-btn active' : 'filter-btn'}
          >
            週次 ({myTasks.filter(t => t.type === 'weekly').length})
          </button>
          <button 
            onClick={() => setSelectedTaskType('main')}
            className={selectedTaskType === 'main' ? 'filter-btn active' : 'filter-btn'}
          >
            メイン ({myTasks.filter(t => t.type === 'main').length})
          </button>
        </div>
      </div>

      {/* タスク一覧 */}
      <div className="personal-task-list">
        {finalTasks.length === 0 ? (
          <div className="empty-state">
            <p>該当するタスクがありません</p>
            {selectedTaskType !== 'all' && (
              <p className="empty-subtext">
                {getTaskTypeLabel(selectedTaskType as TaskType)}タスクは割り当てられていません
              </p>
            )}
          </div>
        ) : (
          finalTasks.map(task => (
            <div key={task.id} className={`personal-task-card ${getStatusClass(task.status)} ${isOverdue(task) ? 'overdue' : ''} ${getTaskColorClass(task.color)} ${task.isPriority ? 'priority' : ''}`}>
              <div className="task-header">
                <div className="task-title-section">
                  <h3 className="task-title">{task.title}</h3>
                  <div className="task-meta">
                    <span className={`task-type type-${task.type}`}>
                      {getTaskTypeLabel(task.type)}
                    </span>
                    <span className={`task-status ${getStatusClass(task.status)}`}>
                      {getStatusText(task.status)}
                    </span>
                    {isOverdue(task) && (
                      <span className="overdue-badge">期限切れ</span>
                    )}
                  </div>
                </div>
              </div>
              
              {task.description && (
                <p className="task-description">{task.description}</p>
              )}
              
              {task.type === 'weekly' && task.weeklyDayOfWeek && (
                <div className="task-due-date">
                  <span className="due-date-label">繰り返し:</span>
                  <span className="due-date-value">
                    毎週{getDayOfWeekLabel(task.weeklyDayOfWeek)}
                  </span>
                </div>
              )}
              
              <div className="task-actions">
                <button
                  onClick={() => onUpdateTaskPriority(task.id, !task.isPriority)}
                  className={`priority-btn ${task.isPriority ? 'active' : ''}`}
                  title="優先度を切り替え"
                >
                  {task.isPriority ? '★' : '☆'}
                </button>
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
                {task.status === 'resumable' && (
                  <button
                    onClick={() => onUpdateTaskStatus(task.id, 'in_progress')}
                    className="task-action-btn resume-btn"
                  >
                    作業再開
                  </button>
                )}
              </div>
              
              <div className="task-timestamps">
                <span className="timestamp">
                  作成: {task.createdAt.toLocaleDateString('ja-JP')}
                </span>
                {task.updatedAt && task.updatedAt !== task.createdAt && (
                  <span className="timestamp">
                    更新: {task.updatedAt.toLocaleDateString('ja-JP')}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};