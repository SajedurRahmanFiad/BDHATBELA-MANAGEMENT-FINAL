
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Order, OrderStatus, UserRole } from '../types';
import { formatCurrency, ICONS } from '../constants';
import { theme } from '../theme';
import { Button } from '../components';
import { useCustomer, useOrdersByCustomerId } from '../src/hooks/useQueries';
import { useCreateOrder } from '../src/hooks/useMutations';
import { useToastNotifications } from '../src/contexts/ToastContext';
import { db } from '../db';

const CustomerDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  
  // Get user role from current context
  const currentUser = db.currentUser;
  const userRole = currentUser?.role || null;
  
  // Query data
  const { data: customer } = useCustomer(id || '');
  const { data: customerOrders = [] } = useOrdersByCustomerId(id || '');
  
  // Mutations
  const createMutation = useCreateOrder();
  const toast = useToastNotifications();

  if (userRole === UserRole.EMPLOYEE) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
        <p className="text-gray-500 mb-6">Employees cannot view customer details. Contact an administrator for assistance.</p>
        <Button onClick={() => navigate('/customers')} variant="primary">Back to Customers</Button>
      </div>
    );
  }

  if (!customer) return <div className="p-8 text-center text-gray-500">Customer not found.</div>;

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.ON_HOLD: return 'bg-gray-100 text-gray-600';
      case OrderStatus.PROCESSING: return 'bg-[#e6f0ff] ${theme.colors.secondary[600]}';
      case OrderStatus.PICKED: return 'bg-purple-100 text-purple-600';
      case OrderStatus.COMPLETED: return 'bg-green-100 ${theme.colors.primary[600]}';
      case OrderStatus.CANCELLED: return 'bg-red-100 text-red-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const handleDuplicate = async (order: Order) => {
    try {
      if (!customer) return;
      
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' });

      const newOrder = {
        orderNumber: order.orderNumber,
        orderDate: new Date().toISOString().split('T')[0],
        customerId: customer.id,
        createdBy: order.createdBy,
        status: OrderStatus.ON_HOLD,
        items: order.items,
        subtotal: order.subtotal,
        discount: order.discount,
        shipping: order.shipping,
        total: order.total,
        paidAmount: 0,
        history: {
          created: `Duplicated from order #${order.orderNumber} on ${dateStr}, at ${timeStr}`
        }
      };

      await createMutation.mutateAsync(newOrder as any);
      navigate('/orders');
    } catch (error) {
      console.error('Failed to duplicate order', error);
      toast.error('Failed to duplicate order: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/customers')} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Customer Profile</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/customers/edit/${id}`)} className="px-4 py-2 border rounded-xl font-bold bg-white text-gray-700 hover:bg-gray-50">Edit Profile</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Profile Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 text-center">
            <div className="w-24 h-24 rounded-full bg-[#ebf4ff] ${theme.colors.primary[600]} flex items-center justify-center font-black text-4xl mx-auto mb-4 border-2 border-[#c7dff5]">
              {customer.name.charAt(0)}
            </div>
            <h3 className="text-xl font-bold text-gray-900">{customer.name}</h3>
            <p className="text-sm text-gray-400 mt-1">{customer.phone}</p>
            
            <div className="mt-6 pt-6 border-t border-gray-50 space-y-4 text-left">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Address</p>
                <p className="text-sm text-gray-700 font-medium leading-relaxed">{customer.address}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Revenue</p>
                <p className="text-lg font-black text-gray-900">{formatCurrency(customerOrders.reduce((s, o) => s + o.total, 0))}</p>
              </div>
            </div>
          </div>

          <div className={`bg-white p-6 rounded-lg shadow-lg shadow-[#0f2f57]/20/50 border border-gray-100 text-white`}>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Due Amount</p>
            <h4 className="text-lg font-black text-green-600">{formatCurrency(customer.dueAmount)}</h4>
          </div>
        </div>

        {/* Right Order List */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Order History</h3>
              <span className="text-xs font-bold text-gray-400">{customerOrders.length} Records found</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Order Number</th>
                    <th className="px-6 py-4">Order Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {customerOrders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">No orders found for this customer.</td>
                    </tr>
                  ) : (
                    customerOrders.map((order) => (
                      <tr 
                        key={order.id}
                        onMouseEnter={() => setHoveredRow(order.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                        onClick={() => navigate(`/orders/${order.id}`)}
                        className="group relative hover:bg-[#ebf4ff]/30 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="font-bold text-gray-900">#{order.orderNumber}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{order.orderDate}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-black text-gray-900">{formatCurrency(order.total)}</span>
                        </td>

                        {hoveredRow === order.id && (
                          <td className="absolute inset-y-0 right-0 flex items-center pr-6 bg-gradient-to-l from-emerald-50 via-emerald-50 to-transparent">
                            <div className="flex items-center gap-1 bg-white p-1 rounded-lg shadow-lg border border-[#c7dff5] animate-in fade-in slide-in-from-right-2 duration-200" onClick={e => e.stopPropagation()}>
                              <button title="Edit" onClick={() => navigate(`/orders/edit/${order.id}`)} className="p-2 text-gray-500 hover:${theme.colors.primary[600]} hover:bg-[#ebf4ff] rounded-md transition-colors">
                                {ICONS.Edit}
                              </button>
                              <button title="Duplicate" onClick={() => handleDuplicate(order)} className="p-2 text-gray-500 hover:${theme.colors.primary[600]} hover:bg-[#ebf4ff] rounded-md transition-colors">
                                {ICONS.Duplicate}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDetails;




