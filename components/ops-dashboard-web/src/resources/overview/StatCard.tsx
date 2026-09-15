// components/ops-dashboard-web/src/resources/overview/StatCard.tsx
import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { tokens } from '@scatterid/design-tokens';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: React.ReactNode;
  accentColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  accentColor = tokens.color.brand500,
}) => {
  return (
    <Card
      variant="outlined"
      sx={{
        backgroundColor: tokens.color.white,
        borderColor: tokens.color.borderLight,
        borderRadius: 2,
        height: '100%',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Typography variant="body2" sx={{ color: tokens.color.slate500, fontWeight: 600 }}>
            {title}
          </Typography>
          {icon && (
            <Box
              sx={{
                p: 0.75,
                borderRadius: 1,
                color: accentColor,
                backgroundColor: tokens.color.slate50,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 800, color: tokens.color.slate800, mb: 0.5 }}>
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="caption" sx={{ color: tokens.color.slate500 }}>
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};
