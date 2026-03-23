import { createRouter, createWebHistory } from 'vue-router';
import Home from './Home.vue';
import AuthView from './pages/auth/AuthView.vue';
import AdminLayout from './pages/admin/AdminLayout.vue';
import AdminDashboard from './pages/admin/AdminDashboard.vue';
import AdminManageUsersPage from './pages/admin/AdminManageUsersPage.vue';
import AdminStaffApplicationsPage from './pages/admin/AdminStaffApplicationsPage.vue';
import ClientDashboard from './pages/client/ClientDashboard.vue';
import TraderDashboard from './pages/trader/TraderDashboard.vue';
import TraderHomePage from './pages/trader/TraderHomePage.vue';
import TraderProfilePage from './pages/trader/TraderProfilePage.vue';
import TraderMarketplacePage from './pages/trader/TraderMarketplacePage.vue';
import { getUser, isLoggedIn } from './services/session';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: Home },
    { path: '/auth', name: 'auth', component: AuthView },
    {
      path: '/admin',
      component: AdminLayout,
      meta: { auth: true, role: 'admin' },
      children: [
        { path: '', redirect: { name: 'admin-dashboard' } },
        { path: 'dashboard', name: 'admin-dashboard', component: AdminDashboard },
        { path: 'manage-users', name: 'admin-manage-users', component: AdminManageUsersPage },
        {
          path: 'staff-applications',
          name: 'admin-staff-applications',
          component: AdminStaffApplicationsPage,
        },
      ],
    },
    { path: '/client', name: 'client', component: ClientDashboard, meta: { auth: true, role: 'client' } },
    {
      path: '/trader',
      component: TraderDashboard,
      meta: { auth: true, role: 'trader' },
      children: [
        { path: '', redirect: { name: 'trader-dashboard' } },
        { path: 'dashboard', name: 'trader-dashboard', component: TraderHomePage },
        { path: 'profile', name: 'trader-profile', component: TraderProfilePage },
        { path: 'marketplace', name: 'trader-marketplace', component: TraderMarketplacePage },
      ],
    },
  ],
});

router.beforeEach((to) => {
  if (!to.meta.auth) {
    return true;
  }

  if (!isLoggedIn()) {
    return { name: 'auth' };
  }

  const user = getUser();
  if (!user) {
    return { name: 'auth' };
  }

  if (to.meta.role && user.role !== to.meta.role) {
    if (user.role === 'admin') return { name: 'admin-dashboard' };
    if (user.role === 'trader') return { name: 'trader-dashboard' };
    return { name: 'client' };
  }

  return true;
});

export default router;
