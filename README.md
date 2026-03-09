# Restaurant Web (Next.js)

Frontend for a single restaurant powered by the Restaurant API. Built with **Next.js (App Router)** and **JSX**.

## Configuration

Set up your `.env.local` file:

```env
# Base URL for the API
NEXT_PUBLIC_API_URL=https://restaurant.digitallisbon.pt/api

# The ID of your specific restaurant in the database
NEXT_PUBLIC_RESTAURANT_ID=9
```

## Setup

```bash
cd restaurant-web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

This application acts as the customer-facing website for **Restaurant ID 9** (or whichever ID you set in `.env.local`).

- **Public:** Landing page with restaurant info (name, cuisine, description, address).
- **Authenticated:** Profile, reservations list, create a reservation (`/book`).
- **API client** in `src/lib/api.js` connects to the provided API endpoints.
- **Auth context** in `src/context/AuthContext.js` handles user sessions (`localStorage`).

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page showing the restaurant's details |
| `/book` | Make a reservation for the restaurant (requires login) |
| `/login` | Log into a customer account |
| `/register` | Register a new customer account |
| `/profile` | View and edit user profile (authenticated) |
| `/reservations` | List of the user's reservations (authenticated) |
