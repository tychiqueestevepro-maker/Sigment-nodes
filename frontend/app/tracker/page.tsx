'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, LocalNote } from '@/lib/db';
import { motion } from 'framer-motion';

export default function TrackerPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>('');

  // Live query from Dexie
  const localNotes = useLiveQuery(() => {
    if (!userId) return [];
    return db.notes.where('userId').equals(userId).reverse().toArray();
  }, [userId]);

  useEffect(() => {
    const storedUserId = localStorage.getItem('sigment_user_id');
    if (storedUserId) {
      setUserId(storedUserId);
    }
  }, []);

  const getStatusColor = (status: LocalNote['status']) => {
    switch (status) {
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'syncing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'synced':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    }
  };

  const getStatusIcon = (status: LocalNote['status']) => {
    switch (status) {
      case 'draft':
        return '⏳';
      case 'syncing':
        return '🔄';
      case 'synced':
        return '✅';
      case 'error':
        return '❌';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center space-x-2 text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span>Back to Home</span>
          </button>

          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            My Notes Tracker
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Your Notes
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Track the status of all your submitted ideas
          </p>
        </div>

        {/* Notes List */}
        <div className="space-y-4">
          {!localNotes || localNotes.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-lg p-12 text-center">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                No notes yet
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Start sharing your ideas to see them here
              </p>
              <button
                onClick={() => router.push('/')}
                className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition"
              >
                Create Your First Note
              </button>
            </div>
          ) : (
            localNotes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <p className="text-slate-900 dark:text-white line-clamp-3">
                      {note.contentRaw}
                    </p>
                  </div>

                  <span
                    className={`ml-4 px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${getStatusColor(
                      note.status
                    )}`}
                  >
                    {getStatusIcon(note.status)} {note.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                  <span>
                    Created: {new Date(note.createdAt).toLocaleString()}
                  </span>
                  {note.syncedAt && (
                    <span>
                      Synced: {new Date(note.syncedAt).toLocaleString()}
                    </span>
                  )}
                </div>

                {note.error && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
                    Error: {note.error}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

