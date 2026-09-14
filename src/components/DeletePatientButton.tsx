"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function DeletePatientButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    const confirmation = window.prompt(
      `⚠️ WARNING: This will permanently delete patient "${clientName}", all their lab tests, biomarkers, and disk files.\n\nType DELETE to confirm:`
    );

    if (confirmation !== "DELETE") {
      if (confirmation !== null) {
        alert("Action canceled. You must type DELETE exactly to confirm.");
      }
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete patient");
      }

      // Redirect back to main patient registry
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to purge patient";
      alert(`Error: ${message}`);
      console.error(err);
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 hover:border-rose-300 text-xs font-semibold rounded-lg transition disabled:opacity-50"
      title="Purge patient and all files"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Trash2 className="w-3.5 h-3.5" />
      )}
      Delete Patient
    </button>
  );
}