import { onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { Events } from '@wailsio/runtime';
import { useProgressStore } from '@/stores/progress';
import { useErrorHandler } from '@/composables/useErrorHandler';
import * as ModpackService from '&/dex/backend/download/modpackservice';

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

    const { handleError } = useErrorHandler();

    // Event listener cleanup functions
    const cleanups: (() => void)[] = [];

    function resetState() {
        store.resetState();
    }

    async function handleStartProcess() {
        const actualPath = store.getActualFilePath();

        if (!actualPath) {
            message.warning(t('home.please_select_file'));
            return;
        }

        store.startTask();

        try {
            // Call the Wails binding directly — no HTTP, no Socket.IO
            await ModpackService.ProcessModpackFromPath(actualPath, store.selectedMode);
        } catch (error: any) {
            console.error('Failed to start modpack processing:', error);
            message.error(t('home.request_failed'));
            resetState();
        }
    }

    onMounted(() => {
        store.checkAndRestoreState();

        // --- Modpack processing events (replace Socket.IO listeners) ---

        cleanups.push(Events.On('pack_start', (event: any) => {
            const data = event.data;
            store.handleServerInstallStart(data);
        }));

        cleanups.push(Events.On('pack_step', (event: any) => {
            const data = event.data;
            store.handleServerInstallStep(data);
            // Map the orchestrator's step index to the UI's step indicator
            // Steps: 1=parse, 2=extract+download, 3=filter, 4=install, 5=complete
            if (data.stepIndex >= 1 && data.stepIndex <= 5) {
                store.currentStep = data.stepIndex;
            }
        }));

        cleanups.push(Events.On('pack_progress', (event: any) => {
            const data = event.data;
            if (data.step === '解压 overrides') {
                store.updateUnzipProgress({ current: data.progress, total: 100 });
            }
        }));

        cleanups.push(Events.On('pack_download_progress', (event: any) => {
            const data = event.data;
            store.updateDownloadProgress({ index: data.completed, total: data.total });
        }));

        cleanups.push(Events.On('pack_filter_start', (event: any) => {
            store.handleFilterModsStart(event.data);
        }));

        cleanups.push(Events.On('pack_filter_progress', (event: any) => {
            store.handleFilterModsProgress(event.data);
        }));

        cleanups.push(Events.On('pack_filter_complete', (event: any) => {
            const data = event.data;
            store.handleFilterModsComplete(data);
            const timeSpent = Math.round((data.duration || 0) / 1000);
            message.success(t('home.filter_mods_completed', {
                filtered: data.filteredCount,
                moved: data.movedCount
            }) + ` ${t('home.server_install_duration')}: ${timeSpent}s`);
        }));

        cleanups.push(Events.On('pack_complete', (event: any) => {
            const data = event.data;
            store.handleServerInstallComplete(data);

            const time = Math.round((data.duration || 0) / 1000);
            if (store.selectedMode === 'server') {
                message.success(t('home.server_install_completed') + ` ${t('home.server_install_duration')}: ${time}s`);
            } else {
                message.success(t('home.production_complete', { time }));
            }

            store.completeTask();
        }));

        cleanups.push(Events.On('pack_error', (event: any) => {
            handleError(event.data?.error || 'Unknown error');
            resetState();
        }));

        // --- Server install events (from download page, also need listeners here) ---

        cleanups.push(Events.On('server_install_start', (event: any) => {
            store.handleServerInstallStart(event.data);
        }));

        cleanups.push(Events.On('server_install_step', (event: any) => {
            store.handleServerInstallStep(event.data);
        }));

        cleanups.push(Events.On('server_install_progress', (event: any) => {
            store.handleServerInstallProgress(event.data);
        }));

        cleanups.push(Events.On('server_install_complete', (event: any) => {
            store.handleServerInstallComplete(event.data);
            store.completeTask();
        }));

        cleanups.push(Events.On('server_install_error', (event: any) => {
            store.handleServerInstallError(event.data);
        }));

        cleanups.push(Events.On('filter_mods_start', (event: any) => {
            store.handleFilterModsStart(event.data);
        }));

        cleanups.push(Events.On('filter_mods_progress', (event: any) => {
            store.handleFilterModsProgress(event.data);
        }));

        cleanups.push(Events.On('filter_mods_complete', (event: any) => {
            store.handleFilterModsComplete(event.data);
        }));

        cleanups.push(Events.On('filter_mods_error', (event: any) => {
            store.handleFilterModsError(event.data);
        }));
    });

    onUnmounted(() => {
        cleanups.forEach(fn => fn());
        cleanups.length = 0;
    });

    return {
        // File upload
        uploadDisabled,
        // File path
        droppedFilePath,
        setDroppedFilePath: store.setDroppedFilePath,
        clearDroppedFilePath: store.clearDroppedFilePath,
        // Mode selection
        javaAvailable,
        selectedMode,
        modeOptions: store.modeOptions,
        handleModeSelect: store.handleModeSelect,
        // Template selection
        showTemplateModal,
        templates,
        loadingTemplates,
        selectedTemplate,
        currentTemplateName,
        loadTemplates: store.loadTemplates,
        openTemplateModal: store.openTemplateModal,
        selectTemplate: store.selectTemplate,
        // Progress
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
        // Task
        startButtonDisabled,
        handleStartProcess
    };
}
