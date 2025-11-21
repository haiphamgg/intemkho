
import React, { useState, useMemo, useEffect } from 'react';
import { DataInput } from './components/DataInput';
import { TicketSelector } from './components/TicketSelector';
import { QRGrid } from './components/QRGrid';
import { LookupPage } from './components/LookupPage';
import { DriveFileBrowser } from './components/DriveFileBrowser';
import { DeviceRow } from './types';
import { analyzeTicketData } from './services/geminiService';
import { fetchGoogleSheetData, SPREADSHEET_ID } from './services/sheetService';
import { Sparkles, LayoutGrid, FolderOpen, Search as SearchIcon, AlertTriangle, Settings, Database } from 'lucide-react';

// --- CONFIG ---
// Cấu hình chỉ số cột dựa trên cấu trúc Sheet "DATA":
// 0:STT, 1:Type, 2:Partner, 3:Section, 4:TicketNo, 5:Date, 
// 6:Code, 7:Name, 8:Details, 9:Unit, 10:Brand, 11:Country, 
// 12:Model, 13:Warranty, 14:Qty, 15:Price, 16:Total, 17:Docs
const COL_TYPE = 1;
const COL_PARTNER = 2;
const COL_SECTION = 3;
const COL_TICKET = 4;
const COL_DATE = 5;
const COL_NAME = 7;
const COL_MODEL = 12;
const COL_WARRANTY = 13;

const DOCS_FOLDER_ID = '16khjeVK8e7evRXQQK7z9IJit4yCrO9f1';
const MATERIALS_FOLDER_ID = '1IUwHzC02O4limzpg7wPQEMpDB9uc5Ui8';

type ViewMode = 'print' | 'lookup' | 'documents' | 'materials';

export default function App() {
  const [rawData, setRawData] = useState<string[][]>([]);
  const [selectedTicket, setSelectedTicket] = useState<string>('');
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('print');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const handleLoadData = async () => {
    setIsLoading(true);
    setConnectionError(null);
    try {
      // Fetch from A2 to skip header row
      const data = await fetchGoogleSheetData('DATA', 'A2:Z');
      if (data && data.length > 0) {
        setRawData(data);
        setLastUpdated(new Date());
      } else {
        setRawData([]);
      }
    } catch (err: any) {
      console.error("Failed to load data", err);
      setConnectionError(err.message || "Không thể kết nối đến Google Sheet.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleLoadData();
  }, []);

  const parsedData: DeviceRow[] = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];

    return rawData
      .map((row, index) => {
        const ticketNumber = row[COL_TICKET]?.trim() || '';
        if (!ticketNumber) return null;

        const deviceName = row[COL_NAME]?.trim() || '';
        const partner = row[COL_PARTNER]?.trim() || '';
        const section = row[COL_SECTION]?.trim() || '';
        const date = row[COL_DATE]?.trim() || '';
        const modelSerial = row[COL_MODEL]?.trim() || '';
        const warranty = row[COL_WARRANTY]?.trim() || '';
        const type = row[COL_TYPE]?.trim() || '';
        
        const isPX = type === 'PX' || ticketNumber.toUpperCase().startsWith("PX");
        const labelProvider = isPX ? "Khoa phòng: " : "Nhà CC: ";
        const labelDate = isPX ? "Ngày cấp: " : "Ngày giao: ";

        // Format QR: Tên | NCC/KP | BP | Ngày | Model | BH
        const qrContent = `Tên thiết bị: ${deviceName}\n` +
                          `${labelProvider}${partner}\n` +
                          `Bộ phận sử dụng: ${section}\n` +
                          `${labelDate}${date}\n` +
                          `Model, Serial: ${modelSerial}\n` +
                          `Bảo hành: ${warranty}`;

        return {
          rowId: index,
          ticketNumber: ticketNumber,
          qrContent: qrContent,
          department: section,
          provider: partner,
          deviceName: deviceName,
          modelSerial: modelSerial,
          fullData: row
        } as DeviceRow;
      })
      .filter((item): item is DeviceRow => item !== null);
  }, [rawData]);

  const uniqueTickets = useMemo(() => {
    const tickets = new Set(parsedData.map(d => d.ticketNumber));
    return Array.from(tickets).sort();
  }, [parsedData]);

  const selectedItems = useMemo(() => {
    return parsedData.filter(d => d.ticketNumber === selectedTicket);
  }, [parsedData, selectedTicket]);

  useEffect(() => {
    if (viewMode === 'print' && selectedTicket && selectedItems.length > 0) {
      const runAnalysis = async () => {
        setIsAnalyzing(true);
        const result = await analyzeTicketData(selectedTicket, selectedItems);
        setAiAnalysis(result);
        setIsAnalyzing(false);
      };
      runAnalysis();
    } else {
      setAiAnalysis('');
    }
  }, [selectedTicket, selectedItems, viewMode]);

  const renderContent = () => {
    // Error State Display
    if (connectionError) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-red-50/50 p-6">
          <div className="bg-white p-8 rounded-2xl shadow-lg max-w-2xl w-full border border-red-100 text-center">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Lỗi kết nối dữ liệu</h2>
            <p className="text-red-600 font-medium mb-6 bg-red-50 p-3 rounded-lg border border-red-200 inline-block">
              {connectionError}
            </p>
            
            <div className="text-left bg-slate-50 p-5 rounded-xl border border-slate-200 mb-6">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-3">
                <Settings className="w-5 h-5 text-blue-600" />
                Hướng dẫn khắc phục:
              </h3>
              <ul className="space-y-3 text-sm text-slate-600 list-disc pl-5">
                <li>
                  <strong>Bước 1:</strong> Mở Google Sheet của bạn: <a href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`} target="_blank" className="text-blue-600 underline">Link Sheet</a>
                </li>
                <li>
                  <strong>Bước 2:</strong> Đảm bảo tên Sheet chứa dữ liệu là <span className="font-mono bg-slate-200 px-1 rounded mx-1">DATA</span>.
                </li>
                <li>
                  <strong>Bước 3:</strong> Nhấn nút <span className="font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Share</span> (Chia sẻ) góc trên bên phải.
                </li>
                <li>
                  <strong>Bước 4:</strong> Ở phần "General access", chọn <span className="font-bold">"Anyone with the link"</span> (Bất kỳ ai có liên kết).
                </li>
              </ul>
            </div>

            <button 
              onClick={handleLoadData}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg shadow-blue-500/30 transition-all active:scale-95 flex items-center gap-2 mx-auto"
            >
              <Sparkles className="w-5 h-5" />
              Thử lại
            </button>
          </div>
        </div>
      );
    }

    switch (viewMode) {
      case 'print':
        return (
          <div className="h-full flex flex-col md:flex-row">
            <div className="w-full md:w-80 bg-white border-r border-slate-200 p-4 overflow-y-auto flex flex-col gap-4 shrink-0 no-print shadow-lg z-10">
              <DataInput 
                onReload={handleLoadData} 
                isLoading={isLoading} 
                lastUpdated={lastUpdated}
                rowCount={parsedData.length}
              />
              <TicketSelector 
                tickets={uniqueTickets} 
                selectedTicket={selectedTicket} 
                onSelect={setSelectedTicket} 
              />
              {selectedTicket && (
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 shadow-sm mt-auto">
                  <div className="flex items-center gap-2 mb-2 text-indigo-700">
                    <Sparkles className="w-4 h-4" />
                    <h3 className="font-semibold text-sm">AI Phân Tích</h3>
                  </div>
                  <div className="text-xs text-slate-700 whitespace-pre-line">
                    {isAnalyzing ? "Đang xử lý..." : aiAnalysis}
                  </div>
                </div>
              )}
            </div>
            <main className="flex-1 bg-slate-100 overflow-hidden p-4 print:p-0 print:bg-white">
              <QRGrid items={selectedItems} selectedTicket={selectedTicket} />
            </main>
          </div>
        );
      case 'lookup': return <LookupPage data={parsedData} onReload={handleLoadData} isLoading={isLoading} lastUpdated={lastUpdated} />;
      case 'documents': return <DriveFileBrowser folderId={DOCS_FOLDER_ID} title="Chứng từ Kho" description="Danh sách phiếu xuất nhập kho." />;
      case 'materials': return <DriveFileBrowser folderId={MATERIALS_FOLDER_ID} title="Tài liệu kỹ thuật" description="Hướng dẫn sử dụng & thông số." />;
      default: return null;
    }
  };

  const NavButton = ({ mode, icon: Icon, label, colorClass }: any) => (
    <button
      onClick={() => setViewMode(mode)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
        viewMode === mode ? `bg-white shadow-md ${colorClass}` : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex flex-col md:flex-row gap-4 justify-between shrink-0 no-print shadow-sm z-20 relative">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg shadow-lg shadow-blue-500/30">
             <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">QR Print Master</h1>
            <p className="text-xs text-slate-500">Kho thiết bị & Vật tư</p>
          </div>
        </div>

        <div className="flex flex-1 overflow-x-auto no-scrollbar bg-slate-100 p-1.5 rounded-xl max-w-full md:max-w-2xl justify-between md:justify-start gap-1">
          <NavButton mode="print" icon={LayoutGrid} label="In Tem QR" colorClass="text-blue-600" />
          <NavButton mode="lookup" icon={SearchIcon} label="Tra Cứu" colorClass="text-purple-600" />
          <div className="w-px bg-slate-300 mx-2 my-1 hidden md:block"></div>
          <NavButton mode="documents" icon={FolderOpen} label="Chứng từ" colorClass="text-amber-600" />
          <NavButton mode="materials" icon={FolderOpen} label="Tài liệu" colorClass="text-emerald-600" />
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        {renderContent()}
      </div>
    </div>
  );
}
