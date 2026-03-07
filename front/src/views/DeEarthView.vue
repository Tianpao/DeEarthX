<script lang="ts" setup>
import { ref } from 'vue';
import { message } from 'ant-design-vue';
import { FileSearchOutlined, FolderOpenOutlined } from '@ant-design/icons-vue';
import { open } from '@tauri-apps/plugin-dialog';

interface ModCheckResult {
    filename: string;
    filePath: string;
    clientSide: 'required' | 'optional' | 'unsupported' | 'unknown';
    serverSide: 'required' | 'optional' | 'unsupported' | 'unknown';
    source: string;
    checked: boolean;
    errors?: string[];
    allResults: any[];
}

const selectedFolder = ref<string>('');
const bundleName = ref<string>('');
const checking = ref(false);
const results = ref<ModCheckResult[]>([]);
const showResults = ref(false);

async function selectFolder() {
    try {
        const selected = await open({
            directory: true,
            multiple: false,
            title: '选择 mods 文件夹'
        });
        
        if (selected) {
            selectedFolder.value = selected;
            message.success(`已选择文件夹: ${selected}`);
        }
    } catch (error) {
        console.error('选择文件夹失败:', error);
        message.error('选择文件夹失败');
    }
}

async function handleCheck() {
    if (!selectedFolder.value) {
        message.warning('请先选择 mods 文件夹');
        return;
    }

    if (!bundleName.value.trim()) {
        message.warning('请输入整合包名字');
        return;
    }

    checking.value = true;
    showResults.value = false;
    results.value = [];

    try {
        const response = await fetch('http://localhost:37019/modcheck/folder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                folderPath: selectedFolder.value,
                bundleName: bundleName.value.trim()
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `请求失败: ${response.status}`);
        }

        const data = await response.json();
        results.value = data;
        showResults.value = true;
        message.success(`检查完成，共检查 ${data.length} 个模组`);
    } catch (error: any) {
        console.error('检查失败:', error);
        message.error(`检查失败: ${error.message}`);
    } finally {
        checking.value = false;
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
                    选择 mods 文件夹
                </a-button>
                <div v-if="selectedFolder" class="tw:mb-4 tw:p-3 tw:bg-gray-50 tw:rounded tw:text-sm tw:text-gray-600">
                    <span class="tw:font-medium">已选择:</span> {{ selectedFolder }}
                </div>
            </div>

            <div class="tw:mb-4">
                <a-input
                    v-model:value="bundleName"
                    placeholder="请输入整合包名字"
                    size="large"
                    allow-clear
                />
                <div class="tw:mt-2 tw:text-xs tw:text-gray-400">
                    客户端模组将保存到 .rubbish/{{ bundleName || '整合包名字' }} 目录
                </div>
            </div>

            <a-button
                type="primary"
                size="large"
                :loading="checking"
                block
                @click="handleCheck"
                :disabled="checking || !selectedFolder || !bundleName.trim()"
            >
                <template #icon>
                    <FileSearchOutlined />
                </template>
                {{ checking ? '检查中...' : '开始检查' }}
            </a-button>
        </a-card>

        <a-card v-if="showResults" title="检查结果">
            <div class="tw:overflow-x-auto">
                <a-table 
                    :dataSource="results" 
                    :pagination="false" 
                    :scroll="{ y: 300, x: 'max-content' }" 
                    size="small"
                    :bordered="true"
                >
                    <a-table-column title="模组信息" key="modInfo" :width="250">
                        <template #default="{ record }">
                            <div class="tw:overflow-hidden tw:flex-1 tw:min-w-0">
                                <div class="tw:font-medium tw:truncate tw:text-sm md:tw:text-base">{{ record.filename }}</div>
                            </div>
                        </template>
                    </a-table-column>
                    <a-table-column title="类型" key="type" :width="100">
                        <template #default="{ record }">
                            <a-tag v-if="record.clientSide === 'required' || record.clientSide === 'optional'" color="purple">
                                客户端模组
                            </a-tag>
                            <a-tag v-else-if="record.serverSide === 'required' || record.serverSide === 'optional'" color="blue">
                                服务端模组
                            </a-tag>
                            <a-tag v-else color="gray">
                                未知
                            </a-tag>
                        </template>
                    </a-table-column>
                </a-table>
            </div>
        </a-card>

        <a-empty v-if="showResults && results.length === 0" description="未找到模组文件" />
    </div>
</template>
