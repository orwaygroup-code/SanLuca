"use client";
import type { AvailableTable, TableSelection } from "@/components/reservation/types";

interface Props {
  tables:    AvailableTable[];
  guests:    number;
  selection: TableSelection | null;
  onSelect:  (sel: TableSelection) => void;
}

export function PrivadoSelect({ tables, guests, selection, onSelect }: Props) {
  const table = tables[0]; // solo existe 1 mesa en Privado

  if (!table) return (
    <div style={{ textAlign: "center", padding: "2rem", color: "rgba(245,241,232,0.5)" }}>
      No hay mesa configurada en el área Privado.
    </div>
  );

  const isAvailable = table.status === "available" && table.capacity >= guests;
  const isSelected  = selection?.tableId === table.id;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "2rem 1rem" }}>
      {/* Tarjeta de la mesa privada */}
      <button
        onClick={isAvailable ? () => onSelect({ tableId: table.id, tableNumber: table.number }) : undefined}
        style={{
          width: 180, height: 160,
          background:   isSelected  ? "rgba(186,132,60,0.4)" : isAvailable ? "rgba(186,132,60,0.1)" : "rgba(255,255,255,0.03)",
          border:       `2px solid ${isSelected ? "#ba843c" : isAvailable ? "rgba(186,132,60,0.5)" : "rgba(255,255,255,0.1)"}`,
          borderRadius: 16,
          color:        isAvailable ? "#f5f1e8" : "rgba(255,255,255,0.2)",
          cursor:       isAvailable ? "pointer" : "default",
          display:      "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
          transition:   "all 0.2s ease",
          outline:      "none",
        }}
      >
        <span style={{ fontSize: "2rem" }}>🔒</span>
        <span style={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "0.05em" }}>PRIVADO</span>
        <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>Mesa para {table.capacity} personas</span>
        {!isAvailable && guests > table.capacity && (
          <span style={{ fontSize: "0.65rem", color: "rgba(255,100,100,0.8)", marginTop: 4 }}>Máximo {table.capacity} personas</span>
        )}
      </button>

      <p style={{ fontSize: "0.8rem", color: "rgba(245,241,232,0.5)", textAlign: "center", maxWidth: 280 }}>
        {isAvailable
          ? isSelected
            ? "Área privada seleccionada. Confirma tu reserva."
            : "El área privada está disponible para tu horario."
          : table.status === "occupied"
          ? "El área privada ya está reservada en ese horario."
          : `El área privada tiene capacidad máxima de ${table.capacity} personas.`}
      </p>
    </div>
  );
}
