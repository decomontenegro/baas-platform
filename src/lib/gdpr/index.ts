/**
 * LGPD/GDPR Compliance Module
 * 
 * Central export for all GDPR/LGPD compliance functionality.
 */

// Data Export
export {
  exportUserData,
  createExportRequest,
  processExportRequest,
  getExportRequestStatus,
  cleanupExpiredExports,
  type UserDataExport,
} from './data-export'

// Data Deletion
export {
  createDeletionRequest,
  processDeletionRequest,
  softDeleteUserData,
  anonymizeUser,
  hardDeleteUser,
  getUsersForAnonymization,
  getUsersForHardDelete,
  cancelDeletionRequest,
  restoreUser,
  type DeletionResult,
  type AnonymizationResult,
} from './data-deletion'

// Constants
export const GDPR_CONSTANTS = {
  // Default retention periods (in days)
  SOFT_DELETE_RETENTION: 30,      // Days before anonymization
  ANONYMIZED_RETENTION: 365,       // Days before hard delete
  EXPORT_LINK_EXPIRY: 7,          // Days export download link is valid
  REQUEST_VERIFICATION_EXPIRY: 7, // Days to verify a request
  
  // Legal basis references
  LEGAL_BASIS: {
    EXPORT: 'LGPD Art. 18, III - Direito de acesso / GDPR Art. 15 - Right of access',
    DELETION: 'LGPD Art. 18, VI - Direito de eliminação / GDPR Art. 17 - Right to erasure',
    PORTABILITY: 'LGPD Art. 18, V - Direito de portabilidade / GDPR Art. 20 - Right to data portability',
    RECTIFICATION: 'LGPD Art. 18, III - Direito de correção / GDPR Art. 16 - Right to rectification',
  },
  
  // Request types
  REQUEST_TYPES: {
    DATA_EXPORT: 'DATA_EXPORT',
    DATA_DELETION: 'DATA_DELETION',
    DATA_RECTIFICATION: 'DATA_RECTIFICATION',
    DATA_PORTABILITY: 'DATA_PORTABILITY',
    CONSENT_WITHDRAWAL: 'CONSENT_WITHDRAWAL',
  },
} as const
