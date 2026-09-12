import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FoodUnit } from '@prisma/client';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const SUPPORTED_LOCALES = ['en', 'ru', 'uk'] as const;

export class ParseFoodDto {
  @ApiProperty({ example: 'chicken breast 200 g with rice 150 g' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  text!: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES, default: 'en' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: string;
}

const MAX_IMAGE_CHARS = 5_600_000;

export class ScanFoodDto {
  @ApiProperty({
    description: 'A data URL: data:image/jpeg;base64,...',
    example: 'data:image/jpeg;base64,/9j/4AAQ...',
  })
  @IsString()
  @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, {
    message: 'image must be a base64 data URL of a JPEG, PNG or WebP',
  })
  @MaxLength(MAX_IMAGE_CHARS, { message: 'The photo is too large; send a smaller one' })
  image!: string;

  @ApiPropertyOptional({
    example: 'the bowl is about 300 g',
    description: 'Anything the photo cannot show, such as the weight',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  hint?: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES, default: 'en' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: string;
}

export class ParsedFoodDto {
  @ApiProperty()
  foodId!: string;

  @ApiProperty({ example: 'Chicken breast' })
  name!: string;

  @ApiProperty({ example: 200 })
  amount!: number;

  @ApiProperty({ enum: FoodUnit })
  unit!: FoodUnit;

  @ApiProperty({ example: 330 })
  energyKcal!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  proteinG!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  carbsG!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  fatG!: number | null;

  @ApiProperty({ description: 'True when the answer came from a previously saved result' })
  fromCache!: boolean;
}
