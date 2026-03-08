<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, DeleteOutlined, FolderOutlined, ExclamationCircleOutlined, EditOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';

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
        const apiHost = import.meta.env.VITE_API_HOST || 'localhost';
        const apiPort = import.meta.env.VITE_API_PORT || '37019';
        const response = await fetch(`http://${apiHost}:${apiPort}/templates`);
        const result = await response.json();
        
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
        const apiHost = import.meta.env.VITE_API_HOST || 'localhost';
        const apiPort = import.meta.env.VITE_API_PORT || '37019';
        
        const response = await fetch(`http://${apiHost}:${apiPort}/templates`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newTemplate.value)
        });
        
        const result = await response.json();
        
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
        const apiHost = import.meta.env.VITE_API_HOST || 'localhost';
        const apiPort = import.meta.env.VITE_API_PORT || '37019';
        
        const response = await fetch(`http://${apiHost}:${apiPort}/templates/${deletingTemplate.value.id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
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
        const apiHost = import.meta.env.VITE_API_HOST || 'localhost';
        const apiPort = import.meta.env.VITE_API_PORT || '37019';
        
        const response = await fetch(`http://${apiHost}:${apiPort}/templates/${template.id}/path`);
        const result = await response.json();
        
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
        const apiHost = import.meta.env.VITE_API_HOST || 'localhost';
        const apiPort = import.meta.env.VITE_API_PORT || '37019';
        
        const response = await fetch(`http://${apiHost}:${apiPort}/templates/${editingTemplate.value.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newTemplate.value)
        });
        
        const result = await response.json();
        
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
    <div class="tw:h-full tw:w-full tw:p-6 tw:overflow-y-auto">
        <div class="tw:max-w-7xl tw:mx-auto">
            <div class="tw:flex tw-justify-between tw:items-center tw:mb-6">
                <div>
                    <h1 class="tw:text-2xl tw:font-bold tw:text-gray-800">{{ t('template.title') }}</h1>
                    <p class="tw:text-gray-600 tw:mt-1">{{ t('template.description') }}</p>
                </div>
                <a-button type="primary" @click="openCreateModal" class="tw:flex tw:items-center tw:gap-2">
                    <PlusOutlined />
                    {{ t('template.create_button') }}
                </a-button>
            </div>

            <a-spin :spinning="loading">
                <div v-if="templates.length === 0 && !loading" class="tw:text-center tw:py-16 tw:text-gray-500">
                    <FolderOutlined style="font-size: 64px; margin-bottom: 16px;" />
                    <p class="tw:text-lg">{{ t('template.empty') }}</p>
                    <p class="tw:text-sm tw:mt-2">{{ t('template.empty_hint') }}</p>
                </div>

                <div v-else class="tw:grid tw:grid-cols-1 md:tw:grid-cols-2 lg:tw:grid-cols-3 tw:gap-4">
                    <div 
                        v-for="template in templates" 
                        :key="template.id"
                        class="tw:bg-white tw:rounded-lg tw:shadow-md tw:p-5 tw:h-48 tw:flex tw:flex-col tw:border tw:border-gray-200 tw:transition-all tw:duration-300 hover:tw:shadow-lg hover:tw:border-blue-300"
                    >
                        <div class="tw:flex-1 tw:overflow-hidden">
                            <div class="tw-flex tw:justify-between tw:items-start tw:mb-2">
                                <h3 class="tw:text-lg tw:font-semibold tw:truncate tw:flex-1 tw:mr-2">{{ template.metadata.name }}</h3>
                                <a-tag color="blue" size="small">{{ template.metadata.version }}</a-tag>
                            </div>
                            <p class="tw:text-sm tw:text-gray-600 tw:line-clamp-2 tw:mb-3">{{ template.metadata.description }}</p>
                            <div class="tw:flex tw-justify-between tw:text-xs tw:text-gray-500">
                                <span>{{ t('template.author') }}: {{ template.metadata.author }}</span>
                                <span>{{ template.metadata.created }}</span>
                            </div>
                        </div>
                        <div class="tw:flex tw-justify-between tw:items-center tw:mt-4 tw:pt-4 tw:border-t tw:border-gray-100">
                            <a-button size="small" @click="openTemplateFolder(template)">
                                <div class="tw:flex tw:items-center tw:gap-1">
                                    <FolderOutlined />
                                    <span>{{ t('template.open_folder') }}</span>
                                </div>
                            </a-button>
                            <div class="tw:flex tw:gap-2">
                                <a-button size="small" @click="openEditModal(template)">
                                    <div class="tw:flex tw:items-center tw:gap-1">
                                        <EditOutlined />
                                        <span>{{ t('template.edit_button') }}</span>
                                    </div>
                                </a-button>
                                <a-button size="small" danger @click="openDeleteModal(template)">
                                    <div class="tw:flex tw:items-center tw:gap-1">
                                        <DeleteOutlined />
                                        <span>{{ t('template.delete_button') }}</span>
                                    </div>
                                </a-button>
                            </div>
                        </div>
                    </div>
                </div>
            </a-spin>
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