import { defineStore } from 'pinia';
import { pb, pbEnabled } from '@/data/backend';

interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    ready: false,
    user: null as AuthUser | null,
  }),
  getters: {
    enabled: () => pbEnabled,
    isAuthed: (s) => !pbEnabled || s.user !== null,
  },
  actions: {
    map(record: { id: string; email?: string; name?: string } | null): AuthUser | null {
      if (!record) return null;
      return { id: record.id, email: record.email ?? '', name: record.name };
    },
    async init() {
      const client = pb;
      if (!pbEnabled || !client) {
        this.ready = true;
        return;
      }
      if (client.authStore.isValid) {
        try {
          await client.collection('users').authRefresh();
        } catch {
          client.authStore.clear();
        }
      }
      const record = client.authStore.record;
      this.user = record ? this.map({ id: record.id, email: record.email, name: record.name }) : null;
      client.authStore.onChange(() => {
        const r = client.authStore.record;
        this.user = r ? this.map({ id: r.id, email: r.email, name: r.name }) : null;
      });
      this.ready = true;
    },
    async login(email: string, password: string) {
      if (!pb) throw new Error('PocketBase not configured');
      const auth = await pb.collection('users').authWithPassword(email, password);
      this.user = this.map({ id: auth.record.id, email: auth.record.email, name: auth.record.name });
    },
    logout() {
      pb?.authStore.clear();
      this.user = null;
    },
  },
});
