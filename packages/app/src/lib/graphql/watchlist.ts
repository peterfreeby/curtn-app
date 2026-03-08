import { gql } from "urql";

export const WATCHLIST_ADD_MUTATION = gql`
  mutation WatchlistAdd($input: watchlistAddInput!) {
    watchlistAdd(input: $input) {
      onWatchlist
      watchlistCount
      error
    }
  }
`;

export const WATCHLIST_REMOVE_MUTATION = gql`
  mutation WatchlistRemove($input: watchlistRemoveInput!) {
    watchlistRemove(input: $input) {
      onWatchlist
      watchlistCount
      error
    }
  }
`;

export const MY_WATCHLIST_QUERY = gql`
  query MyWatchlist($first: Int, $after: String) {
    myWatchlist(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          title
          performanceTypes
          imageUrl
          averageRating
          reviewCount
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
