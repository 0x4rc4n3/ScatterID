// components/ops-dashboard-web/src/layout/Sidebar.tsx
import React from 'react';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Divider, Typography } from '@mui/material';
import {
  LayoutDashboard,
  FileCheck,
  Inbox,
  KeyRound,
  History,
  Activity,
  UserCheck,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CanAccess } from 'react-admin';
import { tokens } from '@scatterid/design-tokens';

interface NavItem {
  name: string;
  path: string;
  resource: string;
  icon: React.ReactNode;
}

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    { name: 'Overview', path: '/overview', resource: 'overview', icon: <LayoutDashboard size={18} /> },
    { name: 'Credentials', path: '/credentials', resource: 'credentials', icon: <FileCheck size={18} /> },
    { name: 'Moderation Queue', path: '/moderation-queue', resource: 'moderationQueue', icon: <Inbox size={18} /> },
    { name: 'Key Rotation', path: '/key-rotation', resource: 'keyRotation', icon: <KeyRound size={18} /> },
    { name: 'Policy & Governance', path: '/governance', resource: 'governance', icon: <Activity size={18} /> },
    { name: 'Audit Log', path: '/audit-log', resource: 'auditLog', icon: <History size={18} /> },
    { name: 'System Health', path: '/system-health', resource: 'systemHealth', icon: <LayoutDashboard size={18} /> },
    { name: 'Profile & Security', path: '/profile', resource: 'profile', icon: <UserCheck size={18} /> },
  ];

  return (
    <Box
      sx={{
        width: 240,
        flexShrink: 0,
        backgroundColor: tokens.color.white,
        borderRight: 1,
        borderColor: tokens.color.borderLight,
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 57px)',
      }}
    >
      <Box sx={{ px: 3, py: 2 }}>
        <Typography variant="overline" sx={{ color: tokens.color.slate500, fontWeight: 700, letterSpacing: '0.1em' }}>
          Operations Console
        </Typography>
      </Box>
      <Divider sx={{ borderColor: tokens.color.borderLight }} />
      <List sx={{ px: 1.5, py: 2, flex: 1 }}>
        {navItems.map(item => {
          const isSelected = location.pathname.startsWith(item.path);
          return (
            <CanAccess key={item.path} resource={item.resource} action="read">
              <ListItemButton
                selected={isSelected}
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  color: isSelected ? tokens.color.brand700 : tokens.color.slate700,
                  backgroundColor: isSelected ? tokens.color.brand50 : 'transparent',
                  '&.Mui-selected': {
                    backgroundColor: tokens.color.brand50,
                    color: tokens.color.brand700,
                    '&:hover': {
                      backgroundColor: tokens.color.brand50,
                    },
                  },
                  '&:hover': {
                    backgroundColor: tokens.color.slate100,
                    color: tokens.color.slate800,
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 34, color: isSelected ? tokens.color.brand500 : tokens.color.slate500 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.name}
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: isSelected ? 700 : 500 }}
                />
              </ListItemButton>
            </CanAccess>
          );
        })}
      </List>
      <Box sx={{ p: 2, borderTop: 1, borderColor: tokens.color.borderLight, backgroundColor: tokens.color.slate50 }}>
        <Typography variant="caption" sx={{ color: tokens.color.slate500, display: 'block', textAlign: 'center', fontWeight: 600 }}>
          FIPS 204 ML-DSA-65 Assurance
        </Typography>
      </Box>
    </Box>
  );
};
