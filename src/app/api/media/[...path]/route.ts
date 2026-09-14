import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await context.params;
  const decodedPath = pathSegments.map((seg) => decodeURIComponent(seg)).join(path.sep);

  // Reconstruct the full path (handles Windows drive letters e.g. D:\athina_storage\...)
  const fullPath = decodedPath.includes(":") ? decodedPath : path.resolve(decodedPath);

  if (!fs.existsSync(fullPath)) {
    return new NextResponse("File not found", { status: 404 });
  }

  const stat = fs.statSync(fullPath);
  const ext = path.extname(fullPath).toLowerCase();
  
  let contentType = "application/octet-stream";
  if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
  else if (ext === ".png") contentType = "image/png";
  else if (ext === ".pdf") contentType = "application/pdf";

  const fileStream = fs.createReadStream(fullPath);
  
  return new NextResponse(fileStream as unknown as ReadableStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": stat.size.toString(),
      "Cache-Control": "private, max-age=3600",
    },
  });
}