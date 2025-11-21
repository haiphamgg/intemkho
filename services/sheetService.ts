import Papa from 'papaparse';

// ID của Spreadsheet từ link bạn cung cấp
const SPREADSHEET_ID = '1vonMQNPV2SI_XxmZ7h781QHS2fZBMSMbIxWQjS7z1B4';
const SHEET_NAME = 'DULIEU';
// Lấy từ cột A đến U, bắt đầu từ hàng 3 (Tiêu đề)
const RANGE = 'A3:U';

export const fetchGoogleSheetData = async (): Promise<string[][]> => {
  // Sử dụng Google Visualization API để lấy dữ liệu dạng CSV
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAME}&range=${RANGE}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Lỗi kết nối: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        complete: (results) => {
          // results.data là mảng các mảng string
          resolve(results.data as string[][]);
        },
        error: (error: any) => {
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error("Error fetching sheet:", error);
    throw error;
  }
};