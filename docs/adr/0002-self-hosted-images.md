# Self-host images as plain files; no object store, no CDN

Photos (event backgrounds, present photos) are plain files on a dedicated filesystem on the home server. An authenticated Meteor Express route (`accounts-express`) receives each upload and writes three fixed WebP derivatives with `sharp` (400 / 1000 / 1600 px). Caddy serves them statically under unguessable ids, and restic backs the volume up off-site. `ImageRef` has no `provider` field.

An authenticated upload over the session the app already holds is what makes a presigned-URL object store pointless. It is also what makes orphaned uploads structurally impossible instead of something a sweep job has to clean up.

## Considered Options

- **Cloudinary / hosted CDN-plus-transform.** The original recommendation. Superseded once hosting became the user's own home server, because it optimises for a constraint we don't have.
- **Single-node object store.** MinIO is archived. Garage would be the pick if an object store were ever wanted. Its only real advantage, presigned URLs for clients the server doesn't know, doesn't apply here.
- **On-the-fly resizer** (imgproxy, Thumbor). The derivatives form a fixed set, so generating them at upload time is strictly simpler on a small box.
- **Cloudflare CDN in front.** Cloudflare's terms name serving "a disproportionate percentage of pictures" explicitly, and the Tunnel FAQ restates it. Tunnelling doesn't route around that.

## Consequences

- Image URLs are bearer capabilities: anyone holding one can load it. That is accepted.
- Clients must downscale before upload. The household uplink also carries DDP.
- Images must not share a volume with Mongo, whose disk-full behaviour is undocumented.
