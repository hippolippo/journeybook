import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import OrganizerView from '@/views/OrganizerView.vue';
import BookView from '@/views/BookView.vue';
import LoginView from '@/views/LoginView.vue';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/', name: 'home', component: HomeView },
    { path: '/scrapbooks/:folderId?', name: 'organizer', component: OrganizerView, props: true },
    { path: '/book/:bookId', name: 'book', component: BookView, props: true },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.enabled) return true;
  if (!auth.ready) await auth.init();
  if (to.name === 'login') return auth.isAuthed ? { name: 'home' } : true;
  if (!auth.isAuthed) return { name: 'login' };
  return true;
});

export default router;
