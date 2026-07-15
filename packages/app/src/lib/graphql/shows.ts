import { gql } from "urql";

export const SHOW_LIST_QUERY = gql`
  query ShowList(
    $first: Int
    $after: String
    $performanceTypes: [String]
    $search: String
  ) {
    showList(
      first: $first
      after: $after
      performanceTypes: $performanceTypes
      search: $search
    ) {
      edges {
        cursor
        node {
          id
          title
          performanceTypes
          duration
          imageUrl
          posterUrl
          averageRating
          reviewCount
          watchlistCount
          isOnMyWatchlist
          castHeadshots {
            name
            slug
            headshotUrl
          }
          runs {
            edges {
              node {
                id
                productionCompany {
                  name
                  slug
                }
                venues {
                  id
                  name
                  slug
                  city
                }
                startDate
                endDate
              }
            }
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

export const SEARCH_SHOWS_QUERY = gql`
  query SearchShows($query: String!, $first: Int, $after: String) {
    searchShows(query: $query, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          title
          performanceTypes
          imageUrl
          posterUrl
          averageRating
          reviewCount
          isOnMyWatchlist
          runs {
            edges {
              node {
                id
                productionCompany {
                  name
                  slug
                }
              }
            }
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

export const SHOW_FIND_OR_CREATE_MUTATION = gql`
  mutation ShowFindOrCreate($input: showFindOrCreateInput!) {
    showFindOrCreate(input: $input) {
      show {
        id
        title
      }
      created
      error
    }
  }
`;

export const SINGLE_SHOW_QUERY = gql`
  query SingleShow($id: ID!) {
    singleShow(id: $id) {
      id
      title
      description
      performanceTypes
      duration
      languages
      imageUrl
      posterUrl
      wikidataId
      averageRating
      reviewCount
      watchlistCount
      isOnMyWatchlist
      creators {
        edges {
          node {
            id
            person {
              id
              name
              slug
            }
            role
            order
          }
        }
      }
      runs {
        edges {
          node {
            id
            title
            effectiveTitle
            productionCompany {
              id
              name
              slug
            }
            venues {
              id
              name
              slug
              address
              city
            }
            intermissions
            lineupPerPerformance
            startDate
            endDate
            description
            averageRating
            reviewCount
            cast {
              id
              person {
                id
                name
                slug
                headshotUrl
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
                headshotUrl
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
                  imageUrl
                  venue {
                    id
                    name
                  }
                  ticketUrl
                  soldOut
                  effectiveCast {
                    id
                    role
                    person { id name slug headshotUrl }
                  }
                  effectiveCrew {
                    id
                    role
                    person { id name slug headshotUrl }
                  }
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
          }
        }
      }
      createdAt
    }
  }
`;
