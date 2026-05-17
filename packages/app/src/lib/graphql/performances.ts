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
      effectivePosterUrl
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
          languages
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
        performances {
          edges {
            node {
              id
              date
              time
              venue { id name }
              ticketUrl
              soldOut
            }
          }
        }
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
            slug
            address
            city
            coordinates { lat lng }
          }
          ticketUrl
          soldOut
          run {
            id
            show {
              id
              title
              posterUrl
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

export const BROWSE_PERFORMANCES_QUERY = gql`
  query BrowsePerformances($search: String, $first: Int, $after: String) {
    performanceList(search: $search, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          date
          time
          venue {
            id
            name
            slug
            city
            coordinates { lat lng }
          }
          ticketUrl
          soldOut
          effectiveDescription
          run {
            id
            show {
              id
              title
              description
              posterUrl
              performanceTypes
              averageRating
              reviewCount
            }
            productionCompany {
              name
            }
            averageRating
            reviewCount
            cast {
              id
              person { id name headshotUrl }
              role
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

// Lightweight version for map view — skips cast, description, and other heavy fields
export const MAP_PERFORMANCES_QUERY = gql`
  query MapPerformances($first: Int) {
    performanceList(first: $first) {
      edges {
        node {
          id
          date
          time
          venue {
            id
            name
            slug
            city
            coordinates { lat lng }
          }
          ticketUrl
          soldOut
          run {
            id
            show {
              id
              title
              posterUrl
              performanceTypes
            }
            productionCompany {
              name
            }
          }
        }
      }
    }
  }
`;
