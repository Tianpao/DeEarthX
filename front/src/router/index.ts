import { createRouter, createWebHistory } from "vue-router";

import Main from "../component/Main.vue";
import Setting from "../component/Setting.vue";
import About from "../component/About.vue";
import Error from "../component/Error.vue";
import Galaxy from "../component/Galaxy.vue";
import DeEarth from "../component/DeEarth.vue";
// import Logs from "../component/Logs.vue";

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: "/",
            component: Main,
        },
        {
            path: "/setting",
            component: Setting,
            meta: {
                requiresConfigRefresh: true
            }
        },{
            path: "/about",
            component: About
        },{
            path: "/error",
            component: Error
        },
        {
            path: "/galaxy",
            component: Galaxy
        },
        {
            path: "/deearth",
            component: DeEarth
        }
        // ,{
        //     path: "/logs",
        //     component: Logs
        // }
    ]
})

export default router