import React, { useState, useEffect } from 'react';
import { FirestoreService } from '../services/firestoreService';
import { AttendanceRecord, AttendanceStatus, ClockRequest } from '../types';
import { User as FirebaseUser } from 'firebase/auth';
import { User } from '../types';
import './AttendanceTracker.css';

/**
 * 出退勤打刻コンポーネント
 * KOT代替機能として出退勤タイムスタンプを記録
 */
interface AttendanceTrackerProps {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
}

export const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({ currentUser, firebaseUser }) => {
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 現在時刻を表示するためのstate
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (!firebaseUser) return;

    // 本日の出退勤記録を取得
    loadTodayRecord();

    // リアルタイム監視を開始
    const unsubscribe = FirestoreService.subscribeToTodayAttendance(
      firebaseUser.uid,
      (record) => {
        setTodayRecord(record);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firebaseUser]);

  useEffect(() => {
    // 1秒ごとに現在時刻を更新
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  /**
   * 本日の出退勤記録を読み込む
   */
  const loadTodayRecord = async () => {
    if (!firebaseUser) return;

    try {
      const record = await FirestoreService.getTodayAttendanceRecord(firebaseUser.uid);
      setTodayRecord(record);
    } catch (err) {
      console.error('出退勤記録取得エラー:', err);
      setError('出退勤記録の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 出勤打刻
   */
  const handleClockIn = async () => {
    if (!firebaseUser || !currentUser) return;

    setIsProcessing(true);
    setError(null);

    try {
      const clockRequest: ClockRequest = {
        userId: firebaseUser.uid,
        employeeId: currentUser.employeeId || 'unknown',
        action: 'clock_in',
        timestamp: new Date()
      };

      await FirestoreService.clockIn(clockRequest);
      
      // ユーザーの出勤状況も更新
      await FirestoreService.updateUserAttendance(firebaseUser.uid, true);
      
    } catch (err: any) {
      console.error('出勤打刻エラー:', err);
      setError(err.message || '出勤打刻に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * 退勤打刻
   */
  const handleClockOut = async () => {
    if (!firebaseUser || !currentUser) return;

    setIsProcessing(true);
    setError(null);

    try {
      const clockRequest: ClockRequest = {
        userId: firebaseUser.uid,
        employeeId: currentUser.employeeId || 'unknown',
        action: 'clock_out',
        timestamp: new Date()
      };

      await FirestoreService.clockOut(clockRequest);
      
      // ユーザーの出勤状況も更新
      await FirestoreService.updateUserAttendance(firebaseUser.uid, false);
      
    } catch (err: any) {
      console.error('退勤打刻エラー:', err);
      setError(err.message || '退勤打刻に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * 時刻を HH:MM:SS 形式でフォーマット
   */
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  /**
   * 日付を YYYY年MM月DD日(曜日) 形式でフォーマット
   */
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  /**
   * 作業時間を時間:分形式でフォーマット
   */
  const formatWorkTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}時間${mins}分`;
  };

  /**
   * 現在の状態を取得
   */
  const getStatus = (): AttendanceStatus | 'not_clocked' => {
    if (!todayRecord) return 'not_clocked';
    return todayRecord.status;
  };

  /**
   * ステータスに応じた表示テキスト
   */
  const getStatusText = () => {
    const status = getStatus();
    switch (status) {
      case 'clocked_in':
        return '出勤中';
      case 'clocked_out':
        return '退勤済み';
      case 'not_clocked':
        return '未出勤';
      default:
        return '不明';
    }
  };

  /**
   * ステータスに応じたCSSクラス
   */
  const getStatusClass = () => {
    const status = getStatus();
    switch (status) {
      case 'clocked_in':
        return 'status-working';
      case 'clocked_out':
        return 'status-finished';
      case 'not_clocked':
        return 'status-not-started';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="attendance-tracker">
        <div className="loading">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="attendance-tracker">
      <div className="attendance-header">
        <h2>出退勤打刻</h2>
        <div className="current-datetime">
          <div className="current-date">{formatDate(currentTime)}</div>
          <div className="current-time">{formatTime(currentTime)}</div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="attendance-status">
        <div className={`status-indicator ${getStatusClass()}`}>
          <span className="status-text">{getStatusText()}</span>
        </div>
      </div>

      {/* 本日の出退勤記録表示 */}
      <div className="today-record">
        <h3>本日の記録</h3>
        <div className="record-details">
          <div className="record-item">
            <span className="label">出勤時刻:</span>
            <span className="value">
              {todayRecord?.clockInTime 
                ? formatTime(todayRecord.clockInTime)
                : '未記録'
              }
            </span>
          </div>
          <div className="record-item">
            <span className="label">退勤時刻:</span>
            <span className="value">
              {todayRecord?.clockOutTime 
                ? formatTime(todayRecord.clockOutTime)
                : '未記録'
              }
            </span>
          </div>
          <div className="record-item">
            <span className="label">労働時間:</span>
            <span className="value">
              {todayRecord?.totalWorkTime 
                ? formatWorkTime(todayRecord.totalWorkTime)
                : '計算中'
              }
            </span>
          </div>
        </div>
      </div>

      {/* 打刻ボタン */}
      <div className="attendance-actions">
        {getStatus() === 'not_clocked' && (
          <button
            className="clock-button clock-in"
            onClick={handleClockIn}
            disabled={isProcessing}
          >
            {isProcessing ? '処理中...' : '出勤する'}
          </button>
        )}

        {getStatus() === 'clocked_in' && (
          <button
            className="clock-button clock-out"
            onClick={handleClockOut}
            disabled={isProcessing}
          >
            {isProcessing ? '処理中...' : '退勤する'}
          </button>
        )}

        {getStatus() === 'clocked_out' && (
          <div className="completion-message">
            本日の勤務は完了しています
          </div>
        )}
      </div>

      <div className="attendance-note">
        <p>※ この打刻記録がKOTに代わる正式な出退勤記録となります</p>
        <p>※ 出勤時刻・退勤時刻・労働時間が自動で記録されます</p>
      </div>
    </div>
  );
};