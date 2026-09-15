// components/ops-dashboard-web/src/resources/profile/userManagement/StaffUserTable.tsx
import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Box,
  Typography,
} from '@mui/material';
import { KeyRound, RefreshCw, UserPlus } from 'lucide-react';
import { httpClient } from '../../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../../dataProvider/endpoints.js';
import { RoleBadge } from '../../../layout/RoleBadge.js';
import { ResetPasswordModal } from './ResetPasswordModal.js';
import { CreateUserModal } from './CreateUserModal.js';
import { useCanAccess } from 'react-admin';
import { tokens } from '@scatterid/design-tokens';

export const StaffUserTable: React.FC = () => {
  const { canAccess: canResetAll } = useCanAccess({ resource: 'userManagement', action: 'reset-password-all' });
  const { canAccess: canResetClerk } = useCanAccess({ resource: 'userManagement', action: 'reset-password-clerk' });
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      if (canResetAll) {
        const res = await httpClient(ENDPOINTS.auth.users);
        setUsers(Array.isArray(res) ? res : res.users || []);
      } else {
        // Fallback for Mod: known clerk staff list
        setUsers([
          { id: 'usr-clerk-01', username: 'clerk_john', role: 'clerk', station_id: 'STATION-DESK-01' },
        ]);
      }
    } catch (err) {
      console.error('Failed to load staff users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [canResetAll]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.color.textMain }}>
          Authorized Operations Personnel ({users.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canResetAll && (
            <Button
              size="small"
              variant="contained"
              startIcon={<UserPlus size={14} />}
              onClick={() => setIsCreateModalOpen(true)}
              sx={{
                backgroundColor: tokens.color.brand500,
                color: '#ffffff !important',
                fontWeight: 700,
                '&:hover': { backgroundColor: tokens.color.brand700 },
              }}
            >
              Create Staff Account
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
            onClick={fetchUsers}
            disabled={loading}
            sx={{ borderColor: tokens.color.borderSubtle, color: tokens.color.textMain }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderColor: tokens.color.borderSubtle }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Station / Counter</TableCell>
              <TableCell align="right">Security Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map(u => {
              const canReset = canResetAll || (canResetClerk && u.role === 'clerk');
              return (
                <TableRow key={u.id || u.username} hover>
                  <TableCell sx={{ fontWeight: 700, color: tokens.color.textMain }}>
                    {u.username}
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={u.role} />
                  </TableCell>
                  <TableCell sx={{ color: tokens.color.textDim }}>
                    {u.station_id || 'Internal Center'}
                  </TableCell>
                  <TableCell align="right">
                    {canReset ? (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<KeyRound size={14} />}
                        onClick={() => setSelectedUser(u)}
                        sx={{ borderColor: tokens.color.borderSubtle, color: tokens.color.textMain }}
                      >
                        Reset Password
                      </Button>
                    ) : (
                      <Typography variant="caption" sx={{ color: tokens.color.textMuted }}>
                        No permission
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <ResetPasswordModal
        open={Boolean(selectedUser)}
        targetUser={selectedUser}
        onClose={() => setSelectedUser(null)}
        onSuccess={fetchUsers}
      />

      <CreateUserModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onUserCreated={fetchUsers}
      />
    </Box>
  );
};
