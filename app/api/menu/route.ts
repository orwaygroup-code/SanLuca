import { NextResponse } from "next/server";
import { getMenuCategories } from "@/lib/db";
import type { ApiResponse, MenuCategory } from "@/types";

// Lee el menú en vivo (platillos activos): sin esto Next prerenderiza el GET una
// vez en build y sirve el menú congelado hasta el siguiente deploy.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await getMenuCategories();

    const serialized = categories.map((cat) => ({
      ...cat,
      dishes: cat.dishes.map((item) => ({   // ← mantiene el nombre dishes
        ...item,
        price: Number(item.price),
      })),
    }));

    return NextResponse.json<ApiResponse<MenuCategory[]>>({
      success: true,
      data: serialized as MenuCategory[],  // ← ahora sí coincide con el tipo
    });
  } catch (error) {
    console.error("[API] GET /api/menu error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Error al obtener el menú" },
      { status: 500 }
    );
  }
}