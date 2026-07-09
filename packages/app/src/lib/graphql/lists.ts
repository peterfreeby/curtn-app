import { gql } from "urql";

export const LIST_FRAGMENT = gql`
  fragment ListFields on List {
    id
    name
    slug
    description
    listType
    isPublic
    isEditorial
    isActive
    displayOrder
    itemCount
    sourceMode
    sourceEntityType
    sourceEntityName
    sourceEntitySlug
    followTargetType
    isOwner
    isCollaborator
    owner {
      id
      username
      fullName
      avatarUrl
    }
    collaborators {
      edges {
        node {
          id
          username
          fullName
          avatarUrl
        }
      }
    }
    createdAt
    updatedAt
  }
`;

export const MY_LISTS_QUERY = gql`
  query MyLists($first: Int, $after: String, $listType: String) {
    myLists(first: $first, after: $after, listType: $listType) {
      edges {
        cursor
        node {
          ...ListFields
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
  ${LIST_FRAGMENT}
`;

export const USER_LISTS_QUERY = gql`
  query UserLists($userId: ID!, $first: Int, $after: String) {
    userLists(userId: $userId, first: $first, after: $after) {
      edges {
        cursor
        node {
          ...ListFields
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
  ${LIST_FRAGMENT}
`;

export const LIST_BY_SLUG_QUERY = gql`
  query ListBySlug($ownerUsername: String!, $slug: String!) {
    listBySlug(ownerUsername: $ownerUsername, slug: $slug) {
      ...ListFields
    }
  }
  ${LIST_FRAGMENT}
`;

export const LIST_ITEMS_QUERY = gql`
  query ListBySlugItems($ownerUsername: String!, $slug: String!) {
    listBySlug(ownerUsername: $ownerUsername, slug: $slug) {
      id
      listType
      items {
        edges {
          node {
            id
            position
            note
            item {
              __typename
              ... on Show {
                showId: id
                showTitle: title
                posterUrl
                imageUrl
                performanceTypes
              }
              ... on Venue {
                venueId: id
                venueName: name
                venueSlug: slug
                city
                state
                venueType
                venueImageUrl: imageUrl
              }
              ... on Run {
                runId: id
                runTitle: title
                startDate
                endDate
              }
              ... on Performance {
                perfId: id
                date
                time
              }
              ... on Person {
                personId: id
                personName: name
                personSlug: slug
                headshotUrl
              }
            }
            addedBy {
              id
              username
            }
            createdAt
          }
        }
      }
    }
  }
`;

export const LIST_BY_ID_QUERY = gql`
  query ListById($id: ID!) {
    listById(id: $id) {
      ...ListFields
    }
  }
  ${LIST_FRAGMENT}
`;

// Lightweight editorial-list query for admin management: list metadata only,
// no `items` (so dynamic lists don't run their show aggregations just to show a row).
export const ADMIN_EDITORIAL_LISTS_QUERY = gql`
  query AdminEditorialLists($activeOnly: Boolean, $isActive: Boolean, $first: Int, $after: String) {
    editorialLists(activeOnly: $activeOnly, isActive: $isActive, first: $first, after: $after) {
      edges {
        cursor
        node {
          ...ListFields
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
  ${LIST_FRAGMENT}
`;

export const EDITORIAL_LISTS_QUERY = gql`
  query EditorialLists($listType: String, $activeOnly: Boolean, $isActive: Boolean, $first: Int, $after: String) {
    editorialLists(listType: $listType, activeOnly: $activeOnly, isActive: $isActive, first: $first, after: $after) {
      edges {
        cursor
        node {
          ...ListFields
          items {
            edges {
              node {
                id
                position
                item {
                  __typename
                  ... on Show {
                    showId: id
                    showTitle: title
                    posterUrl
                    imageUrl
                    performanceTypes
                  }
                  ... on Venue {
                    venueId: id
                    venueName: name
                    venueSlug: slug
                    city
                    state
                    venueType
                    venueImageUrl: imageUrl
                  }
                  ... on Run {
                    runId: id
                    runTitle: title
                    startDate
                    endDate
                  }
                  ... on Performance {
                    perfId: id
                    date
                    time
                  }
                  ... on Person {
                    personId: id
                    personName: name
                    personSlug: slug
                    headshotUrl
                  }
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
  ${LIST_FRAGMENT}
`;

export const LIST_CREATE_MUTATION = gql`
  mutation ListCreate($input: listCreateInput!) {
    listCreate(input: $input) {
      list {
        ...ListFields
      }
      error
    }
  }
  ${LIST_FRAGMENT}
`;

export const LIST_UPDATE_MUTATION = gql`
  mutation ListUpdate($input: listUpdateInput!) {
    listUpdate(input: $input) {
      list {
        ...ListFields
      }
      error
    }
  }
  ${LIST_FRAGMENT}
`;

export const LIST_DELETE_MUTATION = gql`
  mutation ListDelete($input: listDeleteInput!) {
    listDelete(input: $input) {
      success
      error
    }
  }
`;

export const LIST_ADD_ITEM_MUTATION = gql`
  mutation ListAddItem($input: listAddItemInput!) {
    listAddItem(input: $input) {
      listItem {
        id
        position
        note
      }
      error
    }
  }
`;

export const LIST_REMOVE_ITEM_MUTATION = gql`
  mutation ListRemoveItem($input: listRemoveItemInput!) {
    listRemoveItem(input: $input) {
      success
      error
    }
  }
`;

export const LIST_REORDER_ITEMS_MUTATION = gql`
  mutation ListReorderItems($input: listReorderItemsInput!) {
    listReorderItems(input: $input) {
      success
      error
    }
  }
`;

export const LIST_ADD_COLLABORATOR_MUTATION = gql`
  mutation ListAddCollaborator($input: listAddCollaboratorInput!) {
    listAddCollaborator(input: $input) {
      list {
        ...ListFields
      }
      error
    }
  }
  ${LIST_FRAGMENT}
`;

export const LIST_REMOVE_COLLABORATOR_MUTATION = gql`
  mutation ListRemoveCollaborator($input: listRemoveCollaboratorInput!) {
    listRemoveCollaborator(input: $input) {
      list {
        ...ListFields
      }
      error
    }
  }
  ${LIST_FRAGMENT}
`;

export const LIST_SET_EDITORIAL_MUTATION = gql`
  mutation ListSetEditorial($input: listSetEditorialInput!) {
    listSetEditorial(input: $input) {
      list {
        ...ListFields
      }
      error
    }
  }
  ${LIST_FRAGMENT}
`;
