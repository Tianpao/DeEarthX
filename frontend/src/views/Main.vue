<script lang="ts" setup>
import { onMounted, computed, inject, watch, ref, nextTick } from 'vue';
import type { Ref } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { useTaskProcessor } from '@/composables/useTaskProcessor';
import { useProgressStore } from '@/stores/progress';
import FileSelector from '@/components/FileSelector.vue';

const { t } = useI18n();
const store = useProgressStore();

const {
    uploadDisabled,
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
    filterModsProgress,
    serverInstallProgress,
    processLogs,
    clearProcessLogs,
    startButtonDisabled,
    handleStartProcess,
    droppedFilePath,
    setDroppedFilePath,
    clearDroppedFilePath
} = useTaskProcessor();

const processLogEl = ref<HTMLElement | null>(null);

/** 当前大致步骤对应的细进度 0–100 */
const stepPercent = computed(() => {
    const step = currentStep.value;
    if (step <= 0) {
        // 解压 + 下载同属第一步：取两者均值，下载未开始时只用解压
        const unzip = unzipProgress.value.percent || 0;
        const download = downloadProgress.value.percent || 0;
        if (download > 0 || downloadProgress.value.status === 'success') {
            return Math.min(100, Math.round((unzip + download) / 2));
        }
        return Math.min(100, unzip);
    }
    if (step === 1) {
        return Math.min(100, filterModsProgress.value.percent || 0);
    }
    if (step === 2) {
        return Math.min(100, serverInstallProgress.value.percent || 0);
    }
    return 100;
});

const stepPercentLabel = computed(() => `${stepPercent.value}%`);

watch(processLogs, async () => {
    await nextTick();
    if (processLogEl.value) {
        processLogEl.value.scrollTop = processLogEl.value.scrollHeight;
    }
}, { deep: true });

function logLevelClass(level: string) {
    if (level === 'error') return 'log-error';
    if (level === 'warn') return 'log-warn';
    return 'log-info';
}

function shortLevel(level: string) {
    if (level === 'error') return '错误';
    if (level === 'warn') return '警告';
    return '信息';
}

const injectedDroppedFiles = inject<Ref<string[]>>("droppedFilePaths", ref<string[]>([]));
const clearDroppedFile = inject<(() => void) | undefined>("clearDroppedFile");

onMounted(() => {
    store.checkAndRestoreState();
});

const filePaths = computed({
    get: () => droppedFilePath.value ? [droppedFilePath.value] : [],
    set: (value) => {
        if (value.length > 0) {
            setDroppedFilePath(value[0]);
            uploadDisabled.value = true;
        } else {
            clearDroppedFilePath();
            uploadDisabled.value = false;
        }
    }
});

function handleFileRemove() {
    clearDroppedFilePath();
    uploadDisabled.value = false;
    if (clearDroppedFile) clearDroppedFile();
}

watch(injectedDroppedFiles, (paths) => {
    if (!paths || paths.length === 0) return;
    if (paths.length > 1) {
        message.warning(t('home.only_one_file'));
        return;
    }
    const firstPath = paths[0];
    const ext = firstPath.toLowerCase().substring(firstPath.lastIndexOf('.'));
    if (!['.zip', '.mrpack'].includes(ext)) {
        message.warning(t('home.only_zip_mrpack'));
        return;
    }
    filePaths.value = [firstPath];
    uploadDisabled.value = true;
});
</script>

<template>
    <div class="home-page" :class="{ 'is-processing': showSteps }">
        <section class="home-setup">
            <div class="home-brand">
                <h1 class="home-title">{{ t('common.app_name') }}</h1>
                <p class="home-subtitle">{{ t('home.title') }}</p>
            </div>

            <div class="home-upload">
                <FileSelector
                    :accept="['zip', 'mrpack']"
                    :multiple="false"
                    :disabled="uploadDisabled"
                    v-model:files="filePaths"
                    @remove="handleFileRemove"
                    :title="t('home.upload_title')"
                    :hint="t('home.upload_hint')"
                />
            </div>

            <div class="home-controls">
                <a-select
                    :options="modeOptions"
                    :value="selectedMode"
                    style="width: 120px;"
                    @select="handleModeSelect"
                />
                <a-button v-if="selectedMode === 'server'" @click="openTemplateModal">
                    {{ t('home.template_select_button') }}
                </a-button>
                <a-button
                    :disabled="startButtonDisabled"
                    type="primary"
                    @click="handleStartProcess"
                >
                    {{ t('common.start') }}
                </a-button>
            </div>

            <div v-if="selectedMode === 'server'" class="home-template-hint">
                {{ t('home.template_selected') }}: {{ currentTemplateName }}
            </div>
        </section>

        <section v-if="showSteps" class="home-progress">
            <div class="home-progress-pct">
                <span class="home-progress-pct-label">{{ stepPercentLabel }}</span>
                <div class="home-progress-pct-track">
                    <div class="home-progress-pct-fill" :style="{ width: stepPercent + '%' }" />
                </div>
            </div>
            <a-steps :current="currentStep" :items="stepItems" size="small" />
        </section>

        <section v-if="showSteps" class="home-log">
            <div class="home-log-head">
                <span>{{ t('home.process_log_title') }}</span>
                <button type="button" class="home-log-clear" @click="clearProcessLogs">
                    {{ t('home.process_log_clear') }}
                </button>
            </div>
            <div ref="processLogEl" class="home-log-body">
                <div v-if="processLogs.length === 0" class="home-log-empty">
                    {{ t('home.process_log_empty') }}
                </div>
                <div v-for="item in processLogs" :key="item.id" class="home-log-line">
                    <span class="home-log-time">{{ item.time }}</span>
                    <span class="home-log-level" :class="logLevelClass(item.level)">{{ shortLevel(item.level) }}</span>
                    <span class="home-log-msg" :class="logLevelClass(item.level)">{{ item.message }}</span>
                </div>
            </div>
        </section>

        <a-modal v-model:open="showTemplateModal" :title="t('home.template_select_title')" :footer="null" width="700px">
            <a-spin :spinning="loadingTemplates">
                <p class="tw:mb-4 tw:text-gray-600">{{ t('home.template_select_desc') }}</p>
                <div class="tw:max-h-96 tw:overflow-y-auto tw:pr-2">
                    <div class="tw:grid tw:grid-cols-2 tw:gap-3">
                        <div
                            @click="selectTemplate('0')"
                            :class="[
                                'tw:p-3 tw:rounded-lg tw:cursor-pointer tw:border-2 tw:transition-all tw:h-32 tw:flex tw:flex-col tw:justify-between',
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

<style scoped>
.home-page {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    padding: 1rem 1.25rem 1.25rem;
    box-sizing: border-box;
    overflow: hidden;
}

.home-setup {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1 1 auto;
    min-height: 0;
    gap: 0.75rem;
    transition:
        opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1),
        transform 0.55s cubic-bezier(0.22, 1, 0.36, 1),
        max-height 0.55s cubic-bezier(0.22, 1, 0.36, 1),
        margin 0.45s ease,
        padding 0.45s ease,
        flex 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}

.home-brand {
    text-align: center;
}

.home-title {
    margin: 0;
    font-size: 2.25rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    animation: home-pulse 2.4s ease-in-out infinite;
}

.home-subtitle {
    margin: 0.35rem 0 0;
    font-size: 0.875rem;
    color: #6b7280;
}

.home-upload {
    width: 100%;
    max-width: 28rem;
}

.home-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
}

.home-template-hint {
    font-size: 0.75rem;
    color: #6b7280;
}

/* 开始后：整块上移并消失 */
.home-page.is-processing .home-setup {
    flex: 0 0 auto;
    max-height: 0;
    margin: 0;
    padding: 0;
    gap: 0;
    opacity: 0;
    transform: translateY(-48px);
    pointer-events: none;
    overflow: hidden;
}

.home-page.is-processing .home-progress {
    margin-top: 0.25rem;
}

.home-progress {
    flex: 0 0 auto;
    width: 100%;
    max-width: 56rem;
    margin: 0.85rem auto 0.65rem;
    padding: 0.65rem 0.75rem;
    border-radius: 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    animation: home-fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.home-progress-pct {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.65rem;
}

.home-progress-pct-label {
    flex: 0 0 auto;
    min-width: 2.75rem;
    font-size: 0.9375rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: #0f172a;
    letter-spacing: 0.02em;
}

.home-progress-pct-track {
    flex: 1 1 auto;
    height: 6px;
    border-radius: 999px;
    background: #e2e8f0;
    overflow: hidden;
}

.home-progress-pct-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #0ea5e9, #10b981);
    transition: width 0.25s ease;
}

.home-log {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 56rem;
    margin: 0 auto;
    border-radius: 0.75rem;
    border: 1px solid #e2e8f0;
    background: #0f172a;
    overflow: hidden;
    animation: home-fade-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both;
}

.home-log-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.55rem 0.85rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
    color: #e2e8f0;
    font-size: 0.8125rem;
    font-weight: 500;
}

.home-log-clear {
    border: 0;
    background: transparent;
    color: #94a3b8;
    font-size: 0.75rem;
    cursor: pointer;
    padding: 0;
}

.home-log-clear:hover {
    color: #f8fafc;
}

.home-log-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 0.65rem 0.85rem 0.85rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.55;
}

.home-log-empty {
    color: #64748b;
    text-align: center;
    padding: 2rem 0;
}

.home-log-line {
    display: grid;
    grid-template-columns: 4.5rem 2.5rem 1fr;
    gap: 0.45rem;
    margin-bottom: 0.2rem;
    word-break: break-word;
}

.home-log-time {
    color: #64748b;
}

.home-log-level {
    font-weight: 600;
}

.home-log-msg {
    color: #cbd5e1;
}

.log-info {
    color: #93c5fd;
}

.log-warn {
    color: #fbbf24;
}

.log-error {
    color: #f87171;
}

@keyframes home-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.72; }
}

@keyframes home-fade-up {
    from {
        opacity: 0;
        transform: translateY(18px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
