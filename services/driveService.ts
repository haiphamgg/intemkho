
import { DriveFile } from '../types';

// Đường dẫn Web App từ Google Apps Script (Miễn phí, không cần API Key/OAuth)
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxodndGf6v-1ZkbWx5LBu5IpMXvTsnvAy4lBvx4m0eGk6ef82lVubMCmrhVT0ak7Lw2/exec';

export const fetchDriveFiles = async (folderId: string): Promise<DriveFile[]> => {
  if (!folderId) {
    throw new Error("Chưa cấu hình ID thư mục");
  }

  // Gọi đến Web App
  const url = `${GAS_WEB_APP_URL}?folderId=${folderId}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Lỗi kết nối (${response.status})`);
    }

    const data = await response.json();
    
    // Xử lý lỗi trả về từ script (nếu có)
    if (data.error) {
      throw new Error(data.error);
    }

    return data.files || [];
  } catch (error: any) {
    console.error("Failed to fetch drive files:", error);
    throw new Error(error.message || "Lỗi không xác định khi tải dữ liệu từ Drive");
  }
};

export const formatFileSize = (bytes?: string | number): string => {
  if (bytes === undefined || bytes === null) return '0 B';
  
  const numBytes = typeof bytes === 'string' ? parseInt(bytes) : bytes;
  if (isNaN(numBytes) || numBytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(numBytes) / Math.log(k));
  
  return parseFloat((numBytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const getFileIcon = (mimeType: string) => {
  if (!mimeType) return 'file';
  const type = mimeType.toLowerCase();
  
  if (type.includes('pdf')) return 'pdf';
  if (type.includes('image')) return 'image';
  if (type.includes('sheet') || type.includes('excel') || type.includes('spreadsheet')) return 'sheet';
  if (type.includes('document') || type.includes('word')) return 'doc';
  if (type.includes('folder')) return 'folder';
  return 'file';
};
