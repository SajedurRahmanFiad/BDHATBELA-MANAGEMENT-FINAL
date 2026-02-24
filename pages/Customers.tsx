
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Customer, UserRole } from '../types';
import { formatCurrency, ICONS } from '../constants';
import { Button, Table, TableCell, IconButton, TableLoadingSkeleton } from '../components';
import FilterBar, { FilterRange } from '../components/FilterBar';
import Pagination from '../src/components/Pagination';
import { theme } from '../theme';
import { useCustomersPage, useSystemDefaults } from '../src/hooks/useQueries';
import { useDeleteCustomer } from '../src/hooks/useMutations';
import { useToastNotifications } from '../src/contexts/ToastContext';
import { useSearch } from '../src/contexts/SearchContext';
import { useAuth } from '../src/contexts/AuthProvider';
import { DEFAULT_PAGE_SIZE } from '../src/services/supabaseQueries';
import { useMemo, useEffect } from 'react';
import { isTempId } from '../src/utils/optimisticIdMap';

const Customers: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToastNotifications();
  const { searchQuery } = useSearch();
  const { user } = useAuth();
  const { data: systemDefaults } = useSystemDefaults();
  const pageSize = systemDefaults?.recordsPerPage || DEFAULT_PAGE_SIZE;
  const [page, setPage] = React.useState<number>(1);
  const { data: customersPage, isFetching, error } = useCustomersPage(page, pageSize, searchQuery);
  const customers = customersPage?.data ?? [];
  const total = customersPage?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const deleteCustomerMutation = useDeleteCustomer();
  const isAdmin = user?.role === UserRole.ADMIN;

  // Reset page to 1 when search query changes to avoid 416 Range Not Satisfiable errors
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  // Server-side search is applied via the paginated hook. Keep client-side memo only for derived formatting.
  const filteredCustomers = customers;

  const handleDelete = async (customerId: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;

    // If this is an optimistic local-only item (temp id), remove it from the cache
    if (isTempId(customerId)) {
      queryClient.setQueryData(['customers'], (old: any[] | undefined) => {
        if (!old) return old;
        return old.filter(c => c.id !== customerId);
      });
      toast.success('Customer deleted');
      return;
    }

    try {
      await deleteCustomerMutation.mutateAsync(customerId);
      toast.success('Customer deleted successfully');
    } catch (err) {
      console.error('Failed to delete customer:', err);
      toast.error('Failed to delete customer');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="md:text-2xl text-xl font-bold text-gray-900">Customers</h2>
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

      {/* (No Created By filter for customers) */}
      {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800"><strong>Error loading customers:</strong> {error instanceof Error ? error.message : String(error)}</p>
            </div>
          )}

      <Table
        columns={[
          {
            key: 'name',
            label: 'Customer Name',
            render: (_, customer) => (
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center font-bold text-white`}>
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
            align: 'center' as const,
            render: (count) => (
              <span className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-bold text-gray-600">
                {count}
              </span>
            ),
          },
          {
            key: 'dueAmount',
            label: 'Due Amount',
            align: 'right' as const,
            render: (amount) => (
              <span className={`font-bold ${amount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {formatCurrency(amount)}
              </span>
            ),
          },
          {
            key: 'id',
            label: 'Actions',
            align: 'right' as const,
            render: (customerId) => (
              <div className="justify-end flex items-center gap-2">
                <IconButton
                  icon={ICONS.Edit}
                  variant="primary"
                  title="Edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/customers/edit/${customerId}`);
                  }}
                />
                {isAdmin && (
                  <IconButton
                    icon={ICONS.Delete}
                    variant="danger"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(customerId);
                    }}
                  />
                )}
              </div>
            ),
          },
        ]}
        data={filteredCustomers}
        loading={isFetching}
        onRowClick={(customer) => navigate(`/customers/${customer.id}`)}
        emptyMessage="No customers found"
      />
      <Pagination page={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} disabled={isFetching} />
    </div>
  );
};

export default Customers;


