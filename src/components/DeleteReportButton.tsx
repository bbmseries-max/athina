"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function DeleteReportButton({ reportId }: { reportId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this test report and its associated source file? This action cannot be undone."
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      router.refresh(); // Refresh current page view
    } catch (err) {
      alert("Error deleting record. Check server logs.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-md transition disabled:opacity-50"
      title="Delete report and file"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
      Delete
    </button>
  );
}