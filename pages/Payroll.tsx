import React, { useEffect, useMemo, useState } from 'react';
import { Button, LoadingOverlay, Modal, Table } from '../components';
import type { TableColumn } from '../components/Table';
import { ICONS, formatCurrency } from '../constants';
import Pagination from '../src/components/Pagination';
import { UserRole, type WalletActivityEntry, type WalletBalanceCard } from '../types';
import { useAuth } from '../src/contexts/AuthProvider';
import { useToastNotifications } from '../src/contexts/ToastContext';
import { DEFAULT_PAGE_SIZE } from '../src/services/supabaseQueries';
import { usePayEmployeeWallet } from '../src/hooks/useMutations';
import {
  useAccounts,
  useCategories,
  useEmployeeWalletCards,
  usePaymentMethods,
  useSystemDefaults,
  useWalletActivityPage,
  useWalletSettings,
} from '../src/hooks/useQueries';

const getTodayValue = (): string => new Date().toISOString().slice(0, 10);

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

const MetricCard: React.FC<{
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

const WalletCard: React.FC<{
  card: WalletBalanceCard;
  onPay: (card: WalletBalanceCard) => void;
}> = ({ card, onPay }) => (
  <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-black text-gray-900">{card.employeeName}</h3>
          <span className="rounded-full bg-[#dfeaf7] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#0f2f57]">
            {card.employeeRole}
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="primary"
        size="sm"
        icon={ICONS.Payroll}
        disabled={card.currentBalance <= 0}
        onClick={() => onPay(card)}
      >
        Pay
      </Button>
    </div>

    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-2">
      <div className="rounded-xl border border-[#d6e3f0] bg-[#f8fbff] px-4 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Wallet Balance</p>
        <p className="mt-2 text-lg font-black text-gray-900">{formatCurrency(card.currentBalance)}</p>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white px-4 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Credited Orders</p>
        <p className="mt-2 text-lg font-black text-gray-900">{card.creditedOrders}</p>
      </div>
    </div>
  </div>
);

type PayoutFormState = {
  amount: string;
  accountId: string;
  paymentMethod: string;
  categoryId: string;
  paidAt: string;
  note: string;
};

const Payroll: React.FC = () => {
  const { user } = useAuth();
  const toast = useToastNotifications();
  const payEmployeeWalletMutation = usePayEmployeeWallet();
  const [selectedCard, setSelectedCard] = useState<WalletBalanceCard | null>(null);
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [payoutForm, setPayoutForm] = useState<PayoutFormState>({
    amount: '',
    accountId: '',
    paymentMethod: '',
    categoryId: '',
    paidAt: getTodayValue(),
    note: '',
  });

  const isAdmin = user?.role === UserRole.ADMIN;
  const { data: walletSettings = { unitAmount: 0, countedStatuses: [] }, isPending: walletSettingsLoading } = useWalletSettings();
  const { data: walletCards = [], isPending: walletCardsLoading } = useEmployeeWalletCards(isAdmin);
  const { data: accounts = [], isPending: accountsLoading } = useAccounts();
  const { data: paymentMethods = [], isPending: paymentMethodsLoading } = usePaymentMethods();
  const { data: categories = [], isPending: categoriesLoading } = useCategories();
  const { data: systemDefaults, isPending: defaultsLoading } = useSystemDefaults();
  const historyPageSize = systemDefaults?.recordsPerPage || DEFAULT_PAGE_SIZE;
  const { data: walletActivityPage = { data: [], count: 0 }, isPending: walletActivityLoading } = useWalletActivityPage(
    historyPage,
    historyPageSize,
    {
      enabled: isAdmin,
      entryTypes: ['payout'],
    }
  );
  const walletActivity = walletActivityPage.data;
  const walletActivityTotal = walletActivityPage.count;
  const walletActivityTotalPages = Math.max(1, Math.ceil(walletActivityTotal / historyPageSize));

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'Expense'),
    [categories]
  );

  useEffect(() => {
    if (!selectedCard) return;

    setPayoutForm({
      amount: selectedCard.currentBalance > 0 ? String(selectedCard.currentBalance) : '',
      accountId: systemDefaults?.defaultAccountId || accounts[0]?.id || '',
      paymentMethod: systemDefaults?.defaultPaymentMethod || paymentMethods[0]?.name || '',
      categoryId: systemDefaults?.expenseCategoryId || expenseCategories[0]?.id || '',
      paidAt: getTodayValue(),
      note: '',
    });
  }, [selectedCard, systemDefaults, accounts, paymentMethods, expenseCategories]);

  useEffect(() => {
    if (historyPage > walletActivityTotalPages) {
      setHistoryPage(walletActivityTotalPages);
    }
  }, [historyPage, walletActivityTotalPages]);

  const loading = walletSettingsLoading
    || walletCardsLoading
    || walletActivityLoading
    || accountsLoading
    || paymentMethodsLoading
    || categoriesLoading
    || defaultsLoading;

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === payoutForm.accountId) || null,
    [accounts, payoutForm.accountId]
  );

  const summary = useMemo(
    () =>
      walletCards.reduce(
        (acc, card) => {
          acc.totalBalance += card.currentBalance;
          acc.totalEarned += card.totalEarned;
          acc.totalPaid += card.totalPaid;
          if (card.currentBalance > 0) acc.employeesDue += 1;
          return acc;
        },
        {
          totalBalance: 0,
          totalEarned: 0,
          totalPaid: 0,
          employeesDue: 0,
        }
      ),
    [walletCards]
  );

  const historyColumns = useMemo<TableColumn[]>(
    () => [
      {
        key: 'employeeName',
        label: 'Employee',
        render: (_value, item: WalletActivityEntry) => (
          <div>
            <p className="text-sm font-black text-gray-900">{item.employeeName || 'Unknown Employee'}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
              {item.employeeRole || 'Employee'}
            </p>
          </div>
        ),
      },
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
        key: 'actor',
        label: 'By',
        render: (_value, item: WalletActivityEntry) => (
          <span className="text-sm font-medium text-gray-600">
            {item.paidByName || item.createdByName || 'System'}
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
        key: 'note',
        label: 'Note',
        render: (value: string) => <span className="text-sm font-medium text-gray-600">{value || '-'}</span>,
      },
    ],
    []
  );

  const handleOpenPayout = (card: WalletBalanceCard) => {
    setSelectedCard(card);
  };

  const handleClosePayout = () => {
    setSelectedCard(null);
    setPayoutForm({
      amount: '',
      accountId: '',
      paymentMethod: '',
      categoryId: '',
      paidAt: getTodayValue(),
      note: '',
    });
  };

  const handleConfirmPayout = async () => {
    if (!selectedCard) return;

    const amount = Number.parseFloat(payoutForm.amount || '0') || 0;
    if (amount <= 0) {
      toast.warning('Enter a payout amount greater than zero.');
      return;
    }
    if (amount > selectedCard.currentBalance) {
      toast.warning('Payout amount cannot exceed the wallet balance.');
      return;
    }
    if (!payoutForm.accountId || !payoutForm.paymentMethod || !payoutForm.categoryId || !payoutForm.paidAt) {
      toast.warning('Complete the payout form before continuing.');
      return;
    }
    if (selectedAccount && amount > selectedAccount.currentBalance) {
      toast.warning('The selected account does not have enough balance.');
      return;
    }

    const toastId = toast.loading(`Paying ${selectedCard.employeeName} from wallet...`);

    try {
      await payEmployeeWalletMutation.mutateAsync({
        employeeId: selectedCard.employeeId,
        amount,
        accountId: payoutForm.accountId,
        paymentMethod: payoutForm.paymentMethod,
        categoryId: payoutForm.categoryId,
        paidAt: payoutForm.paidAt,
        note: payoutForm.note,
      });

      toast.update(toastId, 'Wallet payout recorded successfully.', 'success');
      handleClosePayout();
    } catch (error) {
      toast.update(
        toastId,
        error instanceof Error ? error.message : 'Failed to record wallet payout.',
        'error'
      );
    }
  };

  if (!user) {
    return <div className="p-8 text-center text-gray-500">Loading payroll access...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Admin Only</p>
          <h2 className="mt-3 text-2xl font-black text-gray-900">Payroll is available to administrators only.</h2>
          <p className="mt-2 text-sm font-medium text-gray-500">
            Employees use the Wallet page to review their own balance and wallet history.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LoadingOverlay isLoading={loading || payEmployeeWalletMutation.isPending} message="Loading wallet data..." />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payroll</h2>
        </div>
        <div className="rounded-2xl border border-[#d6e3f0] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-gray-600">
          Unit Amount: <span className="font-black text-gray-900">{formatCurrency(walletSettings.unitAmount)}</span>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
        <MetricCard
          label="Outstanding Wallets"
          value={formatCurrency(summary.totalBalance)}
          hint="Combined wallet balance across all employees."
          tone="border-[#d6e3f0] bg-[#f8fbff]"
        />
        <MetricCard
          label="Employees Due"
          value={`${summary.employeesDue}`}
          hint="Employees with a wallet balance greater than zero."
        />
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-xl font-black text-gray-900">Employee Wallets</h3>
            <p className="mt-1 text-sm font-medium text-gray-500">
              Each new employee-created order adds the current unit amount directly to that employee wallet.
            </p>
          </div>
        </div>

        {walletCards.length === 0 ? (
          <div className="mt-6 rounded-[22px] border border-dashed border-gray-200 bg-gray-50 px-6 py-14 text-center text-sm font-medium text-gray-400">
            No employee wallets are available yet.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {walletCards.map((card) => (
              <WalletCard key={card.employeeId} card={card} onPay={handleOpenPayout} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-xl font-black text-gray-900">Payment History</h3>
            <p className="mt-1 text-sm font-medium text-gray-500">
              Admin-only payout history for payments already settled to employees.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <Table
            columns={historyColumns}
            data={walletActivity}
            hover={false}
            size="sm"
            loading={walletActivityLoading}
            emptyMessage="No employee payment history found yet."
          />
        </div>

        <Pagination
          page={historyPage}
          totalPages={walletActivityTotalPages}
          onPageChange={setHistoryPage}
          disabled={walletActivityLoading}
        />
      </section>

      <Modal
        isOpen={!!selectedCard}
        onClose={handleClosePayout}
        title="Pay Employee Wallet"
        size="lg"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={handleClosePayout}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleConfirmPayout}
              loading={payEmployeeWalletMutation.isPending}
              disabled={!selectedCard}
            >
              Create Payout
            </Button>
          </>
        }
      >
        {selectedCard && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#d6e3f0] bg-[#f8fbff] px-5 py-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Employee</p>
              <p className="mt-2 text-lg font-black text-gray-900">{selectedCard.employeeName}</p>
              <p className="mt-1 text-sm font-medium text-gray-500">
                Wallet balance {formatCurrency(selectedCard.currentBalance)}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Amount</label>
                <input
                  type="number"
                  min="0"
                  max={selectedCard.currentBalance}
                  step="1"
                  value={payoutForm.amount}
                  onChange={(event) => setPayoutForm((current) => ({ ...current, amount: event.target.value }))}
                  className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#3c5a82]"
                />
                <p className="text-xs font-medium text-gray-400">
                  Any amount up to {formatCurrency(selectedCard.currentBalance)}.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Payment Date</label>
                <input
                  type="date"
                  value={payoutForm.paidAt}
                  onChange={(event) => setPayoutForm((current) => ({ ...current, paidAt: event.target.value }))}
                  className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#3c5a82]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Account</label>
                <select
                  value={payoutForm.accountId}
                  onChange={(event) => setPayoutForm((current) => ({ ...current, accountId: event.target.value }))}
                  className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#3c5a82]"
                >
                  <option value="">Select an account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs font-medium text-gray-400">
                  {selectedAccount ? `Available balance ${formatCurrency(selectedAccount.currentBalance)}` : 'Choose the account that will fund this payout.'}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Payment Method</label>
                <select
                  value={payoutForm.paymentMethod}
                  onChange={(event) => setPayoutForm((current) => ({ ...current, paymentMethod: event.target.value }))}
                  className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#3c5a82]"
                >
                  <option value="">Select a payment method</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.name}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Expense Category</label>
                <select
                  value={payoutForm.categoryId}
                  onChange={(event) => setPayoutForm((current) => ({ ...current, categoryId: event.target.value }))}
                  className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#3c5a82]"
                >
                  <option value="">Select an expense category</option>
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Optional Note</label>
              <textarea
                value={payoutForm.note}
                onChange={(event) => setPayoutForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Add a note for the wallet history..."
                className="min-h-[110px] w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#3c5a82]"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Payroll;
