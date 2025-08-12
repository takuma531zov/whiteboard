// ユーザー関連の型定義
export interface User {
  id: string; // Firebase Authentication UID
  employeeId: string; // 社員番号
  name: string; // 氏名
  isAttending: boolean; // 出勤状況
  createdAt: Date;
  updatedAt: Date;
}

// タスク関連の型定義
export interface Task {
  id: string;
  title: string; // タスク名
  description?: string; // 説明
  type: TaskType; // タスク種別
  status: TaskStatus; // ステータス
  assignedUserIds?: string[]; // アサインされたユーザーIDの配列
  createdBy: string; // 作成者ユーザーID
  dueDate?: Date; // 期限日時（週次タスクの場合）
  weeklyDayOfWeek?: DayOfWeek; // 週次タスクの曜日設定
  createdAt: Date;
  updatedAt: Date;
  
  // メインタスク専用フィールド
  workStartTime?: Date; // 作業開始時間
  workEndTime?: Date; // 作業終了時間
  totalWorkTime?: number; // 総作業時間（分）
  
  // 表示設定
  color?: TaskColor; // タスクの背景色
}

// タスクの色
export type TaskColor = 'default' | 'blue' | 'green' | 'purple' | 'pink' | 'orange';

// 曜日
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// タスク種別
export type TaskType = 'daily' | 'weekly' | 'main';

// タスクステータス
export type TaskStatus = 
  | 'todo' // 未着手
  | 'in_progress' // 進行中（メインタスクのみ）
  | 'completed'; // 完了

// ログインフォーム用の型
export interface LoginFormData {
  employeeId: string;
  password: string;
}

// Firebase Auth のカスタムクレーム用
export interface CustomClaims {
  employeeId: string;
}

// API レスポンス用の型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}