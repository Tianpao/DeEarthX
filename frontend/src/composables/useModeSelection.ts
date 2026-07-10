import { ref, computed } from 'vue';
import type { SelectProps } from 'ant-design-vue/es/vc-select';
import { useI18n } from 'vue-i18n';

export function useModeSelection() {
    const { t } = useI18n();
    const javaAvailable = ref(true);
    const selectedMode = ref(javaAvailable.value ? 'server' : 'upload');

    const modeOptions = computed<SelectProps['options']>(() => {
        return [
            { label: t('home.mode_server'), value: 'server', disabled: !javaAvailable.value },
            { label: t('home.mode_upload'), value: 'upload', disabled: false }
        ];
    });

    function handleModeSelect(value: string) {
        selectedMode.value = value;
    }

    return {
        javaAvailable,
        selectedMode,
        modeOptions,
        handleModeSelect
    };
}
