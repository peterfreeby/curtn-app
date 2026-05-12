import { gql } from "urql";

// Phase 7 — block management queries + mutations. Claimant dashboard surfaces
// the per-unit block list; admin surface uses adminBlockActivity for the
// aggregated view.

export const BLOCKS_FOR_UNIT_QUERY = gql`
  query BlocksForUnit($scopedToKind: String!, $scopedToId: String!, $includeRevoked: Boolean) {
    blocksForUnit(scopedToKind: $scopedToKind, scopedToId: $scopedToId, includeRevoked: $includeRevoked) {
      id
      reason
      createdAt
      revokedAt
      blockedUser {
        userId
        username
        fullName
      }
      scopedTo {
        kind
        targetId
        name
        slug
      }
    }
  }
`;

export const MY_ISSUED_BLOCKS_QUERY = gql`
  query MyIssuedBlocks($includeRevoked: Boolean) {
    myIssuedBlocks(includeRevoked: $includeRevoked) {
      id
      reason
      createdAt
      revokedAt
      blockedUser {
        userId
        username
        fullName
      }
      scopedTo {
        kind
        targetId
        name
        slug
      }
    }
  }
`;

export const ADMIN_BLOCK_ACTIVITY_QUERY = gql`
  query AdminBlockActivity($windowDays: Int) {
    adminBlockActivity(windowDays: $windowDays) {
      windowDays
      threshold
      topBlockers {
        blockerId
        blockerUsername
        blockerFullName
        blockCount
        flagged
      }
      recentBlocks {
        id
        reason
        createdAt
        revokedAt
        blocker {
          userId
          username
          fullName
        }
        blockedUser {
          userId
          username
          fullName
        }
        scopedTo {
          kind
          targetId
          name
          slug
        }
      }
    }
  }
`;

export const BLOCK_USER_MUTATION = gql`
  mutation BlockUser($input: blockUserInput!) {
    blockUser(input: $input) {
      block {
        id
        createdAt
      }
      error
    }
  }
`;

export const UNBLOCK_USER_MUTATION = gql`
  mutation UnblockUser($input: unblockUserInput!) {
    unblockUser(input: $input) {
      block {
        id
        revokedAt
      }
      success
      error
    }
  }
`;
