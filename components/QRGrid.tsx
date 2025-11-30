
import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { DeviceRow } from '../types';
import { Printer, FileDown, Loader2, Tag, Box } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface QRGridProps {
  items: DeviceRow[];
  selectedTicket: string;
}

export const QRGrid: React.FC<QRGridProps> = ({ items, selectedTicket }) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    const input = document.getElementById('printable-area');
    if (!input) return;

    setIsGeneratingPdf(true);
    try {
      const originalWidth = input.style.width;
      const originalPadding = input.style.padding;
      
      input.style.width = '1200px'; 
      input.style.padding = '0'; 

      const canvas = await html2canvas(input, {
        scale: 2, 
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
      });

      input.style.width = originalWidth;
      input.style.padding = originalPadding;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const pdfHeight = 297;
      const marginX = 15;
      const marginY = 15;
      const contentWidth = pdfWidth - (marginX * 2); 
      const contentHeight = pdfHeight - (marginY * 2);

      const imgProps = pdf.getImageProperties(imgData);
      const imgHeightOnPdf = (imgProps.height * contentWidth) / imgProps.width;

      let heightLeft = imgHeightOnPdf;
      let position = marginY;

      pdf.addImage(imgData, 'PNG', marginX, position, contentWidth, imgHeightOnPdf);
      heightLeft -= contentHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeightOnPdf; 
        pdf.addPage();
        const printedHeight = imgHeightOnPdf - heightLeft;
        const yPos = marginY - printedHeight;
        pdf.addImage(imgData, 'PNG', marginX, yPos, contentWidth, imgHeightOnPdf);
        heightLeft -= contentHeight;
      }
      pdf.save(`Tem_${selectedTicket}.pdf`);
    } catch (error) {
      console.error("PDF Generation failed", error);
      alert("Lỗi khi tạo PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!selectedTicket || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 m-4">
        <div className="bg-white p-8 rounded-full shadow-lg border border-slate-100 mb-6 animate-pulse">
          <Printer className="w-12 h-12 text-slate-300" />
        </div>
        <h3 className="text-xl font-bold text-slate-600">Sẵn sàng in tem</h3>
        <p className="text-sm mt-2 text-slate-500 max-w-xs text-center leading-relaxed">
          Vui lòng chọn một số phiếu từ danh sách bên trái để xem trước và in mã QR.
        </p>
      </div>
    );
  }

  const isImageUrl = (text: string) => {
    if (!text) return false;
    const lower = text.toLowerCase().trim();
    return lower.startsWith('http') || lower.startsWith('data:image');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Modern Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 mb-2 md:mb-4 mx-0 md:mx-2 flex flex-col sm:flex-row justify-between items-center gap-4 no-print shrink-0">
         <div className="flex items-center gap-3 w-full sm:w-auto">
             <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                 <Tag className="w-5 h-5" />
             </div>
             <div>
                 <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Đang chọn phiếu</p>
                 <h3 className="font-bold text-slate-800 text-sm md:text-base">{selectedTicket}</h3>
             </div>
             <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block"></div>
             <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                <Box className="w-3.5 h-3.5" /> {items.length} thiết bị
             </span>
         </div>

         <div className="flex items-center gap-2 w-full sm:w-auto">
             <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                <span className="inline sm:inline">Lưu PDF</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5 active:scale-95 active:translate-y-0"
              >
                <Printer className="w-4 h-4" />
                In Ngay
              </button>
         </div>
      </div>

      {/* Grid Area */}
      <div className="flex-1 overflow-auto bg-slate-100/50 p-2 md:p-4 rounded-xl border-2 border-dashed border-slate-200 mx-0 md:mx-2 mb-2 no-scrollbar print:bg-white print:p-0 print:border-none print:overflow-visible print:mx-0 print:mb-0">
        <div 
          id="printable-area" 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 md:gap-6 w-full bg-white p-4 md:p-6 shadow-sm rounded-lg sm:bg-transparent sm:p-0 sm:shadow-none"
        >
          {items.map((item) => {
             const isLink = isImageUrl(item.qrContent);
             const qrValue = item.qrContent || "ERROR";

             return (
              <div 
                key={item.rowId} 
                className="print-card bg-white border border-slate-200 p-2 rounded-xl flex flex-col justify-between items-center text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow relative overflow-hidden w-full mx-auto h-full min-h-[220px] print:rounded-none print:shadow-none print:border-2 print:border-black"
              >
                {/* Header */}
                <div className="w-full flex justify-between items-center border-b-2 border-slate-100 pb-2 mb-2 print:border-black flex-none">
                   <div className="text-lg font-black uppercase tracking-wider text-slate-800 print:text-xl leading-none">
                    {item.ticketNumber}
                   </div>
                   <div className="text-sm font-bold uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded print:bg-white print:text-black print:text-lg print:p-0">
                    {item.department}
                   </div>
                </div>

                {/* QR Code */}
                <div className="qr-container flex-1 flex items-center justify-center w-full py-1 overflow-hidden">
                  {isLink ? (
                    <img 
                      src={item.qrContent} 
                      alt="QR" 
                      className="object-contain print:mix-blend-multiply max-h-[140px]"
                    />
                  ) : (
                    <QRCodeSVG 
                      value={qrValue} 
                      size={256} 
                      level={"H"} 
                      minVersion={4}
                      includeMargin={true}
                      className="w-full h-full max-h-[140px]" 
                    />
                  )}
                </div>

                {/* Footer */}
                <div className="w-full border-t border-slate-100 pt-2 mt-1 flex flex-col items-center justify-center print:border-black min-h-[3.5rem] flex-none">
                   <div className="font-bold text-slate-900 text-base leading-tight print:text-xl print:leading-tight line-clamp-2 px-1">
                    {item.deviceName || "Thiết bị"}
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-1 print:text-base print:font-bold print:text-black">
                    {item.modelSerial ? `${item.modelSerial}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
