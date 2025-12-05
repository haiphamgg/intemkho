
// ... existing imports ...
import React, { useState, useEffect } from 'react';
import { fetchGoogleSheetData, saveToGoogleSheet } from '../services/sheetService';
import { Database, Plus, Save, RefreshCw, Search, Loader2, List, Tag, Building2, MapPin, Globe, Box, Edit2, X, Trash2, AlertCircle, Copy, Check, Lock, AlertTriangle, Wand2 } from 'lucide-react';

// Cấu trúc Tab
type TabID = 'DEVICE' | 'DEPT' | 'SECTION' | 'BRAND' | 'COUNTRY' | 'PROVIDER';

interface TabConfig {
  id: TabID;
  label: string;
  icon: any;
  sheet: string;
  range: string; 
  columns: { header: string; key: string; placeholder: string; width?: string }[];
  colIndex?: number; // Cột để lưu trong DMDC (0=A, 1=B...)
  startRow: number;
  padLeft?: number; // Số cột trống bên trái (cho Device)
}

// FIX: Range đổi từ 4 -> 3 để lấy cả Header, đảm bảo dòng 4 là dữ liệu
const TABS: TabConfig[] = [
  {
    id: 'DEVICE',
    label: 'Danh Mục Thiết Bị',
    icon: Database,
    sheet: 'DANHMUC',
    range: 'C3:I', // Lấy từ dòng 3 để dòng 4 được tính là data
    padLeft: 2, 
    startRow: 4,
    columns: [
      { key: 'code', header: 'Mã thiết bị (C)', placeholder: 'Tự sinh khi nhập tên...', width: 'w-32' },
      { key: 'name', header: 'Tên thiết bị (D)', placeholder: 'Nhập tên...', width: 'min-w-[200px]' },
      { key: 'detail', header: 'Chi tiết (E)', placeholder: 'Quy cách...', width: 'min-w-[150px]' },
      { key: 'unit', header: 'ĐVT (F)', placeholder: 'Cái/Bộ', width: 'w-20' },
      { key: 'brand', header: 'Hãng SX (G)', placeholder: 'Sony...', width: 'w-32' },
      { key: 'country', header: 'Nước SX (H)', placeholder: 'Japan...', width: 'w-32' },
      { key: 'model', header: 'Model (I)', placeholder: 'Model...', width: 'w-32' },
    ]
  },
  {
    id: 'DEPT',
    label: 'Khoa Phòng (A)',
    icon: Building2,
    sheet: 'DMDC',
    range: 'A3:A', // Lấy từ A3
    startRow: 4,
    columns: [{ key: 'name', header: 'Tên Khoa / Phòng', placeholder: 'Nhập tên khoa...', width: 'w-full' }],
    colIndex: 0
  },
  {
    id: 'SECTION',
    label: 'Bộ Phận (B)',
    icon: MapPin,
    sheet: 'DMDC',
    range: 'B3:B', // Lấy từ B3
    startRow: 4,
    columns: [{ key: 'name', header: 'Tên Bộ Phận', placeholder: 'Nhập bộ phận...', width: 'w-full' }],
    colIndex: 1
  },
  {
    id: 'BRAND',
    label: 'Hãng SX (C)',
    icon: Tag,
    sheet: 'DMDC',
    range: 'C3:C', // Lấy từ C3
    startRow: 4,
    columns: [{ key: 'name', header: 'Tên Hãng', placeholder: 'Nhập hãng...', width: 'w-full' }],
    colIndex: 2
  },
  {
    id: 'COUNTRY',
    label: 'Nước SX (D)',
    icon: Globe,
    sheet: 'DMDC',
    range: 'D3:D', // Lấy từ D3
    startRow: 4,
    columns: [{ key: 'name', header: 'Tên Nước', placeholder: 'Nhập nước...', width: 'w-full' }],
    colIndex: 3
  },
  {
    id: 'PROVIDER',
    label: 'Nhà Cung Cấp (E)',
    icon: Box,
    sheet: 'DMDC',
    range: 'E3:E', // Lấy từ E3
    startRow: 4,
    columns: [{ key: 'name', header: 'Tên Nhà Cung Cấp', placeholder: 'Nhập NCC...', width: 'w-full' }],
    colIndex: 4
  }
];

interface RowData {
  originalIndex: number;
  values: string[];
}

interface MasterDataProps {
  scriptUrl?: string;
}

// --- HELPER: REMOVE VIETNAMESE TONES ---
const removeVietnameseTones = (str: string) => {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g,"a"); 
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g,"e"); 
    str = str.replace(/ì|í|ị|ỉ|ĩ/g,"i"); 
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g,"o"); 
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g,"u"); 
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g,"y"); 
    str = str.replace(/đ/g,"d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    // Some system encode vietnamese combining accent as individual utf-8 characters
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); // 
    str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // 
    return str;
}

// --- ERROR HELP MODAL (UPDATED SCRIPT) ---
const ScriptHelpModal = ({ onClose }: { onClose: () => void }) => {
    const [copied, setCopied] = useState(false);
    
    const codeSnippet = `
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var json = JSON.parse(e.postData.contents);
    var action = json.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // --- 1. TẠO PHIẾU NHẬP/XUẤT ---
    if (action === 'create_ticket') {
      var sheet = ss.getSheetByName('DULIEU');
      if (!sheet) sheet = ss.insertSheet('DULIEU');
      
      var rows = json.rows; // Array[][] (18 columns)
      if (rows && rows.length > 0) {
        var lastRow = getLastRowWithData(sheet, 1);
        var startSTT = 0;
        
        if (lastRow > 2) {
           var lastSTTVal = sheet.getRange(lastRow, 1).getValue();
           if (!isNaN(parseInt(lastSTTVal))) startSTT = parseInt(lastSTTVal);
        }

        for (var i = 0; i < rows.length; i++) {
          rows[i][0] = startSTT + i + 1; 
          // Cột S (QR) để trống
        }
        
        sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
        return responseJSON({status: 'success', message: 'Đã tạo ' + rows.length + ' dòng phiếu.'});
      }
    }

    // --- 2. UPLOAD FILE LÊN DRIVE ---
    else if (action === 'upload_file') {
        var folderId = json.folderId;
        var base64Data = json.base64Data;
        var fileName = json.fileName;
        
        var folder = DriveApp.getFolderById(folderId);
        // Base64 thường có dạng "data:application/pdf;base64,....."
        var contentType = base64Data.substring(5, base64Data.indexOf(';'));
        var bytes = Utilities.base64Decode(base64Data.substring(base64Data.indexOf(',') + 1));
        var blob = Utilities.newBlob(bytes, contentType, fileName);
        
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        
        return responseJSON({
            status: 'success', 
            fileId: file.getId(), 
            url: file.getUrl(),
            message: 'Đã upload file thành công'
        });
    }

    // --- 3. QUẢN LÝ THIẾT BỊ ---
    else if (action === 'add_master_device') {
       var sheet = ss.getSheetByName('DANHMUC');
       if (!sheet) sheet = ss.insertSheet('DANHMUC');
       var lastRow = getLastRowWithData(sheet, 3); 
       sheet.getRange(lastRow + 1, 1, 1, json.row.length).setValues([json.row]);
       return responseJSON({status: 'success', message: 'Đã thêm thiết bị mới.'});
    }
    else if (action === 'update_master_device') {
       var sheet = ss.getSheetByName('DANHMUC');
       sheet.getRange(json.rowIndex, 1, 1, json.row.length).setValues([json.row]);
       return responseJSON({status: 'success', message: 'Cập nhật thiết bị thành công'});
    }

    // --- 4. QUẢN LÝ DANH MỤC CHUNG ---
    else if (action === 'add_master_dmdc') {
       var sheet = ss.getSheetByName('DMDC');
       if (!sheet) sheet = ss.insertSheet('DMDC');
       var colIndex = json.colIndex; 
       var value = json.value;
       if (colIndex !== undefined && value) {
          var lastRowInCol = getLastRowWithData(sheet, colIndex + 1);
          sheet.getRange(lastRowInCol + 1, colIndex + 1).setValue(value);
          return responseJSON({status: 'success', message: 'Đã thêm vào danh mục.'});
       }
       return responseJSON({status: 'error', message: 'Thiếu colIndex hoặc value'});
    }
    else if (action === 'update_master_dmdc') {
       var sheet = ss.getSheetByName('DMDC');
       sheet.getRange(json.rowIndex, json.colIndex + 1).setValue(json.value);
       return responseJSON({status: 'success', message: 'Cập nhật danh mục thành công'});
    }

    // --- 5. XÓA DỮ LIỆU ---
    else if (action === 'delete_master_item') {
       var sheetName = json.sheetName;
       var sheet = ss.getSheetByName(sheetName);
       if (sheetName === 'DANHMUC') {
         sheet.deleteRow(json.rowIndex);
       } else if (sheetName === 'DMDC') {
         var range = sheet.getRange(json.rowIndex, json.colIndex + 1);
         range.deleteCells(SpreadsheetApp.Dimension.ROWS);
       }
       return responseJSON({status: 'success', message: 'Đã xóa dữ liệu thành công.'});
    }

    // --- 6. LIỆT KÊ FILE DRIVE ---
    else if (action === 'list_files') {
        var folderId = json.folderId;
        var folder = DriveApp.getFolderById(folderId);
        var files = folder.getFiles();
        var result = [];
        
        while (files.hasNext()) {
          var file = files.next();
          result.push({
            id: file.getId(),
            name: file.getName(),
            mimeType: file.getMimeType(),
            url: file.getUrl(),
            downloadUrl: file.getDownloadUrl(),
            size: file.getSize(),
            dateCreated: file.getDateCreated(),
            lastUpdated: file.getLastUpdated(),
            owner: file.getOwner() ? { emailAddress: file.getOwner().getEmail(), displayName: file.getOwner().getName() } : null
          });
        }
        return responseJSON({status: 'success', files: result});
    }

    // --- 7. XÓA FILE DRIVE ---
    else if (action === 'delete_file') {
        var fileId = json.fileId;
        // Chuyển file vào thùng rác thay vì xóa vĩnh viễn để an toàn
        DriveApp.getFileById(fileId).setTrashed(true);
        return responseJSON({status: 'success', message: 'Đã chuyển file vào thùng rác'});
    }

    return responseJSON({status: 'error', message: 'Action không hợp lệ: ' + action});

  } catch (e) {
    return responseJSON({status: 'error', message: e.toString()});
  } finally {
    lock.releaseLock();
  }
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getLastRowWithData(sheet, colIndex) {
  var lastRow = sheet.getLastRow(); 
  if (lastRow === 0) return 0;
  var range = sheet.getRange(1, colIndex, lastRow);
  var values = range.getValues(); 
  for (var i = values.length - 1; i >= 0; i--) {
    if (values[i][0] !== "" && values[i][0] != null) {
      return i + 1; 
    }
  }
  return 0; 
}
`;

    const handleCopy = () => {
        navigator.clipboard.writeText(codeSnippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                <div className="p-4 bg-amber-50 border-b border-amber-100 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-amber-700 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5"/> Cần Cập Nhật Google Apps Script
                    </h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-amber-500 hover:text-amber-700"/></button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <p className="text-sm text-slate-700 mb-4 leading-relaxed bg-amber-50 p-3 rounded border border-amber-100">
                        <b>Cập nhật code Apps Script (Bắt buộc):</b> Để xem danh sách file trong "Kho Chứng Từ" và "Tài Liệu Kỹ Thuật", bạn cần cập nhật script này.
                        <br/>
                        1. Sao chép toàn bộ code bên dưới.
                        <br/>
                        2. Dán đè vào file <b>Code.gs</b> trong dự án Apps Script của bạn.
                        <br/>
                        3. Nhấn <b>Deploy (Triển khai)</b> {'>'} <b>New Deployment (Bài triển khai mới)</b> để áp dụng.
                    </p>
                    <div className="relative group">
                        <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-slate-700 shadow-inner h-96">
                            {codeSnippet}
                        </pre>
                        <button 
                            onClick={handleCopy}
                            className="absolute top-3 right-3 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors backdrop-blur-sm border border-white/10"
                            title="Sao chép toàn bộ"
                        >
                            {copied ? <div className="flex items-center gap-1"><Check className="w-4 h-4 text-green-400"/> <span className="text-xs">Đã chép</span></div> : <Copy className="w-4 h-4"/>}
                        </button>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
                    <button onClick={onClose} className="px-5 py-2.5 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 shadow-lg shadow-slate-500/20 transition-all active:scale-95">
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

// ... (Rest of MasterData component remains unchanged)
interface MasterModalProps {
    isOpen: boolean;
    mode: 'create' | 'edit';
    tabConfig: TabConfig;
    initialData?: string[];
    onClose: () => void;
    onSave: (data: string[]) => void;
    isSaving: boolean;
    dropdowns: { units: string[], brands: string[], countries: string[] };
    existingCodes: string[]; // Pass existing codes to check duplicates
}

const MasterModal: React.FC<MasterModalProps> = ({ isOpen, mode, tabConfig, initialData, onClose, onSave, isSaving, dropdowns, existingCodes }) => {
    const [formValues, setFormValues] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormValues(initialData);
            } else {
                setFormValues(new Array(tabConfig.columns.length).fill(''));
            }
        }
    }, [isOpen, mode, initialData, tabConfig]);

    // SMART AUTO-GENERATE CODE LOGIC
    // Chạy mỗi khi trường "Tên thiết bị" (index 1) thay đổi
    useEffect(() => {
        if (mode === 'create' && tabConfig.id === 'DEVICE' && formValues[1]) {
            const name = formValues[1];
            // 1. Remove Accents & Spaces, To Upper
            // "Máy Bơm" -> "May Bom" -> "MAYBOM"
            const cleanName = removeVietnameseTones(name).replace(/\s+/g, '').toUpperCase();
            
            // 2. Take 4 chars
            const prefix = cleanName.length >= 4 ? cleanName.substring(0, 4) : cleanName.padEnd(4, 'X');
            
            // 3. Find max number for this prefix
            let maxNum = 0;
            const regex = new RegExp(`^${prefix}(\\d+)$`); // Matches PREFIX + digits

            existingCodes.forEach(code => {
                const match = code.match(regex);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (!isNaN(num) && num > maxNum) maxNum = num;
                }
            });

            // 4. Generate new code: PREFIX + 0001 (next num)
            const nextNum = maxNum + 1;
            const newCode = `${prefix}${String(nextNum).padStart(4, '0')}`;

            // Update formValues ONLY if the code field (index 0) is not manually edited (or empty)
            setFormValues(prev => {
                const newVals = [...prev];
                // Chỉ cập nhật nếu user chưa nhập gì vào ô Mã hoặc ô mã đang trống
                // (Thực tế nên luôn update để support user nhập tên)
                newVals[0] = newCode;
                return newVals;
            });
        }
    }, [formValues[1], mode, tabConfig.id, existingCodes]);

    if (!isOpen) return null;

    const handleChange = (index: number, value: string) => {
        const newValues = [...formValues];
        newValues[index] = value;
        setFormValues(newValues);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const nameIndex = tabConfig.id === 'DEVICE' ? 1 : 0;
        if (!formValues[nameIndex]?.trim()) {
            alert(`Vui lòng nhập ${tabConfig.columns[nameIndex].header}`);
            return;
        }
        onSave(formValues);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className={`p-4 border-b border-slate-100 flex justify-between items-center ${mode === 'create' ? 'bg-blue-50' : 'bg-orange-50'}`}>
                    <h3 className={`font-bold flex items-center gap-2 ${mode === 'create' ? 'text-blue-700' : 'text-orange-700'}`}>
                        {mode === 'create' ? <Plus className="w-5 h-5"/> : <Edit2 className="w-5 h-5"/>}
                        {mode === 'create' ? 'Thêm mới' : 'Cập nhật'} - {tabConfig.label}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-black/10 rounded transition-colors"><X className="w-5 h-5 text-slate-500"/></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 gap-4">
                        {tabConfig.columns.map((col, idx) => {
                            const isFullWidth = tabConfig.columns.length === 1 || col.key === 'name' || col.key === 'detail';
                            let listId = undefined;
                            if (col.key === 'unit') listId = 'dl-units-modal';
                            if (col.key === 'brand') listId = 'dl-brands-modal';
                            if (col.key === 'country') listId = 'dl-countries-modal';

                            // LOGIC: Disable code input if in Edit mode
                            const isCodeField = col.key === 'code';
                            const isLocked = mode === 'edit' && isCodeField;

                            return (
                                <div key={idx} className={isFullWidth ? 'col-span-2' : 'col-span-1'}>
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between mb-1.5">
                                        <span>{col.header} {col.key === 'name' && <span className="text-red-500">*</span>}</span>
                                        {isCodeField && mode === 'create' && <span className="text-[10px] text-blue-500 font-normal flex items-center gap-1"><Wand2 className="w-3 h-3"/> Tự sinh từ Tên</span>}
                                        {isLocked && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <input 
                                        value={formValues[idx] || ''}
                                        onChange={e => handleChange(idx, e.target.value)}
                                        disabled={isLocked}
                                        className={`w-full p-2.5 border rounded-lg text-sm outline-none transition-all ${
                                            isLocked 
                                                ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' 
                                                : col.key === 'name'
                                                    ? 'border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-semibold' 
                                                    : 'border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-100'
                                        }`}
                                        placeholder={col.placeholder}
                                        list={listId}
                                        // Auto focus vào tên nếu là create và field là tên
                                        autoFocus={idx === (tabConfig.id === 'DEVICE' ? 1 : 0) && !isLocked}
                                        title={isLocked ? "Không thể sửa mã thiết bị để đảm bảo tính nhất quán" : ""}
                                    />
                                    {listId && (
                                        <datalist id={listId}>
                                            {listId === 'dl-units-modal' && dropdowns.units.map((u, i) => <option key={i} value={u}/>)}
                                            {listId === 'dl-brands-modal' && dropdowns.brands.map((b, i) => <option key={i} value={b}/>)}
                                            {listId === 'dl-countries-modal' && dropdowns.countries.map((c, i) => <option key={i} value={c}/>)}
                                        </datalist>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </form>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors">Hủy bỏ</button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSaving}
                        className={`px-4 py-2 text-white font-bold rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-70 ${
                            mode === 'create' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'
                        }`}
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                        {mode === 'create' ? 'Lưu dữ liệu' : 'Lưu thay đổi'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const MasterData: React.FC<MasterDataProps> = ({ scriptUrl }) => {
  const [activeTabId, setActiveTabId] = useState<TabID>('DEVICE');
  const [data, setData] = useState<RowData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingRow, setEditingRow] = useState<RowData | null>(null);
  const [initialModalValues, setInitialModalValues] = useState<string[] | undefined>(undefined);
  
  // Error Help
  const [showScriptHelp, setShowScriptHelp] = useState(false);

  // Dropdown data
  const [dropdowns, setDropdowns] = useState({
      units: [] as string[],
      brands: [] as string[],
      countries: [] as string[]
  });

  const activeConfig = TABS.find(t => t.id === activeTabId)!;

  const loadData = async () => {
    setIsLoading(true);
    const sheetId = localStorage.getItem('SHEET_ID') || '';
    if (!sheetId) return;

    try {
      // Timeout safety for loadData as well
      const result = await Promise.race([
          fetchGoogleSheetData(sheetId, `${activeConfig.sheet}!${activeConfig.range}`),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15000))
      ]) as string[][];

      const mappedData: RowData[] = result.map((row, idx) => ({
        originalIndex: activeConfig.startRow + idx, 
        values: row
      })).filter(item => item.values.some(cell => cell && cell.trim() !== ''));
      setData(mappedData);

      if (activeConfig.id === 'DEVICE') {
          try {
            const dmdc = await fetchGoogleSheetData(sheetId, 'DMDC!A3:E'); 
            const uSet = new Set<string>();
            result.forEach(r => { if(r[3]) uSet.add(r[3]) }); 

            const bSet = new Set<string>();
            const cSet = new Set<string>();
            dmdc.forEach(r => {
                if(r[2]) bSet.add(r[2]); 
                if(r[3]) cSet.add(r[3]); 
            });

            setDropdowns({
                units: Array.from(uSet).sort(),
                brands: Array.from(bSet).sort(),
                countries: Array.from(cSet).sort()
            });
          } catch (e) { console.warn("Cannot load dropdowns", e); }
      }
    } catch (e) {
      console.error(e);
      // Don't clear data on error to avoid flashing empty state, just log
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setSearchTerm('');
    setIsModalOpen(false);
  }, [activeTabId]);

  const handleCreateClick = () => {
      setModalMode('create');
      setEditingRow(null);
      setInitialModalValues(undefined);
      setIsModalOpen(true);
  };

  const handleEditClick = (row: RowData) => {
      setModalMode('edit');
      setEditingRow(row);
      setInitialModalValues(row.values);
      setIsModalOpen(true);
  };

  // CHECK DEPENDENCY TRƯỚC KHI XÓA
  const checkUsageInDulieu = async (valueToCheck: string, colIndexInDulieu: number): Promise<boolean> => {
     const sheetId = localStorage.getItem('SHEET_ID') || '';
     if (!sheetId) return false;
     try {
         // OPTIMIZATION: Chỉ lấy cột cần kiểm tra trong DULIEU thay vì toàn bộ bảng
         const colLetter = String.fromCharCode(65 + colIndexInDulieu); // Chỉ hoạt động tốt cho A-Z (0-25)
         const range = `DULIEU!${colLetter}3:${colLetter}`;
         
         // Add timeout 10s
         const colData = await Promise.race([
             fetchGoogleSheetData(sheetId, range),
             new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout checking usage")), 10000))
         ]) as string[][];
         
         // Duyệt qua từng dòng
         for (let i = 0; i < colData.length; i++) {
             // row là mảng 1 phần tử
             const cellValue = colData[i][0];
             if (cellValue && String(cellValue).trim().toLowerCase() === String(valueToCheck).trim().toLowerCase()) {
                 return true; // Đã tìm thấy -> Đang được sử dụng
             }
         }
         return false; // Không tìm thấy
     } catch (e) {
         console.error("Error checking dependency", e);
         // Nếu lỗi fetch (ví dụ mạng hoặc timeout), không chặn xóa nhưng cảnh báo log
         return false;
     }
  };

  const handleDeleteClick = async (row: RowData) => {
      if (!scriptUrl) {
          alert("Lỗi: Chưa có Script URL. Vui lòng kiểm tra cấu hình Admin hoặc ô A2 sheet DMDC.");
          return;
      }

      if (!confirm(`Bạn có chắc chắn muốn xóa mục này?\nHành động này không thể hoàn tác.`)) {
          return;
      }

      setDeletingId(row.originalIndex); 
      try {
          // 1. KIỂM TRA RÀNG BUỘC DỮ LIỆU
          let isUsed = false;
          let constraintMsg = "";

          if (activeTabId === 'DEVICE') {
              const deviceCode = row.values[0]; 
              if (deviceCode) {
                  isUsed = await checkUsageInDulieu(deviceCode, 6); 
                  constraintMsg = `Mã thiết bị "${deviceCode}" đã phát sinh giao dịch xuất/nhập kho.`;
              }
          } else if (activeTabId === 'DEPT') {
              isUsed = await checkUsageInDulieu(row.values[0], 3); 
              constraintMsg = `Khoa/Phòng "${row.values[0]}" đang được sử dụng trong phiếu.`;
          } else if (activeTabId === 'PROVIDER') {
              isUsed = await checkUsageInDulieu(row.values[0], 2);
              constraintMsg = `Nhà cung cấp "${row.values[0]}" đang có trong phiếu.`;
          }

          if (isUsed) {
              alert(`KHÔNG THỂ XÓA!\n\n${constraintMsg}\nBạn cần xóa các phiếu liên quan trước.`);
              setDeletingId(null);
              return;
          }

          // 2. GỬI LỆNH XÓA (Add timeout 20s)
          await Promise.race([
              saveToGoogleSheet({
                action: 'delete_master_item',
                sheetName: activeConfig.sheet,
                rowIndex: row.originalIndex,
                colIndex: activeConfig.colIndex
              }, scriptUrl),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout deleting item. Apps Script might be slow.")), 20000))
          ]);

          alert("Đã xóa thành công!");
          loadData();
      } catch (e: any) {
          console.error("Delete Error:", e);
          if (e.message.includes('Action không hợp lệ') || e.message.includes('không hợp lệ')) {
              setShowScriptHelp(true);
          } else {
              alert("Lỗi khi xóa: " + e.message);
          }
      } finally {
          setDeletingId(null);
      }
  };

  const handleSaveData = async (values: string[]) => {
      setIsSaving(true);
      try {
          if (!scriptUrl) throw new Error("Missing Script URL");

          if (activeConfig.id === 'DEVICE') {
              const padding = Array(activeConfig.padLeft || 0).fill('');
              const rowToSave = [...padding, ...values];

              if (modalMode === 'create') {
                  await saveToGoogleSheet({
                      action: 'add_master_device', 
                      sheetName: 'DANHMUC',
                      row: rowToSave
                  }, scriptUrl);
              } else {
                  if (!editingRow) return;
                  await saveToGoogleSheet({
                      action: 'update_master_device',  
                      rowIndex: editingRow.originalIndex,
                      row: rowToSave
                  }, scriptUrl);
              }
          } else {
              const valueToSave = values[0];
              if (modalMode === 'create') {
                  await saveToGoogleSheet({
                      action: 'add_master_dmdc',
                      sheetName: 'DMDC',
                      colIndex: activeConfig.colIndex,
                      value: valueToSave
                  }, scriptUrl);
              } else {
                  if (!editingRow) return;
                  await saveToGoogleSheet({
                      action: 'update_master_dmdc', 
                      rowIndex: editingRow.originalIndex,
                      colIndex: activeConfig.colIndex,
                      value: valueToSave
                  }, scriptUrl);
              }
          }

          alert(modalMode === 'create' ? "Thêm mới thành công!" : "Cập nhật thành công!");
          setIsModalOpen(false);
          loadData(); 

      } catch (e: any) {
          console.error("Save Error:", e);
          if (e.message.includes('Action không hợp lệ') || e.message.includes('không hợp lệ')) {
              setShowScriptHelp(true);
          } else {
              alert("Lỗi: " + e.message);
          }
      } finally {
          setIsSaving(false);
      }
  };

  const filteredData = data.filter(row => 
    row.values.some(cell => cell && cell.toString().toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 p-2 md:p-6">
      {/* Script Help Modal */}
      {showScriptHelp && <ScriptHelpModal onClose={() => setShowScriptHelp(false)} />}
      
      {/* Edit/Create Modal */}
      <MasterModal 
          isOpen={isModalOpen}
          mode={modalMode}
          tabConfig={activeConfig}
          initialData={initialModalValues}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveData}
          isSaving={isSaving}
          dropdowns={dropdowns}
          existingCodes={data.map(d => d.values[0])} // Pass existing codes for duplicate check
      />

      <div className="flex flex-col md:flex-row gap-4 h-full">
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden shrink-0">
           <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-700 flex items-center gap-2">
              <List className="w-5 h-5"/> Quản Lý Danh Mục
           </div>
           <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTabId === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    {tab.label}
                  </button>
                )
              })}
           </div>
           
           {/* Nút bật Code Backend */}
           <div className="p-2 border-t border-slate-100">
               <button 
                  onClick={() => setShowScriptHelp(true)}
                  className="w-full py-2 bg-amber-50 text-amber-600 rounded-lg text-xs font-bold border border-amber-200 hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
               >
                   <AlertCircle className="w-3 h-3"/>
                   Code Backend Script
               </button>
           </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
           {/* Header Toolbar */}
           <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${activeTabId === 'DEVICE' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-600'}`}>
                    {React.createElement(activeConfig.icon, { className: "w-6 h-6" })}
                  </div>
                  <div>
                      <h2 className="font-bold text-slate-800 text-lg">{activeConfig.label}</h2>
                      <div className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-1"><Database className="w-3 h-3"/> {data.length} bản ghi</span>
                          {!scriptUrl && (
                             <span className="text-red-500 flex items-center gap-1 bg-red-50 px-1.5 rounded border border-red-100"><AlertTriangle className="w-3 h-3"/> Chưa kết nối Script</span>
                          )}
                      </div>
                  </div>
              </div>

              <div className="flex gap-2 w-full sm:w-auto items-center">
                 <div className="relative flex-1 sm:w-64">
                    <input
                      type="text"
                      placeholder="Tìm kiếm..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                 </div>
                 
                 <button 
                    onClick={loadData} 
                    className="p-2 bg-white border border-slate-200 rounded-lg hover:text-blue-600 hover:border-blue-300 transition-colors"
                    title="Làm mới"
                 >
                    <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                 </button>

                 <button 
                    onClick={handleCreateClick}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 transition-all active:scale-95 whitespace-nowrap"
                 >
                    <Plus className="w-5 h-5" />
                    <span className="hidden sm:inline">Thêm mới</span>
                 </button>
              </div>
           </div>

           {/* Table */}
           <div className="flex-1 overflow-auto custom-scrollbar relative scroll-smooth bg-slate-50/30">
              <table className="w-full text-left border-collapse">
                 <thead className="bg-slate-50 text-slate-600 text-xs uppercase sticky top-0 z-10 shadow-sm font-bold tracking-wider">
                    <tr>
                       <th className="px-4 py-3 border-b border-slate-200 w-12 text-center bg-slate-50">#</th>
                       {activeConfig.columns.map((col, idx) => (
                          <th key={idx} className={`px-4 py-3 border-b border-slate-200 bg-slate-50 whitespace-nowrap ${col.width || ''}`}>
                             {col.header}
                          </th>
                       ))}
                       <th className="px-4 py-3 border-b border-slate-200 w-24 text-center bg-slate-50 sticky right-0 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)]">Thao tác</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 text-sm bg-white">
                    {filteredData.length > 0 ? (
                        filteredData.map((row, rIdx) => (
                           <tr key={rIdx} className="hover:bg-blue-50/50 group transition-colors">
                              <td className="px-4 py-3 text-center text-slate-400 text-xs font-mono">{rIdx + 1}</td>
                              
                              {activeConfig.columns.map((col, cIdx) => (
                                 <td key={cIdx} className="px-4 py-3 text-slate-700">
                                     <div className="truncate max-w-[300px]" title={row.values[cIdx]}>
                                        {row.values[cIdx] || <span className="text-slate-300 italic">-</span>}
                                     </div>
                                 </td>
                              ))}
                              
                              <td className="px-4 py-3 text-center sticky right-0 bg-white group-hover:bg-blue-50/50 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)]">
                                 <div className="flex items-center justify-center gap-2">
                                     <button 
                                        onClick={() => handleEditClick(row)}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                        title="Sửa"
                                        disabled={deletingId !== null}
                                     >
                                        <Edit2 className="w-4 h-4" />
                                     </button>
                                     <button 
                                        onClick={() => handleDeleteClick(row)}
                                        disabled={deletingId !== null}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
                                        title="Xóa"
                                     >
                                        {deletingId === row.originalIndex ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <Trash2 className="w-4 h-4" />}
                                     </button>
                                 </div>
                              </td>
                           </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={activeConfig.columns.length + 2} className="text-center py-20 text-slate-400">
                                <div className="flex flex-col items-center gap-2">
                                    <AlertCircle className="w-10 h-10 opacity-20" />
                                    <p className="italic">Chưa có dữ liệu phù hợp</p>
                                </div>
                            </td>
                        </tr>
                    )}
                 </tbody>
              </table>
           </div>
           
           {/* Footer Stats */}
           <div className="p-2 border-t border-slate-100 bg-slate-50 text-xs text-slate-400 text-center">
                Hiển thị {filteredData.length} bản ghi
           </div>
        </div>
      </div>
    </div>
  );
};
