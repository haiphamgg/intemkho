
import React, { useMemo } from 'react';
import { DeviceRow } from '../types';
import { 
  BarChart3, PieChart, Activity, Users, 
  Package, FileSpreadsheet, TrendingUp, Calendar, ArrowRight 
} from 'lucide-react';

interface DashboardHomeProps {
  data: DeviceRow[];
  lastUpdated: Date | null;
  onNavigate: (mode: any) => void;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({ data, lastUpdated, onNavigate }) => {
  // Tính toán số liệu thống kê
  const stats = useMemo(() => {
    const totalDevices = data.length;
    const uniqueTickets = new Set(data.map(d => d.ticketNumber)).size;
    const uniqueDepts = new Set(data.filter(d => d.department).map(d => d.department)).size;
    const uniqueProviders = new Set(data.filter(d => d.provider).map(d => d.provider)).size;

    // Lấy 5 phiếu mới nhất
    const uniqueTicketList = Array.from(new Set(data.map(d => d.ticketNumber))).reverse().slice(0, 5);
    
    // Thống kê theo bộ phận (Top 4)
    const deptCounts: Record<string, number> = {};
    data.forEach(d => {
        if(d.department) deptCounts[d.department] = (deptCounts[d.department] || 0) + 1;
    });
    const topDepts = Object.entries(deptCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

    return { totalDevices, uniqueTickets, uniqueDepts, uniqueProviders, uniqueTicketList, topDepts };
  }, [data]);

  const StatCard = ({ title, value, icon: Icon, color, subText }: any) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between group hover:shadow-md transition-all">
      <div>
        <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
        {subText && <p className="text-xs text-slate-400 mt-2">{subText}</p>}
      </div>
      <div className={`p-3 rounded-xl ${color} bg-opacity-10 group-hover:scale-110 transition-transform`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
    </div>
  );

  return (
    <div className="p-6 md:p-8 overflow-y-auto h-full bg-slate-50/50">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Tổng quan hệ thống</h1>
        <p className="text-slate-500 text-sm mt-1">
            Cập nhật lần cuối: {lastUpdated ? lastUpdated.toLocaleString('vi-VN') : 'Chưa đồng bộ'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
            title="Tổng Thiết Bị" 
            value={stats.totalDevices} 
            icon={Package} 
            color="bg-blue-500 text-blue-600"
            subText="Trong cơ sở dữ liệu"
        />
        <StatCard 
            title="Số Phiếu Nhập/Xuất" 
            value={stats.uniqueTickets} 
            icon={FileSpreadsheet} 
            color="bg-emerald-500 text-emerald-600"
            subText="Đã ghi nhận"
        />
        <StatCard 
            title="Bộ Phận Sử Dụng" 
            value={stats.uniqueDepts} 
            icon={Users} 
            color="bg-purple-500 text-purple-600"
            subText="Đơn vị phòng ban"
        />
        <StatCard 
            title="Đối Tác / NCC" 
            value={stats.uniqueProviders} 
            icon={Activity} 
            color="bg-orange-500 text-orange-600"
            subText="Nhà cung cấp & Khoa"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Phiếu Gần Nhất
            </h3>
            <button onClick={() => onNavigate('print')} className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1">
                Xem tất cả <ArrowRight className="w-4 h-4"/>
            </button>
          </div>
          
          <div className="space-y-4">
            {stats.uniqueTicketList.length > 0 ? (
                stats.uniqueTicketList.map((ticket, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => onNavigate('print')}>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">
                                {idx + 1}
                            </div>
                            <div>
                                <p className="font-bold text-slate-700">{ticket}</p>
                                <p className="text-xs text-slate-400 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> Tự động cập nhật
                                </p>
                            </div>
                        </div>
                        <div className="px-3 py-1 bg-white rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 shadow-sm">
                            Chi tiết
                        </div>
                    </div>
                ))
            ) : (
                <div className="text-center py-10 text-slate-400">Chưa có dữ liệu phiếu</div>
            )}
          </div>
        </div>

        {/* Top Departments */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-purple-500" />
                Phân Bổ Tài Sản
            </h3>
            <div className="space-y-6">
                {stats.topDepts.length > 0 ? (
                    stats.topDepts.map(([name, count], idx) => {
                        const percent = Math.round((count / stats.totalDevices) * 100);
                        return (
                            <div key={idx}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-slate-700 truncate max-w-[180px]" title={name}>{name || 'Chưa phân loại'}</span>
                                    <span className="text-slate-500">{count} ({percent}%)</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2">
                                    <div 
                                        className={`h-2 rounded-full ${idx === 0 ? 'bg-blue-500' : idx === 1 ? 'bg-purple-500' : idx === 2 ? 'bg-emerald-500' : 'bg-orange-500'}`} 
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
            
            <div className="mt-8 p-4 bg-indigo-50 rounded-xl flex items-start gap-3">
                <BarChart3 className="w-5 h-5 text-indigo-600 mt-0.5" />
                <div>
                    <p className="text-sm font-bold text-indigo-700">Mẹo quản lý</p>
                    <p className="text-xs text-indigo-600/80 mt-1 leading-relaxed">
                        Sử dụng chức năng "Tra cứu" để tìm nhanh thiết bị theo Model hoặc Serial.
                    </p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
