import { gql } from "urql";

export const FOLLOW_TOGGLE_MUTATION = gql`
  mutation FollowToggle($input: followToggleInput!) {
    followToggle(input: $input) {
      isFollowing
      error
    }
  }
`;

export const ENTITY_FOLLOW_TOGGLE_MUTATION = gql`
  mutation EntityFollowToggle($input: entityFollowToggleInput!) {
    entityFollowToggle(input: $input) {
      isFollowing
      error
    }
  }
`;

export const FEED_SEEN_QUERY = gql`
  query FeedSeen($first: Int, $after: String) {
    feedSeen(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          createdAt
          user {
            id
            username
            fullName
            avatarUrl
          }
          run {
            id
            show {
              id
              title
              imageUrl
              posterUrl
            }
            startDate
            endDate
            venues {
              name
              city
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

export const FEED_REVIEWS_QUERY = gql`
  query FeedReviews($first: Int, $after: String) {
    feedReviews(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          rating
          text
          attendedAt
          createdAt
          user {
            id
            username
            fullName
            avatarUrl
          }
          run {
            id
            show {
              id
              title
              imageUrl
              posterUrl
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
