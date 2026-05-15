import { NextRequest, NextResponse } from 'next/server';
import { adminService, suggestionService } from '@/lib/services';
import { storageHelpers } from '@/lib/db/storage';
import { connectionRepository } from '@/lib/repositories';
import { withErrorHandler, AppError } from '@/lib/errors';

async function fileExistsInStorage(
  firstPerson: string,
  secondPerson: string,
  fileExtension: string
): Promise<boolean> {
  const candidates = new Set([
    `${firstPerson}_${secondPerson}.${fileExtension}`,
    `${secondPerson}_${firstPerson}.${fileExtension}`,
  ]);
  const keys = await storageHelpers.listKeys();
  for (const key of keys) {
    if (candidates.has(key)) return true;
  }
  return false;
}

async function handler(req: NextRequest): Promise<NextResponse> {
  await adminService.verifySession();

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

  const fileExtension = file.name.split('.').pop();
  if (!fileExtension) {
    throw AppError.validation('File must have an extension');
  }

  if (await fileExistsInStorage(firstPersonFullName, secondPersonFullName, fileExtension)) {
    throw AppError.alreadyExists('Connection');
  }

  const fileName = `${firstPersonFullName}_${secondPersonFullName}.${fileExtension}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await storageHelpers.upload(fileName, buffer, file.type);
  const imageUrl = storageHelpers.publicUrl(fileName);

  await connectionRepository.createConnection(firstPersonFullName, secondPersonFullName, imageUrl);

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
