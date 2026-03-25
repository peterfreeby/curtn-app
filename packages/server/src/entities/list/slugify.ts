import { ListModel } from './listModel'
import { Types } from 'mongoose'

export async function generateListSlug(name: string, ownerId: Types.ObjectId | string): Promise<string> {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

  let slug = base || 'list'
  let suffix = 1

  while (await ListModel.findOne({ slug, owner: ownerId })) {
    suffix++
    slug = `${base}-${suffix}`
  }

  return slug
}
