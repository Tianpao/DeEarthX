import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ProgressStatus, ServerInstallInfo } from '@/types/progress';
import { DownloadService } from '@/bindings/deearthx/core/services';
import type { MinecraftVersion, ForgeVersion, NeoForgeVersion, FabricVersion } from '@/bindings/deearthx/core/services/models';

type LoaderVersion = ForgeVersion | NeoForgeVersion | FabricVersion;

function isVersionLessThan(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va < vb) return true;
    if (va > vb) return false;
  }
  return false;
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

  const serverInstallProgress = ref<ProgressStatus>({
    status: 'normal', percent: 0, display: false
  });

  const serverInstallInfo = ref<ServerInstallInfo>({
    modpackName: '', minecraftVersion: '', loaderType: '', loaderVersion: '',
    currentStep: '', stepIndex: 0, totalSteps: 0, message: '',
    status: 'idle', error: '', installPath: '', duration: 0
  });

  const taskCompletedAt = ref<number>(0);

  let socketInstance: any = null;

  const canInstall = computed(() =>
    !!selectedMcVersion.value && !!selectedLoader.value && !!selectedLoaderVersion.value
  );

  async function fetchMcVersions() {
    loadingMcVersions.value = true;
    try {
      const versions = await DownloadService.GetMinecraftVersions();
      if (versions) {
        mcVersions.value = versions.filter(v => v.type === 'release');
      }
    } catch { mcVersions.value = []; }
    finally { loadingMcVersions.value = false; }
  }

  async function fetchForgePromos() {
    try {
      const promos = await DownloadService.GetForgePromos();
      if (promos) forgePromos.value = promos;
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

  function sortVersions(loader: string) {
    loaderVersions.value.sort((a, b) => {
      if (loader === 'neoforge') {
        const aVer = a as NeoForgeVersion;
        const bVer = b as NeoForgeVersion;
        if (aVer.latest && !bVer.latest) return -1;
        if (!aVer.latest && bVer.latest) return 1;
      } else if (loader === 'fabric') {
        const aVer = a as FabricVersion;
        const bVer = b as FabricVersion;
        if (aVer.stable && !bVer.stable) return -1;
        if (!aVer.stable && bVer.stable) return 1;
      }
      return b.version.localeCompare(a.version, undefined, { numeric: true });
    });
  }

  async function fetchLoaderVersions() {
    if (!selectedMcVersion.value || !selectedLoader.value) return;
    loadingLoaderVersions.value = true;
    try {
      let versions: LoaderVersion[] | null = null;
      switch (selectedLoader.value) {
        case 'forge': versions = await DownloadService.GetForgeVersions(selectedMcVersion.value); break;
        case 'neoforge': versions = await DownloadService.GetNeoForgeVersions(selectedMcVersion.value); break;
        case 'fabric': versions = await DownloadService.GetFabricVersions(selectedMcVersion.value); break;
      }
      if (versions) {
        loaderVersions.value = versions;
        sortVersions(selectedLoader.value);
      }
    } catch { loaderVersions.value = []; }
    finally { loadingLoaderVersions.value = false; }
  }

  function getForgeBadge(version: string): string | null {
    if (selectedLoader.value === 'forge') {
      const promo = forgePromos.value[selectedMcVersion.value];
      if (!promo) return null;
      if (promo.recommended === version) return 'recommended';
      if (promo.latest === version) return 'latest';
      return null;
    }
    if (selectedLoader.value === 'neoforge') {
      const v = loaderVersions.value.find(lv => lv.version === version) as NeoForgeVersion;
      return v?.latest ? 'latest' : null;
    }
    if (selectedLoader.value === 'fabric') {
      const v = loaderVersions.value.find(lv => lv.version === version) as FabricVersion;
      return v?.stable ? 'stable' : null;
    }
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
      modpackName: data.modpackName || data.title || '',
      minecraftVersion: data.minecraftVersion || data.mcVersion || '',
      loaderType: data.loaderType || data.loader || '',
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
    const stepIndex = data.stepIndex ?? data.current ?? 0;
    const totalSteps = data.totalSteps ?? data.total ?? 0;
    serverInstallInfo.value.currentStep = data.step || '';
    serverInstallInfo.value.stepIndex = stepIndex;
    serverInstallInfo.value.totalSteps = totalSteps;
    if (data.message) serverInstallInfo.value.message = data.message;
    if (totalSteps > 0) {
      serverInstallProgress.value.percent = Math.round((stepIndex / totalSteps) * 100);
    }
  }

  function handleServerInstallProgress(data: any) {
    if (data.progress !== undefined) serverInstallProgress.value.percent = data.progress;
    if (data.message) serverInstallInfo.value.message = data.message;
    if (data.step) serverInstallInfo.value.currentStep = data.step;
  }

  function handleServerInstallComplete(data: any) {
    serverInstallProgress.value.percent = 100;
    serverInstallProgress.value.status = 'success';
    serverInstallInfo.value.status = 'completed';
    serverInstallInfo.value.installPath = data.installPath || data.path || '';
    serverInstallInfo.value.duration = data.duration || 0;
    installCompleted.value = true;
    installing.value = false;
    installPath.value = data.installPath || data.path || '';
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

  function checkAndRestoreState() {
    if (taskCompletedAt.value > 0 && Date.now() - taskCompletedAt.value > 180000) {
      resetState();
    }
  }

  function setSocketInstance(socket: any) { socketInstance = socket; }
  function getSocketInstance() { return socketInstance; }
  function clearSocketInstance() { socketInstance = null; }

  return {
    mcVersions, selectedMcVersion, loadingMcVersions,
    availableLoaders, selectedLoader,
    loaderVersions, selectedLoaderVersion, loadingLoaderVersions,
    autoInstall, installPath,
    installing, installCompleted,
    serverInstallProgress, serverInstallInfo,
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
    checkAndRestoreState,
    setSocketInstance,
    getSocketInstance,
    clearSocketInstance
  };
});
