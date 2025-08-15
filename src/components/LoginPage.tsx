import React, { useState } from 'react';
import { LoginFormData } from '../types';
// import { testFirebaseConnection } from '../utils/firebaseTest';
// import { createTestUser } from '../utils/createTestUser';
import './LoginPage.css';

// ログインページのプロパティ
interface LoginPageProps {
  onLogin: (formData: LoginFormData) => Promise<void>;
  isLoading?: boolean;
  error?: string;
}

/**
 * ログインページコンポーネント
 * 社員番号とパスワードでの認証を行う
 */
export const LoginPage: React.FC<LoginPageProps> = ({
  onLogin,
  isLoading = false,
  error
}) => {
  // フォームの状態管理
  const [formData, setFormData] = useState<LoginFormData>({
    employeeId: '',
    password: ''
  });

  // バリデーションエラーの状態
  const [validationErrors, setValidationErrors] = useState<{
    employeeId?: string;
    password?: string;
  }>({});

  /**
   * 入力値の変更ハンドラ
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // バリデーションエラーをクリア
    if (validationErrors[name as keyof typeof validationErrors]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  /**
   * フォームのバリデーション
   */
  const validateForm = (): boolean => {
    const errors: typeof validationErrors = {};

    // 社員番号のバリデーション
    if (!formData.employeeId.trim()) {
      errors.employeeId = '社員番号を入力してください';
    } else if (!/^\d{4,8}$/.test(formData.employeeId)) {
      errors.employeeId = '社員番号は4〜8桁の数字で入力してください';
    }

    // パスワードのバリデーション
    if (!formData.password) {
      errors.password = 'パスワードを入力してください';
    } else if (formData.password.length < 6) {
      errors.password = 'パスワードは6文字以上で入力してください';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * フォーム送信ハンドラ
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // バリデーションチェック
    if (!validateForm()) {
      return;
    }

    // デバッグ用：ログイン情報を確認
    console.log('ログイン試行:', {
      employeeId: formData.employeeId,
      email: `${formData.employeeId}@company.local`,
      passwordLength: formData.password.length
    });

    try {
      await onLogin(formData);
    } catch (err) {
      console.error('ログインエラー:', err);
      // エラーハンドリングは親コンポーネントで行う
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card card">
          {/* ヘッダー */}
          <div className="login-header">
            <h1>ホワイトボード タスク管理</h1>
            <p>社員番号とパスワードでログインしてください</p>
          </div>

          {/* エラーメッセージ表示 */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* ログインフォーム */}
          <form onSubmit={handleSubmit} className="login-form">
            {/* 社員番号入力 */}
            <div className="form-group">
              <label htmlFor="employeeId">社員番号</label>
              <input
                type="text"
                id="employeeId"
                name="employeeId"
                value={formData.employeeId}
                onChange={handleInputChange}
                placeholder="例: 12345"
                disabled={isLoading}
                className={validationErrors.employeeId ? 'error' : ''}
              />
              {validationErrors.employeeId && (
                <span className="field-error">{validationErrors.employeeId}</span>
              )}
            </div>

            {/* パスワード入力 */}
            <div className="form-group">
              <label htmlFor="password">パスワード</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="パスワードを入力"
                disabled={isLoading}
                className={validationErrors.password ? 'error' : ''}
              />
              {validationErrors.password && (
                <span className="field-error">{validationErrors.password}</span>
              )}
            </div>

            {/* ログインボタン */}
            <button 
              type="submit" 
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? 'ログイン中...' : 'ログイン'}
            </button>
            
          </form>

          {/* フッター */}
          <div className="login-footer">
            <p>※ 初回ログイン時は管理者にお問い合わせください</p>
          </div>
        </div>
      </div>
    </div>
  );
};