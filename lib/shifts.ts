// Horario del restaurante:
// Lunes:            Cerrado
// Mar–Jue:          08:00 – 23:00
// Vie–Sáb:          08:00 – 00:00 (medianoche)
// Domingo:          08:00 – 21:00
//
// Turnos (para conflicto de mesas):
// Brunch: 08:00 – 14:00
// Cena:   14:00 – cierre del día
// Cada mesa puede reservarse UNA vez por turno.

const MX_TZ = "America/Mexico_City";

export function getShiftWindow(date: Date): { start: Date; end: Date; name: string } {
    // Usar hora México (UTC-6 fijo), no hora del servidor VPS
    const mxDate = date.toLocaleDateString("en-CA", { timeZone: MX_TZ }); // "YYYY-MM-DD"
    const mxHour = parseInt(
        date.toLocaleString("en-US", { timeZone: MX_TZ, hour: "2-digit", hour12: false })
    );
    const dow = new Date(`${mxDate}T12:00:00.000-06:00`).getDay(); // 0=Dom, 5=Vie, 6=Sáb

    const closeHour = dow === 0 ? 21 : (dow === 5 || dow === 6) ? 24 : 23;

    if (mxHour < 14) {
        return {
            name:  "brunch",
            start: new Date(`${mxDate}T08:00:00.000-06:00`),
            end:   new Date(`${mxDate}T14:00:00.000-06:00`),
        };
    }

    const nextDayDate = new Date(`${mxDate}T12:00:00.000-06:00`);
    nextDayDate.setDate(nextDayDate.getDate() + 1);
    const nextDay = nextDayDate.toLocaleDateString("en-CA", { timeZone: MX_TZ });

    return {
        name:  "cena",
        start: new Date(`${mxDate}T14:00:00.000-06:00`),
        end:   closeHour === 24
            ? new Date(`${nextDay}T00:00:00.000-06:00`)
            : new Date(`${mxDate}T${String(closeHour).padStart(2, "0")}:00:00.000-06:00`),
    };
}

// Verifica si un día de la semana está abierto (0=Dom … 6=Sáb)
export function isDayOpen(dow: number): boolean {
    return dow !== 1; // Lunes cerrado
}

// Slots de horario disponibles para un día dado
export function getTimeSlots(dow: number): string[] {
    if (!isDayOpen(dow)) return [];
    const slots: string[] = [];
    const pad = (n: number) => String(n).padStart(2, "0");
    const closeHour = dow === 0 ? 21 : (dow === 5 || dow === 6) ? 24 : 23;
    const endHour = closeHour === 24 ? 24 : closeHour;
    for (let h = 8; h < endHour; h++) {
        slots.push(`${pad(h)}:00`);
        slots.push(`${pad(h)}:30`);
    }
    if (closeHour < 24) slots.push(`${pad(closeHour)}:00`);
    return slots;
}
