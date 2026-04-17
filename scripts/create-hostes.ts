/**
 * Ejecutar en el VPS:
 *   cd /var/www/sanluca && npx tsx scripts/create-hostes.ts
 *
 * Qué hace:
 *  1. Desactiva cuentas HOSTES existentes (cambia rol a CUSTOMER)
 *  2. Crea los 3 nuevos perfiles de hostess
 */

import { PrismaClient } from "@prisma/client";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const buf  = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
}

const NEW_HOSTES = [
    { name: "David",      email: "david.hostes@sanluca.mx",      password: "DavidSL2026!" },
    { name: "Perla",      email: "perla.hostes@sanluca.mx",      password: "PerlaSL2026!" },
    { name: "Franccesca", email: "franccesca.hostes@sanluca.mx", password: "FranSL2026!"  },
];

async function main() {
    // 1. Desactivar hostes existentes que NO sean los nuevos
    const newEmails = NEW_HOSTES.map((h) => h.email);
    const oldHostes = await prisma.user.findMany({
        where: { role: "HOSTES", email: { notIn: newEmails } },
        select: { id: true, email: true, name: true },
    });

    for (const u of oldHostes) {
        await prisma.user.update({ where: { id: u.id }, data: { role: "CUSTOMER" } });
        console.log(`✗ Desactivado: ${u.name} <${u.email}>`);
    }

    // 2. Crear / actualizar los nuevos hostes
    for (const h of NEW_HOSTES) {
        const passwordHash = await hashPassword(h.password);
        await prisma.user.upsert({
            where:  { email: h.email },
            update: { name: h.name, role: "HOSTES", passwordHash },
            create: { name: h.name, email: h.email, role: "HOSTES", passwordHash, phone: "" },
        });
        console.log(`✓ Creado: ${h.name} <${h.email}> / ${h.password}`);
    }

    console.log("\nListo.");
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
