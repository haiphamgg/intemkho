
import Papa from 'papaparse';

// ID của Spreadsheet mới
export const SPREADSHEET_ID = '1R2j006xS2Cjrcx5i8wDsSmb-hIFhi708ZmhjN3e-DLM';

// URL của Google Apps Script Web App
// QUAN TRỌNG: Script này phải có hàm doGet() để DriveService hoạt động
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyQ4YV0htouX3tP_7FstedjAdpjuPqDAWdpjcE11JhugrNW8iTCI0AvAauSoAbOXevd/exec'; 

export const fetchGoogleSheetData = async (sheetName: string = 'DATA', range: string = 'A2:Z'): Promise<string[][]> => {
  // Sử dụng Google Visualization API để lấy dữ liệu dạng CSV (Chỉ đọc - nhanh)
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&range=${range}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      // Xử lý các lỗi HTTP thường gặp
      if (response.status === 400) {
         throw new Error(`Không tìm thấy Sheet tên "${sheetName}". Hãy kiểm tra lại tên Tab phía dưới Google Sheet.`);
      }
      if (response.status === 403 || response.status === 401) {
         throw new Error(`Không có quyền truy cập Sheet. Vui lòng nhấn "Share" (Chia sẻ) > "Anyone with the link" (Bất kỳ ai có liên kết).`);
      }
      throw new Error(`Lỗi kết nối Sheet "${sheetName}": ${response.statusText} (${response.status})`);
    }
    
    const csvText = await response.text();
    
    // Đôi khi Google trả về HTML báo lỗi thay vì CSV
    if (csvText.trim().startsWith('<!DOCTYPE html>') || csvText.includes("Google Drive - Page Not Found")) {
         throw new Error(`Không đọc được dữ liệu từ Sheet "${sheetName}". Có thể Sheet chưa được Public hoặc sai tên.`);
    }

    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        complete: (results) => {
          resolve(results.data as string[][]);
        },
        error: (error: any) => {
          reject(new Error("Lỗi phân tích dữ liệu CSV: " + error.message));
        }
      });
    });
  } catch (error: any) {
    console.error(`Error fetching sheet ${sheetName}:`, error);
    throw error; // Ném lỗi ra để App.tsx bắt và hiển thị thông báo
  }
};

export const saveToGoogleSheet = async (data: any): Promise<any> => {
  if (!SCRIPT_URL) {
    throw new Error("Script URL is not configured");
  }

  try {
    // Use fetch with method POST. 
    // Google Apps Script `doPost(e)` receives the body.
    // We send JSON string. We do NOT set 'Content-Type': 'application/json' to avoid preflight OPTIONS request which might fail on some GAS deployments.
    // GAS will receive it as text/plain but can parse the postData.contents.
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Lỗi kết nối server: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.status === 'error') {
      throw new Error(result.message || "Lỗi xử lý từ Server");
    }

    return result;
  } catch (error: any) {
    console.error("Save to sheet failed:", error);
    throw new Error(error.message || "Không thể lưu dữ liệu");
  }
};
