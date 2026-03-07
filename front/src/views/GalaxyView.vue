<template>
    <div class="tw:h-full tw:w-full tw:p-4 tw:overflow-auto tw:bg-gray-50">
        <div class="tw:max-w-2xl tw:mx-auto">
            <div class="tw:text-center tw:mb-8">
                <h1 class="tw:text-2xl tw:font-bold tw:tracking-tight">
                    <span
                        class="tw:bg-gradient-to-r tw:from-cyan-300 tw:to-purple-950 tw:bg-clip-text tw:text-transparent">
                        {{ t('galaxy.title') }}
                    </span>
                </h1>
                <p class="tw:text-gray-500 tw:mt-2">{{ t('galaxy.subtitle') }}</p>
            </div>

            <div class="tw:bg-white tw:rounded-lg tw:shadow-sm tw:p-6 tw:mb-6">
                <h2 class="tw:text-lg tw:font-semibold tw:text-gray-800 tw:mb-4 tw:flex tw:items-center tw:gap-2">
                    <span class="tw:w-2 tw:h-2 tw:bg-purple-500 tw:rounded-full"></span>
                    {{ t('galaxy.mod_submit_title') }}
                </h2>
                <div class="tw:flex tw:flex-col tw:gap-4">
                    <div>
                        <label class="tw:block tw:text-sm tw:font-medium tw:text-gray-700 tw:mb-2">
                            {{ t('galaxy.mod_type_label') }}
                        </label>
                        <a-radio-group v-model:value="modType" size="default" button-style="solid">
                            <a-radio-button value="client">{{ t('galaxy.mod_type_client') }}</a-radio-button>
                            <a-radio-button value="server">{{ t('galaxy.mod_type_server') }}</a-radio-button>
                        </a-radio-group>
                    </div>

                    <div>
                        <label class="tw:block tw:text-sm tw:font-medium tw:text-gray-700 tw:mb-2">
                            {{ t('galaxy.modid_label') }}
                        </label>
                        <a-input
                            v-model:value="modidInput"
                            :placeholder="t('galaxy.modid_placeholder')"
                            size="large"
                            allow-clear
                        />
                        <p class="tw:text-xs tw:text-gray-400 tw:mt-1">
                            {{ t('galaxy.modid_count', { count: modidList.length }) }}
                        </p>
                    </div>

                    <div>
                        <label class="tw:block tw:text-sm tw:font-medium tw:text-gray-700 tw:mb-2">
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

                        <div v-if="fileList.length > 0" class="tw:mt-4">
                            <p class="tw:text-sm tw:font-medium tw:text-gray-700 tw:mb-2">
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

                    <div v-if="modidList.length > 0" class="tw:mt-2">
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
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { UploadOutlined, InboxOutlined, SendOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import type { UploadFile, UploadProps } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

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
    if (fileList.value.length === 0) {
        message.warning(t('galaxy.please_select_file'));
        return;
    }

    uploading.value = true;
    uploadProgress.value = 0;

    const formData = new FormData();
    fileList.value.forEach((file) => {
        if (file.originFileObj) {
            const blob = file.originFileObj;
            const encodedFileName = encodeURIComponent(file.name);
            const fileWithCorrectName = new File([blob], encodedFileName, { type: blob.type });
            formData.append('files', fileWithCorrectName);
        }
    });

    try {
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

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        modids: modidList.value,
                    }),
                });

                if (response.ok) {
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
