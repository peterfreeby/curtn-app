import { gql } from "urql";

export const CREDIT_ADD_MUTATION = gql`
  mutation CreditAdd($input: creditAddInput!) {
    creditAdd(input: $input) {
      credit {
        id
        person {
          id
          name
          slug
        }
        creditType
        role
        order
      }
      error
    }
  }
`;

export const CREDIT_REMOVE_MUTATION = gql`
  mutation CreditRemove($input: creditRemoveInput!) {
    creditRemove(input: $input) {
      deletedCount
      error
    }
  }
`;
