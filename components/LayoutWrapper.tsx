"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { WhatsAppFloat } from "./WhatsAppFloat";
import { AcceptTermsModal } from "./AcceptTermsModal";

const BARE_PATHS = ["/login"];
const BARE_PREFIXES = ["/checkin/", "/admin", "/crm"];

// Rutas legales y de auth donde NO mostramos el modal de re-aceptación —
// el usuario debe poder leer los documentos antes de aceptarlos, y debe poder
// cerrar sesión.
const MODAL_EXEMPT_PATHS = ["/privacidad", "/terminos", "/login"];

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAuth = BARE_PATHS.includes(pathname) || BARE_PREFIXES.some((p) => pathname.startsWith(p));
    const showAcceptModal = !MODAL_EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

    return (
        <>
            {!isAuth && <Navbar />}
            <main>{children}</main>
            {!isAuth && <Footer />}
            {!isAuth && <WhatsAppFloat />}
            {showAcceptModal && <AcceptTermsModal />}
        </>
    );
}
