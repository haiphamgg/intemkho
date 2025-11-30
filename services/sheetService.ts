
// URL API CỐ ĐỊNH (Fallback)
const FALLBACK_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyqEtmuL0lOwh_Iibgs7oxx0lSC1HG1ubNcPc6KINu8a-aC3adsK9qTRj9LCjX4z7iq/exec";

// Helper to safely get env var
const getEnvScriptUrl = () => {
  try {
    // @ts-ignore
    return process.env.SCRIPT_URL;
  } catch (e) {
    return "";
  }
};

// @ts-ignore
export const SCRIPT_URL = getEnvScriptUrl() || FALLBACK_SCRIPT_URL;

export const fetchGoogleSheetData = async (sheetId: string, sheetNameOrRange: string = 'DULIEU'): Promise<string[][]> => {
  if (!sheetId) {
    throw new Error("Chưa nhập Sheet ID.");
  }

  // Phân tách Sheet Name và Range nếu có dấu '!' (VD: "DANHMUC!A2:G")
  let sheet = sheetNameOrRange;
  let range = 'A3:U'; // Mặc định cho DULIEU

  if (sheetNameOrRange.includes('!')) {
    const parts = sheetNameOrRange.split('!');
    sheet = parts[0];
    range = parts[1];
  }

  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheet)}&range=${encodeURIComponent(range)}&headers=1`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Lỗi kết nối: ${response.status}`);
    }

    const text = await response.text();
    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/);
    
    if (!jsonMatch || !jsonMatch[1]) {
      throw new Error("Cấu trúc dữ liệu không hợp lệ (Không phải GVIZ response).");
    }

    const json = JSON.parse(jsonMatch[1]);

    if (json.status === 'error') {
      throw new Error(json.errors?.[0]?.detailed_message || "Lỗi từ Google Sheet API");
    }

    const rows = json.table.rows.map((row: any) => {
      return (row.c || []).map((cell: any) => (cell ? (cell.v !== null ? String(cell.v) : "") : ""));
    });

    return rows;
  } catch (error: any) {
    console.error(`Error fetching sheet ${sheetNameOrRange}:`, error);
    throw new Error(`Không thể lấy dữ liệu từ sheet "${sheetNameOrRange}". Hãy kiểm tra tên sheet và quyền truy cập.`);
  }
};

export const saveToGoogleSheet = async (data: any, explicitScriptUrl?: string) => {
  // Ưu tiên URL được truyền vào, sau đó đến localStorage, cuối cùng là fallback
  const userScriptUrl = localStorage.getItem('SCRIPT_URL');
  let targetUrl = explicitScriptUrl || userScriptUrl || SCRIPT_URL;

  if (!targetUrl || !targetUrl.startsWith('http')) {
    throw new Error("Script URL không hợp lệ. Hãy kiểm tra ô A2 sheet DMDC hoặc cấu hình Admin.");
  }
  
  if (targetUrl.startsWith('http:')) {
      targetUrl = targetUrl.replace('http:', 'https:');
  }

  if (targetUrl.includes('/edit') || targetUrl.includes('/copy')) {
      throw new Error("Script URL sai định dạng (link edit). Vui lòng dùng link Web App (kết thúc bằng /exec).");
  }

  console.log("Sending data to:", targetUrl);
  const payload = JSON.stringify(data);

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      body: payload,
      mode: 'cors',
      credentials: 'omit', // Important for "Anyone" scripts
      redirect: 'follow',
      headers: {
        "Content-Type": "text/plain;charset=utf-8", // Simple content type avoids CORS preflight
      },
    });

    if (!response.ok) {
        throw new Error(`Server returned ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if (result.status === 'error') {
      throw new Error(result.message || "Lỗi từ Script");
    }
    return result; // Success

  } catch (error: any) {
    console.error("Error saving to sheet:", error);
    
    if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
        throw new Error(`Lỗi kết nối (CORS/Network) - Kiểm tra lại cấu hình Script.\nCó thể do Script bị lỗi server (500) khi xử lý dữ liệu thiếu cột.`);
    }
    
    throw error;
  }
};
