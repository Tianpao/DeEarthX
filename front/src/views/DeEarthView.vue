<script lang="ts" setup>
import { ref } from 'vue';
import { message } from 'ant-design-vue';
import { InboxOutlined, FileSearchOutlined, FolderOpenOutlined } from '@ant-design/icons-vue';
import type { UploadFile, UploadProps } from 'ant-design-vue';
import { Upload } from 'ant-design-vue';
import { open } from '@tauri-apps/plugin-dialog';

interface SingleCheckResult {
    source: string;
    clientSide: 'required' | 'optional' | 'unsupported' | 'unknown';
    serverSide: 'required' | 'optional' | 'unsupported' | 'unknown';
    checked: boolean;
    error?: string;
}

interface ModCheckResult {
    filename: string;
    filePath: string;
    clientSide: 'required' | 'optional' | 'unsupported' | 'unknown';
    serverSide: 'required' | 'optional' | 'unsupported' | 'unknown';
    source: string;
    checked: boolean;
    errors?: string[];
    allResults: SingleCheckResult[];
    modId?: string;
    iconUrl?: string;
    description?: string;
    author?: string;
}

const fileList = ref<UploadFile[]>([]);
const checking = ref(false);
const results = ref<ModCheckResult[]>([]);
const showResults = ref(false);
const uploadProgress = ref(0);

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    if (!file.name.endsWith('.jar')) {
        message.error('只能上传 .jar 格式的模组文件');
        return Upload.LIST_IGNORE;
    }
    return true;
};

const handleChange: UploadProps['onChange'] = (info) => {
    if (info.fileList.length > 0) {
        const validFile = info.fileList.find(f => f.originFileObj?.name.endsWith('.jar'));
        if (validFile) {
            fileList.value = [validFile];
        } else {
            fileList.value = [];
        }
    } else {
        fileList.value = [];
    }
};

const handleRemove: UploadProps['onRemove'] = (file) => {
    const index = fileList.value.indexOf(file);
    const newFileList = fileList.value.slice();
    newFileList.splice(index, 1);
    fileList.value = newFileList;
};

async function handleCheck() {
    if (fileList.value.length === 0) {
        message.warning('请先选择模组文件');
        return;
    }

    checking.value = true;
    showResults.value = false;
    results.value = [];
    uploadProgress.value = 0;

    const formData = new FormData();
    fileList.value.forEach((file) => {
        if (file.originFileObj) {
            formData.append('files', file.originFileObj as any);
        }
    });

    try {
        await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'http://localhost:37019/modcheck/upload', true);

            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    uploadProgress.value = Math.round((event.loaded / event.total) * 100);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        results.value = data;
                        showResults.value = true;
                        message.success(`检查完成，共检查 ${data.length} 个模组`);
                        resolve(xhr.responseText);
                    } catch (e) {
                        reject(new Error('解析响应失败'));
                    }
                } else {
                    const errorText = xhr.responseText || `请求失败: ${xhr.status}`;
                    reject(new Error(errorText));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('网络错误'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('请求已取消'));
            });

            xhr.send(formData);
        });
    } catch (error: any) {
        console.error('检查失败:', error);
        message.error(`检查失败: ${error.message}`);
    } finally {
        checking.value = false;
        uploadProgress.value = 0;
    }
}

function getSingleCheckResult(allResults: SingleCheckResult[], source: string): SingleCheckResult | undefined {
    return allResults.find(r => r.source === source);
}

function getSideText(clientSide: string, serverSide: string): string {
    if (serverSide === 'required' || serverSide === 'optional') {
        return '服务端';
    }
    if (clientSide === 'required' || clientSide === 'optional') {
        return '客户端';
    }
    return '未知';
}

async function selectFolder() {
    try {
        const selected = await open({
            directory: true,
            multiple: false,
            title: '选择文件夹'
        });
        
        if (selected) {
            console.log('选择的文件夹路径:', selected);
            message.success(`已选择文件夹: ${selected}`);
        }
    } catch (error) {
        console.error('选择文件夹失败:', error);
        message.error('选择文件夹失败');
    }
}
</script>

<template>
    <div class="tw:h-full tw:w-full tw:flex tw:flex-col tw:p-4 md:tw:p-6 tw:overflow-auto">
        <div class="tw:mb-4 md:tw:mb-6">
            <h1 class="tw:text-xl md:tw:text-2xl tw:font-bold tw:mb-2">模组检查</h1>
            <p class="tw:text-gray-500 tw:text-sm md:tw:text-base">检查模组是否可以在客户端或服务端使用</p>
        </div>

        <a-card class="tw:mb-4 md:tw:mb-6">
            <div class="tw:mb-4">
                <a-button 
                    type="default" 
                    size="large" 
                    block 
                    @click="selectFolder"
                    class="tw:mb-4"
                >
                    <template #icon>
                        <FolderOpenOutlined />
                    </template>
                    选择文件夹
                </a-button>
            </div>

            <a-upload-dragger
                v-model:fileList="fileList"
                :before-upload="beforeUpload"
                @change="handleChange"
                @remove="handleRemove"
                accept=".jar"
                :multiple="false"
                :disabled="checking"
            >
                <p class="tw-ant-upload-drag-icon">
                    <InboxOutlined />
                </p>
                <p class="tw-ant-upload-text tw:text-sm md:tw:text-base">点击或拖拽模组文件到此区域</p>
                <p class="tw-ant-upload-hint tw:text-xs md:tw:text-sm">
                    支持 .jar 格式文件
                </p>
            </a-upload-dragger>

            <div v-if="fileList.length > 0" class="tw:mt-4">
                <p class="tw:text-sm tw:font-medium tw:text-gray-700 tw:mb-2">
                    已选择 {{ fileList.length }} 个文件
                </p>
                <div v-if="checking" class="tw:mb-4">
                    <a-progress :percent="uploadProgress" :status="uploadProgress === 100 ? 'success' : 'active'" />
                </div>
                <a-button
                    type="primary"
                    size="large"
                    :loading="checking"
                    block
                    @click="handleCheck"
                    :disabled="checking"
                >
                    <template #icon>
                        <FileSearchOutlined />
                    </template>
                    {{ checking ? '检查中...' : '开始检查' }}
                </a-button>
            </div>
        </a-card>

        <a-card v-if="showResults" title="检查结果">
            <div class="tw:overflow-x-auto">
                <a-table 
                    :dataSource="results" 
                    :pagination="{ pageSize: 10, size: 'small' }" 
                    :scroll="{ y: 300, x: 'max-content' }" 
                    size="small"
                    :bordered="true"
                >
                    <a-table-column title="模组信息" key="modInfo" :width="200">
                        <template #default="{ record }">
                            <div class="tw:flex tw:items-center tw:gap-2 md:tw:gap-3">
                                <div v-if="record.iconUrl" class="tw:w-8 tw:h-8 md:tw:w-10 md:tw:h-10 tw:flex-shrink-0">
                                    <img 
                                        :src="record.iconUrl" 
                                        alt="mod icon" 
                                        class="tw:w-full tw:h-full tw:object-cover tw:rounded"
                                        @error="($event.target as HTMLImageElement).style.display = 'none'"
                                    />
                                </div>
                                <div v-else class="tw:w-8 tw:h-8 md:tw:w-10 md:tw:h-10 tw:flex-shrink-0 tw:bg-gray-200 tw:rounded tw:flex tw:items-center tw:justify-center">
                                    <span class="tw:text-gray-400 tw:text-xs">无图标</span>
                                </div>
                                <div class="tw:overflow-hidden tw:flex-1 tw:min-w-0">
                                    <div class="tw:font-medium tw:truncate tw:text-sm md:tw:text-base">{{ record.filename }}</div>
                                    <div v-if="record.modId" class="tw:text-xs tw:text-gray-500 tw:truncate">ID: {{ record.modId }}</div>
                                    <div v-if="record.author" class="tw:text-xs tw:text-gray-400 tw:truncate">作者: {{ record.author }}</div>
                                </div>
                            </div>
                        </template>
                    </a-table-column>
                    <a-table-column title="哈希" key="hash" :width="80">
                        <template #default="{ record }">
                            <a-tag v-if="record.allResults" :color="getSideText(
                                getSingleCheckResult(record.allResults, 'Hash')?.clientSide || 'unknown',
                                getSingleCheckResult(record.allResults, 'Hash')?.serverSide || 'unknown'
                            ) === '服务端' ? 'blue' : 'purple'">
                                {{ getSideText(
                                    getSingleCheckResult(record.allResults, 'Hash')?.clientSide || 'unknown',
                                    getSingleCheckResult(record.allResults, 'Hash')?.serverSide || 'unknown'
                                ) }}
                            </a-tag>
                            <span v-else class="tw:text-gray-400">-</span>
                        </template>
                    </a-table-column>
                    <a-table-column title="GS" key="gs" :width="80">
                        <template #default="{ record }">
                            <a-tag v-if="record.allResults" :color="getSideText(
                                getSingleCheckResult(record.allResults, 'Dexpub')?.clientSide || 'unknown',
                                getSingleCheckResult(record.allResults, 'Dexpub')?.serverSide || 'unknown'
                            ) === '服务端' ? 'blue' : 'purple'">
                                {{ getSideText(
                                    getSingleCheckResult(record.allResults, 'Dexpub')?.clientSide || 'unknown',
                                    getSingleCheckResult(record.allResults, 'Dexpub')?.serverSide || 'unknown'
                                ) }}
                            </a-tag>
                            <span v-else class="tw:text-gray-400">-</span>
                        </template>
                    </a-table-column>
                    <a-table-column title="MAPl" key="mapl" :width="80">
                        <template #default="{ record }">
                            <a-tag v-if="record.allResults" :color="getSideText(
                                getSingleCheckResult(record.allResults, 'Modrinth')?.clientSide || 'unknown',
                                getSingleCheckResult(record.allResults, 'Modrinth')?.serverSide || 'unknown'
                            ) === '服务端' ? 'blue' : 'purple'">
                                {{ getSideText(
                                    getSingleCheckResult(record.allResults, 'Modrinth')?.clientSide || 'unknown',
                                    getSingleCheckResult(record.allResults, 'Modrinth')?.serverSide || 'unknown'
                                ) }}
                            </a-tag>
                            <span v-else class="tw:text-gray-400">-</span>
                        </template>
                    </a-table-column>
                    <a-table-column title="Mixin" key="mixin" :width="80">
                        <template #default="{ record }">
                            <a-tag v-if="record.allResults" :color="getSideText(
                                getSingleCheckResult(record.allResults, 'Mixin')?.clientSide || 'unknown',
                                getSingleCheckResult(record.allResults, 'Mixin')?.serverSide || 'unknown'
                            ) === '服务端' ? 'blue' : 'purple'">
                                {{ getSideText(
                                    getSingleCheckResult(record.allResults, 'Mixin')?.clientSide || 'unknown',
                                    getSingleCheckResult(record.allResults, 'Mixin')?.serverSide || 'unknown'
                                ) }}
                            </a-tag>
                            <span v-else class="tw:text-gray-400">-</span>
                        </template>
                    </a-table-column>
                    <a-table-column title="描述" key="description" :width="200">
                        <template #default="{ record }">
                            <a-tooltip v-if="record.description" :title="record.description">
                                <span class="tw:truncate tw:block tw:max-w-[180px] md:tw:max-w-[230px] tw:text-sm md:tw:text-base">{{ record.description }}</span>
                            </a-tooltip>
                            <span v-else class="tw:text-gray-400">无描述</span>
                        </template>
                    </a-table-column>
                </a-table>
            </div>
        </a-card>

        <a-empty v-if="showResults && results.length === 0" description="未找到模组文件" />
    </div>
</template>
