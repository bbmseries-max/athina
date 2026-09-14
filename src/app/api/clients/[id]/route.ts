import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        testReports: { select: { filePath: true } },
        messages: { select: { filePath: true } },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const filePaths = new Set<string>();
    client.testReports.forEach((r: { filePath: string | null }) => {
      if (r.filePath) filePaths.add(r.filePath);
    });
    client.messages.forEach((m: { filePath: string | null }) => {
      if (m.filePath) filePaths.add(m.filePath);
    });

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

    await prisma.$transaction(async (tx) => {
      await tx.biomarker.deleteMany({
        where: { testReport: { clientId: id } },
      });
      await tx.testReport.deleteMany({
        where: { clientId: id },
      });
      await tx.message.deleteMany({
        where: { clientId: id },
      });
      await tx.client.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete patient:", error);
    return NextResponse.json({ error: "Failed to delete patient record" }, { status: 500 });
  }
}