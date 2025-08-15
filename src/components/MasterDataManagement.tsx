import React, { useState, useEffect } from 'react';
import { MasterData } from '../types';
import { FirestoreService } from '../services/firestoreService';
import './MasterDataManagement.css';

// マスターデータ管理画面のプロパティ
interface MasterDataManagementProps {
  // 必要に応じて追加
}

// タブの型定義
type TabType = 'department' | 'division' | 'employeeType' | 'role';

// タブの表示名
const TAB_LABELS: Record<TabType, string> = {
  department: '所属部署',
  division: '所属課', 
  employeeType: '従業員区分',
  role: '権限'
};

/**
 * マスターデータ管理画面コンポーネント
 * 所属部署、所属課、従業員区分、権限のプルダウン選択肢を管理
 */
export const MasterDataManagement: React.FC<MasterDataManagementProps> = () => {
  // 状態管理
  const [activeTab, setActiveTab] = useState<TabType>('department');
  const [masterData, setMasterData] = useState<Record<TabType, MasterData[]>>({
    department: [],
    division: [],
    employeeType: [],
    role: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  // 新規追加フォーム関連の状態
  const [showAddForm, setShowAddForm] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [adding, setAdding] = useState(false);
  
  // 編集関連の状態
  const [editingItem, setEditingItem] = useState<MasterData | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editing, setEditing] = useState(false);

  /**
   * マスターデータを読み込み
   */
  const loadMasterData = async (type?: TabType) => {
    try {
      setLoading(true);
      const typesToLoad = type ? [type] : (['department', 'division', 'employeeType', 'role'] as TabType[]);
      
      console.log('マスターデータ読み込み開始:', typesToLoad);
      
      const results = await Promise.all(
        typesToLoad.map(async (t) => {
          try {
            console.log(`${t}データ取得中...`);
            const data = await FirestoreService.getMasterData(t);
            console.log(`${t}データ取得成功:`, data.length, '件');
            return { type: t, data };
          } catch (error) {
            console.error(`${t}データ取得エラー:`, error);
            return { type: t, data: [] };
          }
        })
      );
      
      setMasterData(prev => {
        const updated = { ...prev };
        results.forEach(({ type, data }) => {
          updated[type] = data;
        });
        return updated;
      });
      
      console.log('マスターデータ読み込み完了:', results);
      setError('');
    } catch (err: any) {
      console.error('マスターデータ取得エラー:', err);
      setError(`マスターデータの取得に失敗しました: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * コンポーネント初期化時にマスターデータを取得
   */
  useEffect(() => {
    loadMasterData();
  }, []);

  /**
   * 新しい項目を追加
   */
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newValue.trim()) {
      setError('項目名を入力してください');
      return;
    }
    
    // 重複チェック
    const exists = masterData[activeTab].some(item => item.value === newValue.trim());
    if (exists) {
      setError('同じ項目名が既に存在します');
      return;
    }

    try {
      setAdding(true);
      setError('');
      
      const newItem = await FirestoreService.addMasterData(activeTab, newValue.trim());
      
      // ローカル状態に追加
      setMasterData(prev => ({
        ...prev,
        [activeTab]: [...prev[activeTab], newItem]
      }));
      
      // フォームをリセット
      setNewValue('');
      setShowAddForm(false);
      
    } catch (err: any) {
      console.error('項目追加エラー:', err);
      setError(err.message || '項目の追加に失敗しました');
    } finally {
      setAdding(false);
    }
  };

  /**
   * 項目の編集を開始
   */
  const handleStartEdit = (item: MasterData) => {
    setEditingItem(item);
    setEditValue(item.value);
    setError('');
  };

  /**
   * 項目の編集をキャンセル
   */
  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditValue('');
    setError('');
  };

  /**
   * 項目を更新
   */
  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingItem) return;
    
    if (!editValue.trim()) {
      setError('項目名を入力してください');
      return;
    }
    
    // 重複チェック（自分以外で）
    const exists = masterData[activeTab].some(item => 
      item.id !== editingItem.id && item.value === editValue.trim()
    );
    if (exists) {
      setError('同じ項目名が既に存在します');
      return;
    }

    try {
      setEditing(true);
      setError('');
      
      await FirestoreService.updateMasterData(editingItem.id, {
        value: editValue.trim()
      });
      
      // ローカル状態を更新
      setMasterData(prev => ({
        ...prev,
        [activeTab]: prev[activeTab].map(item =>
          item.id === editingItem.id 
            ? { ...item, value: editValue.trim(), updatedAt: new Date() }
            : item
        )
      }));
      
      // 編集モードを終了
      handleCancelEdit();
      
    } catch (err: any) {
      console.error('項目更新エラー:', err);
      setError(err.message || '項目の更新に失敗しました');
    } finally {
      setEditing(false);
    }
  };

  /**
   * 項目を削除
   */
  const handleDeleteItem = async (item: MasterData) => {
    const confirmMessage = `「${item.value}」を削除しますか？\\n\\nこの操作は取り消せません。`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setError('');
      
      await FirestoreService.deleteMasterData(item.id);
      
      // ローカル状態から削除
      setMasterData(prev => ({
        ...prev,
        [activeTab]: prev[activeTab].filter(i => i.id !== item.id)
      }));
      
    } catch (err: any) {
      console.error('項目削除エラー:', err);
      setError(err.message || '項目の削除に失敗しました');
    }
  };

  /**
   * 項目の表示順序を更新（ドラッグ&ドロップ対応は後日実装）
   */
  const handleMoveItem = async (item: MasterData, direction: 'up' | 'down') => {
    const currentItems = masterData[activeTab];
    const currentIndex = currentItems.findIndex(i => i.id === item.id);
    
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === currentItems.length - 1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newOrder = [...currentItems];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
    
    try {
      setError('');
      
      // 表示順序を更新
      const updates = newOrder.map((item, index) => ({
        id: item.id,
        order: index + 1
      }));
      
      await FirestoreService.updateMasterDataOrder(updates);
      
      // ローカル状態を更新
      setMasterData(prev => ({
        ...prev,
        [activeTab]: newOrder.map((item, index) => ({
          ...item,
          order: index + 1
        }))
      }));
      
    } catch (err: any) {
      console.error('順序更新エラー:', err);
      setError(err.message || '順序の更新に失敗しました');
    }
  };

  // ローディング表示
  if (loading) {
    return (
      <div className="master-data-management">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>マスターデータを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="master-data-management">
      {/* ヘッダー */}
      <div className="management-header">
        <div className="header-left">
          <h2>マスターデータ管理</h2>
          <p>プルダウン選択肢の編集・管理を行います</p>
        </div>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      {/* タブ */}
      <div className="tab-container">
        {(Object.keys(TAB_LABELS) as TabType[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
          >
            {TAB_LABELS[tab]}
            <span className="item-count">({masterData[tab].length})</span>
          </button>
        ))}
      </div>

      {/* 項目一覧 */}
      <div className="items-container">
        <div className="items-header">
          <h3>{TAB_LABELS[activeTab]}の管理</h3>
          <button
            onClick={() => setShowAddForm(true)}
            className="add-item-button"
            disabled={adding}
          >
            + 新規追加
          </button>
        </div>

        {/* 項目一覧 */}
        <div className="items-list">
          {masterData[activeTab].length === 0 ? (
            <div className="empty-state">
              <p>登録されている項目がありません</p>
            </div>
          ) : (
            masterData[activeTab].map((item, index) => (
              <div key={item.id} className="item-card">
                {editingItem?.id === item.id ? (
                  // 編集モード
                  <form onSubmit={handleUpdateItem} className="edit-form">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="edit-input"
                      disabled={editing}
                      autoFocus
                    />
                    <div className="edit-actions">
                      <button 
                        type="submit" 
                        className="save-button"
                        disabled={editing}
                      >
                        {editing ? '保存中...' : '保存'}
                      </button>
                      <button 
                        type="button" 
                        onClick={handleCancelEdit}
                        className="cancel-button"
                        disabled={editing}
                      >
                        キャンセル
                      </button>
                    </div>
                  </form>
                ) : (
                  // 表示モード
                  <>
                    <div className="item-content">
                      <span className="item-order">#{item.order}</span>
                      <span className="item-value">{item.value}</span>
                    </div>
                    <div className="item-actions">
                      <button
                        onClick={() => handleMoveItem(item, 'up')}
                        disabled={index === 0}
                        className="move-button"
                        title="上に移動"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => handleMoveItem(item, 'down')}
                        disabled={index === masterData[activeTab].length - 1}
                        className="move-button"
                        title="下に移動"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => handleStartEdit(item)}
                        className="edit-button"
                        title="編集"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item)}
                        className="delete-button"
                        title="削除"
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 新規追加フォーム */}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{TAB_LABELS[activeTab]}を追加</h3>
              <button 
                onClick={() => {
                  setShowAddForm(false);
                  setNewValue('');
                  setError('');
                }}
                className="close-button"
              >×</button>
            </div>
            
            <form onSubmit={handleAddItem} className="add-form">
              <div className="form-group">
                <label htmlFor="newValue">項目名 *</label>
                <input
                  type="text"
                  id="newValue"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={`新しい${TAB_LABELS[activeTab]}名`}
                  required
                  disabled={adding}
                  autoFocus
                />
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddForm(false);
                    setNewValue('');
                    setError('');
                  }}
                  className="cancel-button"
                  disabled={adding}
                >
                  キャンセル
                </button>
                <button 
                  type="submit" 
                  className="submit-button"
                  disabled={adding}
                >
                  {adding ? '追加中...' : '追加する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};