/**
 * Dexie.js IndexedDB configuration
 * Offline-first local storage for notes
 */
import Dexie, { Table } from 'dexie';

export interface LocalNote {
  id?: number; // Auto-increment local ID
  tempId: string; // UUID for sync tracking
  userId: string;
  contentRaw: string;
  status: 'draft' | 'syncing' | 'synced' | 'error';
  createdAt: Date;
  syncedAt?: Date;
  error?: string;
}

export class SigmentDB extends Dexie {
  notes!: Table<LocalNote>;

  constructor() {
    super('SigmentDB');
    
    this.version(1).stores({
      notes: '++id, tempId, userId, status, createdAt',
    });
  }
}

export const db = new SigmentDB();

