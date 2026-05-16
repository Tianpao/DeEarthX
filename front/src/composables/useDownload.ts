import { ref, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { open } from '@tauri-apps/plugin-dialog';
import { io, Socket } from 'socket.io-client';
import axiosInstance from '@/utils/axios';
import type { MinecraftVersion, LoaderVersion, ProgressStatus, ServerInstallInfo } from '@/types/progress';

export function useDownload() {
  const { t } = useI18n();

  const currentStep = ref(0);

  const mcVersions = ref<MinecraftVersion[]>([]);
  const selectedMcVersion = ref('');
  const loadingMcVersions = ref(false);

  const selectedLoader = ref<'forge' | 'neoforge' | 'fabric'>('forge');

  const loaderVersions = ref<LoaderVersion[]>([]);
  const selectedLoaderVersion = ref('');
  const loadingLoaderVersions = ref(false);

  const autoInstall = ref(true);

  const installPath = ref('');

  const installing = ref(false);
  const installCompleted = ref(false);

  const serverInstallProgress = reactive<ProgressStatus>({
    status: 'normal',
    percent: 0,
    display: false
  });

  const serverInstallInfo = reactive<ServerInstallInfo>({
    modpackName: '',
    minecraftVersion: '',
    loaderType: '',
    loaderVersion: '',
    currentStep: '',
    stepIndex: 0,
    totalSteps: 0,
    message: '',
    status: 'idle',
    error: '',
    installPath: '',
    duration: 0
  });

  let socket: Socket | null = null;

  async function fetchMcVersions() {
    loadingMcVersions.value = true;
    try {
      const res = await axiosInstance.get('/download/minecraft-versions');
      if (res.data?.versions) {
        mcVersions.value = res.data.versions.filter(
          (v: MinecraftVersion) => v.type === 'release'
        );
      }
    } catch {
      mcVersions.value = [];
    } finally {
      loadingMcVersions.value = false;
    }
  }

  function handleMcVersionChange() {
    selectedLoaderVersion.value = '';
    loaderVersions.value = [];
    if (selectedMcVersion.value) {
      fetchLoaderVersions();
    }
  }

  async function fetchLoaderVersions() {
    if (!selectedMcVersion.value) return;
    loadingLoaderVersions.value = true;
    try {
      let url = '';
      switch (selectedLoader.value) {
        case 'forge':
          url = `/download/forge-versions?mcver=${selectedMcVersion.value}`;
          break;
        case 'neoforge':
          url = `/download/neoforge-versions?mcver=${selectedMcVersion.value}`;
          break;
        case 'fabric':
          url = `/download/fabric-versions?mcver=${selectedMcVersion.value}`;
          break;
      }
      const res = await axiosInstance.get(url);
      if (Array.isArray(res.data)) {
        loaderVersions.value = res.data;
      }
    } catch {
      loaderVersions.value = [];
    } finally {
      loadingLoaderVersions.value = false;
    }
  }

  function handleLoaderChange() {
    selectedLoaderVersion.value = '';
    loaderVersions.value = [];
    if (selectedMcVersion.value) {
      fetchLoaderVersions();
    }
  }

  async function selectInstallDir() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('download.step5_title')
      });
      if (selected) {
        installPath.value = selected;
      }
    } catch {
      // user cancelled
    }
  }

  function canProceedToStep(step: number): boolean {
    switch (step) {
      case 1: return !!selectedMcVersion.value;
      case 2: return !!selectedMcVersion.value && !!selectedLoader.value;
      case 3: return !!selectedMcVersion.value && !!selectedLoader.value && !!selectedLoaderVersion.value;
      case 4: return true;
      default: return true;
    }
  }

  function startInstall() {
    if (!selectedMcVersion.value || !selectedLoader.value || !selectedLoaderVersion.value || !installPath.value) {
      return;
    }

    installing.value = true;
    installCompleted.value = false;
    serverInstallProgress.display = true;
    serverInstallProgress.percent = 0;
    serverInstallProgress.status = 'active';
    serverInstallInfo.status = 'installing';
    serverInstallInfo.error = '';

    const wsHost = import.meta.env.VITE_WS_HOST || 'localhost';
    const wsPort = import.meta.env.VITE_WS_PORT || '37019';

    socket = io(`ws://${wsHost}:${wsPort}`, {
      autoConnect: false,
      reconnection: false
    });

    socket.on('connect', () => {
      axiosInstance.post(
        `/download/install?socketId=${socket!.id}`,
        {
          loader: selectedLoader.value,
          mcVersion: selectedMcVersion.value,
          loaderVersion: selectedLoaderVersion.value,
          installPath: installPath.value,
          autoInstall: autoInstall.value
        }
      ).catch(() => {
        serverInstallInfo.status = 'error';
        serverInstallInfo.error = t('download.install_failed');
        serverInstallProgress.status = 'exception';
      });
    });

    socket.on('server_install_start', (data: any) => {
      Object.assign(serverInstallInfo, {
        modpackName: data.modpackName || '',
        minecraftVersion: data.minecraftVersion || '',
        loaderType: data.loaderType || '',
        loaderVersion: data.loaderVersion || '',
        status: 'installing'
      });
    });

    socket.on('server_install_step', (data: any) => {
      serverInstallInfo.currentStep = data.step || '';
      serverInstallInfo.stepIndex = data.stepIndex || 0;
      serverInstallInfo.totalSteps = data.totalSteps || 0;
      if (data.message) {
        serverInstallInfo.message = data.message;
      }
    });

    socket.on('server_install_progress', (data: any) => {
      if (data.progress !== undefined) {
        serverInstallProgress.percent = data.progress;
      }
      if (data.message) {
        serverInstallInfo.message = data.message;
      }
    });

    socket.on('server_install_complete', (data: any) => {
      serverInstallProgress.percent = 100;
      serverInstallProgress.status = 'success';
      serverInstallInfo.status = 'completed';
      serverInstallInfo.installPath = data.installPath || '';
      serverInstallInfo.duration = data.duration || 0;
      installCompleted.value = true;
      installing.value = false;
      socket?.disconnect();
    });

    socket.on('server_install_error', (data: any) => {
      serverInstallProgress.status = 'exception';
      serverInstallInfo.status = 'error';
      serverInstallInfo.error = data.error || t('download.install_error');
      installing.value = false;
      socket?.disconnect();
    });

    socket.on('disconnect', () => {
      if (installing.value) {
        serverInstallProgress.status = 'exception';
        serverInstallInfo.status = 'error';
        serverInstallInfo.error = t('download.install_error');
        installing.value = false;
      }
    });

    socket.connect();
  }

  function resetState() {
    currentStep.value = 0;
    selectedMcVersion.value = '';
    selectedLoader.value = 'forge';
    selectedLoaderVersion.value = '';
    autoInstall.value = true;
    installPath.value = '';
    installing.value = false;
    installCompleted.value = false;
    serverInstallProgress.display = false;
    serverInstallProgress.percent = 0;
    serverInstallProgress.status = 'normal';
    serverInstallInfo.status = 'idle';
    serverInstallInfo.error = '';
    socket?.disconnect();
    socket = null;
  }

  return {
    currentStep,
    mcVersions,
    selectedMcVersion,
    loadingMcVersions,
    selectedLoader,
    loaderVersions,
    selectedLoaderVersion,
    loadingLoaderVersions,
    autoInstall,
    installPath,
    installing,
    installCompleted,
    serverInstallProgress,
    serverInstallInfo,
    fetchMcVersions,
    handleMcVersionChange,
    fetchLoaderVersions,
    handleLoaderChange,
    selectInstallDir,
    canProceedToStep,
    startInstall,
    resetState
  };
}
