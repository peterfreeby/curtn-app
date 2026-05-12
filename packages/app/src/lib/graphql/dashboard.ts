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
