# PrintBridge — Instalación en la PC de caja (paso a paso)

Objetivo: que la impresora de tickets funcione y que el programa **arranque solo**
cada vez que se prenda la computadora, sin que nadie tenga que hacer nada.

Sigue los pasos EN ORDEN. Al final hay una sección de problemas comunes.

---

## Paso 0 — Instalar Node.js (si no lo tiene)

PrintBridge necesita Node.js (versión 18 o más nueva).

1. Abre el navegador y ve a **https://nodejs.org**
2. Descarga el botón grande que dice **LTS** (el recomendado).
3. Ejecuta el instalador. Dale **Next / Siguiente** a todo y **Install**. No cambies nada.
4. Para comprobar que quedó: presiona **Win + R**, escribe `cmd`, Enter. En la ventana negra escribe:
   ```
   node -v
   ```
   Debe aparecer algo como `v20.11.0`. Si sale un número, listo. Si dice "no se reconoce", reinicia la PC y vuelve a probar.

---

## Paso 1 — Copiar la carpeta

1. Descomprime el `printbridge-caja.zip`.
2. Copia la carpeta **`printbridge`** a la raíz del disco C, de modo que quede en:
   ```
   C:\printbridge
   ```
   (Debe verse dentro: `index.js`, `config.example.json`, `start-printbridge.bat`, `run-hidden.vbs`, etc.)

---

## Paso 2 — Compartir la impresora de caja en Windows

La impresora de caja se maneja como impresora **compartida** de Windows. Hay que
compartirla con el nombre exacto **`CAJA`**.

1. Presiona **Win + R**, escribe `control printers`, Enter. Se abre *Dispositivos e impresoras*.
2. Clic **derecho** sobre la impresora de tickets → **Propiedades de impresora**
   (NO "Propiedades" a secas — busca la que dice "de impresora").
3. Pestaña **Compartir**.
4. Marca **"Compartir esta impresora"**.
5. En **"Nombre del recurso compartido"** escribe exactamente: `CAJA`
6. **Aceptar**.

> El nombre `CAJA` debe ser idéntico al del archivo de configuración (Paso 3). Si lo
> pones distinto, no imprime.

---

## Paso 3 — Crear el archivo de configuración

1. Entra a `C:\printbridge`.
2. Copia el archivo **`config.example.json`** y pega la copia en la misma carpeta.
3. Renombra la copia a **`config.json`** (sin el `.example`).
4. Ábrelo con el **Bloc de notas** (clic derecho → Abrir con → Bloc de notas) y ajusta:
   - `"apiBaseUrl"`: déjalo en `"https://sanlucaristorante.com"`.
   - `"bridgeKey"`: pon **el mismo valor** que tiene `PRINT_BRIDGE_KEY` en el servidor (VPS).
     (Pídelo a quien administra el servidor; es una clave secreta, no la inventes.)
   - En `"printers"`, la línea de **CAJA** debe quedar:
     ```json
     "CAJA": { "type": "share", "share": "CAJA", "width": 48 }
     ```
     - `width`: **48** si el ticket es de 80mm; cámbialo a **32** si es de 58mm.
   - Las líneas de **BARRA** y **COCINA** llevan las IP reales de esas impresoras de red.
     Si por ahora solo vas a probar CAJA, puedes borrar esas dos líneas (deja solo CAJA).
5. Guarda (Archivo → Guardar). Asegúrate de que el nombre quedó **`config.json`** y no
   `config.json.txt` (en el Bloc de notas, al guardar, elige "Tipo: Todos los archivos").

---

## Paso 4 — Probar a mano (antes de automatizar)

1. En `C:\printbridge`, doble clic a **`start-printbridge.bat`**.
2. Se abre una ventana negra con texto. Debe aparecer una línea parecida a:
   ```
   Impresoras: CAJA=USB \\localhost\CAJA (48col) ...
   ```
   y quedarse esperando (revisando trabajos cada 3 segundos).
3. Desde el sistema, manda a imprimir un ticket de prueba (ej. cobra una cuenta de prueba).
   Debe salir el papel.
4. Si imprime bien, **cierra la ventana** (por ahora) y sigue al Paso 5.

> Si la ventana **parpadea y se cierra sola**, casi siempre es que Node no está en el
> PATH. Ve a "Problemas comunes" al final.

---

## Paso 5 — Que la PC entre sola a Windows (inicio de sesión automático)

Para que al prender la compu entre directo al escritorio (sin pedir contraseña), porque
la impresora compartida solo funciona con la sesión del usuario abierta.

1. Presiona **Win + R**, escribe `netplwiz`, Enter.
2. Selecciona el usuario de la caja en la lista.
3. **Desmarca** la casilla **"Los usuarios deben escribir su nombre y contraseña para usar el equipo"**.
4. **Aplicar**. Te pedirá la contraseña de ese usuario **dos veces**. Escríbela y Aceptar.

> **¿No aparece la casilla?** En algunas versiones de Windows 11 está oculta. Para
> mostrarla: Win + R → `regedit` → ve a
> `HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\PasswordLess\Device`
> → doble clic en `DevicePasswordLessBuildVersion` → cámbialo a `0` → Aceptar. Cierra
> regedit y vuelve a abrir `netplwiz`; ya debe aparecer la casilla.

---

## Paso 6 — Que el programa arranque solo al iniciar

1. Presiona **Win + R**, escribe `shell:startup`, Enter. Se abre la carpeta **Inicio**.
2. En otra ventana, ve a `C:\printbridge`, clic **derecho** sobre **`run-hidden.vbs`**
   → **Mostrar más opciones** (en Win 11) → **Crear acceso directo**.
3. Se crea un "run-hidden.vbs - Acceso directo". **Córtalo** (Ctrl+X) y **pégalo**
   (Ctrl+V) dentro de la carpeta **Inicio** que abriste en el punto 1.

> Importante: pon un **acceso directo**, NO copies el `.vbs` a la carpeta Inicio. El
> script busca el `.bat` en su propia carpeta (`C:\printbridge`), así que el archivo real
> debe quedarse ahí.

---

## Paso 7 — Reiniciar y confirmar

1. Reinicia la computadora.
2. Sin tocar nada, espera ~30 segundos. El programa ya está corriendo **oculto** (sin
   ventana visible).
3. Manda un ticket de prueba. Debe imprimir.
4. Para confirmar que está vivo: **Ctrl + Shift + Esc** (Administrador de tareas) →
   pestaña *Detalles* o *Procesos* → busca **`node.exe`**. Si está, funciona.

¡Listo! Desde ahora, cada vez que se prenda la PC, la impresora de caja queda operando sola.

---

## Cómo apagarlo o reiniciarlo a mano

- **Apagarlo:** Administrador de tareas (Ctrl+Shift+Esc) → busca `node.exe` → clic derecho
  → Finalizar tarea. (Si lo mató a mano, no se reinicia solo hasta el próximo arranque de
  la PC o hasta volver a lanzar el `.bat`/`.vbs`.)
- **Reiniciarlo sin apagar la PC:** doble clic a `C:\printbridge\run-hidden.vbs`.
- **Ver el log (para diagnosticar):** cierra el node oculto y corre `start-printbridge.bat`
  a mano; ahí ves los mensajes en la ventana.

---

## Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| La ventana negra parpadea y se cierra | Node no está en el PATH | Abre `start-printbridge.bat` con Bloc de notas y cambia `node index.js` por `"C:\Program Files\nodejs\node.exe" index.js` |
| Dice `impresora share sin nombre` o `copy … fallo` | La impresora no está compartida como `CAJA`, o el nombre no coincide | Repite el Paso 2; el recurso compartido debe llamarse exactamente `CAJA` |
| No imprime pero no hay error | `bridgeKey` incorrecta o el ticket no está llegando | Verifica que `bridgeKey` sea igual a la del servidor; revisa el log corriendo el `.bat` a mano |
| Imprime cortado / caracteres raros | Ancho equivocado | Cambia `"width"` a `32` (58mm) o `48` (80mm) según tu impresora |
| Al prender, no arranca solo | Falta el auto-login (Paso 5) o el acceso directo en Inicio (Paso 6) | Revisa que la PC entre sola al escritorio y que el acceso directo esté en `shell:startup` |
| Se cae y no vuelve | (No debería: el `.bat` lo reinicia cada 5s) | Corre el `.bat` a mano y observa el error en el log |
