import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {

  const entradas = await prisma.menuCategory.create({
    data: {
      name: "Entradas",
      position: 1
    }
  });

  const fuertes = await prisma.menuCategory.create({
    data: {
      name: "Platos Fuertes",
      position: 2
    }
  });

  const bebidas = await prisma.menuCategory.create({
    data: {
      name: "Bebidas",
      position: 3
    }
  });

  await prisma.dish.createMany({
    data: [
      {
        name: "Guacamole",
        description: "Guacamole fresco con totopos",
        price: 120,
        categoryId: entradas.id,
        position: 1
      },
      {
        name: "Ribeye",
        description: "Ribeye a la parrilla",
        price: 420,
        categoryId: fuertes.id,
        position: 1
      },
      {
        name: "Pasta Alfredo",
        description: "Pasta cremosa con parmesano",
        price: 220,
        categoryId: fuertes.id,
        position: 2
      },
      {
        name: "Margarita",
        description: "Margarita clásica",
        price: 150,
        categoryId: bebidas.id,
        position: 1
      }
    ]
  });

}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });