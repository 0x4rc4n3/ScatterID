// components/ops-dashboard-web/src/resources/overview/RecentActivityTable.tsx
import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
  Box,
} from '@mui/material';
import { tokens } from '@scatterid/design-tokens';

interface ActivityItem {
  id: string | number;
  action: string;
  status: string;
  username?: string;
  created_at: string;
}

interface RecentActivityTableProps {
  items: ActivityItem[];
  loading?: boolean;
}

export const RecentActivityTable: React.FC<RecentActivityTableProps> = ({ items, loading = false }) => {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderColor: tokens.color.borderLight, backgroundColor: tokens.color.white, boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: tokens.color.borderLight, backgroundColor: tokens.color.slate50 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: tokens.color.slate800 }}>
          Recent Cryptographic & Operational Audit Events
        </Typography>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Timestamp</TableCell>
            <TableCell>Action</TableCell>
            <TableCell>Actor</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} align="center" sx={{ py: 3, color: tokens.color.slate500 }}>
                {loading ? 'Loading audit records...' : 'No recent audit events recorded'}
              </TableCell>
            </TableRow>
          ) : (
            items.slice(0, 8).map(item => (
              <TableRow key={item.id} hover>
                <TableCell sx={{ color: tokens.color.slate500, fontSize: '0.8125rem' }}>
                  {new Date(item.created_at).toLocaleString()}
                </TableCell>
                <TableCell sx={{ color: tokens.color.slate800, fontWeight: 600, fontSize: '0.8125rem' }}>
                  {item.action}
                </TableCell>
                <TableCell sx={{ color: tokens.color.slate500, fontSize: '0.8125rem' }}>
                  {item.username || 'System'}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={item.status}
                    sx={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor:
                        item.status === 'SUCCESS'
                          ? tokens.color.approve
                          : item.status === 'DENIED' || item.status === 'ALERT'
                          ? tokens.color.reject
                          : tokens.color.slate100,
                      color:
                        item.status === 'SUCCESS' || item.status === 'DENIED' || item.status === 'ALERT'
                          ? tokens.color.white
                          : tokens.color.slate700,
                    }}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
