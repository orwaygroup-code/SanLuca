"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";

const BARE_PATHS = ["/login"];
const BARE_PREFIXES = ["/checkin/", "/admin"];

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAuth = BARE_PATHS.includes(pathname) || BARE_PREFIXES.some((p) => pathname.startsWith(p));

    return (
        <>
            {!isAuth && <Navbar />}
            <main>{children}</main>
            {!isAuth && <Footer />}
        </>
    );
}
