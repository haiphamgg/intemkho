
import React, { useState, useEffect } from 'react';
import { fetchGoogleSheetData, saveToGoogleSheet } from '../services/sheetService';
import { Database, Plus, Save, RefreshCw, Search, Loader2, List, Tag, Building2, MapPin, Globe, Box, Edit2, X, Check } from 'lucide-react';

// Cấu trúc Tab
type TabID = 'DEVICE' | 'DEPT' | 'SECTION' | 'BRAND' | 'COUNTRY' | 'PROVIDER';

interface TabConfig {
  id: TabID;
  label: string;
  icon: any;
  sheet: string;
  range: string; 
  columns: { header: string; placeholder: string; width?: string }[];
  colIndex?: number;
  padLeft?: number;
  startRow: number;
}

const TABS: TabConfig[] = [
  {
    id: 'DEVICE',
    label: 'Danh Mục Thiết Bị',
    icon: Database,
    sheet: 'DANHMUC',
    range: 'C4:I', 
    padLeft: 2, 
    startRow: 4,
    columns: [
      { header: 'Mã thiết bị (C)', placeholder: 'VD: MAY001', width: 'w-32' },
      { header: 'Tên thiết bị (D)', placeholder: 'Nhập tên...', width: 'min-w-[200px]' },
      { header: 'Chi tiết (E)', placeholder: 'Quy cách...', width: 'min-w-[150px]' },
      { header: 'ĐVT (F)', placeholder: 'Cái/Bộ', width: 'w-20' },
      { header: 'Hãng SX (G)', placeholder: 'Sony...', width: 'w-32' },
      { header: 'Nước SX (H)', placeholder: 'Japan...', width: 'w-32' },
      { header: 'Model (I)', placeholder: 'Model...', width: 'w-32' },
    ]
  },
  {
    id: 'DEPT',
    label: 'Khoa Phòng (A)',
    icon: Building2,
    sheet: 'DMDC',
    range: 'A4:A',
    startRow: 4,
    columns: [{ header: 'Tên Khoa / Phòng', placeholder: 'Nhập tên khoa...', width: 'w-full' }],
    colIndex: 0
  },
  {
    id: 'SECTION',
    label: 'Bộ Phận (B)',
    icon: MapPin,
    sheet: 'DMDC',
    range: 'B4:B',
    startRow: 4,
    columns: [{ header: 'Tên Bộ Phận', placeholder: 'Nhập bộ phận...', width: 'w-full' }],
    colIndex: 1
  },
  {
    id: 'BRAND',
    label: 'Hãng SX (C)',
    icon: Tag,
    sheet: 'DMDC',
    range: 'C4:C',
    startRow: 4,
    columns: [{ header: 'Tên Hãng', placeholder: 'Nhập hãng...', width: 'w-full' }],
    colIndex: 2
  },
  {
    id: 'COUNTRY',
    label: 'Nước SX (D)',
    icon: Globe,
    sheet: 'DMDC',
    range: 'D4:D',
    startRow: 4,
    columns: [{ header: 'Tên Nước', placeholder: 'Nhập nước...', width: 'w-full' }],
    colIndex: 3
  },
  {
    id: 'PROVIDER',
    label: 'Nhà Cung Cấp (E)',
    icon: Box,
    sheet: 'DMDC',
    range: 'E4:E',
    startRow: 4,
    columns: [{ header: 'Tên Nhà Cung Cấp', placeholder: 'Nhập NCC...', width: 'w-full' }],
    colIndex: 4
  }
];

interface RowData {
  originalIndex: number;
  values: string[];
}

// Modal Component cho việc sửa Thiết bị
const DeviceEditModal = ({ 
    initialData, 
    onClose, 
    onSave, 
    isSaving,
    dropdowns 
}: { 
    initialData: string[], 
    onClose: () => void, 
    onSave: (data: string[]) => void, 
    isSaving: boolean,
    dropdowns: { units: string[], brands: string[], countries: string[] }
}) => {
    // Mapping index: 0:Ma, 1:Ten, 2:ChiTiet, 3:DVT, 4:Hang, 5:Nuoc, 6:Model
    const [formData, setFormData] = useState({
        code: initialData[0] || '',
        name: initialData[1] || '',
        detail: initialData[2] || '',
        unit: initialData[3] || '',
        brand: initialData[4] || '',
        country: initialData[5] || '',
        model: initialData[6] || ''
    });

    const handleSave = () => {
        if (!formData.name) {
            alert("Tên thiết bị là bắt buộc");
            return;
        }
        onSave([
            formData.code, 
            formData.name, 
            formData.detail, 
            formData.unit, 
            formData.brand, 
            formData.country, 
            formData.model
        ]);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Edit2 className="w-5 h-5 text-blue-600"/> Cập nhật thiết bị
                    </h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-red-500"/></button>
                </div>
                
                <div className="p-6 grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
                    <div className="col-span-1">
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Mã Thiết Bị</label>
                        <input 
                            value={formData.code} 
                            onChange={e => setFormData({...formData, code: e.target.value})}
                            className="w-full p-2 border border-slate-300 rounded font-mono text-sm"
                            placeholder="Tự động hoặc nhập..."
                        />
                    </div>
                    <div className="col-span-1">
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Đơn Vị Tính</label>
                        <input 
                            list="dl-units-modal"
                            value={formData.unit} 
                            onChange={e => setFormData({...formData, unit: e.target.value})}
                            className="w-full p-2 border border-slate-300 rounded text-sm"
                            placeholder="Cái/Bộ/Hộp"
                        />
                         <datalist id="dl-units-modal">{dropdowns.units.map(u => <option key={u} value={u}/>)}</datalist>
                    </div>
                    <div className="col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Tên Thiết Bị *</label>
                        <input 
                            value={formData.name} 
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            className="w-full p-2 border border-blue-300 rounded text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Nhập tên thiết bị..."
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Thông số / Chi tiết</label>
                        <input 
                            value={formData.detail} 
                            onChange={e => setFormData({...formData, detail: e.target.value})}
                            className="w-full p-2 border border-slate-300 rounded text-sm"
                        />
                    </div>
                    <div className="col-span-1">
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Hãng SX</label>
                        <input 
                            list="dl-brands-modal"
                            value={formData.brand} 
                            onChange={e => setFormData({...formData, brand: e.target.value})}
                            className="w-full p-2 border border-slate-300 rounded text-sm"
                        />
                        <datalist id="dl-brands-modal">{dropdowns.brands.map(b => <option key={b} value={b}/>)}</datalist>
                    </div>
                    <div className="col-span-1">
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nước SX</label>
                        <input 
                            list="dl-countries-modal"
                            value={formData.country} 
                            onChange={e => setFormData({...formData, country: e.target.value})}
                            className="w-full p-2 border border-slate-300 rounded text-sm"
                        />
                        <datalist id="dl-countries-modal">{dropdowns.countries.map(c => <option key={c} value={c}/>)}</datalist>
                    </div>
                    <div className="col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Model</label>
                        <input 
                            value={formData.model} 
                            onChange={e => setFormData({...formData, model: e.target.value})}
                            className="w-full p-2 border border-slate-300 rounded text-sm"
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Hủy</button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                        Lưu Thay Đổi
                    </button>
                </div>
            </div>
        </div>
    );
};

export const MasterData: React.FC = () => {
  const [activeTabId, setActiveTabId] = useState<TabID>('DEVICE');
  const [data, setData] = useState<RowData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State cho inline edit
  const [formData, setFormData] = useState<Record<number, string>>({});
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);

  // State cho Modal edit (Chỉ dùng cho DEVICE)
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [deviceModalData, setDeviceModalData] = useState<RowData | null>(null);
  
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
      // Load main table data
      const result = await fetchGoogleSheetData(sheetId, `${activeConfig.sheet}!${activeConfig.range}`);
      const mappedData: RowData[] = result.map((row, idx) => ({
        originalIndex: activeConfig.startRow + idx,
        values: row
      })).filter(item => item.values.some(cell => cell && cell.trim() !== ''));
      setData(mappedData);

      // Nếu đang ở tab DEVICE, load thêm DMDC để lấy dropdown
      if (activeConfig.id === 'DEVICE') {
          const dmdc = await fetchGoogleSheetData(sheetId, 'DMDC!C4:D'); // C: Brand, D: Country
          // Lấy unique Units từ danh sách device hiện tại
          const uSet = new Set<string>();
          result.forEach(r => { if(r[3]) uSet.add(r[3]) }); // Unit is at index 3

          const bSet = new Set<string>();
          const cSet = new Set<string>();
          dmdc.forEach(r => {
              if(r[0]) bSet.add(r[0]); // Brand
              if(r[1]) cSet.add(r[1]); // Country
          });

          setDropdowns({
              units: Array.from(uSet),
              brands: Array.from(bSet),
              countries: Array.from(cSet)
          });
      }

    } catch (e) {
      console.error(e);
      setData([]);
    } finally {
      setIsLoading(false);
      setEditingRowIndex(null);
      setFormData({});
    }
  };

  useEffect(() => {
    loadData();
    setFormData({});
    setSearchTerm('');
    setEditingRowIndex(null);
    setShowDeviceModal(false);
  }, [activeTabId]);

  const handleEditClick = (row: RowData) => {
    if (activeConfig.id === 'DEVICE') {
        // Use Modal for Device
        setDeviceModalData(row);
        setShowDeviceModal(true);
    } else {
        // Use Inline for others
        const newForm: Record<number, string> = {};
        row.values.forEach((val, idx) => {
            newForm[idx] = val;
        });
        setFormData(newForm);
        setEditingRowIndex(row.originalIndex);
    }
  };

  const handleCancelInline = () => {
    setEditingRowIndex(null);
    setFormData({});
  };

  const saveDeviceFromModal = async (newValues: string[]) => {
      if (!deviceModalData) return;
      setIsSaving(true);
      try {
          const padding = Array(activeConfig.padLeft || 0).fill(''); 
          const fullRow = [...padding, ...newValues];
          
          await saveToGoogleSheet({
               action: 'update_master', 
               sheetName: 'DANHMUC',
               rowIndex: deviceModalData.originalIndex, 
               row: fullRow
          });
          alert("Cập nhật thiết bị thành công!");
          setShowDeviceModal(false);
          setDeviceModalData(null);
          loadData(); // reload
      } catch (e: any) {
          alert("Lỗi: " + e.message);
      } finally {
          setIsSaving(false);
      }
  }

  const handleInlineSave = async (isNew: boolean = false) => {
    setIsSaving(true);
    try {
      // Validate Col 0
      if (!formData[0] && !isNew) { // Nếu add new thì validate sau
        // logic existing
      }

      if (isNew && (!formData[0] || !formData[0].trim())) {
         alert(`Vui lòng nhập ${activeConfig.columns[0].header}`);
         setIsSaving(false);
         return;
      }

      const inputData = activeConfig.columns.map((_, index) => formData[index] || '');

      if (!isNew && editingRowIndex !== null) {
        // UPDATE MODE (Only for Non-Device Tabs since Device uses Modal)
        await saveToGoogleSheet({
            action: 'update_master_cell',
            sheetName: activeConfig.sheet,
            rowIndex: editingRowIndex,
            colIndex: activeConfig.colIndex,
            value: formData[0]
        });
        alert("Cập nhật thành công!");
        handleCancelInline();

      } else {
        // ADD NEW MODE
        if (activeConfig.id === 'DEVICE') {
          const padding = Array(activeConfig.padLeft || 0).fill(''); 
          const rowToSave = [...padding, ...inputData];
          
          await saveToGoogleSheet({
            action: 'add_master_device',
            sheetName: 'DANHMUC',
            row: rowToSave
          });
        } else {
          await saveToGoogleSheet({
            action: 'add_master_dmdc',
            sheetName: 'DMDC',
            colIndex: activeConfig.colIndex,
            value: formData[0]
          });
        }
        alert("Thêm mới thành công!");
        setFormData({});
      }

      setTimeout(loadData, 1000); 
    } catch (e: any) {
      alert("Lỗi khi lưu: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredData = data.filter(row => 
    row.values.some(cell => cell && cell.toString().toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 p-2 md:p-6">
      {showDeviceModal && deviceModalData && (
          <DeviceEditModal 
             initialData={deviceModalData.values}
             onClose={() => { setShowDeviceModal(false); setDeviceModalData(null); }}
             onSave={saveDeviceFromModal}
             isSaving={isSaving}
             dropdowns={dropdowns}
          />
      )}

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
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
           {/* Header */}
           <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4 bg-slate-50/50">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                  {React.createElement(activeConfig.icon, { className: "w-5 h-5 text-blue-600" })}
                  {activeConfig.label}
                  <span className="ml-2 px-2 py-0.5 bg-slate-200 rounded-full text-xs font-normal text-slate-500">
                    {data.length}
                  </span>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                 <div className="relative flex-1 sm:w-64">
                    <input
                      type="text"
                      placeholder="Tìm kiếm..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
                 </div>
                 <button onClick={loadData} className="p-2 bg-white border border-slate-200 rounded-lg hover:text-blue-600">
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                 </button>
              </div>
           </div>

           {/* Table */}
           <div className="flex-1 overflow-auto custom-scrollbar relative scroll-smooth">
              <table className="w-full text-left border-collapse">
                 <thead className="bg-emerald-50 text-emerald-800 text-xs uppercase sticky top-0 z-10 shadow-sm">
                    <tr>
                       <th className="px-4 py-3 border-b border-emerald-100 w-12 text-center">#</th>
                       {activeConfig.columns.map((col, idx) => (
                          <th key={idx} className={`px-4 py-3 border-b border-emerald-100 font-bold whitespace-nowrap ${col.width || ''}`}>
                             {col.header}
                          </th>
                       ))}
                       <th className="px-4 py-3 border-b border-emerald-100 w-20 sticky right-0 bg-emerald-50 z-20 text-center">Thao tác</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 text-sm">
                    {/* ADD NEW ROW (Always visible at top) */}
                    <tr className="sticky top-[41px] z-10 shadow-sm border-b-2 bg-blue-50/40 border-blue-100">
                       <td className="px-4 py-3 text-center text-blue-500">
                           <Plus className="w-4 h-4 mx-auto" />
                       </td>
                       {activeConfig.columns.map((col, idx) => (
                          <td key={idx} className="px-2 py-2">
                             <input 
                                value={editingRowIndex === null ? (formData[idx] || '') : ''} // Clear if editing other row
                                onChange={e => setFormData({...formData, [idx]: e.target.value})}
                                placeholder={col.placeholder}
                                className="w-full px-3 py-1.5 text-sm border border-blue-200 rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                onKeyDown={e => e.key === 'Enter' && handleInlineSave(true)}
                                disabled={editingRowIndex !== null}
                             />
                          </td>
                       ))}
                       <td className="px-2 py-2 sticky right-0 flex gap-1 justify-center bg-blue-50/40">
                          <button 
                             onClick={() => handleInlineSave(true)}
                             disabled={isSaving || editingRowIndex !== null}
                             className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm disabled:opacity-50"
                             title="Thêm mới"
                          >
                             {isSaving && editingRowIndex === null ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                          </button>
                       </td>
                    </tr>
                    
                    {/* Data Rows */}
                    {filteredData.map((row, rIdx) => {
                       const isEditing = editingRowIndex === row.originalIndex;
                       return (
                       <tr key={rIdx} className={`hover:bg-slate-50 group ${isEditing ? 'bg-orange-50' : ''}`}>
                          <td className="px-4 py-3 text-center text-slate-400 text-xs font-mono">{rIdx + 1}</td>
                          
                          {activeConfig.columns.map((col, cIdx) => (
                             <td key={cIdx} className="px-2 py-2">
                                {isEditing ? (
                                    <input 
                                        value={formData[cIdx] || ''}
                                        onChange={e => setFormData({...formData, [cIdx]: e.target.value})}
                                        className="w-full px-2 py-1 text-sm border border-orange-300 rounded focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                                        autoFocus={cIdx === 0}
                                    />
                                ) : (
                                    <div className="px-2 text-slate-700 truncate max-w-[300px]" title={row.values[cIdx]}>
                                        {row.values[cIdx] || ''}
                                    </div>
                                )}
                             </td>
                          ))}
                          
                          <td className={`px-2 py-2 sticky right-0 text-center ${isEditing ? 'bg-orange-50' : 'bg-white group-hover:bg-slate-50'}`}>
                             {isEditing ? (
                                <div className="flex items-center justify-center gap-1">
                                    <button 
                                        onClick={() => handleInlineSave(false)}
                                        className="p-1.5 text-white bg-green-500 rounded hover:bg-green-600 shadow-sm"
                                        title="Lưu"
                                    >
                                        <Check className="w-4 h-4"/>
                                    </button>
                                    <button 
                                        onClick={handleCancelInline}
                                        className="p-1.5 text-slate-600 bg-slate-200 rounded hover:bg-slate-300"
                                        title="Hủy"
                                    >
                                        <X className="w-4 h-4"/>
                                    </button>
                                </div>
                             ) : (
                                <button 
                                    onClick={() => handleEditClick(row)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Sửa dòng này"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                             )}
                          </td>
                       </tr>
                    )})}
                    {filteredData.length === 0 && (
                        <tr>
                            <td colSpan={activeConfig.columns.length + 2} className="text-center py-10 text-slate-400 italic">
                                Chưa có dữ liệu
                            </td>
                        </tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
    </div>
  );
};
