import { inject } from 'vue';
import { storeToRefs } from 'pinia';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { Events } from '@wailsio/runtime';
import { DexService } from '@/bindings/deearthx/core/services';
import { useProgressStore } from '@/stores/progress';
import { useErrorHandler } from '@/composables/useErrorHandler';

let listenersSetup = false;

function setupWailsListeners(store: ReturnType<typeof useProgressStore>, t: (key: string, args?: any) => string) {
    if (listenersSetup) return;
    listenersSetup = true;

    const handleError = (ctx: ReturnType<typeof useErrorHandler>) => ctx.handleError;

    Events.On("unzip", (data: any) => {
        store.updateUnzipProgress(data);
    });

    Events.On("downloading", (data: any) => {
        store.updateDownloadProgress(data);
    });

    Events.On("changed", () => {
        store.incrementStep();
    });

    Events.On("finish", (data: any) => {
        const time = Math.round((data?.duration || 0) / 1000);
        store.incrementStep();
        if (store.selectedMode === 'server') {
            const info = store.serverInstallInfo;
            if (info.installPath) {
                message.success(t('home.server_install_completed') + ` ${t('home.server_install_duration')}: ${time}s`);
            } else {
                message.success(t('home.production_complete', { time }));
            }
        } else {
            message.success(t('home.production_complete', { time }));
        }
        store.completeTask();
    });

    Events.On("error", (error: any) => {
        const ctx = useErrorHandler();
        ctx.handleError(error);
        store.resetState();
    });

    Events.On("server_install_start", (data: any) => {
        store.handleServerInstallStart(data);
    });

    Events.On("server_install_step", (data: any) => {
        store.handleServerInstallStep(data);
    });

    Events.On("server_install_progress", (data: any) => {
        store.handleServerInstallProgress(data);
    });

    Events.On("server_install_complete", (data: any) => {
        store.handleServerInstallComplete(data);
    });

    Events.On("filter_mods_start", (data: any) => {
        store.handleFilterModsStart(data);
    });

    Events.On("filter_mods_progress", (data: any) => {
        store.handleFilterModsProgress(data);
    });

    Events.On("filter_mods_complete", (data: any) => {
        store.handleFilterModsComplete(data);
        const timeSpent = Math.round(data.duration / 1000);
        message.success(t('home.filter_mods_completed', { filtered: data.filteredCount, moved: data.movedCount }) + ` ${t('home.server_install_duration')}: ${timeSpent}s`);
    });
}

export function useTaskProcessor() {
    const { t } = useI18n();
    const store = useProgressStore();
    const {
        uploadDisabled,
        droppedFilePath,
        javaAvailable,
        selectedMode,
        showTemplateModal,
        templates,
        loadingTemplates,
        selectedTemplate,
        currentTemplateName,
        showSteps,
        currentStep,
        unzipProgress,
        downloadProgress,
        uploadProgress,
        serverInstallProgress,
        filterModsProgress,
        serverInstallInfo,
        filterModsInfo,
        startTime,
        startButtonDisabled
    } = storeToRefs(store);

    const killCoreProcess = inject<(() => void) | undefined>("killCoreProcess");
    const clearDroppedFile = inject<(() => void) | undefined>('clearDroppedFile');

    // Set up Wails event listeners once
    setupWailsListeners(store, t as any);

    function resetState() {
        store.resetState();
        if (clearDroppedFile) clearDroppedFile();
        if (killCoreProcess && typeof killCoreProcess === 'function') {
            killCoreProcess();
        }
    }

    function handleStartProcess() {
        const actualPath = store.getActualFilePath();

        if (!actualPath) {
            message.warning(t('home.please_select_file'));
            return;
        }

        store.startTask();

        DexService.StartTaskFromPath(
            actualPath,
            store.selectedMode,
            store.selectedMode === 'server' && store.selectedTemplate !== '0'
                ? store.selectedTemplate
                : ''
        );
    }

    return {
        uploadDisabled,
        droppedFilePath,
        setDroppedFilePath: store.setDroppedFilePath,
        clearDroppedFilePath: store.clearDroppedFilePath,
        javaAvailable,
        selectedMode,
        modeOptions: store.modeOptions,
        handleModeSelect: store.handleModeSelect,
        showTemplateModal,
        templates,
        loadingTemplates,
        selectedTemplate,
        currentTemplateName,
        loadTemplates: store.loadTemplates,
        openTemplateModal: store.openTemplateModal,
        selectTemplate: store.selectTemplate,
        showSteps,
        currentStep,
        stepItems: store.stepItems,
        unzipProgress,
        downloadProgress,
        uploadProgress,
        serverInstallProgress,
        filterModsProgress,
        serverInstallInfo,
        filterModsInfo,
        startTime,
        startButtonDisabled,
        handleStartProcess
    };
}
