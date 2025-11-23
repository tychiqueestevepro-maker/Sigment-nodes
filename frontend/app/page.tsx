'use client';

import { useState, useEffect } from 'react';
import { FireAndForgetInput } from '@/components/FireAndForgetInput';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    // TODO: Implement proper auth
    // For now, use a mock user ID from localStorage
    const storedUserId = localStorage.getItem('sigment_user_id');
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      // Create mock user ID
      const mockUserId = crypto.randomUUID();
      localStorage.setItem('sigment_user_id', mockUserId);
      setUserId(mockUserId);
    }
  }, []);

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                SIGMENT
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                AI Smart Notes
              </p>
            </div>
          </div>

          <nav className="flex items-center space-x-6">
            <button
              onClick={() => router.push('/tracker')}
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition"
            >
              My Notes
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition"
            >
              Dashboard
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Share Your Ideas
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Fire and forget. No forms, no categories. Just type your thoughts
            and let AI organize them for strategic decision-making.
          </p>
        </div>

        <FireAndForgetInput userId={userId} />

        <div className="mt-12 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            💡 Your ideas are saved locally and synced automatically
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Connected</span>
          </div>
          <span>SIGMENT © 2025</span>
        </div>
      </footer>
    </div>
  );
}

