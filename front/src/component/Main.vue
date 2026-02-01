<script lang="ts" setup>
import { inject, ref, watch } from 'vue';
import { InboxOutlined } from '@ant-design/icons-vue';
import { message, notification, StepsProps } from 'ant-design-vue';
import type { UploadFile, UploadChangeParam } from 'ant-design-vue';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { SelectProps } from 'ant-design-vue/es/vc-select';

// WebSocket消息类型接口
interface WebSocketMessage {
    status: 'unzip' | 'finish' | 'changed' | 'downloading' | 'error';
    result: any;
}

// 进度步骤配置
const showSteps = ref(false);
const currentStep = ref(0);
const stepItems: StepsProps['items'] = [
    { title: '解压整合包', description: '解压内容并下载文件' },
    { title: '筛选模组', description: 'DeEarthX的核心功能' },
    { title: '下载服务端', description: '安装模组加载器服务端' },
    { title: '完成', description: '一切就绪！' }
];

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
    if (!info.file.name?.endsWith('.zip') && !info.file.name?.endsWith('.mrpack')) {
        message.error('只能上传.zip和.mrpack文件');
        return;
    }
    uploadDisabled.value = true;
}

// 处理文件拖拽（预留功能）
function handleFileDrop(e: DragEvent) {
    console.log(e);
}

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
const modeOptions: SelectProps['options'] = [
    { label: '开服模式', value: 'server', disabled: !javaAvailable.value },
    { label: '上传模式', value: 'upload', disabled: false }
];
const selectedMode = ref(javaAvailable.value ? 'server' : 'upload');

// 监听Java可用性变化，更新模式选项
watch(javaAvailable, (newValue) => {
    modeOptions[0].disabled = !newValue;
    if (!newValue && selectedMode.value === 'server') {
        selectedMode.value = 'upload';
    }
});

// 处理模式选择
function handleModeSelect(value: string) {
    selectedMode.value = value;
}

// 进度显示相关
interface ProgressStatus {
    status: 'active' | 'success' | 'exception' | 'normal';
    percent: number;
    display: boolean;
}
const unzipProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: true });
const downloadProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: true });

// 运行DeEarthX核心功能
async function runDeEarthX(file: Blob) {
    message.success('开始制作，请勿切换菜单！');

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`http://localhost:37019/start?mode=${selectedMode.value}`, {
            method: 'POST',
            body: formData
        });
        await response.json();
        setupWebSocket();
    } catch (error) {
        console.error('请求失败:', error);
        message.error('请求后端服务失败');
        resetState();
    }
}

// 设置WebSocket连接
function setupWebSocket() {
    const ws = new WebSocket('ws://localhost:37019/');

    ws.addEventListener('message', (event) => {
        try {
            const data = JSON.parse(event.data) as WebSocketMessage;

            // 处理不同状态的消息
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
            }
        } catch (error) {
            console.error('解析WebSocket消息失败:', error);
            notification.error({ message: '错误', description: '解析服务器消息失败' });
        }
    });

    ws.addEventListener('error', () => {
        notification.error({ message: '错误', description: 'WebSocket连接失败' });
        resetState();
    });
}

// 处理错误消息
function handleError(result: any) {
    if (result === 'jini') {
        javaAvailable.value = false;
        message.error('未在系统变量中找到Java！请安装Java，否则开服模式将无法使用！');
    } else {
        notification.error({
            message: 'DeEarthX.Core 遇到致命错误！',
            description: `请将整个窗口截图发在群里\n错误信息：${result}`
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
    message.success(`服务端制作完成！共用时${timeSpent}秒！`);
    sendNotification({ title: 'DeEarthX V3', body: `服务端制作完成！共用时${timeSpent}秒！` });

    // 8秒后自动重置状态
    setTimeout(resetState, 8000);
}

// 开始处理文件
function handleStartProcess() {
    if (uploadedFiles.value.length === 0) {
        message.warning('请先拖拽或选择文件');
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
                    <h1 class="tw:text-4xl tw:text-center tw:animate-pulse">DeEarthX</h1>
                    <h1 class="tw:text-sm tw:text-gray-500 tw:text-center">让开服变成随时随地的事情！</h1>
                </div>
                <a-upload-dragger :disabled="uploadDisabled" class="tw:w-full tw:max-w-md tw:h-48" name="file"
                    action="/" :multiple="false" :before-upload="beforeUpload" @change="handleFileChange"
                    @drop="handleFileDrop" v-model:fileList="uploadedFiles" accept=".zip,.mrpack">
                    <p class="ant-upload-drag-icon">
                        <inbox-outlined></inbox-outlined>
                    </p>
                    <p class="ant-upload-text">拖拽或点击以上传文件</p>
                    <p class="ant-upload-hint">
                        请使用.zip（CurseForge、MCBBS）和.mrpack（Modrinth）文件
                    </p>
                    <p class="ant-upload-hint">
                        PCL导出的zip整合包请拖拽里面的modpack.mrpack至DeX
                    </p>
                </a-upload-dragger>
                <a-select ref="select" :options="modeOptions" :value="selectedMode"
                    style="width: 120px;margin-top: 32px" @select="handleModeSelect"></a-select>
                <a-button :disabled="startButtonDisabled" type="primary" @click="handleStartProcess"
                    style="margin-top: 6px">
                    开始
                </a-button>
            </div>
        </div>
        <div v-if="showSteps"
            class="tw:fixed tw:bottom-2 tw:left-1/2 tw:-translate-x-1/2 tw:w-full tw:max-w-3xl tw:h-16 tw:flex tw:justify-center tw:items-center tw:text-sm">
            <a-steps :current="currentStep" :items="stepItems" />
        </div>
        <div v-if="showSteps" ref="logContainer"
            class="tw:absolute tw:right-2 tw:bottom-20 tw:h-80 tw:w-64 tw:rounded-xl tw:overflow-y-auto">
            <a-card title="制作进度" :bordered="true" class="tw:h-full">
                <div v-if="unzipProgress.display">
                    <h1 class="tw:text-sm">解压进度</h1>
                    <a-progress :percent="unzipProgress.percent" :status="unzipProgress.status" size="small" />
                </div>
                <div v-if="downloadProgress.display">
                    <h1 class="tw:text-sm">下载进度</h1>
                    <a-progress :percent="downloadProgress.percent" :status="downloadProgress.status" size="small" />
                </div>
            </a-card>
        </div>
    </div>

</template>