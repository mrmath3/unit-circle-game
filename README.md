# Unit Circle Click Game

An interactive game that helps students master the locations of angles on the unit circle using radians. Players are shown a radian value (e.g., π/6) and must click the corresponding point on a custom SVG unit circle.

## Play

**[Play on mrsindelmath.com](https://www.mrsindelmath.com/games/unit-circle)**

## Features

- Clean, responsive SVG-based unit circle
- MathJax-rendered angle prompts
- Instant feedback with sound effects
- Optional alternate angles (e.g., 13π/6, −π/6)
- 30-second challenge mode with countdown timer
- Public leaderboard (requires Google sign-in)

## How to Play

1. Click the correct angle location when prompted.
2. A 30-second timer starts on your first click.
3. Sign in with Google to submit your score to the public leaderboard.
4. Use the checkbox to enable alternate angles for an added challenge.

## For Teachers

Want to use or adapt this game for your own classroom? Fork this repository and follow the setup steps below.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A [Firebase](https://firebase.google.com/) project (for Google sign-in and score storage)

### Local Development

```bash
# Install dependencies
npm install

# Start the dev server (runs at http://localhost:5173)
npm run dev
```

Create a `.env.local` file with your Firebase project config:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_BASE_URL=http://localhost:3000/api/games/unit-circle
```

### Backend (Leaderboard API)

The leaderboard is powered by a Next.js API route on the main site. If you want a standalone backend instead, see the `api/` folder — it contains a Cloudflare Worker implementation that can be deployed independently with a Cloudflare D1 database.

### Deploying the Frontend

```bash
npm run build      # build to dist/
npm run deploy     # deploy to GitHub Pages (requires gh-pages package)
```

## Project Structure

```
unit-circle-game/
├── src/
│   ├── main.js         # entry point, wires up game + auth
│   ├── game.js         # core game logic
│   ├── angles.js       # unit circle angle definitions
│   ├── auth.js         # Firebase Google sign-in
│   ├── api.js          # leaderboard API client
│   └── style.css
├── api/                # standalone Cloudflare Worker backend (optional)
│   ├── src/index.js    # Worker route handlers
│   ├── schema/         # D1 database schema
│   └── wrangler.toml   # Cloudflare deployment config
├── index.html
├── unit-circle.svg
├── correct-ding.mp3
└── wrong-buzz.mp3
```

---

Built by Andrew Sindel — High School Math Teacher, Lee Vining High School, CA
