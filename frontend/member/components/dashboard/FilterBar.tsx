"use client";

import { Filter, X } from "lucide-react";
import { Pillar } from "@/app/dashboard/page";

interface FilterBarProps {
  minImpact: number;
  setMinImpact: (value: number) => void;
  selectedPillar: string | null;
  setSelectedPillar: (value: string | null) => void;
  pillars: Pillar[];
}

export function FilterBar({
  minImpact,
  setMinImpact,
  selectedPillar,
  setSelectedPillar,
  pillars,
}: FilterBarProps) {
  const hasActiveFilters = minImpact > 0 || selectedPillar !== null;

  const clearFilters = () => {
    setMinImpact(0);
    setSelectedPillar(null);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Filters</h2>
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Impact Slider */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Minimum Impact Score
            <span className="ml-2 text-purple-400 font-semibold">
              {minImpact > 0 ? minImpact : "All"}
            </span>
          </label>
          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={minImpact}
            onChange={(e) => setMinImpact(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0 (All)</span>
            <span>5</span>
            <span>10 (Critical)</span>
          </div>
        </div>

        {/* Pillar Dropdown */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Filter by Pillar
          </label>
          <select
            value={selectedPillar || ""}
            onChange={(e) => setSelectedPillar(e.target.value || null)}
            className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">All Pillars</option>
            {pillars.map((pillar) => (
              <option key={pillar.id} value={pillar.id}>
                {pillar.name}
              </option>
            ))}
          </select>
          {selectedPillar && (
            <p className="text-xs text-gray-500">
              {pillars.find((p) => p.id === selectedPillar)?.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

