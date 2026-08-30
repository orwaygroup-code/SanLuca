"use client";

import { fonts } from "@/config/theme";
import { useTranslation } from "@/lib/i18n";

/**
 * Crédito de autoría — "Desarrollado por OrwayGroup" + isologo.
 *
 * La leyenda sale del diccionario i18n (`footer.developedBy`), así que ya
 * viene traducida a es/en/de/ja/zh sin trabajo extra.
 *
 * Dos variantes:
 *   inline → se incrusta en la barra inferior del Footer público, que ya
 *            tiene su propio color y separadores.
 *   bar    → barra propia para las secciones sin Footer (/staff, /admin,
 *            /crm, /login, /checkin). Colores en gris medio a propósito:
 *            se leen igual sobre fondo claro y oscuro, y esas secciones no
 *            comparten paleta con el sitio público.
 */
export function OrwayCredit({
  variant = "bar",
  color,
}: {
  variant?: "bar" | "inline";
  color?: string;
}) {
  const { t } = useTranslation();

  const tone = color ?? "rgba(128,128,128,0.85)";

  const content = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontFamily: fonts.primary,
        fontSize: "0.7rem",
        fontWeight: 400,
        color: tone,
        lineHeight: 1,
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
    </span>
  );

  if (variant === "inline") return content;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "14px 16px",
        borderTop: "1px solid rgba(128,128,128,0.18)",
      }}
    >
      {content}
    </div>
  );
}
