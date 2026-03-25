import { gql } from "urql";

export const SEARCH_ALL_SHOWS_QUERY = gql`
  query SearchAllShows($query: String!, $first: Int) {
    searchShows(query: $query, first: $first) {
      edges {
        cursor
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
                productionCompany {
                  name
                  slug
                }
                venues {
                  name
                  city
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const SEARCH_ALL_VENUES_QUERY = gql`
  query SearchAllVenues($search: String, $first: Int) {
    venueList(search: $search, first: $first) {
      edges {
        cursor
        node {
          id
          name
          slug
          city
          state
          venueType
        }
      }
    }
  }
`;

export const SEARCH_ALL_PEOPLE_QUERY = gql`
  query SearchAllPeople($search: String, $first: Int) {
    personList(search: $search, first: $first) {
      edges {
        cursor
        node {
          id
          name
          slug
        }
      }
    }
  }
`;

export const SEARCH_ALL_COMPANIES_QUERY = gql`
  query SearchAllCompanies($search: String, $first: Int) {
    productionCompanyList(search: $search, first: $first) {
      edges {
        cursor
        node {
          id
          name
          slug
        }
      }
    }
  }
`;
