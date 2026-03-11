// import { NextRequest, NextResponse } from "next/server";
// import { createContactMessage } from "@/lib/db";
// import { contactFormSchema } from "@/lib/validations";
// import type { ApiResponse } from "@/types";

// export async function POST(request: NextRequest) {
//   try {
//     const body = await request.json();

//     // Validate input
//     const validation = contactFormSchema.safeParse(body);
//     if (!validation.success) {
//       const errors = validation.error.flatten().fieldErrors;
//       return NextResponse.json<ApiResponse>(
//         {
//           success: false,
//           error: Object.values(errors).flat().join(", "),
//         },
//         { status: 400 }
//       );
//     }

//     const message = await createContactMessage(validation.data);

//     return NextResponse.json<ApiResponse<{ id: string }>>(
//       {
//         success: true,
//         data: { id: message.id },
//       },
//       { status: 201 }
//     );
//   } catch (error) {
//     console.error("[API] POST /api/contact error:", error);
//     return NextResponse.json<ApiResponse>(
//       { success: false, error: "Error al enviar el mensaje" },
//       { status: 500 }
//     );
//   }
// }
