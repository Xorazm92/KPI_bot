// Placeholder for user-role.enum.ts
export enum UserRole {
  ADMIN = 'ADMIN',
  SUPERVISOR = 'SUPERVISOR', // Nazoratchi (SI natijalarini tekshiradi, KPI sozlaydi)
  AGENT = 'AGENT',         // Operator/Xodim (KPI bajaruvchi)
  CLIENT = 'CLIENT',       // Mijoz (agar bot mijozlar bilan ham ishlasa)
  BOT = 'BOT',             // Botning o'zi uchun (masalan, tizimli xabarlar)
}
