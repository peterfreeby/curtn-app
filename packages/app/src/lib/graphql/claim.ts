import { gql } from "urql";

// Generalized polymorphic claim flow (Phase 2 of Claim & Edit Authority Model).
// Distinct from the legacy `submitClaimRequest` (Person-only) in claims.ts.

export const SUBMIT_CLAIM_MUTATION = gql`
  mutation SubmitClaim($input: submitClaimInput!) {
    submitClaim(input: $input) {
      claimRequest {
        id
        status
        requestedAt
      }
      error
    }
  }
`;

export const APPROVE_CLAIM_MUTATION = gql`
  mutation ApproveClaim($input: approveClaimInput!) {
    approveClaim(input: $input) {
      claimRequest {
        id
        status
        reviewedAt
        reviewerNotes
      }
      error
    }
  }
`;

export const DECLINE_CLAIM_MUTATION = gql`
  mutation DeclineClaim($input: declineClaimInput!) {
    declineClaim(input: $input) {
      claimRequest {
        id
        status
        reviewedAt
        reviewerNotes
      }
      error
    }
  }
`;

// Fetch the basics of a unit (Venue / Company / Person) for the claim form.
// We fetch one of the three by slug rather than relying on globalId so the
// /claim/[kind]/[slug] route can use human-readable URLs.

export const VENUE_FOR_CLAIM_QUERY = gql`
  query VenueForClaim($slug: String!) {
    venueBySlug(slug: $slug) {
      id
      name
      slug
      city
      state
      claimState
      claimedBy {
        id
        username
      }
    }
  }
`;

export const COMPANY_FOR_CLAIM_QUERY = gql`
  query CompanyForClaim($slug: String!) {
    productionCompanyBySlug(slug: $slug) {
      id
      name
      slug
      claimState
      claimedBy {
        id
        username
      }
    }
  }
`;

export const PERSON_FOR_CLAIM_QUERY = gql`
  query PersonForClaim($slug: String!) {
    personBySlug(slug: $slug) {
      id
      name
      slug
      claimState
      claimedBy {
        id
        username
      }
    }
  }
`;
