import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../db';
import { formatCurrency } from '../constants';
import { triggerPrintDialog } from '../src/utils/printUtils';
import { useOrder, useCustomer, useUsers, useProducts, useCompanySettings, useInvoiceSettings } from '../src/hooks/useQueries';
import { theme } from '../theme';

interface InvoiceContentProps {
  order: any;
  customer: any;
  products: any[];
  companySettings: any;
  invoiceSettings: any;
}

const InvoiceContent: React.FC<InvoiceContentProps> = ({
  order,
  customer,
  products,
  companySettings,
  invoiceSettings,
}) => {
  return (
    <div className="space-y-5 print:space-y-4 text-gray-900">
      {/* Invoice Header */}
          <div className="flex justify-between items-start">
            <div>
              {(companySettings?.logo || db.settings.company.logo) && (
                <img
                  src={companySettings?.logo || db.settings.company.logo}
                  className="rounded-lg object-cover mb-4"
                  style={{
                    width: invoiceSettings?.logoWidth || db.settings.invoice.logoWidth,
                    height: invoiceSettings?.logoHeight || db.settings.invoice.logoHeight,
                  }}
                  alt="Company Logo"
                />
              )}
              <h1 className={`text-xl font-black uppercase tracking-tighter`}>
                {companySettings?.name || db.settings.company.name}
              </h1>
              <div className="mt-2 text-xs text-gray-400 font-medium space-y-1 print:text-gray-600">
                <p>{companySettings?.address || db.settings.company.address}</p>
                <p>
                  {companySettings?.phone || db.settings.company.phone} •{' '}
                  {companySettings?.email || db.settings.company.email}
                </p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-black text-gray-300 uppercase leading-none mb-2 print:text-gray-400">
                {invoiceSettings?.title || db.settings.invoice.title}
              </h2>
              <div className="space-y-1.5 print:space-y-1">
                <p className="text-sm font-bold text-gray-900 print:text-gray-800">
                  <span className="text-gray-400 font-medium">Order No:&nbsp;&nbsp;</span>
                  {order.orderNumber}
                </p>
                <p className="text-sm font-bold text-gray-900 print:text-gray-800">
                  <span className="text-gray-400 font-medium">Date:&nbsp;&nbsp;</span>
                  {new Date(order.orderDate).toLocaleDateString('en-BD', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="grid grid-cols-2 gap-12 border-t border-gray-100 py-4 print:border-gray-300 print:py-3">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 print:mb-2">
                Billed To
              </p>
              <h3 className="text-md font-black text-gray-900 print:text-gray-800">{customer?.name}</h3>
              <p className="text-sm text-gray-500 leading-relaxed print:text-gray-600">{customer?.address}</p>
              <p className={`text-sm font-bold mt-2 print:mt-1`}>{customer?.phone}</p>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-left print:text-gray-800">
            <thead>
              <tr className="border-b-2 border-gray-100 print:border-gray-300">
                <th className="py-4 text-sm font-black text-gray-400 uppercase print:text-xs print:py-2">
                  Item Description
                </th>
                <th className="py-4 text-sm text-center font-black text-gray-400 uppercase print:text-xs print:py-2">
                  Rate
                </th>
                <th className="py-4 text-sm text-center font-black text-gray-400 uppercase print:text-xs print:py-2">
                  Qty
                </th>
                <th className="py-4 text-sm text-right font-black text-gray-400 uppercase print:text-xs print:py-2">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 print:divide-gray-300">
              {order.items.map((item, idx) => {
                const product = products.find(p => p.id === item.productId);
                return (
                  <tr key={idx} className="group">
                    <td className="py-6 print:py-3">
                      <div className="flex items-center gap-4">
                        <img
                          src={product?.image}
                          className="w-12 h-12 rounded-full object-cover border border-gray-100 shadow-sm print:w-10 print:h-10 print:rounded-full print:border-gray-300 print:shadow-none"
                          alt={item.productName}
                        />
                        <span className="font-bold text-gray-900 print:text-sm">{item.productName}</span>
                      </div>
                    </td>
                    <td className="py-6 text-center text-gray-500 font-bold print:py-3 print:text-sm">
                      {formatCurrency(item.rate)}
                    </td>
                    <td className="py-6 text-center text-gray-500 font-bold print:py-3 print:text-sm">
                      {item.quantity}
                    </td>
                    <td className="py-6 text-right font-black text-gray-900 print:py-3 print:text-sm">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Summary Section */}
          <div className="flex justify-end pt-6 print:pt-4">
            <div className="w-full max-w-xs space-y-4 print:space-y-2 print:text-sm">
              <div className="flex justify-between text-sm print:text-xs">
                <span className="text-gray-400 font-bold uppercase print:text-gray-600">Subtotal</span>
                <span className="font-bold text-gray-900 print:text-gray-800">{formatCurrency(order.subtotal)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-sm print:text-xs">
                  <span className="text-gray-400 font-bold uppercase print:text-gray-600">Discount</span>
                  <span className="font-bold text-red-500 print:text-red-600">-{formatCurrency(order.discount)}</span>
                </div>
              )}
              {order.shipping > 0 && (
                <div className="flex justify-between text-sm print:text-xs">
                  <span className="text-gray-400 font-bold uppercase print:text-gray-600">Shipping</span>
                  <span className="font-bold text-gray-900 print:text-gray-800">{formatCurrency(order.shipping)}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-6 border-t-2 border-[#0f2f57] print:py-3 print:border-t print:border-gray-400">
                <span className="font-black text-gray-900 uppercase tracking-tighter print:text-gray-800">
                  Net Total
                </span>
                <span className="font-black text-gray-900 print:text-gray-800">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Terms & Notes */}
          {order.notes && (
            <div className="bg-gray-50 p-4 rounded-[10px] border border-gray-100 print:bg-white print:p-3 print:rounded-lg print:border-gray-300">
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 print:text-gray-500 print:mb-1">
                Terms & Notes
              </p>
              <p className="text-xs text-gray-600 font-medium italic leading-relaxed print:text-gray-700">
                {order.notes}
              </p>
            </div>
          )}
    </div>
  );
};

const PrintOrder: React.FC = () => {
  const { id } = useParams();
  const { data: order, isPending: orderLoading } = useOrder(id || '');
  const { data: customer } = useCustomer(order ? order.customerId : undefined);
  const { data: users = [] } = useUsers();
  const { data: products = [] } = useProducts();
  const { data: companySettings } = useCompanySettings();
  const { data: invoiceSettings } = useInvoiceSettings();
  const printTriggeredRef = useRef(false);

  // `customer` provided by useCustomer above
  const createdByUser = order ? users.find(u => u.id === order.createdBy) : undefined;

  // Trigger print dialog when order data is loaded (only once)
  useEffect(() => {
    if (order && !orderLoading && !printTriggeredRef.current) {
      printTriggeredRef.current = true;
      triggerPrintDialog();
    }
  }, [order, orderLoading]);

  if (orderLoading || !order) {
    return <div className="p-8 text-center text-gray-500">Loading details...</div>;
  }

  return (
    <div className="min-h-screen bg-white print:bg-white">
      {/* Two-Invoice Stacked Layout (one below another) */}
      <div className="space-y-0 print:space-y-0">
        {/* Invoice 1 */}
        <div className="bg-white p-6 lg:p-10 print:p-6 min-h-screen print:min-h-fit">
          <InvoiceContent
            order={order}
            customer={customer}
            products={products}
            companySettings={companySettings}
            invoiceSettings={invoiceSettings}
          />
        </div>

        {/* Invoice 2 - Duplicate */}
        <div className="bg-white p-6 lg:p-10 print:p-6 min-h-screen print:min-h-fit" style={{ pageBreakBefore: 'always' }}>
          <InvoiceContent
            order={order}
            customer={customer}
            products={products}
            companySettings={companySettings}
            invoiceSettings={invoiceSettings}
          />
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          .no-print {
            display: none !important;
          }
          table {
            page-break-inside: avoid;
          }
          tr {
            page-break-inside: avoid;
          }
          @page {
            margin: 0.25in;
            size: A4;
          }
          .print\:page-break-avoid {
            page-break-inside: avoid;
          }
          .grid {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
};

export default PrintOrder;
