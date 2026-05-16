import { ref, computed } from 'vue';
import { message } from 'ant-design-vue';
import type { StepsProps } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { sendNotification } from '@tauri-apps/plugin-notification';
import type { ProgressStatus, ServerInstallInfo, FilterModsInfo } from '@/types/progress';

export function useProgress() {
    const { t } = useI18n();

    const showSteps = ref(false);
    const currentStep = ref(0);

    const stepItems = computed<Required<StepsProps>['items']>(() => {
        return [
            { title: t('home.step1_title'), description: t('home.step1_desc') },
            { title: t('home.step2_title'), description: t('home.step2_desc') },
            { title: t('home.step3_title'), description: t('home.step3_desc') },
            { title: t('home.step4_title'), description: t('home.step4_desc') }
        ];
    });

    const unzipProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: true });
    const downloadProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: true });
    const uploadProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: false });
    const serverInstallProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: false });
    const filterModsProgress = ref<ProgressStatus>({ status: 'active', percent: 0, display: false });
    const startTime = ref<number>(0);

    const serverInstallInfo = ref<ServerInstallInfo>({
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

    const filterModsInfo = ref<FilterModsInfo>({
        totalMods: 0,
        currentMod: 0,
        modName: '',
        filteredCount: 0,
        movedCount: 0,
        status: 'idle',
        error: '',
        duration: 0
    });

    function resetProgress() {
        showSteps.value = false;
        currentStep.value = 0;
        unzipProgress.value = { status: 'active', percent: 0, display: false };
        downloadProgress.value = { status: 'active', percent: 0, display: false };
        uploadProgress.value = { status: 'active', percent: 0, display: false };
        serverInstallProgress.value = { status: 'active', percent: 0, display: false };
        filterModsProgress.value = { status: 'active', percent: 0, display: false };
        startTime.value = 0;
        serverInstallInfo.value = {
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
        };
        filterModsInfo.value = {
            totalMods: 0,
            currentMod: 0,
            modName: '',
            filteredCount: 0,
            movedCount: 0,
            status: 'idle',
            error: '',
            duration: 0
        };
    }

    function updateUnzipProgress(result: { current: number; total: number }) {
        unzipProgress.value.percent = Math.round((result.current / result.total) * 100);
        if (result.current === result.total) {
            unzipProgress.value.status = 'success';
            setTimeout(() => {
                unzipProgress.value.display = false;
            }, 2000);
        }
    }

    function updateDownloadProgress(result: { index: number; total: number }) {
        downloadProgress.value.percent = Math.round((result.index / result.total) * 100);
        if (downloadProgress.value.percent === 100) {
            downloadProgress.value.status = 'success';
            setTimeout(() => {
                downloadProgress.value.display = false;
            }, 2000);
        }
    }

    function handleFinish(result: number) {
        const timeSpent = Math.round(result / 1000);
        currentStep.value++;
        message.success(t('home.production_complete', { time: timeSpent }));
        sendNotification({ title: t('common.app_name'), body: t('home.production_complete', { time: timeSpent }) });
    }

    function handleServerInstallStart(result: any) {
        serverInstallInfo.value = {
            modpackName: result.modpackName,
            minecraftVersion: result.minecraftVersion,
            loaderType: result.loaderType,
            loaderVersion: result.loaderVersion,
            currentStep: '',
            stepIndex: 0,
            totalSteps: 0,
            message: 'Starting installation...',
            status: 'installing',
            error: '',
            installPath: '',
            duration: 0
        };
        serverInstallProgress.value = { status: 'active', percent: 0, display: true };
    }

    function handleServerInstallStep(result: any) {
        serverInstallInfo.value.currentStep = result.step;
        serverInstallInfo.value.stepIndex = result.stepIndex;
        serverInstallInfo.value.totalSteps = result.totalSteps;
        serverInstallInfo.value.message = result.message || result.step;

        const overallProgress = (result.stepIndex / result.totalSteps) * 100;
        serverInstallProgress.value.percent = Math.round(overallProgress);
    }

    function handleServerInstallProgress(result: any) {
        serverInstallInfo.value.currentStep = result.step;
        serverInstallInfo.value.message = result.message || result.step;
        serverInstallProgress.value.percent = result.progress;
    }

    function handleServerInstallComplete(result: any) {
        serverInstallInfo.value.status = 'completed';
        serverInstallInfo.value.installPath = result.installPath;
        serverInstallInfo.value.duration = result.duration;
        serverInstallInfo.value.message = t('home.server_install_completed');
        serverInstallProgress.value = { status: 'success', percent: 100, display: true };

        currentStep.value++;

        const timeSpent = Math.round(result.duration / 1000);
        message.success(t('home.server_install_completed') + ` ${t('home.server_install_duration')}: ${timeSpent}s`);
        sendNotification({ title: t('common.app_name'), body: t('home.production_complete', { time: timeSpent }) });

        setTimeout(() => {
            serverInstallProgress.value.display = false;
        }, 8000);
    }

    function handleServerInstallError(result: any) {
        serverInstallInfo.value.status = 'error';
        serverInstallInfo.value.error = result.error;
        serverInstallInfo.value.message = result.error;
        serverInstallProgress.value = { status: 'exception', percent: serverInstallProgress.value.percent, display: true };
    }

    function handleFilterModsStart(result: any) {
        filterModsInfo.value = {
            totalMods: result.totalMods,
            currentMod: 0,
            modName: '',
            filteredCount: 0,
            movedCount: 0,
            status: 'filtering',
            error: '',
            duration: 0
        };
        filterModsProgress.value = { status: 'active', percent: 0, display: true };
    }

    function handleFilterModsProgress(result: any) {
        filterModsInfo.value.currentMod = result.current;
        filterModsInfo.value.modName = result.modName;

        const percent = Math.round((result.current / result.total) * 100);
        filterModsProgress.value.percent = percent;
    }

    function handleFilterModsComplete(result: any) {
        filterModsInfo.value.status = 'completed';
        filterModsInfo.value.filteredCount = result.filteredCount;
        filterModsInfo.value.movedCount = result.movedCount;
        filterModsInfo.value.duration = result.duration;
        filterModsProgress.value = { status: 'success', percent: 100, display: true };

        const timeSpent = Math.round(result.duration / 1000);
        message.success(t('home.filter_mods_completed', { filtered: result.filteredCount, moved: result.movedCount }) + ` ${t('home.server_install_duration')}: ${timeSpent}s`);

        setTimeout(() => {
            filterModsProgress.value.display = false;
        }, 8000);
    }

    function handleFilterModsError(result: any) {
        filterModsInfo.value.status = 'error';
        filterModsInfo.value.error = result.error;
        filterModsProgress.value = { status: 'exception', percent: filterModsProgress.value.percent, display: true };
    }

    return {
        showSteps,
        currentStep,
        stepItems,
        unzipProgress,
        downloadProgress,
        uploadProgress,
        serverInstallProgress,
        filterModsProgress,
        serverInstallInfo,
        filterModsInfo,
        startTime,
        resetProgress,
        updateUnzipProgress,
        updateDownloadProgress,
        handleFinish,
        handleServerInstallStart,
        handleServerInstallStep,
        handleServerInstallProgress,
        handleServerInstallComplete,
        handleServerInstallError,
        handleFilterModsStart,
        handleFilterModsProgress,
        handleFilterModsComplete,
        handleFilterModsError
    };
}
