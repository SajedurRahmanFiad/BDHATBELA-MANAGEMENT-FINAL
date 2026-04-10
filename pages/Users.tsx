
import React, { useMemo, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { User, UserRole, hasAdminAccess } from '../types';
import { ICONS } from '../constants';
import { Button, Table, TableCell, IconButton } from '../components';
import { theme } from '../theme';
import { useAuth } from '../src/contexts/AuthProvider';
import { useUsers } from '../src/hooks/useQueries';
import { useUrlSyncedSearchQuery } from '../src/hooks/useUrlSyncedSearchQuery';
import { buildHistoryBackState } from '../src/utils/navigation';

type RoleFilter = 'All' | UserRole.ADMIN | UserRole.DEVELOPER | UserRole.EMPLOYEE | UserRole.EMPLOYEE1;

const Users: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const currentSearchParams = searchParams.toString();
  const { searchQuery } = useUrlSyncedSearchQuery(searchParams.get('search') || '');
  const roleFilter = (searchParams.get('role') as RoleFilter | null) || 'All';
  const { data: users = [], isPending: loading } = useUsers();
  const isAdmin = hasAdminAccess(user?.role);

  // Track location to detect browser back navigation
  const previousLocationRef = useRef<string>(location.pathname + location.search);
  const [isNavigatingViaHistory, setIsNavigatingViaHistory] = React.useState(false);

  React.useEffect(() => {
    const currentLocation = location.pathname + location.search;
    const prevLocation = previousLocationRef.current;

    // Detect back navigation: same pathname but different search params
    if (
      location.pathname === prevLocation.split('?')[0] &&
      currentLocation !== prevLocation &&
      location.search !== ''
    ) {
      setIsNavigatingViaHistory(true);
      const timer = setTimeout(() => setIsNavigatingViaHistory(false), 0);
      previousLocationRef.current = currentLocation;
      return () => clearTimeout(timer);
    }

    previousLocationRef.current = currentLocation;
  }, [location.pathname, location.search]);

  const handleRoleFilterChange = (filter: RoleFilter) => {
    const next = new URLSearchParams(searchParams);
    if (filter === 'All') {
      next.delete('role');
    } else {
      next.set('role', filter);
    }
    setSearchParams(next, { replace: true });
  };

  React.useEffect(() => {
    if (isNavigatingViaHistory) return;

    const params: Record<string, string> = {};
    if (searchQuery) params.search = searchQuery;
    if (roleFilter !== 'All') params.role = roleFilter;

    if (new URLSearchParams(params).toString() !== currentSearchParams) {
      setSearchParams(params, { replace: true });
    }
  }, [searchQuery, roleFilter, currentSearchParams, setSearchParams, isNavigatingViaHistory]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return users.filter((candidate) => {
      if (roleFilter !== 'All' && candidate.role !== roleFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        candidate.name.toLowerCase().includes(query) ||
        candidate.phone.includes(query) ||
        candidate.role.toLowerCase().includes(query)
      );
    });
  }, [users, searchQuery, roleFilter]);

  const roleBadgeClass = (role: UserRole) => {
    if (hasAdminAccess(role)) {
      return 'bg-purple-100 text-purple-700';
    }
    return 'bg-blue-100 text-blue-700';
  };

  const roleFilters: RoleFilter[] = ['All', UserRole.ADMIN, UserRole.DEVELOPER, UserRole.EMPLOYEE, UserRole.EMPLOYEE1];

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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {roleFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => handleRoleFilterChange(filter)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                roleFilter === filter
                  ? `${theme.colors.primary[600]} text-white shadow-md`
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
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
                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${roleBadgeClass(role as UserRole)}`}
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
