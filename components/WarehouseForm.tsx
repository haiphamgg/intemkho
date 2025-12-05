
// ... existing imports ...
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchGoogleSheetData, saveToGoogleSheet } from '../services/sheetService';
import { WarehouseTicket, TransactionItem, DeviceRow } from '../types';
import { Save, Trash2, FileInput, FileOutput, Calendar, User, Building, Hash, Loader2, PlusCircle, Search, AlertCircle, StickyNote, Plus, Printer, CheckCircle2, CloudUpload, Link as LinkIcon, Paperclip, RefreshCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface WarehouseFormProps {
  type: 'import' | 'export';
  sheetId: string;
  scriptUrl: string; 
  folderId?: string; // Prop mới
  onSuccess: () => void;
  existingTickets?: DeviceRow[]; // New prop for loading existing data
}

// --- Helper: Đọc số thành chữ ---
const readGroup = (group: string) => {
    const readDigit = [" không", " một", " hai", " ba", " bốn", " năm", " sáu", " bảy", " tám", " chín"];
    let temp = "";
    if (group === "000") return "";
    
    // Convert to numbers
    const tram = parseInt(group.substring(0, 1));
    const chuc = parseInt(group.substring(1, 2));
    const donvi = parseInt(group.substring(2, 3));

    temp += readDigit[tram] + " trăm";
    
    if (chuc === 0 && donvi === 0) return temp;
    if (chuc === 0 && donvi !== 0) {
        temp += " linh" + readDigit[donvi];
        return temp;
    }

    if (chuc === 1) temp += " mười";
    else temp += readDigit[chuc] + " mươi";

    if (donvi === 1) {
        if (chuc > 1) temp += " mốt";
        else temp += " một";
    } else if (donvi === 5) {
        if (chuc > 0) temp += " lăm";
        else temp += " năm";
    } else if (donvi !== 0) {
        temp += readDigit[donvi];
    }
    return temp;
};

const readMoney = (num: number) => {
    if (num === 0) return "Không đồng";
    let str = Math.round(num).toString();
    const suffixes = ["", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ"];
    let result = "";
    let suffixIndex = 0;

    // Pad with leading zeros to make length multiple of 3
    while (str.length % 3 !== 0) str = "0" + str;

    for (let i = str.length; i > 0; i -= 3) {
        const group = str.substring(i - 3, i);
        const read = readGroup(group);
        if (read !== "") {
            result = read + suffixes[suffixIndex] + result;
        }
        suffixIndex++;
    }

    result = result.trim();
    if (result.startsWith("không trăm")) result = result.substring(10).trim();
    if (result.startsWith("linh")) result = result.substring(4).trim();
    
    // Capitalize first letter
    return result.charAt(0).toUpperCase() + result.slice(1) + " đồng";
};

export const WarehouseForm: React.FC<WarehouseFormProps> = ({ type, sheetId, scriptUrl, folderId, onSuccess, existingTickets = [] }) => {
  const isImport = type === 'import';
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // State for Ticket PDF Upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // State for Note Attachment Upload
  const [isUploadingNote, setIsUploadingNote] = useState(false);
  const noteFileInputRef = useRef<HTMLInputElement>(null);

  // Load Ticket State
  const [loadTicketInput, setLoadTicketInput] = useState('');

  // State lưu phiếu vừa lưu thành công để in
  const [lastSavedTicket, setLastSavedTicket] = useState<WarehouseTicket | null>(null);

  // Master Data State
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  
  // Dữ liệu thiết bị từ sheet DANHMUC (C4:I)
  const [masterDevices, setMasterDevices] = useState<string[][]>([]); 
  const [unitList, setUnitList] = useState<string[]>([]); 
  
  // Tồn kho & Metadata từ DULIEU
  const [inventoryMap, setInventoryMap] = useState<Map<string, number>>(new Map());
  const [warrantyMap, setWarrantyMap] = useState<Map<string, string>>(new Map()); 
  const [priceMap, setPriceMap] = useState<Map<string, number>>(new Map()); 
  const [deviceMetaMap, setDeviceMetaMap] = useState<Map<string, string[]>>(new Map());
  
  // Raw Data for Ticket Calculation
  const [rawDulieu, setRawDulieu] = useState<string[][]>([]);

  // Hidden Ref for PDF Generation
  const ticketRef = useRef<HTMLDivElement>(null);

  // Form State
  const [ticket, setTicket] = useState<WarehouseTicket>({
    ticketType: isImport ? 'PN' : 'PX',
    ticketNumber: '',
    date: new Date().toISOString().split('T')[0],
    partner: '',
    section: '',
    items: []
  });

  const emptyItem: TransactionItem = {
    deviceCode: '', deviceName: '', details: '', unit: '', 
    manufacturer: '', country: '', modelSerial: '', warranty: '', 
    quantity: 1, price: 0, total: 0, notes: ''
  };

  const [currentItem, setCurrentItem] = useState<TransactionItem>(emptyItem);

  // --- Helper Functions (generateKey, parseSheetNumber, etc.) ---
  const generateKey = (code: string, name: string) => {
      const c = code ? code.toString().trim() : '';
      const n = name ? name.toString().trim() : '';
      return c || n;
  };

  const parseSheetNumber = (val: any) => {
      if (!val) return 0;
      let str = String(val).trim();
      let cleanQty = str.replace(/,/g, ''); 
      if (cleanQty.includes('.') && !cleanQty.includes(',')) {
          cleanQty = cleanQty.replace(/\./g, '');
      }
      const num = parseFloat(cleanQty);
      return isNaN(num) ? 0 : num;
  };

  const formatNumber = (num: number | undefined) => {
      if (!num) return '';
      return num.toLocaleString('vi-VN');
  };

  const parseFormattedNumber = (str: string) => {
      if (!str) return 0;
      const clean = str.replace(/\./g, '');
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
  };

  const formatSheetDateToDisplay = (input: any): string => {
      if (!input) return '';
      const str = String(input).trim();
      if (str.includes('Date(')) {
          const parts = str.match(/\d+/g);
          if (parts && parts.length >= 3) {
              const y = parts[0];
              const m = parseInt(parts[1]) + 1;
              const d = parts[2];
              return `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`;
          }
      }
      if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [y, m, d] = str.split('-');
          return `${d}/${m}/${y}`;
      }
      const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dmyMatch) {
          const d = dmyMatch[1].padStart(2, '0');
          const m = dmyMatch[2].padStart(2, '0');
          const y = dmyMatch[3];
          return `${d}/${m}/${y}`;
      }
      return str; 
  };

  const convertDisplayToInputDate = (displayDate: string): string => {
      if (!displayDate) return '';
      if (displayDate.includes('/')) {
         const parts = displayDate.split('/');
         if (parts.length === 3) {
             return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
         }
      }
      if (displayDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return displayDate;
      }
      return '';
  };

  const convertInputToDisplayDate = (inputDate: string): string => {
      if (!inputDate || !inputDate.includes('-')) return inputDate;
      const parts = inputDate.split('-');
      if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return inputDate;
  };

  const generateNextTicketNumber = (type: 'import' | 'export', data: string[][]) => {
      const prefix = type === 'import' ? 'PN' : 'PX';
      let maxNum = 0;
      data.forEach((row) => {
          if (row[0] === 'STT') return;
          const cellE = row[4] ? row[4].toString().trim() : '';
          if (!cellE || cellE.toUpperCase() === 'SỐ PHIẾU' || cellE.toUpperCase() === 'SO PHIEU') return;
          const t = cellE.toUpperCase();
          if (t.startsWith(prefix)) {
              const numStr = t.replace(/\D/g, ''); 
              const numPart = parseInt(numStr, 10);
              if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
          }
      });
      return `${prefix}${(maxNum + 1).toString().padStart(4, '0')}`;
  };

  // --- Load Data Effect ---
  useEffect(() => {
    if (!sheetId) return;
    const loadAllData = async () => {
      setIsLoading(true);
      setSubmitError(null);
      try {
        const promises = [
            fetchGoogleSheetData(sheetId, 'DMDC!A4:E'),
            fetchGoogleSheetData(sheetId, 'DANHMUC!C4:I'),
            fetchGoogleSheetData(sheetId, 'DULIEU')
        ];
        const results = await Promise.all(promises);
        const dmdcData = results[0];
        const deviceData = results[1];
        const dulieuData = results[2];
        setRawDulieu(dulieuData); 

        const depts = new Set<string>();
        const secs = new Set<string>(); 
        const brds = new Set<string>();
        const cntrs = new Set<string>();
        const supps = new Set<string>();

        dmdcData.forEach(row => {
            if (row[0]) depts.add(row[0]);
            if (row[1]) secs.add(row[1]);
            if (row[2]) brds.add(row[2]);
            if (row[3]) cntrs.add(row[3]);
            if (row[4]) supps.add(row[4]);
        });

        setDepartments(Array.from(depts));
        setSections(Array.from(secs));
        setBrands(Array.from(brds));
        setCountries(Array.from(cntrs));
        setSuppliers(Array.from(supps));

        const validDevices = deviceData.filter(r => r[0] || r[1]);
        setMasterDevices(validDevices);
        const units = new Set<string>();
        validDevices.forEach(d => { if (d[3]) units.add(d[3]); });
        setUnitList(Array.from(units));

        if (dulieuData.length > 0) {
            const stock = new Map<string, number>();
            const wMap = new Map<string, string>();
            const pMap = new Map<string, number>();
            const metaMap = new Map<string, string[]>();

            dulieuData.forEach((row) => {
                const ticketNo = row[4] ? row[4].toString().trim().toUpperCase() : ''; 
                if (!ticketNo || ticketNo === 'SỐ PHIẾU') return;
                const code = row[6];
                const name = row[7];
                const key = generateKey(code, name);
                if (!key) return;

                let qty = parseSheetNumber(row[14]);
                if (qty === 0 && name) qty = 1; 

                const current = stock.get(key) || 0;
                if (ticketNo.startsWith('PX')) {
                    stock.set(key, current - qty);
                } else {
                    stock.set(key, current + qty);
                    const meta = [row[6] || '', row[7] || '', row[8] || '', row[9] || '', row[10] || '', row[11] || '', row[12] || ''];
                    metaMap.set(key, meta);
                    const rawWarranty = row[13];
                    if (rawWarranty) {
                        const formattedW = formatSheetDateToDisplay(rawWarranty);
                        if (formattedW && formattedW.includes('/')) wMap.set(key, formattedW);
                    }
                    const price = parseSheetNumber(row[15]);
                    if (price > 0) pMap.set(key, price);
                }
            });
            setInventoryMap(stock);
            setWarrantyMap(wMap);
            setPriceMap(pMap);
            setDeviceMetaMap(metaMap);
        }
      } catch (e) {
        console.error("Error loading data", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllData();
  }, [sheetId]);

  useEffect(() => {
      if (!isLoading && rawDulieu.length >= 0 && !loadTicketInput) {
          // Chỉ sinh mã mới nếu không phải đang load phiếu
          const nextTicket = generateNextTicketNumber(type, rawDulieu);
          setTicket(prev => ({
              ...prev, 
              ticketType: isImport ? 'PN' : 'PX',
              ticketNumber: nextTicket, 
              items: [] 
          }));
          setLastSavedTicket(null);
          setUploadSuccess(null);
      }
  }, [type, rawDulieu, isLoading]);

  const availableDevices = useMemo(() => {
     let devices = [...masterDevices];
     const masterKeys = new Set(devices.map(d => generateKey(d[0], d[1])));
     deviceMetaMap.forEach((meta, key) => {
         if (!masterKeys.has(key)) {
             devices.push(meta);
             masterKeys.add(key);
         }
     });
     if (!isImport) {
         return devices.filter(d => {
             const key = generateKey(d[0], d[1]);
             const stock = inventoryMap.get(key) || 0;
             return stock > 0;
         });
     }
     return devices;
  }, [masterDevices, isImport, inventoryMap, deviceMetaMap]);

  const getCurrentStock = (item: TransactionItem) => {
      const key = generateKey(item.deviceCode, item.deviceName);
      return inventoryMap.get(key) || 0;
  };

  const handleDeviceSelection = (value: string, type: 'code' | 'name') => {
    let matchedDevice: string[] | undefined;
    if (type === 'code') {
        matchedDevice = availableDevices.find(d => d[0]?.trim() === value.trim());
        if (!matchedDevice) {
             setCurrentItem(prev => ({...prev, deviceCode: value}));
             return;
        }
    } else {
        matchedDevice = availableDevices.find(d => d[1]?.trim() === value.trim());
        if (!matchedDevice) {
             setCurrentItem(prev => ({...prev, deviceName: value}));
             return;
        }
    }

    if (matchedDevice) {
        const key = generateKey(matchedDevice[0], matchedDevice[1]);
        const lastWarrantyDisplay = warrantyMap.get(key) || ''; 
        const inputWarranty = convertDisplayToInputDate(lastWarrantyDisplay);
        const currentStock = inventoryMap.get(key) || 0;
        const lastPrice = priceMap.get(key) || 0;

        setCurrentItem(prev => ({
            ...prev,
            deviceCode: matchedDevice![0] || prev.deviceCode, 
            deviceName: matchedDevice![1] || prev.deviceName,
            details: matchedDevice![2] || '',
            unit: matchedDevice![3] || '',
            manufacturer: matchedDevice![4] || '',
            country: matchedDevice![5] || '',
            modelSerial: matchedDevice![6] || '',
            warranty: inputWarranty || prev.warranty, 
            quantity: !isImport && currentStock < 1 ? 0 : 1,
            price: lastPrice || prev.price, 
            total: (!isImport && currentStock < 1 ? 0 : 1) * (lastPrice || prev.price)
        }));
    }
  };

  // --- HANDLE NOTE FILE UPLOAD ---
  const handleNoteFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;

     if (!folderId) {
        alert("Chưa cấu hình ID thư mục Kho chứng từ (Folder ID) trong Cài đặt.");
        return;
     }

     setIsUploadingNote(true);
     try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64Data = reader.result as string;
            const fileName = `File_${Date.now()}_${file.name}`;
            
            const result = await saveToGoogleSheet({
                action: 'upload_file',
                folderId: folderId,
                base64Data: base64Data,
                fileName: fileName
            }, scriptUrl);

            if (result.url) {
                // Append URL to current notes
                const currentNotes = currentItem.notes ? currentItem.notes + ' ' : '';
                setCurrentItem({
                    ...currentItem,
                    notes: `${currentNotes}${result.url}`
                });
            }
        };
     } catch (err: any) {
        console.error("Note Upload Error:", err);
        alert("Lỗi khi upload file: " + err.message);
     } finally {
        setIsUploadingNote(false);
        if (noteFileInputRef.current) {
            noteFileInputRef.current.value = '';
        }
     }
  };

  const addItem = () => {
    if (!currentItem.deviceName) {
        alert("Vui lòng nhập tên thiết bị");
        return;
    }
    const qty = Number(currentItem.quantity) || 0;
    const price = Number(currentItem.price) || 0;
    const total = qty * price;
    if (!isImport) {
        const stock = getCurrentStock(currentItem);
        if (qty > stock) {
            alert(`Lỗi: Số lượng xuất (${qty}) lớn hơn tồn kho hiện tại (${stock}).`);
            return;
        }
    }
    const finalWarranty = convertInputToDisplayDate(currentItem.warranty);
    setTicket(prev => ({
        ...prev,
        items: [...prev.items, { 
            ...currentItem, 
            warranty: finalWarranty, 
            quantity: qty, 
            price: price, 
            total: total 
        }]
    }));
    setCurrentItem(emptyItem); 
    setSubmitError(null);
  };

  const removeItem = (index: number) => {
    setTicket(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // --- SAVE TO DRIVE FUNCTION (Generic for any ticket state) ---
  const generatePDF = async () => {
      // Use current ticket state for preview/printing
      const t = ticket;
      if (!t.items.length || !ticketRef.current) {
          alert("Không có dữ liệu để in.");
          return null;
      }
      
      try {
          const canvas = await html2canvas(ticketRef.current, {
              scale: 2, 
              backgroundColor: '#ffffff'
          });
          
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = 210;
          const imgProps = pdf.getImageProperties(imgData);
          const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
          
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
          return pdf;
      } catch (e: any) {
          console.error("PDF Gen Error:", e);
          alert("Lỗi tạo PDF: " + e.message);
          return null;
      }
  };

  const handleSaveToDrive = async () => {
      if (!folderId) {
          alert("Lỗi: Chưa cấu hình ID thư mục Kho chứng từ.");
          return;
      }
      
      setIsUploading(true);
      try {
          const pdf = await generatePDF();
          if (!pdf) return;

          const pdfBase64 = pdf.output('datauristring');
          const safePartner = ticket.partner.replace(/[\/\\:*?"<>|]/g, '-');
          const fileName = `Chung tu ${ticket.ticketNumber}+${safePartner}.pdf`;

          const result = await saveToGoogleSheet({
              action: 'upload_file',
              folderId: folderId,
              base64Data: pdfBase64,
              fileName: fileName
          }, scriptUrl);

          setUploadSuccess(fileName);
          alert(`Đã lưu file "${fileName}" vào Kho chứng từ thành công!`);

      } catch (e: any) {
          console.error("Upload Error:", e);
          alert("Lỗi khi lưu file: " + e.message);
      } finally {
          setIsUploading(false);
      }
  };

  const handlePrintTicket = () => {
      if (!ticketRef.current || ticket.items.length === 0) return;
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      const safePartner = ticket.partner.replace(/[\/\\:*?"<>|]/g, '-'); 
      const pdfFileName = `Chung tu ${ticket.ticketNumber}+${safePartner}`;
      printWindow.document.write(`<html><head><title>${pdfFileName}</title></head><body>${ticketRef.current?.innerHTML}</body><script>window.onload=function(){window.print();}</script></html>`);
      printWindow.document.close();
  };

  // --- LOAD EXISTING TICKET ---
  const handleLoadTicket = () => {
      if (!loadTicketInput) return;
      
      const ticketToLoad = loadTicketInput.trim().toUpperCase();
      
      // Filter rows related to this ticket from raw existingTickets or rawDulieu
      // Since existingTickets prop comes from App, it's parsed DeviceRow[].
      // We need to map DeviceRow -> TransactionItem
      
      const relatedRows = existingTickets.filter(r => r.ticketNumber === ticketToLoad);
      
      if (relatedRows.length === 0) {
          alert("Không tìm thấy số phiếu này trong dữ liệu đã tải.");
          return;
      }

      // Populate Ticket Header info from the first row
      const firstRow = relatedRows[0].fullData;
      // Index mapping based on App.tsx/sheetService
      // 1: Type, 2: Partner/Provider, 3: Section, 4: TicketNo, 5: Date
      
      const loadedTicket: WarehouseTicket = {
          ticketType: firstRow[1] === 'Phiếu nhập' ? 'PN' : 'PX', // Approx check
          ticketNumber: ticketToLoad,
          date: convertDisplayToInputDate(formatSheetDateToDisplay(firstRow[5])),
          partner: firstRow[2],
          section: firstRow[3],
          items: relatedRows.map(r => {
              const d = r.fullData;
              return {
                  deviceCode: d[6],
                  deviceName: d[7],
                  details: d[8],
                  unit: d[9],
                  manufacturer: d[10],
                  country: d[11],
                  modelSerial: d[12],
                  warranty: convertDisplayToInputDate(formatSheetDateToDisplay(d[13])),
                  quantity: parseSheetNumber(d[14]),
                  price: parseSheetNumber(d[15]),
                  total: parseSheetNumber(d[16]),
                  notes: d[17]
              };
          })
      };

      setTicket(loadedTicket);
      setLastSavedTicket(null); // Reset saved state since we modified form
      setUploadSuccess(null);
      alert(`Đã tải phiếu ${ticketToLoad} với ${loadedTicket.items.length} thiết bị.`);
      setLoadTicketInput(''); // Clear search box
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!ticket.ticketNumber || !ticket.partner || ticket.items.length === 0) {
        alert("Vui lòng điền đủ: Số phiếu, Đối tác và ít nhất 1 thiết bị.");
        return;
    }
    if (!scriptUrl) {
         setSubmitError("Lỗi: Chưa tìm thấy Script URL.");
         return;
    }
    
    // Warning if ticket number already exists (editing scenario)
    const exists = existingTickets.some(t => t.ticketNumber === ticket.ticketNumber);
    if (exists) {
        const confirmUpdate = confirm(`CẢNH BÁO: Số phiếu "${ticket.ticketNumber}" đã tồn tại!\n\nBạn có muốn LƯU ĐÈ (tạo thêm dòng mới vào Sheet) không?\n\nLưu ý: Hệ thống hiện tại chỉ hỗ trợ THÊM MỚI dòng. Để sửa/xóa dòng cũ, vui lòng dùng Google Sheet trực tiếp.`);
        if (!confirmUpdate) return;
    }

    setIsSubmitting(true);
    try {
        const rowsToSave = ticket.items.map((item, index) => {
            const ticketTypeLabel = ticket.ticketType === 'PN' ? 'Phiếu nhập' : 'Phiếu xuất';
            const stt = index + 1;
            const rowData = [
                stt, String(ticketTypeLabel), String(ticket.partner || ''), String(ticket.section || ''),
                String(ticket.ticketNumber || ''), String(ticket.date || ''), String(item.deviceCode || ''),
                String(item.deviceName || ''), String(item.details || ''), String(item.unit || ''),
                String(item.manufacturer || ''), String(item.country || ''), String(item.modelSerial || ''),
                String(item.warranty || ''), Number(item.quantity || 0), Number(item.price || 0),
                Number(item.total || 0), String(item.notes || '')
            ];
            return rowData.slice(0, 18);
        });

        await saveToGoogleSheet({
            action: 'create_ticket',
            sheetName: 'DULIEU',
            rows: rowsToSave
        }, scriptUrl);

        setLastSavedTicket(ticket);
        alert(`Đã lưu ${ticket.items.length} thiết bị thành công!`);
        onSuccess();
        const rowsForState = rowsToSave.map(r => r.map(String));
        const newRawData = [...rawDulieu, ...rowsForState];
        
        // Only generate NEXT ticket if we were NOT editing an old one
        if (!exists) {
            const nextTicket = generateNextTicketNumber(isImport ? 'import' : 'export', newRawData);
            setTicket(prev => ({...prev, ticketNumber: nextTicket, items: []}));
        } else {
            // Keep current ticket number but clear items to prevent double submit? 
            // Better to keep items for reviewing, but mark as saved.
        }
        setRawDulieu(newRawData);

    } catch (e: any) {
        console.error(e);
        setSubmitError(e.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  // ... (keep datalists and stock display) ...
  const Datalist = ({ id, items }: { id: string, items: string[] }) => (
    <datalist id={id}>{items.map((item, i) => <option key={i} value={item} />)}</datalist>
  );

  const currentStockDisplay = useMemo(() => {
      const stock = getCurrentStock(currentItem);
      return (
          <span className={`text-xs ml-2 font-mono px-2 py-0.5 rounded ${stock > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              Tồn: {stock}
          </span>
      );
  }, [currentItem.deviceCode, currentItem.deviceName, inventoryMap]);

  return (
    <div className="h-full flex flex-col bg-slate-50 p-4 md:p-6 overflow-y-auto">
      {/* --- HIDDEN TICKET TEMPLATE FOR GENERATION (Off-screen) --- */}
      <div style={{ position: 'absolute', left: '-10000px', top: 0 }}>
         {/* Use 'ticket' state instead of 'lastSavedTicket' to allow previewing any state */}
         <div ref={ticketRef} style={{ width: '210mm', padding: '20mm', fontFamily: 'Times New Roman, serif', background: 'white', color: 'black' }}>
            {(ticket.items.length > 0) && (
                <>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                        <div style={{fontWeight:'bold', fontSize:'12px'}}>BỆNH VIỆN ĐA KHOA BUÔN HỒ<br/>KHOA DƯỢC - KHO LINH KIỆN, THIẾT BỊ</div>
                        <div style={{textAlign:'center', fontSize:'12px'}}>Mẫu số: 01-VT<br/><span style={{fontStyle:'italic', fontWeight:'normal'}}>(Ban hành theo Thông tư 200/2014/TT-BTC)</span></div>
                    </div>
                    <div style={{textAlign:'center', fontWeight:'bold', fontSize:'20px', textTransform:'uppercase', marginTop:'20px'}}>
                        {ticket.ticketType === 'PN' ? 'PHIẾU NHẬP KHO' : 'PHIẾU XUẤT KHO'}
                    </div>
                    <div style={{textAlign:'center', fontStyle:'italic', marginBottom:'20px'}}>Ngày {new Date(ticket.date).getDate()} tháng {new Date(ticket.date).getMonth() + 1} năm {new Date(ticket.date).getFullYear()}</div>
                    <div style={{textAlign:'center', marginBottom:'20px'}}>Số: <b>{ticket.ticketNumber}</b></div>

                    <table style={{width:'100%', marginBottom:'20px'}}>
                        <tr><td width="150">{ticket.ticketType === 'PN' ? 'Nhà cung cấp:' : 'Đơn vị/Khoa nhận:'}</td><td style={{fontWeight:'bold'}}>{ticket.partner}</td></tr>
                        <tr><td>{ticket.ticketType === 'PN' ? 'Nhập tại kho:' : 'Xuất cho bộ phận:'}</td><td>{ticket.section || '...................................................'}</td></tr>
                    </table>

                    <table style={{width:'100%', borderCollapse:'collapse', marginBottom:'20px', fontSize:'13px'}}>
                        <thead>
                            <tr style={{textAlign:'center', backgroundColor:'#f0f0f0'}}>
                                <th style={{border:'1px solid black', padding:'6px'}}>STT</th>
                                <th style={{border:'1px solid black', padding:'6px'}}>Tên nhãn hiệu, quy cách</th>
                                <th style={{border:'1px solid black', padding:'6px'}}>Mã số</th>
                                <th style={{border:'1px solid black', padding:'6px'}}>ĐVT</th>
                                <th style={{border:'1px solid black', padding:'6px'}}>SL</th>
                                <th style={{border:'1px solid black', padding:'6px'}}>Đơn giá</th>
                                <th style={{border:'1px solid black', padding:'6px'}}>Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ticket.items.map((it, idx) => (
                                <tr key={idx}>
                                    <td style={{border:'1px solid black', padding:'6px', textAlign:'center', verticalAlign:'middle'}}>{idx+1}</td>
                                    {/* Left Align for Item Name as requested */}
                                    <td style={{border:'1px solid black', padding:'6px', textAlign:'left', verticalAlign:'middle'}}><span style={{fontWeight:'bold'}}>{it.deviceName}</span><br/><span style={{fontSize:'11px'}}>{it.details}</span></td>
                                    <td style={{border:'1px solid black', padding:'6px', textAlign:'center', verticalAlign:'middle'}}>{it.deviceCode}</td>
                                    <td style={{border:'1px solid black', padding:'6px', textAlign:'center', verticalAlign:'middle'}}>{it.unit}</td>
                                    <td style={{border:'1px solid black', padding:'6px', textAlign:'center', verticalAlign:'middle', fontWeight:'bold'}}>{it.quantity}</td>
                                    <td style={{border:'1px solid black', padding:'6px', textAlign:'center', verticalAlign:'middle'}}>{formatNumber(it.price)}</td>
                                    <td style={{border:'1px solid black', padding:'6px', textAlign:'center', verticalAlign:'middle', fontWeight:'bold'}}>{formatNumber(it.total)}</td>
                                </tr>
                            ))}
                            <tr>
                                <td colSpan={6} style={{border:'1px solid black', padding:'6px', textAlign:'right', fontWeight:'bold'}}>Tổng cộng:</td>
                                <td style={{border:'1px solid black', padding:'6px', textAlign:'center', verticalAlign:'middle', fontWeight:'bold'}}>
                                    {formatNumber(ticket.items.reduce((sum, i) => sum + i.total, 0))}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div style={{marginTop:'10px', fontStyle:'italic'}}>
                        Tổng số tiền (bằng chữ): <b>{readMoney(ticket.items.reduce((sum, i) => sum + i.total, 0))}</b>
                    </div>
                    
                    {/* UPDATED SIGNATURE LAYOUT: 
                        PX: Right to Left -> Nguoi Lap -> Thu kho -> Nguoi Nhan
                        PN: Right to Left -> Nguoi Lap -> Thu kho -> Nguoi Giao
                    */}
                    <div style={{display:'flex', justifyContent:'space-between', marginTop:'40px', textAlign:'center'}}>
                        {/* LEFT COLUMN: Nguoi Giao / Nguoi Nhan */}
                        <div style={{width:'33%'}}>
                            <p style={{fontWeight:'bold'}}>{ticket.ticketType === 'PN' ? 'Người giao hàng' : 'Người nhận hàng'}</p>
                            <p style={{fontSize:'11px', fontStyle:'italic'}}>(Ký, họ tên)</p>
                        </div>
                        
                        {/* MIDDLE COLUMN: Thu Kho */}
                        <div style={{width:'33%'}}>
                            <p style={{fontWeight:'bold'}}>Thủ kho</p>
                            <p style={{fontSize:'11px', fontStyle:'italic'}}>(Ký, họ tên)</p>
                        </div>

                        {/* RIGHT COLUMN: Nguoi Lap */}
                        <div style={{width:'33%'}}>
                            <p style={{fontWeight:'bold'}}>Người lập phiếu</p>
                            <p style={{fontSize:'11px', fontStyle:'italic'}}>(Ký, họ tên)</p>
                        </div>
                    </div>
                </>
            )}
         </div>
      </div>

      <Datalist id="dl-suppliers" items={suppliers} />
      <Datalist id="dl-departments" items={departments} />
      <Datalist id="dl-sections" items={sections} />
      <Datalist id="dl-units" items={unitList} />
      <Datalist id="dl-brands" items={brands} />
      <Datalist id="dl-countries" items={countries} />
      <Datalist id="dl-existing-tickets" items={existingTickets.map(t => t.ticketNumber).filter((v, i, a) => a.indexOf(v) === i)} /> {/* Unique tickets */}
      
      <datalist id="dl-device-codes">
        {availableDevices.map((d, i) => {
           const code = d[0]; const name = d[1]; const key = generateKey(code, name); const stock = inventoryMap.get(key) || 0;
           const label = !isImport ? `${name} (Tồn: ${stock})` : name;
           return code ? <option key={i} value={code} label={label} /> : null;
        })}
      </datalist>
      <datalist id="dl-device-names">
        {availableDevices.map((d, i) => {
           const code = d[0]; const name = d[1]; const key = generateKey(code, name); const stock = inventoryMap.get(key) || 0;
           const label = !isImport ? `(Tồn: ${stock}) ${code}` : code;
           return name ? <option key={i} value={name} label={label} /> : null;
        })}
      </datalist>

      {/* SUCCESS BANNER */}
      {lastSavedTicket && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex flex-col md:flex-row items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 gap-3">
             <div className="flex items-center gap-3">
                 <div className="p-2 bg-emerald-100 rounded-full text-emerald-600"><CheckCircle2 className="w-5 h-5"/></div>
                 <div>
                     <p className="font-bold text-emerald-800 text-sm">Lưu thành công phiếu <span className="font-mono text-base">{lastSavedTicket.ticketNumber}</span></p>
                     <p className="text-xs text-emerald-600">
                        {uploadSuccess ? 
                            <span className="flex items-center gap-1 font-bold text-blue-600"><CheckCircle2 className="w-3 h-3"/> Đã upload lên Drive</span> : 
                            "Chọn thao tác tiếp theo bên dưới."}
                     </p>
                 </div>
             </div>
        </div>
      )}

      {/* HEADER WITH LOAD/PRINT ACTIONS */}
      <div className={`bg-white p-6 rounded-xl shadow-sm border-l-4 mb-6 ${isImport ? 'border-emerald-500' : 'border-orange-500'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${isImport ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                    {isImport ? <FileInput className="w-8 h-8" /> : <FileOutput className="w-8 h-8" />}
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{isImport ? 'Phiếu Nhập Kho' : 'Phiếu Xuất Kho'}</h1>
                    <p className="text-slate-500 text-sm">Tạo mới, Sửa hoặc In lại phiếu cũ</p>
                </div>
            </div>

            {/* LOAD TICKET SECTION */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                <div className="relative">
                   <input 
                      list="dl-existing-tickets"
                      value={loadTicketInput}
                      onChange={e => setLoadTicketInput(e.target.value.toUpperCase())}
                      placeholder="Nhập số phiếu cần sửa/in..."
                      className="w-48 pl-2 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded shadow-sm focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                   />
                </div>
                <button 
                    onClick={handleLoadTicket}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded flex items-center gap-1 transition-colors"
                >
                    <RefreshCcw className="w-3 h-3" /> Tải phiếu
                </button>
            </div>
        </div>
        
        {/* Top Actions: Print / PDF (Always Visible) */}
        <div className="flex justify-end gap-2 mb-4 pt-2 border-t border-slate-100">
             <button 
                 onClick={handleSaveToDrive}
                 disabled={isUploading || ticket.items.length === 0}
                 className="px-3 py-1.5 bg-white text-blue-700 border border-blue-200 rounded text-xs font-bold shadow-sm hover:bg-blue-50 transition-all flex items-center gap-1"
             >
                 {isUploading ? <Loader2 className="w-3 h-3 animate-spin"/> : <CloudUpload className="w-3 h-3" />}
                 Xuất PDF & Lưu Drive
             </button>
             <button 
                 onClick={handlePrintTicket}
                 disabled={ticket.items.length === 0}
                 className="px-3 py-1.5 bg-emerald-600 text-white border border-emerald-600 rounded text-xs font-bold shadow-sm hover:bg-emerald-700 transition-all flex items-center gap-1"
             >
                 <Printer className="w-3 h-3" />
                 Xem & In thử
             </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Số Phiếu *</label>
                <div className="relative">
                    <Hash className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"/>
                    <input type="text" value={ticket.ticketNumber} onChange={e => setTicket({...ticket, ticketNumber: e.target.value.toUpperCase()})} placeholder={isImport ? "PN-..." : "PX-..."} className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono font-bold uppercase"/>
                </div>
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Ngày chứng từ *</label>
                <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"/>
                    <input type="date" value={ticket.date} onChange={e => setTicket({...ticket, date: e.target.value})} className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"/>
                </div>
            </div>
            <div className="md:col-span-1">
                <label className="block text-xs font-medium text-slate-500 mb-1">{isImport ? "Nhà Cung Cấp (E) *" : "Khoa / Phòng nhận (A) *"}</label>
                <div className="relative">
                    {isImport ? <Building className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"/> : <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"/>}
                    <input list={isImport ? "dl-suppliers" : "dl-departments"} value={ticket.partner} onChange={e => setTicket({...ticket, partner: e.target.value})} className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Chọn từ danh mục..."/>
                </div>
            </div>
             <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Bộ phận (B)</label>
                <input list="dl-sections" value={ticket.section} onChange={e => setTicket({...ticket, section: e.target.value})} className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Chọn từ danh mục..."/>
            </div>
        </div>
      </div>

      {/* Input Device Form */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Plus className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full p-1" /> Chi tiết thiết bị</h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
             <div className="md:col-span-2">
                 <label className="text-xs text-slate-500 font-bold mb-1 h-6 flex items-center">Mã TB</label>
                 <div className="relative">
                    <input list="dl-device-codes" value={currentItem.deviceCode} onChange={e => handleDeviceSelection(e.target.value, 'code')} placeholder="Gõ mã..." className="w-full h-9 px-3 pl-8 border border-slate-300 rounded text-sm font-mono focus:ring-2 focus:ring-emerald-400 outline-none"/>
                    <Search className="w-3 h-3 absolute left-3 top-3 text-slate-400" />
                 </div>
            </div>
            <div className="md:col-span-3">
                 <label className="text-xs text-slate-500 font-bold mb-1 h-6 flex items-center">Tên thiết bị * {currentStockDisplay}</label>
                 <div className="relative">
                    <input list="dl-device-names" value={currentItem.deviceName} onChange={e => handleDeviceSelection(e.target.value, 'name')} placeholder={!isImport ? "Chỉ hiện thiết bị có tồn > 0" : "Gõ tên..."} className="w-full h-9 px-3 pl-8 border border-slate-300 rounded text-sm font-semibold focus:ring-2 focus:ring-emerald-400 outline-none"/>
                    <Search className="w-3 h-3 absolute left-3 top-3 text-slate-400" />
                 </div>
            </div>
            <div className="md:col-span-3">
                 <label className="text-xs text-slate-500 mb-1 h-6 flex items-center">Thông tin chi tiết</label>
                 <input value={currentItem.details} onChange={e => setCurrentItem({...currentItem, details: e.target.value})} className="w-full h-9 px-3 border border-slate-300 rounded text-sm"/>
            </div>
             <div className="md:col-span-2">
                 <label className="text-xs text-slate-500 mb-1 h-6 flex items-center">ĐVT</label>
                 <input list="dl-units" value={currentItem.unit} onChange={e => setCurrentItem({...currentItem, unit: e.target.value})} className="w-full h-9 px-3 border border-slate-300 rounded text-sm"/>
            </div>
             <div className="md:col-span-2">
                 <label className="text-xs text-slate-500 mb-1 h-6 flex items-center">Model / Serial</label>
                 <input value={currentItem.modelSerial} onChange={e => setCurrentItem({...currentItem, modelSerial: e.target.value})} className="w-full h-9 px-3 border border-slate-300 rounded text-sm"/>
            </div>
             <div className="md:col-span-2">
                 <label className="text-xs text-slate-500 mb-1 h-6 flex items-center">Hãng SX</label>
                 <input list="dl-brands" value={currentItem.manufacturer} onChange={e => setCurrentItem({...currentItem, manufacturer: e.target.value})} className="w-full h-9 px-3 border border-slate-300 rounded text-sm"/>
            </div>
            <div className="md:col-span-2">
                 <label className="text-xs text-slate-500 mb-1 h-6 flex items-center">Nước SX</label>
                 <input list="dl-countries" value={currentItem.country} onChange={e => setCurrentItem({...currentItem, country: e.target.value})} className="w-full h-9 px-3 border border-slate-300 rounded text-sm"/>
            </div>
            <div className="md:col-span-2">
                 <label className="text-xs text-slate-500 mb-1 h-6 flex items-center">Bảo hành</label>
                 <input type="date" value={currentItem.warranty} onChange={e => setCurrentItem({...currentItem, warranty: e.target.value})} className="w-full h-9 px-3 border border-slate-300 rounded text-sm"/>
            </div>
             <div className="md:col-span-2">
                 <label className="text-xs text-slate-500 font-bold text-blue-600 mb-1 h-6 flex items-center">Số lượng</label>
                 <input type="number" min="1" value={currentItem.quantity} onChange={e => { const q = parseFloat(e.target.value)||0; setCurrentItem({...currentItem, quantity: q, total: q*(currentItem.price||0)})}} className="w-full h-9 px-3 border border-blue-300 rounded text-sm font-bold text-center"/>
            </div>
             <div className="md:col-span-2">
                 <label className="text-xs text-slate-500 mb-1 h-6 flex items-center">Đơn giá</label>
                 <div className="relative">
                    <input type="text" value={formatNumber(currentItem.price)} onChange={e => { const val = parseFormattedNumber(e.target.value); setCurrentItem({...currentItem, price: val, total: val*(currentItem.quantity||0)}); }} className="w-full h-9 px-3 border border-slate-300 rounded text-sm text-right pr-6 font-mono" placeholder="0"/>
                    <span className="absolute right-2 top-2.5 text-slate-400 text-xs">₫</span>
                 </div>
            </div>
             <div className="md:col-span-2">
                <label className="text-xs text-slate-500 mb-1 h-6 flex items-center">Thành tiền</label>
                <div className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded text-sm text-right font-bold text-slate-800 font-mono flex items-center justify-end">{formatNumber((currentItem.quantity||0)*(currentItem.price||0))} ₫</div>
             </div>
             <div className="md:col-span-9">
                 <label className="text-xs text-slate-500 font-bold mb-1 h-6 flex items-center">Ghi chú / Upload file (Cột R)</label>
                 <div className="relative flex gap-1">
                    <div className="relative flex-1">
                        <StickyNote className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input value={currentItem.notes} onChange={e => setCurrentItem({...currentItem, notes: e.target.value})} className="w-full h-9 pl-9 pr-3 border border-slate-300 rounded text-sm" placeholder="Nhập ghi chú hoặc link file..."/>
                    </div>
                    {/* File Upload Button */}
                    <input 
                        type="file" 
                        ref={noteFileInputRef}
                        className="hidden"
                        onChange={handleNoteFileUpload}
                    />
                    <button 
                        onClick={() => noteFileInputRef.current?.click()}
                        disabled={isUploadingNote}
                        className="px-3 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors flex items-center justify-center text-slate-500"
                        title="Upload file đính kèm"
                    >
                        {isUploadingNote ? <Loader2 className="w-4 h-4 animate-spin"/> : <Paperclip className="w-4 h-4"/>}
                    </button>
                 </div>
            </div>
             <div className="md:col-span-3 flex items-end">
                <button onClick={addItem} className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium shadow-sm active:translate-y-0.5 flex items-center justify-center gap-2 text-sm"><PlusCircle className="w-5 h-5" /> Thêm vào phiếu</button>
             </div>
        </div>
      </div>

      {/* Table Items */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {submitError && <div className="bg-red-50 p-4 border-b border-red-100 flex items-start gap-3"><AlertCircle className="w-5 h-5 text-red-500 mt-0.5" /><div className="text-sm text-red-700 whitespace-pre-line">{submitError}</div></div>}
        <div className="overflow-auto flex-1">
            <table className="w-full text-left text-sm">
                <thead className="bg-emerald-50 text-emerald-700 font-semibold uppercase text-xs sticky top-0 border-b border-emerald-100">
                    <tr><th className="p-3 w-10">#</th><th className="p-3">Mã TB</th><th className="p-3">Tên Thiết Bị / Chi tiết</th><th className="p-3">Ghi chú</th><th className="p-3 w-28 text-right">Đơn giá</th><th className="p-3 w-20 text-right">SL</th><th className="p-3 w-32 text-right">Thành tiền</th><th className="p-3 w-12"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {ticket.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 text-slate-400">{idx + 1}</td>
                            <td className="p-3 font-mono text-xs font-bold text-slate-600">{item.deviceCode}</td>
                            <td className="p-3"><div className="font-medium text-slate-700">{item.deviceName}</div><div className="text-xs text-slate-500 truncate max-w-[200px]">{item.details}</div></td>
                            <td className="p-3 text-xs text-slate-500 max-w-[200px] truncate">
                                {item.notes && (item.notes.startsWith('http') ? <a href={item.notes} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1"><LinkIcon className="w-3 h-3"/> Link file</a> : item.notes)}
                            </td>
                            <td className="p-3 text-right text-slate-600 font-mono">{formatNumber(item.price)}</td>
                            <td className="p-3 text-right font-bold text-blue-600">{item.quantity} {item.unit}</td>
                             <td className="p-3 text-right font-medium text-slate-800 font-mono">{formatNumber(item.total)}</td>
                            <td className="p-3 text-center"><button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                        </tr>
                    ))}
                    {ticket.items.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-400 italic">{isImport ? "Chưa có thiết bị nào được thêm." : "Vui lòng chọn thiết bị từ danh sách tồn kho."}</td></tr>}
                </tbody>
            </table>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 items-center">
             <div className="mr-auto font-bold text-slate-700">Tổng cộng: <span className="text-blue-600 text-lg">{formatNumber(ticket.items.reduce((sum, i) => sum + i.total, 0))} ₫</span></div>
             <button disabled={isSubmitting || ticket.items.length === 0} onClick={handleSubmit} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50 disabled:shadow-none transition-all">{isSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5" />} Lưu Phiếu {isImport ? 'Nhập' : 'Xuất'}</button>
        </div>
      </div>
    </div>
  );
};
