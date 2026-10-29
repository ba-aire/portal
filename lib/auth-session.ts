// Este módulo debe marcarse con `server-only`, nunca con "use server": esa directiva
// convierte todos los exports del archivo en Server Actions, es decir endpoints HTTP
// públicos, y acá eso incluiría a `createSession`. `server-only` no expone nada; sólo
// hace fallar el build si el módulo se importa desde un componente cliente.
import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
// The payload should contain the minimum, unique user data that'll be used in subsequent requests,
// such as the user's ID, role, etc. It should not contain personally identifiable information
// like phone number, email address, credit card information, etc, or sensitive data like passwords.

export type SessionPayload = {
  userId: string;
  userName: string;
  role: string;
  email: string;
  expiresAt: Date;
};

const secretKey = process.env.SESSION_SECRET;
// La guarda es obligatoria: `TextEncoder().encode(undefined)` devuelve un Uint8Array
// vacío, con lo cual jose firmaría y verificaría contra una clave nula en vez de fallar.
if (!secretKey) {
  throw new Error(
    "SESSION_SECRET no está definida en las variables de entorno.",
  );
}
const encodedKey = new TextEncoder().encode(secretKey);

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7h")
    .sign(encodedKey);
}

export async function decrypt(session: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    console.error(`Failed to verify session, error: ${error}`);
  }
}

export async function createSession(
  userId: string,
  userName: string,
  role: string,
  email: string,
) {
  const expiresAt = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const sessionPayload: SessionPayload = {
    userId,
    userName,
    role,
    email,
    expiresAt,
  };
  const session = await encrypt(sessionPayload);

  // Guardar la sesión en las cookies
  const cookieStore = await cookies();
  cookieStore.set("session", session, {
    httpOnly: true,
    secure: true,
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function updateSession() {
  const session = (await cookies()).get("session")?.value;
  const payload = await decrypt(session);

  if (!session || !payload) {
    return null;
  }

  const expires = new Date(Date.now() + 7 * 60 * 60 * 1000);

  const cookieStore = await cookies();
  cookieStore.set("session", session, {
    httpOnly: true,
    secure: true,
    expires: expires,
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

// Variante sin redirect, para route handlers: un 307 hacia "/" es inútil para un
// fetch() o un EventSource, que necesitan un 401 explícito.
export const getSession = cache(async () => {
  const cookie = (await cookies()).get("session")?.value;
  const session = await decrypt(cookie);

  if (!session?.userId) {
    return null;
  }

  return {
    userId: session.userId as string,
    userName: session.userName as string,
    email: session.email as string,
    role: session.role as string,
  };
});

export const verifySession = cache(async () => {
  const cookie = (await cookies()).get("session")?.value;
  const session = await decrypt(cookie);

  if (!session?.userId) {
    redirect("/");
  }

  return {
    isAuth: true,
    data: {
      userId: session.userId as string,
      userName: session.userName as string,
      email: session.email as string,
      role: session.role as string,
    },
  };
});
