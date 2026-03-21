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
        performancesMatched
        venuesCreated
        venuesMatched
        companiesCreated
        companiesMatched
        personsCreated
        personsMatched
        creditsCreated
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
          lastPolledAt
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
        url
        isActive
      }
      error
    }
  }
`;

export const POLL_DATA_SOURCE_MUTATION = gql`
  mutation PollDataSource($input: pollDataSourceInput!) {
    pollDataSource(input: $input) {
      eventsFound
      eventsCreated
      eventsSkipped
      error
    }
  }
`;

export const PENDING_IMPORTS_QUERY = gql`
  query PendingImports($status: String, $dataSourceId: String, $first: Int, $after: String) {
    pendingImports(status: $status, dataSourceId: $dataSourceId, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          status
          title
          runTitle
          showDescription
          runDescription
          performanceDescription
          performanceTypes
          duration
          date
          time
          venueName
          stageName
          companyName
          ticketUrl
          importedAt
          reviewedAt
          error
          dataSource {
            id
            name
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

export const APPROVE_PENDING_IMPORT_MUTATION = gql`
  mutation ApprovePendingImport($input: approvePendingImportInput!) {
    approvePendingImport(input: $input) {
      pendingImport {
        id
        status
        reviewedAt
      }
      error
    }
  }
`;

export const REJECT_PENDING_IMPORT_MUTATION = gql`
  mutation RejectPendingImport($input: rejectPendingImportInput!) {
    rejectPendingImport(input: $input) {
      pendingImport {
        id
        status
        reviewedAt
      }
      error
    }
  }
`;

export const EDIT_PENDING_IMPORT_MUTATION = gql`
  mutation EditPendingImport($input: editPendingImportInput!) {
    editPendingImport(input: $input) {
      pendingImport {
        id
        title
        runTitle
        showDescription
        runDescription
        performanceDescription
        performanceTypes
        duration
        date
        time
        venueName
        stageName
        companyName
        ticketUrl
      }
      error
    }
  }
`;

export const AUTO_VALIDATE_MUTATION = gql`
  mutation AutoValidatePendingImports($input: autoValidatePendingImportsInput!) {
    autoValidatePendingImports(input: $input) {
      approvedCount
      errorCount
      error
    }
  }
`;

// --- Wikidata Import ---

export const WIKIDATA_SEARCH_MUTATION = gql`
  mutation WikidataSearch($input: wikidataSearchInput!) {
    wikidataSearch(input: $input) {
      shows {
        wikidataId
        title
        description
        performanceType
        premiereDate
        venueLabel
        directorLabel
        composerLabel
        duration
        existsInCurtn
      }
      venues {
        wikidataId
        name
        capacity
        coordinates
        website
        architectLabel
        ownerLabel
        openedDate
        existsInCurtn
      }
      error
    }
  }
`;

// Note: wikidataSearchInput accepts optional yearFrom/yearTo for SHOWS_BY_REGION searches

export const WIKIDATA_IMPORT_MUTATION = gql`
  mutation WikidataImport($input: wikidataImportInput!) {
    wikidataImport(input: $input) {
      result {
        totalProcessed
        showsCreated
        showsEnriched
        showsSkipped
        venuesCreated
        venuesEnriched
        venuesSkipped
        companiesCreated
        personsCreated
        creditsCreated
        errors
      }
      error
    }
  }
`;


// --- Admin Editor Queries & Mutations ---

export const ADMIN_SHOW_LIST_QUERY = gql`
  query AdminShowList($first: Int, $search: String) {
    showList(first: $first, search: $search) {
      edges {
        node {
          id
          title
          performanceTypes
          duration
          description
          url
          imageUrl
          posterUrl
          createdAt
        }
      }
    }
  }
`;

export const ADMIN_VENUE_LIST_QUERY = gql`
  query AdminVenueList($first: Int) {
    venueList(first: $first) {
      edges {
        node {
          id
          name
          address
          city
          state
          zipCode
          capacity
          venueType
          website
          phone
          email
          description
          imageUrl
          permanentlyClosed
          closedDate
          createdAt
        }
      }
    }
  }
`;

export const ADMIN_RUN_LIST_QUERY = gql`
  query AdminRunList($first: Int) {
    runList(first: $first) {
      edges {
        node {
          id
          title
          effectiveTitle
          description
          intermissions
          startDate
          endDate
          show {
            id
            title
          }
          productionCompany {
            name
          }
          venues {
            name
          }
          imageUrl
          posterUrl
          createdAt
        }
      }
    }
  }
`;

export const ADMIN_PERFORMANCE_LIST_QUERY = gql`
  query AdminPerformanceList($first: Int) {
    performanceList(first: $first) {
      edges {
        node {
          id
          date
          time
          ticketUrl
          soldOut
          effectiveDescription
          run {
            id
            effectiveTitle
            show {
              title
            }
          }
          venue {
            name
          }
          imageUrl
          createdAt
        }
      }
    }
  }
`;

export const ADMIN_PERSON_LIST_QUERY = gql`
  query AdminPersonList($first: Int, $search: String) {
    personList(first: $first, search: $search) {
      edges {
        node {
          id
          name
          slug
          bio
          headshotUrl
          wikidataId
          createdAt
        }
      }
    }
  }
`;

export const SHOW_UPDATE_MUTATION = gql`
  mutation ShowUpdate($input: showUpdateInput!) {
    showUpdate(input: $input) {
      show {
        id
        title
        description
        performanceTypes
        duration
        url
        imageUrl
        posterUrl
      }
      error
    }
  }
`;

export const VENUE_UPDATE_MUTATION = gql`
  mutation VenueUpdate($input: venueUpdateInput!) {
    venueUpdate(input: $input) {
      venue {
        id
        name
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
        imageUrl
        permanentlyClosed
        closedDate
      }
      error
    }
  }
`;

export const RUN_UPDATE_MUTATION = gql`
  mutation RunUpdate($input: runUpdateInput!) {
    runUpdate(input: $input) {
      run {
        id
        title
        description
        intermissions
        startDate
        endDate
        imageUrl
        posterUrl
      }
      error
    }
  }
`;

export const PERFORMANCE_UPDATE_MUTATION = gql`
  mutation PerformanceUpdate($input: performanceUpdateInput!) {
    performanceUpdate(input: $input) {
      performance {
        id
        date
        time
        ticketUrl
        soldOut
        imageUrl
      }
      error
    }
  }
`;

// --- Delete Mutations ---

export const SHOW_DELETE_MUTATION = gql`
  mutation ShowDelete($input: showDeleteInput!) {
    showDelete(input: $input) {
      deletedId
      error
    }
  }
`;

export const VENUE_DELETE_MUTATION = gql`
  mutation VenueDelete($input: venueDeleteInput!) {
    venueDelete(input: $input) {
      deletedId
      error
    }
  }
`;

export const RUN_DELETE_MUTATION = gql`
  mutation RunDelete($input: runDeleteInput!) {
    runDelete(input: $input) {
      deletedId
      error
    }
  }
`;

export const PERFORMANCE_DELETE_MUTATION = gql`
  mutation PerformanceDelete($input: performanceDeleteInput!) {
    performanceDelete(input: $input) {
      deletedId
      error
    }
  }
`;

// --- Merge Mutations ---

export const SHOW_MERGE_MUTATION = gql`
  mutation ShowMerge($input: showMergeInput!) {
    showMerge(input: $input) {
      show {
        id
        title
      }
      error
    }
  }
`;

export const VENUE_MERGE_MUTATION = gql`
  mutation VenueMerge($input: venueMergeInput!) {
    venueMerge(input: $input) {
      deletedId
      error
    }
  }
`;

export const RUN_MERGE_MUTATION = gql`
  mutation RunMerge($input: runMergeInput!) {
    runMerge(input: $input) {
      deletedId
      error
    }
  }
`;

export const PERFORMANCE_MERGE_MUTATION = gql`
  mutation PerformanceMerge($input: performanceMergeInput!) {
    performanceMerge(input: $input) {
      deletedId
      error
    }
  }
`;

// --- Person Mutations ---

export const PERSON_UPDATE_MUTATION = gql`
  mutation PersonUpdate($input: personUpdateInput!) {
    personUpdate(input: $input) {
      person {
        id
        name
        slug
        bio
        headshotUrl
        wikidataId
      }
      error
    }
  }
`;

export const PERSON_DELETE_MUTATION = gql`
  mutation PersonDelete($input: personDeleteInput!) {
    personDelete(input: $input) {
      deletedId
      error
    }
  }
`;

export const PERSON_MERGE_MUTATION = gql`
  mutation PersonMerge($input: personMergeInput!) {
    personMerge(input: $input) {
      person {
        id
        name
      }
      error
    }
  }
`;
