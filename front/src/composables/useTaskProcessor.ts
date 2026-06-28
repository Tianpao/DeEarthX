import { inject, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { useProgressStore } from '@/stores/progress';
import { useErrorHandler } from '@/composables/useErrorHandler';

export interface AiToolCallCard {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  status: 'running' | 'success' | 'error';
  result?: string;
  error?: string;
}

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

    // AI 弹窗状态
    const showAiPromptModal = ref(false);
    const aiPromptData = ref<{ modpackName: string; installPath: string }>({ modpackName: '', installPath: '' });
    let aiCheckSocket: Socket | null = null;

    // AI 圆形按钮 + 窗口
    const showAiButton = ref(false);
    const showAiWindow = ref(false);
    const aiToolCalls = ref<AiToolCallCard[]>([]);

    function handleAiDecision(useAi: boolean) {
        showAiPromptModal.value = false;
        if (useAi) {
            showAiButton.value = true;
            showAiWindow.value = true;
            aiToolCalls.value = [];
        }
        if (aiCheckSocket) {
            aiCheckSocket.emit("ai_check_decision", { useAi });
        }
    }

    function toggleAiWindow() {
        showAiWindow.value = !showAiWindow.value;
    }

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
            aiCheckSocket = socket;
            runDeEarthXFromPath(actualPath, socket);
        });

        socket.on("finish", (timeSpent: number) => {
            const time = Math.round(timeSpent / 1000);
            store.incrementStep();

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
        });

        socket.on("ai_check_prompt", (data: { modpackName: string; installPath: string }) => {
            aiPromptData.value = data;
            showAiPromptModal.value = true;
        });

        socket.on("ai_tool_call", (data: AiToolCallCard) => {
            const idx = aiToolCalls.value.findIndex(c => c.id === data.id);
            if (idx >= 0) {
                aiToolCalls.value[idx] = data;
            } else {
                aiToolCalls.value = [...aiToolCalls.value, data];
            }
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
        handleStartProcess,
        // AI
        showAiPromptModal,
        aiPromptData,
        handleAiDecision,
        showAiButton,
        showAiWindow,
        toggleAiWindow,
        aiToolCalls
    };
}
