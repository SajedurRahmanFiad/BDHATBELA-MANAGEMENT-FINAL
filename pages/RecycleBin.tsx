import React, { useEffect, useState } from 'react';
import { Button, Table } from '../components';
import { ICONS } from '../constants';
import Pagination from '../src/components/Pagination';
import { useAuth } from '../src/contexts/AuthProvider';
import { useToastNotifications } from '../src/contexts/ToastContext';
import { usePermanentlyDeleteDeletedItem, useRestoreDeletedItem } from '../src/hooks/useMutations';
import { useRecycleBinPage, useSystemDefaults } from '../src/hooks/useQueries';
import { DEFAULT_PAGE_SIZE } from '../src/services/supabaseQueries';
import { RecycleBinEntityType, RecycleBinItem, hasAdminAccess } from '../types';

const ENTITY_LABELS: Record<RecycleBinEntityType, string> = {
  customer: 'Customer',
  order: 'Order',
  bill: 'Bill',
  transaction: 'Transaction',
  user: 'User',
  vendor: 'Vendor',
  product: 'Product',
};

const ENTITY_BADGES: Record<RecycleBinEntityType, string> = {
  customer: 'bg-blue-100 text-blue-700',
  order: 'bg-emerald-100 text-emerald-700',
  bill: 'bg-amber-100 text-amber-700',
  transaction: 'bg-violet-100 text-violet-700',
  user: 'bg-rose-100 text-rose-700',
  vendor: 'bg-cyan-100 text-cyan-700',
  product: 'bg-slate-100 text-slate-700',
};

const formatTimestamp = (value?: string): string => {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const RecycleBin: React.FC = () => {
  const { user } = useAuth();
  const toast = useToastNotifications();
  const { data: systemDefaults } = useSystemDefaults();
  const pageSize = systemDefaults?.recordsPerPage || DEFAULT_PAGE_SIZE;
  const restoreMutation = useRestoreDeletedItem();
  const permanentlyDeleteMutation = usePermanentlyDeleteDeletedItem();

  const [page, setPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | RecycleBinEntityType>('all');
  const deferredSearchQuery = React.useDeferredValue(searchQuery);

  const isAdmin = hasAdminAccess(user?.role);
  const isMutating = restoreMutation.isPending || permanentlyDeleteMutation.isPending;
  const { data: recycleBinPage = { data: [], count: 0 }, isPending, isFetching } = useRecycleBinPage(
    page,
    pageSize,
    {
      enabled: isAdmin,
      search: deferredSearchQuery,
      entityType: typeFilter,
    }
  );
  const visibleItems = recycleBinPage.data;
  const totalItems = recycleBinPage.count;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setPage(1);
  }, [deferredSearchQuery, typeFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleRestore = async (item: RecycleBinItem) => {
    if (!confirm(`Restore this ${ENTITY_LABELS[item.entityType].toLowerCase()} from the recycle bin?`)) {
      return;
    }

    const toastId = toast.loading(`Restoring ${item.title}...`);
    try {
      await restoreMutation.mutateAsync({ entityType: item.entityType, id: item.id });
      toast.update(toastId, `${item.title} restored successfully.`, 'success');
    } catch (error) {
      toast.update(
        toastId,
        error instanceof Error ? error.message : `Failed to restore ${item.title}.`,
        'error'
      );
    }
  };

  const handleDeleteForever = async (item: RecycleBinItem) => {
    if (!confirm(`Delete ${item.title} forever? This cannot be undone.`)) {
      return;
    }

    const toastId = toast.loading(`Deleting ${item.title} forever...`);
    try {
      await permanentlyDeleteMutation.mutateAsync({ entityType: item.entityType, id: item.id });
      toast.update(toastId, `${item.title} deleted forever.`, 'success');
    } catch (error) {
      toast.update(
        toastId,
        error instanceof Error ? error.message : `Failed to permanently delete ${item.title}.`,
        'error'
      );
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Admin Access Only</p>
        <h2 className="mt-3 text-2xl font-black text-gray-900">Recycle bin access is restricted.</h2>
        <p className="mt-2 text-sm font-medium text-gray-500">
          Only admin-access users can review, restore, or permanently delete archived records.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Admin Archive</p>
          <h2 className="mt-2 text-2xl font-black text-gray-900">Recycle Bin</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search deleted items"
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 outline-none transition focus:border-[#0f2f57] focus:ring-2 focus:ring-[#dfeaf7]"
          />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as 'all' | RecycleBinEntityType)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 outline-none transition focus:border-[#0f2f57] focus:ring-2 focus:ring-[#dfeaf7]"
          >
            <option value="all">All Types</option>
            {Object.entries(ENTITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Table
        columns={[
          {
            key: 'title',
            label: 'Item',
            render: (_value, item: RecycleBinItem) => (
              <div className="min-w-0">
                <p className="text-sm font-black text-gray-900">{item.title}</p>
                {item.description && (
                  <p className="mt-1 text-sm font-medium text-gray-500">{item.description}</p>
                )}
                {item.details.length > 0 && (
                  <p className="mt-1 text-xs font-medium text-gray-500">{item.details.join(' | ')}</p>
                )}
              </div>
            ),
          },
          {
            key: 'entityType',
            label: 'Type',
            render: (value: RecycleBinEntityType) => (
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${ENTITY_BADGES[value]}`}>
                {ENTITY_LABELS[value]}
              </span>
            ),
          },
          {
            key: 'deletedAt',
            label: 'Deleted',
            render: (_value, item: RecycleBinItem) => (
              <p className="text-sm font-medium text-gray-700">{formatTimestamp(item.deletedAt)}</p>
            ),
          },
          {
            key: 'deletedByName',
            label: 'Deleted By',
            render: (_value, item: RecycleBinItem) => (
              <div>
                <p className="text-sm font-medium text-gray-700">{item.deletedByName || item.deletedBy || 'Unknown'}</p>
                {item.createdByName && (
                  <p className="mt-1 text-xs font-medium text-gray-500">
                    Created by {item.createdByName}
                  </p>
                )}
              </div>
            ),
          },
          {
            key: 'id',
            label: 'Actions',
            align: 'right',
            render: (_value, item: RecycleBinItem) => (
              <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isMutating}
                  onClick={() => handleRestore(item)}
                >
                  Restore
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={isMutating}
                  icon={ICONS.Delete}
                  onClick={() => handleDeleteForever(item)}
                >
                  Delete Forever
                </Button>
              </div>
            ),
          },
        ]}
        data={visibleItems}
        hover={false}
        loading={isPending || isFetching}
        emptyMessage={deferredSearchQuery || typeFilter !== 'all' ? 'No deleted items match the current filters.' : 'Recycle bin is empty.'}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">
          Showing {totalItems === 0 ? 0 : (page - 1) * pageSize + 1}
          {' - '}
          {Math.min(page * pageSize, totalItems)} of {totalItems} deleted items
        </p>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} disabled={isPending || isFetching} />
      </div>
    </div>
  );
};

export default RecycleBin;
