import { onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Events } from '@wailsio/runtime';
import { storeToRefs } from 'pinia';
import { useDownloadStore } from '@/stores/download';
import { DownloadService } from '@/bindings/deearthx/core/services';

let listenersSetup = false;

function setupWailsListeners(store: ReturnType<typeof useDownloadStore>, t: (key: string) => string) {
    if (listenersSetup) return;
    listenersSetup = true;

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

    Events.On("server_install_error", (data: any) => {
        store.handleServerInstallError(data?.error || t('download.install_error'));
    });
}

export function useDownload() {
    const { t } = useI18n();
    const store = useDownloadStore();

    const {
        mcVersions, selectedMcVersion, loadingMcVersions,
        availableLoaders, selectedLoader,
        loaderVersions, selectedLoaderVersion, loadingLoaderVersions,
        autoInstall, installPath,
        installing, installCompleted,
        serverInstallProgress, serverInstallInfo
    } = storeToRefs(store);

    setupWailsListeners(store, t);

    function startInstall() {
        if (!store.canInstall || installing.value) return;

        store.startInstall();

        DownloadService.StartServerInstall(
            selectedLoader.value,
            selectedMcVersion.value,
            selectedLoaderVersion.value
        );
    }

    function resetState() {
        store.resetState();
    }

    onMounted(() => {
        store.checkAndRestoreState();
        if (store.mcVersions.length === 0) {
            store.fetchMcVersions();
            store.fetchForgePromos();
        }
    });

    onUnmounted(() => {
        // keep state across navigation
    });

    return {
        mcVersions, selectedMcVersion, loadingMcVersions,
        availableLoaders, selectedLoader,
        loaderVersions, selectedLoaderVersion, loadingLoaderVersions,
        autoInstall, installPath,
        installing, installCompleted,
        serverInstallProgress, serverInstallInfo,
        handleMcVersionChange: store.handleMcVersionChange,
        handleLoaderChange: store.handleLoaderChange,
        getForgeBadge: store.getForgeBadge,
        canInstall: store.canInstall,
        startInstall, resetState
    };
}
