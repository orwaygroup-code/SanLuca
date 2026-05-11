"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-client";

export default function AdminRedirect() {
    const router = useRouter();
    const session = useSession();

    useEffect(() => {
        if (session.loading) return;
        const role = session.user?.role;
        if (role === "ADMIN" || role === "HOSTES") {
            router.replace("/admin");
        }
    }, [router, session.loading, session.user]);

    return null;
}
