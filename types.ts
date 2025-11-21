
export interface DeviceRow {
  rowId: number;
  ticketNumber: string; // Column E
  qrContent: string;    // Column S
  deviceName: string;   // Column H
  department: string;   // Column D
  modelSerial: string;  // Column M
  fullData: string[];
}

export interface AnalysisResult {
  summary: string;
  count: number;
  isComplete: boolean;
}
