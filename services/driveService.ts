
import { DriveFile } from '../types';

export const fetchDriveFiles = async (folderId: string, scriptUrl: string): Promise<DriveFile[]> => {
  if (!folderId) {
    throw new Error("Chưa cấu hình ID thư mục");
  }

  if (!scriptUrl) {
    throw new Error("Chưa cấu hình Script URL");
  }

  try {
    // Sử dụng POST để gửi action 'list_files'
    const response = await fetch(scriptUrl, {
      method: 'POST',
      body: JSON.stringify({
        action: 'list_files',
        folderId: folderId
      }),
      mode: 'cors',
      credentials: 'omit',
      redirect: 'follow',
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
    });
    
    if (!response.ok) {
      throw new Error(`Lỗi kết nối (${response.status})`);
    }

    const data = await response.json();
    
    if (data.status === 'error' || data.error) {
      throw new Error(data.message || data.error);
    }

    const rawFiles = data.files || [];

    // Normalize data to match DriveFile interface
    return rawFiles.map((f: any) => {
      let userName = 'Admin';
      let userEmail = '';
      
      const userObj = f.lastModifyingUser || f.owner || f.sharingUser;

      if (typeof userObj === 'string') {
        userName = userObj;
      } else if (userObj) {
        userName = userObj.displayName || userObj.name || userObj.emailAddress || 'Admin';
        userEmail = userObj.emailAddress || '';
      }
      
      if (userName === 'Admin' && f.lastModifyingUserName) {
          userName = f.lastModifyingUserName;
      }

      const created = f.createdTime || f.dateCreated || f.createdDate || null;
      const modified = f.modifiedTime || f.lastUpdated || f.updated || null;

      return {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        webViewLink: f.webViewLink || f.url, 
        webContentLink: f.webContentLink || f.downloadUrl,
        thumbnailLink: f.thumbnailLink,
        size: f.size,
        createdTime: created,
        modifiedTime: modified,
        lastModifyingUser: {
          displayName: userName,
          emailAddress: userEmail
        }
      };
    });

  } catch (error: any) {
    console.error("Failed to fetch drive files:", error);
    throw new Error(error.message || "Lỗi kết nối đến Google Apps Script");
  }
};

export const getDownloadLink = (file: DriveFile): string => {
  if (file.mimeType.includes('application/vnd.google-apps.document')) {
    return `https://docs.google.com/document/d/${file.id}/export?format=pdf`;
  }
  if (file.mimeType.includes('application/vnd.google-apps.spreadsheet')) {
    return `https://docs.google.com/spreadsheets/d/${file.id}/export?format=xlsx`;
  }
  if (file.mimeType.includes('application/vnd.google-apps.presentation')) {
    return `https://docs.google.com/presentation/d/${file.id}/export?format=pdf`;
  }

  if (file.webContentLink) return file.webContentLink;
  
  return `https://drive.google.com/uc?export=download&id=${file.id}`;
};

export const getPrintSource = (file: DriveFile): string => {
  if (file.mimeType.includes('image')) {
      return `https://drive.google.com/uc?export=view&id=${file.id}`;
  }

  if (file.mimeType.includes('application/vnd.google-apps')) {
     if (file.webViewLink) {
        return file.webViewLink.replace(/\/edit.*|\/view.*/, '/preview');
     }
     if (file.mimeType.includes('spreadsheet')) return `https://docs.google.com/spreadsheets/d/${file.id}/preview`;
     if (file.mimeType.includes('document')) return `https://docs.google.com/document/d/${file.id}/preview`;
  }
  
  if (file.mimeType.includes('pdf')) {
      return `https://drive.google.com/file/d/${file.id}/preview`;
  }

  return file.webViewLink || `https://drive.google.com/file/d/${file.id}/preview`;
};

export const formatFileSize = (bytes?: string | number): string => {
  if (bytes === undefined || bytes === null) return '-';
  
  const numBytes = typeof bytes === 'string' ? parseInt(bytes) : bytes;
  if (isNaN(numBytes) || numBytes === 0) return '-';
  
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
