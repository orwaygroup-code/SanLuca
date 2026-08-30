"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { WhatsAppFloat } from "./WhatsAppFloat";
import { AcceptTermsModal } from "./AcceptTermsModal";
import { OrwayCredit } from "./OrwayCredit";

const BARE_PATHS = ["/login"];
const BARE_PREFIXES = ["/checkin/", "/admin", "/crm", "/staff"];

// /admin y /crm montan shells de alto 100vh con drawer de hamburguesa. Ahí el
// crédito va DENTRO del <main> del shell (ver AdminShell/CrmShell): colgarlo
// fuera sumaría alto por encima del 100vh y el drawer dejaría de cubrir la
// pantalla completa de arriba abajo.
const SHELL_PREFIXES = ["/admin", "/crm"];

// Rutas legales y de auth donde NO mostramos el modal de re-aceptación —
// el usuario debe poder leer los documentos antes de aceptarlos, y debe poder
// cerrar sesión.
const MODAL_EXEMPT_PATHS = ["/privacidad", "/terminos", "/login", "/staff"];

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAuth = BARE_PATHS.includes(pathname) || BARE_PREFIXES.some((p) => pathname.startsWith(p));
    const hasShell = SHELL_PREFIXES.some((p) => pathname.startsWith(p));
    const showAcceptModal = !MODAL_EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

    return (
        <>
            {!isAuth && <Navbar />}
            <main>{children}</main>
            {/* El Footer público ya lleva el crédito incrustado; /admin y /crm
                lo montan dentro de su propio shell. Queda esta barra para
                /staff, /login y /checkin, que no tienen ni Footer ni shell. */}
            {isAuth && !hasShell && <OrwayCredit variant="bar" />}
            {!isAuth && <Footer />}
            {!isAuth && <WhatsAppFloat />}
            {showAcceptModal && <AcceptTermsModal />}
        </>
    );
}
