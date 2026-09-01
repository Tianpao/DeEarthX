import { inject } from 'vue';
import { storeToRefs } from 'pinia';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { Events } from '@wailsio/runtime';
import { DexService } from '@/bindings/deearthx/core/services';
import { useProgressStore } from '@/stores/progress';
import { useErrorHandler } from '@/composables/useErrorHandler';
import { eventData } from '@/utils/wailsEvent';

let listenersSetup = false;

function setupWailsListeners(store: ReturnType<typeof useProgressStore>, t: (key: string, args?: any) => string) {
    if (listenersSetup) return;
    listenersSetup = true;

    Events.On("unzip", (ev: any) => {
        store.updateUnzipProgress(eventData(ev));
    });

    Events.On("downloading", (ev: any) => {
        store.updateDownloadProgress(eventData(ev));
    });

    Events.On("changed", () => {
        store.incrementStep();
    });

    Events.On("finish", (ev: any) => {
        const data = eventData<{ duration?: number }>(ev);
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

    Events.On("error", (ev: any) => {
        const data = eventData<{ message?: string } | string>(ev);
        const ctx = useErrorHandler();
        const msg = typeof data === 'string' ? data : (data?.message || String(data));
        ctx.handleError(msg);
        store.resetState();
    });

    Events.On("server_install_start", (ev: any) => {
        store.handleServerInstallStart(eventData(ev));
    });

    Events.On("server_install_step", (ev: any) => {
        store.handleServerInstallStep(eventData(ev));
    });

    Events.On("server_install_progress", (ev: any) => {
        store.handleServerInstallProgress(eventData(ev));
    });

    Events.On("server_install_complete", (ev: any) => {
        store.handleServerInstallComplete(eventData(ev));
    });

    Events.On("filter_mods_start", (ev: any) => {
        store.handleFilterModsStart(eventData(ev));
    });

    Events.On("filter_mods_progress", (ev: any) => {
        store.handleFilterModsProgress(eventData(ev));
    });

    Events.On("filter_mods_complete", (ev: any) => {
        const data = eventData(ev);
        store.handleFilterModsComplete(data);
        const timeSpent = Math.round((data.duration || 0) / 1000);
        const filtered = data.filteredCount ?? data.clientMods ?? 0;
        const moved = data.movedCount ?? data.success ?? 0;
        message.success(t('home.filter_mods_completed', { filtered, moved }) + ` ${t('home.server_install_duration')}: ${timeSpent}s`);
    });

    Events.On("info", (ev: any) => {
        const data = eventData<{ level?: string; message?: string; time?: string } | string>(ev);
        if (typeof data === 'string') {
            store.appendProcessLog(data);
            return;
        }
        store.appendProcessLog({
            level: data?.level || 'info',
            message: data?.message || '',
            time: data?.time,
        });
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
        processLogs,
        startTime,
        startButtonDisabled
    } = storeToRefs(store);

    const killCoreProcess = inject<(() => void) | undefined>("killCoreProcess");
    const clearDroppedFile = inject<(() => void) | undefined>('clearDroppedFile');

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
        processLogs,
        clearProcessLogs: store.clearProcessLogs,
        startTime,
        startButtonDisabled,
        handleStartProcess
    };
}
