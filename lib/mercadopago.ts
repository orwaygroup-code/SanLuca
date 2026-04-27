import { MercadoPagoConfig, Preference, Payment as MPPayment } from "mercadopago";

function getAccessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado en .env");
  }
  return token;
}

export function getMpClient() {
  return new MercadoPagoConfig({
    accessToken: getAccessToken(),
    options: { timeout: 8000 },
  });
}

export interface CreatePreferenceArgs {
  reservationId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  description: string; // ej: "Apartado reserva San Luca - Día de las Madres"
  appUrl: string;      // base public URL (NEXT_PUBLIC_APP_URL)
}

/** Creates an MP Preference and returns init_point + preferenceId. */
export async function createReservationPreference(args: CreatePreferenceArgs) {
  const client = getMpClient();
  const pref = new Preference(client);
  const body = {
    items: [
      {
        id: args.reservationId,
        title: args.description,
        quantity: 1,
        unit_price: args.amount,
        currency_id: "MXN",
      },
    ],
    payer: {
      name: args.customerName,
      email: args.customerEmail,
    },
    external_reference: args.reservationId,
    back_urls: {
      success: `${args.appUrl}/reserva/pago-exitoso?r=${args.reservationId}`,
      failure: `${args.appUrl}/reserva/pago-fallido?r=${args.reservationId}`,
      pending: `${args.appUrl}/reserva/pago-exitoso?r=${args.reservationId}`,
    },
    auto_return: "approved" as const,
    notification_url: `${args.appUrl}/api/payments/webhook`,
    statement_descriptor: "SAN LUCA",
  };
  const result = await pref.create({ body });
  return {
    preferenceId: result.id!,
    initPoint: result.init_point ?? result.sandbox_init_point ?? "",
  };
}

/** Fetch a payment from MP by id (used inside webhook). */
export async function getMpPaymentById(paymentId: string) {
  const client = getMpClient();
  const mp = new MPPayment(client);
  return mp.get({ id: paymentId });
}
