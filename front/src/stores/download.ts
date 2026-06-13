import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { MinecraftVersion, LoaderVersion, ProgressStatus, ServerInstallInfo } from '@/types/progress';
import axiosInstance from '@/utils/axios';

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

export const useDownloadStore = defineStore('download', () => {
  // 版本选择
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

  // 安装状态
  const installing = ref(false);
  const installCompleted = ref(false);
  const installPath = ref('');

  const serverInstallProgress = ref<ProgressStatus>({
    status: 'normal', percent: 0, display: false
  });

  const serverInstallInfo = ref<ServerInstallInfo>({
    modpackName: '', minecraftVersion: '', loaderType: '', loaderVersion: '',
    currentStep: '', stepIndex: 0, totalSteps: 0, message: '',
    status: 'idle', error: '', installPath: '', duration: 0
  });

  // 完成时间戳
  const taskCompletedAt = ref<number>(0);

  const canInstall = computed(() =>
    !!selectedMcVersion.value && !!selectedLoader.value && !!selectedLoaderVersion.value
  );

  // Fetch methods
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
    installing.value = true;
    installCompleted.value = false;
    serverInstallProgress.value.display = true;
    serverInstallProgress.value.percent = 0;
    serverInstallProgress.value.status = 'active';
    serverInstallInfo.value.status = 'installing';
    serverInstallInfo.value.error = '';
  }

  function handleServerInstallStart(data: any) {
    serverInstallInfo.value = {
      modpackName: data.modpackName || '',
      minecraftVersion: data.minecraftVersion || '',
      loaderType: data.loaderType || '',
      loaderVersion: data.loaderVersion || '',
      currentStep: '',
      stepIndex: 0,
      totalSteps: 0,
      message: '',
      status: 'installing',
      error: '',
      installPath: '',
      duration: 0
    };
  }

  function handleServerInstallStep(data: any) {
    serverInstallInfo.value.currentStep = data.step || '';
    serverInstallInfo.value.stepIndex = data.stepIndex || 0;
    serverInstallInfo.value.totalSteps = data.totalSteps || 0;
    if (data.message) serverInstallInfo.value.message = data.message;
  }

  function handleServerInstallProgress(data: any) {
    if (data.progress !== undefined) serverInstallProgress.value.percent = data.progress;
    if (data.message) serverInstallInfo.value.message = data.message;
  }

  function handleServerInstallComplete(data: any) {
    serverInstallProgress.value.percent = 100;
    serverInstallProgress.value.status = 'success';
    serverInstallInfo.value.status = 'completed';
    serverInstallInfo.value.installPath = data.installPath || '';
    serverInstallInfo.value.duration = data.duration || 0;
    installCompleted.value = true;
    installing.value = false;
    installPath.value = data.installPath || '';
    taskCompletedAt.value = Date.now();
  }

  function handleServerInstallError(error: string) {
    serverInstallProgress.value.status = 'exception';
    serverInstallInfo.value.status = 'error';
    serverInstallInfo.value.error = error;
    installing.value = false;
  }

  function resetState() {
    selectedMcVersion.value = '';
    selectedLoader.value = '';
    selectedLoaderVersion.value = '';
    autoInstall.value = true;
    installPath.value = '';
    installing.value = false;
    installCompleted.value = false;
    serverInstallProgress.value = { status: 'normal', percent: 0, display: false };
    serverInstallInfo.value = {
      modpackName: '', minecraftVersion: '', loaderType: '', loaderVersion: '',
      currentStep: '', stepIndex: 0, totalSteps: 0, message: '',
      status: 'idle', error: '', installPath: '', duration: 0
    };
    taskCompletedAt.value = 0;
  }

  // 检查并恢复状态
  function checkAndRestoreState() {
    // 如果安装完成超过 3 分钟，重置状态
    if (taskCompletedAt.value > 0 && Date.now() - taskCompletedAt.value > 180000) {
      resetState();
    }

    // 如果安装进行中但已超时（超过 10 分钟），也重置
    if (installing.value && serverInstallInfo.value.status === 'installing') {
      resetState();
    }
  }

  return {
    // 状态
    mcVersions, selectedMcVersion, loadingMcVersions,
    availableLoaders, selectedLoader,
    loaderVersions, selectedLoaderVersion, loadingLoaderVersions,
    autoInstall, installPath,
    installing, installCompleted,
    serverInstallProgress, serverInstallInfo,
    // 方法
    fetchMcVersions, fetchForgePromos,
    handleMcVersionChange, handleLoaderChange,
    getForgeBadge,
    canInstall,
    startInstall,
    handleServerInstallStart,
    handleServerInstallStep,
    handleServerInstallProgress,
    handleServerInstallComplete,
    handleServerInstallError,
    resetState,
    checkAndRestoreState
  };
});