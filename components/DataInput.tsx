
import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Database } from 'lucide-react';

interface DataInputProps {
  onReload: () => void;
  isLoading: boolean;
  lastUpdated: Date | null;
  rowCount: number;
}

export const DataInput: React.FC<DataInputProps> = ({ onReload, isLoading, lastUpdated, rowCount }) => {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-slate-700">
          <Database className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-sm">Dữ Liệu Nguồn</h2>
        </div>
        {rowCount > 0 && (
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> {rowCount} dòng
          </span>
        )}
      </div>
      
      <div className="flex flex-col gap-2">
        <div className="text-xs text-slate-500 flex justify-between">
           <span>Google Sheet: DULIEU</span>
           <span>{lastUpdated ? lastUpdated.toLocaleTimeString() : '--:--'}</span>
        </div>

        <button
          onClick={onReload}
          disabled={isLoading}
          className={`
            flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-medium transition-all
            ${isLoading 
              ? 'bg-slate-100 text-slate-400 cursor-wait' 
              : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
            }
          `}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Đang cập nhật...' : 'Cập nhật dữ liệu'}
        </button>
      </div>
    </div>
  );
};
