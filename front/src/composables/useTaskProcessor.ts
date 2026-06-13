import { inject } from 'vue';
import { storeToRefs } from 'pinia';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { useProgressStore } from '@/stores/progress';
import { useErrorHandler } from '@/composables/useErrorHandler';

export function useTaskProcessor() {
    const { t } = useI18n();
    const store = useProgressStore();
    const {
        uploadDisabled,
        droppedFilePath,
        javaAvailable,
        selectedMode,
        showTemplateModal,
        templates,
        loadingTemplates,
        selectedTemplate,
        currentTemplateName,
        showSteps,
        currentStep,
        unzipProgress,
        downloadProgress,
        uploadProgress,
        serverInstallProgress,
        filterModsProgress,
        serverInstallInfo,
        filterModsInfo,
        startTime,
        startButtonDisabled
    } = storeToRefs(store);

    const killCoreProcess = inject<(() => void) | undefined>("killCoreProcess");
    const clearDroppedFile = inject<(() => void) | undefined>('clearDroppedFile');

    const { handleError } = useErrorHandler();

    function resetState() {
        store.resetState();
        if (clearDroppedFile) {
            clearDroppedFile();
        }
        if (killCoreProcess && typeof killCoreProcess === 'function') {
            killCoreProcess();
        }
    }

    async function runDeEarthXFromPath(filePath: string, socket: Socket) {
        store.showSteps = true;

        try {
            const apiHost = import.meta.env.VITE_API_HOST || 'localhost';
            const apiPort = import.meta.env.VITE_API_PORT || '37019';
            let url = `http://${apiHost}:${apiPort}/start-path?mode=${store.selectedMode}`;

            if (store.selectedMode === 'server' && store.selectedTemplate) {
                url += `&template=${encodeURIComponent(store.selectedTemplate)}`;
            }

            store.startTime = Date.now();

            const { default: axiosInstance } = await import('@/utils/axios');
            await axiosInstance.post(url, { path: filePath });
        } catch (error) {
            console.error('请求失败:', error);
            message.error(t('home.request_failed'));
            resetState();
            socket.disconnect();
        }
    }

    function handleStartProcess() {
        const actualPath = store.getActualFilePath();

        if (!actualPath) {
            message.warning(t('home.please_select_file'));
            return;
        }

        store.startTask();

        const wsHost = import.meta.env.VITE_WS_HOST || 'localhost';
        const wsPort = import.meta.env.VITE_WS_PORT || '37019';
        const socket = io(`${wsHost}:${wsPort}/`, {
            autoConnect: false,
            reconnection: false
        });

        socket.connect();

        socket.on('connect', () => {
            // 连接成功不弹提示，只有失败才弹
            runDeEarthXFromPath(actualPath, socket);
        });

        socket.on("finish", (timeSpent: number) => {
            const time = Math.round(timeSpent / 1000);
            store.incrementStep();

            // 根据模式显示不同的完成消息
            if (store.selectedMode === 'server') {
                const info = store.serverInstallInfo;
                if (info.installPath) {
                    message.success(t('home.server_install_completed') + ` ${t('home.server_install_duration')}: ${time}s`);
                } else {
                    message.success(t('home.production_complete', { time }));
                }
            } else {
                message.success(t('home.production_complete', { time }));
            }

            sendNotification({ title: t('common.app_name'), body: t('home.production_complete', { time }) });
            socket.disconnect();
            store.completeTask();
        });

        socket.on("unzip", (data: any) => {
            store.updateUnzipProgress(data);
        });

        socket.on("downloading", (data: any) => {
            store.updateDownloadProgress(data);
        });

        socket.on("changed", () => {
            store.incrementStep();
        });

        socket.on("server_install_start", (data: any) => {
            store.handleServerInstallStart(data);
        });

        socket.on("server_install_step", (data: any) => {
            store.handleServerInstallStep(data);
        });

        socket.on("server_install_progress", (data: any) => {
            store.handleServerInstallProgress(data);
        });

        socket.on("server_install_complete", (data: any) => {
            store.handleServerInstallComplete(data);
            // finish 事件会统一发送通知，这里不再重复发送
        });

        socket.on("server_install_error", (data: any) => {
            store.handleServerInstallError(data);
        });

        socket.on("filter_mods_start", (data: any) => {
            store.handleFilterModsStart(data);
        });

        socket.on("filter_mods_progress", (data: any) => {
            store.handleFilterModsProgress(data);
        });

        socket.on("filter_mods_complete", (data: any) => {
            store.handleFilterModsComplete(data);
            const timeSpent = Math.round(data.duration / 1000);
            message.success(t('home.filter_mods_completed', { filtered: data.filteredCount, moved: data.movedCount }) + ` ${t('home.server_install_duration')}: ${timeSpent}s`);
        });

        socket.on("filter_mods_error", (data: any) => {
            store.handleFilterModsError(data);
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
        setDroppedFilePath: store.setDroppedFilePath,
        clearDroppedFilePath: store.clearDroppedFilePath,
        // Mode selection
        javaAvailable,
        selectedMode,
        modeOptions: store.modeOptions,
        handleModeSelect: store.handleModeSelect,
        // Template selection
        showTemplateModal,
        templates,
        loadingTemplates,
        selectedTemplate,
        currentTemplateName,
        loadTemplates: store.loadTemplates,
        openTemplateModal: store.openTemplateModal,
        selectTemplate: store.selectTemplate,
        // Progress
        showSteps,
        currentStep,
        stepItems: store.stepItems,
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