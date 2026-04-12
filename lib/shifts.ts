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

export function getShiftWindow(date: Date): { start: Date; end: Date; name: string } {
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();
    const h = date.getHours();
    const dow = date.getDay(); // 0=Dom, 5=Vie, 6=Sáb

    // Hora de cierre según día
    const closeHour = dow === 0 ? 21 : (dow === 5 || dow === 6) ? 24 : 23;

    if (h < 14) {
        return {
            name:  "brunch",
            start: new Date(y, m, d, 8,  0, 0),
            end:   new Date(y, m, d, 14, 0, 0),
        };
    }
    return {
        name:  "cena",
        start: new Date(y, m, d, 14, 0, 0),
        end:   closeHour === 24
            ? new Date(y, m, d + 1, 0, 0, 0)
            : new Date(y, m, d, closeHour, 0, 0),
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
