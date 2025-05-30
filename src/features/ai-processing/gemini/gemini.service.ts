// import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { GoogleGenerativeAI } from '@google/generative-ai';

// @Injectable()
// export class GeminiService implements OnModuleInit {
//   private readonly logger = new Logger(GeminiService.name);
//   private genAI: GoogleGenerativeAI;
//   private model: any; // Type will be inferred from the model

//   constructor(private readonly configService: ConfigService) {
//     const apiKey = this.configService.get<string>('GEMINI_API_KEY');
//     if (!apiKey) {
//       this.logger.warn(
//         'GEMINI_API_KEY is not configured. Gemini features will be disabled.',
//       );
//       return;
//     }
//     this.genAI = new GoogleGenerativeAI(apiKey);
//   }

//   async onModuleInit() {
//     if (!this.genAI) return;

//     try {
//       // Try to use the pro model first, fallback to pro-latest if not available
//       const modelName = 'gemini-1.5-pro';
//       this.logger.log(`Initializing Gemini AI with model: ${modelName}`);

//       this.model = this.genAI.getGenerativeModel({
//         model: modelName,
//       });

//       // Test the connection with a minimal request
//       try {
//         await this.model.generateContent({
//           contents: [
//             {
//               role: 'user',
//               parts: [{ text: 'Test connection' }],
//             },
//           ],
//           generationConfig: {
//             maxOutputTokens: 10, // Minimal output for test
//           },
//         });
//         this.logger.log(`Successfully connected to Gemini AI (${modelName})`);
//       } catch (testError) {
//         this.logger.warn(
//           `Failed to initialize with ${modelName}, falling back to gemini-1.0-pro: ${testError.message}`,
//         );
//         this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
//         this.logger.log('Successfully connected to Gemini AI (gemini-1.0-pro)');
//       }
//     } catch (error) {
//       this.logger.error(
//         `Failed to initialize Gemini AI: ${error.message}`,
//         error.stack,
//       );
//       // Don't throw here to allow the app to start without Gemini
//       this.model = null;
//     }
//   }

//   async generateContent(
//     prompt: string,
//     options: { retryCount?: number } = {},
//   ): Promise<string> {
//     const maxRetries = options.retryCount || 0;
//     const retryDelay = 2000; // 2 seconds delay between retries

//     if (!this.genAI || !this.model) {
//       throw new Error('Gemini AI is not properly configured');
//     }

//     try {
//       const result = await this.model.generateContent({
//         contents: [
//           {
//             role: 'user',
//             parts: [{ text: prompt }],
//           },
//         ],
//         generationConfig: {
//           temperature: 0.7,
//           topP: 0.95,
//           topK: 40,
//           maxOutputTokens: 1024, // Reduced from 2048 to avoid rate limits
//         },
//       });

//       const response = await result.response;
//       return response.text();
//     } catch (error) {
//       this.logger.error(
//         `Gemini API error (attempt ${maxRetries + 1}): ${error.message}`,
//         error.stack,
//       );

//       // Log more detailed error information if available
//       if (error.response) {
//         this.logger.error(
//           `Gemini API response: ${JSON.stringify(error.response.data, null, 2)}`,
//         );
//       }

//       // Handle rate limiting with retry logic
//       if (error.message.includes('429') && maxRetries < 2) {
//         const retryAfter = error.response?.headers?.['retry-after'] || 5;
//         const delay = parseInt(retryAfter) * 1000 || retryDelay;

//         this.logger.warn(
//           `Rate limited. Retrying in ${delay}ms... (${maxRetries + 1}/2)`,
//         );
//         await new Promise((resolve) => setTimeout(resolve, delay));

//         return this.generateContent(prompt, { retryCount: maxRetries + 1 });
//       }

//       // Handle specific error types
//       if (error.message.includes('429')) {
//         throw new Error(
//           "Juda ko'p so'rovlar yuborildi. Iltimos, bir necha daqiqadan so'ng qayta urinib ko'ring.",
//         );
//       } else if (error.message.includes('401')) {
//         throw new Error(
//           "Noto'g'ri API kalit. Iltimos, tizim administratoriga murojaat qiling.",
//         );
//       } else if (error.message.includes('404')) {
//         // Try to switch to a different model
//         if (this.model.model !== 'gemini-1.0-pro') {
//           this.logger.warn('Falling back to gemini-1.0-pro due to 404 error');
//           this.model = this.genAI.getGenerativeModel({
//             model: 'gemini-1.0-pro',
//           });
//           return this.generateContent(prompt, { retryCount: maxRetries + 1 });
//         }
//         throw new Error(
//           "Model topilmadi. Iltimos, keyinroq qayta urinib ko'ring.",
//         );
//       } else if (
//         error.message.includes('500') ||
//         error.message.includes('503')
//       ) {
//         // Server errors might be temporary
//         if (maxRetries < 2) {
//           this.logger.warn(`Server error, retrying... (${maxRetries + 1}/2)`);
//           await new Promise((resolve) => setTimeout(resolve, retryDelay));
//           return this.generateContent(prompt, { retryCount: maxRetries + 1 });
//         }
//         throw new Error(
//           "Serverda vaqtinchalik xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring.",
//         );
//       }

//       // For other errors, include the original error message for debugging
//       throw new Error(`Xatolik yuz berdi: ${error.message}`);
//     }
//   }
// }
