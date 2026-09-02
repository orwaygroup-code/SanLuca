"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import {
  C, StaffHeader, Spinner, EmptyState, Badge, ConfirmModal, ReasonModal, Modal, fld,
  TicketPreview, btn, formatMXN, STATUS_LABEL, STATUS_COLOR, useToasts, ToastHost, useStaffLogout, usePoll,
} from "@/components/staff/ui";
import { apiFetch, isBillPrinted, type Comanda, type CItem, type PayResult, type CashSession, type CutSnapshot } from "@/components/staff/types";
import { SplitAccountModal } from "@/components/staff/SplitAccountModal";
import { PayModal, DiscountModal, MergeModal, TransferItemModal, ReopenModal } from "@/components/staff/caja";
import { Icon } from "@/components/staff/icons";
import { MenuSelector } from "@/components/staff/MenuSelector";
import { Tour, type TourStep } from "@/components/staff/Tour";
import { buildTotalLines } from "@/lib/displayTotals";


const AWAIT = STATUS_COLOR.AWAITING_PAYMENT; // var(--sl-gold-soft) — tinte "requiere caja"

const ITEM_STATUS_LABEL: Record<string, string> = {
  PENDING: "Por enviar", SENT: "En cocina", READY: "Listo", SERVED: "Servido", CANCELLED: "Cancelado",
};
const ITEM_STATUS_COLOR: Record<string, string> = {
  PENDING: C.amber, SENT: C.blue, READY: C.green, SERVED: C.dim, CANCELLED: C.red,
};

/** Formatea cantidad decimal para mostrar: 0.5, 1.5, 2 (sin ruido de float). */
const fmtQty = (q: number) => String(Math.round(q * 100) / 100);

/** Etiqueta de "tiempo" (curso): 1 → "1er tiempo", 2 → "2do tiempo"… */
const COURSE_ORD = ["", "1er", "2do", "3er", "4to", "5to", "6to", "7mo", "8vo", "9no", "10mo"];
const courseLabel = (n: number) => n === 0 ? "Sin tiempo" : `${COURSE_ORD[n] ?? `${n}º`} tiempo`;

/** Tutorial guiado (estilo videojuego) de lo nuevo del comandero. */
const COMANDERO_TOUR: TourStep[] = [
  { title: "Bienvenido al comandero", body: "En un minuto te muestro lo nuevo para levantar pedidos rápido y sin errores." },
  { target: "add", title: "El menú, a pantalla completa", body: "Eliges platillos navegando Comida/Brunch → Alimentos/Bebidas → sección → platillo, con fotos. Puedes pedir medias órdenes (½, 0.3, 1.5…) y dejar un comentario a cocina.", task: "Ábrelo tocando «+ Agregar platillos» y regresa aquí." },
  { target: "course", title: "Tiempos del servicio", body: "Marca los tiempos (1er, 2do, 3er…). Lo que agregues después cae en ese tiempo y sale SEPARADO en el ticket de cocina.", task: "Toca «＋ Nuevo tiempo» para abrir el 2do tiempo." },
  { target: "items", title: "Tu comanda en vivo", body: "Aquí ves lo que llevas, agrupado por tiempo. Toca la × de un platillo para quitarlo antes de enviarlo." },
  { target: "send", title: "Enviar a cocina", body: "Manda lo pendiente a cocina y barra e imprime los tickets. Hasta que envíes, todo es un borrador editable." },
  { target: "clear", title: "¿Te equivocaste?", body: "«Vaciar» borra de un golpe todo lo que aún NO enviaste. Lo ya enviado no se toca." },
  { target: "caja", title: "Cobrar y más (Caja)", body: "Si eres Caja/Operación: aquí cobras (efectivo, tarjeta, mixto), aplicas descuentos con PIN, juntas o traspasas cuentas y reabres. El turno y el corte viven en la vista de Operación." },
  { title: "¡Listo para el servicio!", body: "Eso es todo lo nuevo. Puedes reabrir este tutorial cuando quieras con el botón «?» del encabezado." },
];

export function ComandaDetailView({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { staff, loading } = useStaffSession();
  const logout = useStaffLogout();
  const { toasts, push, dismiss } = useToasts();

  const [comanda, setComanda] = useState<Comanda | null>(null);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  // Comentario append-only por producto: itemId con el input abierto + borrador.
  const [commentFor, setCommentFor] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [editCm, setEditCm] = useState<number | null>(null); // comentario en edición
  const [editDraft, setEditDraft] = useState("");

  const [menuOpen, setMenuOpen] = useState(false);
  const [cancelItem, setCancelItem] = useState<CItem | null>(null);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [closeZeroAsk, setCloseZeroAsk] = useState(false);
  const [unlockAsk, setUnlockAsk] = useState(false);
  const [askPrint, setAskPrint] = useState(false);
  const [askBill, setAskBill] = useState(false);
  const [reprint, setReprint] = useState(false);
  const [clearAsk, setClearAsk] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false); // modal "Mensaje a un área"
  const [msgArea, setMsgArea] = useState<"COCINA" | "BARRA" | "CAJA">("COCINA");
  const [msgText, setMsgText] = useState("");
  const [linkPick, setLinkPick] = useState(false); // #4 selector "ligar a empleado" abierto
  const [emps, setEmps] = useState<{ id: number; fullName: string; role: string }[]>([]);
  const [selEmp, setSelEmp] = useState("");
  // #4 Aprobación del empleado con su NIP tecleado AQUÍ, en la terminal.
  const [approvePinMode, setApprovePinMode] = useState(false);
  const [approvePin, setApprovePin] = useState("");
  const [currentCourse, setCurrentCourse] = useState(0); // "tiempo" al que se agregan nuevos platillos (0 = Sin tiempo)
  const [tourOpen, setTourOpen] = useState(false);
  const autoTourDone = useRef(false);

  // ── caja ──
  const [payOpen, setPayOpen] = useState(false);
  const [discountTarget, setDiscountTarget] = useState<{ itemId?: number; itemName?: string } | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  // Reimpresión a cocina (solo manager): modal con selección de productos ya enviados.
  const [reprintOpen, setReprintOpen] = useState(false);
  // PIN del supervisor que autoriza, cuando quien opera no lo es.
  const [reprintPin, setReprintPin] = useState("");
  const [reprintSel, setReprintSel] = useState<Set<number>>(new Set());
  // Multi-selección de productos para acciones en lote (cancelar / mover / descuento).
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [selMode, setSelMode] = useState(false); // modo selección: los checkboxes solo salen al activarlo
  const [batchCancelOpen, setBatchCancelOpen] = useState(false);
  const [batchDiscount, setBatchDiscount] = useState(false);
  const [batchMove, setBatchMove] = useState(false);

  // División de cuenta: cada entrada (División 1..N) es un Map itemId → unidades
  // asignadas a esa división. Permite repartir fracciones de un mismo platillo.
  // Partir la cuenta en una cuenta hija (14 → 14-1).
  const [splitAcctOpen, setSplitAcctOpen] = useState(false);

  const isSupervisor = staff?.role === "CAPTAIN" || staff?.role === "MANAGER";
  const isManager = staff?.role === "MANAGER"; // "administrador": único que reabre cuentas selladas

  // back del detalle respeta el realm del staff: OPERATION vuelve a su mapa,
  // CAPTAIN a su panel; WAITER (y default) a la lista de comandas.
  // Volver: usa ?back= (lo pone quien abre el detalle) para regresar EXACTO a esa vista
  // — piso de manager, /admin/piso (con su menú lateral), lista de mesero u operación.
  // Determinístico, sin depender de history.back(). Fallback: embebido → /admin/piso;
  // si no, el home del rol.
  const backHref = useMemo(() => {
    if (typeof window !== "undefined") {
      const b = new URLSearchParams(window.location.search).get("back");
      // Ruta interna (empieza en /staff/ o /admin/); puede llevar query con el estado
      // (ej. ?view=map&area=Salón) para regresar exactamente a donde estabas.
      if (b && /^\/(staff|admin)\//.test(b)) return b;
    }
    if (embedded) return "/admin/piso";
    return staff?.role === "OPERATION" ? "/staff/operacion"
      : staff?.role === "CAPTAIN" ? "/staff/capitan"
      : "/staff/comandas";
  }, [embedded, staff?.role]);
  const goBack = useCallback(() => router.push(backHref), [router, backHref]);

  const refresh = useCallback(async () => {
    const r = await apiFetch<Comanda>(`/api/comandas/${id}`);
    if (r.ok) setComanda(r.data!);
    else if (r.status === 404 || r.status === 403) setNotFound(true);
    else push(r.error ?? "No se pudo cargar", "error");
  }, [id, push]);

  useEffect(() => {
    if (!loading && !staff) { router.replace(`/staff/login?next=/staff/comandas/${id}`); return; }
    if (staff) {
      refresh();
      apiFetch<{ taxEnabled: boolean }>("/api/admin/settings").then((r) => { if (r.ok) setTaxEnabled(r.data!.taxEnabled); });
      if (staff.role !== "WAITER") {
        apiFetch<{ session: CashSession | null; cut: CutSnapshot | null }>("/api/caja/sessions/current")
          .then((r) => { if (r.ok) setHasSession(!!r.data!.session); });
      }
    }
  }, [loading, staff, id, router, refresh]);

  // Refresco en vivo del detalle; pausado mientras el selector de platillos está
  // abierto para no interrumpir la captura.
  usePoll(refresh, 9000, !!comanda && !menuOpen);

  const liveItems = useMemo(() => (comanda?.items ?? []).filter((i) => i.status !== "CANCELLED"), [comanda]);
  const pendingCount = useMemo(() => liveItems.filter((i) => i.status === "PENDING").length, [liveItems]);
  // "Impreso" = ticket de cliente vigente (emitido DESPUÉS de la última reapertura). Al
  // reabrir la cuenta el candado se reinicia: se puede modificar y volver a imprimir. Ver
  // isBillPrinted (fuente única, compartida con la lista de operación).
  const alreadyPrinted = useMemo(() => (comanda ? isBillPrinted(comanda) : false), [comanda]);
  const editable = comanda?.status === "OPEN" || comanda?.status === "IN_SERVICE";
  // Se puede MODIFICAR solo si está editable Y aún NO se imprimió la cuenta. Al imprimir (aunque
  // siga IN_SERVICE), se cierra todo lo editable — solo queda Cobrar (regla de Paul).
  const canModify = editable && !alreadyPrinted;

  // ── división de cuenta (derivados) ──
  const itemById = useMemo(() => new Map(liveItems.map((i) => [i.id, i])), [liveItems]);
  const totalLiveUnits = useMemo(() => liveItems.reduce((s, i) => s + Number(i.quantity), 0), [liveItems]);

  // "Tiempo actual" se mantiene al día con el máximo existente (nunca lo baja).
  useEffect(() => {
    const mc = liveItems.reduce((m, i) => Math.max(m, i.course || 1), 1);
    setCurrentCourse((prev) => Math.max(prev, mc));
  }, [liveItems]);

  // Auto-abrir el tutorial la primera vez que se carga una comanda (una vez por dispositivo).
  useEffect(() => {
    if (!embedded && !autoTourDone.current && comanda && typeof window !== "undefined" && !localStorage.getItem("sl_tour_comandero_v1")) {
      autoTourDone.current = true;
      setTourOpen(true);
    }
  }, [comanda]);

  const closeTour = () => { setTourOpen(false); try { localStorage.setItem("sl_tour_comandero_v1", "1"); } catch { /* ignore */ } };

  // Se puede dividir mientras no haya un ticket vigente. Antes exigía además que
  // no hubiera cantidades fraccionadas, restricción heredada de la división de
  // TICKET —que repartía unidad por unidad y no sabía partir media porción— y que
  // se quedó cuando aquella se eliminó. La división de CUENTA sí las admite: mueve
  // el renglón fraccionado completo. Con la regla vieja, una mesa con media
  // botella o medio postre no se podía dividir, que es la mayoría de las mesas.
  const splittable = !alreadyPrinted;

  // Partir la cuenta de verdad: crea una cuenta hija con lo seleccionado y deja
  // el resto aquí. La hija queda "en servicio" y se comporta como cualquier otra.
  const doSplitAccount = async (units: Map<number, number>, pin: string) => {
    setBusy(true);
    const r = await apiFetch<{ parent: Comanda; child: Comanda }>(`/api/comandas/${id}/split-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        units: [...units].map(([itemId, quantity]) => ({ itemId, quantity })),
        authPin: pin,
      }),
    });
    setBusy(false);
    if (!r.ok) { push(r.error ?? "No se pudo dividir la cuenta", "error"); return; }
    setSplitAcctOpen(false);
    if (r.data?.parent) setComanda(r.data.parent);
    const label = r.data?.child?.splitLabel ?? "nueva";
    push(`Cuenta dividida · se creó ${label}`, "success");
  };

  // ── acciones ──
  const post = useCallback(async (path: string, body?: unknown, okMsg?: string) => {
    setBusy(true);
    const r = await apiFetch<Comanda>(path, {
      method: body === undefined ? "POST" : "POST",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (r.ok) { setComanda(r.data!); if (okMsg) push(okMsg, "success"); return true; }
    push(r.error ?? "Error", "error");
    return false;
  }, [push]);

  const sendToKitchen = () => post(`/api/comandas/${id}/send-to-kitchen`, undefined, "Enviado a cocina/barra");
  const doPrint = (authorizationReason?: string, authPin?: string) => {
    const body: Record<string, unknown> = {};
    if (authorizationReason) body.authorizationReason = authorizationReason;
    // Sólo va cuando quien opera no es supervisor: el servidor lo valida contra
    // los PINs de Capitán y Manager del tenant.
    if (authPin) body.authPin = authPin;
    return post(`/api/comandas/${id}/print`, body, "Ticket impreso");
  };
  // Mesero imprime el ticket y BLOQUEA la comanda: imprime el ticket del cliente y la
  // pasa a «Por cobrar» (AWAITING_PAYMENT) → ni mesero ni caja agregan/modifican.
  const printAndLock = async () => {
    setAskBill(false);
    // /print ya pasa la comanda a AWAITING_PAYMENT de forma atómica (fuente única de
    // verdad); ya no hace falta el 2.º paso a /send-to-cashier —que además fallaba por
    // asimetría de realm desde ADMIN y dejaba la comanda impresa pero en IN_SERVICE.
    await doPrint();
  };

  const confirmCancelItem = async (reason?: string, pin?: string) => {
    if (!cancelItem) return;
    setBusy(true);
    const r = await apiFetch<Comanda>(`/api/comandas/${id}/items/${cancelItem.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(reason ? { reason } : {}), ...(pin ? { authPin: pin } : {}) }),
    });
    setBusy(false);
    setCancelItem(null);
    if (r.ok) { setComanda(r.data!); push("Item cancelado", "success"); }
    else push(r.error ?? "No se pudo cancelar", "error");
  };

  // Quitar un platillo AÚN sin enviar (PENDING) desde el panel del selector, sin confirmación.
  const removePendingItem = async (itemId: number) => {
    setBusy(true);
    const r = await apiFetch<Comanda>(`/api/comandas/${id}/items/${itemId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
    setBusy(false);
    if (r.ok) setComanda(r.data!);
    else push(r.error ?? "No se pudo quitar", "error");
  };

  // Agrega un comentario (append-only) a un producto. El endpoint devuelve la comanda
  // actualizada; no se puede editar ni borrar un comentario existente, solo agregar más.
  const submitComment = async (itemId: number) => {
    const t = commentDraft.trim();
    if (!t) return;
    const ok = await post(`/api/comandas/${id}/items/${itemId}/comment`, { text: t }, "Comentario agregado");
    if (ok) { setCommentDraft(""); setCommentFor(null); }
  };

  // Editar un comentario existente (solo su autor o supervisor) — para no acumular listas largas.
  const saveEditComment = async (itemId: number, commentId: number) => {
    const t = editDraft.trim();
    if (!t) return;
    setBusy(true);
    const r = await apiFetch<Comanda>(`/api/comandas/${id}/items/${itemId}/comment`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commentId, text: t }),
    });
    setBusy(false);
    if (r.ok) { setComanda(r.data!); setEditCm(null); setEditDraft(""); push("Comentario editado", "success"); }
    else push(r.error ?? "No se pudo editar", "error");
  };

  // Reimprimir a cocina los productos seleccionados (manager). Crea tickets de REIMPRESIÓN.
  const toggleReprint = (itemId: number) => setReprintSel((s) => { const n = new Set(s); if (n.has(itemId)) n.delete(itemId); else n.add(itemId); return n; });
  const doReprint = async () => {
    if (reprintSel.size === 0) return;
    const ok = await post(
      `/api/comandas/${id}/reprint-kitchen`,
      { itemIds: [...reprintSel], ...(reprintPin ? { authPin: reprintPin } : {}) },
      "Reimpresión enviada a cocina",
    );
    if (ok) { setReprintOpen(false); setReprintSel(new Set()); setReprintPin(""); }
  };

  // Multi-selección: alternar, limpiar y cancelar en lote (un solo PIN para todo el set).
  const toggleSel = (itemId: number) => setSel((s) => { const n = new Set(s); if (n.has(itemId)) n.delete(itemId); else n.add(itemId); return n; });
  const clearSel = () => { setSel(new Set()); setSelMode(false); };
  const doBatchCancel = async (reason?: string, pin?: string) => {
    if (sel.size === 0) return;
    const ok = await post(`/api/comandas/${id}/items/batch-cancel`, { itemIds: [...sel], ...(reason ? { reason } : {}), ...(pin ? { authPin: pin } : {}) }, "Productos cancelados");
    if (ok) { setBatchCancelOpen(false); clearSel(); }
  };

  // Poda la selección cuando un producto seleccionado deja de existir (cancelado/movido).
  useEffect(() => {
    setSel((prev) => {
      const live = new Set(liveItems.map((i) => i.id));
      let changed = false;
      const n = new Set<number>();
      for (const idv of prev) { if (live.has(idv)) n.add(idv); else changed = true; }
      return changed ? n : prev;
    });
  }, [liveItems]);

  // Reabrir una cuenta "por cobrar" para volver a modificarla (→ IN_SERVICE). PIN supervisor.
  const doUnlock = async (reason?: string, pin?: string) => {
    setBusy(true);
    const r = await apiFetch<Comanda>(`/api/comandas/${id}/unlock`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, authPin: pin }),
    });
    setBusy(false);
    setUnlockAsk(false);
    if (r.ok) { setComanda(r.data!); push("Cuenta reabierta para modificar", "success"); }
    else push(r.error ?? "No se pudo reabrir", "error");
  };

  // Cerrar ("matar") una cuenta en $0 sin cobro, dejando huella. Settlea la comanda.
  const doCloseZero = async () => {
    setBusy(true);
    const r = await apiFetch<{ comanda: Comanda }>(`/api/comandas/${id}/close-zero`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setBusy(false);
    setCloseZeroAsk(false);
    if (r.ok) { setComanda(r.data!.comanda); push("Cuenta cerrada en $0", "success"); }
    else push(r.error ?? "No se pudo cerrar en $0", "error");
  };

  useEffect(() => {
    if (linkPick && emps.length === 0) {
      apiFetch<{ id: number; fullName: string; role: string }[]>("/api/comandas/credit-staff").then((r) => { if (r.ok) setEmps(r.data ?? []); });
    }
  }, [linkPick, emps.length]);

  // Enviar un mensaje libre a la impresora de un área (Cocina/Barra/Caja).
  const doSendMessage = async () => {
    if (!msgText.trim() || busy) return;
    setBusy(true);
    const r = await apiFetch(`/api/print/message`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ area: msgArea, text: msgText.trim() }),
    });
    setBusy(false);
    const label = msgArea === "COCINA" ? "Cocina" : msgArea === "BARRA" ? "Barra" : "Caja";
    if (r.ok) { setMsgOpen(false); setMsgText(""); push(`Mensaje enviado a ${label}`, "success"); }
    else push(r.error ?? "No se pudo enviar el mensaje", "error");
  };

  // #4 Ligar / desligar la cuenta (para llevar) a un empleado. employeeId=null desliga.
  const doLink = async (employeeId: number | null) => {
    setBusy(true);
    const r = await apiFetch<Comanda>(`/api/comandas/${id}/link-employee`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId }),
    });
    setBusy(false);
    if (r.ok) { setComanda(r.data!); setLinkPick(false); setSelEmp(""); push(employeeId ? "Cuenta ligada al empleado" : "Cuenta desligada", "success"); }
    else push(r.error ?? "No se pudo ligar", "error");
  };

  // #4 Aprobar la cuenta ligada con el NIP del empleado, en esta misma terminal.
  // El endpoint siempre soportó las dos vías —su Cartera o la terminal—; aquí
  // faltaba exponer la segunda, y sin ella la cajera dependía de que la persona
  // sacara su teléfono aunque estuviera parada enfrente.
  const doApproveEmployee = async () => {
    setBusy(true);
    const r = await apiFetch<Comanda>(`/api/comandas/${id}/employee-approve`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: approvePin }),
    });
    setBusy(false);
    if (r.ok) {
      setComanda(r.data!); setApprovePinMode(false); setApprovePin("");
      push("Cuenta aprobada por el empleado", "success");
    } else push(r.error ?? "NIP incorrecto", "error");
  };

  // Vaciar borrador: borra TODOS los platillos aún no enviados (status PENDING).
  const clearDraft = async () => {
    setClearAsk(false);
    const pend = liveItems.filter((i) => i.status === "PENDING");
    if (pend.length === 0) return;
    setBusy(true);
    for (const it of pend) {
      await apiFetch(`/api/comandas/${id}/items/${it.id}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
    }
    setBusy(false);
    await refresh();
    push("Borrador vaciado", "success");
  };

  if (loading || (!comanda && !notFound)) return <div style={page.root}><Spinner /></div>;

  if (notFound) {
    return (
      <div style={page.root}>
        {embedded
          ? <EmbedBar title="Comanda" onBack={goBack} />
          : <StaffHeader title="Comanda" role={staff?.role} userName={staff?.fullName} onLogout={logout} onBack={goBack} />}
        <main style={page.main}><EmptyState text="Comanda no encontrada o no es tuya." /></main>
      </div>
    );
  }

  const c = comanda!;
  // Cancelar producto SOLO mientras la cuenta es editable (OPEN/IN_SERVICE). En "por cobrar"
  // la cuenta está bloqueada: para modificar hay que "Reabrir cuenta" primero. El supervisor
  // (Capitán/Manager) quita cualquier producto; el mesero dueño solo los PENDING.
  const canCancel = (it: CItem) => {
    if (!canModify) return false;
    if (isSupervisor) return true;
    return it.status === "PENDING";
  };
  const totalLines = buildTotalLines(c, taxEnabled);
  // El tiempo actual debe tener al menos un platillo antes de abrir otro (evita tiempos vacíos).

  // Caja: OPERATION/CAPTAIN/MANAGER operan la cuenta; WAITER solo captura.
  const isCashier = staff?.role === "OPERATION" || staff?.role === "CAPTAIN" || staff?.role === "MANAGER";
  const cajaActive = ["OPEN", "IN_SERVICE", "AWAITING_PAYMENT", "PARTIALLY_PAID"].includes(c.status);
  const isPaid = c.status === "PAID";
  const awaitingBill = c.status === "AWAITING_PAYMENT"; // cuenta pedida, en espera de impresión/cobro en caja
  const porCobrar = c.status === "AWAITING_PAYMENT" || c.status === "PARTIALLY_PAID"; // bloqueada: solo cobrar / reabrir
  const canComment = (editable || porCobrar) && !alreadyPrinted; // comentar solo antes de imprimir (después ya se imprimió con la comanda)
  const anySentSel = liveItems.some((i) => sel.has(i.id) && i.status !== "PENDING"); // ¿algún seleccionado ya fue a cocina? → pide PIN
  const amountPaid = Number(c.amountPaid);
  const remaining = Math.max(0, Math.round((Number(c.total) - amountPaid) * 100) / 100);

  // ── render de división de cuenta ──


  // Fila completa (vista sin divisiones): status, modificadores y cancelar item.
  const renderItemRow = (it: CItem) => (
    <div key={it.id} style={page.itemRow}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0, flex: 1 }}>
        {canModify && selMode && (
          <input type="checkbox" checked={sel.has(it.id)} onChange={() => toggleSel(it.id)}
            style={{ width: 18, height: 18, marginTop: 3, flexShrink: 0, cursor: "pointer", accentColor: C.gold }} aria-label="Seleccionar producto" />
        )}
        <div style={{ minWidth: 0 }}>
        <div style={{ color: C.cream, fontSize: "0.92rem", fontWeight: 600 }}>
          {fmtQty(Number(it.quantity))}× {it.dishNameSnapshot}
        </div>
        {(it.modifiers || it.kitchenNotes) && (
          <div style={{ color: C.faint, fontSize: "0.74rem", marginTop: 2 }}>
            {[it.modifiers, it.kitchenNotes].filter(Boolean).join(" · ")}
          </div>
        )}
        <div style={{ marginTop: 4 }}>
          <Badge text={ITEM_STATUS_LABEL[it.status] ?? it.status} color={ITEM_STATUS_COLOR[it.status] ?? C.dim} />
        </div>
        {/* Comentarios por producto: se listan; el autor (o un supervisor) puede editar el suyo,
            PERO solo mientras el platillo NO se haya enviado a cocina — al enviarlo, el comentario
            ya se imprimió en el ticket de cocina y queda fijo. */}
        {it.comments && it.comments.length > 0 && (
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
            {it.comments.map((cm) => {
              const canEdit = it.status === "PENDING" && canComment && ((!!staff && cm.createdById === staff.id) || isSupervisor);
              if (editCm === cm.id) {
                return (
                  <div key={cm.id} style={{ display: "flex", gap: 6, alignItems: "center", maxWidth: 440 }}>
                    <input autoFocus value={editDraft} onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEditComment(it.id, cm.id); else if (e.key === "Escape") { setEditCm(null); setEditDraft(""); } }}
                      maxLength={500} style={page.commentInput} />
                    <button style={page.commentSave} disabled={busy || !editDraft.trim()} onClick={() => saveEditComment(it.id, cm.id)}>Guardar</button>
                    <button style={page.commentCancel} title="Cancelar" onClick={() => { setEditCm(null); setEditDraft(""); }}>✕</button>
                  </div>
                );
              }
              return (
                <div key={cm.id} style={{ display: "flex", gap: 6, alignItems: "flex-start", color: C.dim, fontSize: "0.76rem" }}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 3 }}><path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4 20l1.8-5.1A7.5 7.5 0 1 1 20 11.5z" /></svg>
                  <span style={{ minWidth: 0, wordBreak: "break-word", flex: 1 }}>{cm.text}</span>
                  {canEdit && <button style={page.commentEdit} onClick={() => { setEditCm(cm.id); setEditDraft(cm.text); }}>editar</button>}
                </div>
              );
            })}
          </div>
        )}
        {canComment && (commentFor === it.id ? (
          <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center", maxWidth: 440 }}>
            <input
              autoFocus
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitComment(it.id); else if (e.key === "Escape") { setCommentFor(null); setCommentDraft(""); } }}
              placeholder="Escribe el comentario…"
              maxLength={500}
              style={page.commentInput}
            />
            <button style={page.commentSave} disabled={busy || !commentDraft.trim()} onClick={() => submitComment(it.id)}>Agregar</button>
            <button style={page.commentCancel} title="Cancelar" onClick={() => { setCommentFor(null); setCommentDraft(""); }}>✕</button>
          </div>
        ) : (
          <button style={page.commentAdd} onClick={() => { setCommentFor(it.id); setCommentDraft(""); }}>＋ agregar comentario</button>
        ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ textAlign: "right" }}>
          <span style={{ color: C.cream, fontWeight: 700, fontSize: "0.9rem" }}>{formatMXN(Number(it.lineTotal) - Number(it.discountAmount))}</span>
          {Number(it.discountAmount) > 0 && (
            <div style={{ color: C.gold, fontSize: "0.68rem" }}>−{formatMXN(Number(it.discountAmount))} desc.</div>
          )}
        </div>
        {isCashier && canModify && (
          <button style={page.discBtn} title="Descuento a este producto" onClick={() => setDiscountTarget({ itemId: it.id, itemName: it.dishNameSnapshot })}>%</button>
        )}
        {canCancel(it) && (
          <button style={page.cancelX} title="Cancelar item" onClick={() => setCancelItem(it)}>×</button>
        )}
      </div>
    </div>
  );

  // Fila simple por unidad (matriz/divisiones): {qty}× nombre + subtotal por unidad.


  return (
    <div style={page.root}>
      {embedded ? (
        <EmbedBar
          title={c.folio}
          onBack={goBack}
          right={<Badge text={STATUS_LABEL[c.status] ?? c.status} color={STATUS_COLOR[c.status] ?? C.dim} />}
        />
      ) : (
        <StaffHeader
          title={c.folio}
          role={staff?.role}
          userName={staff?.fullName}
          onLogout={logout}
          onBack={goBack}
          right={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                data-tour="help"
                onClick={() => setTourOpen(true)}
                title="Tutorial"
                aria-label="Abrir tutorial"
                style={{ width: 40, height: 40, borderRadius: 999, border: `1px solid ${C.border}`, background: "transparent", color: C.gold, fontWeight: 800, fontSize: "1.05rem", cursor: "pointer" }}
              >?</button>
              <Badge text={STATUS_LABEL[c.status] ?? c.status} color={STATUS_COLOR[c.status] ?? C.dim} />
            </div>
          }
        />
      )}

      <main style={page.main}>
        <div style={page.head}>
          <div>
            <div style={{ color: C.cream, fontSize: "1.2rem", fontWeight: 800 }}>{c.table ? `Mesa ${c.table.number} · ${c.table.section.name}` : (c.customName || "Cuenta sin mesa")}</div>
            <div style={{ color: C.dim, fontSize: "0.84rem", marginTop: 2 }}>{c.guestsActual} comensales · mesero {c.waiter.fullName}</div>
            {c.pickupNote && (
              <div style={{ color: C.gold, fontSize: "0.92rem", fontWeight: 700, marginTop: 4 }}>Recoge: {c.pickupNote}</div>
            )}
          </div>
        </div>

        {/* Items */}
        <section style={page.panel} data-tour="items">
          <div style={page.panelHead}>Platillos</div>
          {liveItems.length === 0 ? (
            <EmptyState text="Sin platillos. Agrega del menú." />
          ) : (
            <div>
              {[...new Set(liveItems.map((i) => i.course))].sort((a, b) => a - b).map((cn, _i, arr) => (
                <div key={cn}>
                  {arr.length > 1 && <div style={page.courseSep}>{courseLabel(cn)}</div>}
                  {liveItems.filter((i) => i.course === cn).map(renderItemRow)}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Barra de acciones en lote (solo en modo selección) */}
        {canModify && selMode && (
          <section style={page.batchBar}>
            <span style={{ color: C.cream, fontWeight: 700, fontSize: "0.86rem" }}>{sel.size} seleccionado(s)</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
              <button style={page.batchBtn} onClick={() => setBatchCancelOpen(true)} disabled={busy || sel.size === 0}>Cancelar</button>
              {isCashier && <button style={page.batchBtn} onClick={() => setBatchMove(true)} disabled={busy || sel.size === 0}>Mover</button>}
              {isCashier && <button style={page.batchBtn} onClick={() => setBatchDiscount(true)} disabled={busy || sel.size === 0}>Descuento</button>}
              <button style={page.batchClear} onClick={clearSel}>Salir</button>
            </div>
          </section>
        )}

        {/* Totales */}
        <section style={{ ...page.panel, padding: "14px 18px" }}>
          {totalLines.map((l) => (
            <div key={l.label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: l.strong ? C.cream : C.dim, fontWeight: l.strong ? 800 : 500, fontSize: l.strong ? "1.1rem" : "0.86rem" }}>
              <span>{l.label}</span><span>{formatMXN(l.amount)}</span>
            </div>
          ))}
        </section>

        {/* Acciones */}
        <section style={page.actions}>
          {canModify && (
            <div data-tour="course" style={{ display: "flex", alignItems: "center", gap: 10, flexBasis: "100%", flexWrap: "wrap", padding: "2px 0 4px" }}>
              <span style={{ color: C.dim, fontSize: "0.85rem", fontWeight: 800 }}>Tiempo</span>
              <button style={courseStepBtn} onClick={() => setCurrentCourse((c) => Math.max(0, c - 1))} disabled={busy || currentCourse <= 0} aria-label="Bajar tiempo">−</button>
              <span style={{ color: C.gold, fontWeight: 900, fontSize: currentCourse === 0 ? "0.95rem" : "1.55rem", minWidth: 30, textAlign: "center", fontVariantNumeric: "tabular-nums" }} aria-live="polite">{currentCourse === 0 ? "S/T" : currentCourse}</span>
              <button style={courseStepBtn} onClick={() => setCurrentCourse((c) => Math.min(4, c + 1))} disabled={busy || currentCourse >= 4} aria-label="Subir tiempo">＋</button>
              <span style={{ color: C.faint, fontSize: "0.75rem", flex: 1, minWidth: 150 }}>Lo que agregues va al {courseLabel(currentCourse)}. Empieza en Sin tiempo; sube (1–4) según el orden en que pidan.</span>
            </div>
          )}
          {canModify && (
            <button data-tour="add" style={btn.ghost} onClick={() => setMenuOpen(true)} disabled={busy}>+ Agregar platillos ({courseLabel(currentCourse)})</button>
          )}
          {canModify && pendingCount > 0 && (
            <button data-tour="send" style={btn.primary} onClick={sendToKitchen} disabled={busy}>Enviar a cocina ({pendingCount})</button>
          )}
          {canModify && pendingCount > 0 && (
            <button data-tour="clear" style={btn.ghost} onClick={() => setClearAsk(true)} disabled={busy}>Vaciar ({pendingCount})</button>
          )}
          {canModify && (
            <button style={{ ...btn.ghost, display: "inline-flex", alignItems: "center", gap: 7 }} onClick={() => setAskBill(true)} disabled={busy || liveItems.length === 0 || pendingCount > 0} title={pendingCount > 0 ? "Envía a cocina lo pendiente antes de imprimir" : undefined}><Icon name="printer" size={17} />Imprimir</button>
          )}
          {/* Modo selección: activa los checkboxes para cancelar/mover/descontar varios a la vez. */}
          {canModify && !selMode && liveItems.length > 0 && (
            <button style={btn.ghost} onClick={() => setSelMode(true)} disabled={busy}>Seleccionar productos</button>
          )}
          {/* Cuenta ya impresa / enviada a caja y el que la ve NO es caja (mesero): candado. */}
          {!canModify && !isCashier && (
            <span style={{ flexBasis: "100%", color: C.faint, fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="lock" size={15} /> {alreadyPrinted ? "Cuenta impresa — ya no se puede modificar." : "Cuenta enviada a caja — ya no se puede modificar."}
            </span>
          )}
          {/* Mensaje libre a un área. Una vez impresa la cuenta, la UI queda SOLO en Cobrar. */}
          {!alreadyPrinted && (
            <button style={{ ...btn.ghost, display: "inline-flex", alignItems: "center", gap: 7 }} onClick={() => setMsgOpen(true)} disabled={busy}>
              <Icon name="printer" size={16} />Mensaje
            </button>
          )}
        </section>

        {/* Acciones de CAJA (OPERATION/CAPTAIN/MANAGER). Las sensibles piden PIN. */}
        {isCashier && (cajaActive || isPaid) && (
          <section data-tour="caja" style={caja.wrap}>
            <div style={caja.label}>Caja</div>

            {/* Reimpresión a cocina: con productos enviados y ANTES de imprimir la cuenta
                (tras imprimir, la UI queda solo en Cobrar). La autoriza un Capitán o
                Manager; si quien opera no lo es, el modal le pide el PIN. */}
            {/* Las dos acciones sobre la cuenta viva comparten renglón; se envuelven
                solas en pantallas angostas. La fila solo existe si hay algo que
                poner: si no, dejaría un hueco con su margen. */}
            {((!isPaid && !alreadyPrinted && liveItems.some((i) => i.status !== "PENDING")) || (splittable && totalLiveUnits > 1)) && (
            <div style={caja.reprintRow}>
              {!isPaid && !alreadyPrinted && liveItems.some((i) => i.status !== "PENDING") && (
                <button style={caja.reprint} onClick={() => { setReprintSel(new Set()); setReprintPin(""); setReprintOpen(true); }} disabled={busy}>
                  <Icon name="printer" size={15} /> Reimprimir productos a cocina
                </button>
              )}
              {/* Partir la cuenta en dos cuentas reales. La hija se llama "14-1" y
                  desde ahí es una cuenta normal: se le agrega, se imprime, se cobra
                  y se puede volver a dividir ("14-1-1"). */}
              {splittable && totalLiveUnits > 1 && (
                <button style={caja.split} onClick={() => setSplitAcctOpen(true)} disabled={busy || liveItems.length === 0}>
                  Dividir cuenta
                </button>
              )}
            </div>
            )}

            {awaitingBill && !alreadyPrinted && (
              <div style={caja.callout}>
                <Icon name="printer" size={18} />
                <span>Requiere impresión del ticket antes de cobrar.</span>
              </div>
            )}
            {isPaid && !cajaActive && (
              <>
                <div style={{ ...caja.callout, color: C.green, borderColor: `color-mix(in srgb, ${C.green} 45%, transparent)`, background: `color-mix(in srgb, ${C.green} 12%, transparent)` }}>
                  Cuenta saldada y sellada — solo lectura.
                </div>
                {/* Reimprimir el ticket del cliente aun estando pagada, con motivo para
                    auditoría. Visible para toda la caja: si quien opera no es Capitán o
                    Manager, el modal le pide el PIN de uno. Antes sólo aparecía si el
                    supervisor tenía la sesión abierta, así que en la práctica el cajero
                    no tenía botón. */}
                <div style={caja.primaryRow}>
                  <button style={caja.secondary} onClick={() => setReprint(true)} disabled={busy}><Icon name="printer" size={16} />Reimprimir ticket</button>
                </div>
                {isManager ? (
                  <>
                    <div style={caja.subLabel}>Más acciones</div>
                    <div style={caja.moreRow}>
                      <button style={caja.more} onClick={() => setReopenOpen(true)} disabled={busy}>Reabrir cuenta</button>
                    </div>
                  </>
                ) : (
                  <div style={{ color: C.faint, fontSize: "0.78rem", marginTop: 6 }}>
                    Una vez cobrada no se agrega, quita ni modifica nada. La reapertura la autoriza un administrador (Manager).
                  </div>
                )}
              </>
            )}

            {/* Acción principal de ahora: imprimir o cobrar */}
            {cajaActive && (
              <div style={caja.primaryRow}>
                {awaitingBill && !alreadyPrinted && (
                  <button style={caja.primary} onClick={() => setAskPrint(true)} disabled={busy || liveItems.length === 0 || pendingCount > 0} title={pendingCount > 0 ? "Envía a cocina lo pendiente antes de imprimir" : undefined}><Icon name="printer" size={18} />Imprimir ticket</button>
                )}
                {alreadyPrinted && (
                  <button style={caja.primary} onClick={() => setPayOpen(true)} disabled={busy}><Icon name="card" size={18} />Cobrar{amountPaid > 0 ? ` · restan ${formatMXN(remaining)}` : ""}</button>
                )}
                {/* Impresa: las acciones son Cobrar y Reabrir. La reapertura devuelve la
                    cuenta a "en servicio" con todo lo normal —agregar, imprimir, dividir—
                    porque isBillPrinted solo cuenta tickets posteriores a la reapertura.
                    Lo ve toda la caja: el endpoint exige PIN de Capitán o Manager pase lo
                    que pase, así que esconderlo al cajero solo lo obligaba a cerrar sesión. */}
                {porCobrar && (
                  <button style={caja.secondary} onClick={() => setUnlockAsk(true)} disabled={busy}>Reabrir cuenta</button>
                )}
                {/* Cuenta en $0 (cortesía / mesa sin consumo): se puede "matar" sin cobro,
                    dejando huella. No requiere imprimir ni cobrar. */}
                {Number(c.total) === 0 && (
                  <button style={caja.primary} onClick={() => setCloseZeroAsk(true)} disabled={busy}>Cerrar en $0 (sin cobro)</button>
                )}
                {/* Ligar a empleado, a la derecha de la acción principal: es una acción
                    de la misma familia —decide cómo se salda la cuenta— y estando en su
                    propio bloque más abajo se leía como algo aparte. Va en contorno y no
                    en relleno para no competir con Cobrar, que es la acción esperada. */}
                {c.table == null && !alreadyPrinted && !c.chargedEmployeeId && !linkPick && (
                  <button style={caja.accentOutline} onClick={() => setLinkPick(true)} disabled={busy}>Ligar a empleado</button>
                )}
              </div>
            )}

            {/* #4 Ligar a empleado (solo cuentas para llevar / sin mesa, ANTES de imprimir). El
                empleado debe aprobarla en su cartera antes de que caja pueda cobrarla a crédito.
                Tras imprimir, la UI queda solo en Cobrar (el crédito se maneja en el cobro).

                El disparador vive arriba, junto a la acción principal. Este bloque solo
                existe cuando hay algo que mostrar —el selector abierto o una cuenta ya
                ligada—; si no, dejaría un encabezado suelto sin contenido debajo. */}
            {cajaActive && c.table == null && !alreadyPrinted && (c.chargedEmployeeId != null || linkPick) && (
              <div style={{ marginTop: 14 }}>
                <div style={caja.subLabel}>Empleado (crédito)</div>
                {c.chargedEmployeeId ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ color: C.cream, fontWeight: 700 }}>{c.chargedEmployee?.fullName ?? "Empleado"}</span>
                    <span style={{ fontSize: "0.7rem", fontWeight: 800, padding: "3px 9px", borderRadius: 6, color: "var(--sl-on-accent)", background: c.employeeChargeStatus === "APPROVED" ? "#5aa06e" : "var(--sl-gold-soft)" }}>
                      {c.employeeChargeStatus === "APPROVED" ? "APROBADA" : "POR APROBAR"}
                    </span>
                    {editable && <button style={caja.more} onClick={() => doLink(null)} disabled={busy}>Desligar</button>}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <select value={selEmp} onChange={(e) => setSelEmp(e.target.value)} style={{ padding: "9px 11px", borderRadius: 9, background: "rgba(0,0,0,0.2)", border: `1px solid ${C.border}`, color: C.cream, fontFamily: "inherit", fontSize: "0.85rem", minWidth: 200 }}>
                      <option value="">— Empleado —</option>
                      {emps.map((e) => <option key={e.id} value={e.id}>{e.fullName} · {e.role}</option>)}
                    </select>
                    <button style={caja.primary} onClick={() => selEmp && doLink(Number(selEmp))} disabled={busy || !selEmp}>Ligar</button>
                    <button style={caja.more} onClick={() => { setLinkPick(false); setSelEmp(""); }} disabled={busy}>Cancelar</button>
                  </div>
                )}
                {/* Las DOS vías de aprobación, a la vista. La cuenta ya aparece
                    en la cartera del empleado sin necesidad de aviso; lo que
                    faltaba era poder teclear su NIP aquí, en la terminal,
                    cuando la persona está parada frente a la caja. */}
                {c.chargedEmployeeId != null && c.employeeChargeStatus !== "APPROVED" && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ color: C.faint, fontSize: "0.74rem" }}>
                      Debe aprobarla antes de cobrarla a crédito: desde su app, o con su NIP aquí mismo.
                    </div>
                    {!approvePinMode ? (
                      <button style={{ ...caja.more, marginTop: 8 }} onClick={() => setApprovePinMode(true)} disabled={busy}>
                        Aprobar con NIP aquí
                      </button>
                    ) : (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                        <input
                          type="password"
                          inputMode="numeric"
                          autoComplete="off"
                          autoFocus
                          placeholder="NIP"
                          value={approvePin}
                          onChange={(e) => setApprovePin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          onKeyDown={(e) => { if (e.key === "Enter" && approvePin.length === 4 && !busy) doApproveEmployee(); }}
                          style={{ ...fld.input, width: 110, letterSpacing: "0.35em", textAlign: "center" }}
                        />
                        <button style={caja.primary} onClick={doApproveEmployee} disabled={busy || approvePin.length !== 4}>
                          {busy ? "Aprobando…" : "Aprobar"}
                        </button>
                        <button style={caja.more} onClick={() => { setApprovePinMode(false); setApprovePin(""); }} disabled={busy}>Cancelar</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Acciones que MODIFICAN la cuenta: solo mientras es editable (OPEN/IN_SERVICE).
                En "por cobrar" la cuenta está bloqueada — hay que "Reabrir cuenta" primero. */}
            {canModify && (
              <>
                <div style={caja.subLabel}>Más acciones</div>
                <div style={caja.moreRow}>
                  <button style={caja.more} onClick={() => setDiscountTarget({})} disabled={busy || liveItems.length === 0}>Descuento a la cuenta</button>
                  <button style={caja.more} onClick={() => setMergeOpen(true)} disabled={busy}>Juntar cuentas</button>
                  <button style={caja.more} onClick={() => setTransferOpen(true)} disabled={busy || liveItems.length === 0}>Traspasar producto</button>
                </div>
              </>
            )}
          </section>
        )}

        {(c.status === "AWAITING_PAYMENT" || alreadyPrinted) && (
          <section style={{ marginTop: 18 }}>
            <TicketPreview
              folio={c.folio}
              table={c.table ? `Mesa ${c.table.number}` : (c.customName || "Cuenta sin mesa")}
              money={c}
              taxEnabled={taxEnabled}
              items={liveItems.map((i) => ({ name: i.dishNameSnapshot, qty: Number(i.quantity), total: Number(i.lineTotal) }))}
              footer="¡Gracias por su visita!"
            />
          </section>
        )}
      </main>

      {/* Menú para agregar (pantalla completa) */}
      <MenuSelector
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onAdd={async (dishId, quantity, modifiers, kitchenNotes) => {
          const ok = await post(`/api/comandas/${id}/items`, { dishId, quantity, modifiers, kitchenNotes, course: currentCourse }, "Platillo agregado");
          return ok;
        }}
        pendingItems={liveItems.filter((i) => i.status === "PENDING")}
        onRemove={removePendingItem}
        busy={busy}
      />

      {/* Cancelar item */}
      {cancelItem && cancelItem.status === "PENDING" && (
        <ConfirmModal
          open
          title="Cancelar platillo"
          message={`¿Quitar «${fmtQty(Number(cancelItem.quantity))}× ${cancelItem.dishNameSnapshot}»? Aún no se ha enviado a cocina.`}
          confirmLabel="Quitar"
          danger
          busy={busy}
          onConfirm={() => confirmCancelItem()}
          onCancel={() => setCancelItem(null)}
        />
      )}
      {cancelItem && cancelItem.status !== "PENDING" && (
        <ReasonModal
          open
          title="Cancelar platillo enviado"
          label="Motivo de la cancelación (auditoría)"
          confirmLabel="Cancelar platillo"
          danger
          requirePin
          busy={busy}
          onConfirm={(reason, pin) => confirmCancelItem(reason, pin)}
          onCancel={() => setCancelItem(null)}
        />
      )}

      {/* Reabrir cuenta saldada (supervisor: Capitán/Manager, con PIN + motivo) */}
      <ReopenModal
        open={reopenOpen}
        comanda={c}
        onClose={() => setReopenOpen(false)}
        onDone={(updated) => { setReopenOpen(false); setComanda(updated); push("Cuenta reabierta", "success"); }}
        onError={(m) => push(m, "error")}
      />

      <ConfirmModal
        open={closeZeroAsk}
        title="Cerrar cuenta en $0"
        message="Se cerrará esta cuenta SIN cobro (total $0). Queda registrada como cerrada sin monto y ya no se podrá modificar. ¿Continuar?"
        confirmLabel="Cerrar en $0"
        busy={busy}
        onConfirm={doCloseZero}
        onCancel={() => setCloseZeroAsk(false)}
      />

      {unlockAsk && (
        <ReasonModal
          open
          title="Reabrir cuenta (por cobrar)"
          label="Motivo de la reapertura (auditoría)"
          confirmLabel="Reabrir para modificar"
          requirePin
          busy={busy}
          onConfirm={(reason, pin) => doUnlock(reason, pin)}
          onCancel={() => setUnlockAsk(false)}
        />
      )}

      <ConfirmModal
        open={askPrint}
        title="Imprimir ticket"
        message="¿Confirmar la impresión del ticket de la cuenta?"
        confirmLabel="Confirmar"
        busy={busy}
        onConfirm={() => { setAskPrint(false); doPrint(); }}
        onCancel={() => setAskPrint(false)}
      />

      <ConfirmModal
        open={askBill}
        title="Imprimir ticket"
        message="Se imprimirá el ticket y la comanda quedará BLOQUEADA: ni tú ni la caja podrán agregar o modificar platillos. ¿Seguro que quieres imprimir?"
        confirmLabel="Sí, imprimir"
        busy={busy}
        onConfirm={printAndLock}
        onCancel={() => setAskBill(false)}
      />

      <ReasonModal
        open={reprint}
        title="Reimprimir ticket"
        label="Motivo de la reimpresión (auditoría)"
        confirmLabel="Reimprimir"
        // Al supervisor en sesión no se le pide PIN: ya está identificado. Al
        // cajero sí, y es el PIN de quien autoriza, no el suyo.
        //
        // Salvo que la cuenta ya esté COBRADA: en el archivo no hay nada que
        // alterar, así que una copia del ticket no necesita que nadie autorice.
        // Sigue pidiendo el motivo, que es la huella de quién la pidió.
        requirePin={!isSupervisor && !isPaid}
        busy={busy}
        onConfirm={async (reason, pin) => { setReprint(false); await doPrint(reason, pin); }}
        onCancel={() => setReprint(false)}
      />


      {/* Partir la cuenta: crea una cuenta hija, por eso pide PIN y exige dejar
          algo del otro lado. */}
      <SplitAccountModal
        open={splitAcctOpen}
        divisionNumber={1}
        title="Dividir cuenta"
        intro="Elige los productos que se van a la cuenta nueva. El resto se queda en esta. La cuenta nueva se comporta como cualquier otra: se le agrega, se imprime, se cobra y se puede volver a dividir."
        confirmLabel="Dividir"
        requirePin
        mustLeaveOne
        items={liveItems.map((it) => ({ id: it.id, name: it.dishNameSnapshot, unitPrice: Number(it.unitPriceSnapshot), remainingQty: Number(it.quantity) }))}
        busy={busy}
        onConfirm={doSplitAccount}
        onClose={() => setSplitAcctOpen(false)}
      />

      {/* ── Modales de CAJA ── */}
      <PayModal
        open={payOpen}
        comandaId={payOpen ? c.id : null}
        hasOpenSession={hasSession}
        onClose={() => setPayOpen(false)}
        onPaid={(r: PayResult) => {
          setPayOpen(false); setComanda(r.comanda);
          push(r.settled ? "Cuenta cobrada y cerrada" : `Abono registrado · restan ${formatMXN(r.remaining)}`, "success");
          if (r.changeGiven > 0) push(`Cambio a entregar: ${formatMXN(r.changeGiven)}`, "info");
        }}
        onError={(m) => push(m, "error")}
      />

      <DiscountModal
        open={discountTarget !== null}
        comandaId={c.id}
        itemId={discountTarget?.itemId ?? null}
        itemName={discountTarget?.itemName}
        onClose={() => setDiscountTarget(null)}
        onDone={(cc) => { setDiscountTarget(null); setComanda(cc); push("Descuento aplicado", "success"); }}
        onError={(m) => push(m, "error")}
      />

      <MergeModal
        open={mergeOpen}
        target={c}
        onClose={() => setMergeOpen(false)}
        onDone={(cc) => { setMergeOpen(false); setComanda(cc); push("Cuentas juntadas", "success"); }}
        onError={(m) => push(m, "error")}
      />

      <TransferItemModal
        open={transferOpen}
        from={c}
        onClose={() => setTransferOpen(false)}
        onDone={(cc) => { setTransferOpen(false); setComanda(cc); push("Producto traspasado", "success"); }}
        onError={(m) => push(m, "error")}
      />

      <ConfirmModal
        open={clearAsk}
        title="Vaciar borrador"
        message={`¿Borrar los ${pendingCount} platillo(s) por enviar? Aún no se mandan a cocina; esto no afecta lo ya enviado.`}
        confirmLabel="Vaciar"
        danger
        busy={busy}
        onConfirm={clearDraft}
        onCancel={() => setClearAsk(false)}
      />

      {/* Reimpresión a cocina (manager): elige qué productos enviados reimprimir */}
      {reprintOpen && (() => {
        const reprintable = liveItems.filter((i) => i.status !== "PENDING");
        return (
          <div style={rp.overlay} onClick={() => setReprintOpen(false)}>
            <div style={rp.modal} onClick={(e) => e.stopPropagation()}>
              <div style={rp.title}>Reimprimir a cocina</div>
              <div style={rp.sub}>Elige qué productos reenviar a cocina/barra. Salen marcados como «REIMPRESIÓN».</div>
              <div style={rp.list}>
                {reprintable.length === 0 ? (
                  <div style={{ color: C.faint, fontSize: "0.84rem", padding: "8px 2px" }}>No hay productos enviados a cocina.</div>
                ) : reprintable.map((it) => {
                  const on = reprintSel.has(it.id);
                  return (
                    <label key={it.id} style={{ ...rp.row, borderColor: on ? C.gold : C.line, background: on ? "rgb(var(--sl-gold-rgb) / 0.08)" : "transparent" }}>
                      <input type="checkbox" checked={on} onChange={() => toggleReprint(it.id)} />
                      <span style={rp.rowName}>{fmtQty(Number(it.quantity))}× {it.dishNameSnapshot}</span>
                      <span style={rp.rowArea}>{it.prepAreaSnapshot === "BARRA" ? "Barra" : "Cocina"}</span>
                    </label>
                  );
                })}
              </div>
              {/* El supervisor en sesión ya está identificado; al resto de la caja se
                  le pide el PIN de quien autoriza. */}
              {!isSupervisor && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ ...rp.sub, display: "block", marginBottom: 6 }}>PIN de supervisor (Capitán/Manager)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={reprintPin}
                    onChange={(e) => setReprintPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    style={{
                      width: "100%", boxSizing: "border-box", padding: "11px 12px", minHeight: 44,
                      borderRadius: 8, border: `1px solid ${C.line}`, background: "var(--sl-panel2)",
                      color: C.cream, fontFamily: "inherit", fontSize: "1.1rem",
                      letterSpacing: "0.5em", textAlign: "center",
                    }}
                  />
                </div>
              )}
              <div style={rp.actions}>
                <button style={btn.ghost} onClick={() => setReprintOpen(false)}>Cancelar</button>
                <button
                  style={btn.primary}
                  disabled={reprintSel.size === 0 || busy || (!isSupervisor && !/^\d{4}$/.test(reprintPin))}
                  onClick={doReprint}
                >
                  Reimprimir ({reprintSel.size})
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Cancelar en lote: PIN si algún seleccionado ya fue a cocina; si no, confirmación simple */}
      {batchCancelOpen && (anySentSel ? (
        <ReasonModal
          open
          title="Cancelar productos enviados"
          label="Motivo de la cancelación (auditoría)"
          confirmLabel={`Cancelar ${sel.size} producto(s)`}
          danger
          requirePin
          busy={busy}
          onConfirm={(reason, pin) => doBatchCancel(reason, pin)}
          onCancel={() => setBatchCancelOpen(false)}
        />
      ) : (
        <ConfirmModal
          open
          title="Quitar productos"
          message={`¿Quitar ${sel.size} producto(s)? Aún no se envían a cocina.`}
          confirmLabel="Quitar"
          danger
          busy={busy}
          onConfirm={() => doBatchCancel()}
          onCancel={() => setBatchCancelOpen(false)}
        />
      ))}

      <DiscountModal
        open={batchDiscount}
        comandaId={c.id}
        itemIds={[...sel]}
        onClose={() => setBatchDiscount(false)}
        onDone={(cc) => { setBatchDiscount(false); clearSel(); setComanda(cc); push("Descuento aplicado", "success"); }}
        onError={(m) => push(m, "error")}
      />

      <TransferItemModal
        open={batchMove}
        from={c}
        itemIds={[...sel]}
        onClose={() => setBatchMove(false)}
        onDone={(cc) => { setBatchMove(false); clearSel(); setComanda(cc); push("Productos traspasados", "success"); }}
        onError={(m) => push(m, "error")}
      />

      <Tour steps={COMANDERO_TOUR} open={tourOpen} onClose={closeTour} />

      {/* Mensaje a un área: se imprime en la impresora de Cocina, Barra o Caja. */}
      <Modal open={msgOpen} title="Mensaje a un área" onClose={() => setMsgOpen(false)}>
        <p style={{ margin: "0 0 12px", color: C.dim, fontSize: "0.86rem", lineHeight: 1.5 }}>
          Se imprime en la impresora del área que elijas. Útil para avisar algo rápido a cocina, barra o caja.
        </p>
        <div style={{ ...fld.label as React.CSSProperties, marginBottom: 6 }}>Enviar a</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {([["COCINA", "Cocina"], ["BARRA", "Barra"], ["CAJA", "Caja"]] as const).map(([val, lbl]) => (
            <button key={val} onClick={() => setMsgArea(val)}
              style={{ ...btn.ghost, flex: 1, ...(msgArea === val ? { background: C.gold, color: "var(--sl-on-accent)", borderColor: C.gold, fontWeight: 800 } : {}) }}>
              {lbl}
            </button>
          ))}
        </div>
        <div style={{ ...fld.label as React.CSSProperties, marginBottom: 6 }}>Mensaje</div>
        <textarea value={msgText} onChange={(e) => setMsgText(e.target.value.slice(0, 300))} autoFocus rows={4}
          placeholder="Escribe el mensaje…"
          style={{ ...fld.input as React.CSSProperties, width: "100%", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
        <div style={{ color: C.faint, fontSize: "0.72rem", marginTop: 4, textAlign: "right" }}>{msgText.length}/300</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <button style={btn.ghost} onClick={() => setMsgOpen(false)} disabled={busy}>Cancelar</button>
          <button style={{ ...btn.primary, opacity: msgText.trim() && !busy ? 1 : 0.5 }} onClick={doSendMessage} disabled={!msgText.trim() || busy}>
            {busy ? "Enviando…" : "Enviar mensaje"}
          </button>
        </div>
      </Modal>

      <ToastHost toasts={toasts} onClose={dismiss} />
    </div>
  );
}

// Barra delgada para el modo embebido (dentro del panel /admin, que ya trae su menú
// lateral): solo "Volver" + folio + estado, sin el StaffHeader de pantalla completa.
function EmbedBar({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, rowGap: 8, flexWrap: "wrap", padding: "12px 18px", borderBottom: `1px solid ${C.border}`, background: C.panel }}>
      <button
        onClick={onBack}
        style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.gold, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
      >← Volver al piso</button>
      <span style={{ color: C.cream, fontWeight: 800, fontSize: "1rem", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
      {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
    </div>
  );
}


const courseStepBtn: React.CSSProperties = {
  width: 46, height: 46, borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent",
  color: C.cream, fontSize: "1.5rem", cursor: "pointer", lineHeight: 1, fontFamily: "inherit", flexShrink: 0,
};

const page: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: C.bg },
  main: { padding: "18px", maxWidth: 960, margin: "0 auto", paddingBottom: 60 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  panel: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 14 },
  panelHead: { padding: "12px 18px", borderBottom: `1px solid ${C.line}`, color: C.faint, fontSize: "0.66rem", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 },
  courseSep: { padding: "8px 18px", background: "rgb(var(--sl-gold-rgb) / 0.08)", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.line}`, color: C.gold, fontSize: "0.68rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 },
  itemRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${C.line}` },
  cancelX: { width: 30, height: 30, borderRadius: 7, border: `1px solid ${C.red}`, background: "transparent", color: C.red, fontSize: "1.1rem", cursor: "pointer", lineHeight: 1 },
  commentAdd: { marginTop: 6, padding: 0, background: "transparent", border: "none", color: C.gold, fontSize: "0.74rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textAlign: "left" },
  commentEdit: { padding: 0, background: "transparent", border: "none", color: C.faint, fontSize: "0.7rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 },
  commentInput: { flex: 1, minWidth: 0, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.cream, fontSize: "0.8rem", padding: "6px 10px", fontFamily: "inherit" },
  commentSave: { padding: "6px 12px", borderRadius: 8, border: "none", background: C.gold, color: "var(--sl-on-accent)", fontWeight: 800, fontSize: "0.76rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  commentCancel: { width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontSize: "0.9rem", cursor: "pointer", flexShrink: 0, lineHeight: 1 },
  batchBar: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 16px", marginBottom: 14, borderRadius: 12, border: `1px solid ${C.gold}`, background: "rgb(var(--sl-gold-rgb) / 0.10)" },
  batchBtn: { padding: "8px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: "transparent", color: C.cream, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" },
  batchClear: { padding: "8px 12px", borderRadius: 9, border: "none", background: "transparent", color: C.dim, fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" },
  discBtn: { width: 30, height: 30, borderRadius: 7, border: `1px solid ${C.gold}`, background: "transparent", color: C.gold, fontSize: "0.92rem", fontWeight: 700, cursor: "pointer", lineHeight: 1 },
  actions: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 },
};

// Acciones de CAJA con jerarquía: callout de estado → acción principal grande
// (imprimir / cobrar) → «Más acciones» discretas (descuento / juntar / traspasar).
const caja: Record<string, React.CSSProperties> = {
  wrap: { marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 16 },
  label: { color: C.faint, fontSize: "0.62rem", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800, marginBottom: 12 },
  callout: {
    display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12,
    border: `1px solid color-mix(in srgb, ${AWAIT} 45%, transparent)`, background: `color-mix(in srgb, ${AWAIT} 12%, transparent)`,
    color: AWAIT, fontSize: "0.9rem", fontWeight: 700, marginBottom: 12,
  },
  primaryRow: { display: "flex", flexWrap: "wrap", gap: 10 },
  primary: { ...btn.primary, minHeight: 50, minWidth: 160, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: "0.92rem" },
  secondary: { ...btn.ghost, minHeight: 50, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 },
  // Mismo peso que la acción principal pero en contorno: acompaña a Cobrar sin
  // disputarle la vista. Usa el token del acento, así que en modo claro pasa a
  // azul —contorno y letra— sin necesidad de una regla por tema.
  accentOutline: { ...btn.ghost, minHeight: 50, minWidth: 160, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: "0.92rem", fontWeight: 800, background: "transparent", border: "1px solid var(--sl-gold)", color: "var(--sl-gold)" },
  subLabel: { color: C.faint, fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, margin: "16px 0 8px" },
  moreRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  more: { padding: "9px 14px", minHeight: 40, borderRadius: 9, border: `1px solid ${C.line}`, background: "transparent", color: C.dim, fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" },
  reprintRow: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 12 },
  reprint: { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", minHeight: 40, borderRadius: 9, border: `1px solid ${C.line}`, background: "transparent", color: C.gold, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" },
  // Mismo alto y forma que el de reimprimir para que el renglón lea parejo; el
  // color lo distingue: aquel es una acción de impresión, este mueve productos.
  split: { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 14px", minHeight: 40, borderRadius: 9, border: `1px solid ${C.line}`, background: "transparent", color: C.cream, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" },
};

// Modal de reimpresión a cocina (selección de productos, solo manager).
const rp: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 100 },
  modal: { width: "100%", maxWidth: 460, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, maxHeight: "84vh", display: "flex", flexDirection: "column" },
  title: { color: C.cream, fontSize: "1.05rem", fontWeight: 800 },
  sub: { color: C.dim, fontSize: "0.82rem", marginTop: 4, marginBottom: 12 },
  list: { display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: 1 },
  row: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, cursor: "pointer" },
  rowName: { color: C.cream, fontSize: "0.88rem", flex: 1, minWidth: 0 },
  rowArea: { color: C.faint, fontSize: "0.74rem", whiteSpace: "nowrap" },
  actions: { display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" },
};
