import type { GiftDoc } from '@prezentowo/types'
import { Mongo } from 'meteor/mongo'

export const Gifts = new Mongo.Collection<GiftDoc>('gifts')
