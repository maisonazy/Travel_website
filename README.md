# React + Vite

## M-Pesa Daraja setup

Booking checkout uses Safaricom Daraja STK Push. The browser sends a package ID and Kenyan phone number to the API; the server chooses the fixed package price and keeps Daraja credentials out of client code.

1. Copy `.env.example` to `.env` and fill in your Daraja consumer key, consumer secret, shortcode, and passkey. Keep `.env` private.
2. Use `DARAJA_ENV=sandbox` while testing. Switch to `production` only after your Daraja app and shortcode are approved for live payments.
3. Set `DARAJA_CALLBACK_URL` to a publicly reachable HTTPS address ending in `/api/payments/callback`. For local testing, use an HTTPS tunnel and configure that URL in Daraja.
4. Start the API and Vite in separate terminals from this directory: `npm run dev:api` and `npm run dev`.

This development API keeps pending payment status in memory. A deployed payment service should persist transactions in a database and verify callback data before fulfilling bookings.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
