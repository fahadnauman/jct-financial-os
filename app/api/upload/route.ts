import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create safe unique filename
    const timestamp = Date.now();
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `${timestamp}-${cleanName}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", "bills");
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/bills/${filename}`;

    return NextResponse.json({
      url: fileUrl,
      fileName: file.name,
      size: file.size,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });
  }
}
