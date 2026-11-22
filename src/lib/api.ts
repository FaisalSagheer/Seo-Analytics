import "server-only";
import { NextResponse } from "next/server";

export function apiError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}
