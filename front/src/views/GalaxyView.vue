<template>
    <div class="tw:h-full tw:w-full tw:overflow-y-auto tw:p-6">
        <div class="tw:mx-auto tw:flex tw:w-full tw:max-w-4xl tw:flex-col tw:gap-6">
            <div>
                <h1 class="tw:text-2xl tw:font-semibold tw:text-slate-900">{{ t('galaxy.title') }}</h1>
                <p class="tw:mt-1 tw:text-sm tw:text-slate-500">{{ t('galaxy.subtitle') }}</p>
            </div>

            <section class="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:shadow-sm">
                <div class="tw:mb-5">
                    <h2 class="tw:text-lg tw:font-semibold tw:text-slate-900">{{ t('galaxy.mod_submit_title') }}</h2>
                    <p class="tw:mt-1 tw:text-sm tw:text-slate-500">{{ t('galaxy.mod_submit_desc') }}</p>
                </div>

                <div class="tw:flex tw:flex-col tw:gap-4">
                    <div class="tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-4">
                        <label class="tw:mb-2 tw:block tw:text-sm tw:font-medium tw:text-slate-700">
                            {{ t('galaxy.mod_type_label') }}
                        </label>
                        <a-radio-group v-model:value="modType" size="default" button-style="solid">
                            <a-radio-button value="client">{{ t('galaxy.mod_type_client') }}</a-radio-button>
                            <a-radio-button value="server">{{ t('galaxy.mod_type_server') }}</a-radio-button>
                        </a-radio-group>
                    </div>

                    <div class="tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-4">
                        <label class="tw:mb-2 tw:block tw:text-sm tw:font-medium tw:text-slate-700">
                            {{ t('galaxy.modid_label') }}
                        </label>
                        <a-input
                            v-model:value="modidInput"
                            :placeholder="t('galaxy.modid_placeholder')"
                            size="large"
                            allow-clear
                        />
                        <p class="tw:mt-2 tw:text-xs tw:text-slate-400">
                            {{ t('galaxy.modid_count', { count: modidList.length }) }}
                        </p>
                    </div>

                    <div class="tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-4">
                        <label class="tw:mb-2 tw:block tw:text-sm tw:font-medium tw:text-slate-700">
                            {{ t('galaxy.upload_file_label') }}
                        </label>
                        <FileSelector
                            :accept="['jar']"
                            :multiple="true"
                            v-model:files="droppedFiles"
                            @remove="handleRemoveFile"
                            :title="t('galaxy.upload_file_hint')"
                            :hint="t('galaxy.upload_file_support')"
                        />

                        <div v-if="droppedFiles.length > 0" class="tw:mt-4">
                            <div v-if="uploading" class="tw:mb-4">
                                <a-progress :percent="uploadProgress" :status="uploadProgress === 100 ? 'success' : 'active'" />
                            </div>
                            <a-button
                                type="primary"
                                size="large"
                                :loading="uploading"
                                block
                                @click="handleUpload"
                            >
                                <template #icon>
                                    <UploadOutlined />
                                </template>
                                {{ uploading ? t('galaxy.uploading') : t('galaxy.start_upload') }}
                            </a-button>
                        </div>
                    </div>

                    <div v-if="modidList.length > 0" class="tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-4">
                        <a-button
                            type="primary"
                            size="large"
                            :loading="submitting"
                            block
                            @click="handleSubmit"
                        >
                            <template #icon>
                                <SendOutlined />
                            </template>
                            {{ submitting ? t('galaxy.submitting') : t('galaxy.submit', { type: modType === 'client' ? t('galaxy.mod_type_client') : t('galaxy.mod_type_server') }) }}
                        </a-button>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, inject, watch } from 'vue';
import { UploadOutlined, SendOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import axiosInstance from '@/utils/axios';
import FileSelector from '@/components/FileSelector.vue';

const { t } = useI18n();
const droppedFilePaths = inject<ReturnType<typeof import('@/composables/useDragDrop').useDragDrop>['droppedFilePaths']>('droppedFilePaths');
const clearDroppedFile = inject<(() => void) | undefined>('clearDroppedFile');

const modType = ref<'client' | 'server'>('client');
const modidList = ref<string[]>([]);
const uploading = ref(false);
const submitting = ref(false);
const uploadProgress = ref(0);

// 文件路径列表
const droppedFiles = ref<string[]>([]);

const modidInput = computed({
    get: () => modidList.value.join(','),
    set: (value: string) => {
        modidList.value = value
            .split(',')
            .map(id => id.trim())
            .filter(id => id.length > 0);
    }
});

function handleRemoveFile(index: number) {
    droppedFiles.value = droppedFiles.value.filter((_, i) => i !== index);
}

// 监听拖放
watch(() => droppedFilePaths && 'value' in droppedFilePaths ? droppedFilePaths.value : [], (paths) => {
    if (paths.length > 0) {
        const validExtensions = ['.jar'];
        const validFiles = paths.filter(p => {
            const ext = p.toLowerCase().substring(p.lastIndexOf('.'));
            return validExtensions.includes(ext);
        });
        if (validFiles.length === 0) {
            message.warning(t('galaxy.only_jar'));
            if (clearDroppedFile) {
                clearDroppedFile();
            }
        } else {
            droppedFiles.value = [...droppedFiles.value, ...validFiles];
            if (clearDroppedFile) {
                clearDroppedFile();
            }
        }
    }
});

const handleUpload = async () => {
    if (droppedFiles.value.length === 0) {
        message.warning(t('galaxy.please_select_file'));
        return;
    }

    uploading.value = true;
    uploadProgress.value = 0;

    try {
        const paths = droppedFiles.value;
        const response = await axiosInstance.post('http://localhost:37019/galaxy/upload-path', { paths });

        if (response.data.modids && Array.isArray(response.data.modids)) {
            let addedCount = 0;
            response.data.modids.forEach((modid: string) => {
                if (modid && !modidList.value.includes(modid)) {
                    modidList.value.push(modid);
                    addedCount++;
                }
            });
            message.success(t('galaxy.upload_success', { count: addedCount }));
        } else {
            message.error(t('galaxy.data_format_error'));
        }
    } catch (error) {
        console.error('上传失败:', error);
        message.error(t('galaxy.upload_error'));
    } finally {
        uploading.value = false;
        droppedFiles.value = [];
        uploadProgress.value = 0;
    }
};

const handleSubmit = () => {
    const modTypeText = modType.value === 'client' ? t('galaxy.mod_type_client') : t('galaxy.mod_type_server');
    Modal.confirm({
        title: t('galaxy.submit_confirm_title'),
        content: t('galaxy.submit_confirm_content', { count: modidList.value.length, type: modTypeText }),
        okText: t('common.confirm'),
        cancelText: t('common.cancel'),
        onOk: async () => {
            submitting.value = true;
            try {
                const apiUrl = modType.value === 'client'
                    ? 'http://localhost:37019/galaxy/submit/client'
                    : 'http://localhost:37019/galaxy/submit/server';

                const response = await axiosInstance.post(apiUrl,{
                    modids: modidList.value,
                });

                if (response.status === 200) {
                    message.success(t('galaxy.submit_success', { type: modTypeText }));
                    modidList.value = [];
                } else {
                    message.error(t('galaxy.submit_failed'));
                }
            } catch (error) {
                message.error(t('galaxy.submit_error'));
            } finally {
                submitting.value = false;
            }
        },
    });
};
</script>