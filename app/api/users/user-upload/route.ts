import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'cookie';
import { userService, suggestionService } from '@/lib/services';
import { userRepository } from '@/lib/repositories';
import { withErrorHandler, AppError } from '@/lib/errors';
import { extractCsrfToken, validateCsrfToken } from '@/helpers/csrfHelper';

async function handler(req: NextRequest): Promise<NextResponse> {
  // Extract and validate CSRF token using helper
  const providedToken = await extractCsrfToken(req);

  if (!providedToken || !(await validateCsrfToken(req, providedToken))) {
    throw AppError.forbidden('Invalid CSRF token');
  }

  // Extract token from cookie or header
  let token;
  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    const cookies = parse(cookieHeader);
    token = cookies['auth-token'];
  }

  if (!token) {
    throw AppError.unauthorized();
  }

  // Verify token and extract user ID
  const decoded = userService.verifyToken(token);
  if (decoded.role !== 'user') {
    throw AppError.forbidden();
  }
  const userId = decoded.id;

  // Get user info to check upload count
  const user = await userRepository.findById(userId);

  if (!user) {
    throw AppError.notFound('User');
  }

  const uploadCount = user.uploadCount || 0;
  const lastUploadDate = user.lastUploadDate || '';
  const today = new Date().toISOString().split('T')[0];

  // Reset count if it's a new day
  let newUploadCount = uploadCount;
  if (lastUploadDate !== today) {
    newUploadCount = 10; // Reset to max daily uploads
  }

  // Check if the user has uploads remaining
  if (newUploadCount <= 0) {
    throw AppError.rateLimited(
      'You have reached your maximum uploads for today. Please try again tomorrow.'
    );
  }

  // Process the form data
  const formData = await req.formData();
  const firstPersonFullName = formData.get('firstPersonFullName') as string;
  const secondPersonFullName = formData.get('secondPersonFullName') as string;
  const file = formData.get('file') as File;

  if (!firstPersonFullName || !secondPersonFullName || !file) {
    throw AppError.missingFields(['firstPersonFullName', 'secondPersonFullName', 'file']);
  }

  const nameRegex = /^[a-zA-Z]+\s[a-zA-Z]+$/;
  if (!nameRegex.test(firstPersonFullName) || !nameRegex.test(secondPersonFullName)) {
    throw AppError.validation("Name format is incorrect. Please use '{name} {familyname}' format.");
  }

  // Check if the connection already exists before updating user quota
  const fileExtension = file.name.split('.').pop();
  const connectionExists = await suggestionService.fileExistsInTemp(
    firstPersonFullName,
    secondPersonFullName,
    fileExtension!
  );

  if (connectionExists) {
    throw AppError.alreadyExists('Connection');
  }

  // Update user upload count
  const updatedUser = await userRepository.updateUploadCount({
    userId,
    newCount: newUploadCount - 1,
    date: today,
  });

  // Process file upload only after successful update of user quota
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await suggestionService.uploadToTemp(
    firstPersonFullName,
    secondPersonFullName,
    fileExtension!,
    buffer,
    file.type
  );

  // Return success response with updated user info
  return NextResponse.json(
    {
      message: 'File uploaded successfully!',
      user: {
        uploadCount: updatedUser?.uploadCount || 0,
        lastUploadDate: updatedUser?.lastUploadDate || today,
      },
    },
    { status: 200 }
  );
}

export const POST = withErrorHandler(handler);