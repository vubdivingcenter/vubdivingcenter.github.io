import { createWebHashHistory, createRouter } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import { defineAsyncComponent } from 'vue'; 
const CalendarPage = defineAsyncComponent(() => import('../views/CalendarPage.vue'));
const LoginPage = defineAsyncComponent(() => import('../views/LoginPage.vue'));
const RegisterPage = defineAsyncComponent(() => import('../views/RegisterPage.vue'));

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/calendar'
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: CalendarPage
  },
  {
    path: '/login',
    name: 'login',
    component: LoginPage
  },
  {
    path: '/register/:key',
    name: 'register',
    component: RegisterPage
  }
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes
})

export default router
