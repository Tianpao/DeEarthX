import { h, ref, computed } from 'vue';
import {
    SettingOutlined,
    UploadOutlined,
    UserOutlined,
    WindowsOutlined,
    FileSearchOutlined,
    FolderOutlined
} from '@ant-design/icons-vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import type { MenuProps } from 'ant-design-vue';

export function useMenu() {
    const router = useRouter();
    const route = useRoute();
    const { t } = useI18n();

    const selectedKeys = ref<(string | number)[]>(['main']);

    router.beforeEach((to, _from, next) => {
        const routeToKey: Record<string, string> = {
            '/': 'main',
            '/setting': 'setting',
            '/about': 'about',
            '/error': 'main',
            '/galaxy': 'galaxy',
            '/deearth': 'deearth',
            '/template': 'template'
        };
        selectedKeys.value[0] = routeToKey[to.path] || 'main';
        next();
    });

    const menuItems = computed<MenuProps['items']>(() => {
        return [
            {
                key: 'main',
                icon: h(WindowsOutlined),
                label: t('menu.home'),
                title: t('menu.home'),
            },
            {
                key: 'deearth',
                icon: h(FileSearchOutlined),
                label: t('menu.deearth'),
                title: t('menu.deearth'),
            },
            {
                key: 'galaxy',
                icon: h(UploadOutlined),
                label: t('menu.galaxy'),
                title: t('menu.galaxy'),
            },
            {
                key: 'template',
                icon: h(FolderOutlined),
                label: t('menu.template'),
                title: t('menu.template'),
            },
            {
                key: 'setting',
                icon: h(SettingOutlined),
                label: t('menu.setting'),
                title: t('menu.setting'),
            },
            {
                key: 'about',
                icon: h(UserOutlined),
                label: t('menu.about'),
                title: t('menu.about'),
            }
        ];
    });

    const handleMenuClick: MenuProps['onClick'] = (e) => {
        selectedKeys.value[0] = e.key;
        const routeMap: Record<string, string> = {
            main: '/',
            deearth: '/deearth',
            setting: '/setting',
            about: '/about',
            galaxy: '/galaxy',
            template: '/template'
        };
        const routePath = routeMap[e.key] || '/';
        router.push(routePath);
    };

    return {
        selectedKeys,
        menuItems,
        handleMenuClick,
        route
    };
}
