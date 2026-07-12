<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, DeleteOutlined, FolderOutlined, ExclamationCircleOutlined, EditOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import axiosInstance from '@/utils/axios';

const { t } = useI18n();

interface Template {
    id: string;
    metadata: {
        name: string;
        version: string;
        description: string;
        author: string;
        created: string;
        type: string;
    };
}

const templates = ref<Template[]>([]);
const loading = ref(false);
const showCreateModal = ref(false);
const showDeleteModal = ref(false);
const showEditModal = ref(false);
const deletingTemplate = ref<Template | null>(null);
const editingTemplate = ref<Template | null>(null);

const newTemplate = ref({
    name: '',
    version: '1.0.0',
    description: '',
    author: ''
});

async function loadTemplates() {
    loading.value = true;
    try {
        const response = await axiosInstance.get('/templates');
        const result = response.data;

        if (result.status === 200 && result.data) {
            templates.value = result.data;
        } else {
            message.error(t('home.template_load_failed'));
        }
    } catch (error) {
        console.error('加载模板列表失败:', error);
        message.error(t('home.template_load_failed'));
    } finally {
        loading.value = false;
    }
}

function openCreateModal() {
    newTemplate.value = {
        name: '',
        version: '1.0.0',
        description: '',
        author: ''
    };
    showCreateModal.value = true;
}

async function createTemplate() {
    if (!newTemplate.value.name) {
        message.error(t('template.name_required'));
        return;
    }

    try {
        const response = await axiosInstance.post('/templates', newTemplate.value);
        const result = response.data;

        if (result.status === 200) {
            message.success(t('template.create_success'));
            showCreateModal.value = false;
            await loadTemplates();
        } else {
            message.error(result.message || t('template.create_failed'));
        }
    } catch (error) {
        console.error('创建模板失败:', error);
        message.error(t('template.create_failed'));
    }
}

function openDeleteModal(template: Template) {
    deletingTemplate.value = template;
    showDeleteModal.value = true;
}

async function confirmDelete() {
    if (!deletingTemplate.value) return;

    try {
        const response = await axiosInstance.delete(`/templates/${deletingTemplate.value.id}`);
        const result = response.data;

        if (result.status === 200) {
            message.success(t('template.delete_success'));
            showDeleteModal.value = false;
            await loadTemplates();
        } else {
            message.error(result.message || t('template.delete_failed'));
        }
    } catch (error) {
        console.error('删除模板失败:', error);
        message.error(t('template.delete_failed'));
    }
}

async function openTemplateFolder(template: Template) {
    try {
        const response = await axiosInstance.get(`/templates/${template.id}/path`);
        const result = response.data;

        if (result.status !== 200) {
            message.error(result.message || t('template.open_folder_failed'));
        }
    } catch (error) {
        console.error('打开文件夹失败:', error);
        message.error(t('template.open_folder_failed'));
    }
}

function openEditModal(template: Template) {
    editingTemplate.value = template;
    newTemplate.value = {
        name: template.metadata.name,
        version: template.metadata.version,
        description: template.metadata.description,
        author: template.metadata.author
    };
    showEditModal.value = true;
}

async function updateTemplate() {
    if (!editingTemplate.value || !newTemplate.value.name) {
        message.error(t('template.name_required'));
        return;
    }

    try {
        const response = await axiosInstance.put(`/templates/${editingTemplate.value.id}`, newTemplate.value);
        const result = response.data;

        if (result.status === 200) {
            message.success(t('template.update_success'));
            showEditModal.value = false;
            await loadTemplates();
        } else {
            message.error(result.message || t('template.update_failed'));
        }
    } catch (error) {
        console.error('更新模板失败:', error);
        message.error(t('template.update_failed'));
    }
}

onMounted(() => {
    loadTemplates();
});
</script>

<template>
    <div class="tw:h-full tw:w-full tw:overflow-y-auto tw:p-6">
        <div class="tw:mx-auto tw:flex tw:w-full tw:max-w-6xl tw:flex-col tw:gap-6">
            <div class="tw:flex tw:flex-col tw:gap-3 md:tw:flex-row md:tw:items-end md:tw:justify-between">
                <div>
                    <h1 class="tw:text-2xl tw:font-semibold tw:text-slate-900">{{ t('template.title') }}</h1>
                    <p class="tw:mt-1 tw:text-sm tw:text-slate-500">{{ t('template.description') }}</p>
                </div>
                <a-button type="primary" @click="openCreateModal" class="template-action-button tw:w-full md:tw:w-auto">
                    <template #icon>
                        <PlusOutlined />
                    </template>
                    <span>{{ t('template.create_button') }}</span>
                </a-button>
            </div>

            <section class="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:shadow-sm">
                <a-spin :spinning="loading">
                    <div v-if="templates.length === 0 && !loading" class="tw:flex tw:flex-col tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-dashed tw:border-slate-200 tw:bg-slate-50 tw:px-6 tw:py-16 tw:text-center">
                        <div class="tw:mb-4 tw:flex tw:h-14 tw:w-14 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-slate-200 tw:bg-white tw:text-slate-400">
                            <FolderOutlined style="font-size: 26px;" />
                        </div>
                        <p class="tw:text-base tw:font-medium tw:text-slate-700">{{ t('template.empty') }}</p>
                        <p class="tw:mt-2 tw:max-w-md tw:text-sm tw:text-slate-500">{{ t('template.empty_hint') }}</p>
                    </div>

                    <div v-else class="tw:grid tw:grid-cols-1 tw:gap-4 md:tw:grid-cols-2 xl:tw:grid-cols-3">
                        <article
                            v-for="template in templates"
                            :key="template.id"
                            class="tw:flex tw:min-h-[220px] tw:flex-col tw:rounded-xl tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-5 tw:shadow-sm tw:transition-colors hover:tw:border-slate-300"
                        >
                            <div class="tw:flex tw:items-start tw:justify-between tw:gap-3">
                                <div class="tw:min-w-0 tw:flex-1">
                                    <h3 class="tw:truncate tw:text-base tw:font-semibold tw:text-slate-900">{{ template.metadata.name }}</h3>
                                    <p class="tw:mt-2 tw:line-clamp-3 tw:text-sm tw:leading-6 tw:text-slate-500">{{ template.metadata.description }}</p>
                                </div>
                                <a-tag color="blue">{{ template.metadata.version }}</a-tag>
                            </div>

                            <div class="tw:mt-5 tw:grid tw:grid-cols-2 tw:gap-3 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-white tw:p-3">
                                <div class="tw:min-w-0">
                                    <div class="tw:text-xs tw:text-slate-400">{{ t('template.author') }}</div>
                                    <div class="tw:truncate tw:text-sm tw:text-slate-700">{{ template.metadata.author || '-' }}</div>
                                </div>
                                <div class="tw:min-w-0">
                                    <div class="tw:text-xs tw:text-slate-400">Created</div>
                                    <div class="tw:truncate tw:text-sm tw:text-slate-700">{{ template.metadata.created }}</div>
                                </div>
                            </div>

                            <div class="tw:mt-4 tw:flex tw:flex-wrap tw:gap-2 tw:border-t tw:border-slate-200 tw:pt-4">
                                <a-button size="small" @click="openTemplateFolder(template)" class="template-action-button template-action-button--subtle">
                                    <template #icon>
                                        <FolderOutlined />
                                    </template>
                                    <span>{{ t('template.open_folder') }}</span>
                                </a-button>
                                <a-button size="small" @click="openEditModal(template)" class="template-action-button template-action-button--subtle">
                                    <template #icon>
                                        <EditOutlined />
                                    </template>
                                    <span>{{ t('template.edit_button') }}</span>
                                </a-button>
                                <a-button size="small" danger @click="openDeleteModal(template)" class="template-action-button template-action-button--danger">
                                    <template #icon>
                                        <DeleteOutlined />
                                    </template>
                                    <span>{{ t('template.delete_button') }}</span>
                                </a-button>
                            </div>
                        </article>
                    </div>
                </a-spin>
            </section>
        </div>

        <a-modal
            v-model:open="showCreateModal"
            :title="t('template.create_title')"
            @ok="createTemplate"
            :ok-text="t('common.confirm')"
            :cancel-text="t('common.cancel')"
        >
            <a-form layout="vertical">
                <a-form-item :label="t('template.name')" required>
                    <a-input v-model:value="newTemplate.name" :placeholder="t('template.name_placeholder')" />
                </a-form-item>
                <a-form-item :label="t('template.version')">
                    <a-input v-model:value="newTemplate.version" :placeholder="t('template.version_placeholder')" />
                </a-form-item>
                <a-form-item :label="t('template.description')">
                    <a-textarea v-model:value="newTemplate.description" :placeholder="t('template.description_placeholder')" :rows="4" />
                </a-form-item>
                <a-form-item :label="t('template.author')">
                    <a-input v-model:value="newTemplate.author" :placeholder="t('template.author_placeholder')" />
                </a-form-item>
            </a-form>
        </a-modal>

        <a-modal
            v-model:open="showDeleteModal"
            :title="t('template.delete_title')"
            @ok="confirmDelete"
            :ok-text="t('common.confirm')"
            :cancel-text="t('common.cancel')"
            ok-type="danger"
        >
            <div class="tw:flex tw:items-start tw:gap-3">
                <ExclamationCircleOutlined style="font-size: 24px; color: #ff4d4f;" />
                <div>
                    <p class="tw:mb-2">{{ t('template.delete_confirm', { name: deletingTemplate?.metadata.name }) }}</p>
                    <p class="tw:text-sm tw:text-gray-500">{{ t('template.delete_warning') }}</p>
                </div>
            </div>
        </a-modal>

        <a-modal
            v-model:open="showEditModal"
            :title="t('template.edit_title')"
            @ok="updateTemplate"
            :ok-text="t('common.confirm')"
            :cancel-text="t('common.cancel')"
        >
            <a-form layout="vertical">
                <a-form-item :label="t('template.name')" required>
                    <a-input v-model:value="newTemplate.name" :placeholder="t('template.name_placeholder')" />
                </a-form-item>
                <a-form-item :label="t('template.version')">
                    <a-input v-model:value="newTemplate.version" :placeholder="t('template.version_placeholder')" />
                </a-form-item>
                <a-form-item :label="t('template.description')">
                    <a-textarea v-model:value="newTemplate.description" :placeholder="t('template.description_placeholder')" :rows="4" />
                </a-form-item>
                <a-form-item :label="t('template.author')">
                    <a-input v-model:value="newTemplate.author" :placeholder="t('template.author_placeholder')" />
                </a-form-item>
            </a-form>
        </a-modal>
    </div>
</template>

<style scoped>
.template-action-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    min-height: 34px;
    font-weight: 600;
}

.template-action-button :deep(.ant-btn-icon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
}

.template-action-button :deep(.ant-btn-icon .anticon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    line-height: 1;
    vertical-align: middle;
}

.template-action-button span {
    display: inline-flex;
    align-items: center;
    line-height: 1.1;
}

.template-action-button--subtle {
    border-color: #dbe5f0;
    background: #ffffff;
    color: #0f172a;
}

.template-action-button--subtle:hover {
    border-color: #8ddfc7;
    color: #0f172a;
}

.template-action-button--danger {
    font-weight: 600;
}
</style>
