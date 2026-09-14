import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // 1. Find the test report to get its file path
    const report = await prisma.testReport.findUnique({
      where: { id },
      select: { filePath: true, messageId: true },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // 2. Remove biomarkers linked to this report
    await prisma.biomarker.deleteMany({
      where: { testReportId: id },
    });

    // 3. Delete the TestReport record
    await prisma.testReport.delete({
      where: { id },
    });

    // 4. Optionally delete the linked Message record
    if (report.messageId) {
      await prisma.message.delete({
        where: { id: report.messageId },
      }).catch(() => {}); // Ignore if message has other relations
    }

    // 5. Delete the physical file from disk if it exists
    if (report.filePath && fs.existsSync(report.filePath)) {
      try {
        fs.unlinkSync(report.filePath);
        console.log(`Deleted file: ${report.filePath}`);
      } catch (fileErr) {
        console.error(`Could not delete file from disk:`, fileErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete report error:", error);
    return NextResponse.json(
      { error: "Failed to delete record" },
      { status: 500 }
    );
  }
}