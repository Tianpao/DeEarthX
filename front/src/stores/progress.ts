import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { StepsProps } from 'ant-design-vue';
import type { SelectProps } from 'ant-design-vue/es/vc-select';
import type { ProgressStatus, ServerInstallInfo, FilterModsInfo, Template } from '@/types/progress';
import i18n from '@/utils/i18n';

// 获取 i18n 的 t 函数
const t = i18n.global.t.bind(i18n.global);

export const useProgressStore = defineStore('progress', () => {
    // 任务状态
    const isProcessing = ref(false);
    const showSteps = ref(false);
    const currentStep = ref(0);
    const startTime = ref(0);
    const taskCompletedAt = ref<number>(0); // 任务完成时间戳

    // 自动重置定时器 ID
    let autoResetTimerId: ReturnType<typeof setTimeout> | null = null;

    // 文件状态
    const droppedFilePath = ref<string | null>(null);
    const uploadDisabled = ref(false);
    const startButtonDisabled = ref(false);

    // 模式选择
    const javaAvailable = ref(true);
    const selectedMode = ref<string>('server');

    // 模板选择
    const showTemplateModal = ref(false);
    const templates = ref<Template[]>([]);
    const loadingTemplates = ref(false);
    const selectedTemplate = ref<string>('0');
    const currentTemplateName = ref<string>('');

    // 进度状态
    const unzipProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: true });
    const downloadProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: true });
    const uploadProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: false });
    const serverInstallProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: false });
    const filterModsProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: false });

    // 服务端安装信息
    const serverInstallInfo = ref<ServerInstallInfo>({
        modpackName: '',
        minecraftVersion: '',
        loaderType: '',
        loaderVersion: '',
        currentStep: '',
        stepIndex: 0,
        totalSteps: 0,
        message: '',
        status: 'idle',
        error: '',
        installPath: '',
        duration: 0
    });

    // 模组过滤信息
    const filterModsInfo = ref<FilterModsInfo>({
        totalMods: 0,
        currentMod: 0,
        modName: '',
        filteredCount: 0,
        movedCount: 0,
        status: 'idle',
        error: '',
        duration: 0
    });

    // 步骤项
    const stepItems = computed<Required<StepsProps>['items']>(() => [
        { title: t('home.step1_title'), description: t('home.step1_desc') },
        { title: t('home.step2_title'), description: t('home.step2_desc') },
        { title: t('home.step3_title'), description: t('home.step3_desc') },
        { title: t('home.step4_title'), description: t('home.step4_desc') }
    ]);

    // 模式选项
    const modeOptions = computed<SelectProps['options']>(() => [
        { label: t('home.mode_server'), value: 'server', disabled: !javaAvailable.value },
        { label: t('home.mode_upload'), value: 'upload', disabled: false }
    ]);

    // Actions
    function setDroppedFilePath(path: string) {
        droppedFilePath.value = path;
    }

    function clearDroppedFilePath() {
        droppedFilePath.value = null;
    }

    function getActualFilePath(): string | null {
        if (!droppedFilePath.value) return null;
        const path = droppedFilePath.value;
        if (path.startsWith('selected-')) {
            return path.substring(8);
        }
        return path;
    }

    function startTask() {
        isProcessing.value = true;
        showSteps.value = true;
        startButtonDisabled.value = true;
        uploadDisabled.value = true;
        startTime.value = Date.now();
    }

    function resetProgress() {
        showSteps.value = false;
        currentStep.value = 0;
        unzipProgress.value = { status: 'active', percent: 0, display: false };
        downloadProgress.value = { status: 'active', percent: 0, display: false };
        uploadProgress.value = { status: 'active', percent: 0, display: false };
        serverInstallProgress.value = { status: 'active', percent: 0, display: false };
        filterModsProgress.value = { status: 'active', percent: 0, display: false };
        startTime.value = 0;
        serverInstallInfo.value = {
            modpackName: '',
            minecraftVersion: '',
            loaderType: '',
            loaderVersion: '',
            currentStep: '',
            stepIndex: 0,
            totalSteps: 0,
            message: '',
            status: 'idle',
            error: '',
            installPath: '',
            duration: 0
        };
        filterModsInfo.value = {
            totalMods: 0,
            currentMod: 0,
            modName: '',
            filteredCount: 0,
            movedCount: 0,
            status: 'idle',
            error: '',
            duration: 0
        };
    }

    function resetState() {
        // 清除自动重置定时器
        if (autoResetTimerId) {
            clearTimeout(autoResetTimerId);
            autoResetTimerId = null;
        }
        uploadDisabled.value = false;
        startButtonDisabled.value = false;
        isProcessing.value = false;
        taskCompletedAt.value = 0;
        resetProgress();
        droppedFilePath.value = null;
    }

    function completeTask() {
        isProcessing.value = false;
        startButtonDisabled.value = false;
        taskCompletedAt.value = Date.now();

        // 设置 8 秒后自动重置
        autoResetTimerId = setTimeout(() => {
            resetState();
        }, 8000);
    }

    // 检查是否需要恢复或重置状态（在组件挂载时调用）
    function checkAndRestoreState() {
        // 如果任务完成超过 8 秒，重置状态
        if (taskCompletedAt.value > 0 && Date.now() - taskCompletedAt.value >= 8000) {
            resetState();
            return;
        }

        // 如果任务正在进行中但已经过去太长时间（超过 10 分钟），也重置
        if (isProcessing.value && startTime.value > 0 && Date.now() - startTime.value > 600000) {
            resetState();
            return;
        }

        // 如果任务刚完成不久，设置剩余时间的自动重置
        if (taskCompletedAt.value > 0 && Date.now() - taskCompletedAt.value < 8000) {
            const remainingTime = 8000 - (Date.now() - taskCompletedAt.value);
            autoResetTimerId = setTimeout(() => {
                resetState();
            }, remainingTime);
        }
    }

    // 进度更新方法
    function updateUnzipProgress(result: { current: number; total: number }) {
        unzipProgress.value.percent = Math.round((result.current / result.total) * 100);
        if (result.current === result.total) {
            unzipProgress.value.status = 'success';
            setTimeout(() => {
                unzipProgress.value.display = false;
            }, 2000);
        }
    }

    function updateDownloadProgress(result: { index: number; total: number }) {
        downloadProgress.value.percent = Math.round((result.index / result.total) * 100);
        if (downloadProgress.value.percent === 100) {
            downloadProgress.value.status = 'success';
            setTimeout(() => {
                downloadProgress.value.display = false;
            }, 2000);
        }
    }

    function incrementStep() {
        currentStep.value++;
    }

    function handleServerInstallStart(result: any) {
        serverInstallInfo.value = {
            modpackName: result.modpackName,
            minecraftVersion: result.minecraftVersion,
            loaderType: result.loaderType,
            loaderVersion: result.loaderVersion,
            currentStep: '',
            stepIndex: 0,
            totalSteps: 0,
            message: t('home.server_install_starting'),
            status: 'installing',
            error: '',
            installPath: '',
            duration: 0
        };
        serverInstallProgress.value = { status: 'active', percent: 0, display: true };
    }

    function handleServerInstallStep(result: any) {
        serverInstallInfo.value.currentStep = result.step;
        serverInstallInfo.value.stepIndex = result.stepIndex;
        serverInstallInfo.value.totalSteps = result.totalSteps;
        serverInstallInfo.value.message = result.message || result.step;
        const overallProgress = (result.stepIndex / result.totalSteps) * 100;
        serverInstallProgress.value.percent = Math.round(overallProgress);
    }

    function handleServerInstallProgress(result: any) {
        serverInstallInfo.value.currentStep = result.step;
        serverInstallInfo.value.message = result.message || result.step;
        serverInstallProgress.value.percent = result.progress;
    }

    function handleServerInstallComplete(result: any) {
        serverInstallInfo.value.status = 'completed';
        serverInstallInfo.value.installPath = result.installPath;
        serverInstallInfo.value.duration = result.duration;
        serverInstallInfo.value.message = t('home.server_install_completed');
        serverInstallProgress.value = { status: 'success', percent: 100, display: true };
        currentStep.value++;
        setTimeout(() => {
            serverInstallProgress.value.display = false;
        }, 8000);
    }

    function handleServerInstallError(result: any) {
        serverInstallInfo.value.status = 'error';
        serverInstallInfo.value.error = result.error;
        serverInstallInfo.value.message = result.error;
        serverInstallProgress.value = { status: 'exception', percent: serverInstallProgress.value.percent, display: true };
    }

    function handleFilterModsStart(result: any) {
        filterModsInfo.value = {
            totalMods: result.totalMods,
            currentMod: 0,
            modName: '',
            filteredCount: 0,
            movedCount: 0,
            status: 'filtering',
            error: '',
            duration: 0
        };
        filterModsProgress.value = { status: 'active', percent: 0, display: true };
    }

    function handleFilterModsProgress(result: any) {
        filterModsInfo.value.currentMod = result.current;
        filterModsInfo.value.modName = result.modName;
        const percent = Math.round((result.current / result.total) * 100);
        filterModsProgress.value.percent = percent;
    }

    function handleFilterModsComplete(result: any) {
        filterModsInfo.value.status = 'completed';
        filterModsInfo.value.filteredCount = result.filteredCount;
        filterModsInfo.value.movedCount = result.movedCount;
        filterModsInfo.value.duration = result.duration;
        filterModsProgress.value = { status: 'success', percent: 100, display: true };
        setTimeout(() => {
            filterModsProgress.value.display = false;
        }, 8000);
    }

    function handleFilterModsError(result: any) {
        filterModsInfo.value.status = 'error';
        filterModsInfo.value.error = result.error;
        filterModsProgress.value = { status: 'exception', percent: filterModsProgress.value.percent, display: true };
    }

    // 模式选择方法
    function handleModeSelect(value: string) {
        selectedMode.value = value;
    }

    // 模板选择方法
    async function loadTemplates() {
        loadingTemplates.value = true;
        try {
            const { default: axiosInstance } = await import('@/utils/axios');
            const response = await axiosInstance.get('/templates');
            const result = response.data;
            if (result.status === 200 && result.data) {
                templates.value = result.data;
            }
        } catch (error) {
            console.error('加载模板列表失败:', error);
        } finally {
            loadingTemplates.value = false;
        }
    }

    function openTemplateModal() {
        loadTemplates();
        showTemplateModal.value = true;
    }

    function selectTemplate(templateId: string) {
        selectedTemplate.value = templateId;
        showTemplateModal.value = false;
        if (templateId === '0') {
            currentTemplateName.value = t('home.template_official_loader');
        } else {
            const template = templates.value.find(t => t.id === templateId);
            if (template) {
                currentTemplateName.value = template.metadata.name;
            }
        }
    }

    return {
        // 状态
        isProcessing,
        showSteps,
        currentStep,
        stepItems,
        startTime,
        droppedFilePath,
        uploadDisabled,
        startButtonDisabled,
        javaAvailable,
        selectedMode,
        modeOptions,
        showTemplateModal,
        templates,
        loadingTemplates,
        selectedTemplate,
        currentTemplateName,
        unzipProgress,
        downloadProgress,
        uploadProgress,
        serverInstallProgress,
        filterModsProgress,
        serverInstallInfo,
        filterModsInfo,
        // 方法
        setDroppedFilePath,
        clearDroppedFilePath,
        getActualFilePath,
        startTask,
        resetProgress,
        resetState,
        completeTask,
        checkAndRestoreState,
        updateUnzipProgress,
        updateDownloadProgress,
        incrementStep,
        handleServerInstallStart,
        handleServerInstallStep,
        handleServerInstallProgress,
        handleServerInstallComplete,
        handleServerInstallError,
        handleFilterModsStart,
        handleFilterModsProgress,
        handleFilterModsComplete,
        handleFilterModsError,
        handleModeSelect,
        loadTemplates,
        openTemplateModal,
        selectTemplate
    };
});