
import React from 'react';
import { X, Printer, Package, Calendar, MapPin, Hash, Info, Building2, User, Tag, Globe, DollarSign, FileText, Box } from 'lucide-react';
import { DeviceRow } from '../types';
import { QRCodeSVG } from 'qrcode.react';

interface DeviceDetailModalProps {
  device: DeviceRow;
  onClose: () => void;
}

// Helper: Format Date dd/mm/yyyy
const formatDate = (input: string): string => {
  if (!input) return '';
  try {
    // Handle Google Sheets JSON date format "Date(year, month, day)"
    if (input.includes('Date(')) {
        const parts = input.match(/\d+/g);
        if (parts && parts.length >= 3) {
            const d = new Date(Number(parts[0]), Number(parts[1]), Number(parts[2]));
            return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
        }
    }
    // Handle standard date strings
    const d = new Date(input);
    if (isNaN(d.getTime())) return input; 
    // Nếu input là số năm (vd: 2024) thì giữ nguyên, nếu là ngày đầy đủ thì format
    if (!isNaN(Number(input)) && Number(input) < 3000) return input;

    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return input;
  }
};

// Helper: Format Currency
const formatCurrency = (input: string): string => {
    if (!input) return '';
    // Remove existing commas if any to avoid NaN
    const num = parseFloat(input.toString().replace(/,/g, ''));
    if (isNaN(num)) return input;
    return num.toLocaleString('vi-VN');
}

export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({ device, onClose }) => {
  if (!device) return null;

  const d = device.fullData;

  // Cấu hình hiển thị các trường dữ liệu (Cột C -> R tương ứng index 2 -> 17)
  const fields = [
      { label: "Nhà Cung Cấp / Nguồn (C)", value: d[2], icon: Building2, col: "col-span-1 md:col-span-2" },
      { label: "Bộ Phận (D)", value: d[3], icon: MapPin },
      { label: "Số Phiếu (E)", value: d[4], icon: Hash, highlight: true },
      { label: "Ngày Tháng (F)", value: formatDate(d[5]), icon: Calendar },
      { label: "Mã Thiết Bị (G)", value: d[6], icon: Tag },
      { label: "Tên Thiết Bị (H)", value: d[7], icon: Package, highlight: true, col: "col-span-1 md:col-span-2" },
      { label: "Chi Tiết / Quy Cách (I)", value: d[8], icon: FileText, col: "col-span-1 md:col-span-2" },
      { label: "Đơn Vị Tính (J)", value: d[9], icon: Box },
      { label: "Hãng SX (K)", value: d[10], icon: Globe },
      { label: "Nước SX (L)", value: d[11], icon: Globe },
      { label: "Model / Serial (M)", value: d[12], icon: Info },
      { label: "Bảo Hành (N)", value: formatDate(d[13]), icon: Calendar, highlight: true },
      { label: "Số Lượng (O)", value: d[14], icon: Hash },
      { label: "Đơn Giá (P)", value: formatCurrency(d[15]), icon: DollarSign },
      { label: "Thành Tiền (Q)", value: formatCurrency(d[16]), icon: DollarSign, highlight: true },
      { label: "Ghi Chú (R)", value: d[17], icon: User, col: "col-span-1 md:col-span-2" },
  ];

  const handlePrint = () => {
      // 1. Lấy nội dung SVG QR code hiện tại để đưa vào trang in
      const qrContainer = document.getElementById('modal-qr-container');
      const svgElement = qrContainer?.querySelector('svg');
      let qrSvgString = '';
      
      if (svgElement) {
          // Serialize SVG sang chuỗi string để render lại bên trang in
          qrSvgString = new XMLSerializer().serializeToString(svgElement);
      }

      // 2. Tạo nội dung HTML cho trang in
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Phiếu thiết bị: ${device.deviceName}</title>
              <style>
                body { 
                    font-family: 'Times New Roman', serif; 
                    padding: 40px; 
                    margin: 0;
                    color: #000;
                    background: #fff;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    border: 1px solid #000;
                    padding: 20px;
                }
                .header {
                    text-align: center;
                    border-bottom: 2px solid #000;
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                }
                .title {
                    font-size: 24px;
                    font-weight: bold;
                    text-transform: uppercase;
                    margin: 0 0 10px 0;
                }
                .meta {
                    font-size: 14px;
                    font-style: italic;
                }
                .content-wrapper {
                    display: flex;
                    gap: 20px;
                    align-items: flex-start;
                }
                .qr-section {
                    flex: 0 0 160px;
                    text-align: center;
                    border: 1px solid #ccc;
                    padding: 10px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                .qr-section svg {
                    width: 140px;
                    height: 140px;
                }
                .table-section {
                    flex: 1;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                }
                th, td {
                    border: 1px solid #ccc;
                    padding: 8px;
                    text-align: left;
                    vertical-align: top;
                }
                th {
                    background-color: #f0f0f0;
                    width: 35%;
                    font-weight: bold;
                }
                .footer {
                    margin-top: 30px;
                    text-align: right;
                    font-size: 12px;
                    font-style: italic;
                }
                @media print {
                    body { -webkit-print-color-adjust: exact; }
                    .container { border: none; padding: 0; }
                }
              </style>
            </head>
            <body>
              <div class="container">
                  <div class="header">
                      <div class="title">PHIẾU THÔNG TIN THIẾT BỊ</div>
                      <div class="meta">Số phiếu: ${device.ticketNumber} | Ngày tạo: ${formatDate(device.fullData[5])}</div>
                  </div>

                  <div class="content-wrapper">
                      <div class="qr-section">
                          ${qrSvgString}
                          <div style="font-weight:bold; margin-top:5px; font-size:12px;">${device.ticketNumber}</div>
                      </div>
                      
                      <div class="table-section">
                          <table>
                              <tbody>
                                  ${fields.map(f => `
                                      <tr>
                                          <th>${f.label.replace(/\(.\)/g, '')}</th>
                                          <td>${f.value || '-'}</td>
                                      </tr>
                                  `).join('')}
                              </tbody>
                          </table>
                      </div>
                  </div>

                  <div class="footer">
                      <p>In ngày: ${new Date().toLocaleString('vi-VN')}</p>
                      <p>Hệ thống quản lý kho thiết bị</p>
                  </div>
              </div>
              <script>
                  // Tự động in khi tải xong
                  window.onload = function() { window.print(); }
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
  };

  const DetailRow = ({ icon: Icon, label, value, highlight = false, className = "" }: any) => (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${highlight ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50 border border-slate-100'} ${className}`}>
        <div className={`p-2 rounded-full flex-shrink-0 ${highlight ? 'bg-blue-100 text-blue-600' : 'bg-white text-slate-500 shadow-sm'}`}>
            <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">{label}</p>
            <p className={`text-sm font-medium break-words leading-snug ${highlight ? 'text-blue-900' : 'text-slate-700'}`}>
                {value || <span className="text-slate-300 italic">-</span>}
            </p>
        </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                    <Package className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-lg leading-tight">{device.deviceName}</h3>
                    <p className="text-xs text-slate-500 font-mono">{device.modelSerial || 'No Model/Serial'}</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar bg-white">
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Left: Info Grid */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {fields.map((field, idx) => (
                        <DetailRow 
                            key={idx}
                            icon={field.icon} 
                            label={field.label} 
                            value={field.value} 
                            highlight={field.highlight}
                            className={field.col || ""}
                        />
                    ))}
                </div>

                {/* Right: QR Preview (Sticky on Desktop) */}
                <div className="lg:w-72 shrink-0 flex flex-col gap-4">
                    <div 
                        id="modal-qr-container" 
                        className="bg-white border-2 border-slate-800 p-4 rounded-xl shadow-sm flex flex-col items-center justify-center text-center aspect-square sticky top-0"
                    >
                        <QRCodeSVG 
                            value={device.qrContent} 
                            size={200} 
                            level={"H"}
                            className="w-full h-full"
                        />
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Xem Trước Nội Dung QR</p>
                        <p className="text-xs text-slate-600 whitespace-pre-line font-mono leading-relaxed text-left bg-white p-2 rounded border border-slate-200">
                            {device.qrContent}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">
                Đóng
            </button>
            <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-500/20 flex items-center gap-2">
                <Printer className="w-4 h-4" />
                In Chi Tiết (A4)
            </button>
        </div>
      </div>
    </div>
  );
};
