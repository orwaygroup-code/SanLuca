import { NextResponse } from "next/server";
import { getMenuCategories } from "@/lib/db";
import type { ApiResponse, MenuCategory } from "@/types";

export async function GET() {
  try {
    const categories = await getMenuCategories();

    const serialized = categories.map((cat) => ({
      ...cat,
      items: cat.items.map((item) => ({
        ...item,
        price: Number(item.price),
      })),
    }));

    return NextResponse.json<ApiResponse<MenuCategory[]>>({
      success: true,
      data: serialized as MenuCategory[],
    });
  } catch (error) {
    console.error("[API] GET /api/menu error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Error al obtener el menú" },
      { status: 500 }
    );
  }
}
