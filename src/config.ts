/**
 * 功能旗標（build-time）
 *
 * 注意：Vite 只會內嵌 VITE_ 前綴的環境變數，且是在建置階段寫死，
 * 因此改動旗標後必須重新部署才會生效。
 */

/**
 * 打卡卡影像辨識（OCR）。
 *
 * 預設關閉。此功能每次辨識都會產生 OpenAI API 費用，
 * 待客戶確認付費後，於 Vercel 設定 VITE_ENABLE_OCR=true 並重新部署即可開啟。
 */
export const OCR_ENABLED = import.meta.env.VITE_ENABLE_OCR === 'true';
