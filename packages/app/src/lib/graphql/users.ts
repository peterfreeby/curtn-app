import { gql } from "urql";

export const USER_BY_USERNAME_QUERY = gql`
  query UserByUsername($username: String!, $first: Int) {
    userList(username: $username, first: $first) {
      edges {
        node {
          id
          fullName
          username
          bio
          avatarUrl
          followerCount
          followingCount
          isFollowing
        }
      }
    }
  }
`;

export const USER_PROFILE_UPDATE_MUTATION = gql`
  mutation UserProfileUpdate($input: userProfileUpdateInput!) {
    userProfileUpdate(input: $input) {
      user {
        id
        fullName
        bio
        avatarUrl
      }
      error
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
