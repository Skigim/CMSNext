/**
 * Verification Status Utilities
 * ============================
 * Handles verification status mapping, styling, and logic.
 * Extracted from FinancialItemCard for better organization.
 * 
 * @created Phase 2 of FinancialItemCard refactoring
 * @author GitHub Copilot
 */

import { FinancialItem } from '@/types/case';

export type VerificationStatus = 'Needs VR' | 'VR Pending' | 'AVS Pending' | 'Verified';

export interface VerificationStatusInfo {
  text: string;
  colorClass: string;
}

/**
 * Get verification status styling and display information
 */
export const getVerificationStatusInfo = (
  status: string,
  verificationSource?: string
): VerificationStatusInfo => {
  const normalizedStatus = (status || 'Needs VR').toLowerCase();
  
  const statusMap: Record<string, VerificationStatusInfo> = {
    'verified': { 
      text: 'Verified', 
      colorClass: 'bg-green-600 hover:bg-green-700 text-white border-green-600' 
    },
    'needs vr': { 
      text: 'Needs VR', 
      colorClass: 'bg-gray-500 hover:bg-gray-600 text-white border-gray-500' 
    },
    'vr pending': { 
      text: 'VR Pending', 
      colorClass: 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500' 
    },
    'avs pending': { 
      text: 'AVS Pending', 
      colorClass: 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500' 
    },
  };

  let badgeInfo = statusMap[normalizedStatus] || statusMap['needs vr'];

  // Append verification source for verified items
  if (normalizedStatus === 'verified' && verificationSource) {
    badgeInfo = { 
      ...badgeInfo, 
      text: `${badgeInfo.text} (${verificationSource})` 
    };
  }

  return badgeInfo;
};

/**
 * Determine if verification source field should be shown
 */
export const shouldShowVerificationSource = (
  currentStatus?: string,
  formStatus?: string
): boolean => {
  return currentStatus === 'Verified' || formStatus === 'Verified';
};

/**
 * Create updated item with new verification status
 */
export const updateVerificationStatus = (
  item: FinancialItem,
  newStatus: VerificationStatus
): FinancialItem => {
  return {
    ...item,
    verificationStatus: newStatus,
    // Explicitly set verificationSource for clarity
    verificationSource: newStatus === 'Verified' ? item.verificationSource : undefined
  };
};