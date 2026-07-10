<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SelectProps } from 'ant-design-vue/es/vc-select';

const { t } = useI18n();

interface Props {
    modelValue: string;
    javaAvailable: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    'update:modelValue': [value: string];
    'select': [value: string];
}>();

const modeOptions = computed<SelectProps['options']>(() => {
    return [
        { label: t('home.mode_server'), value: 'server', disabled: !props.javaAvailable },
        { label: t('home.mode_upload'), value: 'upload', disabled: false }
    ];
});

function handleSelect(value: string) {
    emit('update:modelValue', value);
    emit('select', value);
}
</script>

<template>
    <div>
        <h2 class="tw:text-sm tw:font-semibold tw:text-gray-700 tw:mb-3">
            {{ t('home.mode_title') }}
        </h2>
        <a-select
            :value="modelValue"
            :options="modeOptions"
            @select="handleSelect"
            class="tw:w-full"
        />
    </div>
</template>
