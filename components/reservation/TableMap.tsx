"use client";
import { SalonMap }      from "@/components/reservation/maps/SalonMap";
import { TerrazaMap }    from "@/components/reservation/maps/TerrazaMap";
import { PlantaAltaMap } from "@/components/reservation/maps/PlantaAltaMap";
import { PrivadoSelect } from "@/components/reservation/maps/PrivadoSelect";
import type { AvailabilityData, TableSelection } from "@/components/reservation/types";
import { TRIPLE_MIN_GUESTS } from "@/lib/tableAdjacency";

interface Props {
  data:      AvailabilityData;
  guests:    number;
  selection: TableSelection | null;
  onSelect:  (sel: TableSelection) => void;
}

export function TableMap({ data, guests, selection, onSelect }: Props) {
  const props = { tables: data.tables, pairs: data.pairs, triples: data.triples, guests, selection, onSelect };

  const legend = (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 10, justifyContent: "center" }}>
      {[
        { bg: "#2c3537", border: "none",                              label: "Disponible" },
        guests >= 5 && guests < TRIPLE_MIN_GUESTS
          ? { bg: "#3d3020", border: "1px solid rgba(186,132,60,0.6)", label: "Par combinable" }
          : null,
        guests >= TRIPLE_MIN_GUESTS
          ? { bg: "#1e3020", border: "1px solid rgba(100,200,80,0.6)", label: "Triple combinable" }
          : null,
        { bg: "#ba843c", border: "none",                              label: "Seleccionada" },
        { bg: "#1e2426", border: "none",                              label: "Ocupada" },
      ].filter(Boolean).map((item) => {
        const l = item!;
        return (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: l.bg, border: l.border, flexShrink: 0 }} />
            <span style={{ fontSize: "0.68rem", color: "rgba(245,241,232,0.45)" }}>{l.label}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ width: "100%" }}>
      {data.sectionName === "Salón"       && <SalonMap      {...props} />}
      {data.sectionName === "Terraza"     && <TerrazaMap    {...props} />}
      {data.sectionName === "Planta Alta" && <PlantaAltaMap {...props} />}
      {data.sectionName === "Privado"     && <PrivadoSelect tables={data.tables} guests={guests} selection={selection} onSelect={onSelect} />}
      {data.sectionName !== "Privado" && legend}
    </div>
  );
}
