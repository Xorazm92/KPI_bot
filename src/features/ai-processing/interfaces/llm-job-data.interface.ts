export interface LlmJobData {
  messageLogId: string; // Tahlil qilinayotgan xabarning MessageLogEntity ID'si
  textToAnalyze: string; // LLM ga yuboriladigan matn (masalan, xabar matni yoki STT natijasi)
  promptType: string; // Ishlatiladigan prompt turi (masalan, 'RESPONSE_QUALITY', 'SENTIMENT_ANALYSIS')
  // Kelajakda qo'shimcha kerakli ma'lumotlar qo'shilishi mumkin, masalan, userId, chatId va hokazo.
}
