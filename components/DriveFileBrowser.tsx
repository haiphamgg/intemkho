
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, Image as ImageIcon, File, User, 
  Search, RefreshCw, Settings, AlertCircle, 
  Loader2, Eye, X, Download, Printer, Calendar, FolderOpen, ChevronRight,
  ShoppingCart, Package, List, Gem, ArrowRight, Wrench, Building2
} from 'lucide-react';
import { DriveFile, DeviceRow } from '../types';
import { fetchDriveFiles, formatFileSize, getFileIcon, getDownloadLink, getPrintSource } from '../services/driveService';

const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbyqEtmuL0lOwh_Iibgs7oxx0lSC1HG1ubNcPc6KINu8a-aC3adsK9qTRj9LCjX4z7iq/exec";

interface DriveFileBrowserProps {
  folderId: string;
  title: string;
  description: string;
  initialSearch?: string;
  transactionData?: DeviceRow[]; // Optional prop to link with sheet data
}

// Helper: Format Currency
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export const DriveFileBrowser: React.FC<DriveFileBrowserProps> = ({ folderId, title, description, initialSearch, transactionData }) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(initialSearch || '');
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const printFrameRef = useRef<HTMLIFrameElement>(null);
  const [scriptUrl, setScriptUrl] = useState(DEFAULT_API_URL);
  const [showConfig, setShowConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State cho Hover Tooltip
  const [hoverInfo, setHoverInfo] = useState<{ id: string, data: any, top: number, left: number } | null>(null);

  // Sync initialSearch if it changes from parent
  useEffect(() => {
    if (initialSearch) {
        setSearchTerm(initialSearch);
    }
  }, [initialSearch]);

  const isVoucher = title.toLowerCase().includes('chứng từ');
  // Color themes
  const accentColor = isVoucher ? 'text-emerald-600' : 'text-blue-600';
  const bgColor = isVoucher ? 'bg-emerald-50' : 'bg-blue-50';
  const borderColor = isVoucher ? 'border-emerald-100' : 'border-blue-100';
  const ringColor = isVoucher ? 'focus:ring-emerald-500/20' : 'focus:ring-blue-500/20';

  // --- PRE-CALCULATE SUMMARIES (Vouchers OR Tech Docs) ---
  const dataSummaries = useMemo(() => {
    if (!transactionData) return {};
    const map: Record<string, any> = {};
    
    if (isVoucher) {
        // --- LOGIC CHO CHỨNG TỪ (GROUP BY TICKET) ---
        transactionData.forEach(row => {
            const t = row.ticketNumber;
            if (!map[t]) map[t] = { type: 'voucher', key: t, items: [], totalMoney: 0, totalQty: 0 };
            
            map[t].items.push(row);
            
            // Calc totals
            const qty = parseFloat(row.fullData[14]?.replace(/,/g, '') || '0') || 0;
            const money = parseFloat(row.fullData[16]?.replace(/,/g, '') || '0') || 0;
            
            map[t].totalQty += qty;
            map[t].totalMoney += money;
        });

        // Sort items for each ticket by Money DESC
        Object.keys(map).forEach(t => {
            map[t].items.sort((a: any, b: any) => {
                 const valA = parseFloat(a.fullData[16]?.replace(/,/g, '') || '0');
                 const valB = parseFloat(b.fullData[16]?.replace(/,/g, '') || '0');
                 return valB - valA;
            });
            map[t].topItems = map[t].items.slice(0, 5);
        });

    } else {
        // --- LOGIC CHO TÀI LIỆU KỸ THUẬT (GROUP BY MODEL/NAME) ---
        // Mục tiêu: Tìm xem tài liệu này (filename) nói về Model nào trong kho
        transactionData.forEach(row => {
            // Ưu tiên Model, nếu không có thì lấy tên thiết bị
            const keyRaw = (row.modelSerial && row.modelSerial.length > 2 && row.modelSerial !== 'N/A') 
                           ? row.modelSerial 
                           : row.deviceName;
            
            if (!keyRaw) return;
            const key = keyRaw.trim();
            if (key.length < 3) return; // Bỏ qua khóa quá ngắn để tránh match nhầm (VD: "A1", "01")

            if (!map[key]) {
                map[key] = { 
                    type: 'device', 
                    key: key, 
                    rows: [], 
                    departments: new Set() 
                };
            }
            
            map[key].rows.push(row);
            if (row.department) map[key].departments.add(row.department);
        });

        // Convert Set to Array for rendering
        Object.keys(map).forEach(k => {
            map[k].deptList = Array.from(map[k].departments);
            map[k].totalCount = map[k].rows.length;
        });
    }
    
    return map;
  }, [transactionData, isVoucher]);

  const loadFiles = async () => {
    if (!folderId) return;
    setLoading(true);
    setError(null);
    setSelectedFile(null);
    try {
      const data = await fetchDriveFiles(folderId, scriptUrl);
      setFiles(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Lỗi kết nối đến Google Drive API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [folderId, scriptUrl]);

  const filteredFiles = useMemo(() => {
    if (!searchTerm) return files;
    const lowerTerm = searchTerm.toLowerCase();
    return files.filter(f => 
      f.name.toLowerCase().includes(lowerTerm) || 
      (f.lastModifyingUser?.displayName || '').toLowerCase().includes(lowerTerm)
    );
  }, [files, searchTerm]);

  // Handle Hover logic
  const handleRowMouseEnter = (e: React.MouseEvent, file: DriveFile) => {
    // Find matched key in summary map
    const matchedKey = Object.keys(dataSummaries).find(k => file.name.toLowerCase().includes(k.toLowerCase()));
    
    if (matchedKey) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setHoverInfo({
            id: file.id,
            data: dataSummaries[matchedKey],
            top: rect.top,
            left: rect.left + (rect.width / 2) // Lấy vị trí GIỮA dòng
        });
    }
  };

  const handleRowMouseLeave = () => {
      setHoverInfo(null);
  };

  const renderIcon = (mimeType: string) => {
    const type = getFileIcon(mimeType);
    if (type === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
    if (type === 'image') return <ImageIcon className="w-5 h-5 text-purple-500" />;
    if (type === 'sheet') return <FileText className="w-5 h-5 text-emerald-600" />;
    if (type === 'doc') return <FileText className="w-5 h-5 text-blue-600" />;
    return <File className="w-5 h-5 text-slate-400" />;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--/--';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch { return dateStr; }
  };

  const getPreviewLink = (link: string) => {
    if (!link) return '';
    return link.replace('/view', '/preview');
  };

  const handlePrint = () => {
    if (!selectedFile) return;
    setIsPrinting(true);
    const printUrl = getPrintSource(selectedFile);
    const isImage = selectedFile.mimeType.includes('image');

    if (isImage && printFrameRef.current) {
        const iframe = printFrameRef.current;
        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(`<html><body style="margin:0;display:flex;justify-content:center;height:100vh;"><img src="${printUrl}" onload="setTimeout(()=>window.print(),500)" style="max-width:100%;height:auto;"/></body></html>`);
            doc.close();
            setTimeout(() => setIsPrinting(false), 3000);
            return;
        }
    }
    const w = 1000, h = 800;
    const l = (window.screen.width - w) / 2;
    const t = (window.screen.height - h) / 2;
    window.open(printUrl, 'PrintWindow', `width=${w},height=${h},top=${t},left=${l},scrollbars=yes`);
    setIsPrinting(false);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50/50 p-4 md:p-6 overflow-hidden relative">
      <iframe ref={printFrameRef} className="hidden" title="Print Frame" />

      {/* HOVER TOOLTIP PORTAL */}
      {hoverInfo && (
          <div 
            className="fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 w-80 animate-in fade-in zoom-in-95 duration-200 pointer-events-none"
            style={{ 
                top: Math.min(window.innerHeight - 300, Math.max(10, hoverInfo.top + 20)), 
                left: hoverInfo.left,
                transform: 'translateX(-50%)' // Căn giữa tooltip
            }}
          >
             {/* HEADER */}
             <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                 <div className="flex items-center gap-2 font-bold text-slate-800">
                     {hoverInfo.data.type === 'voucher' ? (
                        <>
                            <List className="w-4 h-4 text-emerald-600" />
                            Phiếu {hoverInfo.data.key}
                        </>
                     ) : (
                        <>
                            <Wrench className="w-4 h-4 text-blue-600" />
                            Model: {hoverInfo.data.key}
                        </>
                     )}
                 </div>
                 {hoverInfo.data.type === 'voucher' && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                        {formatCurrency(hoverInfo.data.totalMoney)}
                    </span>
                 )}
             </div>
             
             {/* CONTENT */}
             <div className="space-y-2">
                 {hoverInfo.data.type === 'voucher' ? (
                     // VOUCHER CONTENT
                     <>
                        <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                            <Gem className="w-3 h-3"/> Top hàng hóa giá trị
                        </p>
                        {hoverInfo.data.topItems.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                                <div className="truncate pr-2 text-slate-700 font-medium flex-1">
                                    {item.deviceName}
                                </div>
                                <div className="text-slate-500 font-mono text-[10px] whitespace-nowrap">
                                    x{parseFloat(item.fullData[14] || '0')}
                                </div>
                            </div>
                        ))}
                        {hoverInfo.data.items.length > 5 && (
                            <div className="pt-2 border-t border-slate-50 mt-2 text-[10px] text-center text-slate-400 italic">
                                ...và {hoverInfo.data.items.length - 5} mặt hàng khác
                            </div>
                        )}
                        <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                            <span>Tổng số lượng:</span>
                            <span className="font-bold text-slate-700">{hoverInfo.data.totalQty}</span>
                        </div>
                     </>
                 ) : (
                     // DEVICE/MODEL CONTENT
                     <>
                        <div className="flex justify-between items-center bg-blue-50 p-2 rounded-lg mb-2">
                             <span className="text-xs text-blue-800">Liên quan đến:</span>
                             <span className="text-xs font-bold text-blue-700">{hoverInfo.data.totalCount} giao dịch</span>
                        </div>
                        
                        <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                            <Building2 className="w-3 h-3"/> Đơn vị sử dụng
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {hoverInfo.data.deptList.slice(0, 8).map((dept: string, idx: number) => (
                                <span key={idx} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                                    {dept}
                                </span>
                            ))}
                            {hoverInfo.data.deptList.length > 8 && (
                                <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded italic">
                                    +{hoverInfo.data.deptList.length - 8} khác
                                </span>
                            )}
                             {hoverInfo.data.deptList.length === 0 && (
                                <span className="text-xs text-slate-400 italic">Chưa ghi nhận bộ phận sử dụng</span>
                            )}
                        </div>
                     </>
                 )}
             </div>
          </div>
      )}

      {/* Modern Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0">
         <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border ${bgColor} ${borderColor} ${accentColor}`}>
                {isVoucher ? <FolderOpen className="w-6 h-6" /> : <File className="w-6 h-6" />}
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h2>
                <p className="text-sm text-slate-500 font-medium">{description}</p>
            </div>
         </div>

         <div className="flex w-full md:w-auto gap-3 items-center">
             <div className="relative flex-1 md:w-72 group">
                 <input 
                    type="text" 
                    placeholder="Tìm kiếm file..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 ${ringColor} transition-all shadow-sm outline-none`}
                 />
                 <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                 {searchTerm && <button onClick={() => setSearchTerm('')}><X className="w-4 h-4 absolute right-3 top-3 text-slate-400 hover:text-slate-600" /></button>}
             </div>
             <button onClick={loadFiles} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors shadow-sm">
                 <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
             </button>
             <button onClick={() => setShowConfig(!showConfig)} className={`p-2.5 rounded-xl border transition-colors shadow-sm ${showConfig ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                 <Settings className="w-5 h-5" />
             </button>
         </div>
      </div>

      {showConfig && (
        <div className="mb-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-top-2">
            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">API Endpoint</label>
            <div className="flex gap-2">
                <input value={scriptUrl} onChange={(e) => setScriptUrl(e.target.value)} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono" />
                <button onClick={loadFiles} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900">Lưu</button>
            </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex">
          
          {/* File List */}
          <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${selectedFile ? 'hidden md:flex md:w-1/2 border-r border-slate-100' : 'w-full'}`}>
              <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between text-xs font-bold text-emerald-800 uppercase">
                  <span>Tên File</span>
                  <div className="flex gap-8 hidden sm:flex">
                      <span className="w-24 text-right">Ngày tạo</span>
                      <span className="w-24 text-right">Người sửa</span>
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {loading ? (
                      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
                          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                          <p className="text-sm font-medium">Đang đồng bộ dữ liệu...</p>
                      </div>
                  ) : error ? (
                      <div className="flex flex-col items-center justify-center h-64 text-red-500 gap-2">
                          <AlertCircle className="w-8 h-8" />
                          <p className="font-medium">Lỗi tải dữ liệu</p>
                          <p className="text-xs text-red-400 bg-red-50 px-2 py-1 rounded">{error}</p>
                      </div>
                  ) : filteredFiles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10">
                          <FolderOpen className="w-12 h-12 mb-3 opacity-20" />
                          <p className="text-sm">Không tìm thấy file nào</p>
                      </div>
                  ) : (
                      filteredFiles.map((file) => {
                          // Find matched key in summary map
                          const matchedKey = Object.keys(dataSummaries).find(k => file.name.toLowerCase().includes(k.toLowerCase()));
                          const summary = matchedKey ? dataSummaries[matchedKey] : null;

                          return (
                            <div 
                                key={file.id}
                                onClick={() => setSelectedFile(file)}
                                onMouseEnter={(e) => handleRowMouseEnter(e, file)}
                                onMouseLeave={handleRowMouseLeave}
                                className={`group flex items-start px-3 py-3 rounded-xl cursor-pointer transition-all border border-transparent ${selectedFile?.id === file.id ? `${bgColor} ${borderColor}` : 'hover:bg-slate-50 hover:border-slate-100'}`}
                            >
                                <div className="flex-1 flex items-start gap-3 min-w-0">
                                    <div className={`p-2 rounded-lg mt-0.5 ${selectedFile?.id === file.id ? 'bg-white shadow-sm' : 'bg-slate-100 group-hover:bg-white group-hover:shadow-sm transition-colors'}`}>
                                        {renderIcon(file.mimeType)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-sm font-semibold truncate ${selectedFile?.id === file.id ? 'text-slate-900' : 'text-slate-700'}`}>
                                            {file.name}
                                        </p>
                                        
                                        {/* INLINE SUMMARY UNDER FILENAME */}
                                        {summary && summary.type === 'voucher' && (
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                                                    {formatCurrency(summary.totalMoney)}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    • {summary.totalQty} mặt hàng
                                                </span>
                                            </div>
                                        )}
                                        {summary && summary.type === 'device' && (
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                                                    Model: {summary.key}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    • {summary.totalCount} giao dịch
                                                </span>
                                            </div>
                                        )}

                                        <p className="text-[11px] text-slate-400 sm:hidden mt-1">
                                            {formatFileSize(file.size)} • {formatDate(file.createdTime || file.modifiedTime)}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="hidden sm:flex items-center gap-8 text-xs text-slate-500 mt-2">
                                    <span className="w-24 text-right font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">{formatDate(file.createdTime || file.modifiedTime).split(' ')[0]}</span>
                                    <div className="w-24 flex items-center justify-end gap-1.5">
                                        <User className="w-3 h-3 opacity-50" />
                                        <span className="truncate max-w-[80px]" title={file.lastModifyingUser?.emailAddress}>{file.lastModifyingUser?.displayName || 'Admin'}</span>
                                    </div>
                                </div>

                                <div className="w-6 flex justify-end mt-2">
                                    {selectedFile?.id === file.id && <ChevronRight className={`w-4 h-4 ${accentColor}`} />}
                                </div>
                            </div>
                        )
                      })
                  )}
              </div>
          </div>

          {/* Preview Inspector */}
          {selectedFile && (
              <div className="w-full md:w-1/2 bg-slate-50 border-l border-slate-200 flex flex-col absolute md:relative inset-0 z-20 md:z-auto animate-in slide-in-from-right-10 duration-200">
                  <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
                      <div className="flex items-center gap-3 overflow-hidden">
                          <button onClick={() => setSelectedFile(null)} className="md:hidden p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500"/></button>
                          <div className="p-1.5 bg-slate-100 rounded-lg border border-slate-200">{renderIcon(selectedFile.mimeType)}</div>
                          <div className="min-w-0">
                              <h3 className="text-sm font-bold text-slate-800 truncate">{selectedFile.name}</h3>
                              <p className="text-[10px] text-slate-500 truncate">{formatFileSize(selectedFile.size)} • {formatDate(selectedFile.createdTime || selectedFile.modifiedTime)}</p>
                          </div>
                      </div>
                      <div className="flex items-center gap-2">
                           <button onClick={handlePrint} disabled={isPrinting} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="In">
                              {isPrinting ? <Loader2 className="w-5 h-5 animate-spin"/> : <Printer className="w-5 h-5" />}
                           </button>
                           <a href={getDownloadLink(selectedFile)} target="_blank" rel="noreferrer" className="p-2 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-600 transition-colors" title="Tải về">
                              <Download className="w-5 h-5" />
                           </a>
                           <button onClick={() => setSelectedFile(null)} className="hidden md:block p-2 hover:bg-red-50 hover:text-red-600 rounded-lg text-slate-400 transition-colors">
                              <X className="w-5 h-5" />
                           </button>
                      </div>
                  </div>

                  <div className="flex-1 relative bg-slate-200 overflow-hidden">
                      <iframe 
                          src={getPreviewLink(selectedFile.webViewLink)}
                          className="w-full h-full border-0 bg-white"
                          title="Preview"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10 text-slate-400 flex-col gap-2">
                          <Loader2 className="w-8 h-8 animate-spin" />
                          <span className="text-xs font-medium">Đang tải bản xem trước...</span>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};
