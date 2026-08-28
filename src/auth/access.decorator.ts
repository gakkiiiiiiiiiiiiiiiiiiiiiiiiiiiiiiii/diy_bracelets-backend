import { SetMetadata } from '@nestjs/common';

export type AccessLevel = 'public' | 'user' | 'admin';

export const ACCESS_LEVEL_KEY = 'access-level';
export const Access = (level: AccessLevel) => SetMetadata(ACCESS_LEVEL_KEY, level);
