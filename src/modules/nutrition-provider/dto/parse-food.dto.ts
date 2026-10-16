import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FoodUnit } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

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
const MAX_IMAGES_CHARS = 1_400_000;
export const MAX_SCAN_IMAGES = 4;
const IMAGE_DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const IMAGE_FORMAT_MESSAGE = 'image must be a base64 data URL of a JPEG, PNG or WebP';

export class ScanFoodDto {
  @ApiPropertyOptional({
    description: 'A single photo as a data URL; kept for older clients, prefer images',
    example: 'data:image/jpeg;base64,/9j/4AAQ...',
  })
  @ValidateIf((dto: ScanFoodDto) => dto.images === undefined)
  @IsString()
  @Matches(IMAGE_DATA_URL, { message: IMAGE_FORMAT_MESSAGE })
  @MaxLength(MAX_IMAGE_CHARS, { message: 'The photo is too large; send a smaller one' })
  image?: string;

  @ApiPropertyOptional({
    description: `Up to ${MAX_SCAN_IMAGES} photos of the same meal as data URLs`,
    type: [String],
    example: ['data:image/jpeg;base64,/9j/4AAQ...'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SCAN_IMAGES, { message: `Send at most ${MAX_SCAN_IMAGES} photos at once` })
  @IsString({ each: true })
  @Matches(IMAGE_DATA_URL, { each: true, message: IMAGE_FORMAT_MESSAGE })
  @MaxLength(MAX_IMAGES_CHARS, { each: true, message: 'A photo is too large; send smaller ones' })
  images?: string[];

  @ApiPropertyOptional({
    example: 'the bowl is about 300 g, no sugar in the tea',
    description: 'A note for the photos: anything they cannot show, such as the weight',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
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
