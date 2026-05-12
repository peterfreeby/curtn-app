import { createTrustedEditor } from './createTrustedEditor'
import { updateTrustedEditorScope } from './updateTrustedEditorScope'
import { revokeTrustedEditor } from './revokeTrustedEditor'
import { acceptReciprocity } from './acceptReciprocity'

export const trustedEditorMutations = {
  createTrustedEditor,
  updateTrustedEditorScope,
  revokeTrustedEditor,
  acceptReciprocity,
}
