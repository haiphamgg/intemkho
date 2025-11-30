
import { GoogleGenAI } from "@google/genai";
import { DeviceRow } from "../types";

// Helper to get key (priority: argument -> env)
const getApiKey = (passedKey?: string) => {
    if (passedKey) return passedKey;
    try {
        // @ts-ignore
        return process.env.API_KEY || '';
    } catch {
        return '';
    }
}

export const analyzeTicketData = async (ticketId: string, items: DeviceRow[], apiKey?: string): Promise<string> => {
  try {
    const key = getApiKey(apiKey);
    if (!key) {
      return "Chưa cấu hình API Key.";
    }

    const ai = new GoogleGenAI({ apiKey: key });

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

export const askGemini = async (question: string, contextData: string, apiKey?: string): Promise<string> => {
    try {
        const key = getApiKey(apiKey);
        if (!key) return "Vui lòng cấu hình API Key trong file App.tsx";

        const ai = new GoogleGenAI({ apiKey: key });
        const prompt = `
            Bạn là một trợ lý ảo quản lý kho thông minh. Dưới đây là dữ liệu tóm tắt hiện tại của kho:
            ${contextData}

            Người dùng hỏi: "${question}"

            Hãy trả lời ngắn gọn, thân thiện và đi thẳng vào vấn đề. Nếu câu hỏi không liên quan đến dữ liệu kho, hãy từ chối lịch sự.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "AI không phản hồi.";
    } catch (error) {
        console.error("Chat error", error);
        return "Xin lỗi, tôi đang gặp sự cố kết nối.";
    }
}
