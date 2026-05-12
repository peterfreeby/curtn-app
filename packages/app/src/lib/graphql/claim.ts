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
        signals {
          autoPromotionScore
          autoPromotedAt
        }
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

// Phase 8 — verification signals.

export const CLAIM_SIGNALS_FRAGMENT = gql`
  fragment ClaimSignalsFields on ClaimRequest {
    id
    status
    signals {
      webmasterVerified
      webmasterToken
      webmasterTokenExpires
      externalProfileLinks {
        url
        platform
        verifiedAt
      }
      trustGraphEndorsements {
        grantingUnitKind
        grantingUnitId
        grantedAt
      }
      autoPromotionScore
      autoPromotedAt
    }
  }
`;

export const GET_CLAIM_SIGNALS_QUERY = gql`
  query GetClaimSignals($claimRequestId: String!) {
    getClaimSignals(claimRequestId: $claimRequestId) {
      ...ClaimSignalsFields
    }
  }
  ${CLAIM_SIGNALS_FRAGMENT}
`;

export const GENERATE_WEBMASTER_TOKEN_MUTATION = gql`
  mutation GenerateWebmasterToken($input: generateWebmasterTokenInput!) {
    generateWebmasterToken(input: $input) {
      claimRequest {
        ...ClaimSignalsFields
      }
      token
      website
      error
    }
  }
  ${CLAIM_SIGNALS_FRAGMENT}
`;

export const VERIFY_WEBMASTER_MUTATION = gql`
  mutation VerifyWebmaster($input: verifyWebmasterInput!) {
    verifyWebmaster(input: $input) {
      claimRequest {
        ...ClaimSignalsFields
      }
      verified
      method
      autoPromoted
      error
    }
  }
  ${CLAIM_SIGNALS_FRAGMENT}
`;

export const LINK_EXTERNAL_PROFILE_MUTATION = gql`
  mutation LinkExternalProfile($input: linkExternalProfileInput!) {
    linkExternalProfile(input: $input) {
      claimRequest {
        ...ClaimSignalsFields
      }
      autoPromoted
      error
    }
  }
  ${CLAIM_SIGNALS_FRAGMENT}
`;

export const ADMIN_REVOKE_AUTO_PROMOTION_MUTATION = gql`
  mutation AdminRevokeAutoPromotion($input: adminRevokeAutoPromotionInput!) {
    adminRevokeAutoPromotion(input: $input) {
      claimRequest {
        id
        status
        reviewerNotes
      }
      error
    }
  }
`;

export const AUTO_PROMOTED_CLAIMS_QUERY = gql`
  query AutoPromotedClaims {
    autoPromotedClaims(first: 50) {
      edges {
        node {
          id
          status
          message
          requestedAt
          user {
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
