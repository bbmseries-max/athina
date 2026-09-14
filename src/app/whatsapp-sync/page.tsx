import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, UserPlus, CheckCircle2, MessageSquare, Phone } from "lucide-react";
import { importDiscoveredPatient } from "@/app/actions/import-chat";

export const dynamic = "force-dynamic";

export default async function WhatsAppSyncPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || "";

  // Fetch discovered chats
  const discoveredChats = await prisma.discoveredChat.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query } },
            { phone: { contains: query } },
          ],
        }
      : undefined,
    orderBy: [
      { imported: "asc" }, // Unimported contacts first
      { updatedAt: "desc" },
    ],
  });

  const totalDiscovered = discoveredChats.length;
  const totalImported = discoveredChats.filter((c) => c.imported).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">
              Synced: <strong className="text-slate-800">{totalImported}</strong> / {totalDiscovered} Contacts
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">WhatsApp Historical Contacts</h1>
          <p className="text-sm text-slate-500 mt-1">
            Selectively import contacts from WhatsApp chat history into your official patient database.
          </p>
        </div>

        {/* Search Input */}
        <form method="GET" className="max-w-md">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search by contact name or phone..."
            className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
        </form>

        {/* Contacts Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5 font-semibold">Contact / Push Name</th>
                <th className="px-6 py-3.5 font-semibold">Phone Number</th>
                <th className="px-6 py-3.5 font-semibold">Unread Items</th>
                <th className="px-6 py-3.5 font-semibold">Status</th>
                <th className="px-6 py-3.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {discoveredChats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No WhatsApp chat records found yet. As Baileys synchronizes history, conversations will appear here.
                  </td>
                </tr>
              ) : (
                discoveredChats.map((chat) => (
                  <tr key={chat.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4 font-semibold text-slate-900">{chat.name}</td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        +{chat.phone}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {chat.unreadCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
                          {chat.unreadCount} new
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {chat.imported ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Registered Patient
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Unlinked Chat</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {chat.imported ? (
                        <Link
                          href={`/?q=${encodeURIComponent(chat.phone)}`}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-4"
                        >
                          View in Console
                        </Link>
                      ) : (
                        <form action={importDiscoveredPatient}>
                          <input type="hidden" name="jid" value={chat.jid} />
                          <input type="hidden" name="phone" value={chat.phone} />
                          <input type="hidden" name="name" value={chat.name} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Import as Patient
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}