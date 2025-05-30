export enum LlmAnalysisStatusEnum {
  PENDING = 'PENDING', // Navbatda, tahlil kutilmoqda
  PROCESSING = 'PROCESSING', // LLM tahlili boshlandi
  COMPLETED = 'COMPLETED', // Muvaffaqiyatli yakunlandi, tahlil natijasi mavjud
  FAILED_QUEUE = 'FAILED_QUEUE', // Navbatga qo'shishda xatolik
  FAILED_LLM_SERVICE = 'FAILED_LLM_SERVICE', // LLM servisida xatolik (masalan, Ollama bilan bog'lanishda)
  FAILED_LLM_PROCESSING = 'FAILED_LLM_PROCESSING', // LLM modelining o'zida xatolik (masalan, noto'g'ri javob)
  FAILED_UPDATE_LOG = 'FAILED_UPDATE_LOG', // Log yozuvini yangilashda xatolik
  FAILED_UNKNOWN = 'FAILED_UNKNOWN', // Boshqa noma'lum xatolik
  NOT_APPLICABLE = 'NOT_APPLICABLE', // Bu xabar uchun LLM tahlili kerak emas
}
