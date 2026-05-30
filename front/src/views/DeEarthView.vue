<script lang="ts" setup>
import { ref, onUnmounted } from 'vue';
import { message } from 'ant-design-vue';
import { FileSearchOutlined, FolderOpenOutlined } from '@ant-design/icons-vue';
import { open } from '@tauri-apps/plugin-dialog';
import axiosInstance from '@/utils/axios';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

interface ModCheckResult {
    filename: string;
    filePath: string;
    clientSide: 'required' | 'optional' | 'unsupported' | 'unknown';
    serverSide: 'required' | 'optional' | 'unsupported' | 'unknown';
    source: string;
    checked: boolean;
    errors?: string[];
    allResults: any[];
}

const selectedFolder = ref<string>('');
const bundleName = ref<string>('');
const checking = ref(false);
const results = ref<ModCheckResult[]>([]);
const showResults = ref(false);
const progress = ref({ current: 0, total: 0, percent: 0, modName: '' });
const showProgress = ref(false);

let socket: Socket | null = null;

onUnmounted(() => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
});

async function selectFolder() {
    try {
        const selected = await open({
            directory: true,
            multiple: false,
            title: '选择 mods 文件夹'
        });

        if (selected) {
            selectedFolder.value = selected;
            message.success(`已选择文件夹: ${selected}`);
        }
    } catch (error) {
        console.error('选择文件夹失败:', error);
        message.error('选择文件夹失败');
    }
}

async function handleCheck() {
    if (!selectedFolder.value) {
        message.warning('请先选择 mods 文件夹');
        return;
    }

    if (!bundleName.value.trim()) {
        message.warning('请输入整合包名字');
        return;
    }

    checking.value = true;
    showResults.value = false;
    showProgress.value = false;
    results.value = [];

    // 连接 Socket.IO
    const wsHost = import.meta.env.VITE_WS_HOST || 'localhost';
    const wsPort = import.meta.env.VITE_WS_PORT || '37019';
    socket = io(`${wsHost}:${wsPort}/`, {
        autoConnect: false,
        reconnection: false
    });

    socket.on('connect', async () => {
        console.log('Socket.IO 已连接');
        try {
            const response = await axiosInstance.post('/modcheck/folder',{
                folderPath: selectedFolder.value,
                bundleName: bundleName.value.trim()
            });

            if (response.status !== 200) {
                const errorData = response.data;
                throw new Error(errorData.message || `请求失败: ${response.status}`);
            }
            // 任务已提交，等待 Socket.IO 事件
        } catch (error: any) {
            console.error('检查失败:', error);
            message.error(`检查失败: ${error.message}`);
            checking.value = false;
            socket?.disconnect();
        }
    });

    socket.on('modcheck_start', (data: any) => {
        console.log('开始检查:', data);
        showProgress.value = true;
        message.loading({ content: data.message || '开始检查模组...', key: 'modcheck', duration: 0 });
    });

    socket.on('modcheck_progress', (data: any) => {
        progress.value = {
            current: data.current,
            total: data.total,
            percent: data.percent || Math.round((data.current / data.total) * 100),
            modName: data.modName
        };
    });

    socket.on('modcheck_complete', (data: any) => {
        message.destroy('modcheck');
        message.success(`检查完成，共检查 ${data.results.length} 个模组，筛选出 ${data.filteredCount} 个客户端模组`);
        results.value = data.results;
        showResults.value = true;
        showProgress.value = false;
        checking.value = false;
        socket?.disconnect();
    });

    socket.on('modcheck_error', (data: any) => {
        message.destroy('modcheck');
        message.error(`检查失败: ${data.error}`);
        checking.value = false;
        showProgress.value = false;
        socket?.disconnect();
    });

    socket.on('disconnect', () => {
        console.log('Socket.IO 连接关闭');
    });

    socket.on('error', (error: any) => {
        console.error('Socket.IO 错误:', error);
        message.destroy('modcheck');
        message.error('连接错误');
        checking.value = false;
        showProgress.value = false;
    });

    socket.connect();
}
</script>

<template>
    <div class="tw:h-full tw:w-full tw:flex tw:flex-col tw:p-4 md:tw:p-6 tw:overflow-auto">
        <div class="tw:mb-4 md:tw:mb-6">
            <h1 class="tw:text-xl md:tw:text-2xl tw:font-bold tw:mb-2">模组检查</h1>
            <p class="tw:text-gray-500 tw:text-sm md:tw:text-base">检查模组是否可以在客户端或服务端使用</p>
        </div>

        <a-card class="tw:mb-4 md:tw:mb-6">
            <div class="tw:mb-4">
                <a-button 
                    type="default" 
                    size="large" 
                    block 
                    @click="selectFolder"
                    class="tw:mb-4"
                >
                    <template #icon>
                        <FolderOpenOutlined />
                    </template>
                    选择 mods 文件夹
                </a-button>
                <div v-if="selectedFolder" class="tw:mb-4 tw:p-3 tw:bg-gray-50 tw:rounded tw:text-sm tw:text-gray-600">
                    <span class="tw:font-medium">已选择:</span> {{ selectedFolder }}
                </div>
            </div>

            <div class="tw:mb-4">
                <a-input
                    v-model:value="bundleName"
                    placeholder="请输入整合包名字"
                    size="large"
                    allow-clear
                />
                <div class="tw:mt-2 tw:text-xs tw:text-gray-400">
                    客户端模组将保存到 .rubbish/{{ bundleName || '整合包名字' }} 目录
                </div>
            </div>

            <a-button
                type="primary"
                size="large"
                :loading="checking"
                block
                @click="handleCheck"
                :disabled="checking || !selectedFolder || !bundleName.trim()"
            >
                <template #icon>
                    <FileSearchOutlined />
                </template>
                {{ checking ? '检查中...' : '开始检查' }}
            </a-button>
        </a-card>

        <!-- 进度显示 -->
        <a-card v-if="showProgress && checking" class="tw:mb-4">
            <a-progress
                :percent="progress.percent"
                :status="progress.percent === 100 ? 'success' : 'active'"
            />
            <div class="tw:text-sm tw:text-gray-500 tw:mt-2">
                正在处理: {{ progress.modName }} ({{ progress.current }} / {{ progress.total }})
            </div>
        </a-card>

        <a-card v-if="showResults" title="检查结果">
            <div class="tw:overflow-x-auto">
                <a-table 
                    :dataSource="results" 
                    :pagination="false" 
                    :scroll="{ y: 300, x: 'max-content' }" 
                    size="small"
                    :bordered="true"
                >
                    <a-table-column title="模组信息" key="modInfo" :width="250">
                        <template #default="{ record }">
                            <div class="tw:overflow-hidden tw:flex-1 tw:min-w-0">
                                <div class="tw:font-medium tw:truncate tw:text-sm md:tw:text-base">{{ record.filename }}</div>
                            </div>
                        </template>
                    </a-table-column>
                    <a-table-column title="类型" key="type" :width="100">
                        <template #default="{ record }">
                            <a-tag v-if="record.clientSide === 'required' || record.clientSide === 'optional'" color="purple">
                                客户端模组
                            </a-tag>
                            <a-tag v-else-if="record.serverSide === 'required' || record.serverSide === 'optional'" color="blue">
                                服务端模组
                            </a-tag>
                            <a-tag v-else color="gray">
                                未知
                            </a-tag>
                        </template>
                    </a-table-column>
                </a-table>
            </div>
        </a-card>

        <a-empty v-if="showResults && results.length === 0" description="未找到模组文件" />
    </div>
</template>
