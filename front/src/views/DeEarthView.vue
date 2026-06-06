<script lang="ts" setup>
import { ref, onUnmounted } from 'vue';
import { message } from 'ant-design-vue';
import { FileSearchOutlined, FolderOpenOutlined } from '@ant-design/icons-vue';
import { open } from '@tauri-apps/plugin-dialog';
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

    if (socket) {
        socket.disconnect();
        socket = null;
    }

    checking.value = true;
    showResults.value = false;
    showProgress.value = false;
    results.value = [];

    const wsHost = import.meta.env.VITE_WS_HOST || 'localhost';
    const wsPort = import.meta.env.VITE_WS_PORT || '37019';
    socket = io(`${wsHost}:${wsPort}/`, {
        autoConnect: false,
        reconnection: false,
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        console.log('Socket.IO 已连接');
        socket!.emit('modcheck:start', {
            folderPath: selectedFolder.value,
            bundleName: bundleName.value.trim()
        });
    });

    socket.on('modcheck_start', (data: any) => {
        console.log('开始检查:', data);
        showProgress.value = true;
        progress.value = {
            current: 0,
            total: data.totalMods || 0,
            percent: 0,
            modName: ''
        };
    });

    socket.on('modcheck_progress', (data: any) => {
        const percent = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
        progress.value = {
            current: data.current,
            total: data.total,
            percent,
            modName: data.modName
        };
    });

    socket.on('modcheck_complete', (data: any) => {
        message.success(`检查完成，共检查 ${data.results.length} 个模组，筛选出 ${data.filteredCount} 个客户端模组`);
        results.value = data.results;
        showResults.value = true;
        showProgress.value = false;
        checking.value = false;
        socket?.disconnect();
    });

    socket.on('modcheck_error', (data: any) => {
        message.error(`检查失败: ${data.error}`);
        checking.value = false;
        showProgress.value = false;
        socket?.disconnect();
    });

    socket.on('disconnect', () => {
        console.log('Socket.IO 连接关闭');
    });

    socket.on('connect_error', (error: any) => {
        console.error('Socket.IO 连接错误:', error);
        message.error('连接错误');
        checking.value = false;
        showProgress.value = false;
    });

    socket.connect();
}
</script>

<template>
    <div class="tw:h-full tw:w-full tw:overflow-y-auto tw:p-6">
        <div class="tw:mx-auto tw:flex tw:w-full tw:max-w-5xl tw:flex-col tw:gap-6">
            <div>
                <h1 class="tw:text-2xl tw:font-semibold tw:text-slate-900">模组检查</h1>
                <p class="tw:mt-1 tw:text-sm tw:text-slate-500">检查模组是否适合客户端或服务端环境，并整理筛选结果。</p>
            </div>

            <section class="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:shadow-sm">
                <div class="tw:grid tw:gap-4 lg:tw:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div class="tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-4">
                        <div class="tw:mb-3 tw:text-sm tw:font-medium tw:text-slate-800">选择 mods 文件夹</div>
                        <a-button
                            type="default"
                            size="large"
                            block
                            @click="selectFolder"
                        >
                            <template #icon>
                                <FolderOpenOutlined />
                            </template>
                            选择 mods 文件夹
                        </a-button>
                        <div v-if="selectedFolder" class="tw:mt-3 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-white tw:p-3 tw:text-sm tw:text-slate-600">
                            <span class="tw:font-medium">已选择:</span> {{ selectedFolder }}
                        </div>
                    </div>

                    <div class="tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-4">
                        <div class="tw:mb-3 tw:text-sm tw:font-medium tw:text-slate-800">整合包信息</div>
                        <a-input
                            v-model:value="bundleName"
                            placeholder="请输入整合包名字"
                            size="large"
                            allow-clear
                        />
                        <div class="tw:mt-2 tw:text-xs tw:text-slate-400">
                            客户端模组将保存到 .rubbish/{{ bundleName || '整合包名字' }} 目录
                        </div>
                    </div>
                </div>

                <div class="tw:mt-4 tw:flex tw:flex-wrap tw:gap-3">
                    <a-button
                        type="primary"
                        size="large"
                        :loading="checking"
                        @click="handleCheck"
                        :disabled="checking || !selectedFolder || !bundleName.trim()"
                    >
                        <template #icon>
                            <FileSearchOutlined />
                        </template>
                        {{ checking ? '检查中...' : '开始检查' }}
                    </a-button>
                </div>
            </section>

            <section v-if="showProgress && checking" class="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:shadow-sm">
                <div class="tw:mb-3 tw:text-sm tw:font-medium tw:text-slate-800">检查进度</div>
                <a-progress
                    :percent="progress.percent"
                    :status="progress.percent === 100 ? 'success' : 'active'"
                />
                <div class="tw:mt-2 tw:text-sm tw:text-slate-500">
                    正在处理: {{ progress.modName }} ({{ progress.current }} / {{ progress.total }})
                </div>
            </section>

            <section v-if="showResults" class="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:shadow-sm">
                <div class="tw:mb-4 tw:flex tw:flex-col tw:gap-1 md:tw:flex-row md:tw:items-end md:tw:justify-between">
                    <div>
                        <h2 class="tw:text-lg tw:font-semibold tw:text-slate-900">检查结果</h2>
                        <p class="tw:text-sm tw:text-slate-500">已完成的模组分类与筛选结果。</p>
                    </div>
                </div>

                <div v-if="results.length > 0" class="tw:overflow-x-auto">
                    <a-table
                        :dataSource="results"
                        :pagination="false"
                        :scroll="{ y: 320, x: 'max-content' }"
                        size="small"
                        :bordered="true"
                    >
                        <a-table-column title="模组信息" key="modInfo" :width="280">
                            <template #default="{ record }">
                                <div class="tw:min-w-0 tw:overflow-hidden">
                                    <div class="tw:truncate tw:text-sm tw:font-medium tw:text-slate-800">{{ record.filename }}</div>
                                </div>
                            </template>
                        </a-table-column>
                        <a-table-column title="类型" key="type" :width="120">
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

                <a-empty v-else description="未找到模组文件" />
            </section>
        </div>
    </div>
</template>
