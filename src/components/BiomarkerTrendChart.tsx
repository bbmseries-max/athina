"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface BiomarkerRecord {
  id: string;
  name: string;
  value: number | null;
  valueString: string | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  flag: string | null;
  testDate: string;
  labName: string | null;
}

export function BiomarkerTrendChart({ rawData }: { rawData: BiomarkerRecord[] }) {
  // Collect all unique biomarker names that contain numeric results
  const availableBiomarkers = useMemo(() => {
    const set = new Set<string>();
    rawData.forEach((item) => {
      if (item.value !== null) {
        set.add(item.name);
      }
    });
    return Array.from(set).sort();
  }, [rawData]);

  const [selectedBiomarker, setSelectedBiomarker] = useState<string>(
    availableBiomarkers[0] || ""
  );

  // Filter and sort points chronologically for the selected biomarker
  const chartData = useMemo(() => {
    if (!selectedBiomarker) return [];

    return rawData
      .filter((d) => d.name === selectedBiomarker && d.value !== null)
      .sort((a, b) => new Date(a.testDate).getTime() - new Date(b.testDate).getTime())
      .map((d) => ({
        date: new Date(d.testDate).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "2-digit",
        }),
        value: d.value,
        unit: d.unit || "",
        refLow: d.refLow,
        refHigh: d.refHigh,
        flag: d.flag,
        labName: d.labName || "Lab",
      }));
  }, [rawData, selectedBiomarker]);

  if (availableBiomarkers.length === 0) {
    return (
      <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-slate-400 text-sm">
        No numeric biomarkers available yet for historical charting.
      </div>
    );
  }

  // Get active bounds for reference shading
  const currentRefLow = chartData.find((d) => d.refLow !== null)?.refLow ?? null;
  const currentRefHigh = chartData.find((d) => d.refHigh !== null)?.refHigh ?? null;
  const activeUnit = chartData[0]?.unit || "";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Biomarker Trajectory Over Time
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare longitudinal values against standardized reference ranges
          </p>
        </div>

        {/* Biomarker Selector Dropdown */}
        <div className="flex items-center gap-2">
          <label htmlFor="marker-select" className="text-xs font-semibold text-slate-500">
            Select Metric:
          </label>
          <select
            id="marker-select"
            value={selectedBiomarker}
            onChange={(e) => setSelectedBiomarker(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {availableBiomarkers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {chartData.length < 2 ? (
        <div className="py-12 text-center text-slate-400 text-xs italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
          At least 2 tests required to generate a trendline. Only 1 record found for {selectedBiomarker} ({chartData[0]?.value} {activeUnit}).
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 15, right: 25, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#64748B" }}
                stroke="#CBD5E1"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748B" }}
                stroke="#CBD5E1"
                unit={activeUnit ? ` ${activeUnit}` : ""}
                domain={["auto", "auto"]}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1">
                        <p className="font-bold text-slate-200 border-b border-slate-700 pb-1">
                          {d.date} • {d.labName}
                        </p>
                        <p className="text-emerald-400 font-semibold text-sm">
                          {selectedBiomarker}: {d.value} {d.unit}
                        </p>
                        {d.refLow !== null && d.refHigh !== null && (
                          <p className="text-slate-400">
                            Normal Range: {d.refLow} – {d.refHigh} {d.unit}
                          </p>
                        )}
                        <p>
                          Status:{" "}
                          <span
                            className={
                              d.flag === "HIGH"
                                ? "text-red-400 font-bold"
                                : d.flag === "LOW"
                                ? "text-blue-400 font-bold"
                                : "text-emerald-400"
                            }
                          >
                            {d.flag}
                          </span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Shaded Normal Range Window */}
              {currentRefLow !== null && currentRefHigh !== null && (
                <ReferenceArea
                  y1={currentRefLow}
                  y2={currentRefHigh}
                  fill="#10B981"
                  fillOpacity={0.08}
                  stroke="#10B981"
                  strokeOpacity={0.2}
                />
              )}

              {currentRefLow !== null && (
                <ReferenceLine
                  y={currentRefLow}
                  stroke="#10B981"
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                />
              )}

              {currentRefHigh !== null && (
                <ReferenceLine
                  y={currentRefHigh}
                  stroke="#EF4444"
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                />
              )}

              <Line
                type="monotone"
                dataKey="value"
                stroke="#0F172A"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#0F172A", strokeWidth: 2, stroke: "#FFF" }}
                activeDot={{ r: 6, fill: "#10B981" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}