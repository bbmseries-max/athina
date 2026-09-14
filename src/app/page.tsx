import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { 
  Users, 
  FileText, 
  AlertTriangle, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Activity,
  ArrowRight
} from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const searchQuery = params.q?.trim() || "";
  const currentPage = Math.max(1, parseInt(params.page || "1", 10));
  const filterFlag = params.filter || "ALL";

  const whereClause = {
    ...(searchQuery
      ? {
          OR: [
            { name: { contains: searchQuery } },
            { phone: { contains: searchQuery } },
          ],
        }
      : {}),
    ...(filterFlag === "FLAGGED"
      ? {
          testReports: {
            some: {
              biomarkers: {
                some: { flag: { in: ["HIGH", "LOW"] } },
              },
            },
          },
        }
      : {}),
  };

  // Run queries in parallel
  const [clients, totalMatchingClients, totalReports, flaggedBiomarkers] = await Promise.all([
    prisma.client.findMany({
      where: whereClause,
      include: {
        testReports: {
          orderBy: { createdAt: "desc" },
          take: 1, // Only pull the most recent test to keep payloads small
          include: {
            biomarkers: {
              where: { flag: { in: ["HIGH", "LOW"] } },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.client.count({ where: whereClause }),
    prisma.testReport.count(),
    prisma.biomarker.count({ where: { flag: { in: ["HIGH", "LOW"] } } }),
  ]);

  const totalPages = Math.ceil(totalMatchingClients / PAGE_SIZE) || 1;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 text-white p-2 rounded-lg">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Clinical Diagnostic Console</h1>
              <p className="text-xs text-slate-500">Local-first medical aggregation • Offline Vault</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Indexed Patients</p>
              <p className="text-2xl font-bold text-slate-900">{totalMatchingClients}</p>
            </div>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Archived Lab Reports</p>
              <p className="text-2xl font-bold text-slate-900">{totalReports}</p>
            </div>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Flagged Metrics</p>
              <p className="text-2xl font-bold text-amber-600">{flaggedBiomarkers}</p>
            </div>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
          <form method="GET" className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              name="q"
              defaultValue={searchQuery}
              placeholder="Search by name or phone..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {filterFlag !== "ALL" && <input type="hidden" name="filter" value={filterFlag} />}
          </form>

          <div className="flex gap-2 w-full md:w-auto">
            <Link
              href={`/?q=${searchQuery}&filter=ALL`}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                filterFlag === "ALL"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              All
            </Link>
            <Link
              href={`/?q=${searchQuery}&filter=FLAGGED`}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                filterFlag === "FLAGGED"
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Needs Attention
            </Link>
          </div>
        </div>

        {/* High-Volume Patients Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5 font-semibold">Patient</th>
                <th className="px-6 py-3.5 font-semibold">Phone</th>
                <th className="px-6 py-3.5 font-semibold">Latest Test</th>
                <th className="px-6 py-3.5 font-semibold">Flagged Biomarkers</th>
                <th className="px-6 py-3.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    No patients match your criteria.
                  </td>
                </tr>
              ) : (
                clients.map((client) => {
                  const latest = client.testReports[0];
                  const flaggedCount = latest?.biomarkers.length || 0;

                  return (
                    <tr key={client.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-6 py-4 font-semibold text-slate-900">{client.name}</td>
                      <td className="px-6 py-4 text-slate-600 font-mono text-xs">{client.phone || "—"}</td>
                      <td className="px-6 py-4 text-slate-600 text-xs">
                        {latest ? (
                          <span>
                            {latest.testDate
                              ? new Date(latest.testDate).toLocaleDateString()
                              : new Date(latest.createdAt).toLocaleDateString()}{" "}
                            • <span className="font-medium text-slate-700">{latest.labName || "Lab"}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No reports yet</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {flaggedCount > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {flaggedCount} Flagged
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Clear</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/clients/${client.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
                        >
                          View History
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination Toolbar */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Showing Page <span className="font-semibold text-slate-800">{currentPage}</span> of{" "}
              <span className="font-semibold text-slate-800">{totalPages}</span>
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={`/?q=${searchQuery}&filter=${filterFlag}&page=${currentPage - 1}`}
                className={`p-2 rounded-lg border text-xs font-medium ${
                  currentPage <= 1
                    ? "pointer-events-none opacity-40 border-slate-200"
                    : "hover:bg-slate-50 border-slate-300 text-slate-700"
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
              <Link
                href={`/?q=${searchQuery}&filter=${filterFlag}&page=${currentPage + 1}`}
                className={`p-2 rounded-lg border text-xs font-medium ${
                  currentPage >= totalPages
                    ? "pointer-events-none opacity-40 border-slate-200"
                    : "hover:bg-slate-50 border-slate-300 text-slate-700"
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="flex items-center gap-3">
  {/* WhatsApp Sync Link */}
  <Link
    href="/whatsapp-sync"
    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition shadow-sm"
  >
    <Users className="w-3.5 h-3.5 text-emerald-600" />
    WhatsApp Contacts
  </Link>

  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
    Vault Active
  </span>
</div>
          </div>
        </div>
      </main>
    </div>
  );
}