import React from 'react';

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  disabled?: boolean;
}

const Pagination: React.FC<Props> = ({ page, totalPages, onPageChange, disabled }) => {
  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-sm text-gray-600">
        {`Page ${page} of ${totalPages}`}
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className={`px-3 py-1 rounded-md font-bold ${page <= 1 ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 border'}`}
        >
          Prev
        </button>
        <div className="px-3 py-1 text-sm">{page} / {totalPages}</div>
        <button
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className={`px-3 py-1 rounded-md font-bold ${page >= totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 border'}`}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Pagination;
