// components/ui/NetworkBoundary.tsx
import React from 'react';
import { SkeletonLoadingScreen } from './SkeletonLoadingScreen';
import { NetworkErrorScreen } from './NetworkErrorScreen';

export interface NetworkBoundaryProps {
  isLoading?: boolean;
  isError?: boolean;
  title?: string;
  errorMessage?: string;
  onRetry?: () => void | Promise<void>;
  isRetrying?: boolean;
  children: React.ReactNode;
}

/**
 * Universal Boundary component for the entire BunkMates application.
 * - Displays SkeletonLoadingScreen (Image 1) when loading/fetching.
 * - Displays NetworkErrorScreen (Image 2) on network failure or server error.
 * - Colors strictly follow BUNKMATES_DESIGN_SYSTEM.md.
 */
export const NetworkBoundary: React.FC<NetworkBoundaryProps> = ({
  isLoading = false,
  isError = false,
  title,
  errorMessage,
  onRetry,
  isRetrying,
  children,
}) => {
  if (isError) {
    return (
      <NetworkErrorScreen
        message={errorMessage}
        onRetry={onRetry}
        isRetrying={isRetrying}
      />
    );
  }

  if (isLoading) {
    return <SkeletonLoadingScreen title={title} />;
  }

  return <>{children}</>;
};

export default NetworkBoundary;
