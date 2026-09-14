import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeletePatientButton } from "@/components/DeletePatientButton";
import { DeleteReportButton } from "@/components/DeleteReportButton";
import { ArrowLeft, ExternalLink, Calendar, Building2 } from "lucide-react";
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
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Patient Directory
          </Link>
          <span className="font-mono text-xs text-slate-400">ID: {client.id}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
       {/* Patient Profile Card */}
<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
  <div>
    <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
    <p className="text-sm text-slate-500 font-mono mt-1">Phone: {client.phone || "N/A"}</p>
  </div>

  {/* Purge Patient Action */}
  <DeletePatientButton clientId={client.id} clientName={client.name} />
</div>

        {/* Interactive Longitudinal Trendline */}
        <BiomarkerTrendChart rawData={flatBiomarkers} />

        {/* Historical Slips */}
        <div className="space-y-6">
          <h2 className="text-base font-bold text-slate-800">
            Archived Test Reports ({client.testReports.length})
          </h2>

          {client.testReports.map((report) => (
            <div
              key={report.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Report Header */}
              <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-4 text-xs text-slate-600 font-medium">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {report.testDate ? new Date(report.testDate).toLocaleDateString() : "Date N/A"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {report.labName || "Diagnostic Lab"}
                  </span>
                </div>

                {/* Unified Action Buttons */}
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/media/${encodeURIComponent(report.filePath)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 transition shadow-sm"
                  >
                    <ExternalLink className="w-3 h-3" /> View Source File
                  </a>
                  <DeleteReportButton reportId={report.id} />
                </div>
              </div>

              {/* Biomarkers Table */}
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] text-slate-400 uppercase border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-2.5">Biomarker</th>
                    <th className="px-6 py-2.5">Value</th>
                    <th className="px-6 py-2.5">Unit</th>
                    <th className="px-6 py-2.5">Range</th>
                    <th className="px-6 py-2.5">Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.biomarkers.map((b) => (
                    <tr key={b.id} className={b.flag !== "NORMAL" ? "bg-amber-50/50" : ""}>
                      <td className="px-6 py-3 font-medium text-slate-800">{b.name}</td>
                      <td className="px-6 py-3 font-bold text-slate-900">{b.value ?? b.valueString}</td>
                      <td className="px-6 py-3 text-xs text-slate-500">{b.unit || "—"}</td>
                      <td className="px-6 py-3 text-xs text-slate-500">
                        {b.refLow !== null && b.refHigh !== null ? `${b.refLow} – ${b.refHigh}` : "—"}
                      </td>
                      <td className="px-6 py-3">
                        {b.flag === "HIGH" && <span className="text-xs font-bold text-red-600">HIGH ↑</span>}
                        {b.flag === "LOW" && <span className="text-xs font-bold text-blue-600">LOW ↓</span>}
                        {b.flag === "NORMAL" && <span className="text-xs text-slate-500">Normal</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}