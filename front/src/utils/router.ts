import { createRouter, createWebHistory } from "vue-router";

import Main from "../views/Main.vue";
import SettingView from "../views/SettingView.vue";
import AboutView from "../views/AboutView.vue";
import ErrorView from "../views/ErrorView.vue";
import GalaxyView from "../views/GalaxyView.vue";
import DeEarthView from "../views/DeEarthView.vue";

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: "/",
            component: Main,
        },
        {
            path: "/setting",
            component: SettingView,
            meta: {
                requiresConfigRefresh: true
            }
        },
        {
            path: "/about",
            component: AboutView
        },
        {
            path: "/error",
            component: ErrorView
        },
        {
            path: "/galaxy",
            component: GalaxyView
        },
        {
            path: "/deearth",
            component: DeEarthView
        }
    ]
})

export default router