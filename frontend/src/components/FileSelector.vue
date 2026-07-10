<script lang="ts" setup>
import { InboxOutlined, CloseCircleOutlined } from '@ant-design/icons-vue';
import { computed, ref } from 'vue';
import { DialogService } from '@/bindings/deearthx/core/services';

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

const isDragOver = ref(false);

const fileItems = computed(() => {
    return props.files.map(path => ({
        name: path.substring(Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/')) + 1),
        path
    }));
});

const hasFiles = computed(() => props.files.length > 0);

async function handleClick() {
    if (props.disabled || hasFiles.value) return;
    const extensions = props.accept.map(e => '*.' + e);
    const path = await DialogService.OpenFile(extensions);
    if (path) {
        emit('update:files', [path]);
    }
}

function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (!props.disabled && !hasFiles.value) {
        isDragOver.value = true;
    }
}

function handleDragLeave(e: DragEvent) {
    isDragOver.value = false;
}

// Do NOT handle drop ourselves — let Wails runtime capture it for real paths.
// The file_drop Wails event will set the paths via useDragDrop.
function handleDrop(e: DragEvent) {
    isDragOver.value = false;
}

function handleRemove(index: number) {
    emit('remove', index);
}
</script>

<template>
    <div>
        <div
            data-file-drop-target
            @click="handleClick"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
            :class="[
                'tw:flex tw:flex-col tw:items-center tw:justify-center',
                'tw:border-2 tw:border-dashed tw:rounded-lg tw:transition-all',
                isDragOver ? 'tw:border-[#67eac3] tw:bg-[#e8fff5]' :
                (disabled || hasFiles) ? 'tw:border-slate-200 tw:bg-slate-50 tw:cursor-not-allowed' :
                'tw:border-slate-300 tw:bg-white hover:tw:border-[#67eac3] tw:cursor-pointer'
            ]"
            :style="{ height: multiple ? 'auto' : '192px', padding: multiple ? '32px' : '0' }">
            <p class="tw:text-slate-400 tw:text-4xl"><InboxOutlined /></p>
            <p class="tw:text-slate-700 tw:mt-2">{{ isDragOver ? '放开以上传' : title }}</p>
            <p class="tw:text-sm tw:text-slate-500 tw:mt-1">{{ hint }}</p>
        </div>

        <div v-if="hasFiles" class="tw:mt-2 tw:space-y-1">
            <div
                v-for="(file, index) in fileItems"
                :key="index"
                class="tw:px-3 tw:py-2 tw:bg-[#e8fff5] tw:rounded-lg tw:border tw:border-[#67eac3] tw:flex tw:items-center tw:justify-between">
                <span class="tw:text-[#10b981] tw:text-sm tw:truncate">{{ file.name }}</span>
                <a-button type="text" size="small" @click="handleRemove(index)" class="tw:text-gray-400 hover:tw:text-red-500 tw:flex-shrink-0">
                    <template #icon><CloseCircleOutlined /></template>
                </a-button>
            </div>
        </div>
    </div>
</template>
