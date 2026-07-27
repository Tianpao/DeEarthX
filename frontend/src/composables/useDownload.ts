import { onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useDownloadStore } from '@/stores/download';
import { Events } from '@wailsio/runtime';
import * as DownloadService from '&/dex/backend/download/downloadservice';

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

  // Store event listener cleanup functions
  const cleanups: (() => void)[] = [];

  function startInstall() {
    if (!store.canInstall) return;

    store.startInstall();

    // Call Wails binding directly — no Socket.IO needed
    DownloadService.StartInstall(
      selectedLoader.value,
      selectedMcVersion.value,
      selectedLoaderVersion.value,
      autoInstall.value
    ).then(res => {
      if (res) installPath.value = res;
    }).catch(() => {
      store.handleServerInstallError(t('download.install_failed'));
    });
  }

  function resetState() {
    store.resetState();
  }

  onMounted(() => {
    store.checkAndRestoreState();

    // Set up Wails event listeners (replaces Socket.IO listeners)
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
    }));

    cleanups.push(Events.On('server_install_error', (event: any) => {
      store.handleServerInstallError(event.data?.error || t('download.install_error'));
    }));

    // Fetch initial data
    if (store.mcVersions.length === 0) {
      store.fetchMcVersions();
      store.fetchForgePromos();
    }
  });

  onUnmounted(() => {
    // Clean up event listeners
    cleanups.forEach(fn => fn());
    cleanups.length = 0;
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
