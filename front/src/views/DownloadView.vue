<script lang="ts" setup>
import { CloudDownloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { useDownload } from '@/composables/useDownload';

const { t } = useI18n();

const {
  currentStep,
  mcVersions,
  selectedMcVersion,
  loadingMcVersions,
  availableLoaders,
  selectedLoader,
  loaderVersions,
  selectedLoaderVersion,
  loadingLoaderVersions,
  autoInstall,
  installPath,
  installing,
  installCompleted,
  serverInstallProgress,
  serverInstallInfo,
  handleMcVersionChange,
  handleLoaderChange,
  getForgeBadge,
  canProceedToStep,
  goNext,
  goPrev,
  startInstall,
  resetState
} = useDownload();

const stepItems = [
  { title: t('download.step1_title') },
  { title: t('download.step2_title') },
  { title: t('download.step3_title') },
  { title: t('download.step4_title') }
];

const loaderLabels: Record<string, string> = {
  forge: t('download.loader_forge'),
  neoforge: t('download.loader_neoforge'),
  fabric: t('download.loader_fabric')
};
</script>

<template>
  <div class="tw:h-full tw:w-full tw:flex tw:flex-col tw:overflow-hidden">
    <!-- 内容区域 -->
    <div class="tw:flex-1 tw:overflow-y-auto tw:p-6">
      <div class="tw:max-w-3xl tw:mx-auto">
        <div class="tw:text-center tw:mb-6">
          <h1 class="tw:text-2xl tw:font-semibold tw:text-gray-800">{{ t('download.title') }}</h1>
          <p class="tw:text-sm tw:text-gray-500 tw:mt-1">{{ t('download.subtitle') }}</p>
        </div>

        <div class="tw:bg-white tw:rounded-xl tw:shadow-sm tw:p-6 tw:min-h-64">
          <!-- Step 0: Minecraft 版本 -->
          <div v-if="currentStep === 0">
            <h3 class="tw:text-lg tw:font-medium tw:mb-4">{{ t('download.step1_title') }}</h3>
            <a-select
              v-model:value="selectedMcVersion"
              :loading="loadingMcVersions"
              :placeholder="t('download.select_mc_version')"
              style="width: 280px"
              @change="handleMcVersionChange"
              show-search
              :filter-option="(input: string, option: any) => option.value.toLowerCase().includes(input.toLowerCase())"
            >
              <a-select-option v-for="v in mcVersions" :key="v.id" :value="v.id">
                {{ v.id }}
              </a-select-option>
            </a-select>
            <div v-if="loadingMcVersions" class="tw:mt-2 tw:text-xs tw:text-gray-400">
              {{ t('download.fetch_versions_loading') }}
            </div>
            <div v-if="!loadingMcVersions && mcVersions.length === 0" class="tw:mt-2 tw:text-xs tw:text-red-400">
              {{ t('download.fetch_versions_failed') }}
            </div>
          </div>

          <!-- Step 1: 加载器类型 -->
          <div v-if="currentStep === 1">
            <h3 class="tw:text-lg tw:font-medium tw:mb-4">{{ t('download.step2_title') }}</h3>
            <a-radio-group v-model:value="selectedLoader" @change="handleLoaderChange" size="large">
              <a-radio-button
                v-for="key in availableLoaders"
                :key="key"
                :value="key"
                class="tw:mr-3 tw:rounded-lg tw:align-middle"
              >
                <span class="tw:px-4 tw:py-2 tw:inline-flex tw:items-center tw:h-full">{{ loaderLabels[key] }}</span>
              </a-radio-button>
            </a-radio-group>
            <div class="tw:mt-4 tw:text-xs tw:text-gray-400">
              {{ t('download.selected_mc_version') }}: <span class="tw:font-mono tw:text-gray-600">{{ selectedMcVersion }}</span>
            </div>
          </div>

          <!-- Step 2: 加载器版本 -->
          <div v-if="currentStep === 2">
            <h3 class="tw:text-lg tw:font-medium tw:mb-4">{{ t('download.step3_title') }}</h3>
            <div class="tw:flex tw:gap-3 tw:items-center">
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
                    <!-- Forge latest/recommended -->
                    <a-tag v-if="selectedLoader === 'forge' && getForgeBadge(v.version)" color="blue" class="tw:text-[10px] tw:leading-none">
                      {{ getForgeBadge(v.version) }}
                    </a-tag>
                    <!-- NeoForge latest -->
                    <a-tag v-if="selectedLoader === 'neoforge' && v.latest" color="green" class="tw:text-[10px] tw:leading-none">
                      latest
                    </a-tag>
                    <!-- Fabric stable -->
                    <a-tag v-if="selectedLoader === 'fabric' && v.stable" color="green" class="tw:text-[10px] tw:leading-none">
                      stable
                    </a-tag>
                  </div>
                </a-select-option>
              </a-select>
            </div>
            <div v-if="loadingLoaderVersions" class="tw:mt-2 tw:text-xs tw:text-gray-400">
              {{ t('download.fetch_loaders_loading') }}
            </div>
            <div v-if="!loadingLoaderVersions && loaderVersions.length === 0 && selectedMcVersion" class="tw:mt-2 tw:text-xs tw:text-orange-500">
              {{ t('download.no_loader_versions') }}
            </div>
            <div class="tw:mt-4 tw:text-xs tw:text-gray-400">
              {{ t('download.selected_mc_version') }}: <span class="tw:font-mono tw:text-gray-600">{{ selectedMcVersion }}</span>
              <span class="tw:mx-2">|</span>
              {{ loaderLabels[selectedLoader] || selectedLoader }}
            </div>
          </div>

          <!-- Step 3: 安装选项 -->
          <div v-if="currentStep === 3">
            <h3 class="tw:text-lg tw:font-medium tw:mb-4">{{ t('download.step4_title') }}</h3>
            <a-radio-group v-model:value="autoInstall" size="large">
              <div class="tw:mb-4">
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

        <!-- 导航按钮 -->
        <div class="tw:flex tw:justify-between tw:mt-6">
          <a-button @click="goPrev" :disabled="currentStep === 0 || installing">
            {{ t('download.prev_step') }}
          </a-button>

          <div class="tw:flex tw:gap-3">
            <a-button v-if="currentStep < 3" type="primary" @click="goNext" :disabled="!canProceedToStep(currentStep + 1)">
              {{ t('download.next_step') }}
            </a-button>
            <a-button
              v-if="currentStep === 3 && !installing && !installCompleted"
              type="primary"
              @click="startInstall"
            >
              <template #icon><CloudDownloadOutlined /></template>
              {{ t('download.start_install') }}
            </a-button>
            <a-button
              v-if="currentStep === 3 && (installing || installCompleted)"
              @click="resetState"
            >
              {{ t('download.reset') }}
            </a-button>
          </div>
        </div>

        <!-- 底部摘要 -->
        <div class="tw:mt-4 tw:text-center tw:text-xs tw:text-gray-400">
          <span v-if="selectedMcVersion">MC {{ selectedMcVersion }}</span>
          <span v-if="selectedMcVersion && selectedLoader" class="tw:mx-2">|</span>
          <span v-if="selectedLoader">{{ loaderLabels[selectedLoader] || selectedLoader }}</span>
          <span v-if="selectedLoaderVersion" class="tw:mx-2">|</span>
          <span v-if="selectedLoaderVersion">{{ selectedLoaderVersion }}</span>
          <span v-if="autoInstall !== null" class="tw:mx-2">|</span>
          <span v-if="autoInstall === true">{{ t('download.option_auto_install') }}</span>
          <span v-if="autoInstall === false">{{ t('download.option_manual_script') }}</span>
        </div>
      </div>
    </div>

    <!-- 底部步骤条 -->
    <div class="tw:h-20 tw:flex tw:items-center tw:justify-center tw:bg-white tw:border-t tw:border-gray-100 tw:px-6 tw:shrink-0">
      <div class="tw:w-full tw:max-w-3xl">
        <a-steps :current="currentStep" size="small">
          <a-step v-for="item in stepItems" :key="item.title" :title="item.title" />
        </a-steps>
      </div>
    </div>
  </div>
</template>
