"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminRedirect() {
    const router = useRouter();

    useEffect(() => {
        if (localStorage.getItem("userRole") === "ADMIN") {
            router.replace("/admin");
        }
    }, [router]);

    return null;
}
