import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types/api";

export function apiSuccess<T>(data: T, status = 200) {
  const body: ApiResponse<T> = { success: true, data };
  return NextResponse.json(body, { status });
}

export function apiError(error: string, status = 400) {
  const body: ApiResponse<never> = { success: false, error };
  return NextResponse.json(body, { status });
}
