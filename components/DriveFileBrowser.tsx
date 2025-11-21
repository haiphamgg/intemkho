
import React, { useState, useEffect, useMemo } from 'react';
import { DriveFile } from '../types';
import { fetchDriveFiles, formatFileSize, getFileIcon } from '../services/driveService';
import { 
  FolderOpen, FileText, FileSpreadsheet, File as FileIcon, 
  Image as ImageIcon, Download, Eye, RefreshCw, ExternalLink, AlertTriangle, Search, X
} from 'lucide-react';

interface DriveFileBrowserProps {
  folderId: string;
  title: string;
  description: string;
}

export const DriveFileBrowser: React.FC<DriveFileBrowserProps> = ({ folderId, title, description }) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchDriveFiles(folderId);
      setFiles(data);
    } catch (err: any) {
      setError(err.message || "Không thể tải danh sách file.");
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on mount or folder change
  useEffect(() => {
    loadFiles();
  }, [folderId]);

  // Filter files based on search term
  const filteredFiles = useMemo(() => {
    if (!searchTerm) return files;
    const lowerTerm = searchTerm.toLowerCase().trim();
    return files.filter(file => file.name.toLowerCase().includes(lowerTerm));
  }, [files, searchTerm]);

  const renderIcon = (mimeType: string) => {
    const type = getFileIcon(mimeType);
    switch (type) {
      case 'pdf': return <FileText className="w-8 h-8 text-red-500" />;
      case 'image': return <ImageIcon className="w-8 h-8 text-purple-500" />;
      case 'sheet': return <FileSpreadsheet className="w-8 h-8 text-emerald-500" />;
      case 'doc': return <FileText className="w-8 h-8 text-blue-500" />;
      case 'folder': return <FolderOpen className="w-8 h-8 text-amber-500" />;
      default: return <FileIcon className="w-8 h-8 text-slate-400" />;
    }
  };

  const getDirectDownloadLink = (file: DriveFile) => {
    // Prefer webContentLink if available (binary files)
    if (file.webContentLink) return file.webContentLink;
    // Fallback for exportable files or public files
    return `https://drive.google.com/uc?id=${file.id}&export=download`;
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-4 shrink-0">
        <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
              <FolderOpen className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{title}</h2>
              <div className="flex items-center gap-2">
                 <p className="text-sm text-slate-500 mt-0.5">{description}</p>
                 {!isLoading && files.length > 0 && (
                    <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {files.length} file
                    </span>
                 )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
            {/* Search Input */}
            <div className="relative w-full sm:w-64 group">
              <input
                type="text"
                placeholder="Tìm tên file..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-8 py-2 border border-slate-200 bg-slate-50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white focus:outline-none transition-all text-sm"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 group-focus-within:text-blue-500 transition-colors" />
              
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2 p-0.5 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <a 
                href={`https://drive.google.com/drive/folders/${folderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors text-sm font-medium whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden xl:inline">Drive</span>
              </a>
              <button
                onClick={loadFiles}
                disabled={isLoading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-70 whitespace-nowrap shadow-sm active:translate-y-0.5"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isLoading ? 'Đang tải...' : 'Làm mới'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="bg-blue-50 p-3 rounded-full">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              </div>
              <span className="text-sm font-medium text-slate-600">Đang đồng bộ dữ liệu từ Drive...</span>
            </div>
          </div>
        )}

        {error ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="bg-red-50 p-4 rounded-full mb-4">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Không thể tải dữ liệu</h3>
            <p className="text-slate-600 max-w-md mb-6">{error}</p>
            <button 
              onClick={loadFiles}
              className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors border border-slate-200"
            >
              Thử lại
            </button>
          </div>
        ) : files.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <FolderOpen className="w-16 h-16 text-slate-200 mb-4" />
            <p>Thư mục trống</p>
            <button onClick={loadFiles} className="mt-4 text-blue-600 text-sm hover:underline">Kiểm tra lại</button>
          </div>
        ) : filteredFiles.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
             <Search className="w-12 h-12 text-slate-200 mb-3" />
             <p>Không tìm thấy file nào khớp với "{searchTerm}"</p>
             <p className="text-xs mt-2 text-slate-500">Nếu bạn vừa tải file lên, hãy nhấn nút <span className="font-bold">Làm mới</span> ở trên.</p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredFiles.map((file) => (
                <div 
                  key={file.id}
                  className="group bg-slate-50 hover:bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md rounded-xl p-4 transition-all flex flex-col gap-3 relative"
                >
                  <div className="flex items-start justify-between">
                    <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                      {renderIcon(file.mimeType)}
                    </div>
                    <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">
                      {formatFileSize(file.size)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-700 text-sm truncate leading-tight mb-1" title={file.name}>
                      {file.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {file.createdTime ? new Date(file.createdTime).toLocaleDateString('vi-VN') : ''}
                    </p>
                  </div>

                  <div className="flex gap-2 mt-2 pt-3 border-t border-slate-100">
                    <a 
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-blue-600 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Xem
                    </a>
                    <a 
                      href={getDirectDownloadLink(file)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 shadow-sm transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Tải về
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
