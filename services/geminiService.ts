import { GoogleGenAI } from "@google/genai";
import { DeviceRow } from "../types";

// Remove global initialization to prevent crash on load if process.env is missing in browser
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeTicketData = async (ticketId: string, items: DeviceRow[]): Promise<string> => {
  try {
    // Initialize inside the function
    // @ts-ignore - process.env is replaced by Vite at build time
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      return "Chưa cấu hình API Key.";
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });

    const itemSummary = items.map(i => `- Device: ${i.deviceName} (QR: ${i.qrContent})`).join('\n');
    
    const prompt = `
      Tôi đang chuẩn bị in tem mã QR cho lô thiết bị có Số Phiếu: "${ticketId}".
      Dưới đây là danh sách thiết bị trong lô này:
      ${itemSummary}

      Hãy phân tích ngắn gọn (tối đa 3 câu) về lô này cho tôi biết:
      1. Tổng số lượng.
      2. Có mã QR nào bị trùng lặp hoặc có vẻ sai định dạng không?
      3. Đưa ra một lời khuyên ngắn gọn về việc dán tem.
      Trả lời bằng tiếng Việt.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Không thể phân tích.";
  } catch (error) {
    console.error("Gemini analysis failed", error);
    return "Lỗi khi kết nối với AI.";
  }
};