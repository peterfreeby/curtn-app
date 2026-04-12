import { gql } from "urql";

export const USER_SEEN_QUERY = gql`
  query UserSeen($username: String!, $first: Int, $after: String) {
    seenList(username: $username, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          createdAt
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

export const SEEN_CREATE_MUTATION = gql`
  mutation SeenCreate($input: seenCreateInput!) {
    seenCreate(input: $input) {
      seen
      seenCount
      error
    }
  }
`;

export const SEEN_DELETE_MUTATION = gql`
  mutation SeenDelete($input: seenDeleteInput!) {
    seenDelete(input: $input) {
      seen
      seenCount
      error
    }
  }
`;
