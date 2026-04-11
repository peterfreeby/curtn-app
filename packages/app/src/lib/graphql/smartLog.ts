import { gql } from "urql";

export const VENUES_NEAR_QUERY = gql`
  query VenuesNear($latitude: Float!, $longitude: Float!, $maxDistance: Float, $first: Int) {
    venuesNear(latitude: $latitude, longitude: $longitude, maxDistance: $maxDistance, first: $first) {
      edges {
        node {
          id
          name
          slug
          city
          address
          coordinates { lat lng }
        }
      }
    }
  }
`;

export const SEARCH_SHOWS_QUICK = gql`
  query SearchShowsQuick($query: String!, $first: Int) {
    searchShows(query: $query, first: $first) {
      edges {
        node {
          id
          title
          performanceTypes
          averageRating
          reviewCount
          runs {
            edges {
              node {
                id
                productionCompany { name slug }
                venues { id name slug city }
                startDate
                endDate
              }
            }
          }
        }
      }
    }
  }
`;

export const SEARCH_VENUES_QUICK = gql`
  query SearchVenuesQuick($search: String!, $first: Int) {
    venueList(search: $search, first: $first) {
      edges {
        node {
          id
          name
          city
        }
      }
    }
  }
`;
