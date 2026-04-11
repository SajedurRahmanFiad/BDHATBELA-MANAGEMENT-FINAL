import React from 'react';
import TableLoadingSkeleton from './TableLoadingSkeleton';

interface ReportPageSkeletonProps {
  cards?: number;
  showChart?: boolean;
  showFilters?: boolean;
  tableColumns?: number;
  tableRows?: number;
}

const SkeletonBlock: React.FC<{ className: string }> = ({ className }) => (
  <div className={`animate-pulse rounded-2xl bg-gray-200/80 ${className}`} />
);

const ReportPageSkeleton: React.FC<ReportPageSkeletonProps> = ({
  cards = 3,
  showChart = true,
  showFilters = false,
  tableColumns = 0,
  tableRows = 5,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-10 w-10 rounded-xl" />
          <div className="space-y-3">
            <SkeletonBlock className="h-7 w-56" />
            <SkeletonBlock className="h-4 w-40" />
          </div>
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="h-10 w-28" />
          <SkeletonBlock className="h-10 w-32" />
        </div>
      </div>

      {showFilters && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <SkeletonBlock className="h-4 w-20" />
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-10 w-28" />
              ))}
            </div>
          </div>
        </div>
      )}

      {showChart && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="mt-6 h-[320px] w-full" />
          </div>
          <div className="space-y-6">
            {Array.from({ length: Math.max(cards, 2) }).map((_, index) => (
              <div key={index} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                <SkeletonBlock className="h-3 w-28" />
                <SkeletonBlock className="mt-4 h-7 w-32" />
                <SkeletonBlock className="mt-4 h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      )}

      {!showChart && cards > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: cards }).map((_, index) => (
            <div key={index} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <SkeletonBlock className="h-3 w-28" />
              <SkeletonBlock className="mt-4 h-7 w-32" />
              <SkeletonBlock className="mt-4 h-4 w-24" />
            </div>
          ))}
        </div>
      )}

      {tableColumns > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-6">
            <SkeletonBlock className="h-5 w-48" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody>
                <TableLoadingSkeleton columns={tableColumns} rows={tableRows} />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportPageSkeleton;
