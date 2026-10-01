import type { Request, Response } from 'express'
import { WebApp } from 'meteor/webapp'

import { loadInvitePreview } from '../api/invites/invites.preview'
import { ogCardFor } from './landing.ogCard'

function sendCard(res: Response, path: string) {
  res.sendFile(
    path,
    // `allow`: the dev cache directory is a dot directory, like `.images`.
    {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
      dotfiles: 'allow',
    },
    error => {
      if (error && !res.headersSent) res.status(500).end()
    },
  )
}

// `og:image` for `/e/:code`. A code that opens nothing gets the brand card,
// as its page does, so a stale preview never shows a broken image.
async function inviteCard(req: Request, res: Response) {
  try {
    const preview = await loadInvitePreview(String(req.params.code))
    sendCard(res, await ogCardFor(preview))
  } catch (error) {
    console.error('GET /e/:code/og.png failed', error)
    res.status(500).end()
  }
}

async function brandCard(_req: Request, res: Response) {
  try {
    sendCard(res, await ogCardFor(null))
  } catch (error) {
    console.error('GET /og.png failed', error)
    res.status(500).end()
  }
}

WebApp.handlers.get('/e/:code/og.png', inviteCard)
WebApp.handlers.get('/og.png', brandCard)
