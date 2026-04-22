import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ── COMIDA: Clásica ──────────────────────────
  const antipasti = await prisma.menuCategory.create({ data: { name: "Antipasti", position: 1 } });
  const paste = await prisma.menuCategory.create({ data: { name: "Paste", position: 2 } });
  const pizza = await prisma.menuCategory.create({ data: { name: "Pizza", position: 3 } });
  const risotto = await prisma.menuCategory.create({ data: { name: "Risotto", position: 4 } });
  const insalate = await prisma.menuCategory.create({ data: { name: "Insalate", position: 5 } });
  const carneWagyu = await prisma.menuCategory.create({ data: { name: "Carne Wagyu", position: 6 } });
  const terra = await prisma.menuCategory.create({ data: { name: "Terra", position: 7 } });
  const pesce = await prisma.menuCategory.create({ data: { name: "Pesce Del Giorno", position: 8 } });

  // ── COMIDA: Bebidas ──────────────────────────
  const cafeteria = await prisma.menuCategory.create({ data: { name: "Cafetería", position: 9 } });
  const sinAlcohol = await prisma.menuCategory.create({ data: { name: "Sin Alcohol", position: 10 } });
  const carajillos = await prisma.menuCategory.create({ data: { name: "Carajillos", position: 11 } });
  const cerveza = await prisma.menuCategory.create({ data: { name: "Cerveza", position: 12 } });
  const cocteleria = await prisma.menuCategory.create({ data: { name: "Coctelería", position: 13 } });
  const mocteleria = await prisma.menuCategory.create({ data: { name: "Moctelería", position: 14 } });

  // ── COMIDA: Postres ──────────────────────────
  const postres = await prisma.menuCategory.create({ data: { name: "Postres", position: 15 } });

  // ── COMIDA: Destilados ───────────────────────
  const tequila = await prisma.menuCategory.create({ data: { name: "Tequila", position: 16 } });
  const ron = await prisma.menuCategory.create({ data: { name: "Ron", position: 17 } });
  const vodka = await prisma.menuCategory.create({ data: { name: "Vodka", position: 18 } });
  const mezcal = await prisma.menuCategory.create({ data: { name: "Mezcal", position: 19 } });
  const whiskey = await prisma.menuCategory.create({ data: { name: "Whiskey", position: 20 } });
  const conac = await prisma.menuCategory.create({ data: { name: "Coñac", position: 21 } });
  const ginebras = await prisma.menuCategory.create({ data: { name: "Ginebras", position: 22 } });
  const brandy = await prisma.menuCategory.create({ data: { name: "Brandy", position: 23 } });
  const aperitivos = await prisma.menuCategory.create({ data: { name: "Aperitivos", position: 24 } });
  const jarras = await prisma.menuCategory.create({ data: { name: "Jarras", position: 25 } });
  const digestivos = await prisma.menuCategory.create({ data: { name: "Digestivos y Cremas", position: 26 } });

  // ── COMIDA: Vinos ────────────────────────────
  const vinosBlancos = await prisma.menuCategory.create({ data: { name: "Vinos Blancos y Rosados", position: 27 } });
  const vinoTinto = await prisma.menuCategory.create({ data: { name: "Vino Tinto", position: 28 } });
  const vinosEspumosos = await prisma.menuCategory.create({ data: { name: "Vinos Espumosos", position: 29 } });

  // ── BRUNCH: Platos ───────────────────────────
  const plattiSalati = await prisma.menuCategory.create({ data: { name: "Platti Salati (Brunch)", position: 30 } });
  const toastsPanini = await prisma.menuCategory.create({ data: { name: "Toasts & Panini (Brunch)", position: 31 } });
  const omelettes = await prisma.menuCategory.create({ data: { name: "Omelettes (Brunch)", position: 32 } });
  const especiales = await prisma.menuCategory.create({ data: { name: "Especiales (Brunch)", position: 33 } });
  const panetteria = await prisma.menuCategory.create({ data: { name: "Panetteria & Dolci (Brunch)", position: 34 } });

  // ── BRUNCH: Bebidas ──────────────────────────
  const bCafeteria = await prisma.menuCategory.create({ data: { name: "Cafetería (Brunch)", position: 35 } });
  const bAlcohol = await prisma.menuCategory.create({ data: { name: "Alcohol (Brunch)", position: 36 } });
  const bJugos = await prisma.menuCategory.create({ data: { name: "Jugos & Malteadas (Brunch)", position: 37 } });

  console.log("✓ Categorías creadas");

  // ────────────────────────────────────────────
  // COMIDA
  // ────────────────────────────────────────────

  // ── ANTIPASTI ────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Polpo alla Griglia", description: "Pulpo macerado con una salsa de paprika cocido a las brasas, acompañado de papas al romero y aderezo tártara.", price: 375, categoryId: antipasti.id, position: 1 },
      { name: "Carpaccio di Salmone", description: "Finas láminas de salmón Ora King, con alcaparras, aceitunas y queso crema.", price: 455, categoryId: antipasti.id, position: 2 },
      { name: "Carpaccio di Manzo Wagyu", description: "Finas láminas de Ternera Cross Wagyu con vinagreta de balsámico, arúgula fresca y queso grana padano.", price: 455, categoryId: antipasti.id, position: 3 },
      { name: "Carpaccio di Tonno Aleta Blu", description: "Finas láminas de TORO de atún aleta azul con mezcla de alcaparras y aceitunas.", price: 395, categoryId: antipasti.id, position: 4 },
      { name: "Vitello Tonnato", description: "Finas láminas de Ternera Cross Wagyu cocinadas a fuego lento, con salsa de atún bonito del norte, anchoas y alcaparras.", price: 455, categoryId: antipasti.id, position: 5 },
      { name: "Carpaccio di Polpo", description: "Delicado pulpo finamente rebanado con aceite de oliva extra virgen, limón, reducción balsámica y parmesano rallado.", price: 375, categoryId: antipasti.id, position: 6 },
      { name: "Carpaccio di Totoaba al Tartufo", description: "Filete de totoaba de Ensenada, B.C., gratinado con salsa cremosa de trufa y queso parmesano.", price: 375, categoryId: antipasti.id, position: 7 },
      { name: "Polpo Fritti", description: "Pulpo frito acompañado de aderezo tártara y salsa arrabiata.", price: 375, categoryId: antipasti.id, position: 8 },
      { name: "Polpo all Aglio e Olio", description: "Pulpo en aceite de oliva con ajo y chile, acompañado de puré de papa.", price: 355, categoryId: antipasti.id, position: 9 },
      { name: "Calamari Fritti", description: "Calamares de Ensenada, B.C., ligeramente rebozados y fritos, con salsa arrabiata artesanal y aderezo tártara.", price: 275, categoryId: antipasti.id, position: 10 },
      { name: "Cozze alla Marinara", description: "Mejillones frescos de cultivo cocidos en salsa pomodoro San Marzano con ajo, perejil y peperoncino.", price: 275, categoryId: antipasti.id, position: 11 },
      { name: "Bruschette ai Carciofi e Formaggio", description: "Pan 100% artesanal elaborado en casa, tostado con alcachofas y mezcla de quesos.", price: 255, categoryId: antipasti.id, position: 12 },
      { name: "Provola al Forno", description: "Queso horneado con base de jitomate y pimiento rojo, con orégano y aceite de oliva.", price: 235, categoryId: antipasti.id, position: 13 },
      { name: "Melanzane alla Parmigiana", description: "Berenjenas gratinadas con queso y salsa de tomate, con ingredientes de denominación de origen.", price: 235, categoryId: antipasti.id, position: 14 },
      { name: "Bruschette Classiche", description: "Pan artesanal elaborado en casa, tostado con tomate fresco, ajo, albahaca y aceite de oliva extra virgen.", price: 235, categoryId: antipasti.id, position: 15 },
      { name: "Carciofo alla Brace", description: "Alcachofa acompañada de mostaza dijon y salsa de quesos.", price: 235, categoryId: antipasti.id, position: 16 },
      { name: "Asparagi Grigliati", description: "Espárragos gratinados a la leña.", price: 235, categoryId: antipasti.id, position: 17 },
    ]
  });

  // ── PASTE ────────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Linguine Arrabiata con Aragosta Rossa", description: "Colita de langosta roja de Ensenada horneada a la leña, servida sobre pasta larga y salsa arrabiata.", price: 990, categoryId: paste.id, position: 1 },
      { name: "Linguine Fra Diavola", description: "Linguini con pulpo, espinaca, espárragos, queso feta y camarones.", price: 395, categoryId: paste.id, position: 2 },
      { name: "Ravioli di Granchio Moro al Rose", description: "Ravioles rellenos de cangrejo moro en salsa cremosa de tomate y albahaca.", price: 335, categoryId: paste.id, position: 3 },
      { name: "Fettuccine Mare e Monti", description: "Camarones, mezcla de hongos y jamón serrano en salsa rose.", price: 355, categoryId: paste.id, position: 4 },
      { name: "Frutti di Mare (Pasta)", description: "Mezcla de mariscos del mar de Cortés.", price: 355, categoryId: paste.id, position: 5 },
      { name: "Lasagna di Wagyu", description: "Clásica lasagna con ragú de wagyu, salsa bechamel, quesos y pasta fresca.", price: 295, categoryId: paste.id, position: 6 },
      { name: "Aglio, Olio e Peperoncino nella Ruota Grana Padano", description: "Clásica pasta salteada en aceite de oliva, ajo y chile, finalizada en una rueda de Parmigiano Grana Padano.", price: 275, categoryId: paste.id, position: 7 },
      { name: "Alfredo nella Ruota di Grana Padano", description: "Pasta Alfredo preparada en una rueda de Grana Padano con salsa cremosa.", price: 275, categoryId: paste.id, position: 8 },
      { name: "Farfalle al Salmone", description: "Cremosa salsa de salmón Ora King con pasta corta.", price: 275, categoryId: paste.id, position: 9 },
      { name: "Canelloni di Carne", description: "Rollos de pasta fresca rellenos de salchicha italiana y gratinados con salsa cuatro quesos.", price: 275, categoryId: paste.id, position: 10 },
      { name: "Spaghetti al Ragù di Wagyu", description: "Pasta larga casera con ragú de carne Wagyu en salsa boloñesa.", price: 295, categoryId: paste.id, position: 11 },
      { name: "Gnocchi al Gorgonzola", description: "Ñoquis servidos con panceta, crema, calabacita, jitomate cherry y gorgonzola.", price: 275, categoryId: paste.id, position: 12 },
      { name: "Fettuccine ai Quattro Formaggi", description: "Pasta con salsa cremosa de cuatro quesos italianos.", price: 275, categoryId: paste.id, position: 13 },
      { name: "Spaghetti al Pesto Genovese", description: "Clásica salsa de albahaca, piñones y parmesano.", price: 275, categoryId: paste.id, position: 14 },
      { name: "Penne Puttanesca", description: "Con mezcla de aceitunas, anchoas, alcaparras y salsa pomodoro.", price: 275, categoryId: paste.id, position: 15 },
      { name: "Penne Arrabbiata", description: "Pasta corta con salsa pomodoro ligeramente picante.", price: 275, categoryId: paste.id, position: 16 },
      { name: "Capellini al Tartufo", description: "Con mezcla de hongos silvestres, perfume de trufa y doble mantequilla.", price: 296, categoryId: paste.id, position: 17 },
      { name: "Carbonara con Guanciale", description: "Pasta carbonara con guanciale, queso pecorino y huevo.", price: 296, categoryId: paste.id, position: 18 },
      { name: "Ravioli ai Quattro Formaggi", description: "Pasta fresca rellena de queso ricotta y espinaca, con salsa de quesos selectos.", price: 275, categoryId: paste.id, position: 19 },
      { name: "Canelloni di Ricotta", description: "Rollos de pasta fresca rellenos de queso ricotta, parmesano y espinacas, horneados y gratinados al pomodoro.", price: 275, categoryId: paste.id, position: 20 },
    ]
  });

  // ── PIZZA ────────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Frutti di Mare (Pizza)", description: "Frutos del mar: mejillones, calamares, camarones, pulpo y almeja chione.", price: 355, categoryId: pizza.id, position: 1 },
      { name: "Gamberi", description: "Camarón, pancetta, pesto y queso.", price: 335, categoryId: pizza.id, position: 2 },
      { name: "Diavola", description: "Salame calabrés, salame toscano y jamón serrano.", price: 335, categoryId: pizza.id, position: 3 },
      { name: "Francescana", description: "Ricotta, queso crema, manzana y jamón serrano.", price: 335, categoryId: pizza.id, position: 4 },
      { name: "Fichi e Prosciutto", description: "Jamón serrano, higo y queso camembert.", price: 335, categoryId: pizza.id, position: 5 },
      { name: "Capricciosa", description: "Salsa de tomate, mozzarella, jamón serrano, hongos, alcachofa y aceitunas.", price: 335, categoryId: pizza.id, position: 6 },
      { name: "Medici", description: "Salsa de tomate, mozzarella, arúgula, jamón serrano y jitomates cherry.", price: 335, categoryId: pizza.id, position: 7 },
      { name: "Insaccati", description: "Jamón, salame y pepperoni.", price: 275, categoryId: pizza.id, position: 8 },
      { name: "Bianca", description: "Mezcla de quesos italianos.", price: 275, categoryId: pizza.id, position: 9 },
      { name: "Salsiccia e Pancetta", description: "Salchicha italiana, pancetta y mezcla de quesos.", price: 275, categoryId: pizza.id, position: 10 },
      { name: "Pera e Gorgonzola", description: "Pera, gorgonzola, espinaca frita, nuez y miel.", price: 275, categoryId: pizza.id, position: 11 },
      { name: "Mortadella e Pistacchio", description: "Mortadella, arúgula y parmesano.", price: 275, categoryId: pizza.id, position: 12 },
      { name: "Margherita", description: "Salsa de tomate, mozzarella y albahaca fresca.", price: 255, categoryId: pizza.id, position: 13 },
      { name: "Pepperoni", description: "Salsa de tomate, mozzarella y pepperoni.", price: 255, categoryId: pizza.id, position: 14 },
      { name: "Regina", description: "Salsa de tomate, mozzarella, champiñones y jamón.", price: 255, categoryId: pizza.id, position: 15 },
    ]
  });

  // ── RISOTTO ──────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Risotto alla Milanese", description: "Risotto elaborado con Chambarete (Wagyu), azafrán y queso Parmigiano.", price: 455, categoryId: risotto.id, position: 1 },
      { name: "Risotto ai Tartufo", description: "Risotto con salsa de trufa negra finalizado con aceite de trufa blanca.", price: 375, categoryId: risotto.id, position: 2 },
      { name: "Risotto ai Frutti di Mare", description: "Risotto con selección de mariscos frescos y un toque de vino blanco.", price: 335, categoryId: risotto.id, position: 3 },
      { name: "Risotto ai Gamberi e Limone", description: "Risotto con camarones y ralladura de limón.", price: 335, categoryId: risotto.id, position: 4 },
      { name: "Risotto al Grana Padano", description: "Risotto con Grana Padano como ingrediente principal, mantecado en la rueda.", price: 275, categoryId: risotto.id, position: 5 },
    ]
  });

  // ── INSALATE ─────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Insalate di Tonno", description: "Mezcla de lechugas con atún bonito del norte, jitomate, aguacate, alcachofa, aceitunas y vinagreta balsámica.", price: 335, categoryId: insalate.id, position: 1 },
      { name: "Fichi e Prosciutto (Ensalada)", description: "Mezcla de lechugas, jamón serrano, mermelada de higo y burrata.", price: 295, categoryId: insalate.id, position: 2 },
      { name: "Cestino di Parmigiano", description: "Cesta de parmesano crocante rellena de arúgula, pera y nuez caramelizada con citroneta de limón real.", price: 275, categoryId: insalate.id, position: 3 },
      { name: "Arcobaleno", description: "Mezcla de lechugas con frutas de temporada y citroneta de limón real.", price: 255, categoryId: insalate.id, position: 4 },
      { name: "Fragola, Capra e Grana", description: "Mezcla de lechugas con fresas maceradas en balsámico, queso de cabra y queso grana.", price: 255, categoryId: insalate.id, position: 5 },
      { name: "Caprese", description: "Tomate, mozzarella de búfala y albahaca con aceite de oliva y vinagre balsámico.", price: 209, categoryId: insalate.id, position: 6 },
      { name: "Mediterranea", description: "Mezcla de lechugas, corazones de alcachofa, jitomate, aceitunas y vinagreta de balsámico.", price: 209, categoryId: insalate.id, position: 7 },
    ]
  });

  // ── CARNE WAGYU ──────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Rib Eye", description: "Acompañado de papas al romero y ensalada mixta.", price: 437, categoryId: carneWagyu.id, position: 1 },
      { name: "New York", description: "Acompañado de papas al romero y ensalada mixta.", price: 409, categoryId: carneWagyu.id, position: 2 },
      { name: "Picanha", description: "Acompañado de papas al romero y ensalada mixta.", price: 272, categoryId: carneWagyu.id, position: 3 },
      { name: "Arrachera", description: "Acompañado de papas al romero y ensalada mixta.", price: 173, categoryId: carneWagyu.id, position: 4 },
    ]
  });

  // ── TERRA ────────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Filetto ai Funghi", description: "Medallones de res Wagyu en salsa de trufa negra, servidos sobre papas al parmesano Grana Padano.", price: 750, categoryId: terra.id, position: 1 },
      { name: "Costata del Nonno", description: "Costilla de res Wagyu cocida a fuego lento durante 16 horas, servida sobre puré de papa y salsa de vino tinto.", price: 550, categoryId: terra.id, position: 2 },
      { name: "Brasato al Vino Rosso", description: "Brisket cocido lentamente en vino tinto, servido sobre puré de papas.", price: 550, categoryId: terra.id, position: 3 },
      { name: "Scaloppine di Maria", description: "Filete de res Wagyu cocinado al limón, con jamón serrano de denominación de origen y panceta frita.", price: 495, categoryId: terra.id, position: 4 },
      { name: "Cotoletta alla Napoletana", description: "Milanesa de res Wagyu gratinada con salsa pomodoro de tomates San Marzano y mozzarella importada.", price: 395, categoryId: terra.id, position: 5 },
      { name: "Petto di Pollo alla Boscaiola", description: "Pechuga de pollo con salsa cremosa de hongos silvestres y jamón serrano.", price: 275, categoryId: terra.id, position: 6 },
    ]
  });

  // ── PESCE DEL GIORNO ─────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Salmone Ora King alla Rosina", description: "Salmón Ora King cocido con vino blanco y azafrán, servido sobre risotto negro, almejas y mejillones.", price: 790, categoryId: pesce.id, position: 1 },
      { name: "Totoaba alla Livornese", description: "Totoaba fresca cocida en horno de piedra, bañada en salsa de pomodoro, vino blanco, almejas y mejillones de Ensenada, B.C.", price: 655, categoryId: pesce.id, position: 2 },
      { name: "Salmone Ora King al Vino Bianco", description: "Salmón Ora King cocido al vino blanco, con mezcla de vegetales frescos y papas al romero.", price: 595, categoryId: pesce.id, position: 3 },
      { name: "Tagliata di Ventresca di Tonno", description: "Corte de atún en salsa de frutos rojos sobre cama de arúgula, láminas de parmesano y reducción de balsámico.", price: 575, categoryId: pesce.id, position: 4 },
      { name: "Spigola al Limone", description: "Lubina fresca de Ensenada, B.C., cocida con salsa de limón real y vino blanco, servida sobre puré de papa.", price: 475, categoryId: pesce.id, position: 5 },
    ]
  });

  // ────────────────────────────────────────────
  // BEBIDAS
  // ────────────────────────────────────────────

  // ── CAFETERÍA ────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Expreso corto", description: "35 ml.", price: 56, categoryId: cafeteria.id, position: 1 },
      { name: "Expreso doble", description: "35 ml.", price: 85, categoryId: cafeteria.id, position: 2 },
      { name: "Americano", description: "200 ml.", price: 56, categoryId: cafeteria.id, position: 3 },
      { name: "Cappuccino (mocha, cereza, nuez, cajeta, vainilla)", description: "200 ml.", price: 77, categoryId: cafeteria.id, position: 4 },
      { name: "Frappuccino", description: "200 ml.", price: 77, categoryId: cafeteria.id, position: 5 },
      { name: "Malteada (fresa, chocolate o vainilla)", description: "200 ml.", price: 75, categoryId: cafeteria.id, position: 6 },
      { name: "Malteada de Ferrero", description: "200 ml.", price: 95, categoryId: cafeteria.id, position: 7 },
      { name: "Café irlandés", description: "185 ml.", price: 190, categoryId: cafeteria.id, position: 8 },
      { name: "Matcha", description: null, price: 75, categoryId: cafeteria.id, position: 9 },
      { name: "Matcha Preparado", description: null, price: 90, categoryId: cafeteria.id, position: 10 },
      { name: "Té chai", description: null, price: 65, categoryId: cafeteria.id, position: 11 },
      { name: "Chai Latte", description: null, price: 65, categoryId: cafeteria.id, position: 12 },
      { name: "Cappuccino con Baileys", description: "200 ml.", price: 135, categoryId: cafeteria.id, position: 13 },
      { name: "Cappuccino con Kahlúa", description: "200 ml.", price: 115, categoryId: cafeteria.id, position: 14 },
      { name: "Cappuccino Licor", description: "200 ml.", price: 145, categoryId: cafeteria.id, position: 15 },
      { name: "Cappuccino Amaretto", description: "200 ml.", price: 135, categoryId: cafeteria.id, position: 16 },
    ]
  });

  // ── CARAJILLOS ───────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Carajillo con Licor 43", description: null, price: 145, categoryId: carajillos.id, position: 1 },
      { name: "Carajillo de Amaretto", description: null, price: 155, categoryId: carajillos.id, position: 2 },
      { name: "Carajillo de Frangelico", description: null, price: 155, categoryId: carajillos.id, position: 3 },
      { name: "Carajillo de Kahlúa", description: null, price: 155, categoryId: carajillos.id, position: 4 },
      { name: "Carajillo de Baileys", description: null, price: 155, categoryId: carajillos.id, position: 5 },
      { name: "Carajillo de Ferrero Rocher", description: null, price: 190, categoryId: carajillos.id, position: 6 },
    ]
  });

  // ── CERVEZA ──────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Corona", description: "355 ml.", price: 52, categoryId: cerveza.id, position: 1 },
      { name: "Victoria", description: "355 ml.", price: 52, categoryId: cerveza.id, position: 2 },
      { name: "Modelo Especial", description: "355 ml.", price: 60, categoryId: cerveza.id, position: 3 },
      { name: "Negra Modelo", description: "355 ml.", price: 60, categoryId: cerveza.id, position: 4 },
      { name: "Stella Artois", description: "330 ml.", price: 65, categoryId: cerveza.id, position: 5 },
      { name: "Ultra", description: "355 ml.", price: 65, categoryId: cerveza.id, position: 6 },
      { name: "Gringa", description: null, price: 20, categoryId: cerveza.id, position: 7 },
      { name: "Chelada", description: null, price: 12, categoryId: cerveza.id, position: 8 },
      { name: "Michelada", description: null, price: 16, categoryId: cerveza.id, position: 9 },
    ]
  });

  // ── SIN ALCOHOL ──────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Refrescos (Coca-Cola, Coca-Zero, Coca-Light, Manzanita, Fanta, Sprite, Squirt)", description: "355 ml.", price: 40, categoryId: sinAlcohol.id, position: 1 },
      { name: "Naranjada", description: "330 ml.", price: 47, categoryId: sinAlcohol.id, position: 2 },
      { name: "Limonada", description: "330 ml.", price: 47, categoryId: sinAlcohol.id, position: 3 },
      { name: "Agua Panna natural", description: "200 ml.", price: 85, categoryId: sinAlcohol.id, position: 4 },
      { name: "Botellín de agua", description: "250 ml.", price: 35, categoryId: sinAlcohol.id, position: 5 },
      { name: "Agua mineral", description: "355 ml.", price: 45, categoryId: sinAlcohol.id, position: 6 },
      { name: "San Pellegrino", description: "250 ml.", price: 75, categoryId: sinAlcohol.id, position: 7 },
      { name: "Agua tónica", description: "300 ml.", price: 55, categoryId: sinAlcohol.id, position: 8 },
      { name: "Perrier", description: "255 ml.", price: 75, categoryId: sinAlcohol.id, position: 9 },
      { name: "Jarra de limonada mineral con frutos rojos", description: "2 L.", price: 195, categoryId: sinAlcohol.id, position: 10 },
      { name: "Rusa", description: "255 ml.", price: 45, categoryId: sinAlcohol.id, position: 11 },
      { name: "Jarra de agua del día", description: "2 L.", price: 165, categoryId: sinAlcohol.id, position: 12 },
      { name: "Clamato preparado", description: "355 ml.", price: 75, categoryId: sinAlcohol.id, position: 13 },
      { name: "Jarra de naranjada o limonada", description: "2 L.", price: 180, categoryId: sinAlcohol.id, position: 14 },
      { name: "Agua Panna", description: "255 ml.", price: 85, categoryId: sinAlcohol.id, position: 15 },
      { name: "Topo Chico", description: null, price: 55, categoryId: sinAlcohol.id, position: 16 },
    ]
  });

  // ── COCTELERÍA ───────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Copa de Clericot blanco con licor de melón", description: null, price: 135, categoryId: cocteleria.id, position: 1 },
      { name: "Copa de Clericot tinto", description: null, price: 135, categoryId: cocteleria.id, position: 2 },
      { name: "Sangría", description: null, price: 115, categoryId: cocteleria.id, position: 3 },
      { name: "Calimocho", description: null, price: 115, categoryId: cocteleria.id, position: 4 },
      { name: "Mezcalita", description: null, price: 115, categoryId: cocteleria.id, position: 5 },
      { name: "Margarita", description: null, price: 90, categoryId: cocteleria.id, position: 6 },
      { name: "Mojito de kiwi, frutos o fresa", description: null, price: 115, categoryId: cocteleria.id, position: 7 },
      { name: "Tequila Sunrise", description: null, price: 110, categoryId: cocteleria.id, position: 8 },
      { name: "Bloody Mary", description: null, price: 110, categoryId: cocteleria.id, position: 9 },
      { name: "Piña Colada", description: null, price: 95, categoryId: cocteleria.id, position: 10 },
      { name: "Pantera Rosa", description: null, price: 110, categoryId: cocteleria.id, position: 11 },
      { name: "Acapulco", description: null, price: 155, categoryId: cocteleria.id, position: 12 },
      { name: "Negroni", description: null, price: 160, categoryId: cocteleria.id, position: 13 },
      { name: "Aperol Spritz", description: null, price: 160, categoryId: cocteleria.id, position: 14 },
      { name: "Martini", description: null, price: 155, categoryId: cocteleria.id, position: 15 },
      { name: "Martini sucio", description: null, price: 165, categoryId: cocteleria.id, position: 16 },
      { name: "Cerveza (coctelería)", description: null, price: 115, categoryId: cocteleria.id, position: 17 },
      { name: "Garibaldi", description: null, price: 150, categoryId: cocteleria.id, position: 18 },
      { name: "Alfonso 13", description: null, price: 125, categoryId: cocteleria.id, position: 19 },
      { name: "Gin Tonic", description: null, price: 175, categoryId: cocteleria.id, position: 20 },
      { name: "Vodka Tonic (mandarina, sandía, extract, cítricos)", description: null, price: 160, categoryId: cocteleria.id, position: 21 },
      { name: "Expreso Martini", description: null, price: 178, categoryId: cocteleria.id, position: 22 },
      { name: "Bull", description: null, price: 120, categoryId: cocteleria.id, position: 23 },
      { name: "Mazmada", description: null, price: 125, categoryId: cocteleria.id, position: 24 },
      { name: "Germain Spritz", description: null, price: 255, categoryId: cocteleria.id, position: 25 },
      { name: "Moji Beer", description: null, price: 85, categoryId: cocteleria.id, position: 26 },
      { name: "Martini Pay limón", description: null, price: 190, categoryId: cocteleria.id, position: 27 },
      { name: "Tinto de Verano", description: null, price: 190, categoryId: cocteleria.id, position: 28 },
      { name: "Daiquiri", description: null, price: 105, categoryId: cocteleria.id, position: 29 },
      { name: "Cosmopolitan", description: null, price: 125, categoryId: cocteleria.id, position: 30 },
      { name: "Clericot Rosado", description: null, price: 135, categoryId: cocteleria.id, position: 31 },
    ]
  });

  // ── MOCTELERÍA ───────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Piñada", description: null, price: 75, categoryId: mocteleria.id, position: 1 },
      { name: "Fresada", description: null, price: 75, categoryId: mocteleria.id, position: 2 },
      { name: "Sodas italianas con fruta natural", description: null, price: 65, categoryId: mocteleria.id, position: 3 },
      { name: "Conga virgen", description: null, price: 75, categoryId: mocteleria.id, position: 4 },
      { name: "Mojito virgen (tradicional, frutos rojos, kiwi, mojito azul, fresa)", description: null, price: 65, categoryId: mocteleria.id, position: 5 },
      { name: "Frappé de frutas de temporada", description: null, price: 70, categoryId: mocteleria.id, position: 6 },
      { name: "Smoothie de yogur natural (frutos rojos con albahaca, limón con menta, pera con limón, cítricos con miel, choco menta, fresa con mango)", description: null, price: 75, categoryId: mocteleria.id, position: 7 },
    ]
  });

  // ── TEQUILA ──────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Herradura Reposado", description: "3 oz.", price: 195, categoryId: tequila.id, position: 1 },
      { name: "Herradura Plata", description: "3 oz.", price: 185, categoryId: tequila.id, position: 2 },
      { name: "Siete Leguas Blanco", description: "3 oz.", price: 180, categoryId: tequila.id, position: 3 },
      { name: "Herradura Antiguo Reposado", description: "3 oz.", price: 130, categoryId: tequila.id, position: 4 },
      { name: "Maestro Dobel Diamante", description: "3 oz.", price: 195, categoryId: tequila.id, position: 5 },
      { name: "Herradura Antigua Plata", description: "3 oz.", price: 135, categoryId: tequila.id, position: 6 },
      { name: "Antigua Cruz Añejo", description: "3 oz.", price: 190, categoryId: tequila.id, position: 7 },
      { name: "Centenario Plata", description: "3 oz.", price: 105, categoryId: tequila.id, position: 8 },
      { name: "Don Julio Reposado", description: "3 oz.", price: 185, categoryId: tequila.id, position: 9 },
      { name: "Centenario Reposado", description: "3 oz.", price: 115, categoryId: tequila.id, position: 10 },
      { name: "1800 Cristalino", description: "3 oz.", price: 175, categoryId: tequila.id, position: 11 },
      { name: "1800 Blanco", description: "3 oz.", price: 120, categoryId: tequila.id, position: 12 },
      { name: "Don Julio 70 Cristalino", description: "3 oz.", price: 210, categoryId: tequila.id, position: 13 },
      { name: "Don Julio Blanco", description: "3 oz.", price: 105, categoryId: tequila.id, position: 14 },
      { name: "Herradura Ultra", description: "3 oz.", price: 240, categoryId: tequila.id, position: 15 },
    ]
  });

  // ── RON ──────────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Bacardi Blanco", description: "3 oz.", price: 90, categoryId: ron.id, position: 1 },
      { name: "Bacardi (limón, mango, chile, raspberry)", description: "3 oz.", price: 105, categoryId: ron.id, position: 2 },
      { name: "Matusalén Gran Reserva", description: "3 oz.", price: 97, categoryId: ron.id, position: 3 },
      { name: "Habana Club 7", description: "3 oz.", price: 110, categoryId: ron.id, position: 4 },
      { name: "Zacapa 23", description: "3 oz.", price: 250, categoryId: ron.id, position: 5 },
    ]
  });

  // ── VODKA ────────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Smirnoff", description: "3 oz.", price: 80, categoryId: vodka.id, position: 1 },
      { name: "Smirnoff de Tamarindo", description: "3 oz.", price: 90, categoryId: vodka.id, position: 2 },
      { name: "Absolut (azul, extract, mandarín, citron, sandía)", description: "3 oz.", price: 130, categoryId: vodka.id, position: 3 },
    ]
  });

  // ── MEZCAL ───────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "400 Conejos", description: "3 oz.", price: 170, categoryId: mezcal.id, position: 1 },
      { name: "1000 Diablos", description: "3 oz.", price: 110, categoryId: mezcal.id, position: 2 },
      { name: "Monte Lobos", description: "3 oz.", price: 180, categoryId: mezcal.id, position: 3 },
    ]
  });

  // ── WHISKEY ──────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Etiqueta Roja", description: "3 oz.", price: 120, categoryId: whiskey.id, position: 1 },
      { name: "Jack Daniel's", description: "3 oz.", price: 165, categoryId: whiskey.id, position: 2 },
      { name: "Jack Daniel's Apple", description: "3 oz.", price: 170, categoryId: whiskey.id, position: 3 },
      { name: "Whisky Chivas 12", description: "3 oz.", price: 195, categoryId: whiskey.id, position: 4 },
      { name: "Etiqueta Negra", description: "3 oz.", price: 220, categoryId: whiskey.id, position: 5 },
      { name: "Bucanas Master", description: "3 oz.", price: 220, categoryId: whiskey.id, position: 6 },
      { name: "Bushmills 10", description: "3 oz.", price: 255, categoryId: whiskey.id, position: 7 },
      { name: "Bucanas 12", description: "3 oz.", price: 175, categoryId: whiskey.id, position: 8 },
      { name: "Bushmills Black", description: "3 oz.", price: 195, categoryId: whiskey.id, position: 9 },
    ]
  });

  // ── COÑAC ────────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Martel VS", description: "3 oz.", price: 230, categoryId: conac.id, position: 1 },
      { name: "Hennessy VSOP", description: "3 oz.", price: 290, categoryId: conac.id, position: 2 },
      { name: "Hennessy VS", description: "3 oz.", price: 240, categoryId: conac.id, position: 3 },
      { name: "Mortel VSOP", description: "3 oz.", price: 270, categoryId: conac.id, position: 4 },
    ]
  });

  // ── GINEBRAS ─────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Larios", description: "3 oz.", price: 90, categoryId: ginebras.id, position: 1 },
      { name: "Beefeater London (mora o fresa)", description: "3 oz.", price: 135, categoryId: ginebras.id, position: 2 },
      { name: "Gin Bombay", description: "3 oz.", price: 140, categoryId: ginebras.id, position: 3 },
      { name: "Gin Hendrick's", description: "3 oz.", price: 210, categoryId: ginebras.id, position: 4 },
      { name: "Gin Tanqueray Sevilla", description: "3 oz.", price: 210, categoryId: ginebras.id, position: 5 },
      { name: "Tanqueray", description: "3 oz.", price: 170, categoryId: ginebras.id, position: 6 },
    ]
  });

  // ── BRANDY ───────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Torres 5", description: "3 oz.", price: 95, categoryId: brandy.id, position: 1 },
      { name: "Torres 10", description: "3 oz.", price: 115, categoryId: brandy.id, position: 2 },
    ]
  });

  // ── APERITIVOS ───────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Aperol", description: "3 oz.", price: 120, categoryId: aperitivos.id, position: 1 },
      { name: "Martini Seco", description: "3 oz.", price: 135, categoryId: aperitivos.id, position: 2 },
      { name: "Cinzano Rosso", description: "3 oz.", price: 120, categoryId: aperitivos.id, position: 3 },
      { name: "Campari", description: "3 oz.", price: 130, categoryId: aperitivos.id, position: 4 },
    ]
  });

  // ── DIGESTIVOS Y CREMAS ──────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Kahlúa", description: "3 oz.", price: 85, categoryId: digestivos.id, position: 1 },
      { name: "Licor de melón", description: "3 oz.", price: 75, categoryId: digestivos.id, position: 2 },
      { name: "Frangelico", description: "3 oz.", price: 115, categoryId: digestivos.id, position: 3 },
      { name: "Chinchón dulce", description: "3 oz.", price: 120, categoryId: digestivos.id, position: 4 },
      { name: "Licor Strega", description: "3 oz.", price: 160, categoryId: digestivos.id, position: 5 },
      { name: "Jagermaster", description: "3 oz.", price: 140, categoryId: digestivos.id, position: 6 },
      { name: "Licor 43", description: "3 oz.", price: 135, categoryId: digestivos.id, position: 7 },
      { name: "Fernet Branca", description: "3 oz.", price: 90, categoryId: digestivos.id, position: 8 },
    ]
  });

  // ── JARRAS ───────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Jarra de Clericot 2L", description: null, price: 290, categoryId: jarras.id, position: 1 },
      { name: "Jarra de Sangría 2L", description: null, price: 270, categoryId: jarras.id, position: 2 },
      { name: "Jarra de Calimocho 2L", description: null, price: 265, categoryId: jarras.id, position: 3 },
    ]
  });

  // ────────────────────────────────────────────
  // POSTRES
  // ────────────────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Ispahan", description: "Combinación elegante de rosas, frambuesa y un toque fresco de lichi. Notas florales, acidez brillante de frambuesa y la jugosidad del lichi. Versión moderna del clásico de Pierre Hermé.", price: 355, categoryId: postres.id, position: 1 },
      { name: "Panna Cotta", description: "Clásico postre italiano a base de crema cocida, acompañado de coulis del día.", price: 215, categoryId: postres.id, position: 2 },
      { name: "Seadas Sarda", description: "Postre tradicional de Cerdeña: una empanada rellena de queso, frita y bañada en miel.", price: 215, categoryId: postres.id, position: 3 },
      { name: "Tiramisù", description: "Capas de bizcocho empapado en café, con una mezcla de mascarpone y cacao en polvo.", price: 215, categoryId: postres.id, position: 4 },
      { name: "Pera al Barolo con Gelato", description: "Pera cocida en vino tinto, servida con helado fiore di latte artesanal.", price: 215, categoryId: postres.id, position: 5 },
      { name: "Gelato de Coco", description: "Cremoso y tropical, hecho con coco natural. Acompañado de salsa fresca de maracuyá y coco tostado para un contraste ácido, crujiente y súper veraniego.", price: 215, categoryId: postres.id, position: 6 },
      { name: "Frutos Rojos con Vino Tinto", description: "Gelato intenso y afrutado con notas profundas de vino tinto, elaborado con gelatina de St-Germain, láminas de manzana-melón y un toque de nuez tostada.", price: 215, categoryId: postres.id, position: 7 },
      { name: "Frambuesa con Champaña", description: "Sorbete ligero y chispeante de frambuesa con champaña, cubitos de gelatina champaña, frambuesas maceradas y un crocante de almendra al limón que equilibra acidez y textura.", price: 215, categoryId: postres.id, position: 8 },
      { name: "Mandarina", description: "Sorbete brillante y aromático de mandarina fresca con un toque de zanahoria, palomitas de yogurt nitrogenadas y ralladura de lima. Una explosión cítrica y fresca.", price: 215, categoryId: postres.id, position: 9 },
      { name: "Vainilla Laminado de Chocolate 70%", description: "Gelato clásico de vainilla con aroma profundo, sobre cama de salsa de fresa, con láminas de chocolate oscuro, avellana tostada y un contraste espectacular.", price: 215, categoryId: postres.id, position: 10 },
    ]
  });

  // ────────────────────────────────────────────
  // VINOS
  // ────────────────────────────────────────────

  // ── VINOS BLANCOS Y ROSADOS ──────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Lupo Nero Blanco", description: "IGT Sicilia, Italia. Uvas: Grecanico, Cataratto, Inzolia. Vino blanco elegante y refrescante con notas cítricas, recuerdo a almendra y nueces.", price: 800, categoryId: vinosBlancos.id, position: 1, imageUrl: "/images/menu/vinos/VinosBlancosyRosados/Lupo Nero Blanco.png" },
      { name: "Pinot Grigio", description: "I.G.T. Venezie, Italia. Uva: 100% Pinot Grigio. En boca de agradable acidez y frescura. Notas de cítricos, piña, lima, pera y flores.", price: 940, categoryId: vinosBlancos.id, position: 2, imageUrl: "/images/menu/vinos/VinosBlancosyRosados/Pinot Grigio.png" },
      { name: "Roccaperciata Bianco", description: "Terre Siciliane IGT, Italia. Uvas: 50% Inzolia, 50% Chardonnay. Aromas de almendras, guanábana, piña, manzana, pera, romero y laurel.", price: 920, categoryId: vinosBlancos.id, position: 3 },
      { name: "Pinot Grigio Rosato", description: "Provincia di Pavia IGT, Lombardía. Uva: 100% Pinot Grigio. Fresco, de acidez en equilibrio. Aromas a cerezas frescas, granada, duraznos y manzana.", price: 950, categoryId: vinosBlancos.id, position: 4 },
      { name: "Illivia Rosado", description: "Salento IGT, Puglia, Italia. Uva: 100% Negroamaro. Aromas a grosellas, granada, fresas, cerezas y rosas.", price: 1050, categoryId: vinosBlancos.id, position: 5, imageUrl: "/images/menu/vinos/VinosBlancosyRosados/Illivia Rosado.png" },
      { name: "Scaia Blanco", description: "IGT Comune di Colognola Ai Colli. Uva: 55% Garganega – 45% Chardonnay. Fresco con notas frutales como naranja, toronja y recuerdos de minerales.", price: 1350, categoryId: vinosBlancos.id, position: 6, imageUrl: "/images/menu/vinos/VinosBlancosyRosados/Scaia Blanco.png" },
      { name: "Quater Vitis Blanco", description: "Terre Siciliane IGT, Italia. Uva: Inzolia, Catarratto, Carricante e Zibibbo. 6 meses sobre lías. Notas a guanábana, mango, guayaba, piña, flores de azahar, manzanilla, saúco, perejil y jengibre.", price: 1750, categoryId: vinosBlancos.id, position: 7 },
      { name: "Branciforti", description: "Agro di Trapani, Tenuta Celso Grande. Uva: 100% Cataratto. Intensamente fresco con notas de fruta tropical y herbáceas. Armónico con fina acidez y postgusto de frutas tropicales y miel.", price: 970, categoryId: vinosBlancos.id, position: 8 },
    ]
  });

  // ── VINO TINTO ───────────────────────────────
  await prisma.dish.createMany({
    data: [
      // Copa
      { name: "Copa Montepulciano", description: "3 oz.", price: 130, categoryId: vinoTinto.id, position: 1 },
      // Botellas
      { name: "Montepulciano D'Abruzzo DOC", description: "Montepulciano d'Abruzzo DOC, Abruzzo, Italia. Uva: 100% Montepulciano. Muy frutal con notas de cerezas, zarzamora y grosellas rojas. Pimienta negra, menta, laurel y vainilla.", price: 910, categoryId: vinoTinto.id, position: 5, imageUrl: "/images/menu/vinos/VinosTintos/Montepulciano D'Abruzzo DOC.png" },
      { name: "Ottobucce", description: "Piemonte. Uvas: Dolcetto, Barbera, Freisa, Bonarda, Albarossa, Merlot, Syrah y Cabernet Sauvignon. Intenso y armónico con agradables y delicadas notas de frutos rojos.", price: 1140, categoryId: vinoTinto.id, position: 6 },
      { name: "Illivia Negroamaro", description: "Salento IGT, Puglia, Italia. Uva: 100% Negroamaro. Muy frutal con notas de cerezas, zarzamora y grosellas rojas. Pimienta negra, menta, laurel y vainilla.", price: 1210, categoryId: vinoTinto.id, position: 7, imageUrl: "/images/menu/vinos/VinosTintos/Illivia Negroamaro.png" },
      { name: "Illivia Primitivo", description: "Salento IGT, Puglia, Italia. Uva: 100% Primitivo. Redondo y de gran cuerpo. Aromas de cerezas, frambuesas, ciruela, rosas, pimienta, laurel y notas de yogurt.", price: 1372, categoryId: vinoTinto.id, position: 8 },
      { name: "Roccaperciata Rosso", description: "Terre Siciliane IGT, Italia. Uvas: 50% Nero d'Avola, 50% Syrah. Las cerezas negras, ciruelas y grosellas negras ofrecen una marcada intensidad aromática adornada por violetas y suculentas notas lácticas.", price: 960, categoryId: vinoTinto.id, position: 9, imageUrl: "/images/menu/vinos/VinosTintos/Roccaperciata Rosso.png" },
      { name: "5 Vite", description: "DOC Puglia, Italia. Uvas: Primitivo y Susamaniello. Frutos rojos, ciruela y especias dulces. Elegante con postgusto largo.", price: 1450, categoryId: vinoTinto.id, position: 10, imageUrl: "/images/menu/vinos/VinosTintos/5 Vite.png" },
      { name: "Quater Vitis Rosso", description: "Terre Siciliane IGT, Italia. Uvas: Nero d'Avola, Perricone, Frappato e Nerello Cappuccio dell'Etna. Crianza de 10 meses. Aromas a grosellas, cerezas negras, higos, moras, arándanos, pimienta negra, coco tostado, vainilla y más.", price: 1750, categoryId: vinoTinto.id, position: 11, imageUrl: "/images/menu/vinos/VinosTintos/Quater Vitis Rosso.png" },
      { name: "Scaia Rosso", description: "IGT Comune di Colognola Ai Colli, Verona. Uva: 100% Corvina. Elegante, con buen cuerpo y postgusto mediamente largo. Notas florales, frutos del bosque, cereza y ciruela.", price: 1567, categoryId: vinoTinto.id, position: 12, imageUrl: "/images/menu/vinos/VinosTintos/Scaia Rosso.png" },
      { name: "Villa Santera", description: "Salice Salentino Riserva DOC, Puglia, Italia. Uva: 90% Negroamaro y 10% Malvasia Nera di Lecce. 12 meses de barrica de roble. Intensas notas de arándanos maduros, cerezas, albahaca, eneldo, orégano y eucalipto.", price: 1800, categoryId: vinoTinto.id, position: 13, imageUrl: "/images/menu/vinos/VinosTintos/Villa Santera.png" },
      { name: "Colpo di Zappa", description: "Salice Salentino DOC, Puglia, Italia. Uva: 100% Negroamaro. 12 meses en barrica de roble francés, 12 meses en botella. Sedoso y armónico con aromas de higos, moras, zarzamoras, ciruelas y grosellas negras maduras.", price: 2650, categoryId: vinoTinto.id, position: 14, imageUrl: "/images/menu/vinos/VinosTintos/Colpo di Zappa.png" },
      { name: "Amarone della Valpolicella", description: "DOCG Municipio di Mezzane di Sotto, Monte Garbi, Verona. Uvas: 70% Corvina y Corvinone, 20% Rondinella, 5% Croatina, 5% Oseleta. Apasimento de las uvas por 3 meses.", price: 3600, categoryId: vinoTinto.id, position: 15, imageUrl: "/images/menu/vinos/VinosTintos/Amarone della Valpolicella.png" },
      { name: "Pingus PSI", description: "DO Ribera del Duero, España. Uva: Tempranillo 90%, Garnacha 10%. Vino expresivo con elegantes tonos florales, matices de hierbas silvestres, especias y fruta roja. Sabroso y fácil de beber, con un final largo y agradable.", price: 3362, categoryId: vinoTinto.id, position: 16 },
      { name: "Marqués de Riscal Reserva Especial XR", description: "DOC Rioja, España. Uva: Tempranillo, Graciano. 26 meses de barrica. Muy expresivo en nariz con notas de regaliz, canela y pimienta negra.", price: 2290, categoryId: vinoTinto.id, position: 17, imageUrl: "/images/menu/vinos/VinosTintos/Marqués de Riscal Reserva Especial XR.png" },
      { name: "Luna del Valle Luz", description: "Valle de Guadalupe. Uva: Tempranillo. 8 meses de barrica. Suave, cuerpo medio alto, bien equilibrado y de larga permanencia. Frutos rojos y negros como ciruela, cereza, zarzamora y frambuesa.", price: 1945, categoryId: vinoTinto.id, position: 18 },
      { name: "Viña Secreta Malbec", description: "Aguascalientes. Uva: Malbec. Ciruela mora, vainilla, clavo y tabaco dulce. Taninos maduros, cuerpo medio-alto y textura jugosa.", price: 890, categoryId: vinoTinto.id, position: 19 },
      { name: "Les Légendes R Rouge", description: "Bordeaux, Francia. Uva: Cabernet Sauvignon y Merlot. 9 meses de crianza en barrica. Intenso y muy expresivo, dominado por aromas de fruta fresca como la grosella roja y la frambuesa.", price: 1450, categoryId: vinoTinto.id, position: 20, imageUrl: "/images/menu/vinos/VinosTintos/Les Légendes R Rouge.png" },
      { name: "Zuccardi Serie Q", description: "Valle de Uco, Argentina. Uva: 100% Malbec. 12 meses en barrica de roble francés. Complejo aroma de frutos secos maduros, ciruelas, higos y cassis con notas sutiles de tabaco, vainilla y pimienta negra.", price: 2242, categoryId: vinoTinto.id, position: 21, imageUrl: "/images/menu/vinos/VinosTintos/Zuccardi Serie Q.png" },
    ]
  });

  // ── VINOS ESPUMOSOS ──────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Lambrusco Antiche Tradizione", description: "Emilia Romagna, Italia. Uva: Lambrusco. Intensamente afrutado, fresa, cereza y rutilla roja. Amable, fresco y de buena acidez en boca.", price: 810, categoryId: vinosEspumosos.id, position: 1 },
      { name: "Flumen Prosecco", description: "DOC Pramaggiore, Italia. Uva: 100% Glera. Aromas a flores blancas, acacia, melocotón y manzana verde. Fragante y sabroso, con una aterciopelada persistencia.", price: 1040, categoryId: vinosEspumosos.id, position: 2, imageUrl: "/images/menu/vinos/VinosEspumosos/Flumen Prosecco.png" },
    ]
  });

  // ────────────────────────────────────────────
  // BRUNCH
  // ────────────────────────────────────────────

  // ── PIATTI SALATI ────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Huevos rotos (estilo español)", description: "Papas fritas con huevo y jamón serrano.", price: 252, categoryId: plattiSalati.id, position: 1, imageUrl: "/images/menu/brunch/Alimentos/huevos-rotos.jpg" },
      { name: "Uova alla Benedict", description: "Huevos benedictinos clásicos con salsa holandesa.", price: 252, categoryId: plattiSalati.id, position: 2, imageUrl: "/images/menu/brunch/Alimentos/uova-alla-benedict.jpg" },
      { name: "Uova alla Milanese", description: "Huevos ponchados con espárragos, pancetta y queso mozzarella.", price: 255, categoryId: plattiSalati.id, position: 3 },
      { name: "Tortilla española", description: "Huevos horneados con papa y cebolla.", price: 199, categoryId: plattiSalati.id, position: 4, imageUrl: "/images/menu/brunch/Alimentos/tortilla-espanola.jpg" },
      { name: "Molletes", description: "Con jamón y queso, acompañados de pico de gallo y emulsión de aguacate.", price: 155, categoryId: plattiSalati.id, position: 5, imageUrl: "/images/menu/brunch/Alimentos/molletes.jpg" },
      { name: "Chilaquiles negros", description: "Con huevo (2pz) $225 · Con pollo 100g $235 · Con arrachera Cross Wagyu 100g $295.", price: 179, categoryId: plattiSalati.id, position: 6, imageUrl: "/images/menu/brunch/Alimentos/chilaquiles-negros.jpg" },
    ]
  });

  // ── TOASTS & PANINI ──────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Toast prosciutto e formaggio", description: "Tost de jamón de pierna y queso fundido.", price: 155, categoryId: toastsPanini.id, position: 1 },
      { name: "Toast de atún bonito del norte (Reserva de la Familia)", description: "Con aguacate y aderezo tártara.", price: 255, categoryId: toastsPanini.id, position: 2 },
      { name: "Pepito di arrachera", description: "Sándwich de arrachera elaborada con Cross Wagyu Americano, emulsión de aguacate, frijoles refritos y queso asadero gratinado.", price: 252, categoryId: toastsPanini.id, position: 3, imageUrl: "/images/menu/brunch/Alimentos/pepito-di-arrachera.jpg" },
      { name: "Panino di roast beef di picanha", description: "Panini de roast beef de picaña Cross Wagyu Americano, horneado con mostaza Dijon, vino blanco y finas hierbas.", price: 275, categoryId: toastsPanini.id, position: 4 },
      { name: "Panino di porchetta", description: "Panini de porchetta, cerdo asado lentamente con hierbas aromáticas y especias mediterráneas, acompañado de mostaza Dijon.", price: 252, categoryId: toastsPanini.id, position: 5 },
      { name: "Panini de pulpo a las brasas", description: "Con aderezo tártara.", price: 295, categoryId: toastsPanini.id, position: 6 },
      { name: "Mozzarella in carrozza", description: "Sándwich de mozzarella frito acompañado de salsa pomodoro.", price: 228, categoryId: toastsPanini.id, position: 7, imageUrl: "/images/menu/brunch/Alimentos/mozzarella-in-carrozza.jpg" },
      { name: "Croque Madame", description: "Pan brioche, jamón artesanal, bechamel y huevo estrellado.", price: 255, categoryId: toastsPanini.id, position: 8, imageUrl: "/images/menu/brunch/Alimentos/croque-madame.jpg" },
    ]
  });

  // ── OMELETTES ────────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Omelette de queso con jamón", description: null, price: 225, categoryId: omelettes.id, position: 1 },
      { name: "Omelette de queso con hongos silvestres", description: null, price: 255, categoryId: omelettes.id, position: 2 },
      { name: "Omelette de salmón Oraking y queso crema", description: null, price: 335, categoryId: omelettes.id, position: 3 },
      { name: "Omelette cuatro quesos", description: "Mozzarella, provolone, parmesano y gorgonzola sobre salsa cremosa.", price: 275, categoryId: omelettes.id, position: 4 },
      { name: "Omelette light de claras con espinacas", description: null, price: 235, categoryId: omelettes.id, position: 5 },
    ]
  });

  // ── ESPECIALES ───────────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Lasagna de crepas", description: "Crepas a la bolognesa de Cross Wagyu.", price: 255, categoryId: especiales.id, position: 1 },
      { name: "Crepes di ricotta e spinaci gratinate ai quattro formaggi", description: "Crepas rellenas de ricotta y espinaca en salsa de cuatro quesos.", price: 215, categoryId: especiales.id, position: 2 },
      { name: "Polpette al sugo", description: "Albóndigas de res elaboradas con Cross Wagyu Americano en salsa de jitomate.", price: 255, categoryId: especiales.id, position: 3 },
      { name: "Brioche di brisket en salsa gravy", description: "Brioche de brisket Cross Wagyu Americano sobre emulsión de aguacate y huevo poché.", price: 252, categoryId: especiales.id, position: 4 },
      { name: "Focaccia ripiena e stracciatella", description: "Focaccia rellena de mortadela, mousse de pistache y queso stracciatella.", price: 252, categoryId: especiales.id, position: 5 },
      { name: "Crostoni casarecci", description: "Pan de masa madre con jitomate, mozzarella y jamón serrano.", price: 350, categoryId: especiales.id, position: 6 },
      { name: "Bagel con salmone Oraking e formaggio cremoso", description: "Bagel de salmón Oraking con queso crema.", price: 225, categoryId: especiales.id, position: 7 },
    ]
  });

  // ── PANETTERIA & DOLCI ───────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Pan francés con helado de mantequilla", description: null, price: 225, categoryId: panetteria.id, position: 1 },
      { name: "Affogato al Gelato", description: "Helado artesanal bañado en espresso (preguntar sabores).", price: 179, categoryId: panetteria.id, position: 2 },
      { name: "Hot Cakes", description: "Esponjosos hot cakes bañados de cajeta con mantequilla y maple.", price: 155, categoryId: panetteria.id, position: 3 },
      { name: "Crepas de cajeta", description: null, price: 155, categoryId: panetteria.id, position: 4 },
      { name: "Crepas de cajeta con gelato extra", description: null, price: 215, categoryId: panetteria.id, position: 5 },
    ]
  });

  // ── BRUNCH: CAFETERÍA ────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Espresso / Americano / Latte / Cappuccino", description: null, price: 56, categoryId: bCafeteria.id, position: 1 },
      { name: "Carajillo clásico (espresso + Licor 43)", description: null, price: 157, categoryId: bCafeteria.id, position: 2 },
      { name: "Carajillo con gelato artesanal", description: null, price: 195, categoryId: bCafeteria.id, position: 3 },
      { name: "Espresso Martini", description: null, price: 181, categoryId: bCafeteria.id, position: 4 },
    ]
  });

  // ── BRUNCH: ALCOHOL ──────────────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Mimosa", description: "Espumoso + jugo de naranja", price: 144, categoryId: bAlcohol.id, position: 1 },
      { name: "Bellini", description: "Espumoso + puré de durazno", price: 144, categoryId: bAlcohol.id, position: 2 },
      { name: "Spritz San Luca", description: "Aperol + prosecco + soda", price: 169, categoryId: bAlcohol.id, position: 3 },
      { name: "Bloody Mary", description: "Vodka + jugo de tomate + especias", price: 169, categoryId: bAlcohol.id, position: 4 },
      { name: "Negroni clásico", description: null, price: 181, categoryId: bAlcohol.id, position: 5 },
    ]
  });

  // ── BRUNCH: JUGOS & MALTEADAS ─────────────────
  await prisma.dish.createMany({
    data: [
      { name: "Jugos naturales de temporada", description: null, price: 69, categoryId: bJugos.id, position: 1 },
      { name: "Malteadas con fruta de temporada", description: null, price: 94, categoryId: bJugos.id, position: 2 },
    ]
  });

  console.log("✓ Seed completo: 37 categorías, 230+ platillos y bebidas");

  // ────────────────────────────────────────────
  // SECCIONES Y MESAS
  // ────────────────────────────────────────────
  const salonSec = await prisma.section.upsert({
    where: { name: "Salón" },
    update: {},
    create: { name: "Salón" },
  });
  const terrazaSec = await prisma.section.upsert({
    where: { name: "Terraza" },
    update: {},
    create: { name: "Terraza" },
  });
  const plantaAltaSec = await prisma.section.upsert({
    where: { name: "Planta Alta" },
    update: {},
    create: { name: "Planta Alta" },
  });
  const privadoSec = await prisma.section.upsert({
    where: { name: "Privado" },
    update: {},
    create: { name: "Privado" },
  });

  // Salón: M1–M8
  for (const t of [
    { number: 1, capacity: 3 },
    { number: 2, capacity: 2 },
    { number: 3, capacity: 4 },
    { number: 4, capacity: 6 },
    { number: 5, capacity: 4 },
    { number: 6, capacity: 4 },
    { number: 7, capacity: 6 },
    { number: 8, capacity: 4 },
  ]) {
    await prisma.table.upsert({
      where: { number_sectionId: { number: t.number, sectionId: salonSec.id } },
      update: { capacity: t.capacity },
      create: { number: t.number, capacity: t.capacity, sectionId: salonSec.id },
    });
  }

  // Terraza: M10–M18
  for (const t of [
    { number: 10, capacity: 4 },
    { number: 11, capacity: 4 },
    { number: 12, capacity: 2 },
    { number: 13, capacity: 4 },
    { number: 14, capacity: 2 },
    { number: 15, capacity: 4 },
    { number: 16, capacity: 4 },
    { number: 17, capacity: 4 },
    { number: 18, capacity: 4 },
  ]) {
    await prisma.table.upsert({
      where: { number_sectionId: { number: t.number, sectionId: terrazaSec.id } },
      update: { capacity: t.capacity },
      create: { number: t.number, capacity: t.capacity, sectionId: terrazaSec.id },
    });
  }

  // Planta Alta: M20–M25
  for (const t of [
    { number: 20, capacity: 4 },
    { number: 21, capacity: 4 },
    { number: 22, capacity: 4 },
    { number: 23, capacity: 4 },
    { number: 24, capacity: 4 },
    { number: 25, capacity: 4 },
  ]) {
    await prisma.table.upsert({
      where: { number_sectionId: { number: t.number, sectionId: plantaAltaSec.id } },
      update: { capacity: t.capacity },
      create: { number: t.number, capacity: t.capacity, sectionId: plantaAltaSec.id },
    });
  }

  // Privado: 1 mesa de 8
  await prisma.table.upsert({
    where: { number_sectionId: { number: 1, sectionId: privadoSec.id } },
    update: { capacity: 8 },
    create: { number: 1, capacity: 8, sectionId: privadoSec.id },
  });

  console.log("✓ Secciones y mesas creadas (Salón, Terraza, Planta Alta, Privado)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
