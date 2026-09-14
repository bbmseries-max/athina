import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { 
  Users, 
  FileText, 
  ChevronRight, 
  Calendar, 
  Activity
} from "lucide-react";

export default async function PatientsDirectoryPage() {
  const clients = await prisma.client.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      testReports: {
        select: {
          id: true,
          testDate: true,
          createdAt: true,
          labName: true,
          _count: { select: { biomarkers: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: {
        select: { testReports: true },
      },
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Top Clinic Header */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-sm sticky top-0 z-20 shadow-xs">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">
                Athina Health
              </h1>
              <p className="text-xs text-slate-500 font-medium">Clinical Document & Biomarker Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200/80">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              Ingestion Active
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Patients</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{clients.length}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Processed Slips</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">
                {clients.reduce((acc, c) => acc + c._count.testReports, 0)}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Storage Target</div>
              <div className="text-xs font-mono font-semibold text-slate-700 mt-1">D:\athina_storage</div>
            </div>
          </div>
        </div>

        {/* Patient Table Directory Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Patient Directory</h2>
              <p className="text-xs text-slate-500 mt-0.5">All monitored patients and incoming diagnostic series</p>
            </div>
          </div>

          {clients.length === 0 ? (
            <div className="p-16 text-center">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">No patients registered yet</p>
              <p className="text-xs text-slate-400 mt-1">Drop a report into the dropzone or send a file via Viber/WhatsApp to start.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200/80 text-sm text-left">
                <thead className="bg-slate-50/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Patient Name</th>
                    <th className="px-6 py-3.5">Contact / Channel</th>
                    <th className="px-6 py-3.5 text-center">Total Reports</th>
                    <th className="px-6 py-3.5">Latest Test</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.map((client) => {
                    const latestReport = client.testReports[0];
                    const testDate = latestReport?.testDate || latestReport?.createdAt;

                    return (
                      <tr
                        key={client.id}
                        className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <Link href={`/clients/${client.id}`} className="block">
                            <div className="font-semibold text-slate-900 group-hover:text-teal-700 transition">
                              {client.name}
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              #{client.id.slice(-6).toUpperCase()}
                            </div>
                          </Link>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-600">
                          {client.phone || "—"}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
                            {client._count.testReports}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600">
                          {testDate ? (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{new Date(testDate).toLocaleDateString()}</span>
                              {latestReport?.labName && (
                                <span className="text-slate-400 truncate max-w-36">
                                  • {latestReport.labName}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">None yet</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/clients/${client.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 transition shadow-xs"
                          >
                            Open Records
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}