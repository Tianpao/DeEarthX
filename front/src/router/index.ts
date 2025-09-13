import { createRouter, createWebHistory } from "vue-router";

import Main from "../component/Main.vue";
import Setting from "../component/Setting.vue";
import About from "../component/About.vue";

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: "/",
            component: Main,
        },
        {
            path: "/setting",
            component: Setting
        },{
            path: "/about",
            component: About
        }
    ]
})

export default router