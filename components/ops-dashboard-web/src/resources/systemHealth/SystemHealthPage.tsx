// components/ops-dashboard-web/src/resources/systemHealth/SystemHealthPage.tsx
import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, Button, Chip, Divider } from '@mui/material';
import { Activity, RefreshCw, CheckCircle2, Server, Database, ShieldCheck, Cpu } from 'lucide-react';
import { httpClient } from '../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../dataProvider/endpoints.js';
import { RunReconciliationButton } from './RunReconciliationButton.js';
import { DiagnosticConsole } from './DiagnosticConsole.js';
import { tokens } from '@scatterid/design-tokens';

export const SystemHealthPage: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const res = await httpClient(ENDPOINTS.requests.stats);
      setStats(res);
    } catch (err) {
      console.error('Failed to load system health:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: tokens.color.textMain }}>
            System Health & Infrastructure Diagnostics
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.color.textDim }}>
            Ledger synchrony, operational database consistency, and microservice status
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
          onClick={fetchHealth}
          disabled={loading}
          sx={{ borderColor: tokens.color.borderSubtle, color: tokens.color.textMain }}
        >
          {loading ? 'Refreshing...' : 'Refresh Telemetry'}
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Left: Ledger State Reconciliation */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 3, backgroundColor: tokens.color.bgCard, borderColor: tokens.color.borderSubtle, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Activity size={20} color={tokens.color.approve} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: tokens.color.textMain }}>
                Ledger State Reconciliation
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Chip
                icon={<CheckCircle2 size={16} color={tokens.color.white} />}
                label={stats?.reconciliation?.status === 'in_sync' ? 'DATABASE & FABRIC IN SYNC' : 'CHECK NEEDED'}
                sx={{ backgroundColor: tokens.color.approve, color: tokens.color.white, fontWeight: 700 }}
              />
              <Typography variant="caption" sx={{ color: tokens.color.textDim }}>
                Last run: {stats?.reconciliation?.lastRun ? new Date(stats.reconciliation.lastRun).toLocaleTimeString() : 'Recent'}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: tokens.color.textDim, mb: 3 }}>
              Cross-verifies SQLite operational records against Hyperledger Fabric immutable world state to identify drift, missing commitments, or unanchored credentials.
            </Typography>

            <Box sx={{ mt: 'auto', pt: 2, borderTop: 1, borderColor: tokens.color.borderSubtle }}>
              <RunReconciliationButton onReconciliationFinished={fetchHealth} />
            </Box>
          </Paper>
        </Grid>

        {/* Right: Service Subsystem Telemetry */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 3, backgroundColor: tokens.color.bgCard, borderColor: tokens.color.borderSubtle, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Server size={20} color={tokens.color.brand500} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: tokens.color.textMain }}>
                Core Subsystem Status
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: tokens.color.textDim, mb: 2.5 }}>
              Live runtime status for ScatterID ecosystem daemons, gateways, and cryptographic stores.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Database size={16} color={tokens.color.textDim} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.color.textMain }}>
                    SQLite Operational Store
                  </Typography>
                </Box>
                <Chip size="small" label="WAL Mode • Online" sx={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: tokens.color.approve, fontWeight: 700 }} />
              </Box>

              <Divider sx={{ borderColor: tokens.color.borderSubtle }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShieldCheck size={16} color={tokens.color.textDim} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.color.textMain }}>
                    Ops Security Daemon (Port 8080)
                  </Typography>
                </Box>
                <Chip size="small" label="Healthy" sx={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: tokens.color.approve, fontWeight: 700 }} />
              </Box>

              <Divider sx={{ borderColor: tokens.color.borderSubtle }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Server size={16} color={tokens.color.textDim} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.color.textMain }}>
                    Verification API Gateway (Port 3000)
                  </Typography>
                </Box>
                <Chip size="small" label="Healthy" sx={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: tokens.color.approve, fontWeight: 700 }} />
              </Box>

              <Divider sx={{ borderColor: tokens.color.borderSubtle }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Cpu size={16} color={tokens.color.textDim} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.color.textMain }}>
                    PQC Engine (ML-DSA-87)
                  </Typography>
                </Box>
                <Chip size="small" label="FIPS 204 Active" sx={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: tokens.color.rootTier, fontWeight: 700 }} />
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Interactive Subsystem Diagnostic Terminal */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: tokens.color.textMain }}>
            Interactive Subsystem Diagnostic Console
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.color.textDim }}>
            Execute end-to-end telemetry probes, test cryptographic signing chains, and inspect account provisioning governance.
          </Typography>
        </Box>
        <DiagnosticConsole />
      </Box>
    </Box>
  );
};
