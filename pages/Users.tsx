
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { User, UserRole } from '../types';
import { ICONS } from '../constants';
import { Button, Table, TableCell, IconButton } from '../components';
import { theme } from '../theme';

const Users: React.FC = () => {
  const navigate = useNavigate();
  const [users] = useState<User[]>(db.users);
  const isAdmin = db.currentUser.role === UserRole.ADMIN;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Application Users</h2>
          <p className="text-gray-500 text-sm">Manage staff accounts and system permissions</p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => navigate('/users/new')}
            variant="primary"
            size="md"
            icon={ICONS.Plus}
          >
            Add User
          </Button>
        )}
      </div>

      <Table
        columns={[
          {
            key: 'name',
            label: 'User',
            render: (_, user) => (
              <div className="flex items-center gap-4">
                <img
                  src={user.image || 'https://picsum.photos/100/100?random=' + user.id}
                  className="w-10 h-10 rounded-full object-cover border"
                />
                <span className="font-bold text-gray-900">{user.name}</span>
              </div>
            ),
          },
          {
            key: 'role',
            label: 'Role',
            render: (role) => (
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  role === UserRole.ADMIN ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}
              >
                {role}
              </span>
            ),
          },
          {
            key: 'phone',
            label: 'Contact',
            render: (phone) => <span className="text-sm text-gray-600">{phone}</span>,
          },
          {
            key: 'id',
            label: 'Actions',
            align: 'right',
            render: (userId) => (
              <IconButton
                icon={ICONS.Edit}
                variant="primary"
                title="Edit"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/users/edit/${userId}`);
                }}
              />
            ),
          },
        ]}
        data={users}
        onRowClick={(user) => navigate(`/users/${user.id}`)}
        emptyMessage="No users found"
      />
    </div>
  );
};

export default Users;
