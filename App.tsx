
import React, { useState, useMemo, useEffect } from 'react';
import { DataInput } from './components/DataInput';
import { TicketSelector } from './components/TicketSelector';
import { QRGrid } from './components/QRGrid';
import { LookupPage } from './components/LookupPage';
import { DeviceRow } from './types';
import { analyzeTicketData } from './services/geminiService';
import { fetchGoogleSheetData } from './services/sheetService';
import { Sparkles, Printer, Search as SearchIcon, LayoutGrid } from 'lucide-react';

// Constants for column indices based on range A3:U
// A=0, B=1, C=2, D=3, E=4, ... H=7, ... S=18
const COL_PROVIDER = 2; // Column C (Khoa phòng / Nhà CC)
const COL_DEPT = 3;     // Column D (Bộ phận sử dụng)
const COL_TICKET = 4;   // Column E (Số phiếu)
const COL_DATE = 5;     // Column F (Ngày)
const COL_NAME = 7;     // Column H (Tên thiết bị)
const COL_MODEL = 12;   // Column M (Model, Serial)
const COL_WARRANTY = 13;// Column N (Bảo hành)
const COL_QR = 18;      // Column S (Mã QR/Barcode)

type ViewMode = 'print' | 'lookup';

export default function App() {
  const [rawData, setRawData] = useState<string[][]>([]);
  const [selectedTicket, setSelectedTicket] = useState<string>('');
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('print');

  // Data Fetching Logic
  const handleLoadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchGoogleSheetData();
      if (data && data.length > 0) {
        setRawData(data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-load on mount
  useEffect(() => {
    handleLoadData();
  }, []);

  // Process raw data into structured objects
  const parsedData: DeviceRow[] = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];

    // Raw data includes headers at index 0, data starts at index 1
    return rawData.slice(1)
      .map((row, index) => {
        const ticketNumber = row[COL_TICKET]?.trim() || '';
        let qrContent = row[COL_QR]?.trim() || '';
        const modelSerial = row[COL_MODEL]?.trim() || '';
        
        // Fallback Logic: Reconstruct QR if missing
        if (!qrContent && ticketNumber) {
          const colH = row[COL_NAME]?.trim() || '';
          const colC = row[COL_PROVIDER]?.trim() || '';
          const colD = row[COL_DEPT]?.trim() || '';
          const colF = row[COL_DATE]?.trim() || '';
          const colN = row[COL_WARRANTY]?.trim() || '';

          const isPX = ticketNumber.toUpperCase().startsWith("PX");
          const labelProvider = isPX ? "Khoa phòng: " : "Nhà CC: ";
          const labelDate = isPX ? "Ngày cấp: " : "Ngày giao: ";
          
          const formatDate = (d: string) => {
            if (!d) return "";
            try {
                const dateObj = new Date(d);
                if (!isNaN(dateObj.getTime())) {
                    return `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
                }
            } catch (e) {}
            return d;
          };

          qrContent = `Tên thiết bị: ${colH}\n` +
                      `${labelProvider}${colC}\n` +
                      `Bộ phận sử dụng: ${colD}\n` +
                      `${labelDate}${formatDate(colF)}\n` +
                      `Model, Serial: ${modelSerial}\n` +
                      `Bảo hành: ${formatDate(colN)}`;
        }

        if (!ticketNumber && !qrContent) return null;

        return {
          rowId: index,
          ticketNumber: ticketNumber,
          qrContent: qrContent,
          department: row[COL_DEPT]?.trim() || '',
          deviceName: row[COL_NAME]?.trim() || '',
          modelSerial: modelSerial,
          fullData: row
        } as DeviceRow;
      })
      .filter((item): item is DeviceRow => item !== null && item.ticketNumber !== '');
  }, [rawData]);

  // Extract unique tickets
  const uniqueTickets = useMemo(() => {
    const tickets = new Set(parsedData.map(d => d.ticketNumber));
    return Array.from(tickets).sort();
  }, [parsedData]);

  // Filter items for the selected ticket
  const selectedItems = useMemo(() => {
    return parsedData.filter(d => d.ticketNumber === selectedTicket);
  }, [parsedData, selectedTicket]);

  // AI Analysis Effect
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

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header - Hidden when printing */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 no-print shadow-sm z-20 relative">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-white p-2 rounded-lg">
             <Printer className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">QR Kho Thiết Bị</h1>
            <p className="text-xs text-slate-500 hidden sm:block">Quản lý in tem & Tra cứu</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('print')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'print' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            In Tem
          </button>
          <button
            onClick={() => setViewMode('lookup')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'lookup' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <SearchIcon className="w-4 h-4" />
            Tra Cứu
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative">
        
        {viewMode === 'print' ? (
          <div className="h-full flex flex-col md:flex-row">
            {/* Sidebar Controls */}
            <div className="w-full md:w-80 bg-white border-r border-slate-200 p-4 overflow-y-auto flex flex-col gap-4 shrink-0 no-print shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
              
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

              {/* AI Analysis Card */}
              {selectedTicket && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100 shadow-sm mt-auto">
                  <div className="flex items-center gap-2 mb-2 text-indigo-700">
                    <Sparkles className="w-4 h-4" />
                    <h3 className="font-semibold text-sm">AI Phân Tích</h3>
                  </div>
                  
                  {isAnalyzing ? (
                    <div className="flex items-center gap-2 text-xs text-indigo-400 animate-pulse">
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                      Đang xử lý...
                    </div>
                  ) : (
                    <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                      {aiAnalysis}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Main Preview/Print Area */}
            <main className="flex-1 bg-slate-100 overflow-hidden p-4 print:p-0 print:bg-white print:overflow-visible flex flex-col">
              <QRGrid items={selectedItems} selectedTicket={selectedTicket} />
            </main>
          </div>
        ) : (
          /* Lookup View */
          <LookupPage data={parsedData} />
        )}
      </div>
    </div>
  );
}
