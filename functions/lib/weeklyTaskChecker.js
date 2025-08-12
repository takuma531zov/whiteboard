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
exports.WeeklyTaskChecker = void 0;
const admin = __importStar(require("firebase-admin"));
/**
 * 週次タスクの期限チェッククラス
 */
class WeeklyTaskChecker {
    constructor() {
        this.db = admin.firestore();
    }
    /**
     * 曜日の日本語表示名を取得
     */
    getDayOfWeekLabel(dayOfWeek) {
        const labels = {
            'monday': '月曜日',
            'tuesday': '火曜日',
            'wednesday': '水曜日',
            'thursday': '木曜日',
            'friday': '金曜日',
            'saturday': '土曜日',
            'sunday': '日曜日'
        };
        return labels[dayOfWeek];
    }
    /**
     * 曜日から数値に変換（日曜日=0, 月曜日=1, ...）
     */
    dayOfWeekToNumber(dayOfWeek) {
        const mapping = {
            'sunday': 0,
            'monday': 1,
            'tuesday': 2,
            'wednesday': 3,
            'thursday': 4,
            'friday': 5,
            'saturday': 6
        };
        return mapping[dayOfWeek];
    }
    /**
     * 指定曜日からの経過日数を計算
     */
    getDaysOverdue(targetDayOfWeek, currentDate = new Date()) {
        const targetDay = this.dayOfWeekToNumber(targetDayOfWeek);
        const currentDay = currentDate.getDay();
        if (currentDay <= targetDay) {
            // まだ期限日を過ぎていない
            return 0;
        }
        // 期限日を過ぎた日数を計算
        return currentDay - targetDay;
    }
    /**
     * 期限切れの週次タスクを取得
     */
    async getOverdueWeeklyTasks() {
        var _a, _b, _c;
        console.log('期限切れ週次タスクの検索を開始');
        try {
            // 週次タスクで未完了のものを取得
            const tasksSnapshot = await this.db.collection('tasks')
                .where('type', '==', 'weekly')
                .where('status', '!=', 'completed')
                .get();
            const overdueTasks = [];
            const currentDate = new Date();
            for (const doc of tasksSnapshot.docs) {
                const data = doc.data();
                const task = {
                    id: doc.id,
                    title: data.title,
                    type: data.type,
                    status: data.status,
                    assignedUserIds: data.assignedUserIds || [],
                    createdBy: data.createdBy,
                    dueDate: (_a = data.dueDate) === null || _a === void 0 ? void 0 : _a.toDate(),
                    weeklyDayOfWeek: data.weeklyDayOfWeek,
                    createdAt: ((_b = data.createdAt) === null || _b === void 0 ? void 0 : _b.toDate()) || new Date(),
                    updatedAt: ((_c = data.updatedAt) === null || _c === void 0 ? void 0 : _c.toDate()) || new Date()
                };
                // 曜日ベースの期限チェック
                if (task.weeklyDayOfWeek) {
                    const daysOverdue = this.getDaysOverdue(task.weeklyDayOfWeek, currentDate);
                    if (daysOverdue > 0) {
                        console.log(`期限切れタスク発見: ${task.title} (${daysOverdue}日遅れ)`);
                        overdueTasks.push(task);
                    }
                }
                // 従来の日付ベース期限チェック（後方互換性）
                else if (task.dueDate && currentDate > task.dueDate) {
                    console.log(`期限切れタスク発見 (日付ベース): ${task.title}`);
                    overdueTasks.push(task);
                }
            }
            console.log(`期限切れタスク数: ${overdueTasks.length}`);
            return overdueTasks;
        }
        catch (error) {
            console.error('期限切れタスク取得エラー:', error);
            throw error;
        }
    }
    /**
     * ユーザー情報を取得
     */
    async getUsers() {
        try {
            const usersSnapshot = await this.db.collection('users').get();
            const usersMap = new Map();
            usersSnapshot.docs.forEach(doc => {
                var _a, _b;
                const data = doc.data();
                usersMap.set(doc.id, {
                    id: doc.id,
                    employeeId: data.employeeId,
                    name: data.name,
                    isAttending: data.isAttending || false,
                    createdAt: ((_a = data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate()) || new Date(),
                    updatedAt: ((_b = data.updatedAt) === null || _b === void 0 ? void 0 : _b.toDate()) || new Date()
                });
            });
            return usersMap;
        }
        catch (error) {
            console.error('ユーザー情報取得エラー:', error);
            throw error;
        }
    }
    /**
     * 期限切れタスクの詳細レポートを作成
     */
    async generateOverdueReport() {
        console.log('期限切れレポート生成開始');
        try {
            const [overdueTasks, usersMap] = await Promise.all([
                this.getOverdueWeeklyTasks(),
                this.getUsers()
            ]);
            const report = {
                totalChecked: 0,
                overdueCount: overdueTasks.length,
                overdueTasks: [],
                processedAt: new Date()
            };
            // 全週次タスク数をカウント
            const allWeeklyTasksSnapshot = await this.db.collection('tasks')
                .where('type', '==', 'weekly')
                .get();
            report.totalChecked = allWeeklyTasksSnapshot.size;
            // 期限切れタスクの詳細情報を作成
            for (const task of overdueTasks) {
                const assignedUserNames = (task.assignedUserIds || [])
                    .map(userId => { var _a; return ((_a = usersMap.get(userId)) === null || _a === void 0 ? void 0 : _a.name) || `不明(${userId})`; })
                    .filter(name => name);
                let daysOverdue = 0;
                if (task.weeklyDayOfWeek) {
                    daysOverdue = this.getDaysOverdue(task.weeklyDayOfWeek);
                }
                else if (task.dueDate) {
                    const currentDate = new Date();
                    daysOverdue = Math.ceil((currentDate.getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24));
                }
                report.overdueTasks.push({
                    id: task.id,
                    title: task.title,
                    assignedUsers: assignedUserNames,
                    dayOfWeek: task.weeklyDayOfWeek ? this.getDayOfWeekLabel(task.weeklyDayOfWeek) : undefined,
                    daysOverdue
                });
            }
            console.log(`レポート生成完了: ${report.overdueCount}件の期限切れタスク`);
            return report;
        }
        catch (error) {
            console.error('レポート生成エラー:', error);
            throw error;
        }
    }
    /**
     * レポート結果をFirestoreに保存
     */
    async saveReport(report) {
        try {
            await this.db.collection('overdueReports').add(Object.assign(Object.assign({}, report), { processedAt: admin.firestore.Timestamp.fromDate(report.processedAt) }));
            console.log('レポートをFirestoreに保存しました');
        }
        catch (error) {
            console.error('レポート保存エラー:', error);
            throw error;
        }
    }
}
exports.WeeklyTaskChecker = WeeklyTaskChecker;
//# sourceMappingURL=weeklyTaskChecker.js.map