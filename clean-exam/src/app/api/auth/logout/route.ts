import { logoutUser } from "@/actions/authActions";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  await logoutUser();
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete("session");
  return response;
}
