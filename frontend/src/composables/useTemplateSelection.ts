import { ref, computed } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { TemplateService } from '@/bindings/deearthx/core/services';
import type { Template } from '@/types/progress';

export function useTemplateSelection() {
    const { t } = useI18n();
    const showTemplateModal = ref(false);
    const templates = ref<Template[]>([]);
    const loadingTemplates = ref(false);
    const selectedTemplate = ref<string>('0');

    async function loadTemplates() {
        loadingTemplates.value = true;
        try {
            const list = await TemplateService.List();
            if (list) {
                templates.value = list;
            } else {
                message.error(t('home.template_load_failed'));
            }
        } catch {
            message.error(t('home.template_load_failed'));
        } finally {
            loadingTemplates.value = false;
        }
    }

    function openTemplateModal() {
        loadTemplates();
        showTemplateModal.value = true;
    }

    function selectTemplate(templateId: string) {
        selectedTemplate.value = templateId;
        showTemplateModal.value = false;
        if (templateId === '0' || !templateId) {
            message.success(t('home.template_selected') + ': ' + t('home.template_official_loader'));
        } else {
            const template = templates.value.find(t => t.id === templateId);
            if (template) {
                message.success(t('home.template_selected') + ': ' + template.name);
            }
        }
    }

    const currentTemplateName = computed(() => {
        if (selectedTemplate.value === '0' || !selectedTemplate.value) {
            return t('home.template_official_loader');
        }
        const template = templates.value.find(t => t.id === selectedTemplate.value);
        return template ? template.name : t('home.template_official_loader');
    });

    return {
        showTemplateModal,
        templates,
        loadingTemplates,
        selectedTemplate,
        currentTemplateName,
        loadTemplates,
        openTemplateModal,
        selectTemplate
    };
}
