import React, { useState, useEffect } from 'react';
import { User, Task } from '../types';
import { FirestoreService } from '../services/firestoreService';
import { MainTaskArea } from './MainTaskArea';
import { WhiteboardArea } from './WhiteboardArea';
import { AlertPanel } from './AlertPanel';
import './WhiteboardMain.css';

// ホワイトボード画面のプロパティ
interface WhiteboardMainProps {
  currentUser: User;
}

/**
 * メイン画面（ホワイトボードUI）コンポーネント
 * 上部にメインタスク専用枠、下部に疑似ホワイトボード領域を配置
 */
export const WhiteboardMain: React.FC<WhiteboardMainProps> = ({
  currentUser
}) => {
  // 状態管理
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [attendingUsers, setAttendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  /**
   * 初期データの読み込み
   */
  useEffect(() => {
    loadInitialData();

    // リアルタイム監視を設定
    const unsubscribeTasks = FirestoreService.subscribeToTasks((updatedTasks) => {
      setTasks(updatedTasks);
    });

    const unsubscribeUsers = FirestoreService.subscribeToUsers((updatedUsers) => {
      setUsers(updatedUsers);
      setAttendingUsers(updatedUsers.filter(user => user.isAttending));
    });

    return () => {
      unsubscribeTasks();
      unsubscribeUsers();
    };
  }, []);

  /**
   * 初期データの読み込み
   */
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [tasksData, usersData] = await Promise.all([
        FirestoreService.getAllTasks(),
        FirestoreService.getAllUsers()
      ]);

      setTasks(tasksData);
      setUsers(usersData);
      setAttendingUsers(usersData.filter(user => user.isAttending));
      setError('');
    } catch (err: any) {
      console.error('データ読み込みエラー:', err);
      setError('データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  /**
   * タスクの状態を更新
   */
  const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      await FirestoreService.updateTask(taskId, { status: newStatus });
      // リアルタイム監視で自動更新されるため、ローカル更新は不要
    } catch (err: any) {
      console.error('タスクステータス更新エラー:', err);
      setError('タスクの更新に失敗しました');
    }
  };

  /**
   * メインタスクの作業開始
   */
  const startMainTask = async (taskId: string) => {
    try {
      await FirestoreService.startMainTaskWork(taskId);
    } catch (err: any) {
      console.error('メインタスク開始エラー:', err);
      setError('タスクの開始に失敗しました');
    }
  };

  /**
   * メインタスクの完了
   */
  const completeMainTask = async (taskId: string) => {
    try {
      // タスクを再開可能状態に変更
      await FirestoreService.updateTask(taskId, { status: 'resumable' });
    } catch (err: any) {
      console.error('メインタスク完了エラー:', err);
      setError('タスクの完了に失敗しました');
    }
  };

  /**
   * メインタスクの再開
   */
  const resumeMainTask = async (taskId: string) => {
    try {
      await FirestoreService.updateTask(taskId, { status: 'in_progress' });
    } catch (err: any) {
      console.error('メインタスク再開エラー:', err);
      setError('タスクの再開に失敗しました');
    }
  };

  /**
   * タスクの担当者を更新
   */
  const updateTaskAssignment = async (taskId: string, assignedUserIds: string[]) => {
    try {
      await FirestoreService.updateTask(taskId, { assignedUserIds });
    } catch (err: any) {
      console.error('担当者更新エラー:', err);
      setError('担当者の更新に失敗しました');
    }
  };

  /**
   * ユーザー名を取得
   */
  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || '不明なユーザー';
  };

  /**
   * タスク種別別にタスクを取得
   */
  const getTasksByType = (type: Task['type']) => {
    return tasks.filter(task => task.type === type);
  };

  /**
   * 未完了・期限切れタスクを取得
   */
  const getAlertTasks = () => {
    const now = new Date();
    return tasks.filter(task => {
      // 未完了タスク
      if (task.status !== 'completed') {
        // 週次タスクで期限切れ
        if (task.type === 'weekly' && task.dueDate && task.dueDate < now) {
          return true;
        }
        // メインタスクで長時間進行中
        if (task.type === 'main' && task.status === 'in_progress' && task.workStartTime) {
          const hoursInProgress = (now.getTime() - task.workStartTime.getTime()) / (1000 * 60 * 60);
          if (hoursInProgress > 5) { // 5時間以上進行中
            return true;
          }
        }
      }
      return false;
    });
  };

  // ローディング表示
  if (loading) {
    return (
      <div className="whiteboard-main">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>ホワイトボードを読み込み中...</p>
        </div>
      </div>
    );
  }

  const mainTasks = getTasksByType('main');
  const dailyTasks = getTasksByType('daily');
  const weeklyTasks = getTasksByType('weekly');
  const alertTasks = getAlertTasks();

  return (
    <div className="whiteboard-main">
      {/* エラーメッセージ */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError('')} className="error-close">×</button>
        </div>
      )}

      {/* アラート表示 */}
      <AlertPanel
        alertTasks={alertTasks}
        getUserName={getUserName}
        onTaskClick={(taskId) => {
          // タスクをクリックした時の処理（将来的に実装）
          console.log('Alert task clicked:', taskId);
        }}
      />

      {/* メインタスク専用枠 */}
      <MainTaskArea
        mainTasks={mainTasks}
        users={users}
        currentUser={currentUser}
        onStartTask={startMainTask}
        onCompleteTask={completeMainTask}
        onResumeTask={resumeMainTask}
        onUpdateStatus={updateTaskStatus}
        getUserName={getUserName}
      />

      {/* ホワイトボード領域 */}
      <WhiteboardArea
        dailyTasks={dailyTasks}
        weeklyTasks={weeklyTasks}
        attendingUsers={attendingUsers}
        currentUser={currentUser}
        onUpdateTaskAssignment={updateTaskAssignment}
        onUpdateTaskStatus={updateTaskStatus}
      />
    </div>
  );
};
