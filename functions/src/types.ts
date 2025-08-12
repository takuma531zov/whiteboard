/**
 * Firebase Functions用の型定義
 */

// 曜日の型
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// タスクの型（Functionsで必要な部分のみ）
export interface Task {
  id: string;
  title: string;
  type: 'daily' | 'weekly' | 'main';
  status: 'todo' | 'in_progress' | 'completed';
  assignedUserIds?: string[];
  createdBy: string;
  dueDate?: Date;
  weeklyDayOfWeek?: DayOfWeek;
  createdAt: Date;
  updatedAt: Date;
}

// ユーザーの型
export interface User {
  id: string;
  employeeId: string;
  name: string;
  isAttending: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 期限切れチェック結果の型
export interface OverdueCheckResult {
  totalChecked: number;
  overdueCount: number;
  overdueTasks: {
    id: string;
    title: string;
    assignedUsers: string[];
    dayOfWeek?: string;
    daysOverdue: number;
  }[];
  processedAt: Date;
}