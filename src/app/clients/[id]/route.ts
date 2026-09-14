import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // 1. Verify client exists and fetch associated file paths
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        testReports: {
          select: { filePath: true },
        },
        messages: {
          select: { filePath: true },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // 2. Gather unique physical file paths to delete from disk
    const filePaths = new Set<string>();
    client.testReports.forEach((r: { filePath: string | null }) => {
      if (r.filePath) filePaths.add(r.filePath);
    });
    client.messages.forEach((m: { filePath: string | null }) => {
      if (m.filePath) filePaths.add(m.filePath);
    });

    // 3. Delete files from D:\athina_storage
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`[Storage] Deleted file: ${filePath}`);
        }
      } catch (fileErr) {
        console.error(`[Storage] Failed to remove ${filePath}:`, fileErr);
      }
    }

    // 4. Cascade database deletion in an atomic transaction
    await prisma.$transaction(async (tx) => {
      // Delete biomarkers for all reports belonging to this client
      await tx.biomarker.deleteMany({
        where: {
          testReport: {
            clientId: id,
          },
        },
      });

      // Delete test reports
      await tx.testReport.deleteMany({
        where: { clientId: id },
      });

      // Delete messages
      await tx.message.deleteMany({
        where: { clientId: id },
      });

      // Delete the client record
      await tx.client.delete({
        where: { id },
      });
    });

    console.log(`[Database] Successfully purged patient ${id} and all related records.`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete patient:", error);
    return NextResponse.json(
      { error: "Failed to delete patient record" },
      { status: 500 }
    );
  }
}