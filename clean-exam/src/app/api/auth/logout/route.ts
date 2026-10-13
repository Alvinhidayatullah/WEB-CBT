import { logoutUser } from "@/actions/authActions";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    await logoutUser();
  } catch {}
  
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set("session", "", {
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function POST(request: NextRequest) {
  try {
    await logoutUser();
  } catch {}
  
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set("session", "", {
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
