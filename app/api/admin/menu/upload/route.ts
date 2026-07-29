import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/dualAuth";
import type { ApiResponse } from "@/types";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

/**
 * POST /api/admin/menu/upload (multipart, campo "file") — sube una imagen de
 * platillo. Solo ADMIN. Valida tipo (imagen) y tamaño (≤5MB), nombre aleatorio
 * (sin path traversal), la guarda en public/uploads/menu y devuelve su ruta
 * pública. Sirve con `next start`; persiste entre reinicios/deploys.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json<ApiResponse>({ success: false, error: "Formato inválido" }, { status: 400 }); }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json<ApiResponse>({ success: false, error: "No se recibió ninguna imagen" }, { status: 400 });

  const ext = EXT_BY_MIME[file.type];
  if (!ext) return NextResponse.json<ApiResponse>({ success: false, error: "Solo imágenes (PNG, JPG, WEBP o GIF)" }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json<ApiResponse>({ success: false, error: "La imagen supera 5 MB" }, { status: 413 });
  if (file.size === 0) return NextResponse.json<ApiResponse>({ success: false, error: "La imagen está vacía" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads", "menu");
  await fs.mkdir(dir, { recursive: true });
  const name = `${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(dir, name), bytes);

  return NextResponse.json<ApiResponse>({ success: true, data: { path: `/uploads/menu/${name}` } });
}
