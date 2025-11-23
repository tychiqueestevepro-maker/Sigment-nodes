"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, TrendingUp, Users, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/api";

interface Evidence {
  id: string;
  content: string;
  relevance_score: number;
  author: {
    name: string;
    job_title: string;
    department: string;
  };
  created_at: string;
}

interface Snapshot {
  id: string;
  synthesis: string;
  metrics: Record<string, any>;
  evidence_count: number;
  evidence: Evidence[];
  timestamp: string;
}

interface ClusterHistory {
  cluster: {
    id: string;
    title: string;
    pillar: string;
    note_count: number;
    avg_impact: number;
    created_at: string;
    last_updated_at: string;
  };
  snapshots: Snapshot[];
  total_snapshots: number;
}

export default function ClusterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clusterId = params.id as string;

  // State for time-lapse slider
  const [selectedSnapshotIndex, setSelectedSnapshotIndex] = useState<number>(0);

  // Fetch cluster history
  const { data: history, isLoading, error } = useQuery<ClusterHistory>({
    queryKey: ["cluster-history", clusterId],
    queryFn: async () => {
      const response = await fetch(`${api.baseURL}/board/cluster/${clusterId}/history`);
      if (!response.ok) throw new Error("Failed to fetch cluster history");
      const data = await response.json();
      return data;
    },
  });

  // Set initial snapshot to the latest one
  useState(() => {
    if (history && history.snapshots.length > 0) {
      setSelectedSnapshotIndex(history.snapshots.length - 1);
    }
  }, [history]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error || !history) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Cluster not found</h1>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-purple-500 rounded-lg hover:bg-purple-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const currentSnapshot = history.snapshots[selectedSnapshotIndex];
  const isLatest = selectedSnapshotIndex === history.snapshots.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">{history.cluster.title}</h1>
              <p className="text-sm text-gray-400">{history.cluster.pillar}</p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {history.cluster.avg_impact}/10
                </div>
                <div className="text-xs text-gray-500">Impact</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {history.cluster.note_count}
                </div>
                <div className="text-xs text-gray-500">Notes</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Time Travel Banner */}
        {!isLatest && (
          <div className="mb-6 rounded-lg bg-yellow-500/20 border border-yellow-500/50 p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-400" />
            <div className="flex-1">
              <p className="text-yellow-200 font-medium">
                🕰️ You're viewing a historical snapshot
              </p>
              <p className="text-yellow-300/80 text-sm">
                This is how the cluster looked on{" "}
                {new Date(currentSnapshot.timestamp).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => setSelectedSnapshotIndex(history.snapshots.length - 1)}
              className="px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors font-medium"
            >
              Jump to Present
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Synthesis */}
          <div className="lg:col-span-2 space-y-6">
            {/* Executive Summary */}
            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold text-white">Executive Summary</h2>
                <span className="ml-auto text-xs text-gray-500">
                  {formatDistanceToNow(new Date(currentSnapshot.timestamp))} ago
                </span>
              </div>
              <div className="prose prose-invert max-w-none">
                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {currentSnapshot.synthesis}
                </p>
              </div>
            </div>

            {/* Evidence (Who said what) */}
            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">
                  Evidence ({currentSnapshot.evidence.length} notes)
                </h2>
              </div>
              <div className="space-y-4">
                {currentSnapshot.evidence.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg bg-gray-800/50 p-4 border border-gray-700/50"
                  >
                    <p className="text-gray-300 mb-3">{note.content}</p>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            {note.author.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-purple-400">
                            {note.author.job_title}
                          </span>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-400">{note.author.department}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Impact:</span>
                        <span className="font-bold text-orange-400">
                          {note.relevance_score}/10
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Metrics & Timeline */}
          <div className="space-y-6">
            {/* Metrics */}
            {currentSnapshot.metrics && Object.keys(currentSnapshot.metrics).length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Metrics</h3>
                <div className="space-y-3">
                  {Object.entries(currentSnapshot.metrics).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">{key}</span>
                      <span className="text-white font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline Info */}
            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-green-400" />
                <h3 className="text-lg font-semibold text-white">Timeline</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-gray-500">Created</div>
                  <div className="text-white font-medium">
                    {new Date(history.cluster.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Last Updated</div>
                  <div className="text-white font-medium">
                    {new Date(history.cluster.last_updated_at).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Total Snapshots</div>
                  <div className="text-white font-medium">{history.total_snapshots}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Time-Lapse Slider */}
        {history.snapshots.length > 1 && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold text-white">🕰️ Time Machine</h2>
              </div>
              <div className="text-sm text-gray-400">
                Snapshot {selectedSnapshotIndex + 1} of {history.snapshots.length}
              </div>
            </div>

            {/* Slider */}
            <div className="space-y-4">
              <input
                type="range"
                min="0"
                max={history.snapshots.length - 1}
                step="1"
                value={selectedSnapshotIndex}
                onChange={(e) => setSelectedSnapshotIndex(parseInt(e.target.value))}
                className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />

              {/* Timeline Labels */}
              <div className="flex justify-between text-xs text-gray-500">
                <span>
                  📅 {new Date(history.snapshots[0].timestamp).toLocaleDateString()}
                  <br />
                  <span className="text-gray-600">Origin</span>
                </span>
                <span className="text-center">
                  📅{" "}
                  {new Date(currentSnapshot.timestamp).toLocaleDateString()}
                  <br />
                  <span className="text-purple-400 font-medium">
                    {isLatest ? "Present" : "Selected"}
                  </span>
                </span>
                <span className="text-right">
                  📅{" "}
                  {new Date(
                    history.snapshots[history.snapshots.length - 1].timestamp
                  ).toLocaleDateString()}
                  <br />
                  <span className="text-gray-600">Latest</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

