import { ref, computed, onMounted } from 'vue';
import type { SelectProps } from 'ant-design-vue/es/vc-select';
import { useI18n } from 'vue-i18n';
import { JavaService } from '@/bindings/deearthx/core/services';

export function useModeSelection() {
    const { t } = useI18n();
    const javaAvailable = ref(false);
    const selectedMode = ref('upload');

    const modeOptions = computed<SelectProps['options']>(() => {
        return [
            { label: t('home.mode_server'), value: 'server', disabled: !javaAvailable.value },
            { label: t('home.mode_upload'), value: 'upload', disabled: false }
        ];
    });

    async function checkJava() {
        try {
            const result = await JavaService.CheckJava('');
            javaAvailable.value = !!result?.exists;
        } catch {
            javaAvailable.value = false;
        }
        if (!javaAvailable.value && selectedMode.value === 'server') {
            selectedMode.value = 'upload';
        } else if (javaAvailable.value && selectedMode.value === 'upload') {
            selectedMode.value = 'server';
        }
    }

    function handleModeSelect(value: string) {
        selectedMode.value = value;
    }

    onMounted(() => {
        checkJava();
    });

    return {
        javaAvailable,
        selectedMode,
        modeOptions,
        handleModeSelect,
        checkJava
    };
}
