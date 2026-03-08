import { gql } from "urql";

export const FOLLOW_TOGGLE_MUTATION = gql`
  mutation FollowToggle($input: FollowToggleInput!) {
    followToggle(input: $input) {
      isFollowing
      error
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
