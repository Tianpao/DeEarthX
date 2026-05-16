import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { io, Socket } from 'socket.io-client';
import axiosInstance from '@/utils/axios';
import type { MinecraftVersion, LoaderVersion, ProgressStatus, ServerInstallInfo } from '@/types/progress';

function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

function isVersionLessThan(a: string, b: string): boolean {
  return compareVersion(a, b) < 0;
}

const SPECIAL_FORGE_VERSIONS = ['1.16.5', '1.18.2', '1.19.2', '1.20.1'];

function getAvailableLoaders(mcVersion: string): string[] {
  if (isVersionLessThan(mcVersion, '1.2.2')) return [];
  const loaders: string[] = ['forge'];
  if (!isVersionLessThan(mcVersion, '1.14')) loaders.push('fabric');
  if (!isVersionLessThan(mcVersion, '1.20.1')) loaders.push('neoforge');
  return loaders;
}

function getDefaultLoader(mcVersion: string, available: string[]): string {
  if (available.length === 0) return '';
  if (available.length === 1) return available[0];
  if (SPECIAL_FORGE_VERSIONS.includes(mcVersion) || isVersionLessThan(mcVersion, '1.14')) return 'forge';
  if (!isVersionLessThan(mcVersion, '1.20.1')) return 'neoforge';
  return 'fabric';
}

export function useDownload() {
  const { t } = useI18n();

  const mcVersions = ref<MinecraftVersion[]>([]);
  const selectedMcVersion = ref('');
  const loadingMcVersions = ref(false);

  const availableLoaders = ref<string[]>([]);
  const selectedLoader = ref('');

  const forgePromos = ref<Record<string, { latest?: string; recommended?: string }>>({});

  const loaderVersions = ref<LoaderVersion[]>([]);
  const selectedLoaderVersion = ref('');
  const loadingLoaderVersions = ref(false);

  const autoInstall = ref(true);

  const installing = ref(false);
  const installCompleted = ref(false);
  const installPath = ref('');

  const serverInstallProgress = reactive<ProgressStatus>({
    status: 'normal', percent: 0, display: false
  });
  const serverInstallInfo = reactive<ServerInstallInfo>({
    modpackName: '', minecraftVersion: '', loaderType: '', loaderVersion: '',
    currentStep: '', stepIndex: 0, totalSteps: 0, message: '',
    status: 'idle', error: '', installPath: '', duration: 0
  });

  let socket: Socket | null = null;

  const canInstall = computed(() =>
    !!selectedMcVersion.value && !!selectedLoader.value && !!selectedLoaderVersion.value
  );

  async function fetchMcVersions() {
    loadingMcVersions.value = true;
    try {
      const res = await axiosInstance.get('/download/minecraft-versions');
      if (res.data?.versions) {
        mcVersions.value = res.data.versions.filter(
          (v: MinecraftVersion) => v.type === 'release'
        );
      }
    } catch { mcVersions.value = []; }
    finally { loadingMcVersions.value = false; }
  }

  async function fetchForgePromos() {
    try {
      const res = await axiosInstance.get('/download/forge-promos');
      if (res.data) forgePromos.value = res.data;
    } catch { forgePromos.value = {}; }
  }

  function handleMcVersionChange() {
    selectedLoaderVersion.value = '';
    loaderVersions.value = [];
    const available = getAvailableLoaders(selectedMcVersion.value);
    availableLoaders.value = available;
    selectedLoader.value = getDefaultLoader(selectedMcVersion.value, available);
    if (selectedMcVersion.value && selectedLoader.value) fetchLoaderVersions();
  }

  function handleLoaderChange() {
    selectedLoaderVersion.value = '';
    loaderVersions.value = [];
    if (selectedMcVersion.value && selectedLoader.value) fetchLoaderVersions();
  }

  function sortLoaderVersions(loader: string) {
    const promo = forgePromos.value[selectedMcVersion.value];
    loaderVersions.value.sort((a, b) => {
      if (loader === 'forge' && promo) {
        const aPri = promo.recommended === a.version ? 0 : promo.latest === a.version ? 1 : 2;
        const bPri = promo.recommended === b.version ? 0 : promo.latest === b.version ? 1 : 2;
        if (aPri !== bPri) return aPri - bPri;
      } else if (loader === 'neoforge') {
        if (a.latest && !b.latest) return -1;
        if (!a.latest && b.latest) return 1;
      } else if (loader === 'fabric') {
        if (a.stable && !b.stable) return -1;
        if (!a.stable && b.stable) return 1;
      }
      return b.version.localeCompare(a.version, undefined, { numeric: true });
    });
  }

  async function fetchLoaderVersions() {
    if (!selectedMcVersion.value || !selectedLoader.value) return;
    loadingLoaderVersions.value = true;
    try {
      let url = '';
      switch (selectedLoader.value) {
        case 'forge': url = `/download/forge-versions?mcver=${selectedMcVersion.value}`; break;
        case 'neoforge': url = `/download/neoforge-versions?mcver=${selectedMcVersion.value}`; break;
        case 'fabric': url = `/download/fabric-versions?mcver=${selectedMcVersion.value}`; break;
        default: return;
      }
      const res = await axiosInstance.get(url);
      if (Array.isArray(res.data)) {
        loaderVersions.value = res.data;
        sortLoaderVersions(selectedLoader.value);
      }
    } catch { loaderVersions.value = []; }
    finally { loadingLoaderVersions.value = false; }
  }

  function getForgeBadge(version: string): string | null {
    const promo = forgePromos.value[selectedMcVersion.value];
    if (!promo) return null;
    if (promo.latest === version) return 'latest';
    if (promo.recommended === version) return 'recommended';
    return null;
  }

  function startInstall() {
    if (!canInstall.value) return;

    installing.value = true;
    installCompleted.value = false;
    serverInstallProgress.display = true;
    serverInstallProgress.percent = 0;
    serverInstallProgress.status = 'active';
    serverInstallInfo.status = 'installing';
    serverInstallInfo.error = '';

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
      if (data.message) serverInstallInfo.message = data.message;
    });

    socket.on('server_install_progress', (data: any) => {
      if (data.progress !== undefined) serverInstallProgress.percent = data.progress;
      if (data.message) serverInstallInfo.message = data.message;
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
    selectedMcVersion.value = '';
    selectedLoader.value = '';
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

  onMounted(() => {
    fetchMcVersions();
    fetchForgePromos();
  });

  return {
    mcVersions, selectedMcVersion, loadingMcVersions,
    availableLoaders, selectedLoader,
    loaderVersions, selectedLoaderVersion, loadingLoaderVersions,
    autoInstall, installPath,
    installing, installCompleted,
    serverInstallProgress, serverInstallInfo,
    handleMcVersionChange, handleLoaderChange,
    getForgeBadge,
    canInstall, startInstall, resetState
  };
}
