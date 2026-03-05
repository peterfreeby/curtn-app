import { gql } from "urql";

export const USER_BY_USERNAME_QUERY = gql`
  query UserByUsername($username: String!, $first: Int) {
    userList(username: $username, first: $first) {
      edges {
        node {
          id
          fullName
          username
          followerCount
          followingCount
          isFollowing
        }
      }
    }
  }
`;

export const USER_REVIEWS_QUERY = gql`
  query UserReviews($username: String!, $first: Int, $after: String) {
    reviewList(username: $username, first: $first, after: $after) {
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
          }
          run {
            id
            show {
              id
              title
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
