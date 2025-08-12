import React from 'react';
import { Task } from '../types';
import './AlertPanel.css';

// アラートパネルのプロパティ
interface AlertPanelProps {
  alertTasks: Task[];
  getUserName: (userId: string) => string;
  onTaskClick: (taskId: string) => void;
}

/**
 * アラート表示コンポーネント
 * 未完了・期限切れタスクを画面上部に表示
 */
export const AlertPanel: React.FC<AlertPanelProps> = ({
  alertTasks,
  getUserName,
  onTaskClick
}) => {
  if (alertTasks.length === 0) {
    return null;
  }

  /**
   * アラートタイプを取得
   */
  const getAlertType = (task: Task) => {
    const now = new Date();
    
    if (task.type === 'weekly' && task.dueDate && task.dueDate < now) {
      return 'overdue';
    }
    
    if (task.type === 'main' && task.status === 'in_progress' && task.workStartTime) {
      const hoursInProgress = (now.getTime() - task.workStartTime.getTime()) / (1000 * 60 * 60);
      if (hoursInProgress > 4) {
        return 'long_running';
      }
    }
    
    return 'warning';
  };

  /**
   * アラートメッセージを取得
   */
  const getAlertMessage = (task: Task) => {
    const alertType = getAlertType(task);
    
    switch (alertType) {
      case 'overdue':
        return '期限切れ';
      case 'long_running':
        return '長時間進行中';
      default:
        return '要確認';
    }
  };

  /**
   * 担当者名を取得
   */
  const getAssignedUsersText = (userIds?: string[]) => {
    if (!userIds || userIds.length === 0) return '未アサイン';
    
    if (userIds.length === 1) {
      return getUserName(userIds[0]);
    }
    
    if (userIds.length <= 2) {
      return userIds.map(id => getUserName(id)).join(', ');
    }
    
    const firstName = getUserName(userIds[0]);
    return `${firstName} 他${userIds.length - 1}名`;
  };

  return (
    <div className="alert-panel">
      <div className="alert-header">
        <span className="alert-icon">⚠️</span>
        <span className="alert-title">要対応タスク ({alertTasks.length}件)</span>
      </div>
      
      <div className="alert-tasks">
        {alertTasks.map(task => (
          <div 
            key={task.id} 
            className={`alert-task ${getAlertType(task)}`}
            onClick={() => onTaskClick(task.id)}
          >
            <div className="alert-task-info">
              <span className="alert-task-title">{task.title}</span>
              <span className="alert-task-type">[{task.type === 'daily' ? '日時' : task.type === 'weekly' ? '週次' : 'メイン'}]</span>
            </div>
            
            <div className="alert-task-details">
              <span className="alert-message">{getAlertMessage(task)}</span>
              {task.type === 'weekly' && task.dueDate && (
                <span className="alert-due-date">
                  期限: {task.dueDate.toLocaleDateString('ja-JP')}
                </span>
              )}
              <span className="alert-assignee">
                {getAssignedUsersText(task.assignedUserIds)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};