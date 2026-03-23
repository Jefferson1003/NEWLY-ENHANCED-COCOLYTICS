<script setup>
import { useRouter } from 'vue-router';
import { clearSession, getUser } from '../../services/session';

const router = useRouter();
const user = getUser();

function logout() {
  clearSession();
  router.push('/auth');
}
</script>

<template>
  <section class="admin-layout">
    <aside class="sidebar">
      <div class="brand">
        <p class="kicker">Cocolytics</p>
        <h1>Admin Console</h1>
        <p class="account">{{ user?.email }}</p>
      </div>

      <nav class="nav-links">
        <router-link to="/admin/dashboard">Dashboard</router-link>
        <router-link to="/admin/manage-users">Manage Users</router-link>
        <router-link to="/admin/staff-applications">Staff Applications</router-link>
      </nav>

      <button type="button" class="logout" @click="logout">Logout</button>
    </aside>

    <main class="content">
      <router-view />
    </main>
  </section>
</template>

<style scoped>
.admin-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 260px 1fr;
  background: #081923;
  color: #ecf7ff;
}

.sidebar {
  border-right: 1px solid rgba(130, 203, 255, 0.22);
  padding: 1rem;
  background: linear-gradient(165deg, rgba(9, 33, 49, 0.94), rgba(9, 40, 58, 0.92));
  display: grid;
  gap: 1rem;
  align-content: start;
}

.kicker {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.68rem;
  color: #90d7ff;
}

h1 {
  margin: 0.42rem 0 0;
  font-size: 1.35rem;
}

.account {
  margin: 0.35rem 0 0;
  color: #b5daf3;
  font-size: 0.8rem;
}

.nav-links {
  display: grid;
  gap: 0.45rem;
}

.nav-links a {
  text-decoration: none;
  color: #d4ebfc;
  border: 1px solid rgba(131, 204, 255, 0.27);
  border-radius: 10px;
  padding: 0.6rem 0.7rem;
  font-weight: 700;
  font-size: 0.86rem;
}

.nav-links a.router-link-active {
  background: rgba(65, 148, 209, 0.24);
  border-color: rgba(141, 212, 255, 0.55);
}

.logout {
  border: 1px solid rgba(141, 209, 255, 0.35);
  border-radius: 10px;
  background: rgba(20, 58, 86, 0.8);
  color: #eaf5ff;
  padding: 0.55rem 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.content {
  padding: 1rem;
}

@media (max-width: 820px) {
  .admin-layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    border-right: none;
    border-bottom: 1px solid rgba(130, 203, 255, 0.22);
    gap: 0.75rem;
  }

  .nav-links {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .nav-links a {
    text-align: center;
    font-size: 0.8rem;
    padding: 0.5rem 0.45rem;
  }
}
</style>
