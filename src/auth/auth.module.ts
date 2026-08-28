import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthController, AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSession } from './entities/auth-session.entity';
import { User } from './entities/user.entity';
import { SessionAuthGuard } from './session-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, AuthSession])],
  controllers: [AuthController, AdminAuthController],
  providers: [AuthService, SessionAuthGuard],
  exports: [AuthService, SessionAuthGuard],
})
export class AuthModule {}
