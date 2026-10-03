import { Mongo } from 'meteor/mongo'

// One per upload, keyed by the upload's id (its directory under IMAGES_DIR).
// Records who uploaded it and, once a document has taken it, when; the sweep
// deletes uploads no document ever took (docs/spec.md §3.1). Never published.
export type ImageRecord = {
  _id: string
  ownerId: string
  createdAt: Date
  attachedAt?: Date
}

export const Images = new Mongo.Collection<ImageRecord>('images')
