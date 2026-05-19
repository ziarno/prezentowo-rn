import type { EventDoc } from '@prezentowo/types'
import { Mongo } from 'meteor/mongo'

export const Events = new Mongo.Collection<EventDoc>('events')
