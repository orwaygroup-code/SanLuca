"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminRedirect() {
    const router = useRouter();

    useEffect(() => {
        const role = localStorage.getItem("userRole");
        if (role === "ADMIN" || role === "HOSTES") {
            router.replace("/admin");
        }
    }, [router]);

    return null;
}
