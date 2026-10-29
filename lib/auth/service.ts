import bcrypt from "bcryptjs";
import type { UserInsert, UserSelect } from "@/db/schema/user";
import { createSession } from "@/lib/auth-session";
import {
  clearAttempts,
  isRateLimited,
  recordFailedAttempt,
  WINDOW_MINUTES,
} from "./rate-limit";
import { getUserByEmail, insertUser } from "./repository";

export interface AuthResponse {
  success: boolean;
  data?: {
    id: number;
    name: string;
    email: string;
  };
  message?: string;
}

// Un único mensaje para las dos causas de fallo. Distinguir "Usuario no encontrado"
// de "Contraseña incorrecta" convierte al login en un oráculo para enumerar qué
// correos están registrados.
const CREDENCIALES_INVALIDAS = "Correo o contraseña incorrectos";

// Hash real (cost 10) contra el que se compara cuando el usuario no existe, para
// que esa rama cueste lo mismo que la de un usuario válido. Sin esto, responder
// antes de llegar a bcrypt filtra la misma información por tiempo de respuesta.
// No es la contraseña de nadie: ningún login puede coincidir contra este hash.
const DUMMY_HASH =
  "$2b$10$XnGxgMipSN.F3oGykrqsUeqRYXsnJJL0gcaQ/SPty6pAg2d.vOV2i";

const DEMASIADOS_INTENTOS = `Demasiados intentos fallidos. Esperá ${WINDOW_MINUTES} minutos e intentá de nuevo.`;

export async function loginUser(
  data: UserSelect,
  ip: string | null = null,
): Promise<AuthResponse> {
  // El cupo se consulta antes que nada: un atacante que ya lo agotó no llega a
  // hacer trabajar a bcrypt, que es la parte cara del login.
  if (await isRateLimited(data.email, ip)) {
    return { success: false, message: DEMASIADOS_INTENTOS };
  }

  // Obtener el usuario desde la base de datos
  const usuario = await getUserByEmail(data.email);
  if (!usuario) {
    await bcrypt.compare(data.password, DUMMY_HASH);
    await recordFailedAttempt(data.email, ip);
    return { success: false, message: CREDENCIALES_INVALIDAS };
  }

  // Validar la contraseña
  const isPasswordValid = await bcrypt.compare(data.password, usuario.password);
  if (!isPasswordValid) {
    await recordFailedAttempt(data.email, ip);
    return { success: false, message: CREDENCIALES_INVALIDAS };
  }

  await clearAttempts(usuario.email);

  // Crear la sesión del usuario
  await createSession(
    usuario.id.toString(),
    usuario.name,
    usuario.role,
    usuario.email,
  );

  // Retornar el nombre del usuario para posibles personalizaciones
  return {
    success: true,
    data: { id: usuario.id, name: usuario.name, email: usuario.email },
  };
}

export async function registerUser(data: UserInsert): Promise<AuthResponse> {
  // Hashear la contraseña
  const password = await bcrypt.hash(data.password, 10);

  try {
    // Insertar al usuario en la base de datos
    const result = await insertUser({
      name: data.name,
      lastName: data.lastName,
      email: data.email,
      password,
      role: data.role,
    });

    // Preparar la respuesta
    return {
      success: true,
      data: {
        id: result.id,
        name: data.name,
        email: data.email,
      },
    };
  } catch (error: unknown) {
    const pgError = error as {
      code?: string;
      detail?: string;
      message?: string;
    };

    // Manejo de errores específicos de PostgreSQL
    if (pgError.code === "23505") {
      if (pgError.detail?.includes("name")) {
        return {
          success: false,
          message: "El nombre de usuario ya está en uso",
        };
      }
      if (pgError.detail?.includes("email")) {
        return {
          success: false,
          message: "El correo electrónico ya está registrado",
        };
      }
      return {
        success: false,
        message: "Ya existe un registro con estos datos",
      };
    }

    // Otros errores genéricos
    return {
      success: false,
      message: "Error al registrar el usuario. Por favor, intente nuevamente",
    };
  }
}
