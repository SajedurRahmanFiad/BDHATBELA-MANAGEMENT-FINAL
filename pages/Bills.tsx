
import React, { useState, useMemo, useEffect } from 'react';
import PortalMenu from '../components/PortalMenu';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../db';
import { Bill, BillStatus, UserRole } from '../types';
import { formatCurrency, ICONS, getStatusColor } from '../constants';
import FilterBar, { FilterRange } from '../components/FilterBar';
import { Button, TableLoadingSkeleton } from '../components';
import { theme } from '../theme';
import { useBillsPage, useVendors, useUsers, useSystemDefaults } from '../src/hooks/useQueries';
import Pagination from '../src/components/Pagination';
import { useCreateBill, useDeleteBill } from '../src/hooks/useMutations';
import { useToastNotifications } from '../src/contexts/ToastContext';
import { useSearch } from '../src/contexts/SearchContext';
import { DEFAULT_PAGE_SIZE } from '../src/services/supabaseQueries';

const Bills: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToastNotifications();
  const { searchQuery } = useSearch();
  const user = db.currentUser;
  const { data: systemDefaults } = useSystemDefaults();
  const pageSize = systemDefaults?.recordsPerPage || DEFAULT_PAGE_SIZE;
  const [page, setPage] = useState<number>(1);
  const [filterRange, setFilterRange] = useState<FilterRange>('All Time');
  const [customDates, setCustomDates] = useState({ from: '', to: '' });
  const [statusTab, setStatusTab] = useState<BillStatus | 'All'>('All');
  const [createdByFilter, setCreatedByFilter] = useState<string>('all'); // 'all', 'admins', 'employees', or specific user ID
  
  const { data: users = [] } = useUsers();

  // Compute createdByIds based on createdByFilter
  const createdByIds = useMemo(() => {
    if (createdByFilter === 'all') return undefined;
    if (createdByFilter === 'admins') {
      return users.filter(u => u.role === UserRole.ADMIN).map(u => u.id);
    }
    if (createdByFilter === 'employees') {
      return users.filter(u => u.role === UserRole.EMPLOYEE).map(u => u.id);
    }
    // Specific user ID
    return [createdByFilter];
  }, [createdByFilter, users]);

  const { data: billsPage, isPending: billsLoading } = useBillsPage(page, pageSize, { from: customDates.from, to: customDates.to, search: searchQuery, createdByIds });
  const bills = billsPage?.data ?? [];
  const total = billsPage?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const { data: vendors = [] } = useVendors();

  // Reset page to 1 when any filter changes to avoid 416 Range Not Satisfiable errors
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterRange, customDates.from, customDates.to, createdByFilter]);

  // Wrapper functions that reset page AND apply filter (atomic operation)
  const handleFilterRangeChange = (range: FilterRange) => {
    setPage(1);
    setFilterRange(range);
  };

  const handleCustomDatesChange = (dates: { from: string; to: string }) => {
    setPage(1);
    setCustomDates(dates);
  };

  const handleCreatedByFilterChange = (filter: string) => {
    setPage(1);
    setCreatedByFilter(filter);
  };

  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [openActionsMenu, setOpenActionsMenu] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const createMutation = useCreateBill();
  const deleteMutation = useDeleteBill();

  // Create a Map for O(1) user lookups instead of O(n) array searching
  const userMap = useMemo(() => {
    return new Map(users.map(u => [u.id, u]));
  }, [users]);

  const isWithinRange = (dateStr: string) => {
    if (filterRange === 'All Time') return true;
    const date = new Date(dateStr);
    const now = new Date();
    if (filterRange === 'Today') return date.toDateString() === now.toDateString();
    if (filterRange === 'This Week') {
      const first = now.getDate() - now.getDay();
      const firstDay = new Date(new Date().setDate(first));
      const lastDay = new Date(new Date().setDate(first + 6));
      return date >= firstDay && date <= lastDay;
    }
    if (filterRange === 'This Month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    if (filterRange === 'This Year') return date.getFullYear() === now.getFullYear();
    if (filterRange === 'Custom') {
      if (!customDates.from || !customDates.to) return true;
      return date >= new Date(customDates.from) && date <= new Date(customDates.to);
    }
    return true;
  };

  // Helper to get creator name from createdBy field or history
  const getCreatorName = (bill: Bill) => {
    // First try to lookup from createdBy database field using O(1) Map lookup
    if (bill.createdBy?.trim()) {
      const user = userMap.get(bill.createdBy);
      if (user?.name) return user.name;
    }
    
    // Fallback: extract from history for older records
    if (bill.history?.created) {
      // Bills history format: "Created by {name} on ..."
      const match = bill.history.created.match(/Created by\s+(.+?)\s+on/);
      if (match && match[1]) return match[1];
    }
    
    return null;
  };

  // Server-side filtering applied; keep client-side logic minimal
  const filteredBills = bills.filter(b => statusTab === 'All' || b.status === statusTab);

  const handleDuplicate = async (bill: Bill) => {
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' });
      
      const newBillData: Omit<Bill, 'id'> = {
        billNumber: `PUR-${Math.floor(1000 + Math.random() * 9000)}`,
        billDate: new Date().toISOString().split('T')[0],
        vendorId: bill.vendorId,
        createdBy: user?.id || bill.createdBy,
        status: BillStatus.ON_HOLD,
        items: bill.items,
        subtotal: bill.subtotal,
        discount: bill.discount,
        shipping: bill.shipping,
        total: bill.total,
        paidAmount: 0,
        notes: bill.notes,
        history: {
          created: `Created as duplicate on ${dateStr}, at ${timeStr}`
        }
      };

      await createMutation.mutateAsync(newBillData as any);
      queryClient.invalidateQueries({ queryKey: ['bills', 1] });
    } catch (error) {
      console.error('Failed to duplicate bill:', error);
      toast.error('Failed to duplicate bill');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bill?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      queryClient.invalidateQueries({ queryKey: ['bills', page] });
    } catch (error) {
      console.error('Failed to delete bill:', error);
      toast.error('Failed to delete bill');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="md:text-2xl text-xl font-black text-gray-900 tracking-tight">Purchase Bills</h2>
        </div>
        <Button
          onClick={() => navigate('/bills/new')}
          variant="primary"
          size="md"
          icon={ICONS.Plus}
        >
          New Bill
        </Button>
      </div>

      <FilterBar 
        title="Bills"
        filterRange={filterRange}
        setFilterRange={handleFilterRangeChange}
        customDates={customDates}
        setCustomDates={handleCustomDatesChange}
        statusTab={statusTab}
        setStatusTab={setStatusTab}
        statusOptions={Object.values(BillStatus)}
      />

      {/* Created By Filter Dropdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="text-sm font-bold text-gray-700">Created By:</label>
          <select
            value={createdByFilter}
            onChange={(e) => handleCreatedByFilterChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Users</option>
            {users.some(u => u.role === UserRole.ADMIN) && <option value="admins">All Admins</option>}
            {users.some(u => u.role === UserRole.EMPLOYEE) && <option value="employees">All Employees</option>}
            <optgroup label="Specific Users">
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} {u.role === UserRole.ADMIN ? '(Admin)' : '(Employee)'}</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Bill Details</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Vendor</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Created By</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Status</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Net Amount</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] sm:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {billsLoading ? (
                <TableLoadingSkeleton columns={5} rows={8} />
              ) : filteredBills.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-20 text-center text-gray-400 italic font-medium">No purchase bills found for this period.</td></tr>
              ) : filteredBills.map((bill) => (
                <tr 
                  key={bill.id} 
                  onMouseEnter={() => setHoveredRow(bill.id)} 
                  onMouseLeave={() => setHoveredRow(null)} 
                  onClick={() => navigate(`/bills/${bill.id}`)} 
                  className="group relative hover:bg-[#ebf4ff]/20 cursor-pointer transition-all"
                >
                  <td className="px-6 py-5">
                    <span className="font-black text-gray-900">#{bill.billNumber}</span>
                    <p className="text-[10px] text-gray-400 font-bold mt-1 tracking-tight">{bill.billDate}</p>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-sm font-bold text-gray-700">{vendors.find(v => v.id === bill.vendorId)?.name || 'Unknown Vendor'}</span>
                  </td>
                  <td className="px-6 py-5 text-xs font-bold text-gray-500">{getCreatorName(bill) || '—'}</td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusColor(bill.status)}`}>{bill.status}</span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="font-black text-gray-900 text-base">{formatCurrency(bill.total)}</span>
                  </td>

                  {/* Mobile Actions Dropdown */}
                  <td className="px-6 py-5 sm:hidden relative z-[999]" onClick={e => e.stopPropagation()}>
                    <div className="relative z-[999]">
                      <button
                        onClick={(e) => {
                          const target = e.currentTarget as HTMLElement;
                          if (openActionsMenu === bill.id) {
                            setOpenActionsMenu(null);
                            setAnchorEl(null);
                          } else {
                            setOpenActionsMenu(bill.id);
                            setAnchorEl(target);
                          }
                        }}
                        className="p-2 text-gray-400 hover:text-[#0f2f57] hover:bg-[#ebf4ff] rounded-lg transition-all"
                      >
                        {ICONS.More}
                      </button>
                      <PortalMenu anchorEl={anchorEl} open={openActionsMenu === bill.id} onClose={() => { setOpenActionsMenu(null); setAnchorEl(null); }}>
                        <button onClick={() => { navigate(`/bills/edit/${bill.id}`); setOpenActionsMenu(null); setAnchorEl(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700">{ICONS.Edit} Edit</button>
                        <button onClick={() => { handleDuplicate(bill); setOpenActionsMenu(null); setAnchorEl(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700">{ICONS.Duplicate} Duplicate</button>
                        <div className="border-t my-1"></div>
                        <button onClick={() => { handleDelete(bill.id); setOpenActionsMenu(null); setAnchorEl(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 flex items-center gap-2 font-bold text-red-600">{ICONS.Delete} Delete</button>
                      </PortalMenu>
                    </div>
                  </td>

                  {/* Desktop Hover Actions */}
                  {hoveredRow === bill.id && (
                    <td className="absolute right-6 top-1/2 -translate-y-1/2 z-10 animate-in fade-in slide-in-from-right-2 duration-200 hidden sm:table-cell" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-[#ebf4ff]">
                        <button onClick={() => navigate(`/bills/edit/${bill.id}`)} className="p-2.5 text-gray-400 hover:text-[#0f2f57] hover:bg-[#ebf4ff] rounded-xl transition-all" title="Edit">{ICONS.Edit}</button>
                        <button onClick={() => handleDuplicate(bill)} className="p-2.5 text-gray-400 hover:text-[#0f2f57] hover:bg-[#ebf4ff] rounded-xl transition-all" title="Duplicate">{ICONS.Duplicate}</button>
                        <div className="h-5 w-px bg-gray-100 mx-1"></div>
                        <button onClick={() => handleDelete(bill.id)} className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Delete">{ICONS.Delete}</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} disabled={billsLoading} />
    </div>
  );
};

export default Bills;



