
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { Vendor } from '../types';
import { formatCurrency, ICONS } from '../constants';
import { Button, Table, TableCell, IconButton } from '../components';
import { theme } from '../theme';

const Vendors: React.FC = () => {
  const navigate = useNavigate();
  const [vendors] = useState<Vendor[]>(db.vendors);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vendors</h2>
          <p className="text-gray-500 text-sm">Manage suppliers and procurement channels</p>
        </div>
        <Button
          onClick={() => navigate('/vendors/new')}
          variant="primary"
          size="md"
          icon={ICONS.Plus}
        >
          New Vendor
        </Button>
      </div>

      <Table
        columns={[
          {
            key: 'name',
            label: 'Vendor Name',
            render: (_, vendor) => (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  {vendor.name.charAt(0)}
                </div>
                <div>
                  <span className="font-bold text-gray-900 block">{vendor.name}</span>
                  <p className="text-xs text-gray-400 truncate max-w-[200px]">{vendor.address}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'phone',
            label: 'Contact',
            render: (phone) => <span className="text-sm font-medium text-gray-700">{phone}</span>,
          },
          {
            key: 'totalPurchases',
            label: 'Purchases',
            align: 'center',
            render: (count) => (
              <span className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-bold text-gray-600">
                {count}
              </span>
            ),
          },
          {
            key: 'dueAmount',
            label: 'Balance Payable',
            align: 'right',
            render: (amount) => (
              <span className={`font-bold ${amount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {formatCurrency(amount)}
              </span>
            ),
          },
          {
            key: 'id',
            label: 'Actions',
            align: 'right',
            render: (vendorId) => (
              <IconButton
                icon={ICONS.Edit}
                variant="primary"
                title="Edit"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/vendors/edit/${vendorId}`);
                }}
              />
            ),
          },
        ]}
        data={vendors}
        onRowClick={(vendor) => navigate(`/vendors/${vendor.id}`)}
        emptyMessage="No vendors found"
      />
    </div>
  );
};

export default Vendors;
