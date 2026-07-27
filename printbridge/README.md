# PrintBridge San Luca

Puente de impresión que corre **en la PC de caja** (Windows). Jala los tickets
que el sistema marca como `PENDING` y los imprime en las 3 impresoras térmicas
ESC/POS de la red local (cocina / barra / caja) por TCP puerto **9100**.

No tiene dependencias externas. Requiere **Node.js 18 o superior**.

---

## Por qué existe

La app corre en el **VPS** (fuera del restaurante) y no puede alcanzar las
impresoras, que están en la **red local**. Este puente sí está en la LAN con las
impresoras, así que hace de intermediario: pregunta al VPS "¿hay tickets?" y los
manda a la impresora que toca.

---

## Setup (una sola vez)

1. **Instala Node.js 18+** en la PC de caja (https://nodejs.org, versión LTS).
2. Copia esta carpeta `printbridge/` a la PC de caja (ej. `C:\sanluca-printbridge`).
3. Duplica `config.example.json` → **`config.json`** y llénalo:
   - `apiBaseUrl`: ya viene con el dominio.
   - `bridgeKey`: el **mismo** valor que `PRINT_BRIDGE_KEY` del `.env` del VPS.
   - `printers`: cada destino (CAJA/BARRA/COCINA) es una impresora
     `{ "type": "tcp", "ip": ... }` o `{ "type": "share", "share": "NOMBRE" }`
     (USB compartida de Windows). Un destino puede ser una LISTA para duplicar
     el ticket en varias impresoras (ej. cocina multi-estación).
   - `width`: **48** para papel de 80 mm, **32** para 58 mm.
4. Abre una terminal en la carpeta y corre:
   ```
   node index.js
   ```
   Debe decir "Esperando tickets...". Déjalo abierto durante el servicio.

### Que las impresoras tengan IP fija

Cada impresora térmica de red trae su IP. Consíguela con su **auto-test**
(apagar, mantener FEED y encender → imprime su config con la IP). Reserva esa IP
en el router (DHCP reservation) para que no cambie.

### Probar UNA impresora sin el sistema (PowerShell)

```powershell
$ip = "192.168.1.51"
$c = New-Object System.Net.Sockets.TcpClient($ip, 9100)
$s = $c.GetStream(); $esc=[char]27; $gs=[char]29
$t = "$esc@SAN LUCA`n`nPRUEBA`n$(Get-Date)`n`n`n$gs`V0"
$b = [System.Text.Encoding]::GetEncoding(437).GetBytes($t)
$s.Write($b,0,$b.Length); $s.Flush(); $s.Close(); $c.Close(); "enviado a $ip"
```
Si sale papel, la impresora + red + puerto 9100 están bien.

---

## La instalación real de San Luca (5 impresoras)

| Destino del sistema | Impresora(s) física(s) | Transporte |
|---|---|---|
| BARRA (bebidas) | `192.168.0.11` | `tcp` |
| COCINA (platillos) | **Las 3**: HORNO `.12` + FRÍA `.13` + CALIENTE `.14` — cada una recibe copia del ticket | `tcp` (lista) |

> **CAJA — modo PRUEBA:** en el config, `CAJA` apunta temporalmente a la IP de
> HORNO (`192.168.0.12`) para poder probar el flujo completo (incluido el ticket
> de cuenta). La impresora física de caja (Epson TM-T20II, USB) es la de
> **NationalSoft** y NO se toca. Cuando se decida el destino real de la cuenta:
> o se deja en NationalSoft (borrar `CAJA` del config) o se le crea una cola raw
> aparte para no tocar el driver Epson.

Decisión operativa: **sin división por estación** — todo platillo de cocina se
imprime en las tres impresoras de cocina y cada estación toma lo suyo. Bebidas
solo a barra. (El config de arriba ya viene así.)

### Impresora USB (CAJA): compartirla en Windows

1. Panel de control → Dispositivos e impresoras → clic derecho en la impresora
   de CAJA → **Propiedades de impresora** → pestaña **Compartir**.
2. Marca **Compartir esta impresora** con nombre de recurso: `CAJA` (idéntico al
   `share` del `config.json`).
3. Prueba rápida en PowerShell (debe salir papel):
   ```powershell
   "PRUEBA SAN LUCA" | Out-File -Encoding ascii $env:TEMP\t.prn
   cmd /c copy /b $env:TEMP\t.prn \\localhost\CAJA
   ```
   Si no imprime o sale basura, cambia el driver de esa impresora a
   **"Generic / Text Only"** (Propiedades de impresora → Opciones avanzadas).
4. **Alternativa más limpia**: si la impresora de caja tiene puerto Ethernet
   atrás, conéctala a la red, dale IP fija y usa `"type": "tcp"` como las demás.

## Que arranque solo al prender la PC (opcional, recomendado)

Crea un acceso directo a un `.bat` con:
```
cd /d C:\sanluca-printbridge
node index.js
```
y ponlo en la carpeta de Inicio de Windows
(`Win+R` → `shell:startup`). Para algo más robusto, usa
[NSSM](https://nssm.cc/) y registra `node index.js` como servicio de Windows.

---

## Cómo funciona (para depurar)

- Cada 3 s pregunta a `GET /api/print-jobs/pending` (con el header `x-print-key`).
- Por cada ticket: arma el ESC/POS desde su `payload`, lo manda a la IP del
  `target` (COCINA/BARRA/CAJA), y confirma con `POST /api/print-jobs/:id/ack`.
- Si un ticket falla 2 intentos, queda `FAILED` con el error en la base de datos
  (visible para reimpresión). El puente sigue con el resto.
- Los acentos se quitan (ASCII) para que impriman limpio en cualquier codepage.

Si algo no imprime: revisa la terminal del puente (dice `IMPRESO` o `FALLO` con la
causa), y confirma con la prueba de PowerShell de arriba que la IP responde.
