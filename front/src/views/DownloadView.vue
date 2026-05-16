<script lang="ts" setup>
import { CloudDownloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { useDownload } from '@/composables/useDownload';

const { t } = useI18n();

const {
  mcVersions, selectedMcVersion, loadingMcVersions,
  availableLoaders, selectedLoader,
  loaderVersions, selectedLoaderVersion, loadingLoaderVersions,
  autoInstall, installPath,
  installing, installCompleted,
  serverInstallProgress, serverInstallInfo,
  handleMcVersionChange, handleLoaderChange,
  getForgeBadge,
  startInstall, resetState
} = useDownload();

const loaderLabels: Record<string, string> = {
  forge: t('download.loader_forge'),
  neoforge: t('download.loader_neoforge'),
  fabric: t('download.loader_fabric')
};
</script>

<template>
  <div class="tw:h-full tw:w-full tw:overflow-y-auto tw:p-6">
    <div class="tw:max-w-3xl tw:mx-auto">
      <div class="tw:text-center tw:mb-6">
        <h1 class="tw:text-2xl tw:font-semibold tw:text-gray-800">{{ t('download.title') }}</h1>
        <p class="tw:text-sm tw:text-gray-500 tw:mt-1">{{ t('download.subtitle') }}</p>
      </div>

      <div class="tw:bg-white tw:rounded-xl tw:shadow-sm tw:p-6">
        <!-- MC 版本 -->
        <div class="tw:mb-6">
          <h3 class="tw:text-base tw:font-medium tw:mb-3">{{ t('download.step1_title') }}</h3>
          <a-select
            v-model:value="selectedMcVersion"
            :loading="loadingMcVersions"
            :placeholder="t('download.select_mc_version')"
            style="width: 260px"
            @change="handleMcVersionChange"
            show-search
            :filter-option="(input: string, option: any) => option.value.toLowerCase().includes(input.toLowerCase())"
          >
            <a-select-option v-for="v in mcVersions" :key="v.id" :value="v.id">
              {{ v.id }}
            </a-select-option>
          </a-select>
        </div>

        <!-- 加载器类型 - 选择 MC 版本后显示 -->
        <div v-if="selectedMcVersion && availableLoaders.length > 0" class="tw:mb-6">
          <h3 class="tw:text-base tw:font-medium tw:mb-3">{{ t('download.step2_title') }}</h3>
          <a-radio-group v-model:value="selectedLoader" @change="handleLoaderChange" size="large">
            <a-radio-button
              v-for="key in availableLoaders" :key="key" :value="key"
              class="tw:mr-3 tw:rounded-lg"
            >
              <span class="tw:px-4">{{ loaderLabels[key] }}</span>
            </a-radio-button>
          </a-radio-group>
        </div>

        <!-- 加载器版本 - 选择加载器类型后显示 -->
        <div v-if="selectedLoader" class="tw:mb-6">
          <h3 class="tw:text-base tw:font-medium tw:mb-3">{{ t('download.step3_title') }}</h3>
          <a-select
            v-model:value="selectedLoaderVersion"
            :loading="loadingLoaderVersions"
            :placeholder="t('download.select_loader_version')"
            style="width: 320px"
            show-search
            :filter-option="(input: string, option: any) => option.value.toLowerCase().includes(input.toLowerCase())"
          >
            <a-select-option v-for="v in loaderVersions" :key="v.version" :value="v.version">
              <div class="tw:flex tw:items-center tw:gap-2">
                <span>{{ v.version }}</span>
                <a-tag v-if="selectedLoader === 'forge' && getForgeBadge(v.version)" color="blue" class="tw:text-[10px] tw:leading-none">
                  {{ getForgeBadge(v.version) }}
                </a-tag>
                <a-tag v-if="selectedLoader === 'neoforge' && v.latest" color="green" class="tw:text-[10px] tw:leading-none">
                  latest
                </a-tag>
                <a-tag v-if="selectedLoader === 'fabric' && v.stable" color="green" class="tw:text-[10px] tw:leading-none">
                  stable
                </a-tag>
              </div>
            </a-select-option>
          </a-select>
        </div>

        <!-- 安装选项 + 开始按钮 - 选择加载器版本后显示 -->
        <div v-if="selectedLoaderVersion">
          <h3 class="tw:text-base tw:font-medium tw:mb-3">{{ t('download.step4_title') }}</h3>
          <a-radio-group v-model:value="autoInstall" size="large">
            <div class="tw:mb-3">
              <a-radio :value="true">
                <span class="tw:font-medium">{{ t('download.option_auto_install') }}</span>
                <p class="tw:text-xs tw:text-gray-400 tw:mt-1 tw:ml-6">{{ t('download.option_auto_install_desc') }}</p>
              </a-radio>
            </div>
            <div>
              <a-radio :value="false">
                <span class="tw:font-medium">{{ t('download.option_manual_script') }}</span>
                <p class="tw:text-xs tw:text-gray-400 tw:mt-1 tw:ml-6">
                  {{ t('download.option_manual_script_desc') }}
                  <template v-if="selectedLoader === 'forge' || selectedLoader === 'neoforge'">
                    (install_forge.sh/bat, install_forge_china.sh/bat<span v-if="selectedMcVersion < '1.16.5'">, run.sh</span>)
                  </template>
                  <template v-else>
                    (install.sh/bat, run.sh/bat)
                  </template>
                </p>
              </a-radio>
            </div>
          </a-radio-group>

          <div class="tw:mt-6 tw:flex tw:gap-3">
            <a-button
              v-if="!installing && !installCompleted"
              type="primary" @click="startInstall"
            >
              <template #icon><CloudDownloadOutlined /></template>
              {{ t('download.start_install') }}
            </a-button>
            <a-button
              v-if="installing || installCompleted"
              @click="resetState"
            >
              {{ t('download.reset') }}
            </a-button>
          </div>
        </div>

        <!-- 安装进度 -->
        <div v-if="installCompleted" class="tw:mt-6">
          <a-alert type="success" show-icon>
            <template #message>
              {{ t('download.install_completed') }}
              <span v-if="serverInstallInfo.duration" class="tw:ml-2 tw:text-xs">
                ({{ t('download.install_duration') }}: {{ (serverInstallInfo.duration / 1000).toFixed(2) }}s)
              </span>
            </template>
          </a-alert>
          <div v-if="installPath" class="tw:mt-2 tw:text-xs tw:text-gray-500 tw:break-all">
            {{ installPath }}
          </div>
        </div>

        <div v-if="serverInstallProgress.display && !installCompleted" class="tw:mt-6">
          <a-progress :percent="serverInstallProgress.percent" :status="serverInstallProgress.status" />
          <div v-if="serverInstallInfo.currentStep" class="tw:text-xs tw:text-gray-500 tw:mt-2">
            {{ serverInstallInfo.currentStep }}
            <span v-if="serverInstallInfo.totalSteps > 0">
              ({{ serverInstallInfo.stepIndex }}/{{ serverInstallInfo.totalSteps }})
            </span>
          </div>
          <div v-if="serverInstallInfo.message" class="tw:text-xs tw:text-gray-600 tw:mt-1">
            {{ serverInstallInfo.message }}
          </div>
          <div v-if="serverInstallInfo.status === 'error'" class="tw:text-xs tw:text-red-600 tw:mt-1">
            {{ serverInstallInfo.error }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.ant-radio-button-wrapper) {
  display: inline-flex;
  align-items: center;
}
</style>
