
import React, { useState, useEffect, useMemo } from 'react';
import { fetchGoogleSheetData, saveToGoogleSheet } from '../services/sheetService';
import { WarehouseTicket, TransactionItem } from '../types';
import { Save, Plus, Trash2, FileInput, FileOutput, Calendar, User, Building, Hash, Loader2, AlertCircle, Package } from 'lucide-react';

interface WarehouseFormProps {
  type: 'import' | 'export';
  sheetId: string;
}

export const WarehouseForm: React.FC<WarehouseFormProps> = ({ type, sheetId }) => {
  const isImport = type === 'import';
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Master Data State
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  
  // Dữ liệu thiết bị từ sheet DANHMUC (C4:I)
  const [masterDevices, setMasterDevices] = useState<string[][]>([]); 
  const [unitList, setUnitList] = useState<string[]>([]); 
  
  // Tồn kho (Chỉ dùng khi Xuất)
  const [inventoryMap, setInventoryMap] = useState<Map<string, number>>(new Map());

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
      // Ưu tiên dùng Mã, nếu không có Mã dùng Tên
      const c = code ? code.trim().toLowerCase() : '';
      const n = name ? name.trim().toLowerCase() : '';
      return c || n;
  };

  // --- Helper: Parse number from sheet ---
  const parseSheetNumber = (val: any) => {
      if (!val) return 0;
      let str = String(val).trim();
      // Xử lý trường hợp "1,000" hoặc "1.000" tùy locale, ở đây giả sử loại bỏ dấu phân cách ngàn
      // Nếu có cả . và , thì đoán format. Đơn giản nhất là remove non-numeric chars except last dot/comma separator if exists.
      // Cách an toàn nhất cho VN/US mix:
      str = str.replace(/,/g, ''); // Remove commas
      return parseFloat(str) || 0;
  };

  // --- 1. LOAD DATA ---
  useEffect(() => {
    if (!sheetId) return;
    
    const loadAllData = async () => {
      setIsLoading(true);
      try {
        const promises = [
            fetchGoogleSheetData(sheetId, 'DMDC!A4:E'),
            fetchGoogleSheetData(sheetId, 'DANHMUC!C4:I')
        ];
        // Nếu là xuất kho, cần tải thêm lịch sử giao dịch để tính tồn
        if (!isImport) {
            promises.push(fetchGoogleSheetData(sheetId, 'DULIEU'));
        }

        const results = await Promise.all(promises);
        const dmdcData = results[0];
        const deviceData = results[1];
        const dulieuData = !isImport ? results[2] : [];

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

        // Calculate Inventory if Export
        if (!isImport && dulieuData.length > 0) {
            const stock = new Map<string, number>();
            dulieuData.forEach(row => {
                // DULIEU Cols: B(Type)=1, G(Code)=6, H(Name)=7, O(Qty)=14
                const type = row[1]?.toString().trim().toUpperCase();
                const code = row[6] || '';
                const name = row[7] || '';
                const key = generateKey(code, name);
                
                if (!key) return;

                const qty = parseSheetNumber(row[14]);

                const current = stock.get(key) || 0;
                
                // Logic: PX* là xuất, còn lại (PN, v.v.) coi là nhập
                if (type && type.startsWith('PX')) {
                    stock.set(key, current - qty);
                } else {
                    stock.set(key, current + qty);
                }
            });
            setInventoryMap(stock);
        }

      } catch (e) {
        console.error("Error loading data", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllData();
    
    setTicket(prev => ({
        ...prev, 
        ticketType: isImport ? 'PN' : 'PX',
        ticketNumber: '',
        partner: '',
        items: []
    }));
  }, [type, sheetId]);

  // Filter Devices for Suggestions (Only Stock > 0 if Export)
  const availableDevices = useMemo(() => {
     if (isImport) return masterDevices;
     
     // Chỉ trả về các thiết bị có tồn kho > 0
     return masterDevices.filter(d => {
         const code = d[0] || '';
         const name = d[1] || '';
         const key = generateKey(code, name);
         const stock = inventoryMap.get(key) || 0;
         return stock > 0;
     });
  }, [masterDevices, isImport, inventoryMap]);

  // Current Stock Check Helper
  const getCurrentStock = (item: TransactionItem) => {
      const key = generateKey(item.deviceCode, item.deviceName);
      return inventoryMap.get(key) || 0;
  };

  // --- 2. AUTO-FILL DEVICE INFO ---
  const handleDeviceSelection = (value: string, type: 'code' | 'name') => {
    let matchedDevice: string[] | undefined;

    if (type === 'code') {
        matchedDevice = masterDevices.find(d => d[0]?.trim() === value.trim());
        if (!matchedDevice) {
             // Allow partial input
             setCurrentItem(prev => ({...prev, deviceCode: value}));
             return;
        }
    } else {
        matchedDevice = masterDevices.find(d => d[1]?.trim() === value.trim());
        if (!matchedDevice) {
             setCurrentItem(prev => ({...prev, deviceName: value}));
             return;
        }
    }

    if (matchedDevice) {
        setCurrentItem(prev => ({
            ...prev,
            deviceCode: matchedDevice![0] || prev.deviceCode, 
            deviceName: matchedDevice![1] || prev.deviceName,
            details: matchedDevice![2] || '',
            unit: matchedDevice![3] || '',
            manufacturer: matchedDevice![4] || '',
            country: matchedDevice![5] || '',
            modelSerial: matchedDevice![6] || ''
        }));
    }
  };

  const addItem = () => {
    if (!currentItem.deviceName) {
        alert("Vui lòng nhập tên thiết bị");
        return;
    }

    // Validate Export Quantity
    if (!isImport) {
        const stock = getCurrentStock(currentItem);
        const qty = Number(currentItem.quantity);
        if (qty > stock) {
            alert(`Lỗi: Số lượng xuất (${qty}) lớn hơn tồn kho hiện tại (${stock}).`);
            return;
        }
    }

    setTicket(prev => ({
        ...prev,
        items: [...prev.items, { ...currentItem, total: Number(currentItem.quantity) * Number(currentItem.price) }]
    }));
    setCurrentItem(emptyItem); 
  };

  const removeItem = (index: number) => {
    setTicket(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    if (!ticket.ticketNumber || !ticket.partner || ticket.items.length === 0) {
        alert("Vui lòng điền đủ: Số phiếu, Đối tác (NCC/Khoa) và ít nhất 1 thiết bị.");
        return;
    }

    setIsSubmitting(true);
    try {
        const rowsToSave = ticket.items.map((item) => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;
            return [
                "'", // STT
                ticket.ticketType,
                ticket.partner, 
                ticket.section, 
                ticket.ticketNumber,
                ticket.date,
                item.deviceCode,
                item.deviceName,
                item.details,
                item.unit,
                item.manufacturer,
                item.country,
                item.modelSerial,
                item.warranty,
                item.quantity,
                item.price,
                qty * price,
                item.notes
            ];
        });

        await saveToGoogleSheet({
            action: 'create_ticket',
            rows: rowsToSave
        });

        alert("Lưu phiếu thành công!");
        setTicket(prev => ({...prev, ticketNumber: '', items: []}));
        
        // Optimistic Update Inventory
        if (!isImport) {
             const newMap = new Map(inventoryMap);
             ticket.items.forEach(item => {
                 const key = generateKey(item.deviceCode, item.deviceName);
                 const current = newMap.get(key) || 0;
                 newMap.set(key, current - Number(item.quantity));
             });
             setInventoryMap(newMap);
        }

    } catch (e) {
        alert("Lỗi khi lưu: " + e);
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
      if (isImport) return null;
      const stock = getCurrentStock(currentItem);
      return (
          <span className={`text-xs ml-2 font-mono px-2 py-0.5 rounded ${stock > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              Tồn: {stock}
          </span>
      );
  }, [currentItem.deviceCode, currentItem.deviceName, inventoryMap, isImport]);

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
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono font-bold uppercase"
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
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Chọn từ danh mục..."
                />
            </div>
        </div>
      </div>

      {/* Input Device Form */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Plus className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full p-1" />
            Chi tiết thiết bị {isImport ? '(Nhập Mới)' : '(Chọn Từ Tồn Kho)'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="md:col-span-2">
                 <label className="text-xs text-slate-500 font-bold">Mã TB</label>
                 <input 
                    list="dl-device-codes"
                    value={currentItem.deviceCode}
                    onChange={e => handleDeviceSelection(e.target.value, 'code')}
                    placeholder="Gõ mã..."
                    className="w-full p-2 border border-slate-300 rounded text-sm font-mono focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none"
                 />
            </div>
            <div className="md:col-span-4">
                 <label className="text-xs text-slate-500 font-bold flex items-center">
                    Tên thiết bị *
                    {currentStockDisplay}
                 </label>
                 <input 
                    list="dl-device-names"
                    value={currentItem.deviceName}
                    onChange={e => handleDeviceSelection(e.target.value, 'name')}
                    placeholder={!isImport ? "Chỉ hiện thiết bị có tồn kho > 0" : "Gõ tên để tìm..."}
                    className="w-full p-2 border border-slate-300 rounded text-sm font-semibold focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none"
                 />
            </div>
            <div className="md:col-span-4">
                 <label className="text-xs text-slate-500">Thông tin chi tiết</label>
                 <input 
                    value={currentItem.details}
                    onChange={e => setCurrentItem({...currentItem, details: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded text-sm"
                 />
            </div>
             <div className="md:col-span-2">
                 <label className="text-xs text-slate-500">ĐVT</label>
                 <input 
                    list="dl-units"
                    value={currentItem.unit}
                    onChange={e => setCurrentItem({...currentItem, unit: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded text-sm"
                 />
            </div>
            
             <div className="md:col-span-2">
                 <label className="text-xs text-slate-500">Model</label>
                 <input 
                    value={currentItem.modelSerial}
                    onChange={e => setCurrentItem({...currentItem, modelSerial: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded text-sm"
                 />
            </div>
             <div className="md:col-span-2">
                 <label className="text-xs text-slate-500">Hãng SX</label>
                 <input 
                    list="dl-brands"
                    value={currentItem.manufacturer}
                    onChange={e => setCurrentItem({...currentItem, manufacturer: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded text-sm"
                 />
            </div>
            <div className="md:col-span-2">
                 <label className="text-xs text-slate-500">Nước SX</label>
                 <input 
                    list="dl-countries"
                    value={currentItem.country}
                    onChange={e => setCurrentItem({...currentItem, country: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded text-sm"
                 />
            </div>
            <div className="md:col-span-2">
                 <label className="text-xs text-slate-500">Bảo hành</label>
                 <input 
                    value={currentItem.warranty}
                    onChange={e => setCurrentItem({...currentItem, warranty: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded text-sm"
                    placeholder="12 tháng..."
                 />
            </div>
             <div className="md:col-span-2">
                 <label className="text-xs text-slate-500 font-bold text-blue-600">Số lượng</label>
                 <input 
                    type="number" min="1"
                    value={currentItem.quantity}
                    onChange={e => setCurrentItem({...currentItem, quantity: parseFloat(e.target.value) || 0})}
                    className="w-full p-2 border border-blue-300 rounded text-sm font-bold text-center"
                 />
            </div>
             <div className="md:col-span-2 flex items-end">
                <button 
                    onClick={addItem}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium shadow-sm active:translate-y-0.5"
                >
                    Thêm vào phiếu
                </button>
             </div>
        </div>
      </div>

      {/* Table Items */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
            <table className="w-full text-left text-sm">
                <thead className="bg-emerald-50 text-emerald-700 font-semibold uppercase text-xs sticky top-0 border-b border-emerald-100">
                    <tr>
                        <th className="p-3 w-10">#</th>
                        <th className="p-3">Mã TB</th>
                        <th className="p-3">Tên Thiết Bị / Chi tiết</th>
                        <th className="p-3">Model / Hãng</th>
                        <th className="p-3 w-20 text-right">SL</th>
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
                            <td className="p-3 text-xs text-slate-500">
                                <div>{item.modelSerial}</div>
                                <div>{item.manufacturer} {item.country ? `(${item.country})` : ''}</div>
                            </td>
                            <td className="p-3 text-right font-bold text-blue-600">{item.quantity} {item.unit}</td>
                            <td className="p-3 text-center">
                                <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {ticket.items.length === 0 && (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400 italic">
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
        
        <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
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
