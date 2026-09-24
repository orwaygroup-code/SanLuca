// ─────────────────────────────────────────────
//  config/menuStructure.ts
//  Estructura estática del menú San Luca
// ─────────────────────────────────────────────

export type MenuSection = "comida" | "brunch";

export type MenuCategory = {
    slug: string;
    name: string;
    nameIt?: string;
    description?: string;
    imageUrl?: string;
};

export type MenuGroup = {
    slug: string;
    groupName: string;
    groupSubtitle?: string;
    categories: MenuCategory[];
};

// ─── MENÚ COMIDA ─────────────────────────────

export const COMIDA_GROUPS: MenuGroup[] = [
    {
        slug: "clasica",
        groupName: "Clásica",
        groupSubtitle: "La tradición italiana en su máxima expresión",
        categories: [
            {
                slug: "carpacci",
                name: "Carpacci",
                description: "Carpaccios finos de la casa",
            },
            {
                slug: "forno",
                name: "Forno",
                description: "Especialidades al horno",
            },
            {
                slug: "tartar",
                name: "Tartar",
                description: "Tártaros de la casa",
            },
            {
                slug: "fritti",
                name: "Fritti",
                description: "Fritos crujientes",
            },
            {
                slug: "insalate",
                name: "Insalate",
                description: "Ensaladas frescas de temporada",
                imageUrl: "/images/menu/clasica/ensalada.png",
            },
            {
                slug: "cortes",
                name: "Cortes",
                description: "Cortes premium de wagyu selecto",
            },
            {
                slug: "terra",
                name: "Terra",
                description: "Sabores de la tierra",
                imageUrl: "/images/menu/clasica/terra.png",
            },
            {
                slug: "brasati-al-vino-rosso",
                name: "Brasati al Vino Rosso",
                description: "Braseados al vino tinto",
            },
            {
                slug: "pizza",
                name: "Pizza",
                description: "Horneadas en horno de leña",
                imageUrl: "/images/menu/clasica/pizza.png",
            },
            {
                slug: "risotto",
                name: "Risotto",
                description: "Cremoso y perfectamente cocido",
                imageUrl: "/images/menu/clasica/risoto.png",
            },
            {
                slug: "pesce-del-giorno",
                name: "Pesce Del Giorno",
                description: "Pescado fresco del día",
                imageUrl: "/images/menu/clasica/pesce.png",
            },
            {
                slug: "paste",
                name: "Paste",
                description: "Pastas artesanales al dente",
                imageUrl: "/images/menu/clasica/paste.png",
            },
        ],
    },
    {
        slug: "bebidas",
        groupName: "Bebidas",
        groupSubtitle: "Selección de bebidas premium",
        categories: [
            {
                slug: "cafeteria",
                name: "Cafetería",
                description: "Espressos y preparaciones de café",
            },
            {
                slug: "sin-alcohol",
                name: "Sin Alcohol",
                description: "Bebidas sin alcohol",
                imageUrl: "/images/menu/bebidas/sin alc.png",
            },
            {
                slug: "carajillos",
                name: "Carajillos",
                description: "La especialidad de la casa",
                imageUrl: "/images/menu/bebidas/carajillos.png",
            },
            {
                slug: "cerveza",
                name: "Cerveza",
                description: "Nacionales e importadas",
                imageUrl: "/images/menu/bebidas/cerveza.png",
            },
            {
                slug: "cocteleria",
                name: "Coctelería",
                description: "Cócteles artesanales",
                imageUrl: "/images/menu/bebidas/cocteleria.png",
            },
            {
                slug: "mocteleria",
                name: "Moctelería",
                description: "Cócteles sin alcohol",
            },
        ],
    },
    {
        slug: "postres",
        groupName: "Postres",
        groupSubtitle: "Dolce",
        categories: [
            {
                slug: "postres",
                name: "Postres",
                nameIt: "Dolce",
                description: "Los mejores postres italianos",
                imageUrl: "/images/menu/Postres/postre.png",
            },
        ],
    },
    {
        slug: "destilados",
        groupName: "Destilados",
        groupSubtitle: "Gran selección de espirituosos",
        categories: [
            { slug: "tequila", name: "Tequila" },
            { slug: "ron", name: "Ron" },
            { slug: "vodka", name: "Vodka" },
            { slug: "mezcal", name: "Mezcal" },
            { slug: "whiskey", name: "Whiskey" },
            { slug: "conac", name: "Coñac" },
            { slug: "ginebras", name: "Ginebras" },
            { slug: "brandy", name: "Brandy" },
            { slug: "aperitivos", name: "Aperitivos" },
            { slug: "jarras", name: "Jarras" },
            { slug: "digestivos-cremas", name: "Digestivos y Cremas" },
        ],
    },
    {
        slug: "vinos",
        groupName: "Vinos",
        groupSubtitle: "Cava seleccionada",
        categories: [
            {
                slug: "vinos-blancos-rosados",
                name: "Vinos Blancos y Rosados",
            },
            { slug: "vino-tinto", name: "Vino Tinto" },
            { slug: "vinos-espumosos", name: "Vinos Espumosos" },
            { slug: "copeos", name: "Copeos" },
        ],
    },
];

// ─── BRUNCH ──────────────────────────────────

export const BRUNCH_GROUPS: MenuGroup[] = [
    {
        slug: "brunch-platos",
        groupName: "Brunch",
        groupSubtitle: "El mejor brunch de la ciudad",
        categories: [
            {
                slug: "antojitos",
                name: "Antojitos",
                description: "Antojitos mexicanos del brunch",
            },
            {
                slug: "huevos",
                name: "Huevos",
                description: "Huevos preparados al gusto",
            },
            {
                slug: "dulces",
                name: "Dulces",
                description: "Dulces y postres del brunch",
            },
        ],
    },
    {
        slug: "brunch-bebidas",
        groupName: "Bebidas",
        groupSubtitle: "",
        categories: [
            {
                slug: "cafeteria-brunch",
                name: "Cafetería",
                description: "Café de especialidad",
            },
            {
                slug: "alcohol-brunch",
                name: "Alcohol",
                description: "Bebidas alcohólicas",
            },
            {
                slug: "jugos-malteadas",
                name: "Jugos & Malteadas",
                description: "Jugos naturales y malteadas",
            },
        ],
    },
];