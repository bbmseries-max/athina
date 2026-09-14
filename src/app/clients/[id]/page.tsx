import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeletePatientButton } from "@/components/DeletePatientButton";
import { DeleteReportButton } from "@/components/DeleteReportButton";
import { ArrowLeft, ExternalLink, Calendar, Building2, Phone, Hash } from "lucide-react";
import { BiomarkerTrendChart } from "@/components/BiomarkerTrendChart";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      testReports: {
        orderBy: { createdAt: "desc" },
        include: { biomarkers: true },
      },
    },
  });

  if (!client) notFound();

  // Flatten biomarkers across all reports for the trend chart
  const flatBiomarkers = client.testReports.flatMap((report) =>
    report.biomarkers.map((b) => ({
      id: b.id,
      name: b.name,
      value: b.value,
      valueString: b.valueString,
      unit: b.unit,
      refLow: b.refLow,
      refHigh: b.refHigh,
      flag: b.flag,
      testDate: (report.testDate || report.createdAt).toISOString(),
      labName: report.labName,
    }))
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Sticky Top Navigation Bar */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-20 shadow-xs">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400" />
            <span>Back to Directory</span>
          </Link>
          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">
            <Hash className="w-3 h-3 text-slate-400" />
            <span>{client.id}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Patient Profile Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-100/80 flex items-center justify-center text-teal-700 font-bold text-2xl shadow-xs">
              {client.name ? client.name.charAt(0).toUpperCase() : "P"}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {client.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-mono">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {client.phone || "No phone listed"}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500">
                  {client.testReports.length} {client.testReports.length === 1 ? "report" : "reports"} on file
                </span>
              </div>
            </div>
          </div>

          <div className="self-end md:self-auto">
            <DeletePatientButton clientId={client.id} clientName={client.name} />
          </div>
        </div>

        {/* Interactive Longitudinal Trendline */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-4">Biomarker Longitudinal History</h2>
          <BiomarkerTrendChart rawData={flatBiomarkers} />
        </div>

        {/* Historical Slips */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Archived Diagnostic Reports ({client.testReports.length})
            </h2>
          </div>

          {client.testReports.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-400 text-sm">
              No lab reports registered for this patient yet.
            </div>
          ) : (
            client.testReports.map((report) => (
              <div
                key={report.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
              >
                {/* Report Sub-Header */}
                <div className="px-6 py-4 bg-slate-50/60 border-b border-slate-200/80 flex flex-wrap justify-between items-center gap-3">
                  <div className="flex items-center gap-6 text-xs text-slate-600 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {report.testDate
                        ? new Date(report.testDate).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "Date Unspecified"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {report.labName || "Diagnostic Center"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/media/${encodeURIComponent(report.filePath)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 hover:border-slate-300 transition shadow-xs"
                    >
                      <ExternalLink className="w-3 h-3 text-slate-500" /> Source Slip
                    </a>
                    <DeleteReportButton reportId={report.id} />
                  </div>
                </div>

                {/* Biomarkers Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200/80 text-sm text-left">
                    <thead className="bg-slate-50/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3.5 text-left">Biomarker</th>
                        <th className="px-6 py-3.5 text-right">Result</th>
                        <th className="px-6 py-3.5 text-center">Reference Range</th>
                        <th className="px-6 py-3.5 text-right">Evaluation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.biomarkers.map((b) => {
                        const isHigh = b.flag === "HIGH";
                        const isLow = b.flag === "LOW";
                        const isAlert = isHigh || isLow;

                        return (
                          <tr
                            key={b.id}
                            className={`transition-colors ${
                              isAlert ? "bg-rose-50/25 hover:bg-rose-50/40" : "hover:bg-slate-50/60"
                            }`}
                          >
                            <td className="px-6 py-3.5 font-medium text-slate-900">
                              {b.name}
                            </td>
                            <td className={`px-6 py-3.5 text-right font-mono font-semibold tabular-nums ${
                              isAlert ? "text-rose-600" : "text-slate-800"
                            }`}>
                              {b.value ?? b.valueString ?? "—"}
                              {b.unit && (
                                <span className="ml-1 text-xs text-slate-400 font-normal font-sans">
                                  {b.unit}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-3.5 text-center font-mono text-xs text-slate-500 tabular-nums">
                              {b.refLow !== null && b.refHigh !== null
                                ? `${b.refLow} – ${b.refHigh}`
                                : "—"}
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${
                                  isHigh
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : isLow
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                }`}
                              >
                                {isHigh ? "HIGH ↑" : isLow ? "LOW ↓" : "NORMAL"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}