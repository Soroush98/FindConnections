import { NextRequest, NextResponse } from 'next/server';
import { adminService, connectionService, suggestionService } from '@/lib/services';
import { storageHelpers } from '@/lib/db/storage';
import { withErrorHandler, AppError } from '@/lib/errors';
import { isValidFullName } from '@/helpers/nameValidation';
import { validateServerImage } from '@/helpers/serverImageValidation';

async function handler(req: NextRequest): Promise<NextResponse> {
  await adminService.verifySession();

  const formData = await req.formData();
  const firstPersonFullName = formData.get('firstPersonFullName');
  const secondPersonFullName = formData.get('secondPersonFullName');
  const file = formData.get('file');

  if (
    typeof firstPersonFullName !== 'string' ||
    typeof secondPersonFullName !== 'string' ||
    !(file instanceof File)
  ) {
    throw AppError.missingFields(['firstPersonFullName', 'secondPersonFullName', 'file']);
  }

  if (!isValidFullName(firstPersonFullName) || !isValidFullName(secondPersonFullName)) {
    throw AppError.validation("Name format is incorrect. Please use '{name} {familyname}' format.");
  }

  // Re-validate the file server-side from raw bytes — the browser check is not
  // trustworthy and the ingestion path validates the same way.
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const validation = validateServerImage(file.name, file.type, buffer);
  if (!validation.isValid) {
    throw AppError.validation(validation.message ?? 'Invalid image file.');
  }

  // Graph is the source of truth for pair uniqueness (undirected, extension-
  // agnostic — unlike a storage-key scan).
  if (await connectionService.connectionExists(firstPersonFullName, secondPersonFullName)) {
    throw AppError.alreadyExists('Connection');
  }

  const fileName = `${firstPersonFullName}_${secondPersonFullName}.${validation.extension}`;
  await storageHelpers.upload(fileName, buffer, file.type);
  const imageUrl = storageHelpers.publicUrl(fileName);

  await connectionService.createConnection(firstPersonFullName, secondPersonFullName, imageUrl);

  suggestionService.invalidateCache();

  return NextResponse.json(
    {
      message: 'Connection uploaded successfully',
      imageUrl,
    },
    { status: 200 }
  );
}

export const POST = withErrorHandler(handler);
