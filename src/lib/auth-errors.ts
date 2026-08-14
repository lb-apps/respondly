const translations: Record<string, string> = {
  "Invalid login credentials": "Geçersiz e-posta veya şifre",
  "Email not confirmed": "E-posta adresi doğrulanmamış",
  "User not found": "Kullanıcı bulunamadı",
  "Invalid email or password": "Geçersiz e-posta veya şifre",
  "Too many requests": "Çok fazla deneme. Lütfen biraz bekleyin",
  "Email rate limit exceeded": "E-posta gönderim limiti aşıldı",
  "Password should be at least 6 characters": "Şifre en az 6 karakter olmalı",
  "User already registered": "Bu e-posta zaten kayıtlı",
  "Signup requires a valid password": "Geçerli bir şifre gerekli",
  "Unable to validate email address: invalid format": "Geçersiz e-posta formatı",
  "Token has expired or is invalid": "Doğrulama kodu geçersiz veya süresi dolmuş",
  "OTP has expired": "Doğrulama kodunun süresi dolmuş",
}

const DEFAULT_LOGIN_ERROR =
  "Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin."
const DEFAULT_SIGNUP_ERROR = "Kayıt işlemi başarısız. Lütfen tekrar deneyin."

export function translateAuthError(
  message: string,
  context: "login" | "signup" = "login"
): string {
  return (
    translations[message] ??
    (context === "signup" ? DEFAULT_SIGNUP_ERROR : DEFAULT_LOGIN_ERROR)
  )
}
