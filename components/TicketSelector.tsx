
import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';

interface TicketSelectorProps {
  tickets: string[];
  selectedTicket: string;
  onSelect: (ticket: string) => void;
}

export const TicketSelector: React.FC<TicketSelectorProps> = ({ tickets, selectedTicket, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => 
      t.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tickets, searchTerm]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
       <div className="flex items-center gap-2 mb-4 text-primary">
        <Search className="w-6 h-6" />
        <h2 className="text-lg font-semibold">Chọn Số Phiếu</h2>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-4 text-slate-400 italic text-sm">
          Đang chờ dữ liệu...
        </div>
      ) : (
        <div>
          <div className="relative mb-3">
            <input
              type="text"
              placeholder="Gõ để tìm số phiếu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-sm"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <select
            value={selectedTicket}
            onChange={(e) => onSelect(e.target.value)}
            size={10} // Show list box style for better visibility on desktop
            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-sm font-mono h-48"
          >
            <option value="" disabled>-- Danh sách phiếu ({filteredTickets.length}) --</option>
            {filteredTickets.map((ticket, idx) => (
              <option key={idx} value={ticket} className="py-1">
                {ticket}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
