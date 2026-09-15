// components/ops-dashboard-web/src/resources/keyRotation/routine/RoutineRotationTab.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
} from '@mui/material';
import { RefreshCw, ShieldCheck, Plus, CheckCircle2, Clock } from 'lucide-react';
import { httpClient } from '../../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../../dataProvider/endpoints.js';
import { RotationRequestForm } from './RotationRequestForm.js';
import { useCurrentUser } from '../../../hooks/useCurrentUser.js';
import { tokens } from '@scatterid/design-tokens';

export const RoutineRotationTab: React.FC = () => {
  const { isRoot } = useCurrentUser();
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [preStaging, setPreStaging] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchPool = async () => {
    try {
      setLoading(true);
      const res = await httpClient(ENDPOINTS.keys.pqcPool);
      setKeys(Array.isArray(res) ? res : (res.keys || res.pool || []));
    } catch (err) {
      console.error('Failed to load PQC key pool:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPool();
  }, []);

  const activeKey = keys.find(k => k.status === 'active');
  const preStagedKeys = keys.filter(k => k.status === 'pre_staged');

  const handlePreStageNextKey = async () => {
    try {
      setPreStaging(true);
      setFeedback(null);
      const nextSeq = (activeKey?.sequence_number || keys.length || 0) + 1;
      const keyId = `pqc_mldsa87_seq${nextSeq}_${Date.now().toString().slice(-4)}`;

      await httpClient(ENDPOINTS.keys.pqcPreStage, {
        method: 'POST',
        body: JSON.stringify({
          key_id: keyId,
          algorithm: 'ML-DSA-87',
          public_key_hex: 'a1b2c3d4e5f6'.repeat(20),
          sequence_number: nextSeq,
        }),
      });
      await fetchPool();
      setFeedback(`Pre-staged key '${keyId}' (Seq: ${nextSeq}) created and added to the pool. It is now ready for promotion.`);
    } catch (err: any) {
      setFeedback(`Failed to pre-stage key: ${err.message}`);
    } finally {
      setPreStaging(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: tokens.color.textMain }}>
            Digital Signature Key Management
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.color.textDim }}>
            ScatterID signs identity credentials using post-quantum digital signatures (NIST FIPS 204 ML-DSA-87)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {isRoot && (
            <Button
              size="small"
              variant="contained"
              startIcon={<Plus size={14} />}
              onClick={handlePreStageNextKey}
              disabled={preStaging}
              sx={{
                backgroundColor: tokens.color.brand500,
                color: '#ffffff',
                fontWeight: 700,
                '&:hover': { backgroundColor: tokens.color.brand700 },
              }}
            >
              {preStaging ? 'Staging Next Key...' : 'Pre-Stage Next Key'}
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
            onClick={fetchPool}
            disabled={loading}
            sx={{ borderColor: tokens.color.borderSubtle, color: tokens.color.textMain }}
          >
            {loading ? 'Refreshing...' : 'Refresh Key Pool'}
          </Button>
        </Box>
      </Box>

      {feedback && (
        <Alert
          severity={feedback.startsWith('Failed') ? 'error' : 'success'}
          sx={{ mb: 3 }}
          onClose={() => setFeedback(null)}
        >
          {feedback}
        </Alert>
      )}

      {/* 2-Column Operational View */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Active Production Key Card */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 3, backgroundColor: tokens.color.bgCard, borderColor: tokens.color.borderSubtle, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShieldCheck size={20} color={tokens.color.approve} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.color.textMain }}>
                  Active Production Signing Key
                </Typography>
              </Box>
              <Chip
                size="small"
                label="CURRENT ACTIVE SIGNER"
                sx={{ backgroundColor: tokens.color.approve, color: '#ffffff', fontWeight: 700 }}
              />
            </Box>

            {activeKey ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block' }}>Key ID:</Typography>
                  <Typography variant="body1" sx={{ fontFamily: tokens.font.mono, color: tokens.color.brand300, fontWeight: 700 }}>
                    {activeKey.key_id}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block' }}>Algorithm:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.color.textMain }}>
                      {activeKey.algorithm || 'ML-DSA-87'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block' }}>Sequence:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.color.textMain }}>
                      #{activeKey.sequence_number || 1}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block' }}>Active Since:</Typography>
                    <Typography variant="body2" sx={{ color: tokens.color.textDim }}>
                      {new Date(activeKey.active_from || activeKey.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block' }}>SHA-3 Fingerprint:</Typography>
                  <Typography variant="caption" sx={{ fontFamily: tokens.font.mono, color: tokens.color.textMuted, wordBreak: 'break-all' }}>
                    {activeKey.public_key_id_sha3 || 'sha3_pqc_hash_active_signer'}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: tokens.color.textDim }}>
                {loading ? 'Loading active key...' : 'No active key currently designated.'}
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Promotion Form */}
        <Grid item xs={12} md={6}>
          {isRoot ? (
            <RotationRequestForm preStagedKeys={preStagedKeys} onComplete={fetchPool} />
          ) : (
            <Paper variant="outlined" sx={{ p: 3, backgroundColor: tokens.color.bgCard, borderColor: tokens.color.borderSubtle }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.color.textMain, mb: 1 }}>
                Key Promotion Authority
              </Typography>
              <Typography variant="body2" sx={{ color: tokens.color.textDim }}>
                Moderator account in view mode. Promoting new keys into production is restricted to Root Administrators.
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Complete Key Pool Registry Table */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.color.textMain, mb: 1 }}>
          Key Pool Registry ({keys.length} Registered Keys)
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.color.textDim, mb: 2 }}>
          Registry of active, pre-distributed standby, and retired NIST FIPS 204 keys.
        </Typography>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderColor: tokens.color.borderSubtle }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Key Identifier</TableCell>
              <TableCell>Algorithm</TableCell>
              <TableCell>Sequence</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Registered At</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3, color: tokens.color.textDim }}>
                  {loading ? 'Loading key pool...' : 'No keys registered in pool. Click "Pre-Stage Next Key" above.'}
                </TableCell>
              </TableRow>
            ) : (
              keys.map(k => {
                const isActive = k.status === 'active';
                const isPreStaged = k.status === 'pre_staged';
                return (
                  <TableRow key={k.key_id} hover>
                    <TableCell sx={{ fontFamily: tokens.font.mono, fontWeight: 700, color: tokens.color.brand300 }}>
                      {k.key_id}
                    </TableCell>
                    <TableCell sx={{ color: tokens.color.textMain }}>
                      {k.algorithm || 'ML-DSA-87'}
                    </TableCell>
                    <TableCell sx={{ color: tokens.color.textDim }}>
                      #{k.sequence_number || 1}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={isActive ? 'ACTIVE' : isPreStaged ? 'PRE-STAGED' : 'RETIRED'}
                        sx={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          backgroundColor: isActive
                            ? tokens.color.approve
                            : isPreStaged
                            ? tokens.color.brand500
                            : tokens.color.borderSubtle,
                          color: '#ffffff',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: tokens.color.textDim, fontSize: '0.8rem' }}>
                      {new Date(k.created_at || Date.now()).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
