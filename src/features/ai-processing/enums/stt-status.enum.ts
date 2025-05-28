export enum SttStatusEnum {
  PENDING = 'PENDING', // Navbatda, qayta ishlash kutilmoqda
  PROCESSING = 'PROCESSING', // STT jarayoni boshlandi
  DOWNLOADING_FILE = 'DOWNLOADING_FILE', // Fayl Telegramdan yuklanmoqda
  SENDING_TO_STT = 'SENDING_TO_STT', // STT servisiga yuborilmoqda
  COMPLETED = 'COMPLETED', // Muvaffaqiyatli yakunlandi, transkripsiya mavjud
  FAILED_QUEUE = 'FAILED_QUEUE', // Navbatga qo'shishda xatolik
  FAILED_DOWNLOAD = 'FAILED_DOWNLOAD', // Faylni yuklashda xatolik
  FAILED_STT_SERVICE = 'FAILED_STT_SERVICE', // STT servisida xatolik
  FAILED_UPDATE_LOG = 'FAILED_UPDATE_LOG', // Log yozuvini yangilashda xatolik
  FAILED_UNKNOWN = 'FAILED_UNKNOWN', // Boshqa noma'lum xatolik
  FAILED_STT_NO_RESPONSE = 'FAILED_STT_NO_RESPONSE', // STT xizmatidan javob kelmadi (timeout yoki ulanish muammosi)
  FAILED_NO_FILE_LINK = 'FAILED_NO_FILE_LINK', // Telegramdan fayl havolasini olishda xatolik
  NOT_APPLICABLE = 'NOT_APPLICABLE' // Bu xabar uchun STT kerak emas
}
