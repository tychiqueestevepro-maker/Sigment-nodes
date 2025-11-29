"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GalaxyChart } from "@/components/dashboard/GalaxyChart";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { PriorityList } from "@/components/dashboard/PriorityList";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

export interface ClusterData {
  id: string;
  title: string;
  pillar: string;
  pillar_id: string;
  impact_score: number;
  volume: number;
  last_updated: string;
}

export interface Pillar {
  id: string;
  name: string;
  description: string;
}

export default function DashboardPage() {
  const [minImpact, setMinImpact] = useState<number>(0);
  const [selectedPillar, setSelectedPillar] = useState<string | null>(null);

  // Fetch galaxy data
  const { data: clusters = [], isLoading, error } = useQuery<ClusterData[]>({
    queryKey: ["galaxy", minImpact, selectedPillar],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (minImpact > 0) params.append("min_relevance", minImpact.toString());
      if (selectedPillar) params.append("pillar_id", selectedPillar);
      
      const response = await fetch(`${api.baseURL}/board/galaxy?${params}`);
      if (!response.ok) throw new Error("Failed to fetch galaxy data");
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch pillars for filter dropdown
  const { data: pillars = [] } = useQuery<Pillar[]>({
    queryKey: ["pillars"],
    queryFn: async () => {
      const response = await fetch(`${api.baseURL}/board/pillars`);
      if (!response.ok) throw new Error("Failed to fetch pillars");
      return response.json();
    },
  });

  if (error) {
    toast.error("Failed to load dashboard data");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                🌌 Strategic Galaxy
              </h1>
              <p className="text-sm text-gray-400">
                Real-time cluster visualization
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-400">
                {clusters.length} Active Clusters
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <FilterBar
          minImpact={minImpact}
          setMinImpact={setMinImpact}
          selectedPillar={selectedPillar}
          setSelectedPillar={setSelectedPillar}
          pillars={pillars}
        />

        {/* Dashboard Grid */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Galaxy Chart - 2/3 width */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Impact × Volume Matrix
              </h2>
              {isLoading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                </div>
              ) : (
                <GalaxyChart data={clusters} />
              )}
            </div>
          </div>

          {/* Priority List - 1/3 width */}
          <div className="lg:col-span-1">
            <PriorityList clusters={clusters} isLoading={isLoading} />
          </div>
        </div>
      </main>
    </div>
  );
}

