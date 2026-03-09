import type { Metadata } from "next";
import ContactPage from "@/components/sections/ContactSection";

export const metadata: Metadata = {
    title: "Contacto",
    description: "Envíanos un mensaje",
};

export default function Contact() {
    return <ContactPage />;
}
