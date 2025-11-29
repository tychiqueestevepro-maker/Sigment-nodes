"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { ClusterData } from "@/app/dashboard/page";

interface GalaxyChartProps {
  data: ClusterData[];
}

// Color mapping for different pillars
const PILLAR_COLORS: Record<string, string> = {
  ESG: "#10b981", // Green
  Innovation: "#3b82f6", // Blue
  Operations: "#f59e0b", // Amber
  Finance: "#8b5cf6", // Purple
  HR: "#ec4899", // Pink
  Tech: "#06b6d4", // Cyan
  Default: "#6b7280", // Gray
};

const getPillarColor = (pillar: string): string => {
  return PILLAR_COLORS[pillar] || PILLAR_COLORS.Default;
};

export function GalaxyChart({ data }: GalaxyChartProps) {
  // Get unique pillars for legend
  const uniquePillars = Array.from(new Set(data.map((d) => d.pillar)));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const cluster = payload[0].payload;
      return (
        <div className="rounded-lg border border-white/20 bg-black/90 backdrop-blur-xl p-4 shadow-xl">
          <p className="font-semibold text-white mb-2">{cluster.title}</p>
          <div className="space-y-1 text-sm">
            <p className="text-gray-300">
              <span className="text-gray-500">Pillar:</span>{" "}
              <span
                className="font-medium"
                style={{ color: getPillarColor(cluster.pillar) }}
              >
                {cluster.pillar}
              </span>
            </p>
            <p className="text-gray-300">
              <span className="text-gray-500">Impact Score:</span>{" "}
              <span className="font-medium">{cluster.impact_score}/10</span>
            </p>
            <p className="text-gray-300">
              <span className="text-gray-500">Volume:</span>{" "}
              <span className="font-medium">{cluster.volume} notes</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom legend
  const CustomLegend = () => (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {uniquePillars.map((pillar) => (
        <div key={pillar} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getPillarColor(pillar) }}
          />
          <span className="text-sm text-gray-300">{pillar}</span>
        </div>
      ))}
    </div>
  );

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-4">🌌</div>
          <p>No clusters to display</p>
          <p className="text-sm mt-2">Create some notes to see the galaxy!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={500}>
        <ScatterChart
          margin={{
            top: 20,
            right: 20,
            bottom: 20,
            left: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            type="number"
            dataKey="impact_score"
            name="Impact Score"
            domain={[0, 10]}
            label={{
              value: "Strategic Impact",
              position: "insideBottom",
              offset: -10,
              style: { fill: "#9ca3af" },
            }}
            stroke="#6b7280"
            tick={{ fill: "#9ca3af" }}
          />
          <YAxis
            type="number"
            dataKey="volume"
            name="Volume"
            label={{
              value: "Note Volume",
              angle: -90,
              position: "insideLeft",
              style: { fill: "#9ca3af" },
            }}
            stroke="#6b7280"
            tick={{ fill: "#9ca3af" }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={data} fill="#8884d8">
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getPillarColor(entry.pillar)}
                opacity={0.8}
                r={8 + entry.impact_score} // Larger circles for higher impact
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <CustomLegend />
    </div>
  );
}

