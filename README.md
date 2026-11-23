# SalonHub Server

## Project Name and Description

**SalonHub Server** is the backend API for the SalonHub salon appointment booking platform. It handles authentication, authorization, user profiles, services, appointments, and payments. MongoDB is used for data storage, and Stripe is used for secure online payments.

## Important Features

- User authentication and authorization
- Customer and Admin role-based access
- User profile management
- Salon service management
- Appointment booking and management
- Prevention of duplicate active appointment bookings for the same date and time
- Stripe Checkout integration
- Stripe webhook signature verification
- Secure payment confirmation
- Transaction recording
- Image upload support

## Technology Stack

- Node.js
- Express.js
- MongoDB
- Better Auth
- JSON Web Tokens (JWT)
- Stripe
- ImgBB

## Installation Instructions

1. Install Node.js.
2. Clone the server repository:

   ```bash
   git clone https://github.com/nissumoncode/salonhub-server.git
   ```

3. Navigate to the project folder:

   ```bash
   cd salonhub-server
   ```

4. Install dependencies:

   ```bash
   npm install
   ```

5. Create a `.env` file in the root directory and configure the required environment variables.

## How to Run the Project Locally

**Development mode:**

```bash
npm run dev
```

**Start mode:**

```bash
npm start
```

The server will run at:

http://localhost:5000

## Required Environment Variables

Add the following variable names to `.env`:

- `PORT`
- `MONGODB_URI`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `CLIENT_URL`
- `IMGBB_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Live Website Link

https://salonhub-client.vercel.app

## Client and Server Repository Links

- **Client Repository:** https://github.com/nissumoncode/salonhub-client
- **Server Repository:** https://github.com/nissumoncode/salonhub-server

## Important Payment Security Rules

- New appointments start with `Pending` status and `Unpaid` payment status.
- Customers can pay only for confirmed appointments.
- Stripe Checkout sessions are created by the backend.
- Only a verified Stripe webhook can update payment status to `Paid`.
- Verified payments are saved in the transactions collection.
- The frontend success page does not independently confirm payments.
