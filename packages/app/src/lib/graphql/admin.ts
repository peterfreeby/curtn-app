import { gql } from "urql";

export const CSV_IMPORT_MUTATION = gql`
  mutation CsvImport($input: csvImportInput!) {
    csvImport(input: $input) {
      result {
        totalRows
        showsCreated
        showsMatched
        runsCreated
        runsMatched
        performancesCreated
        errors
      }
      error
    }
  }
`;

export const DATA_SOURCE_LIST_QUERY = gql`
  query DataSourceList($first: Int, $after: String) {
    dataSourceList(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          name
          type
          url
          isActive
          createdAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const DATA_SOURCE_CREATE_MUTATION = gql`
  mutation DataSourceCreate($input: dataSourceCreateInput!) {
    dataSourceCreate(input: $input) {
      dataSource {
        id
        name
        type
      }
      error
    }
  }
`;
