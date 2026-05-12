import { gql } from "urql";

// Phase 6 — claimant sync feed connect/disconnect + status.

export const MY_CLAIMANT_SYNCS_QUERY = gql`
  query MyClaimantSyncs {
    myClaimantSyncs {
      id
      name
      type
      purpose
      url
      isActive
      lastPolledAt
      lastSuccessAt
      healthStatus
      associatedVenue
      createdAt
    }
  }
`;

export const TEST_SYNC_SOURCE_MUTATION = gql`
  mutation TestSyncSource($input: testSyncSourceInput!) {
    testSyncSource(input: $input) {
      itemCount
      preview {
        title
        description
        date
        time
        ticketUrl
      }
      error
    }
  }
`;

export const CREATE_CLAIMANT_SYNC_MUTATION = gql`
  mutation CreateClaimantSync($input: createClaimantSyncInput!) {
    createClaimantSync(input: $input) {
      dataSource {
        id
        name
        type
        url
        isActive
        lastPolledAt
      }
      error
    }
  }
`;

export const DISCONNECT_CLAIMANT_SYNC_MUTATION = gql`
  mutation DisconnectClaimantSync($input: disconnectClaimantSyncInput!) {
    disconnectClaimantSync(input: $input) {
      ok
      error
    }
  }
`;
