import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

const secretKey = process.env.JWT_SECRET;
if (!secretKey) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error("JWT_SECRET is not set in environment variables!");
  }
}
const encodedKey = new TextEncoder().encode(secretKey || "rahasia_negara_jangan_disebar");

export async function signToken(payload: any) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") // Sesi berlaku 7 hari
    .sign(encodedKey);
}

export async function verifyToken(session: string | undefined = "") {
  try {
    if (!session) return null;
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    return null; // Token tidak valid atau kadaluwarsa
  }
}

export async function getSession() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session")?.value;
    if (!session) return null;
    
    const payload = await verifyToken(session);
    if (!payload) return null;

    // Stateful Verification (Check sessionVersion against DB)
    const prisma = (await import("@/lib/prisma")).default;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as string },
      select: { sessionVersion: true }
    });

    if (!user || user.sessionVersion !== payload.sessionVersion) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}
