import React, { useMemo } from 'react';
import { LoadingOverlay, Table } from '../components';
import type { TableColumn } from '../components/Table';
import { formatCurrency } from '../constants';
import { UserRole, type WalletActivityEntry } from '../types';
import { useAuth } from '../src/contexts/AuthProvider';
import { useMyWallet, useWalletActivity, useWalletSettings } from '../src/hooks/useQueries';

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

const getEntryLabel = (entryType: WalletActivityEntry['entryType']): string => {
  if (entryType === 'order_credit') return 'Order Credit';
  if (entryType === 'order_reversal') return 'Order Reversal';
  return 'Payout';
};

const getEntryBadgeClass = (entryType: WalletActivityEntry['entryType']): string => {
  if (entryType === 'order_credit') return 'bg-emerald-100 text-emerald-700';
  if (entryType === 'order_reversal') return 'bg-amber-100 text-amber-700';
  return 'bg-[#dfeaf7] text-[#0f2f57]';
};

const SummaryCard: React.FC<{
  label: string;
  value: string;
  hint: string;
  tone?: string;
}> = ({ label, value, hint, tone = 'border-gray-100 bg-white' }) => (
  <div className={`rounded-2xl border px-5 py-5 shadow-sm ${tone}`}>
    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{label}</p>
    <p className="mt-3 text-lg font-black text-gray-900">{value}</p>
    <p className="mt-2 text-sm font-medium text-gray-500">{hint}</p>
  </div>
);

const Wallet: React.FC = () => {
  const { user } = useAuth();
  const isEmployee = user?.role === UserRole.EMPLOYEE || user?.role === UserRole.EMPLOYEE1;
  const { data: walletSettings = { unitAmount: 0, countedStatuses: [] }, isPending: walletSettingsLoading } = useWalletSettings();
  const { data: myWallet, isPending: myWalletLoading } = useMyWallet();
  const { data: walletActivity = [], isPending: walletActivityLoading } = useWalletActivity(undefined, true, ['payout']);

  const loading = walletSettingsLoading || myWalletLoading || walletActivityLoading;

  const historyColumns = useMemo<TableColumn[]>(
    () => [
      {
        key: 'entryType',
        label: 'Type',
        render: (value: WalletActivityEntry['entryType']) => (
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${getEntryBadgeClass(value)}`}>
            {getEntryLabel(value)}
          </span>
        ),
      },
      {
        key: 'source',
        label: 'Source',
        render: (_value, item: WalletActivityEntry) => (
          <div>
            <p className="text-sm font-black text-gray-900">
              {item.orderNumber
                ? `Order #${item.orderNumber}`
                : item.accountName
                  ? item.accountName
                  : 'System'}
            </p>
            <p className="mt-1 text-xs font-medium text-gray-500">
              {item.paymentMethod || item.categoryName || item.note || '-'}
            </p>
          </div>
        ),
      },
      {
        key: 'amountDelta',
        label: 'Amount',
        align: 'right',
        render: (value: number) => (
          <span className={`text-sm font-black ${value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {value >= 0 ? '+' : '-'}{formatCurrency(Math.abs(value))}
          </span>
        ),
      },
      {
        key: 'createdAt',
        label: 'Date',
        render: (_value, item: WalletActivityEntry) => (
          <span className="text-sm font-medium text-gray-600">
            {formatTimestamp(item.paidAt || item.createdAt)}
          </span>
        ),
      },
      {
        key: 'by',
        label: 'By',
        render: (_value, item: WalletActivityEntry) => (
          <span className="text-sm font-medium text-gray-600">
            {item.paidByName || item.createdByName || 'System'}
          </span>
        ),
      },
      {
        key: 'note',
        label: 'Note',
        render: (value: string) => <span className="text-sm font-medium text-gray-600">{value || '-'}</span>,
      },
    ],
    []
  );

  if (!user) {
    return <div className="p-8 text-center text-gray-500">Loading wallet access...</div>;
  }

  if (!isEmployee) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Employee Only</p>
          <h2 className="mt-3 text-2xl font-black text-gray-900">Wallet is available to employees only.</h2>
          <p className="mt-2 text-sm font-medium text-gray-500">
            Admins manage payouts from the Payroll page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LoadingOverlay isLoading={loading} message="Loading wallet..." />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Wallet</h2>
          <p className="text-sm text-gray-500">
            Review your live wallet balance and your payment history.
          </p>
        </div>
        <div className="rounded-2xl border border-[#d6e3f0] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-gray-600">
          Current Unit Amount: <span className="font-black text-gray-900">{formatCurrency(walletSettings.unitAmount)}</span>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Wallet Balance"
          value={formatCurrency(myWallet?.currentBalance ?? 0)}
          hint="Your live cumulative wallet balance."
          tone="border-[#d6e3f0] bg-[#f8fbff]"
        />
        <SummaryCard
          label="Total Earned"
          value={formatCurrency(myWallet?.totalEarned ?? 0)}
          hint="Credits added from orders you created."
        />
        <SummaryCard
          label="Total Paid"
          value={formatCurrency(myWallet?.totalPaid ?? 0)}
          hint="Wallet payouts already settled to you."
        />
        <SummaryCard
          label="Credited Orders"
          value={`${myWallet?.creditedOrders ?? 0}`}
          hint="Orders that have credited your wallet."
        />
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-xl font-black text-gray-900">Payment History</h3>
            <p className="mt-1 text-sm font-medium text-gray-500">
              Payouts that admins have already settled to your wallet.
            </p>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            Private to your account
          </p>
        </div>

        <div className="mt-6">
          <Table
            columns={historyColumns}
            data={walletActivity}
            hover={false}
            size="sm"
            loading={walletActivityLoading}
            emptyMessage="No payment history found yet."
          />
        </div>
      </section>
    </div>
  );
};

export default Wallet;
