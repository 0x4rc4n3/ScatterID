import React, { useEffect, useState } from 'react';
import { Box, Grid, Typography, Button, Card, CardContent } from '@mui/material';
import { RefreshCw, ShieldCheck, FileX, Clock, AlertOctagon, Layers, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { httpClient } from '../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../dataProvider/endpoints.js';
import { StatCard } from './StatCard.js';
import { ReconciliationHealthBadge } from './ReconciliationHealthBadge.js';
import { RecentActivityTable } from './RecentActivityTable.js';
import { useCurrentUser } from '../../hooks/useCurrentUser.js';
import { usePolicy } from '../../hooks/usePolicy.js';
import { tokens } from '@scatterid/design-tokens';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { isRoot } = useCurrentUser();
  const { policy } = usePolicy();
  const [stats, setStats] = useState<any>(null);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, auditRes] = await Promise.all([
        httpClient(ENDPOINTS.requests.stats),
        httpClient(`${ENDPOINTS.requests.auditLog}?limit=10`),
      ]);
      setStats(statsRes);
      setAuditEvents(Array.isArray(auditRes) ? auditRes : (auditRes.logs || []));
    } catch (err) {
      console.error('Failed to load overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: tokens.color.slate800, letterSpacing: '-0.02em' }}>
            Operations Overview
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.color.slate500, mt: 0.5 }}>
            Cryptographic ledger status, intake queues, and security monitoring • Policy: <span className="font-semibold text-brand700">{policy?.name || 'Scenario B'}</span>
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {stats?.reconciliation && (
            <ReconciliationHealthBadge
              status={stats.reconciliation.status}
              lastRun={stats.reconciliation.lastRun}
            />
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
            onClick={loadData}
            disabled={loading}
            sx={{ borderColor: tokens.color.borderLight, color: tokens.color.slate700, backgroundColor: tokens.color.white }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Root Administrator Action Callout when tasks are awaiting Root */}
      {isRoot && Number(stats?.awaitingRoot || 0) > 0 && (
        <Card
          variant="outlined"
          sx={{
            mb: 3,
            backgroundColor: tokens.color.purpleLight,
            borderColor: tokens.color.rootTier,
            borderWidth: 2,
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
          }}
        >
          <CardContent sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: tokens.color.rootTier }}>
                Action Required: {stats.awaitingRoot} Request(s) Awaiting Root Accept
              </Typography>
              <Typography variant="body2" sx={{ color: tokens.color.slate700, fontSize: '0.85rem' }}>
                Moderators have approved requests that require second-tier Root execution under the active policy.
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              endIcon={<ArrowRight size={14} />}
              onClick={() => navigate('/moderation-queue')}
              sx={{ backgroundColor: tokens.color.rootTier, color: tokens.color.white, fontWeight: 700 }}
            >
              Review Root Queue
            </Button>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Total Issued Records"
            value={stats?.totalCredentials ?? '—'}
            subtitle="Anchored on Hyperledger Fabric"
            icon={<Layers size={20} />}
            accentColor={tokens.color.brand500}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Active Credentials"
            value={stats?.active ?? '—'}
            subtitle="Valid NIST FIPS 204 signatures"
            icon={<ShieldCheck size={20} />}
            accentColor={tokens.color.approve}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Revoked Credentials"
            value={stats?.revoked ?? '—'}
            subtitle="Permanently invalidated on-chain"
            icon={<FileX size={20} />}
            accentColor={tokens.color.reject}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Pending Intake Queue"
            value={stats?.pendingRequests ?? '—'}
            subtitle="Awaiting moderator review"
            icon={<Clock size={20} />}
            accentColor={tokens.color.cyanMid}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Awaiting Root Accept"
            value={stats?.awaitingRoot ?? '—'}
            subtitle="Four-Eyes verification gate"
            icon={<Clock size={20} />}
            accentColor={tokens.color.rootTier}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Flagged Anomalies"
            value={stats?.flagged ?? '—'}
            subtitle="Escalated for Root investigation"
            icon={<AlertOctagon size={20} />}
            accentColor={tokens.color.flag}
          />
        </Grid>
      </Grid>

      <RecentActivityTable items={auditEvents} loading={loading} />
    </Box>
  );
};
