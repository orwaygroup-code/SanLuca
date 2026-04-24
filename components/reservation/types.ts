export interface AvailableTable {
  id:       string;
  number:   number;
  capacity: number;
  status:   "available" | "occupied";
}

export interface AvailablePair {
  tableA: { id: string; number: number };
  tableB: { id: string; number: number };
}

export interface AvailableTriple {
  tableA: { id: string; number: number };
  tableB: { id: string; number: number };
  tableC: { id: string; number: number };
}

export interface AvailableQuad {
  tableA: { id: string; number: number };
  tableB: { id: string; number: number };
  tableC: { id: string; number: number };
  tableD: { id: string; number: number };
}

export interface TableSelection {
  tableId:             string;
  tableNumber:         number;
  linkedTableId?:      string;
  linkedTableNumber?:  number;
  thirdTableId?:       string;
  thirdTableNumber?:   number;
  fourthTableId?:      string;
  fourthTableNumber?:  number;
}

export interface AvailabilityData {
  sectionName:         string;
  tables?:             AvailableTable[];
  pairs?:              AvailablePair[];
  triples?:            AvailableTriple[];
  quads?:              AvailableQuad[];
  hasAvailability:     boolean;
  isLargeGroup?:       boolean;
  blockedByLargeGroup?: boolean;
  reason?:             string | null;
}
