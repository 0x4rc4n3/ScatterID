// components/ops-dashboard-web/src/resources/governance/PolicyGovernancePage.tsx
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  Chip,
  Grid,
  Divider,
} from '@mui/material';
import { Shield, RefreshCw, CheckCircle2, Lock } from 'lucide-react';
import { usePolicy } from '../../hooks/usePolicy.js';
import { useCurrentUser } from '../../hooks/useCurrentUser.js';
import { PolicyConfirmModal } from './PolicyConfirmModal.js';
import { tokens } from '@scatterid/design-tokens';

export const PolicyGovernancePage: React.FC = () => {
  const { policy, loading, error, refreshPolicy, updatePolicy } = usePolicy();
  const { isRoot } = useCurrentUser();
  const [switching, setSwitching] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [targetProfile, setTargetProfile] = useState<{ key: string; name: string; description: string } | null>(null);

  const handleConfirmTransition = async (totpCode: string) => {
    if (!targetProfile) return;
    try {
      setSwitching(targetProfile.key);
      setSuccessMessage(null);
      await updatePolicy(targetProfile.key, totpCode);
      setSuccessMessage(`Governance policy successfully updated to ${targetProfile.name}. Risk routing active across all nodes.`);
      setTargetProfile(null);
    } catch (err: any) {
      console.error('Failed to update policy:', err);
      throw err;
    } finally {
      setSwitching(null);
    }
  };

  const activeName = policy?.name || 'Scenario B — Tiered Risk Policy';

  return (
    <Box sx={{ p: 4, maxWidth: 1100, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: tokens.color.textMain, letterSpacing: '-0.02em' }}>
            Policy Engine & Dynamic Governance
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.color.textDim, mt: 0.5 }}>
            Configure live organizational risk postures, approval tiers, and ledger execution pathways
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
          onClick={() => refreshPolicy()}
          disabled={loading}
          sx={{ borderColor: tokens.color.borderSubtle, color: tokens.color.textMain }}
        >
          {loading ? 'Refreshing...' : 'Refresh Policy'}
        </Button>
      </Box>

      {successMessage && (
        <Alert severity="success" sx={{ mb: 3, backgroundColor: 'rgba(34, 197, 94, 0.1)', color: tokens.color.approve }}>
          {successMessage}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {!isRoot && (
        <Alert severity="info" icon={<Lock size={16} />} sx={{ mb: 3 }}>
          Read-Only View: Only senior Root Administrators with active multi-factor authentication may alter live governance policies.
        </Alert>
      )}

      {/* Active Policy Status Banner */}
      <Card variant="outlined" sx={{ mb: 4, backgroundColor: tokens.color.bgCard, borderColor: tokens.color.brand500, borderWidth: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <Shield size={20} color={tokens.color.brand500} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: tokens.color.textMain }}>
                  Active Organizational Posture:
                </Typography>
                <Chip
                  label="ACTIVE IN FORCE"
                  size="small"
                  sx={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: tokens.color.brand500, fontWeight: 700, fontSize: '0.75rem' }}
                />
              </Box>
              <Typography variant="body1" sx={{ fontWeight: 600, color: tokens.color.brand300 }}>
                {activeName}
              </Typography>
              <Typography variant="body2" sx={{ color: tokens.color.textDim, mt: 0.5, maxWidth: 750 }}>
                {policy?.description || 'Standard in-person verified credentials auto-execute to ledger upon Moderator approval; all revocations require Root sign-off.'}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Available Governance Profiles */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.color.textMain, mb: 2 }}>
        Available Governance Risk Profiles
      </Typography>

      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {/* Profile 1: Scenario B */}
        <Grid item xs={12} md={4}>
          <Card
            variant="outlined"
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: tokens.color.bgSurface,
              borderColor: activeName.includes('Scenario B') ? tokens.color.brand500 : tokens.color.borderSubtle,
              borderWidth: activeName.includes('Scenario B') ? 2 : 1,
            }}
          >
            <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: tokens.color.textMain }}>
                  Scenario B — Tiered Risk
                </Typography>
                {activeName.includes('Scenario B') && <CheckCircle2 size={18} color={tokens.color.brand500} />}
              </Box>
              <Typography variant="body2" sx={{ color: tokens.color.textDim, fontSize: '0.8rem', flex: 1, mb: 2 }}>
                High-assurance in-person counter issuances with verified physical inspection auto-execute on Mod approval. Revocations strictly gate to Root.
              </Typography>
              <Divider sx={{ my: 1.5, borderColor: tokens.color.borderSubtle }} />
              <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block', mb: 2, fontWeight: 600 }}>
                • Hard Issuance: Auto-Execute<br />• Soft Issuance: Root Gated<br />• Revocation: Root Gated (Mandatory)
              </Typography>
              {isRoot && (
                <Button
                  fullWidth
                  variant="contained"
                  disabled={activeName.includes('Scenario B') || Boolean(switching)}
                  onClick={() => setTargetProfile({
                    key: 'SCENARIO_B',
                    name: 'Scenario B — Tiered Risk Policy',
                    description: 'Physical checklist verified counter issuances auto-execute upon Moderator approval; digital upload issuances and all revocations gate to Root.'
                  })}
                  sx={{
                    mt: 'auto',
                    backgroundColor: activeName.includes('Scenario B') ? tokens.color.borderSubtle : tokens.color.brand500,
                    color: '#ffffff',
                    fontWeight: 700,
                    '&:hover': { backgroundColor: tokens.color.brand700 },
                  }}
                >
                  {activeName.includes('Scenario B') ? 'Current Active' : 'Switch to Scenario B'}
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Profile 2: Scenario A */}
        <Grid item xs={12} md={4}>
          <Card
            variant="outlined"
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: tokens.color.bgSurface,
              borderColor: activeName.includes('Scenario A') ? tokens.color.rootTier : tokens.color.borderSubtle,
              borderWidth: activeName.includes('Scenario A') ? 2 : 1,
            }}
          >
            <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: tokens.color.textMain }}>
                  Scenario A — Strict Dual-Control
                </Typography>
                {activeName.includes('Scenario A') && <CheckCircle2 size={18} color={tokens.color.rootTier} />}
              </Box>
              <Typography variant="body2" sx={{ color: tokens.color.textDim, fontSize: '0.8rem', flex: 1, mb: 2 }}>
                Four-Eyes Principle: Every single issuance and revocation gates to Root's Awaiting Accept queue. Nothing executes without Root authorization.
              </Typography>
              <Divider sx={{ my: 1.5, borderColor: tokens.color.borderSubtle }} />
              <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block', mb: 2, fontWeight: 600 }}>
                • Hard Issuance: Root Gated<br />• Soft Issuance: Root Gated<br />• Revocation: Root Gated (Mandatory)
              </Typography>
              {isRoot && (
                <Button
                  fullWidth
                  variant="contained"
                  disabled={activeName.includes('Scenario A') || Boolean(switching)}
                  onClick={() => setTargetProfile({
                    key: 'SCENARIO_A',
                    name: 'Scenario A — Strict Dual-Control',
                    description: 'Enforces four-eyes control across all channels. Every issuance and revocation requires explicit Root administrator approval before commitment.'
                  })}
                  sx={{
                    mt: 'auto',
                    backgroundColor: activeName.includes('Scenario A') ? tokens.color.borderSubtle : tokens.color.rootTier,
                    color: '#ffffff',
                    fontWeight: 700,
                    '&:hover': { backgroundColor: tokens.color.brand700 },
                  }}
                >
                  {activeName.includes('Scenario A') ? 'Current Active' : 'Switch to Scenario A'}
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Profile 3: Scenario C */}
        <Grid item xs={12} md={4}>
          <Card
            variant="outlined"
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: tokens.color.bgSurface,
              borderColor: activeName.includes('Scenario C') ? tokens.color.brand500 : tokens.color.borderSubtle,
              borderWidth: activeName.includes('Scenario C') ? 2 : 1,
            }}
          >
            <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: tokens.color.textMain }}>
                  Scenario C — Delegated Autonomy
                </Typography>
                {activeName.includes('Scenario C') && <CheckCircle2 size={18} color={tokens.color.brand500} />}
              </Box>
              <Typography variant="body2" sx={{ color: tokens.color.textDim, fontSize: '0.8rem', flex: 1, mb: 2 }}>
                High-Throughput: Operational staff have delegated authority to auto-execute issuances upon review. Revocations remain Root-gated.
              </Typography>
              <Divider sx={{ my: 1.5, borderColor: tokens.color.borderSubtle }} />
              <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block', mb: 2, fontWeight: 600 }}>
                • Hard Issuance: Auto-Execute<br />• Soft Issuance: Auto-Execute<br />• Revocation: Root Gated
              </Typography>
              {isRoot && (
                <Button
                  fullWidth
                  variant="contained"
                  disabled={activeName.includes('Scenario C') || Boolean(switching)}
                  onClick={() => setTargetProfile({
                    key: 'SCENARIO_C',
                    name: 'Scenario C — Delegated Autonomy',
                    description: 'Permits counter staff and moderators to auto-commit issuances directly upon validation. Revocations remain strictly Root-gated.'
                  })}
                  sx={{
                    mt: 'auto',
                    backgroundColor: activeName.includes('Scenario C') ? tokens.color.borderSubtle : tokens.color.brand500,
                    color: '#ffffff',
                    fontWeight: 700,
                    '&:hover': { backgroundColor: tokens.color.brand700 },
                  }}
                >
                  {activeName.includes('Scenario C') ? 'Current Active' : 'Switch to Scenario C'}
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* TOTP Confirmation Modal */}
      <PolicyConfirmModal
        open={Boolean(targetProfile)}
        targetProfileKey={targetProfile?.key || null}
        targetProfileName={targetProfile?.name || ''}
        targetDescription={targetProfile?.description || ''}
        onConfirm={handleConfirmTransition}
        onClose={() => setTargetProfile(null)}
        submitting={Boolean(switching)}
      />
    </Box>
  );
};
