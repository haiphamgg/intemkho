
export interface DeviceRow {
  rowId: number;
  ticketNumber: string; 
  qrContent: string;    
  deviceName: string;   
  department: string;   
  provider: string;     
  modelSerial: string;  
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

export interface TransactionItem {
  deviceCode: string;
  deviceName: string;
  details: string;
  unit: string;
  manufacturer: string;
  country: string;
  modelSerial: string;
  warranty: string;
  quantity: number;
  price: number;
  total: number;
  notes: string;
}

export interface WarehouseTicket {
  ticketType: 'PN' | 'PX';
  ticketNumber: string;
  date: string;
  partner: string;
  section: string;
  items: TransactionItem[];
}
