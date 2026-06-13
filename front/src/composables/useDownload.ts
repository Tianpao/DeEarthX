import { onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { io, Socket } from 'socket.io-client';
import { storeToRefs } from 'pinia';
import { useDownloadStore } from '@/stores/download';
import axiosInstance from '@/utils/axios';

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

  let socket: Socket | null = null;

  function startInstall() {
    if (!store.canInstall) return;

    store.startInstall();

    const wsHost = import.meta.env.VITE_WS_HOST || 'localhost';
    const wsPort = import.meta.env.VITE_WS_PORT || '37019';

    socket = io(`ws://${wsHost}:${wsPort}`, { autoConnect: false, reconnection: false });

    socket.on('connect', () => {
      axiosInstance.post(`/download/install?socketId=${socket!.id}`, {
        loader: selectedLoader.value,
        mcVersion: selectedMcVersion.value,
        loaderVersion: selectedLoaderVersion.value,
        autoInstall: autoInstall.value
      }).then(res => {
        if (res.data?.installPath) installPath.value = res.data.installPath;
      }).catch(() => {
        store.handleServerInstallError(t('download.install_failed'));
      });
    });

    socket.on('server_install_start', (data: any) => {
      store.handleServerInstallStart(data);
    });

    socket.on('server_install_step', (data: any) => {
      store.handleServerInstallStep(data);
    });

    socket.on('server_install_progress', (data: any) => {
      store.handleServerInstallProgress(data);
    });

    socket.on('server_install_complete', (data: any) => {
      store.handleServerInstallComplete(data);
      socket?.disconnect();
    });

    socket.on('server_install_error', (data: any) => {
      store.handleServerInstallError(data.error || t('download.install_error'));
      socket?.disconnect();
    });

    socket.on('disconnect', () => {
      if (installing.value) {
        store.handleServerInstallError(t('download.install_error'));
      }
    });

    socket.connect();
  }

  function resetState() {
    socket?.disconnect();
    socket = null;
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
    if (socket) {
      socket.disconnect();
      socket = null;
    }
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