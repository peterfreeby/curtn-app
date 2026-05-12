import { gql } from "urql";

// Phase 5 — Trusted editor: grants, scope management, reciprocity.

export const TRUSTED_EDITOR_FIELDS = gql`
  fragment TrustedEditorFields on TrustedEditor {
    id
    scope
    roleTemplate
    grantedAt
    revokedAt
    grantedOn {
      kind
      targetId
      name
      slug
    }
    recipient {
      kind
      targetId
      name
      slug
    }
  }
`;

export const MY_GRANTED_TRUSTED_EDITORS_QUERY = gql`
  query MyGrantedTrustedEditors($includeRevoked: Boolean) {
    myGrantedTrustedEditors(includeRevoked: $includeRevoked) {
      ...TrustedEditorFields
    }
  }
  ${TRUSTED_EDITOR_FIELDS}
`;

export const MY_RECEIVED_TRUSTED_EDITORS_QUERY = gql`
  query MyReceivedTrustedEditors($includeRevoked: Boolean) {
    myReceivedTrustedEditors(includeRevoked: $includeRevoked) {
      ...TrustedEditorFields
    }
  }
  ${TRUSTED_EDITOR_FIELDS}
`;

export const CREATE_TRUSTED_EDITOR_MUTATION = gql`
  mutation CreateTrustedEditor($input: createTrustedEditorInput!) {
    createTrustedEditor(input: $input) {
      trustedEditor {
        ...TrustedEditorFields
      }
      error
    }
  }
  ${TRUSTED_EDITOR_FIELDS}
`;

export const UPDATE_TRUSTED_EDITOR_SCOPE_MUTATION = gql`
  mutation UpdateTrustedEditorScope($input: updateTrustedEditorScopeInput!) {
    updateTrustedEditorScope(input: $input) {
      trustedEditor {
        ...TrustedEditorFields
      }
      error
    }
  }
  ${TRUSTED_EDITOR_FIELDS}
`;

export const REVOKE_TRUSTED_EDITOR_MUTATION = gql`
  mutation RevokeTrustedEditor($input: revokeTrustedEditorInput!) {
    revokeTrustedEditor(input: $input) {
      trustedEditor {
        ...TrustedEditorFields
      }
      error
    }
  }
  ${TRUSTED_EDITOR_FIELDS}
`;

export const ACCEPT_RECIPROCITY_MUTATION = gql`
  mutation AcceptReciprocity($input: acceptReciprocityInput!) {
    acceptReciprocity(input: $input) {
      trustedEditor {
        ...TrustedEditorFields
      }
      error
    }
  }
  ${TRUSTED_EDITOR_FIELDS}
`;

// Catalog mirror — kept in sync manually with packages/server/src/permissions/actionCatalog.ts.
// Used by the scope customization UI to render checkboxes grouped by entity.
export const ACTION_CATALOG: Record<string, { description: string; targetType: string }> = {
  "venue.edit_name": { description: "Edit venue name", targetType: "Venue" },
  "venue.edit_address": { description: "Edit address, city, state, zip", targetType: "Venue" },
  "venue.edit_description": { description: "Edit venue description", targetType: "Venue" },
  "venue.edit_contact": { description: "Edit website, phone, email", targetType: "Venue" },
  "venue.edit_images": { description: "Edit venue image", targetType: "Venue" },
  "venue.edit_capacity": { description: "Edit seating capacity", targetType: "Venue" },
  "venue.add_stage": { description: "Add a stage to the venue", targetType: "Venue" },
  "venue.edit_stage": { description: "Edit a stage on the venue", targetType: "Venue" },
  "venue.remove_stage": { description: "Remove a stage", targetType: "Venue" },
  "venue.mark_closed": { description: "Mark venue permanently closed", targetType: "Venue" },
  "company.edit_name": { description: "Edit company name", targetType: "ProductionCompany" },
  "company.edit_description": { description: "Edit company description", targetType: "ProductionCompany" },
  "company.edit_logo": { description: "Edit company logo", targetType: "ProductionCompany" },
  "company.add_run": { description: "Add a new run", targetType: "ProductionCompany" },
  "company.edit_run": { description: "Edit run-level fields", targetType: "ProductionCompany" },
  "company.edit_run_cast": { description: "Edit run cast / creative credits", targetType: "ProductionCompany" },
  "person.edit_name": { description: "Edit person's name", targetType: "Person" },
  "person.edit_bio": { description: "Edit biography", targetType: "Person" },
  "person.edit_headshot": { description: "Edit headshot", targetType: "Person" },
  "person.add_credit": { description: "Add a credit", targetType: "Person" },
  "person.edit_credit": { description: "Edit a credit", targetType: "Person" },
  "performance.edit_date_time": { description: "Edit date / time", targetType: "Performance" },
  "performance.edit_ticket_url": { description: "Edit ticket URL", targetType: "Performance" },
  "performance.edit_stage_override": { description: "Edit stage override", targetType: "Performance" },
  "performance.edit_metadata_override": { description: "Edit metadata overrides", targetType: "Performance" },
  "performance.edit_credit_overrides": { description: "Edit credit overrides", targetType: "Performance" },
};

export const ROLE_TEMPLATES: Record<string, string[]> = {
  Manager: Object.keys(ACTION_CATALOG),
  Booker: [
    "venue.add_stage",
    "venue.edit_stage",
    "company.add_run",
    "company.edit_run",
    "performance.edit_date_time",
    "performance.edit_ticket_url",
    "performance.edit_stage_override",
  ],
  Publicist: [
    "venue.edit_description",
    "venue.edit_contact",
    "venue.edit_images",
    "company.edit_description",
    "company.edit_logo",
    "person.edit_bio",
    "person.edit_headshot",
  ],
  Personal: [
    "person.edit_name",
    "person.edit_bio",
    "person.edit_headshot",
    "person.add_credit",
    "person.edit_credit",
  ],
};
