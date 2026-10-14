import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { IsLocalDate } from '../../../common/validation/is-local-date.validator';
import { SUPPORTED_LOCALES } from '../../nutrition-provider/dto/parse-food.dto';

export const ASSISTANT_ROLES = ['user', 'assistant'] as const;

export type AssistantRole = (typeof ASSISTANT_ROLES)[number];

export const ASSISTANT_DETAILS = ['auto', 'full'] as const;

export type AssistantDetail = (typeof ASSISTANT_DETAILS)[number];

const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 8_000;

export class AssistantMessageDto {
  @ApiProperty({ enum: ASSISTANT_ROLES })
  @IsIn(ASSISTANT_ROLES)
  role!: AssistantRole;

  @ApiProperty({ example: 'When did I overeat last month, and why?' })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MESSAGE_CHARS)
  content!: string;
}

export class AskAssistantDto {
  @ApiProperty({
    type: [AssistantMessageDto],
    description: 'The conversation so far, oldest first, ending with the question',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MESSAGES)
  @ValidateNested({ each: true })
  @Type(() => AssistantMessageDto)
  messages!: AssistantMessageDto[];

  @ApiPropertyOptional({ example: '2026-09-16', description: 'Defaults to 30 days before to' })
  @IsOptional()
  @IsLocalDate()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-15', description: 'Defaults to today' })
  @IsOptional()
  @IsLocalDate()
  to?: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES, default: 'en' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: string;

  @ApiPropertyOptional({
    enum: ASSISTANT_DETAILS,
    default: 'auto',
    description:
      'auto sends the full food log only where the question needs it; full sends every entry of the period',
  })
  @IsOptional()
  @IsIn(ASSISTANT_DETAILS)
  detail?: AssistantDetail;
}

export class AssistantAnswerDto {
  @ApiProperty({ description: 'Markdown: headings, lists and bold text' })
  answer!: string;

  @ApiProperty({ example: '2026-09-16' })
  from!: string;

  @ApiProperty({ example: '2026-10-15' })
  to!: string;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'As counted by the provider' })
  promptTokens!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'As counted by the provider' })
  completionTokens!: number | null;
}
