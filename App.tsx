
import React, { useState, useMemo, useEffect } from 'react';
import { DataInput } from './components/DataInput';
import { TicketSelector } from './components/TicketSelector';
import { QRGrid } from './components/QRGrid';
import { LookupPage } from './components/LookupPage';
import { DriveFileBrowser } from './components/DriveFileBrowser';
import { DashboardHome } from './components/DashboardHome';
import { AdminLogin } from './components/AdminLogin';
import { WarehouseForm } from './components/WarehouseForm';
import { InventoryReport } from './components/InventoryReport';
import { MasterData } from './components/MasterData';
import { DeviceRow } from './types';
import { analyzeTicketData } from './services/geminiService';
import { fetchGoogleSheetData } from './services/sheetService';
import { 
  LayoutGrid, Search as SearchIcon, Database, Sparkles, AlertTriangle, 
  FileText, FolderOpen, Menu, X, Settings, LogOut, QrCode, ChevronRight,
  LayoutDashboard, FileInput, FileOutput, BarChart3, List, Lock, KeyRound, Link, ChevronDown, ChevronUp
} from 'lucide-react';

// CẤU HÌNH CỘT
const COL_TICKET = 4;   // E: Số phiếu
const COL_QR = 18;      // S: Mã QR
const COL_NAME = 7;     // H: Tên thiết bị
const COL_MODEL = 12;   // M: Model
const COL_DEPT = 3;     // D: Bộ phận

// ID MẶC ĐỊNH
const DEFAULT_SHEET_ID = '1vonMQNPV2SI_XxmZ7h781QHS2fZBMSMbIxWQjS7z1B4';
const DEFAULT_VOUCHER_ID = '16khjeVK8e7evRXQQK7z9IJit4yCrO9f1'; 
const DEFAULT_DOC_ID = '1IUwHzC02O4limzpg7wPQEMpDB9uc5Ui8';     
// Fallback URL chỉ để demo
const DEFAULT_SCRIPT_URL_DEMO = "https://script.google.com/macros/s/AKfycbyqEtmuL0lOwh_Iibgs7oxx0lSC1HG1ubNcPc6KINu8a-aC3adsK9qTRj9LCjX4z7iq/exec";

const DEFAULT_ADMIN_PIN = "@3647"; 

// --- CẤU HÌNH API KEY CHO AI ---
// Bạn có thể thay đổi key này trực tiếp tại đây
const USER_API_KEY = "AIzaSyAF5gvD_y7IElH3IK-4UTiSm9SMxeUg1ac";

type ViewMode = 'dashboard' | 'print' | 'lookup' | 'vouchers' | 'drive' | 'warehouse-in' | 'warehouse-out' | 'report' | 'master';

// Hàm tiện ích format ngày tháng
const formatDate = (input: string): string => {
  if (!input) return '';
  try {
    if (input.includes('Date(')) {
        const parts = input.match(/\d+/g);
        if (parts && parts.length >= 3) {
            const d = new Date(Number(parts[0]), Number(parts[1]), Number(parts[2]));
            return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
        }
    }
    const d = new Date(input);
    if (isNaN(d.getTime())) return input; 
    if (!isNaN(Number(input)) && Number(input) < 10000) return input;
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return input;
  }
};

export default function App() {
  const [rawData, setRawData] = useState<string[][]>([]);
  
  // State lưu cấu hình ID & URL
  const [sheetId, setSheetId] = useState<string>(() => localStorage.getItem('SHEET_ID') || DEFAULT_SHEET_ID);
  const [voucherFolderId, setVoucherFolderId] = useState<string>(() => localStorage.getItem('VOUCHER_FOLDER_ID') || DEFAULT_VOUCHER_ID);
  const [docFolderId, setDocFolderId] = useState<string>(() => localStorage.getItem('DOC_FOLDER_ID') || DEFAULT_DOC_ID);
  const [scriptUrl, setScriptUrl] = useState<string>(() => localStorage.getItem('SCRIPT_URL') || '');

  const [selectedTicket, setSelectedTicket] = useState<string>('');
  
  // State mới để truyền từ khóa tìm kiếm sang tab chứng từ
  const [voucherSearchTerm, setVoucherSearchTerm] = useState<string>('');

  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
      // Mặc định khách vào sẽ thấy Dashboard
      return 'dashboard';
  });
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileTicketListOpen, setMobileTicketListOpen] = useState(false);
  
  // ADMIN STATES
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newPin, setNewPin] = useState('');

  useEffect(() => {
    // Check both session and persistent storage
    const sessionAuth = sessionStorage.getItem('IS_ADMIN');
    const localAuth = localStorage.getItem('IS_ADMIN_PERSIST');

    if (sessionAuth === 'true' || localAuth === 'true') {
      if (!isAdmin) setIsAdmin(true);
      if (localAuth === 'true' && sessionAuth !== 'true') {
           sessionStorage.setItem('IS_ADMIN', 'true'); // Sync session
      }
    } else {
        if (isAdmin) setIsAdmin(false);
        // If not admin and current view is restricted, redirect to lookup
        // DASHBOARD is now allowed for guests
        if (['warehouse-in', 'warehouse-out', 'report', 'master'].includes(viewMode)) {
            setViewMode('dashboard');
        }
    }
  }, [isAdmin, viewMode]);
  
  const handleLoadData = async (targetSheetId: string = sheetId) => {
    const idToUse = targetSheetId.trim() || DEFAULT_SHEET_ID;
    
    localStorage.setItem('SHEET_ID', idToUse);
    if (idToUse !== sheetId) setSheetId(idToUse);

    setIsLoading(true);
    setConnectionError(null);
    try {
      // 1. Fetch Dữ liệu chính
      const data = await fetchGoogleSheetData(idToUse, 'DULIEU');
      if (data && Array.isArray(data) && data.length > 0) {
        setRawData(data);
        setLastUpdated(new Date());
      } else {
        setRawData([]);
        setConnectionError("Sheet 'DULIEU' không có dữ liệu hoặc tên Sheet không đúng.");
      }

      // 2. TỰ ĐỘNG LẤY SCRIPT URL TỪ SHEET 'DMDC!A2'
      try {
          const configData = await fetchGoogleSheetData(idToUse, 'DMDC!A1:A2');
          if (configData && configData.length > 0 && configData[0][0]) {
              const fetchedUrl = configData[0][0].trim();
              if (fetchedUrl.startsWith('http')) {
                  console.log("Đã tự động cập nhật Script URL từ DMDC!A2");
                  setScriptUrl(fetchedUrl);
                  localStorage.setItem('SCRIPT_URL', fetchedUrl);
              }
          }
      } catch (configErr) {
          console.warn("Không tìm thấy Script URL tại DMDC!A2", configErr);
      }

    } catch (err: any) {
      setConnectionError(err.message || "Không thể kết nối đến Google Sheet.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleLoadData(sheetId);
  }, []);

  const handleSaveConfig = () => {
    localStorage.setItem('SHEET_ID', sheetId);
    localStorage.setItem('VOUCHER_FOLDER_ID', voucherFolderId);
    localStorage.setItem('DOC_FOLDER_ID', docFolderId);
    localStorage.setItem('SCRIPT_URL', scriptUrl); 
    
    // Save new PIN if provided
    if (newPin && newPin.trim().length >= 4) {
        localStorage.setItem('ADMIN_PIN', newPin.trim());
        alert("Đã cập nhật cấu hình và mã PIN thành công!");
    } else if (newPin && newPin.trim().length < 4) {
        alert("Mã PIN phải có ít nhất 4 ký tự.");
        return;
    }

    handleLoadData(sheetId);
    setShowSettings(false);
    setNewPin('');
  };

  const handleSettingsClick = () => {
    if (isAdmin) {
      setNewPin(''); 
      setShowSettings(true);
    } else {
      setShowLogin(true);
    }
  };

  const handleLogin = (pin: string, remember: boolean = false) => {
    const currentPin = localStorage.getItem('ADMIN_PIN') || DEFAULT_ADMIN_PIN;
    if (pin === currentPin) {
      setIsAdmin(true);
      sessionStorage.setItem('IS_ADMIN', 'true');
      if (remember) {
          localStorage.setItem('IS_ADMIN_PERSIST', 'true');
      }
      setViewMode('dashboard'); 
      setShowLogin(false);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setIsAdmin(false);
    sessionStorage.removeItem('IS_ADMIN');
    localStorage.removeItem('IS_ADMIN_PERSIST'); 
    setShowSettings(false);
    setViewMode('dashboard'); 
  };

  const handleQuickLookup = (ticket: string) => {
    setVoucherSearchTerm(ticket);
    setViewMode('vouchers');
  };

  const parsedData: DeviceRow[] = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];

    return rawData
      .map((row, index) => {
        const ticketNumber = row[COL_TICKET] ? String(row[COL_TICKET]).trim() : '';
        if (!ticketNumber || ticketNumber.toUpperCase() === 'SỐ PHIẾU' || ticketNumber.toUpperCase().includes('TICKET')) return null;

        const deviceName = row[COL_NAME] ? String(row[COL_NAME]).trim() : 'Thiết bị';
        let qrContent = row[COL_QR] ? String(row[COL_QR]).trim() : '';

        if (!qrContent || qrContent === '#N/A' || qrContent.startsWith('Error') || qrContent.trim() === '') {
            const provider = row[2] || ''; 
            const dept = row[3] || ''; 
            const rawDate = row[5] || ''; 
            const rawWarranty = row[13] || ''; 
            
            const date = formatDate(rawDate);
            const warranty = formatDate(rawWarranty);
            const model = row[12] || ''; 
            
            const isPX = ticketNumber.toUpperCase().startsWith('PX');
            const providerLabel = isPX ? "Khoa phòng: " : "Nhà CC: ";
            const dateLabel = isPX ? "Ngày cấp: " : "Ngày giao: ";

            qrContent = `Tên thiết bị: ${deviceName}\n${providerLabel}${provider}\nBộ phận sử dụng: ${dept}\n${dateLabel}${date}\nModel, Serial: ${model}\nBảo hành: ${warranty}`;
        }

        return {
          rowId: index,
          ticketNumber: ticketNumber,
          qrContent: qrContent,
          department: row[COL_DEPT] || '',
          provider: row[2] || '', 
          deviceName: deviceName,
          modelSerial: row[COL_MODEL] || '',
          fullData: row
        } as DeviceRow;
      })
      .filter((item): item is DeviceRow => item !== null);
  }, [rawData]);

  const uniqueTickets = useMemo(() => {
    const tickets = new Set(parsedData.map(d => d.ticketNumber));
    return Array.from(tickets).sort().reverse();
  }, [parsedData]);

  const selectedItems = useMemo(() => {
    return parsedData.filter(d => d.ticketNumber === selectedTicket);
  }, [parsedData, selectedTicket]);

  useEffect(() => {
    if (viewMode === 'print' && selectedTicket && selectedItems.length > 0) {
      const runAnalysis = async () => {
        setIsAnalyzing(true);
        // Sử dụng User Key nếu có, fallback về env hoặc mặc định
        const result = await analyzeTicketData(selectedTicket, selectedItems, USER_API_KEY);
        setAiAnalysis(result);
        setIsAnalyzing(false);
      };
      runAnalysis();
    } else {
      setAiAnalysis('');
    }
  }, [selectedTicket, selectedItems, viewMode]);

  // --- UI COMPONENTS ---

  const SidebarItem = ({ mode, icon: Icon, label }: any) => {
    const isActive = viewMode === mode;
    return (
      <button
        onClick={() => { setViewMode(mode); setMobileMenuOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative
          ${isActive 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 font-semibold' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
      >
        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
        <span className="text-sm">{label}</span>
        {isActive && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
      </button>
    );
  };

  const getPageTitle = () => {
      switch(viewMode) {
          case 'dashboard': return 'Dashboard';
          case 'warehouse-in': return 'Nhập Kho Mới';
          case 'warehouse-out': return 'Xuất Kho';
          case 'report': return 'Báo Cáo Tồn Kho';
          case 'print': return 'In Tem Mã QR';
          case 'lookup': return 'Tra Cứu Thông Tin';
          case 'vouchers': return 'Kho Chứng Từ';
          case 'drive': return 'Tài Liệu Kỹ Thuật';
          case 'master': return 'Danh Mục Hệ Thống';
          default: return 'Trang chủ';
      }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* SIDEBAR (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 shrink-0 z-20 transition-all no-print shadow-xl">
         {/* ... Sidebar Content ... */}
         <div className="p-6 flex items-center gap-3 border-b border-slate-800/50">
             <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white transform hover:scale-105 transition-transform duration-300">
                <Database className="w-6 h-6" />
             </div>
             <div>
                <h1 className="text-sm font-bold text-white tracking-tight leading-tight">Quản lý kho <br/> thiết bị</h1>
                <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mt-1">V.2.0 Enterprise</p>
             </div>
         </div>
         <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
             {/* Public Items */}
             <SidebarItem mode="dashboard" icon={LayoutDashboard} label="Dashboard" />
             <SidebarItem mode="print" icon={QrCode} label="In Tem QR" />
             <SidebarItem mode="lookup" icon={SearchIcon} label="Tra Cứu" />
             <SidebarItem mode="vouchers" icon={FileText} label="Kho Chứng Từ" />
             <SidebarItem mode="drive" icon={FolderOpen} label="Tài Liệu Kỹ thuật" />

             {isAdmin && (
                 <>
                    <div className="text-[10px] font-bold text-slate-500 uppercase px-4 mb-2 mt-4 tracking-wider flex items-center gap-2">
                        <Lock className="w-3 h-3"/> Quản Trị
                    </div>
                    <SidebarItem mode="report" icon={BarChart3} label="Báo Cáo Tồn" />
                    <SidebarItem mode="warehouse-in" icon={FileInput} label="Nhập Kho" />
                    <SidebarItem mode="warehouse-out" icon={FileOutput} label="Xuất Kho" />
                    <SidebarItem mode="master" icon={List} label="Danh Mục" />
                 </>
             )}
         </nav>
         <div className="p-4 border-t border-slate-800/50">
            <button 
                onClick={handleSettingsClick}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border
                    ${isAdmin 
                      ? 'bg-slate-800 text-white border-slate-700' 
                      : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
                <div className={`p-1.5 rounded-lg ${isAdmin ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                   <Settings className={`w-4 h-4 ${isAdmin ? 'animate-spin-slow' : ''}`} />
                </div>
                <div className="flex-1 text-left">
                    <div className="text-sm font-medium">{isAdmin ? 'Admin' : 'Đăng nhập'}</div>
                    <div className="text-[10px] opacity-60 truncate">{isAdmin ? 'Đã đăng nhập' : 'Yêu cầu quyền'}</div>
                </div>
            </button>
         </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-slate-900 z-50 px-4 py-3 flex items-center justify-between shadow-md no-print">
         <div className="flex items-center gap-2 text-white">
             <Database className="w-6 h-6 text-blue-500" />
             <span className="font-bold text-sm">Quản lý kho thiết bị</span>
         </div>
         <button onClick={() => setMobileMenuOpen(true)} className="text-slate-300">
             <Menu className="w-6 h-6" />
         </button>
      </div>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
         <div className="fixed inset-0 z-[60] md:hidden">
             <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
             <div className="absolute top-0 bottom-0 left-0 w-3/4 max-w-xs bg-slate-900 shadow-2xl p-4 flex flex-col animate-in slide-in-from-left duration-200">
                 <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
                     <div className="flex items-center gap-2 text-white">
                        <Database className="w-6 h-6 text-blue-500" />
                        <span className="font-bold">Menu</span>
                     </div>
                     <button onClick={() => setMobileMenuOpen(false)}><X className="w-6 h-6 text-slate-400" /></button>
                 </div>
                 <div className="space-y-2 flex-1 overflow-y-auto">
                     <SidebarItem mode="dashboard" icon={LayoutDashboard} label="Dashboard" />
                     <div className="text-xs font-bold text-slate-500 uppercase px-2 mb-1 mt-2">Tiện ích</div>
                     <SidebarItem mode="print" icon={QrCode} label="In Tem QR" />
                     <SidebarItem mode="lookup" icon={SearchIcon} label="Tra Cứu" />
                     <SidebarItem mode="vouchers" icon={FileText} label="Kho Chứng Từ" />
                     <SidebarItem mode="drive" icon={FolderOpen} label="Tài Liệu Kỹ thuật" />

                     {isAdmin && (
                         <>
                             <div className="text-xs font-bold text-slate-500 uppercase px-2 mb-1 mt-2">Quản trị</div>
                             <SidebarItem mode="report" icon={BarChart3} label="Báo Cáo Tồn" />
                             <SidebarItem mode="warehouse-in" icon={FileInput} label="Nhập Kho" />
                             <SidebarItem mode="warehouse-out" icon={FileOutput} label="Xuất Kho" />
                             <SidebarItem mode="master" icon={List} label="Danh Mục" />
                         </>
                     )}
                 </div>
                 <div className="pt-4 border-t border-slate-800">
                     <button onClick={handleSettingsClick} className="flex items-center gap-3 text-slate-400 px-4 py-2 w-full">
                         <Settings className="w-5 h-5" />
                         <span>{isAdmin ? 'Cấu hình Admin' : 'Đăng nhập Admin'}</span>
                     </button>
                 </div>
             </div>
         </div>
      )}

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-100 relative pt-14 md:pt-0">
         {/* TOP BAR (Desktop) */}
         <header className="hidden md:flex h-16 bg-white border-b border-slate-200 px-6 items-center justify-between shrink-0 no-print">
            {/* ... Desktop Header ... */}
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                {getPageTitle()}
                {isLoading && <span className="text-xs font-normal text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full animate-pulse">Đang đồng bộ...</span>}
            </h2>
            <div className="flex items-center gap-4">
                 <div className="flex flex-col items-end">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Dữ liệu nguồn</span>
                    <span className="text-xs text-slate-400 font-mono">
                         {lastUpdated ? `Cập nhật: ${lastUpdated.toLocaleTimeString()}` : 'Chưa tải'}
                    </span>
                 </div>
                 <div className="h-8 w-[1px] bg-slate-200"></div>
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 border-white shadow-sm ring-2 ${isAdmin ? 'bg-green-100 text-green-600 ring-green-50' : 'bg-slate-100 text-slate-600 ring-slate-50'}`}>
                    {isAdmin ? 'AD' : 'GS'}
                 </div>
            </div>
         </header>

         {/* ERROR BANNER */}
         {connectionError && (
             <div className="bg-red-50 border-b border-red-100 text-red-700 px-6 py-2 flex items-center justify-between text-sm animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                   <AlertTriangle className="w-4 h-4" />
                   {connectionError}
                </div>
                <button onClick={() => handleLoadData(sheetId)} className="font-bold underline hover:text-red-800">Thử lại ngay</button>
             </div>
         )}

         {/* CONTENT AREA */}
         <main className="flex-1 overflow-hidden relative">
            {/* ADMIN MODALS */}
            {showLogin && <AdminLogin onLogin={handleLogin} onClose={() => setShowLogin(false)} />}
            
            {showSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4" onClick={() => setShowSettings(false)}>
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-slate-100 font-bold text-slate-800 flex justify-between items-center bg-slate-50">
                        <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-blue-600"/>
                            <span>Cấu hình hệ thống (Admin)</span>
                        </div>
                        <button onClick={() => setShowSettings(false)}><X className="w-5 h-5 text-slate-400"/></button>
                    </div>
                    <div className="p-4 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                             <label className="text-sm font-bold text-blue-700 mb-1 flex items-center gap-2">
                                <Link className="w-4 h-4" />
                                Script URL (Tự động từ Sheet)
                             </label>
                             <input 
                                value={scriptUrl}
                                onChange={(e) => setScriptUrl(e.target.value)}
                                placeholder="Tự động lấy từ DMDC!A2..."
                                className="w-full p-2 border border-blue-300 rounded font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                readOnly={true}
                            />
                            <p className="text-[10px] text-blue-500 mt-1">
                                URL này được tự động lấy từ ô <b>A2</b> của sheet <b>DMDC</b>. Hãy cập nhật trong file Sheet nếu muốn thay đổi.
                            </p>
                        </div>
                        {/* Other config inputs */}
                         <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">Google Sheet ID (Dữ liệu)</label>
                            <input 
                                value={sheetId}
                                onChange={(e) => setSheetId(e.target.value)}
                                className="w-full p-2 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                         <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                             <label className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                                <KeyRound className="w-4 h-4" />
                                Đổi mã PIN Admin
                             </label>
                             <input 
                                type="text"
                                placeholder="Nhập PIN mới (Để trống nếu không đổi)"
                                value={newPin}
                                onChange={(e) => setNewPin(e.target.value)}
                                className="w-full p-2 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="pt-2 flex gap-2">
                            {isAdmin && (
                                <button onClick={handleLogout} className="flex-1 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 flex items-center justify-center gap-2">
                                    <LogOut className="w-4 h-4" /> Đăng xuất
                                </button>
                            )}
                            <button onClick={handleSaveConfig} className="flex-[2] py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-md shadow-blue-500/20">
                                Lưu & Cập nhật
                            </button>
                        </div>
                    </div>
                </div>
                </div>
            )}

            {/* VIEWS */}
            {viewMode === 'dashboard' && (
                <DashboardHome 
                    data={parsedData} 
                    lastUpdated={lastUpdated} 
                    onNavigate={setViewMode} 
                    isAdmin={isAdmin} 
                    apiKey={USER_API_KEY} 
                />
            )}

            {viewMode === 'warehouse-in' && isAdmin && (
               <div className="h-full animate-in fade-in duration-300">
                  <WarehouseForm type="import" sheetId={sheetId} scriptUrl={scriptUrl} />
               </div>
            )}

            {viewMode === 'warehouse-out' && isAdmin && (
               <div className="h-full animate-in fade-in duration-300">
                  <WarehouseForm type="export" sheetId={sheetId} scriptUrl={scriptUrl} />
               </div>
            )}

            {viewMode === 'report' && isAdmin && (
                <div className="h-full animate-in fade-in duration-300">
                   <InventoryReport data={parsedData} isLoading={isLoading} />
                </div>
            )}

            {viewMode === 'master' && isAdmin && (
                <div className="h-full animate-in fade-in duration-300">
                   <MasterData scriptUrl={scriptUrl} />
                </div>
            )}

            {viewMode === 'print' && (
              <div className="h-full flex flex-col md:flex-row animate-in fade-in duration-300 relative">
                {/* Mobile Toggle for Ticket List */}
                <div className="md:hidden bg-white p-2 border-b border-slate-200 flex justify-between items-center shadow-sm z-20">
                    <span className="text-sm font-bold text-slate-700">Chọn Phiếu In</span>
                    <button 
                        onClick={() => setMobileTicketListOpen(!mobileTicketListOpen)}
                        className="p-1.5 bg-slate-100 rounded text-slate-600"
                    >
                        {mobileTicketListOpen ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
                    </button>
                </div>

                <div className={`w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-4 overflow-y-auto flex flex-col gap-4 shrink-0 no-print shadow-xl z-10 
                    ${mobileTicketListOpen ? 'block absolute inset-0 z-30' : 'hidden md:flex'}
                `}>
                  {mobileTicketListOpen && (
                      <div className="md:hidden flex justify-end">
                          <button onClick={() => setMobileTicketListOpen(false)}><X className="w-6 h-6 text-slate-400"/></button>
                      </div>
                  )}
                  <DataInput 
                    onReload={handleLoadData} 
                    isLoading={isLoading} 
                    lastUpdated={lastUpdated}
                    rowCount={parsedData.length}
                    currentSheetId={sheetId}
                    isAdmin={isAdmin}
                  />
                  <div className="border-t border-slate-100 pt-4 flex-1">
                    <TicketSelector 
                        tickets={uniqueTickets} 
                        selectedTicket={selectedTicket} 
                        onSelect={(t) => {
                            setSelectedTicket(t);
                            setMobileTicketListOpen(false); // Close on selection
                        }} 
                    />
                  </div>
                </div>

                <main className="flex-1 bg-slate-100 overflow-hidden p-2 md:p-4 print:p-0 print:bg-white flex flex-col">
                   <QRGrid items={selectedItems} selectedTicket={selectedTicket} />
                </main>
              </div>
            )}
            
            {/* Other views remain unchanged */}
            {viewMode === 'lookup' && (
              <div className="h-full animate-in fade-in duration-300">
                <LookupPage 
                    data={parsedData} 
                    onReload={() => handleLoadData(sheetId)} 
                    isLoading={isLoading} 
                    lastUpdated={lastUpdated} 
                    onTicketSelect={handleQuickLookup} 
                />
              </div>
            )}

            {viewMode === 'vouchers' && (
               <div className="h-full animate-in fade-in duration-300">
                   <DriveFileBrowser 
                        folderId={voucherFolderId} 
                        title="Kho Chứng Từ" 
                        description="Biên bản, Phiếu xuất/nhập kho (PDF)" 
                        initialSearch={voucherSearchTerm}
                   />
               </div>
            )}
            
            {viewMode === 'drive' && (
               <div className="h-full animate-in fade-in duration-300">
                   <DriveFileBrowser folderId={docFolderId} title="Tài Liệu Kỹ Thuật" description="Catalogue, Hướng dẫn sử dụng" />
               </div>
            )}
         </main>
      </div>
    </div>
  );
}
