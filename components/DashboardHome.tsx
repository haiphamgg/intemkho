
import React, { useMemo, useState } from 'react';
import { DeviceRow } from '../types';
import { 
  BarChart3, PieChart, Activity, Users, 
  Package, FileSpreadsheet, TrendingUp, Calendar, ArrowRight,
  Trophy, Medal, Star, Zap, Clock, DollarSign, ArrowDownCircle,
  Bot, Sparkles, Send, Loader2
} from 'lucide-react';
import { askGemini } from '../services/geminiService';

interface DashboardHomeProps {
  data: DeviceRow[];
  lastUpdated: Date | null;
  onNavigate: (mode: any) => void;
  isAdmin: boolean;
  apiKey?: string;
}

// Helper format tiền tệ
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

// Helper parse số từ chuỗi sheet (VD: "10.000.000" -> 10000000)
const parseNumber = (str: string | undefined) => {
    if (!str) return 0;
    // Xóa dấu chấm phân cách hàng nghìn, giữ lại số
    const clean = str.toString().replace(/\./g, '').replace(/,/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

export const DashboardHome: React.FC<DashboardHomeProps> = ({ data, lastUpdated, onNavigate, isAdmin, apiKey }) => {
  // State cho AI Chat
  const [chatInput, setChatInput] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  // Tính toán số liệu thống kê
  const stats = useMemo(() => {
    const totalDevices = data.length;
    const uniqueTickets = new Set(data.map(d => d.ticketNumber)).size;
    const uniqueDepts = new Set(data.filter(d => d.department).map(d => d.department)).size;
    const uniqueProviders = new Set(data.filter(d => d.provider).map(d => d.provider)).size;

    // --- LOGIC HOẠT ĐỘNG GẦN NHẤT (MỚI: HIỂN THỊ TỐI ĐA 3 THIẾT BỊ) ---
    const ticketMap = new Map<string, { date: string, items: string[] }>();
    
    // Duyệt ngược để lấy mới nhất trước
    [...data].reverse().forEach(d => {
        if (!ticketMap.has(d.ticketNumber)) {
            ticketMap.set(d.ticketNumber, { date: '', items: [] });
        }
        const t = ticketMap.get(d.ticketNumber)!;
        t.items.push(d.deviceName);
        if (!t.date && d.fullData[5]) t.date = d.fullData[5]; 
    });

    const recentActivities = Array.from(ticketMap.entries())
        .slice(0, 6) // Lấy 6 phiếu mới nhất
        .map(([ticket, info]) => {
            // Lấy tối đa 3 thiết bị đầu tiên để hiển thị
            const displayItems = info.items.slice(0, 3);
            const remaining = info.items.length - 3;
            
            return {
                ticket,
                displayItems: displayItems.join(', '),
                remaining: remaining > 0 ? remaining : 0,
                totalItems: info.items.length
            };
        });

    // Thống kê theo bộ phận (Top 5)
    const deptCounts: Record<string, number> = {};
    data.forEach(d => {
        if(d.department) deptCounts[d.department] = (deptCounts[d.department] || 0) + 1;
    });
    const topDepts = Object.entries(deptCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    // --- LOGIC TOP 10 MẶT HÀNG (SẮP XẾP THEO SỐ TIỀN) ---
    const itemStats: Record<string, { count: number, totalMoney: number }> = {};
    
    let maxMoney = 0;

    data.forEach(d => {
        // Lọc bỏ phiếu Xuất (PX)
        if (d.ticketNumber.toUpperCase().startsWith('PX')) return;

        if (!d.deviceName) return;
        const name = d.deviceName;
        
        const qty = parseNumber(d.fullData[14]) || 1;
        const money = parseNumber(d.fullData[16]) || 0;

        if (!itemStats[name]) {
            itemStats[name] = { count: 0, totalMoney: 0 };
        }
        itemStats[name].count += qty;
        itemStats[name].totalMoney += money;
    });
    
    // Sắp xếp theo TỔNG TIỀN giảm dần
    const topItems = Object.entries(itemStats)
        .sort((a, b) => b[1].totalMoney - a[1].totalMoney)
        .slice(0, 10);
    
    if (topItems.length > 0) {
        maxMoney = topItems[0][1].totalMoney;
    }

    return { 
        totalDevices, 
        uniqueTickets, 
        uniqueDepts, 
        uniqueProviders, 
        recentActivities, 
        topDepts,
        topItems,
        maxMoney
    };
  }, [data]);

  const handleAskAI = async () => {
      if (!chatInput.trim()) return;
      setIsChatting(true);
      
      const context = `
        Tổng thiết bị: ${stats.totalDevices}. 
        Tổng phiếu: ${stats.uniqueTickets}.
        Top 3 mặt hàng giá trị nhất: ${stats.topItems.slice(0,3).map(i => i[0]).join(', ')}.
        Hoạt động gần nhất: ${stats.recentActivities[0]?.ticket} (${stats.recentActivities[0]?.displayItems}).
      `;

      const response = await askGemini(chatInput, context, apiKey);
      setChatResponse(response);
      setIsChatting(false);
      setChatInput('');
  };

  const StatCard = ({ title, value, icon: Icon, gradient, subText }: any) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${gradient} opacity-10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>
      
      <div className="flex justify-between items-start mb-4 relative z-10">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md shadow-blue-500/20`}>
            <Icon className="w-6 h-6" />
          </div>
      </div>
      
      <div className="relative z-10">
        <h3 className="text-3xl font-black text-slate-800 tracking-tight mb-1">{value}</h3>
        <p className="text-slate-500 text-sm font-medium">{title}</p>
        {subText && <p className="text-xs text-slate-400 mt-2 flex items-center gap-1"><Activity className="w-3 h-3"/> {subText}</p>}
      </div>
    </div>
  );

  const RankIcon = ({ rank }: { rank: number }) => {
      if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500 fill-yellow-500 drop-shadow-sm" />;
      if (rank === 2) return <Medal className="w-5 h-5 text-slate-400 fill-slate-300 drop-shadow-sm" />;
      if (rank === 3) return <Medal className="w-5 h-5 text-amber-700 fill-amber-600 drop-shadow-sm" />;
      return <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-slate-400 bg-slate-100 rounded-full">{rank}</span>;
  };

  return (
    <div className="p-4 md:p-8 overflow-y-auto h-full bg-slate-50/50 font-sans">
      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                Dashboard <span className="text-blue-600">Overview</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Dữ liệu cập nhật: <span className="font-semibold text-slate-700">{lastUpdated ? lastUpdated.toLocaleString('vi-VN') : 'Chưa đồng bộ'}</span>
            </p>
        </div>
        <div className="flex gap-2">
            {isAdmin && (
                <button onClick={() => onNavigate('warehouse-in')} className="px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-900 transition-colors shadow-lg shadow-slate-500/20">
                    + Nhập Mới
                </button>
            )}
            <button onClick={() => onNavigate('print')} className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30">
                In Tem QR
            </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
            title="Tổng Thiết Bị" 
            value={stats.totalDevices.toLocaleString()} 
            icon={Package} 
            gradient="from-blue-500 to-indigo-600"
            subText="Trong cơ sở dữ liệu"
        />
        <StatCard 
            title="Phiếu Giao Dịch" 
            value={stats.uniqueTickets.toLocaleString()} 
            icon={FileSpreadsheet} 
            gradient="from-emerald-500 to-teal-600"
            subText="Nhập kho & Xuất kho"
        />
        <StatCard 
            title="Phòng Ban / Khoa" 
            value={stats.uniqueDepts.toLocaleString()} 
            icon={Users} 
            gradient="from-violet-500 to-purple-600"
            subText="Đơn vị quản lý"
        />
        <StatCard 
            title="Đối Tác / NCC" 
            value={stats.uniqueProviders.toLocaleString()} 
            icon={Activity} 
            gradient="from-orange-500 to-amber-600"
            subText="Nhà cung cấp"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* --- LEFT COLUMN (2/3) --- */}
        <div className="xl:col-span-2 space-y-8">
            
            {/* TOP 10 MOST USED ITEMS (SORTED BY MONEY) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <ArrowDownCircle className="w-5 h-5 text-emerald-500 fill-emerald-50" />
                        Top 10 Giá Trị Nhập Kho
                    </h3>
                    <div className="flex gap-2">
                        <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                            Theo tổng tiền
                        </span>
                    </div>
                </div>
                <div className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="px-6 py-4 w-16 text-center">Hạng</th>
                                    <th className="px-6 py-4">Tên Thiết Bị</th>
                                    <th className="px-6 py-4 w-1/4">Tỷ trọng</th>
                                    <th className="px-6 py-4 w-24 text-right">Số lượng</th>
                                    <th className="px-6 py-4 w-32 text-right">Tổng Tiền</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {stats.topItems.length > 0 ? (
                                    stats.topItems.map(([name, stat], idx) => {
                                        const percent = Math.round((stat.totalMoney / stats.maxMoney) * 100);
                                        return (
                                            <tr key={idx} className="hover:bg-blue-50/50 transition-colors group">
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex justify-center"><RankIcon rank={idx + 1} /></div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`font-bold text-sm ${idx < 3 ? 'text-slate-800' : 'text-slate-600'}`}>
                                                        {name}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 align-middle">
                                                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                                                idx === 0 ? 'bg-gradient-to-r from-emerald-400 to-green-500' :
                                                                idx === 1 ? 'bg-gradient-to-r from-emerald-300 to-emerald-400' :
                                                                idx === 2 ? 'bg-gradient-to-r from-emerald-200 to-emerald-300' :
                                                                'bg-slate-300 opacity-60'
                                                            }`}
                                                            style={{ width: `${percent}%` }}
                                                        ></div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono font-bold text-slate-500 text-sm">
                                                    {stat.count}
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600 text-sm">
                                                    {stat.totalMoney > 0 ? formatCurrency(stat.totalMoney) : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                            Chưa có dữ liệu nhập kho
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* RECENT ACTIVITY */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                        Hoạt Động Gần Nhất
                    </h3>
                    <button onClick={() => onNavigate('print')} className="text-sm text-blue-600 font-bold hover:underline flex items-center gap-1">
                        Xem tất cả <ArrowRight className="w-4 h-4"/>
                    </button>
                </div>
                
                <div className="space-y-3">
                    {stats.recentActivities.length > 0 ? (
                        stats.recentActivities.map((act, idx) => (
                            <div key={idx} className="flex items-start p-4 bg-slate-50 rounded-xl hover:bg-white hover:shadow-md hover:border-blue-100 border border-transparent transition-all cursor-pointer group" onClick={() => onNavigate('print')}>
                                <div className="mt-0.5 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs shadow-sm group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors shrink-0 mr-3">
                                    {idx + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors text-sm">
                                            {act.ticket}
                                        </p>
                                        {act.ticket.startsWith('PN') 
                                            ? <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">NHẬP</span>
                                            : <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">XUẤT</span>
                                        }
                                        {/* NEW LOCATION FOR "Chi tiết" */}
                                         <span className="text-[10px] bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-medium group-hover:border-blue-200 group-hover:text-blue-600 transition-colors shadow-sm">
                                            Chi tiết
                                        </span>
                                    </div>
                                    <p className="text-sm font-semibold text-slate-600 truncate mt-1" title={act.displayItems}>
                                        {act.displayItems}
                                    </p>
                                    {act.remaining > 0 && (
                                        <p className="text-xs text-slate-400 mt-1">
                                            <span className="font-medium text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded-sm">
                                                +{act.remaining} thiết bị khác
                                            </span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 text-slate-400">Chưa có dữ liệu phiếu</div>
                    )}
                </div>
            </div>
        </div>

        {/* --- RIGHT COLUMN (1/3) --- */}
        <div className="space-y-6">
            
            {/* SYSTEM STATUS */}
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg shadow-slate-900/20 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
                 <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500 rounded-full blur-3xl opacity-20 -ml-10 -mb-10"></div>
                 
                 <h3 className="text-lg font-bold mb-4 relative z-10">Trạng thái hệ thống</h3>
                 <div className="space-y-4 relative z-10">
                     <div className="flex items-center justify-between p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
                         <div className="flex items-center gap-3">
                             <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                             <span className="text-sm font-medium">Kết nối Sheet</span>
                         </div>
                         <span className="text-xs font-mono text-green-300">Ổn định</span>
                     </div>
                 </div>
                 {isAdmin && (
                    <button onClick={() => onNavigate('master')} className="w-full mt-6 py-3 bg-white text-slate-900 font-bold text-sm rounded-xl hover:bg-slate-100 transition-colors shadow-lg">
                        Quản lý Danh Mục
                    </button>
                 )}
            </div>

            {/* AI ASSISTANT */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[400px]">
                <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center gap-3 shrink-0">
                    <div className="p-2 bg-white/20 rounded-lg text-white">
                        <Bot className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm">Trợ lý Kho AI</h3>
                        <p className="text-[10px] text-indigo-100 flex items-center gap-1">
                           <Sparkles className="w-3 h-3"/> Powered by Gemini
                        </p>
                    </div>
                </div>

                <div className="flex-1 p-4 overflow-y-auto bg-slate-50 flex flex-col gap-3">
                    {chatResponse ? (
                        <div className="flex flex-col gap-2">
                             <div className="self-end bg-blue-100 text-blue-800 p-3 rounded-2xl rounded-tr-sm text-sm max-w-[90%]">
                                 {chatInput || "Câu hỏi trước đó..."}
                             </div>
                             <div className="self-start bg-white border border-slate-200 text-slate-700 p-3 rounded-2xl rounded-tl-sm text-sm shadow-sm max-w-[90%]">
                                 {chatResponse}
                             </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center px-4">
                            <Bot className="w-10 h-10 mb-2 opacity-20" />
                            <p className="text-xs">Hỏi tôi về số liệu tồn kho, xu hướng nhập xuất...</p>
                        </div>
                    )}
                </div>

                <div className="p-3 bg-white border-t border-slate-100 shrink-0">
                    <div className="relative">
                        <input 
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Nhập câu hỏi..."
                            className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                            disabled={isChatting}
                        />
                        <button 
                            onClick={handleAskAI}
                            disabled={isChatting || !chatInput.trim()}
                            className="absolute right-1.5 top-1.5 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            {isChatting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* DEPARTMENT DISTRIBUTION */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-purple-500" />
                    Phân Bổ Tài Sản
                </h3>
                <div className="space-y-6">
                    {stats.topDepts.length > 0 ? (
                        stats.topDepts.map(([name, count], idx) => {
                            const percent = Math.round((count / stats.totalDevices) * 100);
                            return (
                                <div key={idx} className="group">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="font-semibold text-slate-700 truncate max-w-[180px]" title={name}>{name || 'Chưa phân loại'}</span>
                                        <span className="text-slate-500 font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{count} ({percent}%)</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-500 ${
                                                idx === 0 ? 'bg-blue-500' : 
                                                idx === 1 ? 'bg-purple-500' : 
                                                idx === 2 ? 'bg-emerald-500' : 
                                                idx === 3 ? 'bg-orange-500' : 'bg-slate-400'
                                            }`} 
                                            style={{ width: `${percent}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )
                        })
                    ) : (
                        <div className="text-center py-10 text-slate-400">Chưa có dữ liệu</div>
                    )}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};
