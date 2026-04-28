const es = {
  // ── NAVBAR ─────────────────────────────────────
  nav: {
    philosophy: "Filosofía",
    menu:       "Menú",
    history:    "Historia",
    reserve:    "Reservar",
    contact:    "Contacto",
    login:      "Iniciar Sesión",
    register:   "Registrar",
    myReservations: "Mis Reservas",
    logout:     "Salir",
    greeting:   "Hola",
  },

  // ── HERO ───────────────────────────────────────
  hero: {
    eyebrow: "Cocina de Autor · Coatzacoalcos",
    title:   "Una experiencia\ngastronómica única",
    subtitle:"Reserva tu mesa y descubre los sabores que nos definen.",
    cta:     "Reservar Mesa",
    ctaSecondary: "Ver Menú",
  },

  // ── FILOSOFÍA / PHILOSOPHY ─────────────────────
  philosophy: {
    eyebrow: "Filosofía",
    title:   "El arte de cocinar con propósito",
    body:    "Cada platillo es un homenaje a los ingredientes locales, las técnicas tradicionales y la creatividad que define nuestra cocina.",
  },

  // ── ORIGIN / HISTORIA ──────────────────────────
  origin: {
    eyebrow: "Nuestra Historia",
    title:   "Donde nació San Luca",
    body:    "Una visión, una pasión y un compromiso con la excelencia culinaria que se siente en cada bocado.",
  },

  // ── EXPERIENCIA ────────────────────────────────
  experience: {
    eyebrow: "Experiencia",
    title:   "Más que una cena",
    body:    "Te invitamos a vivir momentos memorables en un ambiente cálido, elegante y lleno de detalles.",
  },

  // ── FEATURED MENU ──────────────────────────────
  featuredMenu: {
    eyebrow: "Nuestro Menú",
    title:   "Sabores que cuentan historias",
    cta:     "Ver menú completo",
  },

  // ── FOOTER ─────────────────────────────────────
  footer: {
    address: "Coatzacoalcos, Veracruz",
    hours:   "Horario",
    hoursValue: "Mar – Dom · 8:00 – 23:00",
    social:  "Síguenos",
    rights:  "Todos los derechos reservados",
    sections: {
      explore: "Explora",
      visit:   "Visítanos",
      reserve: "Reservar",
    },
    contactTitle: "Contacto",
    schedule: [
      "Lunes: Cerrado",
      "Mar–Jue: 8:00–23:00",
      "Vie–Sáb: 8:00–00:00",
      "Dom: 8:00–21:00",
    ],
    developedBy: "Desarrollado por OrwayGroup",
  },

  // ── RESERVATION FORM ──────────────────────────
  reservation: {
    title:        "Reservar Mesa",
    subtitle:     "Tu mejor experiencia culinaria",
    formTitle:    "Crea tu Reserva",
    formSubtitle: "Tu reservación desde tu móvil",
    name:         "Nombre",
    namePlaceholder: "Ej. María González",
    phone:        "Número celular",
    phonePlaceholder: "55 0000 0000",
    date:         "Fecha",
    datePlaceholder: "Selecciona fecha",
    time:         "Hora",
    timePlaceholder: "Selecciona hora",
    timeDisabled:    "Elige fecha primero",
    closedMonday:    "Los lunes estamos cerrados.",
    guests:       "Personas",
    largeGroupBtn: "16 o más · Reservar área completa",
    largeGroupHint: "Grupos de +15 personas reservan el área completa por todo el día.",
    largeGroupCancel: "Cancelar",
    largeGroupPlaceholder: "Ej. 20 personas",
    occasion:     "¿Qué festejamos?",
    occasionNone: "— Sin celebración —",
    occasions: {
      birthday:   "🎂  Cumpleaños",
      anniversary:"🥂  Aniversario",
      business:   "💼  Cena de negocios",
      proposal:   "💍  Pedida de mano",
      other:      "✨  Otro",
    },
    notes:        "Solicitud especial",
    notesPlaceholder: "Alergias, decoración, peticiones especiales...",
    searchBtn:    "Buscar Disponibilidad",
    searching:    "Verificando disponibilidad...",
    redirecting:  "Redirigiendo a MercadoPago...",
    authNeeded:   "Para continuar debes iniciar sesión o crear una cuenta.",
    sections: {
      Terraza:     "Terraza",
      "Planta Alta":"Planta Alta",
      "Salón":     "Salón",
      Privado:     "Privado",
    },
    specialDate: {
      title:       "Fecha especial",
      requires:    "Esta fecha requiere un apartado de",
      perReservation: "por reserva.",
      youHave:     "Tienes",
      ofCredit:    "de crédito disponible",
      willPay:     "— pagarás",
      withMP:      "con MercadoPago.",
      autoApply:   "— se aplicará automáticamente, sin pago adicional.",
      redirect:    "Te redirigiremos a MercadoPago para completar el apartado.",
    },
    confirm: {
      summary:   "Resumen de tu reserva",
      confirmBtn:"Confirmar reserva",
      confirming:"Confirmando...",
      backBtn:   "Cambiar",
    },
    largeGroupConfirmTitle: "Reserva de Grupo Grande",
    largeGroupConfirmBody:  "Reservarás el área completa por todo el día. Confirma los datos antes de continuar.",
  },

  // ── LOGIN / REGISTER ─────────────────────────
  auth: {
    login:        "Iniciar Sesión",
    register:     "Crear Cuenta",
    email:        "Correo electrónico",
    password:     "Contraseña",
    confirmPassword: "Confirmar contraseña",
    name:         "Nombre completo",
    phone:        "Teléfono",
    birthDate:    "Fecha de nacimiento",
    submit:       "Continuar",
    loading:      "Cargando...",
    googleBtn:    "Continuar con Google",
    haveAccount:  "¿Ya tienes cuenta?",
    noAccount:    "¿No tienes cuenta?",
    forgotPass:   "¿Olvidaste tu contraseña?",
    or:           "o",
    errorInvalid: "Datos incorrectos.",
    errorRequired:"Completa todos los campos.",
  },

  // ── MENU ─────────────────────────────────────
  menu: {
    heroTitle:   "Nuestro Menú",
    heroSubtitle:"Cada platillo, una historia",
    pricesNote:  "Precios en pesos mexicanos (MXN)",
    backToMenu:  "Volver al menú",
    addToOrder:  "Agregar",
    ingredients: "Ingredientes",
    sectionTitles: {
      brunch: "Brunch",
      comida: "Comida",
      cena:   "Cena",
      bebidas:"Bebidas",
      postres:"Postres",
    },
  },

  // ── DASHBOARD ────────────────────────────────
  dashboard: {
    title:        "Mis Reservas",
    upcoming:     "Próximas",
    past:         "Pasadas",
    empty:        "No tienes reservas aún.",
    cta:          "Reservar ahora",
    status: {
      PENDING:         "Pendiente",
      PENDING_PAYMENT: "Esperando pago",
      CONFIRMED:       "Confirmada",
      IN_PROGRESS:     "En curso",
      DELAYED:         "Con retraso",
      CANCELLED:       "Cancelada",
      COMPLETED:       "Completada",
      NO_SHOW:         "No se presentó",
    },
    forDate:    "Para",
    guestsLbl:  "personas",
    section:    "Sección",
    cancelBtn:  "Cancelar reserva",
    cancelConfirm: "¿Estás seguro de cancelar?",
    qrBtn:      "Ver QR de check-in",
  },

  // ── CONTACT ──────────────────────────────────
  contact: {
    title:    "Contacto",
    subtitle: "Estamos para escucharte",
    name:     "Tu nombre",
    email:    "Tu correo",
    message:  "Mensaje",
    sendBtn:  "Enviar mensaje",
    sending:  "Enviando...",
    sent:     "Mensaje enviado, gracias.",
  },

  // ── COMMON ───────────────────────────────────
  common: {
    loading: "Cargando...",
    back:    "Volver",
    cancel:  "Cancelar",
    confirm: "Confirmar",
    save:    "Guardar",
    edit:    "Editar",
    delete:  "Eliminar",
    close:   "Cerrar",
    yes:     "Sí",
    no:      "No",
    error:   "Algo salió mal.",
    pricesInMxn: "Precios en pesos mexicanos (MXN)",
  },
};

export default es;

// Recursively widen literal types to their primitives so other locales
// can satisfy the same shape with different strings.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type Dictionary = Widen<typeof es>;
