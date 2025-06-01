export enum UserRole {
  ADMIN = 'ADMIN',
  SUPERVISOR = 'SUPERVISOR', // Nazoratchi (SI natijalarini tekshiradi, KPI sozlaydi)
  ACCOUNTANT = 'ACCOUNTANT', // Accountant (Buxgalter)
  BANK_CLIENT = 'BANK_CLIENT', // Bank operatsiyalari
  CLIENT = 'CLIENT', // Mijoz (agar bot mijozlar bilan ham ishlasa)
  BOT = 'BOT', // Botning o'zi uchun (masalan, tizimli xabarlar)
}
