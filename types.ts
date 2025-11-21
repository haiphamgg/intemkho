
export interface DeviceRow {
  rowId: number;
  ticketNumber: string; // Column E
  qrContent: string;    // Column S
  deviceName: string;   // Column H
  department: string;   // Column D
  provider: string;     // Column C (New field)
  modelSerial: string;  // Column M
  fullData: string[];
}

export interface AnalysisResult {
  summary: string;
  count: number;
  isComplete: boolean;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink?: string;
  thumbnailLink?: string;
  size?: string | number;
  createdTime?: string;
}
