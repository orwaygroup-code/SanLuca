"use client";

interface GuestsPickerProps {
  value: number;
  onChange: (n: number) => void;
  onLargeGroup?: () => void;
  largeGroupLabel?: string;
}

const ICONS: Record<number, string> = { 1: "👤", 2: "👥" };

export function GuestsPicker({ value, onChange, onLargeGroup, largeGroupLabel }: GuestsPickerProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: 5,
      }}>
        {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => {
          const isSelected = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              style={{
                padding: "7px 4px 6px",
                borderRadius: 8,
                border: isSelected
                  ? "1px solid #ba843c"
                  : "1px solid rgba(186,132,60,0.18)",
                background: isSelected
                  ? "rgba(186,132,60,0.16)"
                  : "rgba(186,132,60,0.04)",
                color: isSelected ? "#ba843c" : "rgba(245,241,232,0.45)",
                fontSize: "0.95rem",
                fontWeight: isSelected ? 800 : 400,
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                lineHeight: 1,
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = "rgba(186,132,60,0.09)";
                  e.currentTarget.style.borderColor = "rgba(186,132,60,0.4)";
                  e.currentTarget.style.color = "rgba(245,241,232,0.7)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = "rgba(186,132,60,0.04)";
                  e.currentTarget.style.borderColor = "rgba(186,132,60,0.18)";
                  e.currentTarget.style.color = "rgba(245,241,232,0.45)";
                }
              }}
            >
              <span>{ICONS[n] ?? n}</span>
              {n > 2 && (
                <span style={{ fontSize: "0.42rem", letterSpacing: "0.04em", opacity: 0.65 }}>
                  {n === 1 ? "PERS" : "PERS"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {onLargeGroup && (
        <button
          type="button"
          onClick={onLargeGroup}
          style={{
            padding: "9px 14px",
            borderRadius: 8,
            border: "1px solid rgba(186,132,60,0.25)",
            background: "rgba(186,132,60,0.06)",
            color: "rgba(186,132,60,0.8)",
            fontSize: "0.7rem",
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(186,132,60,0.12)";
            e.currentTarget.style.borderColor = "rgba(186,132,60,0.5)";
            e.currentTarget.style.color = "#ba843c";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(186,132,60,0.06)";
            e.currentTarget.style.borderColor = "rgba(186,132,60,0.25)";
            e.currentTarget.style.color = "rgba(186,132,60,0.8)";
          }}
        >
          {largeGroupLabel ?? "16 o más · Reservar área completa"}
        </button>
      )}
    </div>
  );
}
