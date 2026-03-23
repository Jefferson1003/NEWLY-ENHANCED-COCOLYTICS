# Newly Enhanced Cocolytics

Clean full-stack setup with:

- Node.js backend API (Express)
- Vue 3 frontend (Vite)
- PWA support for installable frontend

## Folder Structure

- `backend/` Node.js API
- `frontend/` Vue app + PWA config

## Quick Start

1. Install backend dependencies:

```bash
npm --prefix backend install
```

2. Install frontend dependencies:

```bash
npm --prefix frontend install
```

3. Start backend:

```bash
npm --prefix backend run dev
```

4. Start frontend:

```bash
npm --prefix frontend run dev
```

Backend runs at `http://localhost:4000`.
Frontend runs at `http://localhost:5173`.

## PWA Installability

The Vue app is configured with `vite-plugin-pwa` and includes:

- Web app manifest
- Service worker registration
- App icons
- `display: standalone` for installable behavior

To verify installability, run the frontend and open it in Chrome/Edge. You should see an install option.

## Useful Commands

```bash
npm --prefix backend run start
npm --prefix frontend run build
npm --prefix frontend run preview
```
