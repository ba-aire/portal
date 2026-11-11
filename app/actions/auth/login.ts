"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { UserSelect } from "@/db/schema/user";
import {
  LoginFormSchema,
  type LoginFormState,
} from "@/lib/auth/form-validations";
import { loginUser } from "@/lib/auth/service";

/**
 * IP del cliente para el rate limiting.
 *
 * x-forwarded-for es una cabecera que el cliente puede falsificar, así que sólo
 * vale si la escribe un proxy de confianza. En la VM ese proxy es caddy: hay que
 * asegurarse de que la sobreescriba, o el límite por IP se saltea mandando una
 * cabecera distinta en cada request.
 * Se toma el primer valor de la lista: es el cliente original, el resto son saltos.
 */
async function getClientIp(): Promise<string | null> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return headerList.get("x-real-ip");
}

export async function login(_state: LoginFormState, formData: FormData) {
  // 1. Valido campos del formulario
  const validatedFields = LoginFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  // 2. Llamo al servicio login
  const result = await loginUser(
    validatedFields.data as UserSelect,
    await getClientIp(),
  );

  if (!result.success) {
    return { success: false, message: result.message };
  }

  // 3. Redirigir al usuario o retornar datos necesarios
  redirect("/estaciones/centenario");
}
