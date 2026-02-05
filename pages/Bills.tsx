
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, saveDb } from '../db';
import { Bill, BillStatus } from '../types';
import { formatCurrency, ICONS } from '../constants';
import FilterBar, { FilterRange } from '../components/FilterBar';
import { Button, IconButton, Table, TableCell } from '../components';
import { theme } from '../theme';

const Bills: React.FC = () => {
  const navigate = useNavigate();
  const [filterRange, setFilterRange] = useState<FilterRange>('All Time');
  const [customDates, setCustomDates] = useState({ from: '', to: '' });
  const [statusTab, setStatusTab] = useState<BillStatus | 'All'>('All');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const getStatusColor = (status: BillStatus) => {
    switch (status) {
      case BillStatus.ON_HOLD: return 'bg-gray-100 text-gray-600';
      case BillStatus.PROCESSING: return 'bg-[#e6f0ff] ${theme.colors.secondary[600]}';
      case BillStatus.RECEIVED: return 'bg-green-100 text-green-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

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

  const filteredBills = useMemo(() => {
    return db.bills
      .filter(b => isWithinRange(b.billDate))
      .filter(b => statusTab === 'All' || b.status === statusTab);
  }, [filterRange, customDates, statusTab]);

  const handleDuplicate = (bill: Bill) => {
    const newBill: Bill = {
      ...bill,
      id: Math.random().toString(36).substr(2, 9),
      billNumber: `PUR-${Math.floor(Math.random() * 10000)}`,
      billDate: new Date().toISOString().split('T')[0],
      status: BillStatus.ON_HOLD,
      paidAmount: 0,
    };
    db.bills.unshift(newBill);
    saveDb();
    navigate(0);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Purchase Bills</h2>
          <p className="text-gray-500 font-medium text-sm">Manage vendor procurement and supply chain payables</p>
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
        setFilterRange={setFilterRange}
        customDates={customDates}
        setCustomDates={setCustomDates}
        statusTab={statusTab}
        setStatusTab={setStatusTab}
        statusOptions={Object.values(BillStatus)}
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
        <div className="overflow-x-auto">
          <Table
            columns={[
              {
                key: 'billNumber',
                label: 'Bill Number',
                render: (billNumber, bill) => (
                  <>
                    <span className="font-black text-gray-900">#{billNumber}</span>
                    <p className="text-[10px] text-gray-400 font-bold mt-1 tracking-tight">{bill.billDate}</p>
                  </>
                ),
              },
              {
                key: 'vendorId',
                label: 'Vendor',
                render: (vendorId) => (
                  <span className="text-sm font-bold text-gray-700">
                    {db.vendors.find(v => v.id === vendorId)?.name || 'Unknown Vendor'}
                  </span>
                ),
              },
              {
                key: 'createdBy',
                label: 'Created By',
                render: (createdBy) => <span className="text-xs font-bold text-gray-500">{createdBy}</span>,
              },
              {
                key: 'status',
                label: 'Status',
                render: (status) => (
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusColor(status)}`}>
                    {status}
                  </span>
                ),
              },
              {
                key: 'total',
                label: 'Amount',
                align: 'right',
                render: (total) => (
                  <span className="font-black text-gray-900 text-base">{formatCurrency(total)}</span>
                ),
              },
              {
                key: 'id',
                label: 'Actions',
                align: 'right',
                render: (billId) => (
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      icon={ICONS.Edit}
                      variant="primary"
                      title="Edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/bills/edit/${billId}`);
                      }}
                    />
                    <IconButton
                      icon={ICONS.Duplicate}
                      variant="primary"
                      title="Duplicate"
                      onClick={(e) => {
                        e.stopPropagation();
                        const bill = filteredBills.find(b => b.id === billId);
                        if (bill) handleDuplicate(bill);
                      }}
                    />
                  </div>
                ),
              },
            ]}
            data={filteredBills}
            onRowClick={(bill) => navigate(`/bills/${bill.id}`)}
            emptyMessage="No purchase bills found for this criteria."
          />
        </div>
      </div>
    </div>
  );
};

export default Bills;



