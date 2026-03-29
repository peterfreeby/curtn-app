import { gql } from "urql";

export const SINGLE_PERFORMANCE_QUERY = gql`
  query SinglePerformance($id: ID!) {
    singlePerformance(id: $id) {
      id
      date
      time
      venue {
        id
        name
        slug
        address
        city
      }
      ticketUrl
      soldOut
      effectiveDescription
      effectiveCast {
        id
        role
        person { id name slug headshotUrl }
      }
      effectiveCrew {
        id
        role
        person { id name slug headshotUrl }
      }
      run {
        id
        show {
          id
          title
          performanceTypes
          duration
          imageUrl
          posterUrl
        }
        productionCompany {
          id
          name
          slug
        }
        venues {
          id
          name
          slug
          city
        }
        intermissions
        startDate
        endDate
        averageRating
        reviewCount
      }
    }
  }
`;

export const PERFORMANCE_CREATE_MUTATION = gql`
  mutation PerformanceCreate($input: performanceCreateInput!) {
    performanceCreate(input: $input) {
      performance {
        id
        run {
          id
        }
      }
      error
    }
  }
`;

export const PERFORMANCES_BY_RUN_QUERY = gql`
  query PerformancesByRun($runId: ID!, $first: Int, $after: String) {
    performancesByRun(runId: $runId, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          date
          time
          venue {
            id
            name
          }
          ticketUrl
          soldOut
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const UPCOMING_PERFORMANCES_QUERY = gql`
  query UpcomingPerformances($city: String, $first: Int, $after: String) {
    upcomingPerformances(city: $city, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          date
          time
          venue {
            id
            name
          }
          ticketUrl
          soldOut
          run {
            id
            show {
              id
              title
              performanceTypes
            }
            productionCompany {
              name
            }
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

export const RUN_REVIEWS_QUERY = gql`
  query RunReviews($runId: ID, $showId: ID, $performance: ID, $first: Int, $after: String, $followedOnly: Boolean) {
    reviewList(runId: $runId, showId: $showId, performance: $performance, first: $first, after: $after, followedOnly: $followedOnly) {
      edges {
        cursor
        node {
          id
          rating
          text
          attendedAt
          createdAt
          venue
          isFollowedByViewer
          user {
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

export const PERFORMANCE_CREDIT_REMOVE_MUTATION = gql`
  mutation PerformanceCreditRemove($input: performanceCreditRemoveInput!) {
    performanceCreditRemove(input: $input) {
      performance { id }
      error
    }
  }
`;

export const PERFORMANCE_CREDIT_RESTORE_MUTATION = gql`
  mutation PerformanceCreditRestore($input: performanceCreditRestoreInput!) {
    performanceCreditRestore(input: $input) {
      performance { id }
      error
    }
  }
`;

export const PERFORMANCE_CREDIT_ADD_MUTATION = gql`
  mutation PerformanceCreditAdd($input: performanceCreditAddInput!) {
    performanceCreditAdd(input: $input) {
      performance { id }
      error
    }
  }
`;
