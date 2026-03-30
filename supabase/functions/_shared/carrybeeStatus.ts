const PICKED_OR_BEYOND_STATUSES = new Set([
  'at the sorting hub',
  'at central warehouse',
  'at the destination hub',
  'assigned for delivery',
  'out for delivery',
  'in transit',
  'on the way to central warehouse',
  'on the way to last mile hub',
  'received at last mile hub',
  'delivered',
  'exchange',
  'partial delivery',
  'return',
  'paid return',
]);

const NON_PICKED_STATUSES = new Set([
  'pending',
  'on hold',
  'pickup cancelled',
]);

export interface CarryBeeTransferStatusInfo {
  rawStatus: string;
  normalizedStatus: string;
  isPickedOrBeyond: boolean;
  isNonPicked: boolean;
  isKnown: boolean;
}

export function normalizeCarryBeeTransferStatus(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function extractCarryBeeTransferStatus(payload: any): string {
  const candidates = [
    payload?.data?.data?.transfer_status,
    payload?.data?.transfer_status,
    payload?.transfer_status,
  ];

  const match = candidates.find((candidate) => {
    if (candidate === null || candidate === undefined) return false;
    return String(candidate).trim() !== '';
  });

  return match ? String(match).trim() : '';
}

export function classifyCarryBeeTransferStatus(payload: any): CarryBeeTransferStatusInfo {
  const rawStatus = extractCarryBeeTransferStatus(payload);
  const normalizedStatus = normalizeCarryBeeTransferStatus(rawStatus);
  const isPickedOrBeyond = PICKED_OR_BEYOND_STATUSES.has(normalizedStatus);
  const isNonPicked = NON_PICKED_STATUSES.has(normalizedStatus);

  return {
    rawStatus,
    normalizedStatus,
    isPickedOrBeyond,
    isNonPicked,
    isKnown: isPickedOrBeyond || isNonPicked,
  };
}
