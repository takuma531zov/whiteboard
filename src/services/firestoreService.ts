import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { User, Task, TaskType } from '../types';

/**
 * Firestoreサービス
 * データベースのCRUD操作を管理
 */
export class FirestoreService {
  
  // ===========================================
  // ユーザー関連の操作
  // ===========================================
  
  /**
   * 全ユーザーを取得
   */
  static async getAllUsers(): Promise<User[]> {
    try {
      const usersRef = collection(db, 'users');
      const querySnapshot = await getDocs(usersRef);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      } as User));
      
    } catch (error) {
      console.error('ユーザー取得エラー:', error);
      throw new Error('ユーザー情報の取得に失敗しました');
    }
  }
  
  /**
   * 出勤中のユーザーのみを取得
   */
  static async getAttendingUsers(): Promise<User[]> {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('isAttending', '==', true));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      } as User));
      
    } catch (error) {
      console.error('出勤ユーザー取得エラー:', error);
      throw new Error('出勤ユーザー情報の取得に失敗しました');
    }
  }
  
  /**
   * 新しいユーザーを作成
   */
  static async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const usersRef = collection(db, 'users');
      
      // 既存の社員番号をチェック
      const existingUserQuery = query(usersRef, where('employeeId', '==', userData.employeeId));
      const existingUserSnapshot = await getDocs(existingUserQuery);
      
      if (!existingUserSnapshot.empty) {
        throw new Error('この社員番号は既に使用されています');
      }
      
      const docRef = await addDoc(usersRef, {
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return docRef.id;
      
    } catch (error) {
      console.error('ユーザー作成エラー:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('ユーザーの作成に失敗しました');
    }
  }

  /**
   * ユーザーを削除（Firestore のみ、無料プラン対応）
   * Firestore からユーザー情報を削除し、タスクからの担当者除去を実行
   * 注意: Firebase Authentication のアカウントは残存するが、実質的に無効化される
   */
  static async deleteUser(userId: string): Promise<void> {
    try {
      console.log('ユーザー削除開始:', userId);
      
      // 1. 削除対象ユーザーの情報を取得（ログ用）
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('削除対象のユーザーが見つかりません');
      }
      
      const userData = userDoc.data() as User;
      console.log('削除対象ユーザー:', userData);
      
      // 2. 削除されたユーザーが担当しているタスクから担当者情報を除去
      await this.cleanupUserFromTasks(userId);
      
      // 3. Firestore からユーザードキュメントを削除
      await deleteDoc(doc(db, 'users', userId));
      console.log('Firestore からユーザーを削除完了:', userId);
      
      console.log('ユーザー削除完了:', {
        deletedUserId: userId,
        deletedUserName: userData.name,
        deletedEmployeeId: userData.employeeId
      });
      
    } catch (error: any) {
      console.error('ユーザー削除エラー:', error);
      throw new Error(error.message || 'ユーザーの削除に失敗しました');
    }
  }

  /**
   * 削除されたユーザーが担当しているタスクから担当者情報を除去（クライアントサイド）
   */
  private static async cleanupUserFromTasks(userId: string): Promise<void> {
    try {
      console.log('タスククリーンアップ開始:', userId);
      
      // 削除されたユーザーが担当しているタスクを検索
      const tasksRef = collection(db, 'tasks');
      const q = query(tasksRef, where('assignedUserIds', 'array-contains', userId));
      const tasksSnapshot = await getDocs(q);
      
      if (tasksSnapshot.empty) {
        console.log('削除対象ユーザーが担当するタスクはありません');
        return;
      }
      
      console.log(`${tasksSnapshot.size}件のタスクから担当者を除去します`);
      
      // 各タスクから該当ユーザーを除去
      const updatePromises = tasksSnapshot.docs.map(async (taskDoc) => {
        const taskData = taskDoc.data();
        const updatedAssignedUserIds = (taskData.assignedUserIds || []).filter(
          (id: string) => id !== userId
        );
        
        console.log(`タスク「${taskData.title}」から担当者 ${userId} を除去`);
        
        return updateDoc(taskDoc.ref, {
          assignedUserIds: updatedAssignedUserIds,
          updatedAt: new Date()
        });
      });
      
      await Promise.all(updatePromises);
      console.log(`${tasksSnapshot.size}件のタスクから削除ユーザーを除去完了`);
      
    } catch (error) {
      console.error('タスククリーンアップエラー:', error);
      // タスククリーンアップエラーはユーザー削除の失敗とはしない（継続実行）
      console.warn('タスククリーンアップでエラーが発生しましたが、ユーザー削除は継続します');
    }
  }

  /**
   * ユーザーの出勤状況を更新
   */
  static async updateUserAttendance(userId: string, isAttending: boolean): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isAttending,
        updatedAt: new Date()
      });
      
    } catch (error) {
      console.error('出勤状況更新エラー:', error);
      throw new Error('出勤状況の更新に失敗しました');
    }
  }
  
  // ===========================================
  // タスク関連の操作
  // ===========================================
  
  /**
   * 全てのタスクを取得
   */
  static async getAllTasks(): Promise<Task[]> {
    try {
      const tasksRef = collection(db, 'tasks');
      const q = query(tasksRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => this.convertFirestoreTask(doc.id, doc.data()));
      
    } catch (error) {
      console.error('タスク取得エラー:', error);
      throw new Error('タスク情報の取得に失敗しました');
    }
  }
  
  /**
   * 特定のタイプのタスクを取得
   */
  static async getTasksByType(type: TaskType): Promise<Task[]> {
    try {
      const tasksRef = collection(db, 'tasks');
      const q = query(
        tasksRef, 
        where('type', '==', type),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => this.convertFirestoreTask(doc.id, doc.data()));
      
    } catch (error) {
      console.error('タスク取得エラー:', error);
      throw new Error('タスク情報の取得に失敗しました');
    }
  }
  
  /**
   * 未完了タスクを取得
   */
  static async getIncompleteTasks(): Promise<Task[]> {
    try {
      const tasksRef = collection(db, 'tasks');
      const q = query(
        tasksRef,
        where('status', 'in', ['todo', 'in_progress']),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => this.convertFirestoreTask(doc.id, doc.data()));
      
    } catch (error) {
      console.error('未完了タスク取得エラー:', error);
      throw new Error('未完了タスクの取得に失敗しました');
    }
  }
  
  /**
   * 新しいタスクを作成
   */
  static async createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const tasksRef = collection(db, 'tasks');
      const docRef = await addDoc(tasksRef, {
        ...taskData,
        createdAt: new Date(),
        updatedAt: new Date(),
        // 日付フィールドをTimestamp形式で保存
        dueDate: taskData.dueDate ? Timestamp.fromDate(taskData.dueDate) : null,
        workStartTime: taskData.workStartTime ? Timestamp.fromDate(taskData.workStartTime) : null,
        workEndTime: taskData.workEndTime ? Timestamp.fromDate(taskData.workEndTime) : null,
        // assignedUserIds フィールドを明示的に保存
        assignedUserIds: taskData.assignedUserIds || []
      });
      
      return docRef.id;
      
    } catch (error) {
      console.error('タスク作成エラー:', error);
      throw new Error('タスクの作成に失敗しました');
    }
  }
  
  /**
   * タスクを更新
   */
  static async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    let updateData: any = null;
    
    try {
      const taskRef = doc(db, 'tasks', taskId);
      
      // undefinedとnullフィールドを除外
      const cleanUpdates: any = {};
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          cleanUpdates[key] = value;
        }
      });
      
      
      updateData = {
        ...cleanUpdates,
        updatedAt: Timestamp.fromDate(new Date()) // Timestamp形式に変換
      };
      
      // 日付フィールドをTimestamp形式に変換
      if (updates.dueDate && updates.dueDate instanceof Date) {
        updateData.dueDate = Timestamp.fromDate(updates.dueDate);
      }
      if (updates.workStartTime && updates.workStartTime instanceof Date) {
        updateData.workStartTime = Timestamp.fromDate(updates.workStartTime);
      }
      if (updates.workEndTime && updates.workEndTime instanceof Date) {
        updateData.workEndTime = Timestamp.fromDate(updates.workEndTime);
      }
      if (updates.createdAt && updates.createdAt instanceof Date) {
        updateData.createdAt = Timestamp.fromDate(updates.createdAt);
      }
      
      
      console.log('Firestore更新データ:', updateData);
      
      await updateDoc(taskRef, updateData);
      
      console.log('Firestore更新完了:', taskId);
      
    } catch (error) {
      console.error('タスク更新エラー:', error);
      throw new Error('タスクの更新に失敗しました');
    }
  }
  
  /**
   * タスクを削除
   */
  static async deleteTask(taskId: string): Promise<void> {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await deleteDoc(taskRef);
      
    } catch (error) {
      console.error('タスク削除エラー:', error);
      throw new Error('タスクの削除に失敗しました');
    }
  }
  
  /**
   * メインタスクの作業開始
   */
  static async startMainTaskWork(taskId: string): Promise<void> {
    try {
      await this.updateTask(taskId, {
        status: 'in_progress',
        workStartTime: new Date()
      });
    } catch (error) {
      console.error('メインタスク開始エラー:', error);
      throw new Error('タスクの開始に失敗しました');
    }
  }
  
  /**
   * メインタスクの作業完了
   */
  static async completeMainTask(taskId: string): Promise<void> {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      const taskDoc = await getDoc(taskRef);
      
      if (!taskDoc.exists()) {
        throw new Error('タスクが見つかりません');
      }
      
      const task = this.convertFirestoreTask(taskDoc.id, taskDoc.data());
      const endTime = new Date();
      
      // 作業時間を計算（分単位）
      let totalWorkTime = task.totalWorkTime || 0;
      if (task.workStartTime) {
        const workDuration = Math.floor((endTime.getTime() - task.workStartTime.getTime()) / 60000);
        totalWorkTime += workDuration;
      }
      
      await this.updateTask(taskId, {
        status: 'completed',
        workEndTime: endTime,
        totalWorkTime
      });
      
    } catch (error) {
      console.error('メインタスク完了エラー:', error);
      throw new Error('タスクの完了に失敗しました');
    }
  }
  
  // ===========================================
  // リアルタイム監視機能
  // ===========================================
  
  /**
   * タスクの変更をリアルタイム監視
   */
  static subscribeToTasks(callback: (tasks: Task[]) => void): () => void {
    const tasksRef = collection(db, 'tasks');
    const q = query(tasksRef, orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (querySnapshot) => {
      const tasks = querySnapshot.docs.map(doc => 
        this.convertFirestoreTask(doc.id, doc.data())
      );
      callback(tasks);
    });
  }
  
  /**
   * ユーザーの変更をリアルタイム監視
   */
  static subscribeToUsers(callback: (users: User[]) => void): () => void {
    const usersRef = collection(db, 'users');
    
    return onSnapshot(usersRef, (querySnapshot) => {
      const users = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      } as User));
      callback(users);
    });
  }
  
  // ===========================================
  // 週次タスク期限チェック機能
  // ===========================================
  
  /**
   * 期限切れの週次タスクを取得
   */
  static async getOverdueWeeklyTasks(): Promise<Task[]> {
    try {
      const tasksRef = collection(db, 'tasks');
      const now = new Date();
      const q = query(
        tasksRef,
        where('type', '==', 'weekly'),
        where('status', '!=', 'completed'),
        where('dueDate', '<', Timestamp.fromDate(now))
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => this.convertFirestoreTask(doc.id, doc.data()));
      
    } catch (error) {
      console.error('期限切れタスク取得エラー:', error);
      throw new Error('期限切れタスクの取得に失敗しました');
    }
  }
  
  // ===========================================
  // ヘルパーメソッド
  // ===========================================
  
  /**
   * FirestoreのドキュメントデータをTaskオブジェクトに変換
   */
  private static convertFirestoreTask(id: string, data: any): Task {
    return {
      id,
      title: data.title,
      description: data.description,
      type: data.type,
      status: data.status,
      assignedUserIds: data.assignedUserIds || (data.assignedUserId ? [data.assignedUserId] : []),
      createdBy: data.createdBy,
      dueDate: data.dueDate?.toDate(),
      weeklyDayOfWeek: data.weeklyDayOfWeek,
      workStartTime: data.workStartTime?.toDate(),
      workEndTime: data.workEndTime?.toDate(),
      totalWorkTime: data.totalWorkTime || 0,
      color: data.color,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    };
  }
}