import { ref, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { Command } from '@tauri-apps/plugin-shell';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import axiosInstance from '@/utils/axios';

export function useBackend() {
    const { t } = useI18n();
    const router = useRouter();
    const backendStatus = ref<'loading' | 'success' | 'error'>('loading');
    const backendErrorInfo = ref<string>('');
    const retryCount = ref<number>(0);
    const maxRetries = 5;

    let _killCoreProcess: (() => void) | null = null;

    async function checkPortOccupied(): Promise<'correct_backend' | 'wrong_app' | 'free'> {
        try {
            const response = await axiosInstance.get("/config/get");
            const config = response.data;

            if (response.data.status === 200) {
                if (config.mirror !== undefined || config.filter !== undefined) {
                    return 'correct_backend';
                } else {
                    return 'wrong_app';
                }
            } else {
                return 'free';
            }
        } catch (error) {
            return 'free';
        }
    }

    async function runCoreProcess() {
        const portStatus = await checkPortOccupied();

        if (portStatus === 'correct_backend') {
            backendStatus.value = 'success';
            backendErrorInfo.value = '';
            message.success(t('message.backend_running'));
            return;
        }

        if (portStatus === 'wrong_app') {
            backendStatus.value = 'error';
            backendErrorInfo.value = t('message.backend_port_occupied');
            message.error(t('message.backend_port_occupied'));
            return;
        }

        backendStatus.value = 'loading';

        Command.create("core").spawn()
            .then((e) => {
                console.log("DeEarthX V3 Core");
                _killCoreProcess = e.kill;

                setTimeout(async () => {
                    try {
                        const response = await axiosInstance.get("/");
                        if (response.data.status === 200) {
                            backendStatus.value = 'success';
                            backendErrorInfo.value = '';
                            message.success(t('message.backend_started'));
                        } else {
                            backendStatus.value = 'error';
                            backendErrorInfo.value = t('common.status_error');
                            router.push('/error');
                        }
                    } catch (error) {
                        console.error("后端连接失败:", error);
                        backendStatus.value = 'error';
                        backendErrorInfo.value = t('common.status_error');
                        router.push('/error');
                    }
                }, 3000);
            })
            .catch((error) => {
                console.error(error);
                retryCount.value++;

                if (retryCount.value <= maxRetries) {
                    message.info(t('message.retry_start', { current: retryCount.value, max: maxRetries }));
                    setTimeout(() => {
                        runCoreProcess();
                    }, 2000);
                } else {
                    backendStatus.value = 'error';
                    backendErrorInfo.value = t('message.backend_start_failed', { count: maxRetries });
                    message.error(t('message.backend_start_failed', { count: maxRetries }));
                }
            });
    }

    onMounted(() => {
        runCoreProcess();
    });

    function createKillCoreProcessHandler(): () => void {
        return () => {
            if (_killCoreProcess && typeof _killCoreProcess === 'function') {
                _killCoreProcess();
                _killCoreProcess = null;
                message.info(t('message.backend_restart'));
                runCoreProcess();
            }
        };
    }

    return {
        backendStatus,
        backendErrorInfo,
        retryCount,
        maxRetries,
        checkPortOccupied,
        runCoreProcess,
        createKillCoreProcessHandler
    };
}
