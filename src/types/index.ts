// 組織関連の型定義
export type Department = 
  | '総務部'
  | '人事部' 
  | '経理部'
  | '開発部'
  | '営業部'
  | 'マーケティング部'
  | '品質管理部'
  | '情報システム部';

export type Division = 
  | '業務課'
  | '総務課'
  | '人事課'
  | '経理企画課'
  | 'システム開発課'
  | 'フロントエンド開発課'
  | 'バックエンド開発課'
  | '営業企画課'
  | '顧客対応課'
  | 'デジタルマーケティング課'
  | 'PR広報課'
  | 'QA課'
  | 'インフラ管理課';

export type EmployeeType = 
  | '正社員'
  | '契約社員'
  | 'パートタイム'
  | 'アルバイト'
  | '派遣社員'
  | '業務委託'
  | 'インターン';

// ユーザー関連の型定義
export interface User {
  id: string; // Firebase Authentication UID
  employeeId: string; // 社員番号
  name: string; // 氏名
  isAttending: boolean; // 出勤状況
  
  // 新しいステータスフィールド
  department?: Department; // 所属部署
  division?: Division; // 所属課
  employeeType?: EmployeeType; // 従業員区分
  
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
export type TaskTypeFilter = TaskType | 'all';

// タスクステータス
export type TaskStatus = 
  | 'todo' // 未着手
  | 'in_progress' // 進行中（メインタスクのみ）
  | 'completed' // 完了
  | 'resumable'; // 再開可能（メインタスクのみ）

// ログインフォーム用の型
export interface LoginFormData {
  employeeId: string;
  password: string;
}

// Firebase Auth のカスタムクレーム用
export interface CustomClaims {
  employeeId: string;
}

// 出退勤記録の型定義
export interface AttendanceRecord {
  id: string;
  userId: string; // ユーザーID
  employeeId: string; // 社員番号
  date: string; // 日付（YYYY-MM-DD形式）
  clockInTime?: Date; // 出勤時刻
  clockOutTime?: Date; // 退勤時刻
  totalWorkTime?: number; // 総労働時間（分）
  status: AttendanceStatus; // 勤怠ステータス
  createdAt: Date;
  updatedAt: Date;
}

// 勤怠ステータス
export type AttendanceStatus = 
  | 'clocked_in' // 出勤済み
  | 'clocked_out' // 退勤済み
  | 'absent'; // 欠勤

// 出退勤打刻用のリクエスト型
export interface ClockRequest {
  userId: string;
  employeeId: string;
  action: 'clock_in' | 'clock_out';
  timestamp: Date;
}

// API レスポンス用の型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// マスターデータ管理用の型定義
export interface MasterData {
  id: string;
  type: 'department' | 'division' | 'employeeType';
  value: string;
  order: number; // 表示順序
  isActive: boolean; // 有効/無効フラグ
  createdAt: Date;
  updatedAt: Date;
}

// 作業セッション管理用の型定義
export interface WorkSession {
  id: string;
  taskId: string; // タスクID
  userId: string; // 作業者のユーザーID
  startTime: Date; // セッション開始時間
  endTime?: Date; // セッション終了時間
  duration?: number; // セッション時間（分）
  date: string; // 作業日（YYYY-MM-DD形式）
  isActive: boolean; // アクティブなセッションかどうか
  createdAt: Date;
  updatedAt: Date;
}