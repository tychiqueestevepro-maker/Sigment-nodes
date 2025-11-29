/**
 * Offline sync manager
 * Handles syncing local notes to the backend
 */
import { db, LocalNote } from './db';
import { apiClient } from './api';

export class SyncManager {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;

  /**
   * Start automatic sync (every 30 seconds)
   */
  startAutoSync() {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(() => {
      this.syncPendingNotes();
    }, 30000); // 30 seconds

    // Initial sync
    this.syncPendingNotes();
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Sync all pending notes to backend
   */
  async syncPendingNotes() {
    if (this.isSyncing) return;
    if (!navigator.onLine) return;

    this.isSyncing = true;

    try {
      // Get all draft notes
      const draftNotes = await db.notes
        .where('status')
        .equals('draft')
        .toArray();

      if (draftNotes.length === 0) {
        this.isSyncing = false;
        return;
      }

      console.log(`📤 Syncing ${draftNotes.length} notes...`);

      // Update status to syncing
      await Promise.all(
        draftNotes.map((note) =>
          db.notes.update(note.id!, { status: 'syncing' })
        )
      );

      // Prepare notes for API
      const notesToSync = draftNotes.map((note) => ({
        content_raw: note.contentRaw,
        user_id: note.userId,
      }));

      // Sync to backend
      const syncedNotes = await apiClient.syncNotes(notesToSync);

      // Update local notes as synced
      await Promise.all(
        draftNotes.map((note, index) =>
          db.notes.update(note.id!, {
            status: 'synced',
            syncedAt: new Date(),
          })
        )
      );

      console.log(`✅ Synced ${syncedNotes.length} notes successfully`);
    } catch (error) {
      console.error('❌ Sync failed:', error);

      // Mark notes as error
      const syncingNotes = await db.notes
        .where('status')
        .equals('syncing')
        .toArray();

      await Promise.all(
        syncingNotes.map((note) =>
          db.notes.update(note.id!, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        )
      );
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Save note locally
   */
  async saveNoteLocally(userId: string, content: string): Promise<LocalNote> {
    const note: LocalNote = {
      tempId: crypto.randomUUID(),
      userId,
      contentRaw: content,
      status: 'draft',
      createdAt: new Date(),
    };

    const id = await db.notes.add(note);
    return { ...note, id: id as number };
  }
}

export const syncManager = new SyncManager();

