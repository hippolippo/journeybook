import { defineStore } from 'pinia';
import { pb, pbEnabled } from '@/data/backend';
import type { UserRole } from '@/data/types';

export interface AccountUser {
  id: string;
  email: string;
  name: string;
  role: UserRole | null;
}

interface UserRecord {
  id: string;
  email?: string;
  name?: string;
  role?: string;
}

function mapUser(record: UserRecord | null): AccountUser | null {
  if (!record) return null;
  const role = record.role === 'him' || record.role === 'her' ? record.role : null;
  return { id: record.id, email: record.email ?? '', name: (record.name ?? '').trim(), role };
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    ready: false,
    user: null as AccountUser | null,
    partner: null as AccountUser | null,
  }),
  getters: {
    enabled: () => pbEnabled,
    isAuthed: (s) => !pbEnabled || s.user !== null,
    myName: (s) => s.user?.name ?? '',
    partnerName: (s) => s.partner?.name ?? '',
    myRole: (s): UserRole | null => s.user?.role ?? null,
  },
  actions: {
    async loadPartner() {
      const client = pb;
      const me = this.user;
      if (!client || !me) {
        this.partner = null;
        return;
      }
      try {
        const records = await client.collection('users').getFullList();
        this.partner = mapUser(records.find((r) => r.id !== me.id) ?? null);
      } catch (e) {
        console.error('loadPartner', e);
        this.partner = null;
      }
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
      this.user = mapUser(client.authStore.record);
      await this.loadPartner();
      client.authStore.onChange(() => {
        this.user = mapUser(client.authStore.record);
        void this.loadPartner();
      });
      this.ready = true;
    },
    async login(email: string, password: string) {
      if (!pb) throw new Error('PocketBase not configured');
      const auth = await pb.collection('users').authWithPassword(email, password);
      this.user = mapUser(auth.record);
      await this.loadPartner();
    },
    logout() {
      pb?.authStore.clear();
      this.user = null;
      this.partner = null;
    },
  },
});
