
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { Product, UserRole } from '../types';
import { formatCurrency, ICONS } from '../constants';
import { Button, Table, TableCell, IconButton } from '../components';
import { theme } from '../theme';

const Products: React.FC = () => {
  const navigate = useNavigate();
  const [products] = useState<Product[]>(db.products);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Items Catalog</h2>
          <p className="text-gray-500 text-sm">Manage your inventory and pricing</p>
        </div>
        <Button
          onClick={() => navigate('/products/new')}
          variant="primary"
          size="md"
          icon={ICONS.Plus}
        >
          Add Product
        </Button>
      </div>

      <Table
        columns={[
          {
            key: 'name',
            label: 'Name',
            render: (_, product) => (
              <div className="flex items-center gap-4">
                <img
                  src={product.image || 'https://via.placeholder.com/100'}
                  alt={product.name}
                  className="w-12 h-12 rounded-xl object-cover border border-gray-100 shadow-sm"
                />
                <div>
                  <p className="font-bold text-gray-900">{product.name}</p>
                  <p className="text-[10px] text-gray-400 font-mono">ID: {product.id}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'category',
            label: 'Category',
            render: (category) => (
              <span className={`px-2.5 py-1 bg-[#ebf4ff] ${theme.colors.primary[600]} rounded-lg text-[10px] font-black uppercase tracking-widest`}>
                {category}
              </span>
            ),
          },
          {
            key: 'salePrice',
            label: 'Sale & Purchase Price',
            render: (salePrice, product) => (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 w-8">SALE</span>
                  <span className={`text-sm font-bold ${theme.colors.primary[600]}`}>{formatCurrency(product.salePrice)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 w-8">PURCH</span>
                  <span className="text-sm font-bold text-gray-600">{formatCurrency(product.purchasePrice)}</span>
                </div>
              </div>
            ),
          },
          {
            key: 'id',
            label: 'Actions',
            align: 'right',
            render: (productId) => {
              const isAdmin = db.currentUser.role === UserRole.ADMIN;
              return isAdmin ? (
                <IconButton
                  icon={ICONS.Edit}
                  variant="primary"
                  title="Edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/products/edit/${productId}`);
                  }}
                />
              ) : null;
            },
          },
        ]}
        data={products}
        emptyMessage="No products found"
      />
    </div>
  );
};

export default Products;
