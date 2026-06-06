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
    <div class="tw:mx-auto tw:flex tw:w-full tw:max-w-4xl tw:flex-col tw:gap-6">
      <div>
        <h1 class="tw:text-2xl tw:font-semibold tw:text-slate-900">{{ t('download.title') }}</h1>
        <p class="tw:mt-1 tw:text-sm tw:text-slate-500">{{ t('download.subtitle') }}</p>
      </div>

      <section class="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:shadow-sm">
        <div class="tw:grid tw:gap-4">
          <div class="tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-4">
            <div class="tw:mb-3">
              <div class="tw:text-sm tw:font-medium tw:text-slate-800">{{ t('download.step1_title') }}</div>
              <div class="tw:mt-1 tw:text-xs tw:text-slate-500">选择需要安装的 Minecraft 版本</div>
            </div>
            <a-select
              v-model:value="selectedMcVersion"
              :loading="loadingMcVersions"
              :placeholder="t('download.select_mc_version')"
              class="tw:w-full md:tw:max-w-[280px]"
              @change="handleMcVersionChange"
              show-search
              :filter-option="(input: string, option: any) => option.value.toLowerCase().includes(input.toLowerCase())"
            >
              <a-select-option v-for="v in mcVersions" :key="v.id" :value="v.id">
                {{ v.id }}
              </a-select-option>
            </a-select>
          </div>

          <div v-if="selectedMcVersion && availableLoaders.length > 0" class="tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-4">
            <div class="tw:mb-3">
              <div class="tw:text-sm tw:font-medium tw:text-slate-800">{{ t('download.step2_title') }}</div>
              <div class="tw:mt-1 tw:text-xs tw:text-slate-500">选择服务端加载器类型</div>
            </div>
            <a-radio-group v-model:value="selectedLoader" @change="handleLoaderChange" size="large" class="tw:flex tw:flex-wrap tw:gap-2">
              <a-radio-button
                v-for="key in availableLoaders"
                :key="key"
                :value="key"
              >
                {{ loaderLabels[key] }}
              </a-radio-button>
            </a-radio-group>
          </div>

          <div v-if="selectedLoader" class="tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-4">
            <div class="tw:mb-3">
              <div class="tw:text-sm tw:font-medium tw:text-slate-800">{{ t('download.step3_title') }}</div>
              <div class="tw:mt-1 tw:text-xs tw:text-slate-500">选择可用的加载器版本</div>
            </div>
            <a-select
              v-model:value="selectedLoaderVersion"
              :loading="loadingLoaderVersions"
              :placeholder="t('download.select_loader_version')"
              class="tw:w-full md:tw:max-w-[360px]"
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

          <div v-if="selectedLoaderVersion" class="tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-4">
            <div class="tw:mb-4">
              <div class="tw:text-sm tw:font-medium tw:text-slate-800">{{ t('download.step4_title') }}</div>
              <div class="tw:mt-1 tw:text-xs tw:text-slate-500">选择安装方式并开始执行</div>
            </div>

            <a-radio-group v-model:value="autoInstall" class="tw:flex tw:flex-col tw:gap-3">
              <label class="tw:flex tw:cursor-pointer tw:items-start tw:gap-3 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-white tw:p-4">
                <a-radio :value="true" />
                <div>
                  <div class="tw:text-sm tw:font-medium tw:text-slate-800">{{ t('download.option_auto_install') }}</div>
                  <p class="tw:mt-1 tw:text-xs tw:leading-5 tw:text-slate-500">{{ t('download.option_auto_install_desc') }}</p>
                </div>
              </label>
              <label class="tw:flex tw:cursor-pointer tw:items-start tw:gap-3 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-white tw:p-4">
                <a-radio :value="false" />
                <div>
                  <div class="tw:text-sm tw:font-medium tw:text-slate-800">{{ t('download.option_manual_script') }}</div>
                  <p class="tw:mt-1 tw:text-xs tw:leading-5 tw:text-slate-500">
                    {{ t('download.option_manual_script_desc') }}
                    <template v-if="selectedLoader === 'forge' || selectedLoader === 'neoforge'">
                      (install_forge.sh/bat, install_forge_china.sh/bat<span v-if="selectedMcVersion < '1.16.5'">, run.sh</span>)
                    </template>
                    <template v-else>
                      (install.sh/bat, run.sh/bat)
                    </template>
                  </p>
                </div>
              </label>
            </a-radio-group>

            <div class="tw:mt-5 tw:flex tw:flex-wrap tw:gap-3">
              <a-button
                v-if="!installing && !installCompleted"
                type="primary"
                @click="startInstall"
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

          <div v-if="installCompleted" class="tw:rounded-lg tw:border tw:border-emerald-200 tw:bg-emerald-50 tw:p-4">
            <a-alert type="success" show-icon>
              <template #message>
                {{ t('download.install_completed') }}
                <span v-if="serverInstallInfo.duration" class="tw:ml-2 tw:text-xs">
                  ({{ t('download.install_duration') }}: {{ (serverInstallInfo.duration / 1000).toFixed(2) }}s)
                </span>
              </template>
            </a-alert>
            <div v-if="installPath" class="tw:mt-3 tw:break-all tw:text-xs tw:text-slate-500">
              {{ installPath }}
            </div>
          </div>

          <div v-if="serverInstallProgress.display && !installCompleted" class="tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-4">
            <div class="tw:mb-3 tw:text-sm tw:font-medium tw:text-slate-800">安装进度</div>
            <a-progress :percent="serverInstallProgress.percent" :status="serverInstallProgress.status" />
            <div v-if="serverInstallInfo.currentStep" class="tw:mt-2 tw:text-xs tw:text-slate-500">
              {{ serverInstallInfo.currentStep }}
              <span v-if="serverInstallInfo.totalSteps > 0">
                ({{ serverInstallInfo.stepIndex }}/{{ serverInstallInfo.totalSteps }})
              </span>
            </div>
            <div v-if="serverInstallInfo.message" class="tw:mt-1 tw:text-xs tw:text-slate-600">
              {{ serverInstallInfo.message }}
            </div>
            <div v-if="serverInstallInfo.status === 'error'" class="tw:mt-1 tw:text-xs tw:text-red-600">
              {{ serverInstallInfo.error }}
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
