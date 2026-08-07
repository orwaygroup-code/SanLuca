// app/api/checkin/[token]/qr.png/route.ts
// Sirve el código QR de check-in de una reserva como PNG DESDE NUESTRO DOMINIO.
// Necesario porque Meta (sobre todo Instagram) falla al descargar imágenes de hosts
// externos como api.qrserver.com ("upload attachment failure", IGApiException 2018xxx).
// Público: solo codifica la URL de check-in, no expone datos.

import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token;
  if (!token || !/^[A-Za-z0-9_-]{6,64}$/.test(token)) {
    return new NextResponse("Token inválido", { status: 400 });
  }
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://sanlucaristorante.com";
  const checkinUrl = `${appUrl}/checkin/${token}`;

  const png = await QRCode.toBuffer(checkinUrl, { width: 320, margin: 2, errorCorrectionLevel: "M" });
  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
