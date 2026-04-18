import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ICONS } from '../constants';
import type { NotificationActionConfig, NotificationDecisionScope, NotificationRecipient } from '../types';
import { useNotificationById } from '../src/hooks/useQueries';
import { getPreservedRouteState } from '../src/utils/navigation';

const formatDateTime = (value?: string | null): string => {
  if (!value) return 'Not set';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';

  return date.toLocaleString('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const getActionLabel = (actionConfig?: NotificationActionConfig | null): string => {
  switch (actionConfig?.kind) {
    case 'link':
      return 'Link';
    case 'decision':
      return 'Decision';
    case 'link_and_decision':
      return 'Link + decision';
    default:
      return 'No action';
  }
};

const getDecisionScopeLabel = (scope?: NotificationDecisionScope): string => {
  if (scope === 'single_user') return 'One admin click is enough';
  if (scope === 'all_users') return 'Every admin must respond';
  return 'Not applicable';
};

const getRecipientStatus = (recipient: NotificationRecipient): { label: string; className: string } => {
  if (recipient.actionResult === 'accepted') {
    return { label: 'Accepted', className: 'bg-emerald-50 text-emerald-700' };
  }
  if (recipient.actionResult === 'declined') {
    return { label: 'Declined', className: 'bg-red-50 text-red-700' };
  }
  if (recipient.isRead) {
    return { label: 'Read', className: 'bg-blue-50 text-blue-700' };
  }
  return { label: 'Pending', className: 'bg-gray-100 text-gray-500' };
};

const NotificationDetail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error } = useNotificationById(id);
  const backState = getPreservedRouteState(location.state);

  const handleBack = () => {
    if (backState.backMode === 'history' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(backState.from || '/developer/notifications');
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl py-10 text-center text-sm font-medium text-gray-400">
        Loading notification details...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black text-gray-600 transition-all hover:border-[#c7dff5] hover:text-[#0f2f57]"
        >
          <span className="rotate-180">{ICONS.ChevronRight}</span>
          Back to history
        </button>
        <div className="rounded-[1.5rem] border border-red-100 bg-red-50 px-5 py-6 text-sm font-medium text-red-600">
          Failed to load notification details: {error?.message ?? 'Unknown error'}
        </div>
      </div>
    );
  }

  if (!data?.notification) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black text-gray-600 transition-all hover:border-[#c7dff5] hover:text-[#0f2f57]"
        >
          <span className="rotate-180">{ICONS.ChevronRight}</span>
          Back to history
        </button>
        <div className="rounded-[1.5rem] border border-gray-100 bg-white px-5 py-6 text-sm font-medium text-gray-500">
          Notification not found.
        </div>
      </div>
    );
  }

  const { notification, recipients, summary } = data;
  const actionConfig = notification.actionConfig || { kind: 'none' as const };
  const linkUrl = actionConfig.linkUrl?.trim();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black text-gray-600 transition-all hover:border-[#c7dff5] hover:text-[#0f2f57]"
      >
        <span className="rotate-180">{ICONS.ChevronRight}</span>
        Back to history
      </button>

      <section className="rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-5 border-b border-gray-100 pb-5 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Notification Detail</p>
            <h2 className="text-2xl font-black text-gray-900">{notification.subject}</h2>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[#e6f0ff] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#0f2f57]">
                {(notification.targetRoles || []).join(', ') || 'No roles'}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                {getActionLabel(actionConfig)}
              </span>
              <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                notification.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {notification.isActive ? 'Active' : 'Closed'}
              </span>
            </div>
            <div
                className="prose prose-sm mt-4 max-w-none pt-5 text-sm text-gray-600 [&_a]:font-bold [&_a]:text-[#0f2f57] [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: notification.contentHtml || '<p>No content.</p>' }}
              />
          </div>

          <div className="space-y-6">
            <section className="rounded-[1.5rem] border border-gray-100 bg-white p-5">
              <div className="mt-4 space-y-3 text-sm font-medium text-gray-600">
                <p><span className="font-black text-gray-900">Created by:</span> {notification.createdByName || 'System'}</p>
                <p><span className="font-black text-gray-900">Created at:</span> {formatDateTime(notification.createdAt)}</p>
                <p><span className="font-black text-gray-900">Decision scope:</span> {getDecisionScopeLabel(actionConfig.decisionScope)}</p>
                <p><span className="font-black text-gray-900">System generated:</span> {notification.isSystemGenerated ? 'Yes' : 'No'}</p>
                <p><span className="font-black text-gray-900">Link target:</span> {linkUrl || 'Not set'}</p>
              </div>
            </section>

            {notification.metadata && (
              <section className="rounded-[1.5rem] border border-gray-100 bg-white p-5">
                <h3 className="text-lg font-black text-gray-900">Metadata</h3>
                <pre className="mt-4 overflow-x-auto rounded-[1.25rem] bg-gray-950 px-4 py-4 text-xs leading-6 text-gray-100">
                  {JSON.stringify(notification.metadata, null, 2)}
                </pre>
              </section>
            )}

            {linkUrl && (
              <button
                type="button"
                onClick={() => {
                  if (/^https?:\/\//i.test(linkUrl)) {
                    window.open(linkUrl, '_blank', 'noopener,noreferrer');
                    return;
                  }
                  navigate(linkUrl);
                }}
                className="rounded-xl bg-[#0f2f57] px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-[#143b6d]"
              >
                {actionConfig.linkLabel || 'Open link'}
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="rounded-[1.25rem] border border-gray-100 bg-gray-50/80 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Recipients</p>
            <p className="mt-2 text-2xl font-black text-gray-900">{summary.recipientCount}</p>
          </div>
          <div className="rounded-[1.25rem] border border-gray-100 bg-gray-50/80 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Read</p>
            <p className="mt-2 text-2xl font-black text-gray-900">{summary.readCount}</p>
          </div>
          <div className="rounded-[1.25rem] border border-gray-100 bg-gray-50/80 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Acted</p>
            <p className="mt-2 text-2xl font-black text-gray-900">{summary.actedCount}</p>
          </div>
          <div className="rounded-[1.25rem] border border-gray-100 bg-gray-50/80 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Accepted / Declined</p>
            <p className="mt-2 text-2xl font-black text-gray-900">{summary.acceptedCount} / {summary.declinedCount}</p>
          </div>
        </div>

        <div className="mt-6">
          <section className="rounded-[1.5rem] border border-gray-100 bg-white p-5">
            <h3 className="text-lg font-black text-gray-900">Recipient Activity</h3>
            <p className="mt-1 text-sm text-gray-500">
              Every targeted user is listed below, including who read the notification and who clicked an action button.
            </p>

            <div className="mt-5 space-y-3">
              {recipients.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-gray-200 px-4 py-6 text-center text-sm font-medium text-gray-400">
                  No targeted users were found for this notification.
                </div>
              ) : (
                recipients.map((recipient) => {
                  const status = getRecipientStatus(recipient);
                  return (
                    <div
                      key={recipient.userId}
                      className="rounded-[1.25rem] border border-gray-100 bg-gray-50/70 px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-black text-gray-900">{recipient.userName || 'Unknown user'}</p>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                            {recipient.userRole || 'Unknown role'}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${status.className}`}>
                          {status.label}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-2 text-xs font-medium text-gray-500 sm:grid-cols-2">
                        <p>Read at: {formatDateTime(recipient.readAt)}</p>
                        <p>Action clicked: {recipient.actionResult || 'No action yet'}</p>
                        <p>Acted at: {formatDateTime(recipient.actedAt)}</p>
                        <p>User ID: {recipient.userId}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};

export default NotificationDetail;
