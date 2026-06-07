<script lang="ts" setup>
import { ref, onUnmounted } from 'vue';
import { message } from 'ant-design-vue';
import { FileSearchOutlined, FolderOpenOutlined } from '@ant-design/icons-vue';
import { open } from '@tauri-apps/plugin-dialog';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

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
            title: t('deearth.select_folder_title')
        });

        if (selected) {
            selectedFolder.value = selected;
            message.success(t('deearth.select_folder_success', { path: selected }));
        }
    } catch (error) {
        console.error('选择文件夹失败:', error);
        message.error(t('deearth.select_folder_failed'));
    }
}

async function handleCheck() {
    if (!selectedFolder.value) {
        message.warning(t('deearth.please_select_folder'));
        return;
    }

    if (!bundleName.value.trim()) {
        message.warning(t('deearth.please_enter_name'));
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
        message.success(t('deearth.check_complete', { total: data.results.length, filtered: data.filteredCount }));
        results.value = data.results;
        showResults.value = true;
        showProgress.value = false;
        checking.value = false;
        socket?.disconnect();
    });

    socket.on('modcheck_error', (data: any) => {
        message.error(t('deearth.check_failed', { error: data.error }));
        checking.value = false;
        showProgress.value = false;
        socket?.disconnect();
    });

    socket.on('disconnect', () => {
        console.log('Socket.IO 连接关闭');
    });

    socket.on('connect_error', (error: any) => {
        console.error('Socket.IO 连接错误:', error);
        message.error(t('deearth.connect_error'));
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
                <h1 class="tw:text-2xl tw:font-semibold tw:text-slate-900">{{ t('deearth.title') }}</h1>
                <p class="tw:mt-1 tw:text-sm tw:text-slate-500">{{ t('deearth.subtitle') }}</p>
            </div>

            <section class="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:shadow-sm">
                <div class="tw:grid tw:gap-4 lg:tw:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div class="tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-4">
                        <div class="tw:mb-3 tw:text-sm tw:font-medium tw:text-slate-800">{{ t('deearth.select_mods_folder') }}</div>
                        <a-button
                            type="default"
                            size="large"
                            block
                            @click="selectFolder"
                        >
                            <template #icon>
                                <FolderOpenOutlined />
                            </template>
                            {{ t('deearth.select_mods_folder') }}
                        </a-button>
                        <div v-if="selectedFolder" class="tw:mt-3 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-white tw:p-3 tw:text-sm tw:text-slate-600">
                            <span class="tw:font-medium">{{ t('deearth.selected') }}:</span> {{ selectedFolder }}
                        </div>
                    </div>

                    <div class="tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-4">
                        <div class="tw:mb-3 tw:text-sm tw:font-medium tw:text-slate-800">{{ t('deearth.bundle_info') }}</div>
                        <a-input
                            v-model:value="bundleName"
                            :placeholder="t('deearth.bundle_name_placeholder')"
                            size="large"
                            allow-clear
                        />
                        <div class="tw:mt-2 tw:text-xs tw:text-slate-400">
                            {{ t('deearth.bundle_name_hint', { name: bundleName || t('deearth.bundle_name_placeholder') }) }}
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
                        {{ checking ? t('deearth.checking') : t('deearth.start_check') }}
                    </a-button>
                </div>
            </section>

            <section v-if="showProgress && checking" class="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:shadow-sm">
                <div class="tw:mb-3 tw:text-sm tw:font-medium tw:text-slate-800">{{ t('deearth.check_progress') }}</div>
                <a-progress
                    :percent="progress.percent"
                    :status="progress.percent === 100 ? 'success' : 'active'"
                />
                <div class="tw:mt-2 tw:text-sm tw:text-slate-500">
                    {{ t('deearth.processing', { name: progress.modName, current: progress.current, total: progress.total }) }}
                </div>
            </section>

            <section v-if="showResults" class="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:shadow-sm">
                <div class="tw:mb-4 tw:flex tw:flex-col tw:gap-1 md:tw:flex-row md:tw:items-end md:tw:justify-between">
                    <div>
                        <h2 class="tw:text-lg tw:font-semibold tw:text-slate-900">{{ t('deearth.check_results') }}</h2>
                        <p class="tw:text-sm tw:text-slate-500">{{ t('deearth.check_results_desc') }}</p>
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
                        <a-table-column :title="t('deearth.mod_info')" key="modInfo" :width="280">
                            <template #default="{ record }">
                                <div class="tw:min-w-0 tw:overflow-hidden">
                                    <div class="tw:truncate tw:text-sm tw:font-medium tw:text-slate-800">{{ record.filename }}</div>
                                </div>
                            </template>
                        </a-table-column>
                        <a-table-column :title="t('deearth.mod_type')" key="type" :width="120">
                            <template #default="{ record }">
                                <a-tag v-if="record.clientSide === 'required' || record.clientSide === 'optional'" color="purple">
                                    {{ t('deearth.client_mod') }}
                                </a-tag>
                                <a-tag v-else-if="record.serverSide === 'required' || record.serverSide === 'optional'" color="blue">
                                    {{ t('deearth.server_mod') }}
                                </a-tag>
                                <a-tag v-else color="gray">
                                    {{ t('deearth.unknown') }}
                                </a-tag>
                            </template>
                        </a-table-column>
                    </a-table>
                </div>

                <a-empty v-else :description="t('deearth.no_mods_found')" />
            </section>
        </div>
    </div>
</template>