import { NextResponse } from 'next/server';
import { getUserByUsername, getUserByEmail, registerUser } from '@/lib/server/db';
import { withErrorHandler, validateBody } from '@/lib/server/apiHandler';
import { RegisterUserSchema } from '@/lib/server/schemas';

export const POST = withErrorHandler('app/api/auth/register/route.js (POST)', async (request) => {
  const validatedData = await validateBody(request, RegisterUserSchema);
  const { username, password, display_name, email, mobile } = validatedData;

  let normalizedMobile = '';
  if (mobile) {
    normalizedMobile = mobile.replace(/\D/g, '');
    if (normalizedMobile.length === 12 && normalizedMobile.startsWith('91')) {
      normalizedMobile = normalizedMobile.substring(2);
    } else if (normalizedMobile.length === 11 && normalizedMobile.startsWith('0')) {
      normalizedMobile = normalizedMobile.substring(1);
    }
    if (!/^\d{10}$/.test(normalizedMobile)) {
      throw { status: 400, message: 'Mobile number must be a valid 10-digit number' };
    }
  }

  if (!email && !normalizedMobile) {
    throw { status: 400, message: 'Either Email Address or Mobile Number is required' };
  }

  if (username.length < 3) {
    throw { status: 400, message: 'Username must be at least 3 characters' };
  }

  const existing = await getUserByUsername(username);
  if (existing) {
    throw { status: 400, message: 'Username is already taken' };
  }

  if (email) {
    const existingEmail = await getUserByEmail(email);
    if (existingEmail) {
      throw { status: 400, message: 'Email address is already registered' };
    }
  }

  const newUser = await registerUser({ username, password, display_name, email, mobile: normalizedMobile });
  return NextResponse.json({
    success: true,
    message: 'Registration successful! Please wait for the administrator to activate your account.',
    user: newUser
  }, { status: 201 });
});

