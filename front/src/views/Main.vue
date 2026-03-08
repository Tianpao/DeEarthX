<script lang="ts" setup>
import { inject, ref, onMounted, computed } from 'vue';
import { InboxOutlined } from '@ant-design/icons-vue';
import { message, notification, StepsProps } from 'ant-design-vue';
import type { UploadFile, UploadChangeParam } from 'ant-design-vue';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { SelectProps } from 'ant-design-vue/es/vc-select';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface Template {
    id: string;
    metadata: {
        name: string;
        version: string;
        description: string;
        author: string;
        created: string;
        type: string;
    };
}

// 进度步骤配置
const showSteps = ref(false);
const currentStep = ref(0);

// 模板选择相关
const showTemplateModal = ref(false);
const templates = ref<Template[]>([]);
const loadingTemplates = ref(false);
const selectedTemplate = ref<string>('0');

// 步骤项（使用computed自动响应语言变化）
const stepItems = computed<Required<StepsProps>['items']>(() => {
    return [
        { title: t('home.step1_title'), description: t('home.step1_desc') },
        { title: t('home.step2_title'), description: t('home.step2_desc') },
        { title: t('home.step3_title'), description: t('home.step3_desc') },
        { title: t('home.step4_title'), description: t('home.step4_desc') }
    ];
});

// 文件上传相关
const uploadedFiles = ref<UploadFile[]>([]);
const uploadDisabled = ref(false);
const startButtonDisabled = ref(false);

// 阻止默认上传行为
function beforeUpload() {
    return false;
}

// 处理文件上传变更
function handleFileChange(info: UploadChangeParam) {
    if (info.file.status === 'removed') {
        uploadDisabled.value = false;
        return;
    }

    if (info.file.status === 'uploading') {
        message.loading(t('home.preparing_file'));
        return;
    }

    if (info.file.status === 'done') {
        message.success(t('home.file_prepared'));
    }

    if (!info.file.name?.endsWith('.zip') && !info.file.name?.endsWith('.mrpack')) {
        message.error(t('home.only_zip_mrpack'));
        return;
    }
    uploadDisabled.value = true;
}

// 处理文件拖拽（预留功能）
function handleFileDrop(e: DragEvent) {
    console.log(e);
}

// 初始化
onMounted(() => {
    // stepItems 和 modeOptions 都是 computed，会自动初始化
});

// 重置所有状态
function resetState() {
    uploadedFiles.value = [];
    uploadDisabled.value = false;
    startButtonDisabled.value = false;
    showSteps.value = false;
    currentStep.value = 0;
    unzipProgress.value = { status: 'active', percent: 0, display: true };
    downloadProgress.value = { status: 'active', percent: 0, display: true };
    const killCoreProcess = inject("killCoreProcess");
    if (killCoreProcess && typeof killCoreProcess === 'function') {
        killCoreProcess();
    }
}

// 模式选择相关
const javaAvailable = ref(true);
const selectedMode = ref(javaAvailable.value ? 'server' : 'upload');

// 模式选项（使用computed自动响应语言变化）
const modeOptions = computed<SelectProps['options']>(() => {
    return [
        { label: t('home.mode_server'), value: 'server', disabled: !javaAvailable.value },
        { label: t('home.mode_upload'), value: 'upload', disabled: false }
    ];
});

// 处理模式选择
function handleModeSelect(value: string) {
    selectedMode.value = value;
}

// 加载模板列表
async function loadTemplates() {
    loadingTemplates.value = true;
    try {
        const apiHost = import.meta.env.VITE_API_HOST || 'localhost';
        const apiPort = import.meta.env.VITE_API_PORT || '37019';
        const response = await fetch(`http://${apiHost}:${apiPort}/templates`);
        const result = await response.json();
        
        if (result.status === 200 && result.data) {
            templates.value = result.data;
        } else {
            message.error(t('home.template_load_failed'));
        }
    } catch (error) {
        console.error('加载模板列表失败:', error);
        message.error(t('home.template_load_failed'));
    } finally {
        loadingTemplates.value = false;
    }
}

// 打开模板选择弹窗
function openTemplateModal() {
    loadTemplates();
    showTemplateModal.value = true;
}

// 选择模板
function selectTemplate(templateId: string) {
    selectedTemplate.value = templateId;
    showTemplateModal.value = false;
    if (templateId === '0') {
        message.success(t('home.template_selected') + ': ' + t('home.template_official_loader'));
    } else {
        const template = templates.value.find(t => t.id === templateId);
        if (template) {
            message.success(t('home.template_selected') + ': ' + template.metadata.name);
        }
    }
}

// 获取当前选择的模板名称
const currentTemplateName = computed(() => {
    if (selectedTemplate.value === '0' || !selectedTemplate.value) {
        return t('home.template_official_loader');
    }
    const template = templates.value.find(t => t.id === selectedTemplate.value);
    return template ? template.metadata.name : t('home.template_official_loader');
});

// 进度显示相关
interface ProgressStatus {
    status: 'active' | 'success' | 'exception' | 'normal';
    percent: number;
    display: boolean;
    uploadedSize?: number;
    totalSize?: number;
    speed?: number;
    remainingTime?: number;
}
const unzipProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: true });
const downloadProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: true });
const uploadProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: false });
const serverInstallProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: false });
const filterModsProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: false });
const startTime = ref<number>(0);

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

// 格式化文件大小
function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// 格式化时间
function formatTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// 运行DeEarthX核心功能
async function runDeEarthX(file: File) {
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
                    
                    // 计算上传速度
                    const elapsedTime = (Date.now() - startTime.value) / 1000;
                    if (elapsedTime > 0) {
                        uploadProgress.value.speed = event.loaded / elapsedTime;
                        
                        // 计算剩余时间
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

        message.success(t('home.task_connecting'));
        setupWebSocket();
    } catch (error) {
        console.error('请求失败:', error);
        message.error(t('home.request_failed'));
        uploadProgress.value.status = 'exception';
        resetState();
    }
}

// 设置WebSocket连接
function setupWebSocket() {
    message.loading(t('home.ws_connecting'));
    // 从配置或环境变量获取WebSocket地址
    const wsHost = import.meta.env.VITE_WS_HOST || 'localhost';
    const wsPort = import.meta.env.VITE_WS_PORT || '37019';
    const ws = new WebSocket(`ws://${wsHost}:${wsPort}/`);

    ws.addEventListener('open', () => {
        message.success(t('home.ws_connected'));
    });

    ws.addEventListener('message', (event) => {
        try {
            const data = JSON.parse(event.data);

            // 处理不同类型的消息
            if (data.type === 'error') {
                handleError(data.message);
            } else if (data.type === 'info') {
                message.info(data.message);
            } else if (data.status) {
                // 处理传统状态消息
                switch (data.status) {
                    case 'error':
                        handleError(data.result);
                        break;
                    case 'changed':
                        currentStep.value++;
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

// 处理错误消息
function handleError(result: any) {
    if (result === 'jini') {
        javaAvailable.value = false;
        notification.error({
            message: t('home.java_error_title'),
            description: t('home.java_error_desc'),
            duration: 0
        });
    } else if (typeof result === 'string') {
        // 根据错误类型提供不同的解决方案
        let errorTitle = t('home.backend_error');
        let errorDesc = t('home.backend_error_desc', { error: result });
        let suggestions: string[] = [];

        // 网络相关错误
        if (result.includes('network') || result.includes('connection') || result.includes('timeout')) {
            errorTitle = t('home.network_error_title');
            errorDesc = t('home.network_error_desc', { error: result });
            suggestions = [
                t('home.suggestion_check_network'),
                t('home.suggestion_check_firewall'),
                t('home.suggestion_retry')
            ];
        }
        // 文件相关错误
        else if (result.includes('file') || result.includes('permission') || result.includes('disk')) {
            errorTitle = t('home.file_error_title');
            errorDesc = t('home.file_error_desc', { error: result });
            suggestions = [
                t('home.suggestion_check_disk_space'),
                t('home.suggestion_check_permission'),
                t('home.suggestion_check_file_format')
            ];
        }
        // 内存相关错误
        else if (result.includes('memory') || result.includes('out of memory') || result.includes('heap')) {
            errorTitle = t('home.memory_error_title');
            errorDesc = t('home.memory_error_desc', { error: result });
            suggestions = [
                t('home.suggestion_increase_memory'),
                t('home.suggestion_close_other_apps'),
                t('home.suggestion_restart_application')
            ];
        }
        // 通用错误
        else {
            suggestions = [
                t('home.suggestion_check_backend'),
                t('home.suggestion_check_logs'),
                t('home.suggestion_contact_support')
            ];
        }

        // 构建完整的错误描述
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

// 更新解压进度
function updateUnzipProgress(result: { current: number; total: number }) {
    unzipProgress.value.percent = Math.round((result.current / result.total) * 100);
    if (result.current === result.total) {
        unzipProgress.value.status = 'success';
        setTimeout(() => {
            unzipProgress.value.display = false;
        }, 2000);
    }
}

// 更新下载进度
function updateDownloadProgress(result: { index: number; total: number }) {
    downloadProgress.value.percent = Math.round((result.index / result.total) * 100);
    if (downloadProgress.value.percent === 100) {
        downloadProgress.value.status = 'success';
        setTimeout(() => {
            downloadProgress.value.display = false;
        }, 2000);
    }
}

// 处理完成状态
function handleFinish(result: number) {
    const timeSpent = Math.round(result / 1000);
    currentStep.value++;
    message.success(t('home.production_complete', { time: timeSpent }));
    sendNotification({ title: t('common.app_name'), body: t('home.production_complete', { time: timeSpent }) });

    // 8秒后自动重置状态
    setTimeout(resetState, 8000);
}

// 处理服务端安装开始
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
}

// 处理服务端安装步骤
function handleServerInstallStep(result: any) {
    serverInstallInfo.value.currentStep = result.step;
    serverInstallInfo.value.stepIndex = result.stepIndex;
    serverInstallInfo.value.totalSteps = result.totalSteps;
    serverInstallInfo.value.message = result.message || result.step;
    
    // 计算总体进度
    const overallProgress = (result.stepIndex / result.totalSteps) * 100;
    serverInstallProgress.value.percent = Math.round(overallProgress);
}

// 处理服务端安装进度
function handleServerInstallProgress(result: any) {
    serverInstallInfo.value.currentStep = result.step;
    serverInstallInfo.value.message = result.message || result.step;
    serverInstallProgress.value.percent = result.progress;
}

// 处理服务端安装完成
function handleServerInstallComplete(result: any) {
    serverInstallInfo.value.status = 'completed';
    serverInstallInfo.value.installPath = result.installPath;
    serverInstallInfo.value.duration = result.duration;
    serverInstallInfo.value.message = t('home.server_install_completed');
    serverInstallProgress.value = { status: 'success', percent: 100, display: true };
    
    // 跳转到完成步骤
    currentStep.value++;
    
    const timeSpent = Math.round(result.duration / 1000);
    message.success(t('home.server_install_completed') + ` ${t('home.server_install_duration')}: ${timeSpent}s`);
    sendNotification({ title: t('common.app_name'), body: t('home.production_complete', { time: timeSpent }) });
    
    // 8秒后隐藏进度
    setTimeout(() => {
        serverInstallProgress.value.display = false;
    }, 8000);
}

// 处理服务端安装错误
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
}

// 处理筛选模组开始
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

// 处理筛选模组进度
function handleFilterModsProgress(result: any) {
    filterModsInfo.value.currentMod = result.current;
    filterModsInfo.value.modName = result.modName;
    
    const percent = Math.round((result.current / result.total) * 100);
    filterModsProgress.value.percent = percent;
}

// 处理筛选模组完成
function handleFilterModsComplete(result: any) {
    filterModsInfo.value.status = 'completed';
    filterModsInfo.value.filteredCount = result.filteredCount;
    filterModsInfo.value.movedCount = result.movedCount;
    filterModsInfo.value.duration = result.duration;
    filterModsProgress.value = { status: 'success', percent: 100, display: true };
    
    const timeSpent = Math.round(result.duration / 1000);
    message.success(t('home.filter_mods_completed', { filtered: result.filteredCount, moved: result.movedCount }) + ` ${t('home.server_install_duration')}: ${timeSpent}s`);
    
    // 8秒后隐藏进度
    setTimeout(() => {
        filterModsProgress.value.display = false;
    }, 8000);
}

// 处理筛选模组错误
function handleFilterModsError(result: any) {
    filterModsInfo.value.status = 'error';
    filterModsInfo.value.error = result.error;
    filterModsProgress.value = { status: 'exception', percent: filterModsProgress.value.percent, display: true };
    
    notification.error({
        message: t('home.filter_mods_error'),
        description: result.error,
        duration: 0
    });
}

// 开始处理文件
function handleStartProcess() {
    if (uploadedFiles.value.length === 0) {
        message.warning(t('home.please_select_file'));
        return;
    }

    const file = uploadedFiles.value[0].originFileObj;
    if (!file) return;

    runDeEarthX(file);
    startButtonDisabled.value = true;
    uploadDisabled.value = true;
    showSteps.value = true;
}
</script>
<template>
    <div class="tw:h-full tw:w-full tw:relative tw:flex tw:flex-col">
        <div class="tw:flex-1 tw:w-full tw:flex tw:flex-col tw:justify-center tw:items-center tw:p-4">
            <div class="tw:w-full tw:max-w-2xl tw:flex tw:flex-col tw:items-center">
                <div>
                    <h1 class="tw:text-4xl tw:text-center tw:animate-pulse">{{ t('common.app_name') }}</h1>
                    <h1 class="tw:text-sm tw:text-gray-500 tw:text-center">{{ t('home.title') }}</h1>
                </div>
                <a-upload-dragger :disabled="uploadDisabled" class="tw:w-full tw:max-w-md tw:h-48" name="file"
                    action="/" :multiple="false" :before-upload="beforeUpload" @change="handleFileChange"
                    @drop="handleFileDrop" v-model:fileList="uploadedFiles" accept=".zip,.mrpack">
                    <p class="ant-upload-drag-icon">
                        <inbox-outlined></inbox-outlined>
                    </p>
                    <p class="ant-upload-text">{{ t('home.upload_title') }}</p>
                    <p class="ant-upload-hint">
                        {{ t('home.upload_hint') }}
                    </p>
                </a-upload-dragger>
                <div class="tw:flex tw:items-center tw:gap-2 tw:mt-8">
                    <a-select ref="select" :options="modeOptions" :value="selectedMode"
                        style="width: 120px;" @select="handleModeSelect"></a-select>
                    <a-button v-if="selectedMode === 'server'" @click="openTemplateModal">
                        {{ t('home.template_select_button') }}
                    </a-button>
                </div>
                <div v-if="selectedMode === 'server'" class="tw:text-xs tw:text-gray-500 tw:mt-2">
                    {{ t('home.template_selected') }}: {{ currentTemplateName }}
                </div>
                <a-button :disabled="startButtonDisabled" type="primary" @click="handleStartProcess"
                    style="margin-top: 6px">
                    {{ t('common.start') }}
                </a-button>
            </div>
        </div>
        <div v-if="showSteps"
            class="tw:fixed tw:bottom-2 tw:left-1/2 tw:-translate-x-1/2 tw:w-[65%] tw:h-20 tw:flex tw:justify-center tw:items-center tw:text-sm tw:bg-white tw:rounded-xl tw:shadow-lg tw:px-4 tw:ml-10">
            <a-steps :current="currentStep" :items="stepItems" size="small" />
        </div>
        <div v-if="showSteps" ref="logContainer"
            class="tw:absolute tw:right-2 tw:bottom-32 tw:h-80 tw:w-64 tw:rounded-xl tw:overflow-y-auto">
            <a-card :title="t('home.progress_title')" :bordered="true" class="tw:h-full">
                <div v-if="uploadProgress.display" class="tw:mb-4">
                    <h1 class="tw:text-sm">{{ t('home.upload_progress') }}</h1>
                    <a-progress :percent="uploadProgress.percent" :status="uploadProgress.status" size="small" />
                    <div v-if="uploadProgress.totalSize" class="tw:text-xs tw:text-gray-500 tw:mt-1">
                        {{ formatFileSize(uploadProgress.uploadedSize || 0) }} / {{ formatFileSize(uploadProgress.totalSize) }}
                        <span v-if="uploadProgress.speed" class="tw:ml-2">
                            {{ t('home.speed') }}: {{ formatFileSize(uploadProgress.speed) }}/s
                        </span>
                        <span v-if="uploadProgress.remainingTime" class="tw:ml-2">
                            {{ t('home.remaining') }}: {{ formatTime(uploadProgress.remainingTime) }}
                        </span>
                    </div>
                </div>
                <div v-if="unzipProgress.display" class="tw:mb-4">
                    <h1 class="tw:text-sm">{{ t('home.unzip_progress') }}</h1>
                    <a-progress :percent="unzipProgress.percent" :status="unzipProgress.status" size="small" />
                </div>
                <div v-if="downloadProgress.display" class="tw:mb-4">
                    <h1 class="tw:text-sm">{{ t('home.download_progress') }}</h1>
                    <a-progress :percent="downloadProgress.percent" :status="downloadProgress.status" size="small" />
                </div>
                <div v-if="serverInstallProgress.display" class="tw:mb-4">
                    <h1 class="tw:text-sm">{{ t('home.server_install_progress') }}</h1>
                    <a-progress :percent="serverInstallProgress.percent" :status="serverInstallProgress.status" size="small" />
                    <div v-if="serverInstallInfo.currentStep" class="tw:text-xs tw:text-gray-500 tw:mt-1">
                        {{ t('home.server_install_step') }}: {{ serverInstallInfo.currentStep }}
                        <span v-if="serverInstallInfo.totalSteps > 0">
                            ({{ serverInstallInfo.stepIndex }}/{{ serverInstallInfo.totalSteps }})
                        </span>
                    </div>
                    <div v-if="serverInstallInfo.message" class="tw:text-xs tw:text-gray-600 tw:mt-1 tw:break-words">
                        {{ t('home.server_install_message') }}: {{ serverInstallInfo.message }}
                    </div>
                    <div v-if="serverInstallInfo.status === 'completed'" class="tw:text-xs tw:text-green-600 tw:mt-1">
                        {{ t('home.server_install_completed') }} {{ t('home.server_install_duration') }}: {{ (serverInstallInfo.duration / 1000).toFixed(2) }}s
                    </div>
                    <div v-if="serverInstallInfo.status === 'error'" class="tw:text-xs tw:text-red-600 tw:mt-1 tw:break-words">
                        {{ t('home.server_install_error') }}: {{ serverInstallInfo.error }}
                    </div>
                </div>
                <div v-if="filterModsProgress.display" class="tw:mb-4">
                    <h1 class="tw:text-sm">{{ t('home.filter_mods_progress') }}</h1>
                    <a-progress :percent="filterModsProgress.percent" :status="filterModsProgress.status" size="small" />
                    <div v-if="filterModsInfo.totalMods > 0" class="tw:text-xs tw:text-gray-500 tw:mt-1">
                        {{ t('home.filter_mods_total') }}: {{ filterModsInfo.totalMods }}
                    </div>
                    <div v-if="filterModsInfo.modName" class="tw:text-xs tw:text-gray-600 tw:mt-1 tw:break-words">
                        {{ t('home.filter_mods_current') }}: {{ filterModsInfo.modName }}
                    </div>
                    <div v-if="filterModsInfo.status === 'completed'" class="tw:text-xs tw:text-green-600 tw:mt-1">
                        {{ t('home.filter_mods_completed', { filtered: filterModsInfo.filteredCount, moved: filterModsInfo.movedCount }) }}
                    </div>
                    <div v-if="filterModsInfo.status === 'error'" class="tw:text-xs tw:text-red-600 tw:mt-1 tw:break-words">
                        {{ t('home.filter_mods_error') }}: {{ filterModsInfo.error }}
                    </div>
                </div>
            </a-card>
        </div>
        
        <a-modal v-model:open="showTemplateModal" :title="t('home.template_select_title')" :footer="null" width="700px">
            <a-spin :spinning="loadingTemplates">
                <p class="tw:mb-4 tw:text-gray-600">{{ t('home.template_select_desc') }}</p>
                
                <div class="tw:max-h-96 tw:overflow-y-auto tw:pr-2">
                    <div class="tw:grid tw:grid-cols-2 tw:gap-3">
                        <div 
                            @click="selectTemplate('0')"
                            :class="[
                                'tw:p-3 tw:rounded-lg tw:cursor-pointer tw:border-2 tw:transition-all tw:tw:h-32 tw:flex tw:flex-col tw:justify-between',
                                selectedTemplate === '0' ? 'tw:border-blue-500 tw:bg-blue-50' : 'tw:border-gray-200 hover:tw:border-gray-300'
                            ]"
                        >
                            <div>
                                <h3 class="tw:text-base tw:font-semibold tw:mb-1">{{ t('home.template_official_loader') }}</h3>
                                <p class="tw:text-xs tw:text-gray-600 tw:line-clamp-2">{{ t('home.template_official_loader_desc') }}</p>
                            </div>
                        </div>
                        
                        <div 
                            v-for="template in templates" 
                            :key="template.id"
                            @click="selectTemplate(template.id)"
                            :class="[
                                'tw:p-3 tw:rounded-lg tw:cursor-pointer tw:border-2 tw:transition-all tw:h-32 tw:flex tw:flex-col tw:justify-between',
                                selectedTemplate === template.id ? 'tw:border-blue-500 tw:bg-blue-50' : 'tw:border-gray-200 hover:tw:border-gray-300'
                            ]"
                        >
                            <div class="tw:flex-1 tw:overflow-hidden">
                                <div class="tw:flex tw:justify-between tw:items-start tw:mb-1">
                                    <h3 class="tw:text-base tw:font-semibold tw:truncate tw:flex-1">{{ template.metadata.name }}</h3>
                                </div>
                                <p class="tw:text-xs tw:text-gray-600 tw:line-clamp-2 tw:mb-2">{{ template.metadata.description }}</p>
                            </div>
                            <div class="tw:flex tw:justify-between tw:text-xs tw:text-gray-500 tw:mt-1">
                                <span class="tw:truncate tw:max-w-[50%]">{{ template.metadata.author }}</span>
                                <a-tag color="blue" size="small" class="tw:text-xs tw:px-1 tw:py-0.5 tw:truncate tw:max-w-[45%]">{{ template.metadata.version }}</a-tag>
                            </div>
                        </div>
                    </div>
                    
                    <div v-if="templates.length === 0 && !loadingTemplates" class="tw:text-center tw:py-8 tw:text-gray-500">
                        {{ t('home.template_load_failed') }}
                    </div>
                </div>
            </a-spin>
        </a-modal>
    </div>

</template>