
import React, { useState, useEffect, useMemo } from 'react';
import { fetchGoogleSheetData, saveToGoogleSheet } from '../services/sheetService';
import { WarehouseTicket, TransactionItem } from '../types';
import { Save, Trash2, FileInput, FileOutput, Calendar, User, Building, Hash, Loader2, PlusCircle, Search, AlertCircle, StickyNote, Plus } from 'lucide-react';

interface WarehouseFormProps {
  type: 'import' | 'export';
  sheetId: string;
  scriptUrl: string; 
}

export const WarehouseForm: React.FC<WarehouseFormProps> = ({ type, sheetId, scriptUrl }) => {
  const isImport = type === 'import';
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  // --- Helper: Generate consistent key for map ---
  const generateKey = (code: string, name: string) => {
      const c = code ? code.toString().trim() : '';
      const n = name ? name.toString().trim() : '';
      return c || n;
  };

  // --- Helper: Parse number from sheet ---
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

  // --- Helper: Format Number with dots ---
  const formatNumber = (num: number | undefined) => {
      if (!num) return '';
      return num.toLocaleString('vi-VN');
  };

  // --- Helper: Parse Number from formatted string ---
  const parseFormattedNumber = (str: string) => {
      if (!str) return 0;
      // Remove dots (Vietnamese thousands separator)
      const clean = str.replace(/\./g, '');
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
  };

  // --- Helper: Date Formatting ---
  const formatSheetDateToDisplay = (input: any): string => {
      if (!input) return '';
      const str = String(input).trim();
      
      // Handle Google Sheet Date(y,m,d)
      if (str.includes('Date(')) {
          const parts = str.match(/\d+/g);
          if (parts && parts.length >= 3) {
              const y = parts[0];
              const m = parseInt(parts[1]) + 1;
              const d = parts[2];
              return `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`;
          }
      }
      // Handle yyyy-mm-dd
      if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [y, m, d] = str.split('-');
          return `${d}/${m}/${y}`;
      }
      // Handle dd/mm/yyyy (Text input from users) or d/m/yyyy
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
      // Expect dd/mm/yyyy
      if (displayDate.includes('/')) {
         const parts = displayDate.split('/');
         if (parts.length === 3) {
             // Return yyyy-mm-dd for input type="date"
             return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
         }
      }
      // Already in yyyy-mm-dd?
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

  // --- AUTO INCREMENT TICKET NUMBER ---
  const generateNextTicketNumber = (type: 'import' | 'export', data: string[][]) => {
      const prefix = type === 'import' ? 'PN' : 'PX';
      let maxNum = 0;

      data.forEach((row) => {
          // Bỏ qua dòng STT nếu có (thường là tiêu đề cột A)
          if (row[0] === 'STT') return;

          // Kiểm tra kỹ ô E (index 4) - Số Phiếu
          const cellE = row[4] ? row[4].toString().trim() : '';
          
          // Bỏ qua nếu là dòng tiêu đề "Số Phiếu" hoặc rỗng
          if (!cellE || cellE.toUpperCase() === 'SỐ PHIẾU' || cellE.toUpperCase() === 'SO PHIEU') return;

          const t = cellE.toUpperCase();
          // Kiểm tra xem có bắt đầu bằng tiền tố (PN/PX) không
          if (t.startsWith(prefix)) {
              // Lấy phần số bằng cách loại bỏ tất cả ký tự không phải số (regex \D)
              // Ví dụ: "PX-0018" -> 18, "PX 0019" -> 19
              const numStr = t.replace(/\D/g, ''); 
              const numPart = parseInt(numStr, 10);
              
              if (!isNaN(numPart) && numPart > maxNum) {
                  maxNum = numPart;
              }
          }
      });

      // Chỉ tăng 1 đơn vị so với số lớn nhất tìm được
      const nextNum = maxNum + 1;
      return `${prefix}${nextNum.toString().padStart(4, '0')}`;
  };

  // --- 1. LOAD DATA ---
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

        // Parse DMDC
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

        // Parse DANHMUC
        const validDevices = deviceData.filter(r => r[0] || r[1]);
        setMasterDevices(validDevices);
        
        const units = new Set<string>();
        validDevices.forEach(d => { if (d[3]) units.add(d[3]); });
        setUnitList(Array.from(units));

        // --- CALCULATE INVENTORY & METADATA ---
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
                    
                    const meta = [
                        row[6] || '', row[7] || '', row[8] || '', 
                        row[9] || '', row[10] || '', row[11] || '', row[12] || ''
                    ];
                    metaMap.set(key, meta);

                    // Row 13 is Warranty (Column N)
                    const rawWarranty = row[13];
                    if (rawWarranty) {
                        const formattedW = formatSheetDateToDisplay(rawWarranty);
                        if (formattedW && formattedW.includes('/')) {
                            wMap.set(key, formattedW);
                        }
                    }

                    const price = parseSheetNumber(row[15]);
                    if (price > 0) {
                        pMap.set(key, price);
                    }
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
      if (!isLoading && rawDulieu.length >= 0) {
          const nextTicket = generateNextTicketNumber(type, rawDulieu);
          setTicket(prev => ({
              ...prev, 
              ticketType: isImport ? 'PN' : 'PX',
              ticketNumber: nextTicket, 
              items: [] 
          }));
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

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!ticket.ticketNumber || !ticket.partner || ticket.items.length === 0) {
        alert("Vui lòng điền đủ: Số phiếu, Đối tác (NCC/Khoa) và ít nhất 1 thiết bị.");
        return;
    }

    if (!scriptUrl) {
         setSubmitError("Lỗi: Chưa tìm thấy Script URL. Hãy đảm bảo URL đã được nhập trong sheet DMDC!A2.");
         return;
    }

    setIsSubmitting(true);
    try {
        const rowsToSave = ticket.items.map((item, index) => {
            const ticketTypeLabel = ticket.ticketType === 'PN' ? 'Phiếu nhập' : 'Phiếu xuất';
            
            // TẠO STT CỤC BỘ: 1, 2, 3... cho các thiết bị trong phiếu này
            const stt = index + 1;

            // Xây dựng mảng dữ liệu đầy đủ 18 cột (A->R)
            const rowData = [
                stt,                         // A: STT (Số thứ tự trong phiếu)
                String(ticketTypeLabel),     // B: Loại phiếu
                String(ticket.partner || ''), // C: Đối tác
                String(ticket.section || ''), // D: Bộ phận
                String(ticket.ticketNumber || ''), // E: Số phiếu
                String(ticket.date || ''),   // F: Ngày
                String(item.deviceCode || ''), // G: Mã TB
                String(item.deviceName || ''), // H: Tên TB
                String(item.details || ''),  // I: Chi tiết
                String(item.unit || ''),     // J: ĐVT
                String(item.manufacturer || ''), // K: Hãng
                String(item.country || ''),  // L: Nước
                String(item.modelSerial || ''), // M: Model
                String(item.warranty || ''), // N: Bảo hành
                Number(item.quantity || 0),  // O: SL
                Number(item.price || 0),     // P: Giá
                Number(item.total || 0),     // Q: Thành tiền
                String(item.notes || '')     // R: Ghi chú
            ];

            // LUÔN LUÔN CẮT CHÍNH XÁC 18 CỘT (Index 0 đến 17: Cột A đến Cột R)
            // Kể cả phiếu xuất hay nhập đều phải gửi đủ 18 cột để đảm bảo STT và Ghi chú không bị lệch.
            // Cột S (19) sẽ không bị chạm tới.
            return rowData.slice(0, 18);
        });

        await saveToGoogleSheet({
            action: 'create_ticket',
            sheetName: 'DULIEU',
            rows: rowsToSave
        }, scriptUrl);

        alert(`Đã lưu ${ticket.items.length} thiết bị thành công!`);
        
        // Update local state to reflect changes immediately
        const rowsForState = rowsToSave.map(r => r.map(String));
        // Append new data locally for calculation
        const newRawData = [...rawDulieu, ...rowsForState];
        
        const nextTicket = generateNextTicketNumber(
            isImport ? 'import' : 'export', 
            newRawData
        );
        
        setRawDulieu(newRawData); 
        setTicket(prev => ({...prev, ticketNumber: nextTicket, items: []}));
        
        if (!isImport) {
             const newMap = new Map<string, number>(inventoryMap);
             ticket.items.forEach(item => {
                 const key = generateKey(item.deviceCode, item.deviceName);
                 const current = Number(newMap.get(key) || 0);
                 newMap.set(key, current - Number(item.quantity));
             });
             setInventoryMap(newMap);
        }

    } catch (e: any) {
        console.error(e);
        setSubmitError(e.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  const Datalist = ({ id, items }: { id: string, items: string[] }) => (
    <datalist id={id}>
      {items.map((item, i) => <option key={i} value={item} />)}
    </datalist>
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
      {/* Hidden Datalists */}
      <Datalist id="dl-suppliers" items={suppliers} />
      <Datalist id="dl-departments" items={departments} />
      <Datalist id="dl-sections" items={sections} />
      <Datalist id="dl-units" items={unitList} />
      <Datalist id="dl-brands" items={brands} />
      <Datalist id="dl-countries" items={countries} />
      
      <datalist id="dl-device-codes">
        {availableDevices.map((d, i) => {
           const code = d[0];
           const name = d[1];
           const key = generateKey(code, name);
           const stock = inventoryMap.get(key) || 0;
           const label = !isImport ? `${name} (Tồn: ${stock})` : name;
           return code ? <option key={i} value={code} label={label} /> : null;
        })}
      </datalist>
      <datalist id="dl-device-names">
        {availableDevices.map((d, i) => {
           const code = d[0];
           const name = d[1];
           const key = generateKey(code, name);
           const stock = inventoryMap.get(key) || 0;
           const label = !isImport ? `(Tồn: ${stock}) ${code}` : code;
           return name ? <option key={i} value={name} label={label} /> : null;
        })}
      </datalist>

      {/* Header Form */}
      <div className={`bg-white p-6 rounded-xl shadow-sm border-l-4 mb-6 ${isImport ? 'border-emerald-500' : 'border-orange-500'}`}>
        <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-lg ${isImport ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                {isImport ? <FileInput className="w-8 h-8" /> : <FileOutput className="w-8 h-8" />}
            </div>
            <div>
                <h1 className="text-2xl font-bold text-slate-800">
                    {isImport ? 'Phiếu Nhập Kho' : 'Phiếu Xuất Kho'}
                </h1>
                <p className="text-slate-500 text-sm">Tạo phiếu mới và ghi nhận vào hệ thống</p>
                {scriptUrl ? (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit mt-1">
                        Kết nối: {scriptUrl.substring(0, 30)}...
                    </span>
                ) : (
                    <span className="text-[10px] text-red-500 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit mt-1 animate-pulse">
                        Chưa kết nối Script URL
                    </span>
                )}
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Số Phiếu *</label>
                <div className="relative">
                    <Hash className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"/>
                    <input 
                        type="text" 
                        value={ticket.ticketNumber}
                        onChange={e => setTicket({...ticket, ticketNumber: e.target.value.toUpperCase()})}
                        placeholder={isImport ? "PN-..." : "PX-..."}
                        className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono font-bold uppercase"
                    />
                </div>
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Ngày chứng từ *</label>
                <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"/>
                    <input 
                        type="date" 
                        value={ticket.date}
                        onChange={e => setTicket({...ticket, date: e.target.value})}
                        className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>
            <div className="md:col-span-1">
                <label className="block text-xs font-medium text-slate-500 mb-1">
                    {isImport ? "Nhà Cung Cấp (E) *" : "Khoa / Phòng nhận (A) *"}
                </label>
                <div className="relative">
                    {isImport ? <Building className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"/> : <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"/>}
                    <input 
                        list={isImport ? "dl-suppliers" : "dl-departments"}
                        value={ticket.partner}
                        onChange={e => setTicket({...ticket, partner: e.target.value})}
                        className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Chọn từ danh mục..."
                    />
                </div>
            </div>
             <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Bộ phận (B)</label>
                <input 
                    list="dl-sections"
                    value={ticket.section}
                    onChange={e => setTicket({...ticket, section: e.target.value})}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Chọn từ danh mục..."
                />
            </div>
        </div>
      </div>

      {/* Input Device Form - RE-LAYOUT 3 ROWS */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Plus className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full p-1" />
            Chi tiết thiết bị {isImport ? '(Nhập Mới)' : '(Chọn Từ Tồn Kho)'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
             
             {/* --- ROW 1: Mã, Tên, Chi tiết, ĐVT, Model --- */}
             
             <div className="md:col-span-2">
                 <label className="text-xs text-slate-500 font-bold mb-1 h-6 flex items-center">Mã TB</label>
                 <div className="relative">
                    <input 
                        list="dl-device-codes"
                        value={currentItem.deviceCode}
                        onChange={e => handleDeviceSelection(e.target.value, 'code')}
                        placeholder="Gõ mã..."
                        className="w-full h-9 px-3 pl-8 border border-slate-300 rounded text-sm font-mono focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none"
                    />
                    <Search className="w-3 h-3 absolute left-3 top-3 text-slate-400" />
                 </div>
            </div>
            <div className="md:col-span-3">
                 <label className="text-xs text-slate-500 font-bold mb-1 h-6 flex items-center">
                    Tên thiết bị *
                    {currentStockDisplay}
                 </label>
                 <div className="relative">
                    <input 
                        list="dl-device-names"
                        value={currentItem.deviceName}
                        onChange={e => handleDeviceSelection(e.target.value, 'name')}
                        placeholder={!isImport ? "Chỉ hiện thiết bị có tồn kho > 0" : "Gõ tên để tìm..."}
                        className="w-full h-9 px-3 pl-8 border border-slate-300 rounded text-sm font-semibold focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none"
                    />
                    <Search className="w-3 h-3 absolute left-3 top-3 text-slate-400" />
                 </div>
            </div>
            <div className="md:col-span-3">
                 <label className="text-xs text-slate-500 mb-1 h-6 flex items-center">Thông tin chi tiết</label>
                 <input 
                    value={currentItem.details}
                    onChange={e => setCurrentItem({...currentItem, details: e.target.value})}
                    className="w-full h-9 px-3 border border-slate-300 rounded text-sm"
                 />
            </div>
             <div className="md:col-span-2">
                 <label className="text-xs text-slate-500 mb-1 h-6 flex items-center">ĐVT</label>
                 <input 
                    list="dl-units"
                    value={currentItem.unit}
                    onChange={e => setCurrentItem({...currentItem, unit: e.target.value})}
                    className="w-full h-9 px-3 border border-slate-300 rounded text-sm"
                 />
            </div>
            
             <div className="md:col-span-2">
                 <label className="text-xs text-slate-500 mb-1 h-6 flex items-center">Model / Serial</label>
                 <input 
                    value={currentItem.modelSerial}
                    onChange={e => setCurrentItem({...currentItem, modelSerial: e.target.value})}
                    className="w-full h-9 px-3 border border-slate-300 rounded text-sm"
                 />
            </div>

            {/* --- ROW 2: Hãng, Nước, Bảo hành, SL, Đơn giá, Thành tiền --- */}

             <div className="md:col-span-2">
                 <label className="text-xs text-slate-500 mb-1 h-6 flex items-center">Hãng SX</label>
                 <input 
                    list="dl-brands"
                    value={currentItem.manufacturer}
                    onChange={e => setCurrentItem({...currentItem, manufacturer: e.target.value})}
                    className="w-full h-9 px-3 border border-slate-300 rounded text-sm"
                 />
            </div>
            <div className="md:col-span-2">
                 <label className="text-xs text-slate-500 mb-1 h-6 flex items-center">Nước SX</label>
                 <input 
                    list="dl-countries"
                    value={currentItem.country}
                    onChange={e => setCurrentItem({...currentItem, country: e.target.value})}
                    className="w-full h-9 px-3 border border-slate-300 rounded text-sm"
                 />
            </div>
            <div className="md:col-span-2">
                 <label className="text-xs text-slate-500 mb-1 h-6 flex items-center">Bảo hành</label>
                 <input 
                    type="date"
                    value={currentItem.warranty} 
                    onChange={e => setCurrentItem({...currentItem, warranty: e.target.value})}
                    className="w-full h-9 px-3 border border-slate-300 rounded text-sm"
                 />
            </div>
            
             <div className="md:col-span-2">
                 <label className="text-xs text-slate-500 font-bold text-blue-600 mb-1 h-6 flex items-center">Số lượng</label>
                 <input 
                    type="number" min="1"
                    value={currentItem.quantity}
                    onChange={e => {
                        const q = parseFloat(e.target.value) || 0;
                        setCurrentItem({...currentItem, quantity: q, total: q * (currentItem.price || 0)})
                    }}
                    className="w-full h-9 px-3 border border-blue-300 rounded text-sm font-bold text-center"
                 />
            </div>
             <div className="md:col-span-2">
                 <label className="text-xs text-slate-500 mb-1 h-6 flex items-center">Đơn giá</label>
                 <div className="relative">
                    <input 
                        type="text"
                        value={formatNumber(currentItem.price)}
                        onChange={e => {
                            const val = parseFormattedNumber(e.target.value);
                            setCurrentItem({...currentItem, price: val, total: val * (currentItem.quantity || 0)});
                        }}
                        className="w-full h-9 px-3 border border-slate-300 rounded text-sm text-right pr-6 font-mono"
                        placeholder="0"
                    />
                    <span className="absolute right-2 top-2.5 text-slate-400 text-xs">₫</span>
                 </div>
            </div>
             <div className="md:col-span-2">
                <label className="text-xs text-slate-500 mb-1 h-6 flex items-center">Thành tiền</label>
                <div className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded text-sm text-right font-bold text-slate-800 font-mono flex items-center justify-end">
                    {formatNumber((currentItem.quantity || 0) * (currentItem.price || 0))} ₫
                </div>
             </div>

            {/* --- ROW 3: Ghi chú, Button --- */}

             <div className="md:col-span-9">
                 <label className="text-xs text-slate-500 font-bold mb-1 h-6 flex items-center">Ghi chú (Cột R)</label>
                 <div className="relative">
                    <StickyNote className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input 
                        value={currentItem.notes}
                        onChange={e => setCurrentItem({...currentItem, notes: e.target.value})}
                        className="w-full h-9 pl-9 pr-3 border border-slate-300 rounded text-sm"
                        placeholder="Nhập ghi chú hoặc link file..."
                    />
                 </div>
            </div>
             
             <div className="md:col-span-3 flex items-end">
                <button 
                    onClick={addItem}
                    className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium shadow-sm active:translate-y-0.5 flex items-center justify-center gap-2 text-sm"
                >
                    <PlusCircle className="w-5 h-5" />
                    Thêm vào phiếu
                </button>
             </div>
        </div>
      </div>

      {/* Table Items */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {submitError && (
            <div className="bg-red-50 p-4 border-b border-red-100 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div className="text-sm text-red-700 whitespace-pre-line">{submitError}</div>
            </div>
        )}

        <div className="overflow-auto flex-1">
            <table className="w-full text-left text-sm">
                <thead className="bg-emerald-50 text-emerald-700 font-semibold uppercase text-xs sticky top-0 border-b border-emerald-100">
                    <tr>
                        <th className="p-3 w-10">#</th>
                        <th className="p-3">Mã TB</th>
                        <th className="p-3">Tên Thiết Bị / Chi tiết</th>
                        <th className="p-3">Ghi chú</th>
                        <th className="p-3 w-28 text-right">Đơn giá</th>
                        <th className="p-3 w-20 text-right">SL</th>
                        <th className="p-3 w-32 text-right">Thành tiền</th>
                        <th className="p-3 w-12"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {ticket.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 text-slate-400">{idx + 1}</td>
                            <td className="p-3 font-mono text-xs font-bold text-slate-600">{item.deviceCode}</td>
                            <td className="p-3">
                                <div className="font-medium text-slate-700">{item.deviceName}</div>
                                <div className="text-xs text-slate-500 truncate max-w-[200px]">{item.details}</div>
                            </td>
                            <td className="p-3 text-xs text-slate-500 truncate max-w-[150px]">{item.notes}</td>
                            <td className="p-3 text-right text-slate-600 font-mono">{formatNumber(item.price)}</td>
                            <td className="p-3 text-right font-bold text-blue-600">{item.quantity} {item.unit}</td>
                             <td className="p-3 text-right font-medium text-slate-800 font-mono">{formatNumber(item.total)}</td>
                            <td className="p-3 text-center">
                                <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {ticket.items.length === 0 && (
                        <tr>
                            <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                                {isImport 
                                    ? "Chưa có thiết bị nào được thêm." 
                                    : "Vui lòng chọn thiết bị từ danh sách tồn kho."
                                }
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        
        <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 items-center">
             <div className="mr-auto font-bold text-slate-700">
                 Tổng cộng: <span className="text-blue-600 text-lg">{formatNumber(ticket.items.reduce((sum, i) => sum + i.total, 0))} ₫</span>
             </div>
             <button 
                disabled={isSubmitting || ticket.items.length === 0}
                onClick={handleSubmit}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50 disabled:shadow-none transition-all"
             >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5" />}
                Lưu Phiếu {isImport ? 'Nhập' : 'Xuất'}
             </button>
        </div>
      </div>
    </div>
  );
};
