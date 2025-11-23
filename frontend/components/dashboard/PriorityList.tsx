"use client";

import { TrendingUp, Users } from "lucide-react";
import { ClusterData } from "@/app/dashboard/page";
import { formatDistanceToNow } from "date-fns";

interface PriorityListProps {
  clusters: ClusterData[];
  isLoading: boolean;
}

export function PriorityList({ clusters, isLoading }: PriorityListProps) {
  // Sort by impact score descending, then by volume
  const sortedClusters = [...clusters].sort((a, b) => {
    if (b.impact_score !== a.impact_score) {
      return b.impact_score - a.impact_score;
    }
    return b.volume - a.volume;
  });

  // Take top 10
  const topClusters = sortedClusters.slice(0, 10);

  const getImpactColor = (score: number) => {
    if (score >= 8) return "text-red-400";
    if (score >= 6) return "text-orange-400";
    if (score >= 4) return "text-yellow-400";
    return "text-gray-400";
  };

  const getImpactLabel = (score: number) => {
    if (score >= 8) return "Critical";
    if (score >= 6) return "High";
    if (score >= 4) return "Medium";
    return "Low";
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-400" />
          Top Priorities
        </h2>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse bg-gray-800 rounded-lg h-20"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  if (topClusters.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-400" />
          Top Priorities
        </h2>
        <div className="text-center text-gray-400 py-8">
          <p className="text-sm">No clusters to prioritize</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-purple-400" />
        Top Priorities
      </h2>

      <div className="space-y-3">
        {topClusters.map((cluster, index) => (
          <div
            key={cluster.id}
            className="group relative rounded-lg border border-white/10 bg-gradient-to-br from-gray-800/50 to-gray-900/50 p-4 hover:border-purple-500/50 transition-all cursor-pointer"
          >
            {/* Rank Badge */}
            <div className="absolute -top-2 -left-2 flex items-center justify-center w-6 h-6 rounded-full bg-purple-500 text-white text-xs font-bold">
              {index + 1}
            </div>

            {/* Cluster Info */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white line-clamp-2 pr-2">
                {cluster.title}
              </h3>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">{cluster.pillar}</span>
                <span className={`font-medium ${getImpactColor(cluster.impact_score)}`}>
                  {getImpactLabel(cluster.impact_score)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-gray-400">
                  <Users className="w-3 h-3" />
                  <span>{cluster.volume} notes</span>
                </div>
                <div className={`font-bold ${getImpactColor(cluster.impact_score)}`}>
                  {cluster.impact_score}/10
                </div>
              </div>

              {cluster.last_updated && (
                <div className="text-xs text-gray-500">
                  Updated {formatDistanceToNow(new Date(cluster.last_updated))} ago
                </div>
              )}
            </div>

            {/* Hover Effect */}
            <div className="absolute inset-0 rounded-lg bg-purple-500/0 group-hover:bg-purple-500/5 transition-all pointer-events-none" />
          </div>
        ))}
      </div>

      {sortedClusters.length > 10 && (
        <div className="mt-4 text-center text-xs text-gray-500">
          Showing top 10 of {sortedClusters.length} clusters
        </div>
      )}
    </div>
  );
}

