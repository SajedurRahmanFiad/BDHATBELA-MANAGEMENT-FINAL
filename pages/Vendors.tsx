
import React, { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../db';
import { Vendor } from '../types';
import { formatCurrency, ICONS } from '../constants';
import { Button, Table, TableCell, IconButton } from '../components';
import Pagination from '../src/components/Pagination';
import { theme } from '../theme';
import { useVendorsPage, useSystemDefaults } from '../src/hooks/useQueries';
import { useDeleteVendor } from '../src/hooks/useMutations';
import { useToastNotifications } from '../src/contexts/ToastContext';
import { useSearch } from '../src/contexts/SearchContext';
import { DEFAULT_PAGE_SIZE } from '../src/services/supabaseQueries';

const Vendors: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToastNotifications();
  const { searchQuery } = useSearch();
  const { data: systemDefaults } = useSystemDefaults();
  const pageSize = systemDefaults?.recordsPerPage || DEFAULT_PAGE_SIZE;
  const [page, setPage] = React.useState<number>(1);
  const { data: vendorsPage = { data: [], count: 0 }, isPending } = useVendorsPage(page, pageSize, searchQuery);
  const vendors = vendorsPage.data || [];
  const total = vendorsPage.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const deleteVendorMutation = useDeleteVendor();

  // Reset page to 1 when search query changes to avoid 416 Range Not Satisfiable errors
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const filteredVendors = vendors;

  const handleDelete = async (vendorId: string) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return;
    try {
      await deleteVendorMutation.mutateAsync(vendorId);
      queryClient.invalidateQueries({ queryKey: ['vendors', page] });
      toast.success('Vendor deleted successfully');
    } catch (err) {
      console.error('Failed to delete vendor:', err);
      toast.error('Failed to delete vendor');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="md:text-2xl text-xl font-bold text-gray-900">Vendors</h2>
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
              <div className="justify-end flex items-center gap-2">
                <IconButton
                  icon={ICONS.Edit}
                  variant="primary"
                  title="Edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/vendors/edit/${vendorId}`);
                  }}
                />
                <IconButton
                  icon={ICONS.Delete}
                  variant="danger"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(vendorId);
                  }}
                />
              </div>
            ),
          },
        ]}
        data={filteredVendors}
        loading={isPending}
        onRowClick={(vendor) => navigate(`/vendors/${vendor.id}`)}
        emptyMessage="No vendors found"
      />
      <Pagination page={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} disabled={isPending} />
    </div>
  );
};

export default Vendors;
