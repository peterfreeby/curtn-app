import { gql } from "urql";

export const VENUE_LIST_QUERY = gql`
  query VenueList(
    $first: Int
    $after: String
    $city: String
    $venueType: String
    $search: String
  ) {
    venueList(
      first: $first
      after: $after
      city: $city
      venueType: $venueType
      search: $search
    ) {
      edges {
        cursor
        node {
          id
          name
          slug
          address
          city
          state
          capacity
          venueType
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const SEARCH_VENUES_QUERY = gql`
  query SearchVenues($search: String, $first: Int) {
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

export const VENUE_BY_SLUG_QUERY = gql`
  query VenueBySlug($slug: String!) {
    venueBySlug(slug: $slug) {
      id
      name
      slug
      description
      address
      city
      state
      zipCode
      capacity
      venueType
      website
      phone
      email
    }
  }
`;

export const VENUE_RUNS_QUERY = gql`
  query RunsByVenue($venueName: String!, $first: Int, $after: String) {
    runsByVenue(venueName: $venueName, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          show {
            id
            title
            performanceTypes
          }
          productionCompany {
            name
            slug
          }
          startDate
          endDate
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
