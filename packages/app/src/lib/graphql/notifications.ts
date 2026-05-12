import { gql } from "urql";

// Phase 2 — In-app notifications (no email/SMS at v1).
// Surfaces in the /feed page via a filter (Yours vs Following).

export const MY_NOTIFICATIONS_QUERY = gql`
  query MyNotifications($first: Int, $after: String, $unreadOnly: Boolean) {
    myNotifications(first: $first, after: $after, unreadOnly: $unreadOnly) {
      edges {
        cursor
        node {
          id
          kind
          contextJson
          readAt
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

export const UNREAD_NOTIFICATION_COUNT_QUERY = gql`
  query UnreadNotificationCount {
    unreadNotificationCount
  }
`;

export const MARK_NOTIFICATION_READ_MUTATION = gql`
  mutation MarkNotificationRead($input: markNotificationReadInput!) {
    markNotificationRead(input: $input) {
      notification {
        id
        readAt
      }
      error
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ_MUTATION = gql`
  mutation MarkAllNotificationsRead($input: markAllNotificationsReadInput!) {
    markAllNotificationsRead(input: $input) {
      markedCount
      error
    }
  }
`;
