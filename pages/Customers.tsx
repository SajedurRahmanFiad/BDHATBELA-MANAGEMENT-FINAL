
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, saveDb } from '../db';
import { Customer } from '../types';
import { formatCurrency, ICONS } from '../constants';
import { Button, Table, TableCell, IconButton } from '../components';
import { theme } from '../theme';

const Customers: React.FC = () => {
  const navigate = useNavigate();
  const [customers] = useState<Customer[]>(db.customers);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Customers</h2>
          <p className="text-gray-500 text-sm">Manage client relationships and account balances</p>
        </div>
        <Button 
          onClick={() => navigate('/customers/new')}
          variant="primary"
          size="md"
          icon={ICONS.Plus}
        >
          New Customer
        </Button>
      </div>

      <Table
        columns={[
          {
            key: 'name',
            label: 'Customer Name',
            render: (_, customer) => (
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-green-100 ${theme.colors.primary[600]} flex items-center justify-center font-bold text-white`}>
                  {customer.name.charAt(0)}
                </div>
                <div>
                  <span className="font-bold text-gray-900 block">{customer.name}</span>
                  <p className="text-xs text-gray-400 truncate max-w-[200px]">{customer.address}</p>
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
            key: 'totalOrders',
            label: 'Total Orders',
            align: 'center',
            render: (count) => (
              <span className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-bold text-gray-600">
                {count}
              </span>
            ),
          },
          {
            key: 'dueAmount',
            label: 'Due Amount',
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
            render: (customerId) => (
              <IconButton
                icon={ICONS.Edit}
                variant="primary"
                title="Edit"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/customers/edit/${customerId}`);
                }}
              />
            ),
          },
        ]}
        data={customers}
        onRowClick={(customer) => navigate(`/customers/${customer.id}`)}
        emptyMessage="No customers found"
      />
    </div>
  );
};

export default Customers;


