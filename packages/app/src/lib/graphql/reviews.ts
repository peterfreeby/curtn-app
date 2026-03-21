import { gql } from "urql";

export const REVIEW_CREATE_MUTATION = gql`
  mutation ReviewCreate($input: reviewCreateInput!) {
    reviewCreate(input: $input) {
      review {
        id
        rating
        text
        attendedAt
        createdAt
        user {
          id
          username
        }
        performance {
          id
        }
        run {
          id
          show {
            id
            title
          }
        }
      }
      error
    }
  }
`;

export const REVIEW_DELETE_MUTATION = gql`
  mutation ReviewDelete($input: reviewDeleteInput!) {
    reviewDelete(input: $input) {
      deletedCount
      error
    }
  }
`;

export const REVIEW_LIST_QUERY = gql`
  query ReviewList($first: Int, $after: String, $sort: String, $direction: String, $rating: Int, $performance: ID, $runId: ID, $username: String) {
    reviewList(first: $first, after: $after, sort: $sort, direction: $direction, rating: $rating, performance: $performance, runId: $runId, username: $username) {
      edges {
        cursor
        node {
          id
          rating
          text
          attendedAt
          createdAt
          venue
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
