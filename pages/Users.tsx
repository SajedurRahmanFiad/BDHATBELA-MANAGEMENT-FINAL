
import React, { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { User, UserRole } from '../types';
import { ICONS } from '../constants';
import { Button, Table, TableCell, IconButton } from '../components';
import { theme } from '../theme';
import { useAuth } from '../src/contexts/AuthProvider';
import { useUsers } from '../src/hooks/useQueries';
import { useUrlSyncedSearchQuery } from '../src/hooks/useUrlSyncedSearchQuery';
import { buildHistoryBackState } from '../src/utils/navigation';

const Users: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const currentSearchParams = searchParams.toString();
  const { searchQuery } = useUrlSyncedSearchQuery(searchParams.get('search') || '');
  const { data: users = [], isPending: loading } = useUsers();
  const isAdmin = user?.role === UserRole.ADMIN;

  React.useEffect(() => {
    const params: Record<string, string> = {};
    if (searchQuery) params.search = searchQuery;

    if (new URLSearchParams(params).toString() !== currentSearchParams) {
      setSearchParams(params, { replace: true });
    }
  }, [searchQuery, currentSearchParams, setSearchParams]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) {
      return users;
    }
    
    const query = searchQuery.toLowerCase();
    return users.filter(user => 
      user.name.toLowerCase().includes(query) ||
      user.phone.includes(query) ||
      user.role.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Application Users</h2>
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
        data={filteredUsers}
        onRowClick={(user) => navigate(`/users/${user.id}`, { state: buildHistoryBackState(location) })}
        emptyMessage="No users found"
        loading={loading}
      />
    </div>
  );
};

export default Users;
