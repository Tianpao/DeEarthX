<script lang="ts" setup>
import { InboxOutlined, CloseCircleOutlined } from '@ant-design/icons-vue';
import { open } from '@tauri-apps/plugin-dialog';
import { computed } from 'vue';

interface FileItem {
    name: string;
    path: string;
}

const props = withDefaults(defineProps<{
    accept?: string[];
    multiple?: boolean;
    disabled?: boolean;
    files?: string[];
    title?: string;
    hint?: string;
}>(), {
    accept: () => ['zip', 'mrpack'],
    multiple: false,
    disabled: false,
    files: () => [],
    title: '点击或拖拽文件到此区域',
    hint: '支持 .zip, .mrpack 格式'
});

const emit = defineEmits<{
    (e: 'update:files', files: string[]): void;
    (e: 'remove', index: number): void;
}>();

const fileItems = computed<FileItem[]>(() => {
    return props.files.map(path => ({
        name: path.substring(Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/')) + 1),
        path
    }));
});

const hasFiles = computed(() => props.files.length > 0);

async function handleUploadClick() {
    if (props.disabled) return;

    try {
        const selected = await open({
            multiple: props.multiple,
            filters: [
                {
                    name: 'Files',
                    extensions: props.accept
                }
            ]
        });

        if (selected) {
            const paths = Array.isArray(selected) ? selected : [selected];
            if (props.multiple) {
                emit('update:files', [...props.files, ...paths]);
            } else {
                emit('update:files', paths);
            }
        }
    } catch (error) {
        console.error('文件选择失败:', error);
    }
}

function handleRemove(index: number) {
    emit('remove', index);
}
</script>

<template>
    <div>
        <!-- 点击打开文件选择对话框 -->
        <div
            @click="handleUploadClick"
            :class="[
                'tw:flex tw:flex-col tw:items-center tw:justify-center',
                'tw:border-2 tw:border-dashed tw:rounded-lg tw:cursor-pointer tw:transition-all',
                disabled ? 'tw:border-slate-200 tw:bg-slate-50 tw:cursor-not-allowed' : 'tw:border-slate-300 tw:bg-white hover:tw:border-[#67eac3]'
            ]"
            :style="{ height: multiple ? 'auto' : '192px', padding: multiple ? '32px' : '0' }">
            <p class="tw:text-slate-400 tw:text-4xl">
                <InboxOutlined />
            </p>
            <p class="tw:text-slate-700 tw:mt-2">{{ title }}</p>
            <p class="tw:text-sm tw:text-slate-500 tw:mt-1">{{ hint }}</p>
        </div>

        <!-- 统一的文件列表显示 -->
        <div v-if="hasFiles" class="tw:mt-2 tw:space-y-1">
            <div
                v-for="(file, index) in fileItems"
                :key="index"
                class="tw:px-3 tw:py-2 tw:bg-[#e8fff5] tw:rounded-lg tw:border tw:border-[#67eac3] tw:flex tw:items-center tw:justify-between">
                <span class="tw:text-[#10b981] tw:text-sm tw:truncate">{{ file.name }}</span>
                <a-button
                    type="text"
                    size="small"
                    @click="handleRemove(index)"
                    class="tw:text-gray-400 hover:tw:text-red-500 tw:flex-shrink-0">
                    <template #icon><CloseCircleOutlined /></template>
                </a-button>
            </div>
        </div>
    </div>
</template>