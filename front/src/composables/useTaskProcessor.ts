import { ref, inject } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { useFileUpload } from '@/composables/useFileUpload';
import { useModeSelection } from '@/composables/useModeSelection';
import { useTemplateSelection } from '@/composables/useTemplateSelection';
import { useProgress } from '@/composables/useProgress';
import { useErrorHandler } from '@/composables/useErrorHandler';

export function useTaskProcessor() {
    const { t } = useI18n();
    const killCoreProcess = inject<(() => void) | undefined>("killCoreProcess");

    // Initialize all sub-composables
    const {
        uploadedFiles,
        uploadDisabled,
        beforeUpload,
        handleFileChange,
        handleFileDrop
    } = useFileUpload();

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
        uploadedFiles.value = [];
        uploadDisabled.value = false;
        startButtonDisabled.value = false;
        resetProgress();
        if (killCoreProcess && typeof killCoreProcess === 'function') {
            killCoreProcess();
        }
    }

    async function runDeEarthX(file: File, socket: Socket) {
        message.success(t('home.start_production'));
        showSteps.value = true;

        const formData = new FormData();
        formData.append('file', file);

        try {
            message.loading(t('home.task_preparing'));
            const apiHost = import.meta.env.VITE_API_HOST || 'localhost';
            const apiPort = import.meta.env.VITE_API_PORT || '37019';
            let url = `http://${apiHost}:${apiPort}/start?mode=${selectedMode.value}`;

            if (selectedMode.value === 'server' && selectedTemplate.value) {
                url += `&template=${encodeURIComponent(selectedTemplate.value)}`;
            }

            uploadProgress.value = { status: 'active', percent: 0, display: true };
            startTime.value = Date.now();

            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', url, true);

                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const percent = Math.round((event.loaded / event.total) * 100);
                        uploadProgress.value.percent = percent;
                        uploadProgress.value.uploadedSize = event.loaded;
                        uploadProgress.value.totalSize = event.total;

                        const elapsedTime = (Date.now() - startTime.value) / 1000;
                        if (elapsedTime > 0) {
                            uploadProgress.value.speed = event.loaded / elapsedTime;

                            const remainingBytes = event.total - event.loaded;
                            uploadProgress.value.remainingTime = remainingBytes / uploadProgress.value.speed;
                        }
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        uploadProgress.value.status = 'success';
                        uploadProgress.value.percent = 100;
                        setTimeout(() => {
                            uploadProgress.value.display = false;
                        }, 2000);
                        resolve(xhr.response);
                    } else {
                        uploadProgress.value.status = 'exception';
                        reject(new Error(`HTTP ${xhr.status}`));
                    }
                });

                xhr.addEventListener('error', () => {
                    uploadProgress.value.status = 'exception';
                    reject(new Error('网络错误'));
                });

                xhr.addEventListener('abort', () => {
                    uploadProgress.value.status = 'exception';
                    reject(new Error('上传已取消'));
                });

                xhr.send(formData);
            });
        } catch (error) {
            console.error('请求失败:', error);
            message.error(t('home.request_failed'));
            uploadProgress.value.status = 'exception';
            resetState();
            socket.disconnect();
        }
    }

    function handleStartProcess() {
        if (uploadedFiles.value.length === 0) {
            message.warning(t('home.please_select_file'));
            return;
        }

        const file = uploadedFiles.value[0].originFileObj;
        if (!file) return;

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
            runDeEarthX(file, socket);
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
        uploadedFiles,
        uploadDisabled,
        beforeUpload,
        handleFileChange,
        handleFileDrop,
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
