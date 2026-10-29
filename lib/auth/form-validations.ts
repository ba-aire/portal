import { z } from "zod";
import { ROLES } from "./roles";

export const LoginFormSchema = z.object({
  email: z
    .string()
    // trim y minúsculas ANTES de .email(): zod aplica la cadena en orden, y con
    // .trim() al final un email pegado con un espacio se rechazaba como inválido.
    // Se guarda y se busca en minúsculas (ver db/schema/user.ts).
    .trim()
    .toLowerCase()
    .email({ message: "Por favor, introduce un correo válido." }),
  password: z
    .string()
    .min(8, { message: "Debe tener al menos 8 caracteres." })
    .regex(/[a-zA-Z]/, { message: "Debe contener al menos una letra." })
    .regex(/[0-9]/, { message: "Debe contener al menos un número." })
    .regex(/[^a-zA-Z0-9]/, {
      message: "Debe contener al menos un carácter especial.",
    })
    .trim(),
});

export const RegisterFormSchema = z.object({
  name: z
    .string()
    .min(2, { message: "El nombre debe tener al menos 2 caracteres." })
    .trim(),
  lastName: z
    .string()
    .min(2, { message: "El apellido debe tener al menos 2 caracteres." })
    .trim(),
  email: z
    .string()
    // trim y minúsculas ANTES de .email(): zod aplica la cadena en orden, y con
    // .trim() al final un email pegado con un espacio se rechazaba como inválido.
    // Se guarda y se busca en minúsculas (ver db/schema/user.ts).
    .trim()
    .toLowerCase()
    .email({ message: "Por favor, introduce un correo válido." }),
  password: z
    .string()
    .min(8, { message: "Debe tener al menos 8 caracteres." })
    .regex(/[a-zA-Z]/, { message: "Debe contener al menos una letra." })
    .regex(/[0-9]/, { message: "Debe contener al menos un número." })
    .regex(/[^a-zA-Z0-9]/, {
      message: "Debe contener al menos un carácter especial.",
    })
    .trim(),
  role: z.enum(ROLES, {
    message: "Por favor, selecciona un rol.",
  }),
});

export type LoginFormState =
  | {
      errors?: {
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;

export type RegisterFormState =
  | {
      errors?: {
        name?: string[];
        lastName?: string[];
        email?: string[];
        password?: string[];
        role?: string[];
      };
      message?: string;
    }
  | undefined;
