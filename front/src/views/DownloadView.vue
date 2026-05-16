<script lang="ts" setup>
import { FolderOpenOutlined, CloudDownloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { useDownload } from '@/composables/useDownload';

const { t } = useI18n();

const {
  currentStep,
  mcVersions,
  selectedMcVersion,
  loadingMcVersions,
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
  fetchMcVersions,
  handleMcVersionChange,
  fetchLoaderVersions,
  handleLoaderChange,
  selectInstallDir,
  canProceedToStep,
  startInstall,
  resetState
} = useDownload();

const stepItems = [
  { title: t('download.step1_title'), description: t('download.step1_desc') },
  { title: t('download.step2_title'), description: t('download.step2_desc') },
  { title: t('download.step3_title'), description: t('download.step3_desc') },
  { title: t('download.step4_title'), description: t('download.step4_desc') },
  { title: t('download.step5_title'), description: t('download.step5_desc') }
];

function nextStep() {
  if (currentStep.value < 4) {
    currentStep.value++;
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
}

function handleStart() {
  startInstall();
}
</script>

<template>
  <div class="tw:h-full tw:w-full tw:overflow-y-auto tw:p-6">
    <div class="tw:max-w-3xl tw:mx-auto">
      <div class="tw:text-center tw:mb-6">
        <h1 class="tw:text-2xl tw:font-semibold tw:text-gray-800">{{ t('download.title') }}</h1>
        <p class="tw:text-sm tw:text-gray-500 tw:mt-1">{{ t('download.subtitle') }}</p>
      </div>

      <a-steps :current="currentStep" size="small" class="tw:mb-8">
        <a-step v-for="item in stepItems" :key="item.title" :title="item.title" />
      </a-steps>

      <div class="tw:bg-white tw:rounded-xl tw:shadow-sm tw:p-6 tw:min-h-64">
        <!-- Step 0: Select Minecraft Version -->
        <div v-if="currentStep === 0">
          <h3 class="tw:text-lg tw:font-medium tw:mb-4">{{ t('download.step1_title') }}</h3>
          <div class="tw:flex tw:gap-3 tw:items-center">
            <a-select
              v-model:value="selectedMcVersion"
              :loading="loadingMcVersions"
              :placeholder="t('download.select_mc_version')"
              style="width: 280px"
              @change="handleMcVersionChange"
              @focus="mcVersions.length === 0 ? fetchMcVersions() : undefined"
              show-search
              :filter-option="(input: string, option: any) => option.value.toLowerCase().includes(input.toLowerCase())"
            >
              <a-select-option v-for="v in mcVersions" :key="v.id" :value="v.id">
                {{ v.id }}
              </a-select-option>
            </a-select>
            <a-button @click="fetchMcVersions" :loading="loadingMcVersions">
              {{ t('download.fetch_versions') }}
            </a-button>
          </div>
          <div v-if="loadingMcVersions" class="tw:mt-2 tw:text-xs tw:text-gray-400">
            {{ t('download.fetch_versions_loading') }}
          </div>
        </div>

        <!-- Step 1: Select Loader Type -->
        <div v-if="currentStep === 1">
          <h3 class="tw:text-lg tw:font-medium tw:mb-4">{{ t('download.step2_title') }}</h3>
          <a-radio-group v-model:value="selectedLoader" @change="handleLoaderChange" size="large">
            <a-radio-button value="forge" class="tw:mr-3 tw:rounded-lg">
              <span class="tw:px-4 tw:py-2 tw:inline-block">{{ t('download.loader_forge') }}</span>
            </a-radio-button>
            <a-radio-button value="neoforge" class="tw:mr-3 tw:rounded-lg">
              <span class="tw:px-4 tw:py-2 tw:inline-block">{{ t('download.loader_neoforge') }}</span>
            </a-radio-button>
            <a-radio-button value="fabric" class="tw:rounded-lg">
              <span class="tw:px-4 tw:py-2 tw:inline-block">{{ t('download.loader_fabric') }}</span>
            </a-radio-button>
          </a-radio-group>
          <div class="tw:mt-4 tw:text-xs tw:text-gray-400">
            {{ t('download.selected_mc_version') }}: <span class="tw:font-mono tw:text-gray-600">{{ selectedMcVersion }}</span>
          </div>
        </div>

        <!-- Step 2: Select Loader Version -->
        <div v-if="currentStep === 2">
          <h3 class="tw:text-lg tw:font-medium tw:mb-4">{{ t('download.step3_title') }}</h3>
          <div class="tw:flex tw:gap-3 tw:items-center">
            <a-select
              v-model:value="selectedLoaderVersion"
              :loading="loadingLoaderVersions"
              :placeholder="t('download.select_loader_version')"
              style="width: 280px"
              show-search
              :filter-option="(input: string, option: any) => option.value.toLowerCase().includes(input.toLowerCase())"
            >
              <a-select-option v-for="v in loaderVersions" :key="v.version" :value="v.version">
                {{ v.version }}<span v-if="v.stable !== undefined"> ({{ v.stable ? 'stable' : 'beta' }})</span>
              </a-select-option>
            </a-select>
            <a-button @click="fetchLoaderVersions" :loading="loadingLoaderVersions">
              {{ t('download.fetch_versions') }}
            </a-button>
          </div>
          <div v-if="loadingLoaderVersions" class="tw:mt-2 tw:text-xs tw:text-gray-400">
            {{ t('download.fetch_loaders_loading') }}
          </div>
          <div v-if="!loadingLoaderVersions && loaderVersions.length === 0 && selectedMcVersion" class="tw:mt-2 tw:text-xs tw:text-orange-500">
            {{ t('download.no_loader_versions') }}
          </div>
        </div>

        <!-- Step 3: Install Options -->
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
        </div>

        <!-- Step 4: Select Install Directory -->
        <div v-if="currentStep === 4">
          <h3 class="tw:text-lg tw:font-medium tw:mb-4">{{ t('download.step5_title') }}</h3>
          <div class="tw:flex tw:gap-3 tw:items-center">
            <a-input
              v-model:value="installPath"
              :placeholder="t('download.install_path_label')"
              readonly
              style="width: 380px"
            />
            <a-button @click="selectInstallDir">
              <template #icon><FolderOpenOutlined /></template>
              {{ t('download.browse_button') }}
            </a-button>
          </div>

          <div v-if="installCompleted" class="tw:mt-6">
            <a-alert type="success" show-icon>
              <template #message>
                {{ t('download.install_completed') }}
                <span v-if="serverInstallInfo.duration" class="tw:ml-2 tw:text-xs">
                  ({{ t('download.install_duration') }}: {{ (serverInstallInfo.duration / 1000).toFixed(2) }}s)
                </span>
              </template>
            </a-alert>
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

      <!-- Navigation Buttons -->
      <div class="tw:flex tw:justify-between tw:mt-6">
        <a-button @click="prevStep" :disabled="currentStep === 0 || installing">
          {{ t('download.prev_step') }}
        </a-button>

        <div class="tw:flex tw:gap-3">
          <a-button v-if="currentStep < 4" type="primary" @click="nextStep" :disabled="!canProceedToStep(currentStep + 1)">
            {{ t('download.next_step') }}
          </a-button>
          <a-button
            v-if="currentStep === 4 && !installing && !installCompleted"
            type="primary"
            @click="handleStart"
            :disabled="!installPath"
          >
            <template #icon><CloudDownloadOutlined /></template>
            {{ t('download.start_install') }}
          </a-button>
          <a-button
            v-if="currentStep === 4 && (installing || installCompleted)"
            @click="resetState"
          >
            {{ t('download.reset') }}
          </a-button>
        </div>
      </div>

      <div class="tw:mt-6 tw:text-center">
        <div class="tw:text-xs tw:text-gray-400">
          <span v-if="selectedMcVersion">MC {{ selectedMcVersion }}</span>
          <span v-if="selectedMcVersion && selectedLoader" class="tw:mx-2">|</span>
          <span v-if="selectedLoader">{{ t(`download.loader_${selectedLoader}`) }}</span>
          <span v-if="selectedLoaderVersion" class="tw:mx-2">|</span>
          <span v-if="selectedLoaderVersion">{{ selectedLoaderVersion }}</span>
          <span v-if="autoInstall !== null" class="tw:mx-2">|</span>
          <span v-if="autoInstall === true">{{ t('download.option_auto_install') }}</span>
          <span v-if="autoInstall === false">{{ t('download.option_manual_script') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
