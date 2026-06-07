import { ref, inject } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { useModeSelection } from '@/composables/useModeSelection';
import { useTemplateSelection } from '@/composables/useTemplateSelection';
import { useProgress } from '@/composables/useProgress';
import { useErrorHandler } from '@/composables/useErrorHandler';
import axiosInstance from '@/utils/axios';

export function useTaskProcessor() {
    const { t } = useI18n();
    const killCoreProcess = inject<(() => void) | undefined>("killCoreProcess");
    const clearDroppedFile = inject<(() => void) | undefined>('clearDroppedFile');

    // 文件路径（用于统一UI显示，可能带有 selected- 前缀表示通过对话框选择）
    const droppedFilePath = ref<string | null>(null);
    const uploadDisabled = ref(false);

    function setDroppedFilePath(path: string) {
        droppedFilePath.value = path;
    }

    function clearDroppedFilePath() {
        droppedFilePath.value = null;
    }

    // 获取实际的文件路径（去除 selected- 前缀）
    function getActualFilePath(): string | null {
        if (!droppedFilePath.value) return null;
        const path = droppedFilePath.value;
        if (path.startsWith('selected-')) {
            return path.substring(8); // 移除 'selected-' 前缀
        }
        return path;
    }

    // Initialize all sub-composables
    const {
        javaAvailable,
        selectedMode,
        modeOptions,
        handleModeSelect
    } = useModeSelection();

    const {
        showTemplateModal,
        templates,
        loadingTemplates,
        selectedTemplate,
        currentTemplateName,
        loadTemplates,
        openTemplateModal,
        selectTemplate
    } = useTemplateSelection();

    const {
        showSteps,
        currentStep,
        stepItems,
        unzipProgress,
        downloadProgress,
        uploadProgress,
        serverInstallProgress,
        filterModsProgress,
        serverInstallInfo,
        filterModsInfo,
        startTime,
        resetProgress,
        updateUnzipProgress,
        updateDownloadProgress,
        handleFinish,
        handleServerInstallStart,
        handleServerInstallStep,
        handleServerInstallProgress,
        handleServerInstallComplete,
        handleServerInstallError,
        handleFilterModsStart,
        handleFilterModsProgress,
        handleFilterModsComplete,
        handleFilterModsError
    } = useProgress();

    const {
        handleError
    } = useErrorHandler();

    const startButtonDisabled = ref(false);

    function resetState() {
        uploadDisabled.value = false;
        startButtonDisabled.value = false;
        resetProgress();
        droppedFilePath.value = null;
        if (clearDroppedFile) {
            clearDroppedFile();
        }
        if (killCoreProcess && typeof killCoreProcess === 'function') {
            killCoreProcess();
        }
    }

    async function runDeEarthXFromPath(filePath: string, socket: Socket) {
        message.success(t('home.start_production'));
        showSteps.value = true;

        try {
            message.loading(t('home.task_preparing'));
            const apiHost = import.meta.env.VITE_API_HOST || 'localhost';
            const apiPort = import.meta.env.VITE_API_PORT || '37019';
            let url = `http://${apiHost}:${apiPort}/start-path?mode=${selectedMode.value}`;

            if (selectedMode.value === 'server' && selectedTemplate.value) {
                url += `&template=${encodeURIComponent(selectedTemplate.value)}`;
            }

            startTime.value = Date.now();

            await axiosInstance.post(url, { path: filePath });
        } catch (error) {
            console.error('请求失败:', error);
            message.error(t('home.request_failed'));
            resetState();
            socket.disconnect();
        }
    }

    function handleStartProcess() {
        const actualPath = getActualFilePath();

        if (!actualPath) {
            message.warning(t('home.please_select_file'));
            return;
        }

        startButtonDisabled.value = true;
        uploadDisabled.value = true;
        showSteps.value = true;

        message.loading(t('home.ws_connecting'));
        const wsHost = import.meta.env.VITE_WS_HOST || 'localhost';
        const wsPort = import.meta.env.VITE_WS_PORT || '37019';
        const socket = io(`${wsHost}:${wsPort}/`, {
            autoConnect: false,
            reconnection: false
        });

        socket.connect();

        socket.on('connect', () => {
            message.success(t('home.ws_connected'));
            runDeEarthXFromPath(actualPath, socket);
        });

        socket.on("finish", (timeSpent: number) => {
            handleFinish(timeSpent);
            socket.disconnect();
            setTimeout(() => resetState(), 8000);
        });

        socket.on("unzip", (data: any) => {
            updateUnzipProgress(data);
        });

        socket.on("downloading", (data: any) => {
            updateDownloadProgress(data);
        });

        socket.on("changed", () => {
            currentStep.value++;
        });

        socket.on("server_install_start", (data: any) => {
            handleServerInstallStart(data);
        });

        socket.on("server_install_step", (data: any) => {
            handleServerInstallStep(data);
        });

        socket.on("server_install_progress", (data: any) => {
            handleServerInstallProgress(data);
        });

        socket.on("server_install_complete", (data: any) => {
            handleServerInstallComplete(data);
        });

        socket.on("server_install_error", (data: any) => {
            handleServerInstallError(data);
        });

        socket.on("filter_mods_start", (data: any) => {
            handleFilterModsStart(data);
        });

        socket.on("filter_mods_progress", (data: any) => {
            handleFilterModsProgress(data);
        });

        socket.on("filter_mods_complete", (data: any) => {
            handleFilterModsComplete(data);
        });

        socket.on("filter_mods_error", (data: any) => {
            handleFilterModsError(data);
        });

        socket.on("error", (error: any) => {
            handleError(error);
            resetState();
            socket.disconnect();
        });
        socket.on('disconnect', () => {
            console.log('WebSocket连接关闭');
        });
    }

    return {
        // File upload
        uploadDisabled,
        // File path
        droppedFilePath,
        setDroppedFilePath,
        clearDroppedFilePath,
        // Mode selection
        javaAvailable,
        selectedMode,
        modeOptions,
        handleModeSelect,
        // Template selection
        showTemplateModal,
        templates,
        loadingTemplates,
        selectedTemplate,
        currentTemplateName,
        loadTemplates,
        openTemplateModal,
        selectTemplate,
        // Progress
        showSteps,
        currentStep,
        stepItems,
        unzipProgress,
        downloadProgress,
        uploadProgress,
        serverInstallProgress,
        filterModsProgress,
        serverInstallInfo,
        filterModsInfo,
        startTime,
        // Task
        startButtonDisabled,
        handleStartProcess
    };
}