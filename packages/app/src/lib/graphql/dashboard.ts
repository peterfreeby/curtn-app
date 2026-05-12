import { gql } from "urql";

// Phase 2 — claimant dashboard queries + transfer mutations.

export const MY_PENDING_TRANSFERS_QUERY = gql`
  query MyPendingTransfers {
    myPendingTransfers {
      id
      status
      message
      expiresAt
      createdAt
      fromUser {
        id
        username
        fullName
      }
      target {
        kind
        targetId
        name
        slug
      }
    }
  }
`;

export const INITIATE_TRANSFER_MUTATION = gql`
  mutation InitiateTransfer($input: initiateTransferInput!) {
    initiateTransfer(input: $input) {
      transfer {
        id
        status
        expiresAt
      }
      error
    }
  }
`;

export const PING_DASHBOARD_ACTIVITY_MUTATION = gql`
  mutation PingDashboardActivity($input: pingDashboardActivityInput!) {
    pingDashboardActivity(input: $input) {
      ok
      error
    }
  }
`;

export const RESPOND_TO_TRANSFER_MUTATION = gql`
  mutation RespondToTransfer($input: respondToTransferInput!) {
    respondToTransfer(input: $input) {
      transfer {
        id
        status
        respondedAt
      }
      error
    }
  }
`;


export const MY_CLAIMS_QUERY = gql`
  query MyClaims {
    myClaims {
      kind
      targetId
      name
      slug
      claimState
      claimedAt
      syncHealth
    }
  }
`;

// Phase 4 — Proposal queue.

export const MY_PENDING_PROPOSALS_QUERY = gql`
  query MyPendingProposals($authorType: String, $targetKind: String, $sinceDays: Int) {
    myPendingProposals(authorType: $authorType, targetKind: $targetKind, sinceDays: $sinceDays) {
      id
      diffJson
      submissionVersion
      status
      isJointStewardship
      isCommunityReview
      firstApprovalAt
      conflictsWithProposalIds
      createdAt
      target {
        kind
        targetId
        name
        slug
      }
      proposer {
        kind
        label
        user {
          id
          username
          fullName
        }
      }
      approvals {
        userId
        role
        approvedAt
      }
    }
  }
`;

export const COMMUNITY_REVIEW_PROPOSALS_QUERY = gql`
  query CommunityReviewProposals($targetKind: String, $sinceDays: Int) {
    communityReviewProposals(targetKind: $targetKind, sinceDays: $sinceDays) {
      id
      diffJson
      submissionVersion
      status
      isJointStewardship
      isCommunityReview
      firstApprovalAt
      conflictsWithProposalIds
      createdAt
      target {
        kind
        targetId
        name
        slug
      }
      proposer {
        kind
        label
        user {
          id
          username
          fullName
        }
      }
      approvals {
        userId
        role
        approvedAt
      }
    }
  }
`;

export const PENDING_PROPOSALS_FOR_TARGET_QUERY = gql`
  query PendingProposalsForTarget($targetKind: String!, $targetId: String!) {
    pendingProposalsForTarget(targetKind: $targetKind, targetId: $targetId) {
      id
      diffJson
      isJointStewardship
      firstApprovalAt
      conflictsWithProposalIds
      createdAt
      target { kind targetId name slug }
      proposer {
        kind
        label
        user { id username fullName }
      }
      approvals { userId role approvedAt }
    }
  }
`;

export const APPROVE_PROPOSAL_MUTATION = gql`
  mutation ApproveProposal($input: approveProposalInput!) {
    approveProposal(input: $input) {
      proposal {
        id
        status
        approvals { userId role approvedAt }
      }
      applied
      error
    }
  }
`;

export const DECLINE_PROPOSAL_MUTATION = gql`
  mutation DeclineProposal($input: declineProposalInput!) {
    declineProposal(input: $input) {
      proposal { id status }
      error
    }
  }
`;

export const MY_CLAIM_REQUESTS_QUERY = gql`
  query MyClaimRequests {
    myClaimRequests {
      id
      status
      message
      reviewerNotes
      requestedAt
      reviewedAt
      target {
        kind
        targetId
        name
        slug
      }
      person {
        id
        name
        slug
      }
    }
  }
`;
