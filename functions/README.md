# 週次タスク期限チェック Firebase Functions

このディレクトリには、ホワイトボードタスク管理システムの週次タスク期限チェック機能が含まれています。

## 機能概要

### 1. 自動期限チェック (`checkWeeklyTaskDeadlines`)
- 毎日午前9時（日本時間）に自動実行
- 週次タスクの期限切れをチェック
- 結果をFirestoreに保存

### 2. 手動期限チェック (`manualCheckWeeklyDeadlines`)
- 管理者が必要に応じて呼び出し可能
- 即座に期限チェックを実行

### 3. レポート履歴取得 (`getOverdueReports`)
- 過去の期限切れレポートを取得
- 最大10件の履歴を返却

### 4. ヘルスチェック (`healthCheck`)
- Functions の動作状況を確認

## セットアップ

### 1. 依存関係のインストール
```bash
cd functions
npm install
```

### 2. ビルド
```bash
npm run build
```

### 3. ローカル開発（エミュレータ）
```bash
npm run serve
```

### 4. デプロイ
```bash
npm run deploy
```

## 期限チェックロジック

### 曜日ベースの期限チェック
- 週次タスクに設定された曜日（例：毎週金曜日）
- 現在の曜日がその曜日を過ぎている場合、期限切れと判定
- 経過日数も計算（月曜日なら3日遅れなど）

### 従来の日付ベース期限チェック（後方互換性）
- 従来の `dueDate` フィールドによる期限チェックも継続サポート

## Firestore コレクション

### `overdueReports`
期限切れチェックの結果レポートが保存される：

```typescript
{
  totalChecked: number,      // チェック対象タスク総数
  overdueCount: number,      // 期限切れタスク数
  overdueTasks: [{           // 期限切れタスク詳細
    id: string,
    title: string,
    assignedUsers: string[],
    dayOfWeek?: string,
    daysOverdue: number
  }],
  processedAt: Date          // 処理実行日時
}
```

## 環境変数

特別な環境変数の設定は不要です。Firebase Admin SDK が自動的に認証情報を取得します。

## ログとモニタリング

- Firebase Console の Functions ログで実行状況を確認可能
- 期限切れタスクがある場合は詳細ログが出力される

## トラブルシューティング

1. **デプロイエラー**
   - `npm run build` でビルドエラーがないか確認
   - Firebase CLI が最新版か確認

2. **実行エラー**
   - Firebase Console のログを確認
   - Firestore のセキュリティルールを確認

3. **期限チェックが動作しない**
   - Firestore の `tasks` コレクションにデータがあるか確認
   - タスクの `type` フィールドが `'weekly'` になっているか確認