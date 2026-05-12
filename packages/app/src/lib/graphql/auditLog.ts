import { gql } from "urql";

// Phase 3 — Edit history operations.
// Public history is paginated and supports revert + removal-request actions.

export const AUDIT_LOG_QUERY = gql`
  query AuditLog($targetKind: String!, $targetId: String!, $first: Int, $after: String) {
    auditLog(targetKind: $targetKind, targetId: $targetId, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          target {
            kind
            targetId
          }
          author {
            kind
            label
            user {
              id
              username
              fullName
              avatarUrl
            }
          }
          diffJson
          approvalSource
          approvalContextJson
          isRevert
          revertOf
          hidden
          createdAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const REVERT_AUDIT_LOG_ENTRY_MUTATION = gql`
  mutation RevertAuditLogEntry($input: revertAuditLogEntryInput!) {
    revertAuditLogEntry(input: $input) {
      auditLogEntry {
        id
        isRevert
        revertOf
      }
      error
    }
  }
`;

export const HIDE_AUDIT_LOG_ENTRY_MUTATION = gql`
  mutation HideAuditLogEntry($input: hideAuditLogEntryInput!) {
    hideAuditLogEntry(input: $input) {
      auditLogEntry {
        id
        hidden
      }
      error
    }
  }
`;

export const SUBMIT_REMOVAL_REQUEST_MUTATION = gql`
  mutation SubmitRemovalRequest($input: submitRemovalRequestInput!) {
    submitRemovalRequest(input: $input) {
      removalRequest {
        id
        status
      }
      error
    }
  }
`;

export const PENDING_REMOVAL_REQUESTS_QUERY = gql`
  query PendingRemovalRequests($first: Int, $after: String, $status: String) {
    pendingRemovalRequests(first: $first, after: $after, status: $status) {
      edges {
        cursor
        node {
          id
          targetAuditLogId
          reason
          category
          status
          reviewerNotes
          reviewedAt
          createdAt
          requester {
            id
            username
            fullName
            avatarUrl
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const PROCESS_REMOVAL_REQUEST_MUTATION = gql`
  mutation ProcessRemovalRequest($input: processRemovalRequestInput!) {
    processRemovalRequest(input: $input) {
      removalRequest {
        id
        status
      }
      error
    }
  }
`;
