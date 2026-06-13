import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ModCheckResult {
    filename: string;
    filePath: string;
    clientSide: 'required' | 'optional' | 'unsupported' | 'unknown';
    serverSide: 'required' | 'optional' | 'unsupported' | 'unknown';
    source: string;
    checked: boolean;
    errors?: string[];
    allResults: any[];
}

export const useDeearthStore = defineStore('deearth', () => {
    // 文件夹选择
    const selectedFolder = ref<string>('');
    const bundleName = ref<string>('');

    // 检查状态
    const checking = ref(false);
    const showResults = ref(false);
    const showProgress = ref(false);

    // 进度
    const progress = ref({
        current: 0,
        total: 0,
        percent: 0,
        modName: ''
    });

    // 结果
    const results = ref<ModCheckResult[]>([]);

    // 完成时间戳（用于自动重置）
    const taskCompletedAt = ref<number>(0);
    let autoResetTimerId: ReturnType<typeof setTimeout> | null = null;

    // Actions
    function setSelectedFolder(folder: string) {
        selectedFolder.value = folder;
    }

    function setBundleName(name: string) {
        bundleName.value = name;
    }

    function startCheck() {
        checking.value = true;
        showResults.value = false;
        showProgress.value = false;
        results.value = [];
        progress.value = { current: 0, total: 0, percent: 0, modName: '' };
    }

    function updateProgress(data: { current: number; total: number; modName: string }) {
        const percent = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
        progress.value = {
            current: data.current,
            total: data.total,
            percent,
            modName: data.modName
        };
    }

    function completeCheck(data: { results: ModCheckResult[]; filteredCount: number; movedCount: number }) {
        results.value = data.results;
        showResults.value = true;
        showProgress.value = false;
        checking.value = false;
        taskCompletedAt.value = Date.now();

        // 设置 10 秒后不自动重置（保留结果供用户查看）
        // 用户可以手动重置
    }

    function errorCheck() {
        checking.value = false;
        showProgress.value = false;
    }

    function resetState() {
        if (autoResetTimerId) {
            clearTimeout(autoResetTimerId);
            autoResetTimerId = null;
        }
        selectedFolder.value = '';
        bundleName.value = '';
        checking.value = false;
        showResults.value = false;
        showProgress.value = false;
        results.value = [];
        progress.value = { current: 0, total: 0, percent: 0, modName: '' };
        taskCompletedAt.value = 0;
    }

    // 检查并恢复状态
    function checkAndRestoreState() {
        // 如果检查完成超过 3 分钟，重置状态
        if (taskCompletedAt.value > 0 && Date.now() - taskCompletedAt.value > 180000) {
            resetState();
        }
    }

    return {
        // 状态
        selectedFolder,
        bundleName,
        checking,
        showResults,
        showProgress,
        progress,
        results,
        // 方法
        setSelectedFolder,
        setBundleName,
        startCheck,
        updateProgress,
        completeCheck,
        errorCheck,
        resetState,
        checkAndRestoreState
    };
});
