// Turnos del restaurante:
// Brunch: 08:00 – 14:00
// Cena:   14:00 – 00:00 (medianoche)
// Cada mesa puede reservarse UNA vez por turno.

export function getShiftWindow(date: Date): { start: Date; end: Date; name: string } {
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();
    const h = date.getHours();
    if (h < 14) {
        return {
            name:  "brunch",
            start: new Date(y, m, d, 8,  0, 0),
            end:   new Date(y, m, d, 14, 0, 0),
        };
    }
    return {
        name:  "cena",
        start: new Date(y, m, d,     14, 0, 0),
        end:   new Date(y, m, d + 1, 0,  0, 0),
    };
}
