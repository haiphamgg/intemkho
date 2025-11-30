
import React, { useState, useMemo } from 'react';
import { Search, Package, RefreshCw, FileText, Box, Building2, Calendar, MapPin, ExternalLink, FolderSearch } from 'lucide-react';
import { DeviceRow } from '../types';
import { DeviceDetailModal } from './DeviceDetailModal';

interface LookupPageProps {
  data: DeviceRow[];
  onReload: () => void;
  isLoading: boolean;
  lastUpdated: Date | null;
  onTicketSelect?: (ticket: string) => void;
}

export const LookupPage: React.FC<LookupPageProps> = ({ data, onReload, isLoading, lastUpdated, onTicketSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<DeviceRow | null>(null);

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lowerTerm = searchTerm.toLowerCase();
    return data.filter(row => 
      row.ticketNumber.toLowerCase().includes(lowerTerm) ||
      row.deviceName.toLowerCase().includes(lowerTerm) ||
      row.modelSerial.toLowerCase().includes(lowerTerm) ||
      row.department.toLowerCase().includes(lowerTerm) ||
      row.provider.toLowerCase().includes(lowerTerm)
    );
  }, [data, searchTerm]);

  const displayData = filteredData.slice(0, 100);

  return (
    <div className="h-full flex flex-col bg-slate-50 p-4 md:p-6 overflow-hidden relative">
      {selectedDevice && (
        <DeviceDetailModal 
            device={selectedDevice} 
            onClose={() => setSelectedDevice(null)} 
        />
      )}

      {/* Professional Search Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6 shrink-0 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 shadow-sm border border-purple-100">
               <Package className="w-6 h-6" />
            </div>
            <div>
               <h2 className="text-lg font-bold text-slate-800">Tra Cứu thiết bị</h2>
               <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                     <Box className="w-3 h-3" /> {data.length} thiết bị
                  </span>
                  <span className="flex items-center gap-1">
                     <Calendar className="w-3 h-3" /> {lastUpdated ? lastUpdated.toLocaleTimeString() : '--:--'}
                  </span>
               </div>
            </div>
        </div>

        <div className="flex w-full md:w-auto gap-3 items-center">
             <div className="relative flex-1 md:w-96 group">
                <input
                  type="text"
                  placeholder="Tìm theo Tên, Model, Số phiếu..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:bg-white focus:outline-none transition-all shadow-sm font-medium text-sm"
                />
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5 group-focus-within:text-purple-500 transition-colors" />
                {searchTerm && (
                   <span className="absolute right-3 top-3.5 text-xs font-bold text-purple-600 bg-purple-100 px-1.5 rounded">
                      {filteredData.length}
                   </span>
                )}
             </div>
             <button
                onClick={onReload}
                disabled={isLoading}
                className="p-3 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-purple-600 hover:border-purple-200 hover:bg-purple-50 transition-all shadow-sm active:scale-95"
                title="Làm mới dữ liệu"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin text-purple-600' : ''}`} />
              </button>
        </div>
      </div>

      {/* Modern Table */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-emerald-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-emerald-800 uppercase tracking-wider border-b border-emerald-100 w-[140px]">Số Phiếu</th>
                <th className="px-6 py-4 text-xs font-bold text-emerald-800 uppercase tracking-wider border-b border-emerald-100">Thông tin thiết bị</th>
                <th className="px-6 py-4 text-xs font-bold text-emerald-800 uppercase tracking-wider border-b border-emerald-100 w-[200px]">Bộ phận & Vị trí</th>
                <th className="px-6 py-4 text-xs font-bold text-emerald-800 uppercase tracking-wider border-b border-emerald-100 w-[250px]">Nhà cung cấp / Nguồn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayData.length > 0 ? (
                displayData.map((row) => (
                  <tr 
                    key={row.rowId} 
                    className="hover:bg-slate-50 transition-colors group cursor-pointer"
                    onClick={() => setSelectedDevice(row)}
                  >
                    <td className="px-6 py-4 align-top">
                       <button 
                         onClick={(e) => { e.stopPropagation(); onTicketSelect && onTicketSelect(row.ticketNumber); }}
                         className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-mono text-sm font-bold shadow-sm hover:border-emerald-300 hover:text-emerald-700 hover:shadow-md transition-all group-hover/btn z-10 relative"
                         title="Mở kho chứng từ"
                       >
                          <FolderSearch className="w-3.5 h-3.5 opacity-50" />
                          {row.ticketNumber}
                        </button>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="font-bold text-slate-800 text-base mb-1 group-hover:text-blue-700">
                        {row.deviceName}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                         <span className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono border border-slate-200">
                            {row.modelSerial || 'No Model'}
                         </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                       <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                             <MapPin className="w-3.5 h-3.5 text-slate-400" />
                             {row.department || '--'}
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                       <div className="flex items-start gap-2 text-slate-600 text-sm">
                          <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <span className="line-clamp-2" title={row.provider}>{row.provider || '--'}</span>
                       </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <div className="bg-slate-50 p-6 rounded-full mb-4 border border-slate-100">
                        <Search className="w-10 h-10 text-slate-300" />
                      </div>
                      <h3 className="font-bold text-slate-600 text-lg">Không tìm thấy kết quả</h3>
                      <p className="text-sm mt-1 text-slate-400">Thử tìm kiếm với từ khóa khác hoặc kiểm tra lại nguồn dữ liệu.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs font-medium text-slate-500 flex justify-between items-center">
          <span>Hiển thị {displayData.length} trên tổng {filteredData.length} kết quả</span>
          {filteredData.length > 100 && (
              <span className="text-orange-500 bg-orange-50 px-2 py-0.5 rounded">
                  Chỉ hiển thị 100 kết quả đầu tiên
              </span>
          )}
        </div>
      </div>
    </div>
  );
};
