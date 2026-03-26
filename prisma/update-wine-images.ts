import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const updates = [
  { name: "Lupo Nero Blanco", imageUrl: "/images/menu/vinos/VinosBlancosyRosados/Lupo Nero Blanco.png" },
  { name: "Pinot Grigio", imageUrl: "/images/menu/vinos/VinosBlancosyRosados/Pinot Grigio.png" },
  { name: "Illivia Rosado", imageUrl: "/images/menu/vinos/VinosBlancosyRosados/Illivia Rosado.png" },
  { name: "Scaia Blanco", imageUrl: "/images/menu/vinos/VinosBlancosyRosados/Scaia Blanco.png" },
  { name: "Flumen Prosecco", imageUrl: "/images/menu/vinos/VinosEspumosos/Flumen Prosecco.png" },
  { name: "5 Vite", imageUrl: "/images/menu/vinos/VinosTintos/5 Vite.png" },
  { name: "Amarone della Valpolicella", imageUrl: "/images/menu/vinos/VinosTintos/Amarone della Valpolicella.png" },
  { name: "Colpo di Zappa", imageUrl: "/images/menu/vinos/VinosTintos/Colpo di Zappa.png" },
  { name: "Illivia Negroamaro", imageUrl: "/images/menu/vinos/VinosTintos/Illivia Negroamaro.png" },
  { name: "Les Légendes R Rouge", imageUrl: "/images/menu/vinos/VinosTintos/Les Légendes R Rouge.png" },
  { name: "Marqués de Riscal Reserva Especial XR", imageUrl: "/images/menu/vinos/VinosTintos/Marqués de Riscal Reserva Especial XR.png" },
  { name: "Montepulciano D'Abruzzo DOC", imageUrl: "/images/menu/vinos/VinosTintos/Montepulciano D'Abruzzo DOC.png" },
  { name: "Quater Vitis Rosso", imageUrl: "/images/menu/vinos/VinosTintos/Quater Vitis Rosso.png" },
  { name: "Roccaperciata Rosso", imageUrl: "/images/menu/vinos/VinosTintos/Roccaperciata Rosso.png" },
  { name: "Scaia Rosso", imageUrl: "/images/menu/vinos/VinosTintos/Scaia Rosso.png" },
  { name: "Villa Santera", imageUrl: "/images/menu/vinos/VinosTintos/Villa Santera.png" },
  { name: "Zuccardi Serie Q", imageUrl: "/images/menu/vinos/VinosTintos/Zuccardi Serie Q.png" },
];

async function main() {
  for (const { name, imageUrl } of updates) {
    const result = await prisma.dish.updateMany({ where: { name }, data: { imageUrl } });
    console.log(`${name}: ${result.count} updated`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
