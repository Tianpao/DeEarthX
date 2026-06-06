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
                    <p class="tw:mt-1 tw:text-sm tw:text-slate-500">上传模组文件或填写 modid，然后提交到 Galaxy Square。</p>
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
                        <a-upload-dragger
                            :fileList="fileList"
                            :before-upload="beforeUpload"
                            @remove="handleRemove"
                            accept=".jar"
                            multiple
                        >
                            <p class="tw-ant-upload-drag-icon">
                                <InboxOutlined />
                            </p>
                            <p class="tw-ant-upload-text">{{ t('galaxy.upload_file_hint') }}</p>
                            <p class="tw-ant-upload-hint">
                                {{ t('galaxy.upload_file_support') }}
                            </p>
                        </a-upload-dragger>

                        <div v-if="hasDroppedFiles" class="tw:mt-3 tw:rounded-lg tw:border tw:border-emerald-200 tw:bg-emerald-50 tw:p-3">
                            <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
                                <span class="tw:text-sm tw:text-emerald-700">{{ t('galaxy.files_dropped', { count: droppedFilesCount }) }}</span>
                                <a-button type="text" size="small" @click="handleClearDroppedFile" class="tw:text-slate-400 hover:tw:text-red-500">
                                    <template #icon><CloseCircleOutlined /></template>
                                </a-button>
                            </div>
                            <div class="tw:mt-2 tw:max-h-20 tw:overflow-y-auto tw:space-y-1">
                                <div v-for="(name, idx) in droppedFilesNames" :key="idx" class="tw:text-xs tw:text-slate-500 tw:truncate">
                                    {{ name }}
                                </div>
                            </div>
                        </div>

                        <div v-if="fileList.length > 0 || hasDroppedFiles" class="tw:mt-4">
                            <p v-if="fileList.length > 0" class="tw:mb-2 tw:text-sm tw:font-medium tw:text-slate-700">
                                {{ t('galaxy.file_selected', { count: fileList.length }) }}
                            </p>
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
import { UploadOutlined, InboxOutlined, SendOutlined, CloseCircleOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import type { UploadFile, UploadProps } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import axiosInstance from '@/utils/axios';

const { t } = useI18n();
const droppedFilePaths = inject<ReturnType<typeof import('@/composables/useDragDrop').useDragDrop>['droppedFilePaths']>('droppedFilePaths');
const clearDroppedFile = inject<(() => void) | undefined>('clearDroppedFile');

const modType = ref<'client' | 'server'>('client');
const modidList = ref<string[]>([]);
const uploading = ref(false);
const submitting = ref(false);
const fileList = ref<UploadFile[]>([]);
const uploadProgress = ref(0);

const modidInput = computed({
    get: () => modidList.value.join(','),
    set: (value: string) => {
        modidList.value = value
            .split(',')
            .map(id => id.trim())
            .filter(id => id.length > 0);
    }
});

const validDroppedFiles = computed(() => {
    if (droppedFilePaths && 'value' in droppedFilePaths && droppedFilePaths.value.length > 0) {
        const validExtensions = ['.jar'];
        return droppedFilePaths.value.filter(path => {
            const ext = path.toLowerCase().substring(path.lastIndexOf('.'));
            return validExtensions.includes(ext);
        });
    }
    return [];
});

const hasDroppedFiles = computed(() => validDroppedFiles.value.length > 0);
const droppedFilesCount = computed(() => validDroppedFiles.value.length);
const droppedFilesNames = computed(() => {
    return validDroppedFiles.value.map(path => {
        return path.substring(Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/')) + 1);
    });
});

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
        }
    }
});

function handleClearDroppedFile() {
    if (clearDroppedFile) {
        clearDroppedFile();
    }
}

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    console.log(file.name);
    const uploadFile: UploadFile = {
        uid: `${Date.now()}-${Math.random()}`,
        name: file.name,
        status: 'done',
        url: '',
        originFileObj: file,
    };
    fileList.value = [...fileList.value, uploadFile];
    return false;
};

const handleRemove: UploadProps['onRemove'] = (file) => {
    const index = fileList.value.indexOf(file);
    const newFileList = fileList.value.slice();
    newFileList.splice(index, 1);
    fileList.value = newFileList;
};

const handleUpload = async () => {
    const hasFiles = fileList.value.length > 0;
    const hasPaths = hasDroppedFiles.value;

    if (!hasFiles && !hasPaths) {
        message.warning(t('galaxy.please_select_file'));
        return;
    }

    uploading.value = true;
    uploadProgress.value = 0;

    try {
        if (hasPaths) {
            const paths = validDroppedFiles.value;
            await new Promise((resolve, reject) => {
                axiosInstance.post('http://localhost:37019/galaxy/upload-path', { paths })
                    .then(response => {
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
                        resolve(response);
                    })
                    .catch(error => {
                        message.error(t('galaxy.upload_error'));
                        reject(error);
                    });
            });
            handleClearDroppedFile();
        } else {
            const formData = new FormData();
            fileList.value.forEach((file) => {
                if (file.originFileObj) {
                    const blob = file.originFileObj;
                    const encodedFileName = encodeURIComponent(file.name);
                    const fileWithCorrectName = new File([blob], encodedFileName, { type: blob.type });
                    formData.append('files', fileWithCorrectName);
                }
            });

            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', 'http://localhost:37019/galaxy/upload', true);

                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        uploadProgress.value = Math.round((event.loaded / event.total) * 100);
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const data = JSON.parse(xhr.responseText);
                            console.log(data);
                            if (data.modids && Array.isArray(data.modids)) {
                                let addedCount = 0;
                                data.modids.forEach((modid: string) => {
                                    if (modid && !modidList.value.includes(modid)) {
                                        modidList.value.push(modid);
                                        addedCount++;
                                    }
                                });
                                message.success(t('galaxy.upload_success', { count: addedCount }));
                            } else {
                                message.error(t('galaxy.data_format_error'));
                            }
                            resolve(xhr.responseText);
                        } catch (e) {
                            message.error(t('galaxy.data_format_error'));
                            reject(e);
                        }
                    } else {
                        message.error(t('galaxy.upload_failed'));
                        reject(new Error(`HTTP ${xhr.status}`));
                    }
                });

                xhr.addEventListener('error', () => {
                    message.error(t('galaxy.upload_error'));
                    reject(new Error('网络错误'));
                });

                xhr.addEventListener('abort', () => {
                    message.error(t('galaxy.upload_error'));
                    reject(new Error('上传已取消'));
                });

                xhr.send(formData);
            });
        }
    } catch (error) {
        console.error('上传失败:', error);
    } finally {
        uploading.value = false;
        fileList.value = [];
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
