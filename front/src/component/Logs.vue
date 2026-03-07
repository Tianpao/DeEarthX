<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, h } from 'vue'
import { message, Select, Button } from 'ant-design-vue'
import { ReloadOutlined, ClearOutlined, DeleteOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons-vue'

interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  meta?: any
}

const logs = ref<LogEntry[]>([])
const loading = ref(false)
const selectedLevel = ref('all')
const autoRefresh = ref(false)
let refreshInterval: number | null = null

const levelConfig = {
  debug: { color: 'text-gray-500', bg: 'bg-gray-100', label: '调试' },
  info: { color: 'text-blue-500', bg: 'bg-blue-100', label: '信息' },
  warn: { color: 'text-yellow-500', bg: 'bg-yellow-100', label: '警告' },
  error: { color: 'text-red-500', bg: 'bg-red-100', label: '错误' }
} as const

type LevelKeys = keyof typeof levelConfig

const filteredLogs = computed(() => {
  if (selectedLevel.value === 'all') return logs.value
  return logs.value.filter(log => log.level === selectedLevel.value)
})

async function fetchLogs() {
  loading.value = true
  try {
    const baseUrl = 'http://localhost:37019/logs'
    const params = new URLSearchParams({
      limit: '200',
      ...(selectedLevel.value !== 'all' && { level: selectedLevel.value })
    })
    
    const response = await fetch(`${baseUrl}?${params}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    
    const result = await response.json()
    logs.value = result.data || []
  } catch (error) {
    console.error('日志加载失败:', error)
    message.error('获取日志失败，请检查服务连接')
  } finally {
    loading.value = false
  }
}

async function clearAllLogs() {
  try {
    const response = await fetch('http://localhost:37019/logs/clear', {
      method: 'POST'
    })
    
    if (response.ok) {
      logs.value = []
      message.success('日志已清空')
    } else {
      throw new Error('清除请求失败')
    }
  } catch (error) {
    console.error('清空日志失败:', error)
    message.error('清空失败，请重试')
  }
}

function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value
  
  if (autoRefresh.value) {
    refreshInterval = window.setInterval(fetchLogs, 2000)
    message.success('已开启自动刷新 (2秒/次)')
  } else {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
    message.info('已关闭自动刷新')
  }
}

function formatMetaData(meta: any): string {
  if (!meta) return ''
  try {
    return typeof meta === 'string' ? meta : JSON.stringify(meta, null, 2)
  } catch {
    return String(meta)
  }
}

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  } catch {
    return timestamp
  }
}

onMounted(() => {
  fetchLogs()
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<template>
  <div class="tw-min-h-screen tw:bg-gradient-to-br tw:from-slate-50 tw-via-blue-50 tw-to-indigo-50 tw-p-6">
    <div class="tw-max-w-7xl tw-mx-auto">
      <!-- 标题栏 -->
      <div class="tw-flex tw-items-center tw-justify-between tw-mb-8">
        <div>
          <h1 class="tw-text-4xl tw-font-bold tw-text-gray-800 tw-mb-2">
            <span class="tw-bg-gradient-to-r tw:from-emerald-600 tw:to-cyan-500 tw:bg-clip-text tw:text-transparent">
              系统日志监控
            </span>
          </h1>
          <p class="tw-text-gray-500 tw-text-sm">实时查看和分析系统运行状态</p>
        </div>
        
        <!-- 操作栏 -->
        <div class="tw-flex tw-items-center tw-gap-3">
          <Select
            v-model:value="selectedLevel"
            @change="fetchLogs"
            size="large"
            style="width: 140px"
            :options="[
              { value: 'all', label: '全部级别' },
              { value: 'debug', label: '调试信息' },
              { value: 'info', label: '普通信息' },
              { value: 'warn', label: '警告信息' },
              { value: 'error', label: '错误信息' }
            ]"
            class="tw-rounded-xl tw-shadow-sm"
          />
          
          <Button
            type="primary"
            :icon="h(ReloadOutlined)"
            @click="fetchLogs"
            :loading="loading"
            size="large"
            class="tw-flex tw-items-center tw-gap-2 tw-rounded-xl tw-shadow-sm tw-font-medium"
          >
            {{ loading ? '加载中...' : '刷新日志' }}
          </Button>
          
          <Button
            :type="autoRefresh ? 'primary' : 'default'"
            @click="toggleAutoRefresh"
            :icon="autoRefresh ? h(PauseCircleOutlined) : h(PlayCircleOutlined)"
            size="large"
            :class="[autoRefresh ? 'tw-bg-emerald-500 tw-border-emerald-500' : '', 'tw-flex tw-items-center tw-gap-2 tw-rounded-xl tw-shadow-sm tw-font-medium']"
          >
            {{ autoRefresh ? '停止刷新' : '自动刷新' }}
          </Button>
          
          <Button
            danger
            :icon="h(ClearOutlined)"
            @click="clearAllLogs"
            :disabled="logs.length === 0"
            size="large"
            class="tw-flex tw-items-center tw-gap-2 tw-rounded-xl tw-shadow-sm tw-font-medium"
          >
            清空全部
          </Button>
        </div>
      </div>

      <!-- 日志展示区 -->
      <div class="tw-bg-white tw-rounded-3xl tw-shadow-2xl tw-overflow-hidden tw-border tw:border-gray-200/50">
        <!-- 顶部统计栏 -->
        <div class="tw-bg-gradient-to-r tw:from-emerald-600 tw:to-cyan-500 tw-px-8 tw-py-6">
          <div class="tw-flex tw-items-center tw-justify-between">
            <div class="tw-flex tw-items-center tw-gap-6">
              <span class="tw-text-white tw-font-semibold tw-text-lg tw-flex tw-items-center tw-gap-2">
                <div class="tw-w-3 tw-h-3 tw-bg-white tw-rounded-full tw-animate-pulse"></div>
                实时日志流
              </span>
              <div class="tw-flex tw-gap-4">
                <span class="tw-text-white/90 tw-text-sm tw-bg-white/20 tw-px-4 tw-py-2 tw-rounded-full tw-font-medium">
                  总计: <span class="tw-font-bold tw-text-white">{{ logs.length }}</span> 条
                </span>
                <span class="tw-text-white/90 tw-text-sm tw-bg-white/20 tw-px-4 tw-py-2 tw-rounded-full tw-font-medium">
                  过滤后: <span class="tw-font-bold tw-text-white">{{ filteredLogs.length }}</span> 条
                </span>
              </div>
            </div>
            <div class="tw-flex tw-items-center tw-gap-4">
              <div class="tw-flex tw-gap-2">
                <span v-for="level in Object.keys(levelConfig) as LevelKeys[]" :key="level"
                  class="tw-px-4 tw-py-2 tw-rounded-full tw-text-xs tw-font-medium tw-bg-white/20 tw-text-white tw-border tw-border-white/30">
                  {{ levelConfig[level].label }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 日志内容区 -->
        <div class="tw-h-[calc(100vh-220px)] tw-overflow-auto tw-p-6 tw-bg-gradient-to-b tw:from-gray-50 tw-via-white tw:to-gray-100">
          <!-- 空状态 -->
          <div v-if="filteredLogs.length === 0" 
               class="tw-flex tw-flex-col tw-items-center tw-justify-center tw-h-full tw-text-gray-400">
            <DeleteOutlined class="tw-text-8xl tw-mb-6 tw-text-gray-300 tw-opacity-50" />
            <p class="tw-text-gray-400 tw-text-xl tw-mb-2 tw-font-medium">暂无日志数据</p>
            <p class="tw-text-gray-400 tw-text-sm">请检查服务状态或调整筛选条件</p>
          </div>

          <!-- 日志列表 -->
          <div v-else class="tw-space-y-4">
            <div
              v-for="(log, index) in filteredLogs"
              :key="index"
              class="tw-bg-white tw-p-5 tw-rounded-2xl tw-border tw:border-gray-200 tw-shadow-md hover:tw-shadow-xl hover:tw-border-emerald-400 tw-transition-all tw-duration-300 tw-font-mono tw-text-sm tw-group"
            >
              <div class="tw-flex tw-items-start tw-gap-4">
                <!-- 级别标签 -->
                <div class="tw-flex-shrink-0">
                  <span
                    class="tw-inline-flex tw-items-center tw-px-4 tw-py-2 tw-rounded-full tw-text-xs tw-font-bold tw-shadow-md tw-uppercase"
                    :class="[levelConfig[log.level].bg, levelConfig[log.level].color]"
                  >
                    <div class="tw-w-2 tw-h-2 tw-rounded-full tw-mr-2" :class="levelConfig[log.level].color.replace('text-', 'bg-')"></div>
                    {{ log.level }}
                  </span>
                </div>

                <!-- 时间戳 -->
                <div class="tw-flex-shrink-0">
                  <div class="tw-text-gray-500 tw-text-xs tw-font-medium tw-bg-gray-100 tw-px-4 tw-py-2 tw-rounded-xl tw-border tw-border-gray-200">
                    {{ formatTime(log.timestamp) }}
                  </div>
                </div>

                <!-- 日志消息 -->
                <div class="tw-flex-1">
                  <div class="tw-text-gray-800 tw-leading-relaxed tw-break-words tw-font-medium tw-text-sm">
                    {{ log.message }}
                  </div>
                  
                  <!-- 元数据 -->
                  <div v-if="log.meta" 
                       class="tw-mt-4 tw-p-4 tw-bg-gray-50/80 tw-rounded-xl tw-border tw:border-gray-200 tw-text-xs">
                    <div class="tw-flex tw-items-center tw-gap-2 tw-mb-2">
                      <div class="tw-w-2 tw-h-2 tw-bg-gray-400 tw-rounded-full"></div>
                      <span class="tw-text-gray-500 tw-font-medium tw-text-xs">附加信息</span>
                    </div>
                    <pre class="tw-text-gray-600 tw-overflow-x-auto tw-p-3 tw-bg-white tw-rounded-lg tw-border tw-border-gray-200">{{ formatMetaData(log.meta) }}</pre>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 滚动到底部提示 -->
            <div class="tw-text-center tw-py-6">
              <div class="tw-inline-flex tw-items-center tw-gap-2 tw-px-6 tw-py-3 tw-bg-gray-100 tw-rounded-full tw-text-gray-400 tw-text-sm tw-border tw-border-gray-200">
                <div class="tw-w-2 tw-h-2 tw-bg-emerald-400 tw-rounded-full tw-animate-pulse"></div>
                已显示全部 {{ filteredLogs.length }} 条日志
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部状态栏 -->
      <div class="tw-flex tw-items-center tw-justify-between tw-mt-4 tw-px-6 tw-py-4 tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw:border-gray-200 tw-text-sm tw-text-gray-500">
        <div class="tw-flex tw-items-center tw-gap-6">
          <span class="tw-flex tw-items-center tw-gap-2 tw-bg-gray-100 tw-px-4 tw-py-2 tw-rounded-full">
            <div class="tw-w-2 tw-h-2 tw-bg-emerald-500 tw-rounded-full tw-animate-pulse"></div>
            服务状态: <span class="tw-font-medium tw-text-gray-700">运行中</span>
          </span>
          <span class="tw-text-gray-400">最后更新: {{ new Date().toLocaleTimeString('zh-CN') }}</span>
        </div>
        <div class="tw-text-gray-400 tw-bg-gray-100 tw-px-4 tw-py-2 tw-rounded-full tw-font-medium">
          日志服务端口: 37019 | 自动刷新: {{ autoRefresh ? '开启' : '关闭' }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 8px;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 8px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* 日志卡片悬停效果 */
.group:hover {
  transform: translateY(-3px);
}

/* 代码块样式 */
pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
  line-height: 1.6;
}

/* 平滑过渡 */
* {
  transition: background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease;
}
</style>
