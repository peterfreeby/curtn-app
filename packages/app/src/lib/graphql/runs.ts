import { gql } from "urql";

export const SINGLE_RUN_QUERY = gql`
  query SingleRun($id: ID!) {
    singleRun(id: $id) {
      id
      show {
        id
        title
        description
        performanceTypes
        duration
        languages
      }
      productionCompany {
        id
        name
        slug
        description
      }
      venues {
        id
        name
        slug
        address
        city
      }
      intermissions
      startDate
      endDate
      description
      cast {
        id
        person {
          id
          name
          slug
        }
        role
        order
      }
      crew {
        id
        person {
          id
          name
          slug
        }
        role
        order
      }
      performances {
        edges {
          node {
            id
            date
            time
            venue {
              id
              name
            }
            ticketUrl
            soldOut
          }
        }
      }
      upcomingPerformances {
        edges {
          node {
            id
            date
            time
            venue {
              id
              name
            }
            ticketUrl
            soldOut
          }
        }
      }
      averageRating
      reviewCount
      createdAt
    }
  }
`;

export const RUN_FIND_OR_CREATE_MUTATION = gql`
  mutation RunFindOrCreate($input: runFindOrCreateInput!) {
    runFindOrCreate(input: $input) {
      run {
        id
        show {
          title
        }
        productionCompany {
          name
        }
        venues {
          name
        }
        startDate
        endDate
      }
      created
      error
    }
  }
`;

export const RUNS_BY_VENUE_QUERY = gql`
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
