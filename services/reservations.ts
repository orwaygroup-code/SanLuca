// ============================================
// Reservation Service
// ============================================
// Placeholder for external reservation system
// integration (OpenTable, Resy, custom API, etc.)
//
// When implementing:
// 1. Add API credentials to .env
// 2. Implement the ReservationProvider interface
// 3. Register in services/index.ts
// ============================================

export interface ReservationRequest {
  name: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  locationId: string;
  notes?: string;
}

export interface ReservationResponse {
  id: string;
  status: "confirmed" | "pending" | "failed";
  confirmationCode?: string;
}

export interface ReservationProvider {
  createReservation(req: ReservationRequest): Promise<ReservationResponse>;
  cancelReservation(id: string): Promise<boolean>;
  getAvailability(locationId: string, date: string): Promise<string[]>;
}

// ── Stub implementation ──────────────────────
export class StubReservationProvider implements ReservationProvider {
  async createReservation(
    req: ReservationRequest
  ): Promise<ReservationResponse> {
    console.log("[StubReservation] Would create reservation:", req);
    return {
      id: `res_${Date.now()}`,
      status: "pending",
    };
  }

  async cancelReservation(id: string): Promise<boolean> {
    console.log("[StubReservation] Would cancel:", id);
    return true;
  }

  async getAvailability(_locationId: string, _date: string): Promise<string[]> {
    return [
      "12:00",
      "12:30",
      "13:00",
      "13:30",
      "14:00",
      "19:00",
      "19:30",
      "20:00",
      "20:30",
      "21:00",
    ];
  }
}

export const reservationService: ReservationProvider =
  new StubReservationProvider();
