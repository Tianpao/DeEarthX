<script lang="ts" setup>
import { inject, computed, watch } from 'vue';
import { InboxOutlined, CloseCircleOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { formatFileSize, formatTime } from '@/utils/format';
import { useTaskProcessor } from '@/composables/useTaskProcessor';

const { t } = useI18n();
const droppedFilePaths = inject<ReturnType<typeof import('@/composables/useDragDrop').useDragDrop>['droppedFilePaths']>('droppedFilePaths');
const clearDroppedFile = inject<(() => void) | undefined>('clearDroppedFile');

const {
    uploadedFiles,
    uploadDisabled,
    beforeUpload,
    handleFileChange,
    handleFileDrop,
    selectedMode,
    modeOptions,
    handleModeSelect,
    showTemplateModal,
    templates,
    loadingTemplates,
    selectedTemplate,
    currentTemplateName,
    openTemplateModal,
    selectTemplate,
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
    startButtonDisabled,
    handleStartProcess
} = useTaskProcessor();

// 主页只接受 .zip/.mrpack，取第一个文件
const validDroppedFile = computed(() => {
    if (droppedFilePaths && 'value' in droppedFilePaths && droppedFilePaths.value.length > 0) {
        const validExtensions = ['.zip', '.mrpack'];
        const path = droppedFilePaths.value[0];
        const ext = path.toLowerCase().substring(path.lastIndexOf('.'));
        if (validExtensions.includes(ext)) {
            return path;
        }
    }
    return null;
});

const hasDroppedFile = computed(() => validDroppedFile.value !== null);
const droppedFileName = computed(() => {
    if (validDroppedFile.value) {
        const path = validDroppedFile.value;
        return path.substring(Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/')) + 1);
    }
    return '';
});

// 监听拖放，无效文件时提示
watch(() => droppedFilePaths && 'value' in droppedFilePaths ? droppedFilePaths.value : [], (paths) => {
    if (paths.length > 0) {
        // 主页只允许拖入一个文件
        if (paths.length > 1) {
            message.warning(t('home.only_one_file'));
            if (clearDroppedFile) {
                clearDroppedFile();
            }
            return;
        }
        const validExtensions = ['.zip', '.mrpack'];
        const firstPath = paths[0];
        const ext = firstPath.toLowerCase().substring(firstPath.lastIndexOf('.'));
        if (!validExtensions.includes(ext)) {
            message.warning(t('home.only_zip_mrpack'));
            if (clearDroppedFile) {
                clearDroppedFile();
            }
        }
    }
});

function handleClearDroppedFile() {
    if (clearDroppedFile) {
        clearDroppedFile();
    }
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
                <div v-if="hasDroppedFile" class="tw:w-full tw:max-w-md tw:mt-2 tw:p-2 tw:bg-green-50 tw:rounded-lg tw:border tw:border-green-200">
                    <div class="tw:flex tw:items-center tw:justify-between">
                        <span class="tw:text-green-600 tw:text-sm tw:truncate">{{ t('home.file_dropped', { name: droppedFileName }) }}</span>
                        <a-button type="text" size="small" @click="handleClearDroppedFile" class="tw:text-gray-400 hover:tw:text-red-500">
                            <template #icon><CloseCircleOutlined /></template>
                        </a-button>
                    </div>
                </div>
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