
import { DriveFile } from '../types';
// import { SCRIPT_URL } from './sheetService'; // Removed hard dependency

export const fetchDriveFiles = async (folderId: string, scriptUrl: string): Promise<DriveFile[]> => {
  if (!folderId) {
    throw new Error("Chưa cấu hình ID thư mục");
  }

  if (!scriptUrl) {
    throw new Error("Chưa cấu hình Script URL");
  }

  // CACHE BUSTING
  const timestamp = new Date().getTime();
  const url = `${scriptUrl}?folderId=${folderId}&_t=${timestamp}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Lỗi kết nối (${response.status})`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    const rawFiles = data.files || [];

    // Normalize data to match DriveFile interface
    // Google Apps Script DriveApp return slightly different keys than Drive API v3
    return rawFiles.map((f: any) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      webViewLink: f.webViewLink || f.url, // Script might return 'url'
      webContentLink: f.webContentLink || f.downloadUrl,
      thumbnailLink: f.thumbnailLink,
      size: f.size,
      // Handle date variations
      createdTime: f.createdTime || f.dateCreated || new Date().toISOString(),
      modifiedTime: f.modifiedTime || f.lastUpdated || new Date().toISOString(),
      // Handle user variations. Script sometimes returns owner object or just email
      lastModifyingUser: f.lastModifyingUser || (f.owner ? { displayName: f.owner.name || f.owner.email, emailAddress: f.owner.email } : { displayName: 'Admin' })
    }));

  } catch (error: any) {
    console.error("Failed to fetch drive files:", error);
    throw new Error(error.message || "Lỗi kết nối đến Google Apps Script");
  }
};

export const getDownloadLink = (file: DriveFile): string => {
  // If API provided a direct download link, use it
  if (file.webContentLink) return file.webContentLink;
  
  // Otherwise construct the standard Google Drive export link
  return `https://drive.google.com/uc?export=download&id=${file.id}`;
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
