<script lang="ts" setup>
import { ref, inject, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { message, notification } from 'ant-design-vue';
import { sendNotification } from '@tauri-apps/plugin-notification';

const { t } = useI18n();

interface Props {
    file: File | undefined;
    mode: string;
    showSteps: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    'step-change': [step: number];
    'reset': [];
}>();

const currentStep = ref(0);
const startTime = ref<number>(0);
const javaAvailable = ref(true);

interface ProgressStatus {
    status: 'active' | 'success' | 'exception' | 'normal';
    percent: number;
    display: boolean;
    uploadedSize?: number;
    totalSize?: number;
    speed?: number;
    remainingTime?: number;
}

const uploadProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: false });
const unzipProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: true });
const downloadProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: true });
const serverInstallProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: false });
const filterModsProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: false });

const serverInstallInfo = ref({
    modpackName: '',
    minecraftVersion: '',
    loaderType: '',
    loaderVersion: '',
    currentStep: '',
    stepIndex: 0,
    totalSteps: 0,
    message: '',
    status: 'idle' as 'idle' | 'installing' | 'completed' | 'error',
    error: '',
    installPath: '',
    duration: 0
});

const filterModsInfo = ref({
    totalMods: 0,
    currentMod: 0,
    modName: '',
    filteredCount: 0,
    movedCount: 0,
    status: 'idle' as 'idle' | 'filtering' | 'completed' | 'error',
    error: '',
    duration: 0
});

function resetState() {
    uploadProgress.value = { status: 'active', percent: 0, display: false };
    unzipProgress.value = { status: 'active', percent: 0, display: true };
    downloadProgress.value = { status: 'active', percent: 0, display: true };
    serverInstallProgress.value = { status: 'active', percent: 0, display: false };
    filterModsProgress.value = { status: 'active', percent: 0, display: false };
    currentStep.value = 0;
    
    const killCoreProcess = inject("killCoreProcess");
    if (killCoreProcess && typeof killCoreProcess === 'function') {
        killCoreProcess();
    }
}

watch(() => props.showSteps, (newVal) => {
    if (newVal && props.file) {
        runDeEarthX(props.file);
    }
});

async function runDeEarthX(file: File) {
    message.success(t('home.start_production'));

    const formData = new FormData();
    formData.append('file', file);

    try {
        message.loading(t('home.task_preparing'));
        const apiHost = import.meta.env.VITE_API_HOST || 'localhost';
        const apiPort = import.meta.env.VITE_API_PORT || '37019';
        const url = `http://${apiHost}:${apiPort}/start?mode=${props.mode}`;

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
                    updateWindowProgress();
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

        message.success(t('home.task_connecting'));
        setupWebSocket();
    } catch (error) {
        console.error('请求失败:', error);
        message.error(t('home.request_failed'));
        uploadProgress.value.status = 'exception';
        resetState();
    }
}

function setupWebSocket() {
    message.loading(t('home.ws_connecting'));
    const wsHost = import.meta.env.VITE_WS_HOST || 'localhost';
    const wsPort = import.meta.env.VITE_WS_PORT || '37019';
    const ws = new WebSocket(`ws://${wsHost}:${wsPort}/`);

    ws.addEventListener('open', () => {
        message.success(t('home.ws_connected'));
    });

    ws.addEventListener('message', (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.type === 'error') {
                handleError(data.message);
            } else if (data.type === 'info') {
                message.info(data.message);
            } else if (data.status) {
                switch (data.status) {
                    case 'error':
                        handleError(data.result);
                        break;
                    case 'changed':
                        currentStep.value++;
                        emit('step-change', currentStep.value);
                        break;
                    case 'unzip':
                        updateUnzipProgress(data.result);
                        break;
                    case 'downloading':
                        updateDownloadProgress(data.result);
                        break;
                    case 'finish':
                        handleFinish(data.result);
                        break;
                    case 'server_install_start':
                        handleServerInstallStart(data.result);
                        break;
                    case 'server_install_step':
                        handleServerInstallStep(data.result);
                        break;
                    case 'server_install_progress':
                        handleServerInstallProgress(data.result);
                        break;
                    case 'server_install_complete':
                        handleServerInstallComplete(data.result);
                        break;
                    case 'server_install_error':
                        handleServerInstallError(data.result);
                        break;
                    case 'filter_mods_start':
                        handleFilterModsStart(data.result);
                        break;
                    case 'filter_mods_progress':
                        handleFilterModsProgress(data.result);
                        break;
                    case 'filter_mods_complete':
                        handleFilterModsComplete(data.result);
                        break;
                    case 'filter_mods_error':
                        handleFilterModsError(data.result);
                        break;
                }
            }
        } catch (error) {
            console.error('解析WebSocket消息失败:', error);
            notification.error({ message: t('common.error'), description: t('home.parse_error') });
        }
    });

    ws.addEventListener('error', () => {
        notification.error({
            message: t('home.ws_error_title'),
            description: `${t('home.ws_error_desc')}\n\n${t('home.suggestions')}:\n1. ${t('home.suggestion_check_backend')}\n2. ${t('home.suggestion_check_port')}\n3. ${t('home.suggestion_restart_application')}`,
            duration: 0
        });
        resetState();
    });

    ws.addEventListener('close', () => {
        console.log('WebSocket连接关闭');
    });
}

function handleError(result: any) {
    if (result === 'jini') {
        javaAvailable.value = false;
        notification.error({
            message: t('home.java_error_title'),
            description: t('home.java_error_desc'),
            duration: 0
        });
    } else if (typeof result === 'string') {
        let errorTitle = t('home.backend_error');
        let errorDesc = t('home.backend_error_desc', { error: result });
        let suggestions: string[] = [];

        if (result.includes('network') || result.includes('connection') || result.includes('timeout')) {
            errorTitle = t('home.network_error_title');
            errorDesc = t('home.network_error_desc', { error: result });
            suggestions = [
                t('home.suggestion_check_network'),
                t('home.suggestion_check_firewall'),
                t('home.suggestion_retry')
            ];
        } else if (result.includes('file') || result.includes('permission') || result.includes('disk')) {
            errorTitle = t('home.file_error_title');
            errorDesc = t('home.file_error_desc', { error: result });
            suggestions = [
                t('home.suggestion_check_disk_space'),
                t('home.suggestion_check_permission'),
                t('home.suggestion_check_file_format')
            ];
        } else if (result.includes('memory') || result.includes('out of memory') || result.includes('heap')) {
            errorTitle = t('home.memory_error_title');
            errorDesc = t('home.memory_error_desc', { error: result });
            suggestions = [
                t('home.suggestion_increase_memory'),
                t('home.suggestion_close_other_apps'),
                t('home.suggestion_restart_application')
            ];
        } else {
            suggestions = [
                t('home.suggestion_check_backend'),
                t('home.suggestion_check_logs'),
                t('home.suggestion_contact_support')
            ];
        }

        const fullDescription = `${errorDesc}\n\n${t('home.suggestions')}:\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;

        notification.error({
            message: errorTitle,
            description: fullDescription,
            duration: 0
        });

        resetState();
    } else {
        notification.error({
            message: t('home.unknown_error_title'),
            description: t('home.unknown_error_desc'),
            duration: 0
        });
        resetState();
    }
}

function updateUnzipProgress(result: { current: number; total: number }) {
    unzipProgress.value.percent = Math.round((result.current / result.total) * 100);
    if (result.current === result.total) {
        unzipProgress.value.status = 'success';
        setTimeout(() => {
            unzipProgress.value.display = false;
        }, 2000);
    }
    updateWindowProgress();
}

function updateDownloadProgress(result: { index: number; total: number }) {
    downloadProgress.value.percent = Math.round((result.index / result.total) * 100);
    if (downloadProgress.value.percent === 100) {
        downloadProgress.value.status = 'success';
        setTimeout(() => {
            downloadProgress.value.display = false;
        }, 2000);
    }
    updateWindowProgress();
}

function updateWindowProgress() {
    (window as any).progressData = {
        uploadProgress: uploadProgress.value,
        unzipProgress: unzipProgress.value,
        downloadProgress: downloadProgress.value,
        serverInstallProgress: serverInstallProgress.value,
        filterModsProgress: filterModsProgress.value,
        serverInstallInfo: serverInstallInfo.value,
        filterModsInfo: filterModsInfo.value
    };
}

function handleFinish(result: number) {
    const timeSpent = Math.round(result / 1000);
    currentStep.value++;
    emit('step-change', currentStep.value);
    message.success(t('home.production_complete', { time: timeSpent }));
    sendNotification({ title: t('common.app_name'), body: t('home.production_complete', { time: timeSpent }) });

    setTimeout(() => {
        emit('reset');
    }, 8000);
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
        message: 'Starting installation...',
        status: 'installing',
        error: '',
        installPath: '',
        duration: 0
    };
    serverInstallProgress.value = { status: 'active', percent: 0, display: true };
    updateWindowProgress();
}

function handleServerInstallStep(result: any) {
    serverInstallInfo.value.currentStep = result.step;
    serverInstallInfo.value.stepIndex = result.stepIndex;
    serverInstallInfo.value.totalSteps = result.totalSteps;
    serverInstallInfo.value.message = result.message || result.step;
    
    const overallProgress = (result.stepIndex / result.totalSteps) * 100;
    serverInstallProgress.value.percent = Math.round(overallProgress);
    updateWindowProgress();
}

function handleServerInstallProgress(result: any) {
    serverInstallInfo.value.currentStep = result.step;
    serverInstallInfo.value.message = result.message || result.step;
    serverInstallProgress.value.percent = result.progress;
    updateWindowProgress();
}

function handleServerInstallComplete(result: any) {
    serverInstallInfo.value.status = 'completed';
    serverInstallInfo.value.installPath = result.installPath;
    serverInstallInfo.value.duration = result.duration;
    serverInstallInfo.value.message = t('home.server_install_completed');
    serverInstallProgress.value = { status: 'success', percent: 100, display: true };
    
    currentStep.value++;
    emit('step-change', currentStep.value);
    
    const timeSpent = Math.round(result.duration / 1000);
    message.success(t('home.server_install_completed') + ` ${t('home.server_install_duration')}: ${timeSpent}s`);
    sendNotification({ title: t('common.app_name'), body: t('home.production_complete', { time: timeSpent }) });
    
    setTimeout(() => {
        serverInstallProgress.value.display = false;
    }, 8000);
    updateWindowProgress();
}

function handleServerInstallError(result: any) {
    serverInstallInfo.value.status = 'error';
    serverInstallInfo.value.error = result.error;
    serverInstallInfo.value.message = result.error;
    serverInstallProgress.value = { status: 'exception', percent: serverInstallProgress.value.percent, display: true };
    
    notification.error({
        message: t('home.server_install_error'),
        description: result.error,
        duration: 0
    });
    updateWindowProgress();
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
    updateWindowProgress();
}

function handleFilterModsProgress(result: any) {
    filterModsInfo.value.currentMod = result.current;
    filterModsInfo.value.modName = result.modName;
    
    const percent = Math.round((result.current / result.total) * 100);
    filterModsProgress.value.percent = percent;
    updateWindowProgress();
}

function handleFilterModsComplete(result: any) {
    filterModsInfo.value.status = 'completed';
    filterModsInfo.value.filteredCount = result.filteredCount;
    filterModsInfo.value.movedCount = result.movedCount;
    filterModsInfo.value.duration = result.duration;
    filterModsProgress.value = { status: 'success', percent: 100, display: true };
    
    const timeSpent = Math.round(result.duration / 1000);
    message.success(t('home.filter_mods_completed', { filtered: result.filteredCount, moved: result.movedCount }) + ` ${t('home.server_install_duration')}: ${timeSpent}s`);
    
    setTimeout(() => {
        filterModsProgress.value.display = false;
    }, 8000);
    updateWindowProgress();
}

function handleFilterModsError(result: any) {
    filterModsInfo.value.status = 'error';
    filterModsInfo.value.error = result.error;
    filterModsProgress.value = { status: 'exception', percent: filterModsProgress.value.percent, display: true };
    
    notification.error({
        message: t('home.filter_mods_error'),
        description: result.error,
        duration: 0
    });
    updateWindowProgress();
}
</script>

<template>
</template>
