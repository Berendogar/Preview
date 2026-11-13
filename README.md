# Preview

Club link cards. Paste a URL, Preview fetches the page, and you get a title and the first lines. Saved cards stay on the home page.

Express and a static page. No database.

## Features

- Paste a URL and fetch a preview
- Saved example cards
- Health check at `/health`

## Run locally

Node 18+.

```bash
npm install
npm start
```

Open http://localhost:3000.

## Run with Docker

```bash
docker compose up --build
```

The app listens on port 3000.

## Project layout

```
server.js         Routes and the fetch
public/           Home page and styles
```

## Assignment notes

Host this somewhere your classmates and instructor can reach. Walk the running app until you can explain:

- what happens after you submit a URL
- which process makes the request
- what the home page shows versus what the server will fetch
- what other routes exist in `server.js`

Then look for a security defect in the running system, document how to trigger it, and patch it without breaking a normal public-URL preview. Submit the hosted URL, a short architecture sketch, the writeup, and the patched repo.
