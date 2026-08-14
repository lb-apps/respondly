import { z } from "zod"

export const passwordSchema = z
  .string()
  .min(8, "En az 8 karakter olmalıdır")
  .regex(/[A-Za-z]/, "En az bir harf içermelidir")
  .regex(/[0-9]/, "En az bir rakam içermelidir")

export const PASSWORD_HINT = "Min. 8 karakter, en az bir harf ve rakam."
