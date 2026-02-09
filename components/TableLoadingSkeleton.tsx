import React from 'react';

interface TableLoadingSkeletonProps {
  columns: number;
  rows?: number;
}

const TableLoadingSkeleton: React.FC<TableLoadingSkeletonProps> = ({ columns, rows = 5 }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => (
        <tr key={idx} className="border-b border-gray-50 animate-pulse">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <td key={colIdx} className="px-6 py-5">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              </div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export default TableLoadingSkeleton;
