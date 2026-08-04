// Convierte un monto a letras en español para el ticket:
//   157.5 -> "CIENTO CINCUENTA Y SIETE PESOS 50/100 M.N."
// Cubre hasta millones (suficiente para totales de restaurante).

const UNIDADES = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
const DIECI = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
const DECENAS = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function seccion(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  let out = "";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c) out += CENTENAS[c] + " ";
  const d = Math.floor(resto / 10);
  const u = resto % 10;
  if (resto >= 10 && resto <= 19) out += DIECI[resto - 10];
  else if (resto >= 20 && resto <= 29) out += resto === 20 ? "VEINTE" : "VEINTI" + UNIDADES[u];
  else {
    if (d) out += DECENAS[d];
    if (d && u) out += " Y ";
    if (u) out += UNIDADES[u];
  }
  return out.trim();
}

export function numeroALetras(monto: number): string {
  const abs = Math.abs(Number(monto) || 0);
  const entero = Math.floor(abs);
  const centavos = Math.round((abs - entero) * 100);
  let palabras: string;
  if (entero === 0) palabras = "CERO";
  else {
    const millones = Math.floor(entero / 1_000_000);
    const miles = Math.floor((entero % 1_000_000) / 1000);
    const resto = entero % 1000;
    const parts: string[] = [];
    if (millones) parts.push(millones === 1 ? "UN MILLON" : seccion(millones) + " MILLONES");
    if (miles) parts.push(miles === 1 ? "MIL" : seccion(miles) + " MIL");
    if (resto) parts.push(seccion(resto));
    palabras = parts.join(" ").trim();
  }
  palabras = palabras.replace(/UNO$/, "UN"); // "un peso", "veintiun pesos", "treinta y un pesos"
  const pesos = entero === 1 ? "PESO" : "PESOS";
  return `${palabras} ${pesos} ${String(centavos).padStart(2, "0")}/100 M.N.`;
}
