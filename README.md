# SportsWear E-Commerce Platform

A modern full-stack sportswear e-commerce platform built with Next.js and Node.js, designed to provide a seamless online shopping experience for customers and a powerful management system for administrators. The platform enables users to browse sportswear products, manage their shopping cart and wishlist, place orders securely, and track purchases in real time.

## Features

- User Authentication & Authorization
- Product Management (CRUD Operations)
- Shopping Cart Functionality
- Order Management (Place and Track Orders)
- Review System for Products
- Wishlist Management
- Coupon Management for Discounts
- Banner Management for Promotions
- Profile Management for Users
- Easy payment

## Technologies Used

- Backend : Node.js, Express.js, Typescript
- Database : Postgess with drizzle Orm
- Authentication: JWT
- Payment : RazorPay



## Getting Started

1. Clone the repository:

``` bash 
git clone <repository-url>
cd backend
```

2. Install dependencies:

``` bash
npm install
```

3. Configure environment variables:

- create a .env file in the frontend folder
- add the following variables to the .env file:

``` bash
DB_URL=
JWT_SECRATE=
PORT=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

4. Run the development server:

``` bash 
npm run dev
```



