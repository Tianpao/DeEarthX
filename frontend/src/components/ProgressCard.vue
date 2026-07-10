<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

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

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

defineExpose({
    uploadProgress,
    unzipProgress,
    downloadProgress,
    serverInstallProgress,
    filterModsProgress,
    serverInstallInfo,
    filterModsInfo
});

watch(() => window.progressData, (newData) => {
    if (newData) {
        if (newData.uploadProgress) uploadProgress.value = newData.uploadProgress;
        if (newData.unzipProgress) unzipProgress.value = newData.unzipProgress;
        if (newData.downloadProgress) downloadProgress.value = newData.downloadProgress;
        if (newData.serverInstallProgress) serverInstallProgress.value = newData.serverInstallProgress;
        if (newData.filterModsProgress) filterModsProgress.value = newData.filterModsProgress;
        if (newData.serverInstallInfo) serverInstallInfo.value = newData.serverInstallInfo;
        if (newData.filterModsInfo) filterModsInfo.value = newData.filterModsInfo;
    }
}, { deep: true });
</script>

<template>
    <div class="tw:absolute tw:right-2 tw:bottom-32 tw:h-80 tw:w-64 tw:rounded-xl tw:overflow-y-auto">
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
</template>
