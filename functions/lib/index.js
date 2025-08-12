"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = exports.deleteUser = exports.getOverdueReports = exports.manualCheckWeeklyDeadlines = exports.checkWeeklyTaskDeadlines = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const weeklyTaskChecker_1 = require("./weeklyTaskChecker");
// Firebase Admin SDKを初期化
admin.initializeApp();
/**
 * 週次タスクの期限チェックを実行するスケジュール関数
 * 毎日午前9時（日本時間）に実行
 */
exports.checkWeeklyTaskDeadlines = functions
    .region('asia-northeast1') // 東京リージョン
    .pubsub
    .schedule('0 9 * * *') // cron形式: 毎日9:00
    .timeZone('Asia/Tokyo')
    .onRun(async (context) => {
    console.log('週次タスク期限チェック開始:', new Date().toISOString());
    try {
        const checker = new weeklyTaskChecker_1.WeeklyTaskChecker();
        // 期限切れレポートを生成
        const report = await checker.generateOverdueReport();
        // レポートをFirestoreに保存
        await checker.saveReport(report);
        console.log('週次タスク期限チェック完了:', {
            totalChecked: report.totalChecked,
            overdueCount: report.overdueCount,
            processedAt: report.processedAt.toISOString()
        });
        // 期限切れタスクがある場合はログに詳細出力
        if (report.overdueTasks.length > 0) {
            console.log('期限切れタスク詳細:');
            report.overdueTasks.forEach(task => {
                console.log(`- ${task.title} (担当: ${task.assignedUsers.join(', ')}, ${task.daysOverdue}日遅れ)`);
            });
        }
        return { success: true, report };
    }
    catch (error) {
        console.error('週次タスク期限チェックエラー:', error);
        throw new functions.https.HttpsError('internal', '期限チェック処理に失敗しました', error);
    }
});
/**
 * 手動で期限チェックを実行するHTTPS関数
 * 管理者が必要に応じて呼び出し可能
 */
exports.manualCheckWeeklyDeadlines = functions
    .region('asia-northeast1')
    .https
    .onCall(async (data, context) => {
    console.log('手動週次タスク期限チェック開始');
    try {
        const checker = new weeklyTaskChecker_1.WeeklyTaskChecker();
        // 期限切れレポートを生成
        const report = await checker.generateOverdueReport();
        // レポートをFirestoreに保存
        await checker.saveReport(report);
        console.log('手動週次タスク期限チェック完了');
        return {
            success: true,
            message: '期限チェックが完了しました',
            report: {
                totalChecked: report.totalChecked,
                overdueCount: report.overdueCount,
                overdueTasks: report.overdueTasks,
                processedAt: report.processedAt.toISOString()
            }
        };
    }
    catch (error) {
        console.error('手動期限チェックエラー:', error);
        throw new functions.https.HttpsError('internal', '期限チェック処理に失敗しました', error);
    }
});
/**
 * 期限切れレポートの履歴を取得するHTTPS関数
 */
exports.getOverdueReports = functions
    .region('asia-northeast1')
    .https
    .onCall(async (data, context) => {
    console.log('期限切れレポート履歴取得開始');
    try {
        const limit = data.limit || 10;
        const reportsSnapshot = await admin.firestore()
            .collection('overdueReports')
            .orderBy('processedAt', 'desc')
            .limit(limit)
            .get();
        const reports = reportsSnapshot.docs.map(doc => {
            var _a, _b;
            return (Object.assign(Object.assign({ id: doc.id }, doc.data()), { processedAt: (_b = (_a = doc.data().processedAt) === null || _a === void 0 ? void 0 : _a.toDate()) === null || _b === void 0 ? void 0 : _b.toISOString() }));
        });
        console.log(`期限切れレポート履歴取得完了: ${reports.length}件`);
        return {
            success: true,
            reports
        };
    }
    catch (error) {
        console.error('レポート履歴取得エラー:', error);
        throw new functions.https.HttpsError('internal', 'レポート履歴の取得に失敗しました', error);
    }
});
/**
 * 管理者によるユーザー削除機能
 * Firebase Authentication + Firestore の両方からユーザーを削除
 */
exports.deleteUser = functions
    .region('asia-northeast1')
    .https
    .onCall(async (data, context) => {
    console.log('ユーザー削除要求:', data);
    // 認証チェック
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'ログインが必要です');
    }
    const { userId } = data;
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'ユーザーIDが必要です');
    }
    // 自分自身は削除できない
    if (context.auth.uid === userId) {
        throw new functions.https.HttpsError('invalid-argument', '自分自身は削除できません');
    }
    try {
        // Firestoreからユーザー情報を取得（削除前にチェック）
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'ユーザーが見つかりません');
        }
        const userData = userDoc.data();
        console.log('削除対象ユーザー:', userData);
        // Firebase Authentication からユーザーを削除
        try {
            await admin.auth().deleteUser(userId);
            console.log('Firebase Authenticationからユーザーを削除:', userId);
        }
        catch (authError) {
            console.warn('Firebase Auth削除エラー:', authError);
            // Authentication側にユーザーが存在しない場合は警告のみ
            if (authError.code !== 'auth/user-not-found') {
                throw authError;
            }
        }
        // Firestore からユーザーを削除
        await admin.firestore().collection('users').doc(userId).delete();
        console.log('Firestoreからユーザーを削除:', userId);
        // 削除されたユーザーが担当しているタスクの担当者情報をクリーンアップ
        await cleanupUserTasks(userId);
        return {
            success: true,
            message: 'ユーザーが正常に削除されました',
            deletedUser: {
                id: userId,
                name: userData === null || userData === void 0 ? void 0 : userData.name,
                employeeId: userData === null || userData === void 0 ? void 0 : userData.employeeId
            }
        };
    }
    catch (error) {
        console.error('ユーザー削除エラー:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', `ユーザー削除に失敗しました: ${error.message}`);
    }
});
/**
 * 削除されたユーザーが担当しているタスクから担当者情報を除去
 */
async function cleanupUserTasks(userId) {
    try {
        // 削除されたユーザーが担当しているタスクを検索
        const tasksSnapshot = await admin.firestore()
            .collection('tasks')
            .where('assignedUserIds', 'array-contains', userId)
            .get();
        if (tasksSnapshot.empty) {
            console.log('削除対象ユーザーが担当するタスクはありません');
            return;
        }
        const batch = admin.firestore().batch();
        tasksSnapshot.docs.forEach(doc => {
            const taskData = doc.data();
            const updatedAssignedUserIds = (taskData.assignedUserIds || []).filter((id) => id !== userId);
            batch.update(doc.ref, {
                assignedUserIds: updatedAssignedUserIds,
                updatedAt: admin.firestore.Timestamp.now()
            });
            console.log(`タスク ${taskData.title} から担当者 ${userId} を除去`);
        });
        await batch.commit();
        console.log(`${tasksSnapshot.size}件のタスクから削除ユーザーを除去しました`);
    }
    catch (error) {
        console.error('タスククリーンアップエラー:', error);
        // タスククリーンアップエラーはユーザー削除の失敗とはしない
    }
}
/**
 * ヘルスチェック用のHTTPS関数
 */
exports.healthCheck = functions
    .region('asia-northeast1')
    .https
    .onRequest((request, response) => {
    console.log('ヘルスチェック実行');
    response.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        functions: [
            'checkWeeklyTaskDeadlines',
            'manualCheckWeeklyDeadlines',
            'getOverdueReports',
            'deleteUser'
        ]
    });
});
//# sourceMappingURL=index.js.map