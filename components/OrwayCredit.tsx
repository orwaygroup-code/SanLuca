"use client";

import { fonts } from "@/config/theme";
import { useTranslation } from "@/lib/i18n";
import { C } from "@/components/staff/ui";

const ORWAY_URL = "https://orwaygroup.com/";

/**
 * Crédito de autoría — "Desarrollado por OrwayGroup" + isologo, enlazado al
 * sitio de ORWAY.
 *
 * La leyenda sale del diccionario i18n (`footer.developedBy`), así que ya
 * viene traducida a es/en/de/ja/zh sin trabajo extra.
 *
 * Dos variantes:
 *   inline → se incrusta en la barra inferior del Footer público, que ya
 *            tiene su propio color y separadores.
 *   bar    → barra al final del contenido. Usa `C.bg`, el MISMO fondo de los
 *            paneles de staff/admin/crm, sin borde ni relleno propio, para que
 *            se lea como parte del panel y no como una etiqueta sobrepuesta.
 *
 * Importante: en /admin y /crm esta barra va DENTRO del <main> del shell, no
 * después. Si se cuelga fuera, suma alto al documento por encima del 100vh del
 * shell y el drawer del menú de hamburguesa deja de cubrir la pantalla completa.
 */
export function OrwayCredit({
  variant = "bar",
  color,
  background,
}: {
  variant?: "bar" | "inline";
  color?: string;
  background?: string;
}) {
  const { t } = useTranslation();

  const tone = color ?? C.dim;

  const content = (
    <a
      href={ORWAY_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontFamily: fonts.primary,
        fontSize: "0.7rem",
        fontWeight: 400,
        color: tone,
        lineHeight: 1,
        textDecoration: "none",
      }}
    >
      {/* isologo: viewBox 77.35 x 60.81 → se mantiene la proporción 1.27:1 */}
      <img
        src="/icons/isologo.svg"
        alt="OrwayGroup"
        width={16}
        height={13}
        style={{ display: "block", height: 13, width: "auto", flexShrink: 0 }}
      />
      {t.footer.developedBy}
    </a>
  );

  if (variant === "inline") return content;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "18px 16px",
        background: background ?? C.bg,
      }}
    >
      {content}
    </div>
  );
}
