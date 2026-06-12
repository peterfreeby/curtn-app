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
          imageUrl
          permanentlyClosed
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
      coordinates { lat lng }
      capacity
      venueType
      defaultPerformanceType
      website
      phone
      email
      imageUrl
      permanentlyClosed
      closedDate
      claimState
      claimedBy {
        id
        username
      }
    }
  }
`;

export const VENUE_FIND_OR_CREATE_MUTATION = gql`
  mutation VenueFindOrCreate($input: venueFindOrCreateInput!) {
    venueFindOrCreate(input: $input) {
      venue {
        id
        name
        city
      }
      created
      error
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
            imageUrl
            posterUrl
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

export const VENUE_MAP_QUERY = gql`
  query VenueMap($first: Int, $swLat: Float, $swLng: Float, $neLat: Float, $neLng: Float) {
    venueList(first: $first, swLat: $swLat, swLng: $swLng, neLat: $neLat, neLng: $neLng) {
      edges {
        node {
          id
          name
          slug
          city
          coordinates { lat lng }
        }
      }
    }
  }
`;
