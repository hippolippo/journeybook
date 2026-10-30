import { defineStore } from 'pinia';
import { pb, pbEnabled } from '@/data/backend';
import { clearMediaToken, refreshMediaToken, startMediaTokenRefresh } from '@/data/media';
import { clearRemoteSnapshot } from '@/data/snapshot';
import type { UserRole } from '@/data/types';
import {
  clampRoomGlow,
  loadLocalRoomGlow,
  parseRoomGlow,
  saveLocalRoomGlow,
} from '@/utils/roomGlow';

export interface AccountUser {
  id: string;
  email: string;
  name: string;
  role: UserRole | null;
  roomGlow: number;
}

interface UserRecord {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  roomGlow?: string | number;
}

function mapUser(record: UserRecord | null): AccountUser | null {
  if (!record) return null;
  const role = record.role === 'him' || record.role === 'her' ? record.role : null;
  return {
    id: record.id,
    email: record.email ?? '',
    name: (record.name ?? '').trim(),
    role,
    roomGlow: parseRoomGlow(record.roomGlow),
  };
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    ready: false,
    user: null as AccountUser | null,
    partner: null as AccountUser | null,
    /** Local-mode / signed-out fallback for the room text glow. */
    localRoomGlow: loadLocalRoomGlow(),
  }),
  getters: {
    enabled: () => pbEnabled,
    isAuthed: (s) => !pbEnabled || s.user !== null,
    myName: (s) => s.user?.name ?? '',
    partnerName: (s) => s.partner?.name ?? '',
    myRole: (s): UserRole | null => s.user?.role ?? null,
    roomGlow: (s) => s.user?.roomGlow ?? s.localRoomGlow,
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
        } catch (error) {
          const status = (error as { status?: number }).status;
          // A network failure must not erase the offline session. Only a real
          // auth rejection clears the saved account and cached snapshot.
          if (status === 401 || status === 403) {
            client.authStore.clear();
            clearRemoteSnapshot();
          }
        }
      } else {
        // PocketBase keeps the cached account record after its token expires.
        // Mapping that record would mark the app as signed in while every
        // request goes out anonymously, trapping the tab on the load-error
        // screen. An expired or missing token is a signed-out session.
        client.authStore.clear();
        clearRemoteSnapshot();
      }
      this.user = mapUser(client.authStore.record);
      await this.loadPartner();
      if (this.user) {
        await refreshMediaToken();
        startMediaTokenRefresh();
      }
      client.authStore.onChange(() => {
        this.user = mapUser(client.authStore.record);
        if (this.user) {
          void this.loadPartner();
          void refreshMediaToken();
          startMediaTokenRefresh();
        } else {
          clearMediaToken();
          this.partner = null;
        }
      });
      this.ready = true;
    },
    async login(email: string, password: string) {
      if (!pb) throw new Error('PocketBase not configured');
      const auth = await pb.collection('users').authWithPassword(email, password);
      this.user = mapUser(auth.record);
      await this.loadPartner();
      await refreshMediaToken();
      startMediaTokenRefresh();
    },
    /** Save the per-user room text glow (PocketBase) or local fallback. */
    async setRoomGlow(value: number) {
      const next = clampRoomGlow(value);
      if (!this.user) {
        this.localRoomGlow = next;
        saveLocalRoomGlow(next);
        return;
      }
      const previous = this.user.roomGlow;
      this.user = { ...this.user, roomGlow: next };
      try {
        if (pb) {
          await pb.collection('users').update(this.user.id, { roomGlow: String(next) });
        }
      } catch (e) {
        this.user = { ...this.user, roomGlow: previous };
        throw e;
      }
    },
    logout() {
      pb?.authStore.clear();
      clearMediaToken();
      clearRemoteSnapshot();
      this.user = null;
      this.partner = null;
    },
  },
});
