import React, { useState } from 'react';
import { theme } from '../theme';
import type { Order, Customer } from '../types';
import { useCourierSettings } from '../src/hooks/useQueries';
import { submitSteadfastOrder } from '../src/services/supabaseQueries';

interface SteadfastModalProps {
  isOpen: boolean;
  onClose: () => void;
  order?: Order | null;
  customer?: Customer | null;
}

export const SteadfastModal: React.FC<SteadfastModalProps> = ({ isOpen, onClose, order, customer }) => {
  const { data: courierSettings } = useCourierSettings();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setError(null);

    if (!order || !customer) {
      setError('Missing order or customer information');
      console.error('[SteadfastModal] Missing order, customer information');
      return;
    }

    if (!courierSettings?.steadfast) {
      setError('No Steadfast credentials configured');
      console.error('[SteadfastModal] No Steadfast settings');
      return;
    }

    const { baseUrl, apiKey, secretKey } = courierSettings.steadfast;

    // Detailed logging for debugging
    console.log('[SteadfastModal] ======== SUBMISSION DEBUG ========');
    console.log('[SteadfastModal] courierSettings object:', courierSettings);
    console.log('[SteadfastModal] steadfast object:', courierSettings.steadfast);
    console.log('[SteadfastModal] baseUrl:', baseUrl);
    console.log('[SteadfastModal] baseUrl type:', typeof baseUrl);
    console.log('[SteadfastModal] baseUrl empty?:', baseUrl === '' || !baseUrl);
    console.log('[SteadfastModal] baseUrl trimmed empty?:', (baseUrl || '').trim() === '');
    console.log('[SteadfastModal] apiKey:', apiKey ? `${apiKey.substring(0, 5)}...` : 'EMPTY/NULL');
    console.log('[SteadfastModal] apiKey type:', typeof apiKey);
    console.log('[SteadfastModal] secretKey:', secretKey ? `${secretKey.substring(0, 5)}...` : 'EMPTY/NULL');
    console.log('[SteadfastModal] secretKey type:', typeof secretKey);

    if (!baseUrl || !apiKey || !secretKey) {
      setError(`Incomplete Steadfast credentials - baseUrl: ${!!baseUrl}, apiKey: ${!!apiKey}, secretKey: ${!!secretKey}`);
      console.error('[SteadfastModal] Incomplete credentials');
      console.error('[SteadfastModal] baseUrl value:', JSON.stringify(baseUrl));
      console.error('[SteadfastModal] apiKey value:', JSON.stringify(apiKey));
      console.error('[SteadfastModal] secretKey value:', JSON.stringify(secretKey));
      return;
    }

    setSubmitting(true);
    try {
      console.log('[SteadfastModal] ======== PREPARING SUBMISSION ========');
      console.log('[SteadfastModal] Order Number:', order.orderNumber);
      console.log('[SteadfastModal] Customer Name:', customer.name);
      console.log('[SteadfastModal] Customer Phone:', customer.phone);
      console.log('[SteadfastModal] Customer Address:', customer.address);
      console.log('[SteadfastModal] Order Total:', order.total);

    const result = await submitSteadfastOrder({
        baseUrl,
        apiKey,
        secretKey,
        invoice: order.orderNumber,
        recipientName: customer.name,
        recipientPhone: customer.phone,
        recipientAddress: customer.address,
        codAmount: order.total,
      });

      console.log('[SteadfastModal] ======== SUBMISSION RESULT ========');
      console.log('[SteadfastModal] Result:', result);

      if (result.error) {
        // Try to parse detailed error info
        let displayError = result.error;
        try {
          if (result.error.includes('Account is not active')) {
            displayError = 'Something went wrong.';
          }
        } catch (e) {
          // Use original error if parsing fails
        }
        setError(displayError);
        console.error('[SteadfastModal] Submission failed:', result.error);
        return;
      }

      console.log('[SteadfastModal] Order submitted successfully to Steadfast');
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('[SteadfastModal] Exception during submission:', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={`${theme.card.elevated} w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300`}>
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900">Add to Steadfast</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
          </div>
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <p className="font-semibold">Error:</p>
                <p>{error}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Order Number</label>
              <p className="text-gray-900">{order?.orderNumber || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Customer Name</label>
              <p className="text-gray-900">{customer?.name || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Customer Phone</label>
              <p className="text-gray-900">{customer?.phone || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Customer Address</label>
              <p className="text-gray-900">{customer?.address || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">COD Amount</label>
              <p className="text-lg font-bold text-gray-900">৳ {order?.total?.toFixed(2) || '0.00'}</p>
            </div>
          </div>
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
            <button 
              onClick={onClose} 
              disabled={submitting}
              className="flex-1 py-2 px-4 rounded-lg border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button 
              onClick={handleSubmit}
              disabled={submitting || !order || !customer}
              className="flex-1 py-2 px-4 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SteadfastModal;
