import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CartItemDto } from '../../cart/dto/cart.dto';
import { ORDER_STATUSES, type OrderStatus } from '../entities/order.entity';

export class CreateOrderDto {
  @IsUUID('4')
  addressId: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,64}$/)
  idempotencyKey: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  cartItemIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AfterSaleDto {
  @IsString()
  @Length(2, 500)
  @Matches(/\S/)
  note: string;
}

export class AdminOrderQueryDto {
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;
}

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUSES.filter((status) => status !== 'pending_confirmation'))
  status: Exclude<OrderStatus, 'pending_confirmation'>;

  @ValidateIf((dto: UpdateOrderStatusDto) => dto.status === 'shipped')
  @IsString()
  @Length(1, 80)
  @Matches(/\S/)
  trackingCarrier?: string;

  @ValidateIf((dto: UpdateOrderStatusDto) => dto.status === 'shipped')
  @IsString()
  @Length(1, 100)
  @Matches(/\S/)
  trackingNo?: string;
}
