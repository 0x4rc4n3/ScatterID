// components/ops-dashboard-web/src/components/shared/LoadingSkeletonRow.tsx
import React from 'react';
import { TableRow, TableCell, Skeleton } from '@mui/material';

interface LoadingSkeletonRowProps {
  columns: number;
}

export const LoadingSkeletonRow: React.FC<LoadingSkeletonRowProps> = ({ columns }) => {
  return (
    <TableRow>
      {Array.from({ length: columns }).map((_, idx) => (
        <TableCell key={idx}>
          <Skeleton variant="text" animation="wave" height={24} />
        </TableCell>
      ))}
    </TableRow>
  );
};
