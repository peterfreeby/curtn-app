import { gql } from "urql";

export const PERSON_BY_SLUG_QUERY = gql`
  query PersonBySlug($slug: String!) {
    personBySlug(slug: $slug) {
      id
      name
      slug
      bio
      headshotUrl
      castCredits {
        id
        role
        order
        run {
          id
          show {
            id
            title
          }
          productionCompany {
            name
            slug
          }
          venues {
            name
            city
          }
          startDate
          endDate
        }
      }
      crewCredits {
        id
        role
        order
        run {
          id
          show {
            id
            title
          }
          productionCompany {
            name
            slug
          }
          venues {
            name
            city
          }
          startDate
          endDate
        }
      }
      productionCompanies {
        id
        name
        slug
      }
    }
  }
`;

export const SEARCH_PEOPLE_QUERY = gql`
  query SearchPeople($search: String, $first: Int, $after: String) {
    personList(search: $search, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          name
          slug
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
