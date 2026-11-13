# Preview — Case Study 8

**Student:** Beren Dogar
**Repository:** https://github.com/Berendogar/Preview

```text
Browser form  POST /preview
        |
        v
Express (server.js)  -- fetch --> the URL you typed
        |
        +-- public/index.html    two saved cards, already written out
        +-- GET /health
        +-- GET /internal        desk note, not on the home page
```

Submitting the form POSTs the URL to `/preview`. The Node process is the one that calls `fetch`. It reads the HTML and keeps the title plus the first lines. The home page does not fetch anything. Those two cards are static HTML. The server will fetch a URL that is not on the page.

Other routes in `server.js`: `GET /`, `GET /health`, `GET /internal`, `POST /preview`, and the files in `public/`.

## Bug

`/internal` is not a saved card. Preview still fetched it when I posted this:

```text
POST /preview
url=http://127.0.0.1:3000/internal
```

The card came back 200 with the desk note. `localhost` did the same. The home page never links that path.

## Patch

Preview now allows only `http` and `https`. It resolves the name and refuses loopback, private, and link-local addresses, including when a redirect points at one. A public page still returns a title and a snippet. `https://example.com` still shows "Example Domain".

`node --test`: 4 passed. The desk route is still there if you open it. The form will not go and get it.
