import { gql } from "urql";

export const CLAIM_REQUESTS_QUERY = gql`
  query ClaimRequests($status: String) {
    claimRequests(status: $status) {
      edges {
        node {
          id
          user {
            id
            fullName
            username
            avatarUrl
          }
          person {
            id
            name
            slug
            headshotUrl
            isClaimed
          }
          target {
            kind
            targetId
            name
            slug
          }
          status
          message
          reviewerNotes
          requestedAt
          reviewedAt
          reviewedBy {
            id
            username
          }
          signals {
            webmasterVerified
            externalProfileLinks {
              url
              platform
            }
            trustGraphEndorsements {
              grantingUnitKind
            }
            autoPromotionScore
            autoPromotedAt
          }
        }
      }
    }
  }
`;

export const MY_CLAIM_REQUEST_QUERY = gql`
  query MyClaimRequest {
    myClaimRequest {
      id
      person {
        id
        name
        slug
      }
      status
      requestedAt
    }
  }
`;

export const SUBMIT_CLAIM_REQUEST_MUTATION = gql`
  mutation SubmitClaimRequest($input: submitClaimRequestInput!) {
    submitClaimRequest(input: $input) {
      claimRequest {
        id
        status
        person {
          id
          name
          slug
        }
      }
      error
    }
  }
`;

export const SUBMIT_CLAIM_REQUEST_NEW_PERSON_MUTATION = gql`
  mutation SubmitClaimRequestNewPerson($input: submitClaimRequestNewPersonInput!) {
    submitClaimRequestNewPerson(input: $input) {
      claimRequest {
        id
        status
        person {
          id
          name
          slug
        }
      }
      person {
        id
        name
        slug
      }
      error
    }
  }
`;

export const APPROVE_CLAIM_REQUEST_MUTATION = gql`
  mutation ApproveClaimRequest($input: approveClaimRequestInput!) {
    approveClaimRequest(input: $input) {
      claimRequest {
        id
        status
        reviewedAt
      }
      error
    }
  }
`;

export const REJECT_CLAIM_REQUEST_MUTATION = gql`
  mutation RejectClaimRequest($input: rejectClaimRequestInput!) {
    rejectClaimRequest(input: $input) {
      claimRequest {
        id
        status
        reviewedAt
      }
      error
    }
  }
`;

export const ADMIN_UNCLAIM_PERSON_MUTATION = gql`
  mutation AdminUnclaimPerson($input: adminUnclaimPersonInput!) {
    adminUnclaimPerson(input: $input) {
      success
      error
    }
  }
`;
