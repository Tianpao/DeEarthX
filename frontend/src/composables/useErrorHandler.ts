import { notification } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';

export function useErrorHandler() {
    const { t } = useI18n();

    function handleError(result: any) {
        if (result === 'jini') {
            notification.error({
                message: t('home.java_error_title'),
                description: t('home.java_error_desc'),
                duration: 0
            });
        } else if (typeof result === 'string') {
            let errorTitle = t('home.backend_error');
            let errorDesc = t('home.backend_error_desc', { error: result });
            let suggestions: string[] = [];

            if (result.includes('network') || result.includes('connection') || result.includes('timeout')) {
                errorTitle = t('home.network_error_title');
                errorDesc = t('home.network_error_desc', { error: result });
                suggestions = [
                    t('home.suggestion_check_network'),
                    t('home.suggestion_check_firewall'),
                    t('home.suggestion_retry')
                ];
            } else if (result.includes('file') || result.includes('permission') || result.includes('disk')) {
                errorTitle = t('home.file_error_title');
                errorDesc = t('home.file_error_desc', { error: result });
                suggestions = [
                    t('home.suggestion_check_disk_space'),
                    t('home.suggestion_check_permission'),
                    t('home.suggestion_check_file_format')
                ];
            } else if (result.includes('memory') || result.includes('out of memory') || result.includes('heap')) {
                errorTitle = t('home.memory_error_title');
                errorDesc = t('home.memory_error_desc', { error: result });
                suggestions = [
                    t('home.suggestion_increase_memory'),
                    t('home.suggestion_close_other_apps'),
                    t('home.suggestion_restart_application')
                ];
            } else {
                suggestions = [
                    t('home.suggestion_check_backend'),
                    t('home.suggestion_check_logs'),
                    t('home.suggestion_contact_support')
                ];
            }

            const fullDescription = `${errorDesc}\n\n${t('home.suggestions')}:\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;

            notification.error({
                message: errorTitle,
                description: fullDescription,
                duration: 0
            });
        } else {
            notification.error({
                message: t('home.unknown_error_title'),
                description: t('home.unknown_error_desc'),
                duration: 0
            });
        }
    }

    return {
        handleError
    };
}
