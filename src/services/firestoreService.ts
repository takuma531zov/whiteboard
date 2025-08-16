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
import { User, Task, TaskType, AttendanceRecord, AttendanceStatus, ClockRequest, MasterData, WorkSession } from '../types';

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

  /**
   * ユーザー情報を更新
   */
  static async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        ...updates,
        updatedAt: new Date()
      });
      
      console.log('ユーザー情報更新完了:', { userId, updates });
      
    } catch (error) {
      console.error('ユーザー情報更新エラー:', error);
      throw new Error('ユーザー情報の更新に失敗しました');
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
      
      const firestoreData = {
        ...taskData,
        createdAt: new Date(),
        updatedAt: new Date(),
        // 日付フィールドをTimestamp形式で保存
        dueDate: taskData.dueDate ? Timestamp.fromDate(taskData.dueDate) : null,
        workStartTime: taskData.workStartTime ? Timestamp.fromDate(taskData.workStartTime) : null,
        workEndTime: taskData.workEndTime ? Timestamp.fromDate(taskData.workEndTime) : null,
        // assignedUserIds フィールドを明示的に保存
        assignedUserIds: taskData.assignedUserIds || []
      };

      // undefinedフィールドを除外（Firestoreはundefinedをサポートしていない）
      const cleanedData = Object.fromEntries(
        Object.entries(firestoreData).filter(([_, value]) => value !== undefined)
      );
      
      const docRef = await addDoc(tasksRef, cleanedData);
      
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
      
      // undefinedフィールドのみを除外（nullは明示的な値として許可）
      const cleanUpdates: any = {};
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
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
      
      
      await updateDoc(taskRef, updateData);
      
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
      isPriority: data.isPriority, // 追加
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
  
  // ===========================================
  // 出退勤記録関連の操作
  // ===========================================
  
  /**
   * 本日の出退勤記録を取得
   */
  static async getTodayAttendanceRecord(userId: string): Promise<AttendanceRecord | null> {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const attendanceRef = collection(db, 'attendance');
      const q = query(
        attendanceRef,
        where('userId', '==', userId),
        where('date', '==', today)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      return this.convertFirestoreAttendanceRecord(doc.id, doc.data());
      
    } catch (error) {
      console.error('出退勤記録取得エラー:', error);
      throw new Error('出退勤記録の取得に失敗しました');
    }
  }
  
  /**
   * 出勤打刻を記録
   */
  static async clockIn(clockRequest: ClockRequest): Promise<AttendanceRecord> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 本日の記録があるか確認
      const existingRecord = await this.getTodayAttendanceRecord(clockRequest.userId);
      
      if (existingRecord) {
        // 既存記録がある場合は出勤時刻を更新
        const attendanceDocRef = doc(db, 'attendance', existingRecord.id);
        await updateDoc(attendanceDocRef, {
          clockInTime: Timestamp.fromDate(clockRequest.timestamp),
          status: 'clocked_in',
          updatedAt: Timestamp.fromDate(new Date())
        });
        
        return {
          ...existingRecord,
          clockInTime: clockRequest.timestamp,
          status: 'clocked_in' as AttendanceStatus,
          updatedAt: new Date()
        };
      } else {
        // 新規記録を作成
        const attendanceRef = collection(db, 'attendance');
        const newRecord = {
          userId: clockRequest.userId,
          employeeId: clockRequest.employeeId,
          date: today,
          clockInTime: Timestamp.fromDate(clockRequest.timestamp),
          status: 'clocked_in',
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date())
        };
        
        const docRef = await addDoc(attendanceRef, newRecord);
        
        return {
          id: docRef.id,
          userId: clockRequest.userId,
          employeeId: clockRequest.employeeId,
          date: today,
          clockInTime: clockRequest.timestamp,
          status: 'clocked_in' as AttendanceStatus,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
      
    } catch (error) {
      console.error('出勤打刻エラー:', error);
      throw new Error('出勤打刻の記録に失敗しました');
    }
  }
  
  /**
   * 退勤打刻を記録
   */
  static async clockOut(clockRequest: ClockRequest): Promise<AttendanceRecord> {
    try {
      const existingRecord = await this.getTodayAttendanceRecord(clockRequest.userId);
      
      if (!existingRecord) {
        throw new Error('出勤記録がありません。先に出勤打刻を行ってください。');
      }
      
      if (!existingRecord.clockInTime) {
        throw new Error('出勤時刻が記録されていません。');
      }
      
      // 総労働時間を計算（分単位）
      const workTimeMinutes = Math.floor(
        (clockRequest.timestamp.getTime() - existingRecord.clockInTime.getTime()) / (1000 * 60)
      );
      
      const attendanceDocRef = doc(db, 'attendance', existingRecord.id);
      await updateDoc(attendanceDocRef, {
        clockOutTime: Timestamp.fromDate(clockRequest.timestamp),
        totalWorkTime: workTimeMinutes,
        status: 'clocked_out',
        updatedAt: Timestamp.fromDate(new Date())
      });
      
      return {
        ...existingRecord,
        clockOutTime: clockRequest.timestamp,
        totalWorkTime: workTimeMinutes,
        status: 'clocked_out' as AttendanceStatus,
        updatedAt: new Date()
      };
      
    } catch (error) {
      console.error('退勤打刻エラー:', error);
      throw new Error('退勤打刻の記録に失敗しました');
    }
  }
  
  /**
   * 指定期間の出退勤記録を取得
   */
  static async getAttendanceRecords(
    userId: string, 
    startDate: string, 
    endDate: string
  ): Promise<AttendanceRecord[]> {
    try {
      const attendanceRef = collection(db, 'attendance');
      const q = query(
        attendanceRef,
        where('userId', '==', userId),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreAttendanceRecord(doc.id, doc.data())
      );
      
    } catch (error) {
      console.error('出退勤記録一覧取得エラー:', error);
      throw new Error('出退勤記録の取得に失敗しました');
    }
  }
  
  /**
   * 出退勤記録のリアルタイム監視
   */
  static subscribeToTodayAttendance(
    userId: string, 
    callback: (record: AttendanceRecord | null) => void
  ): () => void {
    const today = new Date().toISOString().split('T')[0];
    const attendanceRef = collection(db, 'attendance');
    const q = query(
      attendanceRef,
      where('userId', '==', userId),
      where('date', '==', today)
    );
    
    return onSnapshot(q, (querySnapshot) => {
      if (querySnapshot.empty) {
        callback(null);
      } else {
        const doc = querySnapshot.docs[0];
        const record = this.convertFirestoreAttendanceRecord(doc.id, doc.data());
        callback(record);
      }
    });
  }
  
  /**
   * Firestoreの出退勤データを型安全なAttendanceRecordに変換
   */
  private static convertFirestoreAttendanceRecord(id: string, data: any): AttendanceRecord {
    return {
      id,
      userId: data.userId,
      employeeId: data.employeeId,
      date: data.date,
      clockInTime: data.clockInTime?.toDate(),
      clockOutTime: data.clockOutTime?.toDate(),
      totalWorkTime: data.totalWorkTime || 0,
      status: data.status,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    };
  }

  // ===========================================
  // マスターデータ関連の操作
  // ===========================================

  /**
   * 指定タイプのマスターデータを全て取得
   */
  static async getMasterData(type: 'department' | 'division' | 'employeeType' | 'role'): Promise<MasterData[]> {
    try {
      console.log(`マスターデータ取得開始: ${type}`);
      const masterRef = collection(db, 'masterData');
      
      // まず、orderByなしでクエリを試行
      let q;
      try {
        q = query(
          masterRef, 
          where('type', '==', type),
          where('isActive', '==', true),
          orderBy('order', 'asc')
        );
      } catch (indexError) {
        console.warn('複合インデックスが未作成の可能性があります。orderBy なしで取得します:', indexError);
        // orderBy なしでクエリを実行
        q = query(
          masterRef, 
          where('type', '==', type),
          where('isActive', '==', true)
        );
      }
      
      console.log('Firestoreクエリ実行中...');
      const querySnapshot = await getDocs(q);
      console.log(`クエリ結果: ${querySnapshot.docs.length}件`);
      
      const results = querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log(`ドキュメント ${doc.id}:`, data);
        return {
          id: doc.id,
          type: data.type,
          value: data.value,
          order: data.order || 0,
          isActive: data.isActive,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as MasterData;
      });
      
      // クライアントサイドでソート（インデックスが無い場合の対策）
      results.sort((a, b) => a.order - b.order);
      
      console.log(`マスターデータ取得完了 (${type}):`, results);
      return results;
      
    } catch (error: any) {
      console.error('マスターデータ取得エラー詳細:', {
        type,
        error: error,
        code: error?.code,
        message: error?.message,
        stack: error?.stack
      });
      throw new Error(`マスターデータの取得に失敗しました (${type}): ${error.message || error}`);
    }
  }

  /**
   * マスターデータを追加
   */
  static async addMasterData(type: 'department' | 'division' | 'employeeType' | 'role', value: string): Promise<MasterData> {
    try {
      // 既存の最大order値を取得
      const existingData = await this.getMasterData(type);
      const maxOrder = existingData.length > 0 ? Math.max(...existingData.map(d => d.order)) : 0;
      
      const masterRef = collection(db, 'masterData');
      const newData = {
        type,
        value,
        order: maxOrder + 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(masterRef, newData);
      
      return {
        id: docRef.id,
        ...newData
      };
      
    } catch (error) {
      console.error('マスターデータ追加エラー:', error);
      throw new Error('マスターデータの追加に失敗しました');
    }
  }

  /**
   * マスターデータを更新
   */
  static async updateMasterData(id: string, updates: Partial<MasterData>): Promise<void> {
    try {
      const masterRef = doc(db, 'masterData', id);
      await updateDoc(masterRef, {
        ...updates,
        updatedAt: new Date()
      });
      
    } catch (error) {
      console.error('マスターデータ更新エラー:', error);
      throw new Error('マスターデータの更新に失敗しました');
    }
  }

  /**
   * マスターデータを削除（論理削除）
   */
  static async deleteMasterData(id: string): Promise<void> {
    try {
      const masterRef = doc(db, 'masterData', id);
      await updateDoc(masterRef, {
        isActive: false,
        updatedAt: new Date()
      });
      
    } catch (error) {
      console.error('マスターデータ削除エラー:', error);
      throw new Error('マスターデータの削除に失敗しました');
    }
  }

  /**
   * マスターデータの表示順序を更新
   */
  static async updateMasterDataOrder(updates: { id: string; order: number }[]): Promise<void> {
    try {
      const updatePromises = updates.map(({ id, order }) => {
        const masterRef = doc(db, 'masterData', id);
        return updateDoc(masterRef, {
          order,
          updatedAt: new Date()
        });
      });
      
      await Promise.all(updatePromises);
      
    } catch (error) {
      console.error('マスターデータ順序更新エラー:', error);
      throw new Error('マスターデータの順序更新に失敗しました');
    }
  }

  // ===========================================
  // 作業セッション関連の操作
  // ===========================================

  /**
   * 作業セッションを開始
   */
  static async startWorkSession(taskId: string, userId: string): Promise<WorkSession> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 既にアクティブなセッションがあるかチェック
      const activeSession = await this.getActiveWorkSession(taskId, userId);
      if (activeSession) {
        throw new Error('既にアクティブな作業セッションが存在します');
      }
      
      const workSessionRef = collection(db, 'workSessions');
      const newSession = {
        taskId,
        userId,
        startTime: new Date(),
        date: today,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(workSessionRef, newSession);
      
      return {
        id: docRef.id,
        ...newSession
      };
      
    } catch (error) {
      console.error('作業セッション開始エラー:', error);
      throw new Error('作業セッションの開始に失敗しました');
    }
  }

  /**
   * 作業セッションを終了
   */
  static async endWorkSession(taskId: string, userId: string): Promise<WorkSession | null> {
    try {
      const activeSession = await this.getActiveWorkSession(taskId, userId);
      if (!activeSession) {
        throw new Error('アクティブな作業セッションが見つかりません');
      }
      
      const endTime = new Date();
      const duration = Math.round((endTime.getTime() - activeSession.startTime.getTime()) / (1000 * 60)); // 分単位
      
      const sessionRef = doc(db, 'workSessions', activeSession.id);
      await updateDoc(sessionRef, {
        endTime: endTime,
        duration: duration,
        isActive: false,
        updatedAt: new Date()
      });
      
      return {
        ...activeSession,
        endTime,
        duration,
        isActive: false,
        updatedAt: new Date()
      };
      
    } catch (error) {
      console.error('作業セッション終了エラー:', error);
      throw new Error('作業セッションの終了に失敗しました');
    }
  }

  /**
   * アクティブな作業セッションを取得
   */
  static async getActiveWorkSession(taskId: string, userId: string): Promise<WorkSession | null> {
    try {
      const workSessionRef = collection(db, 'workSessions');
      const q = query(
        workSessionRef,
        where('taskId', '==', taskId),
        where('userId', '==', userId),
        where('isActive', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      
      return {
        id: doc.id,
        taskId: data.taskId,
        userId: data.userId,
        startTime: data.startTime?.toDate() || new Date(),
        endTime: data.endTime?.toDate(),
        duration: data.duration,
        date: data.date,
        isActive: data.isActive,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      };
      
    } catch (error) {
      console.error('アクティブセッション取得エラー:', error);
      return null;
    }
  }

  /**
   * 指定日のタスクの総作業時間を取得
   */
  static async getDailyWorkTime(taskId: string, date: string): Promise<number> {
    try {
      const workSessionRef = collection(db, 'workSessions');
      const q = query(
        workSessionRef,
        where('taskId', '==', taskId),
        where('date', '==', date),
        where('isActive', '==', false) // 完了したセッションのみ
      );
      
      const querySnapshot = await getDocs(q);
      
      let totalMinutes = 0;
      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.duration) {
          totalMinutes += data.duration;
        }
      });
      
      return totalMinutes;
      
    } catch (error) {
      console.error('日次作業時間取得エラー:', error);
      return 0;
    }
  }

  /**
   * 指定タスクの作業セッション履歴を取得
   */
  static async getWorkSessionHistory(taskId: string, date?: string): Promise<WorkSession[]> {
    try {
      const workSessionRef = collection(db, 'workSessions');
      let q = query(
        workSessionRef,
        where('taskId', '==', taskId),
        orderBy('startTime', 'desc')
      );
      
      if (date) {
        q = query(
          workSessionRef,
          where('taskId', '==', taskId),
          where('date', '==', date),
          orderBy('startTime', 'desc')
        );
      }
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          taskId: data.taskId,
          userId: data.userId,
          startTime: data.startTime?.toDate() || new Date(),
          endTime: data.endTime?.toDate(),
          duration: data.duration,
          date: data.date,
          isActive: data.isActive,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        };
      });
      
    } catch (error) {
      console.error('作業履歴取得エラー:', error);
      return [];
    }
  }
}