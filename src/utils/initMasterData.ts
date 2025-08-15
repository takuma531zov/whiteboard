import { FirestoreService } from '../services/firestoreService';
import { MasterData } from '../types';

// 初期マスターデータ
const INITIAL_DEPARTMENTS = [
  '総務部', '人事部', '経理部', '開発部', '営業部', 
  'マーケティング部', '品質管理部', '情報システム部'
];

const INITIAL_DIVISIONS = [
  '業務課', '総務課', '人事課', '経理企画課', 'システム開発課',
  'フロントエンド開発課', 'バックエンド開発課', '営業企画課', '顧客対応課',
  'デジタルマーケティング課', 'PR広報課', 'QA課', 'インフラ管理課'
];

const INITIAL_EMPLOYEE_TYPES = [
  '正社員', '契約社員', 'パートタイム', 'アルバイト', 
  '派遣社員', '業務委託', 'インターン'
];

/**
 * 初期マスターデータをFirestoreに投入
 * アプリの初回起動時やマスターデータが空の場合に実行
 */
export const initializeMasterData = async (): Promise<void> => {
  try {
    console.log('マスターデータ初期化を開始します');

    // 現在のマスターデータをチェック
    const [departments, divisions, employeeTypes] = await Promise.all([
      FirestoreService.getMasterData('department'),
      FirestoreService.getMasterData('division'),
      FirestoreService.getMasterData('employeeType')
    ]);

    // 各タイプのデータが空の場合のみ初期データを追加
    const initPromises: Promise<MasterData>[] = [];

    if (departments.length === 0) {
      console.log('部署データを初期化中...');
      INITIAL_DEPARTMENTS.forEach(dept => {
        initPromises.push(FirestoreService.addMasterData('department', dept));
      });
    }

    if (divisions.length === 0) {
      console.log('課データを初期化中...');
      INITIAL_DIVISIONS.forEach(div => {
        initPromises.push(FirestoreService.addMasterData('division', div));
      });
    }

    if (employeeTypes.length === 0) {
      console.log('従業員区分データを初期化中...');
      INITIAL_EMPLOYEE_TYPES.forEach(type => {
        initPromises.push(FirestoreService.addMasterData('employeeType', type));
      });
    }

    if (initPromises.length > 0) {
      await Promise.all(initPromises);
      console.log('マスターデータ初期化完了');
    } else {
      console.log('マスターデータは既に存在します');
    }

  } catch (error) {
    console.error('マスターデータ初期化エラー:', error);
    // エラーが発生してもアプリケーションの起動は継続
  }
};

/**
 * 開発用: マスターデータを手動で初期化
 */
export const forceInitializeMasterData = async (): Promise<void> => {
  try {
    console.log('マスターデータを強制初期化します');

    const initPromises: Promise<MasterData>[] = [];

    // 全てのデータを追加
    INITIAL_DEPARTMENTS.forEach(dept => {
      initPromises.push(FirestoreService.addMasterData('department', dept));
    });

    INITIAL_DIVISIONS.forEach(div => {
      initPromises.push(FirestoreService.addMasterData('division', div));
    });

    INITIAL_EMPLOYEE_TYPES.forEach(type => {
      initPromises.push(FirestoreService.addMasterData('employeeType', type));
    });

    await Promise.all(initPromises);
    console.log('マスターデータ強制初期化完了');

  } catch (error) {
    console.error('マスターデータ強制初期化エラー:', error);
    throw error;
  }
};

// 開発用: グローバルアクセス
if (typeof window !== 'undefined') {
  (window as any).initMasterData = forceInitializeMasterData;
}