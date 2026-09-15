// components/ops-dashboard-web/src/resources/credentials/CredentialList.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Button,
} from '@mui/material';
import { Eye, RefreshCw } from 'lucide-react';
import { httpClient } from '../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../dataProvider/endpoints.js';
import { CredentialFilters } from './CredentialFilters.js';
import { StatusBadge } from './StatusBadge.js';
import { CredentialDetailDrawer } from './CredentialDetailDrawer.js';
import { CredentialRecord } from '../../types/credential.js';
import { tokens } from '@scatterid/design-tokens';

export const CredentialList: React.FC = () => {
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCred, setSelectedCred] = useState<CredentialRecord | null>(null);

  const fetchCredentials = async () => {
    try {
      setLoading(true);
      const res = await httpClient(ENDPOINTS.requests.credentialsList);
      setCredentials(res.credentials || []);
    } catch (err) {
      console.error('Failed to load credentials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const filtered = useMemo(() => {
    return credentials.filter(item => {
      const matchesStatus =
        statusFilter === 'all' ||
        item.status?.toLowerCase() === statusFilter.toLowerCase();
      const term = search.toLowerCase().trim();
      const matchesSearch =
        !term ||
        item.id?.toLowerCase().includes(term) ||
        item.subject?.toLowerCase().includes(term) ||
        item.title?.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [credentials, statusFilter, search]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: tokens.color.slate800 }}>
            Identity Credentials Registry
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.color.slate500 }}>
            Cryptographically anchored credentials and revocation statuses on Hyperledger Fabric
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
          onClick={fetchCredentials}
          disabled={loading}
          sx={{ borderColor: tokens.color.borderLight, color: tokens.color.slate700, '&:hover': { borderColor: tokens.color.brand500 } }}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>

      <CredentialFilters
        search={search}
        onSearchChange={setSearch}
        status={statusFilter}
        onStatusChange={setStatusFilter}
      />

      <TableContainer component={Paper} variant="outlined" sx={{ borderColor: tokens.color.borderLight, backgroundColor: tokens.color.white }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Credential ID</TableCell>
              <TableCell>Subject / Title</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Channel</TableCell>
              <TableCell>Anchor Tx</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: tokens.color.slate500 }}>
                  {loading ? 'Loading credentials...' : 'No credentials match the current filter criteria'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(item => (
                <TableRow key={item.id} hover>
                  <TableCell sx={{ fontFamily: tokens.font.mono, color: tokens.color.brand700, fontWeight: 700 }}>
                    {item.id}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.color.slate800 }}>
                      {item.subject}
                    </Typography>
                    <Typography variant="caption" sx={{ color: tokens.color.slate500 }}>
                      {item.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell sx={{ color: tokens.color.slate700, fontSize: '0.85rem' }}>
                    In-Person Verified + Scan
                  </TableCell>
                  <TableCell sx={{ fontFamily: tokens.font.mono, color: tokens.color.slate500, fontSize: '0.75rem' }}>
                    {item.execution_tx_id || 'genesis'}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => setSelectedCred(item)}
                      sx={{ color: tokens.color.brand500 }}
                    >
                      <Eye size={18} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <CredentialDetailDrawer
        open={Boolean(selectedCred)}
        credential={selectedCred}
        onClose={() => setSelectedCred(null)}
      />
    </Box>
  );
};
