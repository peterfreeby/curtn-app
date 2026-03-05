import { gql } from "urql";

export const COMPANY_BY_SLUG_QUERY = gql`
  query CompanyBySlug($slug: String!) {
    productionCompanyBySlug(slug: $slug) {
      id
      name
      slug
      description
      logoUrl
      runs {
        edges {
          node {
            id
            show {
              id
              title
              performanceTypes
            }
            venues {
              id
              name
              slug
              city
            }
            startDate
            endDate
            averageRating
            reviewCount
          }
        }
      }
      venues {
        id
        name
        slug
        city
      }
      people {
        id
        name
        slug
      }
    }
  }
`;

export const PRODUCTION_COMPANY_CREATE_MUTATION = gql`
  mutation ProductionCompanyCreate($input: productionCompanyCreateInput!) {
    productionCompanyCreate(input: $input) {
      productionCompany {
        id
        name
        slug
      }
      error
    }
  }
`;

export const SEARCH_COMPANIES_QUERY = gql`
  query SearchCompanies($search: String, $first: Int, $after: String) {
    productionCompanyList(search: $search, first: $first, after: $after) {
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
