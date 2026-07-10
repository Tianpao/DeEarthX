import { ref } from 'vue';
import { message } from 'ant-design-vue';
import type { UploadFile, UploadChangeParam } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';

export function useFileUpload() {
    const { t } = useI18n();
    const uploadedFiles = ref<UploadFile[]>([]);
    const uploadDisabled = ref(false);

    function beforeUpload() {
        return false;
    }

    function handleFileChange(info: UploadChangeParam) {
        if (info.file.status === 'removed') {
            uploadDisabled.value = false;
            return;
        }

        if (info.file.status === 'uploading') {
            message.loading(t('home.preparing_file'));
            return;
        }

        if (info.file.status === 'done') {
            message.success(t('home.file_prepared'));
        }

        if (!info.file.name?.endsWith('.zip') && !info.file.name?.endsWith('.mrpack')) {
            message.error(t('home.only_zip_mrpack'));
            return;
        }
        uploadDisabled.value = true;
    }

    function handleFileDrop(e: DragEvent) {
        console.log(e);
    }

    function resetFileUpload() {
        uploadedFiles.value = [];
        uploadDisabled.value = false;
    }

    return {
        uploadedFiles,
        uploadDisabled,
        beforeUpload,
        handleFileChange,
        handleFileDrop,
        resetFileUpload
    };
}
