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

export interface TableSelection {
  tableId:           string;
  tableNumber:       number;
  linkedTableId?:    string;
  linkedTableNumber?: number;
}

export interface AvailabilityData {
  sectionName:     string;
  tables:          AvailableTable[];
  pairs:           AvailablePair[];
  hasAvailability: boolean;
}
