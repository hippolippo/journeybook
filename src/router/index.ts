import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import OrganizerView from '@/views/OrganizerView.vue';
import BookView from '@/views/BookView.vue';
import CalendarView from '@/views/CalendarView.vue';
import SettingsView from '@/views/SettingsView.vue';
import LoginView from '@/views/LoginView.vue';
import { safeRedirect } from '@/utils/redirect';
import NotesView from '@/views/NotesView.vue';
import NoteComposeView from '@/views/NoteComposeView.vue';
import NoteReadView from '@/views/NoteReadView.vue';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/', name: 'home', component: HomeView },
    { path: '/scrapbooks/:folderId?', name: 'organizer', component: OrganizerView, props: true },
    { path: '/book/:bookId', name: 'book', component: BookView, props: true },
    { path: '/notes', name: 'notes', component: NotesView },
    { path: '/notes/new', name: 'note-new', component: NoteComposeView },
    { path: '/notes/:noteId/edit', name: 'note-edit', component: NoteComposeView, props: true },
    { path: '/notes/:noteId', name: 'note-read', component: NoteReadView, props: true },
    { path: '/calendar', name: 'calendar', component: CalendarView },
    { path: '/settings', name: 'settings', component: SettingsView },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.enabled) return true;
  if (!auth.ready) await auth.init();
  if (to.name === 'login') {
    if (!auth.isAuthed) return true;
    return safeRedirect(to.query.redirect) ?? { name: 'home' };
  }
  if (!auth.isAuthed) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  return true;
});

export default router;
