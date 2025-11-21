import React, { useState, useMemo } from 'react';
import { Search, Package, Calendar, Tag, Layers, FileText, ExternalLink } from 'lucide-react';
import { DeviceRow } from '../types';

interface LookupPageProps {
  data: DeviceRow[];
}

// ID của thư mục Google Drive chứa chứng từ
const DRIVE_FOLDER_ID = '16khjeVK8e7evRXQQK7z9IJit4yCrO9f1';

export const LookupPage: React.FC<LookupPageProps> = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lowerTerm = searchTerm.toLowerCase();
    return data.filter(row => 
      row.ticketNumber.toLowerCase().includes(lowerTerm) ||
      row.deviceName.toLowerCase().includes(lowerTerm) ||
      row.modelSerial.toLowerCase().includes(lowerTerm) ||
      row.department.toLowerCase().includes(lowerTerm)
    );
  }, [data, searchTerm]);

  // Limit initial display to improve performance
  const displayData = filteredData.slice(0, 100);

  // Helper to generate smart search link
  const getDriveSearchLink = (ticket: string) => {
    // Creates a link that searches specifically inside the folder for the ticket number
    return `https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}?q=${encodeURIComponent(ticket)}`;
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 p-4 md:p-6 overflow-hidden">
      {/* Search Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-4 shrink-0">
        <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
              <Package className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Tra cứu thiết bị</h2>
              <p className="text-sm text-slate-500 mt-0.5">Tìm kiếm nhanh trong <span className="font-semibold text-indigo-600">{data.length}</span> bản ghi</p>
            </div>
          </div>
          
          <div className="relative w-full md:w-96 group">
            <input
              type="text"
              placeholder="Tìm tên, model, số phiếu, khoa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all shadow-sm"
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5 group-focus-within:text-indigo-500 transition-colors" />
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="px-6 py-4 font-bold border-b border-slate-200 w-[15%]">Số Phiếu</th>
                <th className="px-6 py-4 font-bold border-b border-slate-200 w-[30%]">Thiết Bị</th>
                <th className="px-6 py-4 font-bold border-b border-slate-200 w-[20%]">Model / Serial</th>
                <th className="px-6 py-4 font-bold border-b border-slate-200 w-[20%]">Bộ Phận</th>
                <th className="px-6 py-4 font-bold border-b border-slate-200 w-[15%] text-right">Ngày</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayData.length > 0 ? (
                displayData.map((row) => (
                  <tr key={row.rowId} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-col items-start gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 font-bold text-sm border border-blue-100">
                          <FileText className="w-4 h-4" />
                          {row.ticketNumber}
                        </span>
                        
                        {/* Link to Drive Search */}
                        <a 
                          href={getDriveSearchLink(row.ticketNumber)}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 font-medium transition-colors ml-1 group/link"
                          title="Mở thư mục chứng từ trên Google Drive"
                        >
                          <ExternalLink className="w-3 h-3 group-hover/link:scale-110 transition-transform" />
                          Xem chứng từ
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="font-bold text-slate-800 text-lg mb-1 group-hover:text-indigo-700 transition-colors">
                        {row.deviceName}
                      </div>
                      <div className="text-sm text-slate-500 flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5" /> 
                        {row.ticketNumber.startsWith('PX') ? 'Xuất kho' : 'Nhập kho'}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      {row.modelSerial ? (
                        <div className="font-mono text-sm font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded w-fit border border-slate-200">
                          {row.modelSerial}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-sm italic">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                        <span className="text-slate-700 font-semibold text-base">{row.department}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top text-right text-slate-500 font-mono text-sm">
                       {row.fullData[5] ? (
                         <span className="inline-flex items-center gap-1.5">
                           {row.fullData[5]}
                           <Calendar className="w-4 h-4 text-slate-400" />
                         </span>
                       ) : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <div className="bg-slate-50 p-4 rounded-full mb-3">
                        <Search className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="font-medium text-slate-500">Không tìm thấy kết quả nào</p>
                      <p className="text-sm mt-1">Thử tìm kiếm với từ khóa khác</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
          <span>Hiển thị {displayData.length} / {filteredData.length} kết quả</span>
          {filteredData.length > 100 && (
            <span className="text-orange-500 italic">Kết quả được giới hạn để tối ưu hiệu năng</span>
          )}
        </div>
      </div>
    </div>
  );
};