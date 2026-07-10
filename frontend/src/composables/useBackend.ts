import { ref } from 'vue';

export function useBackend() {
    const backendStatus = ref<'loading' | 'success' | 'error'>('success');
    const backendErrorInfo = ref<string>('');

    function createKillCoreProcessHandler(): () => void {
        return () => {
            // Wails v3: no separate backend process to restart
        };
    }

    return {
        backendStatus,
        backendErrorInfo,
        createKillCoreProcessHandler
    };
}
