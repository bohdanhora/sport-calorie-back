import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class SaveNutritionProviderDto {
  @ApiProperty({
    example: 'https://api.openai.com/v1',
    description: 'Base URL of an OpenAI compatible chat completions API',
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(300)
  baseUrl!: string;

  @ApiProperty({ example: 'gpt-4o-mini' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  modelName!: string;

  @ApiPropertyOptional({
    example: 'qwen/qwen3.6-27b',
    description: 'Model used for photos. Leave empty to keep photo scanning off.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  visionModelName?: string | null;

  @ApiPropertyOptional({
    description:
      'Set when the model is not one the catalog recognises but the user knows it takes images.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  visionOverride?: boolean;

  @ApiPropertyOptional({
    example: 'sk-proj-...',
    description:
      'Stored encrypted and never returned. Omit it to keep the key already saved, which is what changing a model alone does.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(400)
  apiKey?: string;
}

export class NutritionProviderDto {
  @ApiProperty()
  isConfigured!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'https://api.openai.com/v1' })
  baseUrl!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'gpt-4o-mini' })
  modelName!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'qwen/qwen3.6-27b' })
  visionModelName!: string | null;

  @ApiProperty({
    description:
      'Whether photos can be sent: the model is one the catalog recognises, or the user said it takes images.',
  })
  supportsVision!: boolean;

  @ApiProperty({ description: 'Whether the catalog itself recognises the vision model.' })
  visionModelKnown!: boolean;

  @ApiProperty()
  visionOverride!: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'sk-...4f2a',
    description: 'Masked key, the full value never leaves the server',
  })
  apiKeyHint!: string | null;
}

export class CatalogProviderDto {
  @ApiProperty({ example: 'groq' })
  id!: string;

  @ApiProperty({ example: 'Groq' })
  label!: string;

  @ApiProperty({ example: 'https://api.groq.com/openai/v1' })
  baseUrl!: string;

  @ApiProperty({ example: 'https://console.groq.com/keys' })
  apiKeysUrl!: string;

  @ApiProperty({ example: 'gsk_...' })
  keyHint!: string;

  @ApiProperty({ example: 'qwen/qwen3.8-27b' })
  defaultModel!: string;

  @ApiProperty({ type: [String], example: ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b'] })
  models!: string[];

  @ApiProperty({ type: [String], example: ['qwen/qwen3.6-27b'] })
  visionPrefixes!: string[];
}

export class ProviderModelsDto {
  @ApiProperty({ type: [String], example: ['openai/gpt-oss-20b', 'qwen/qwen3.6-27b'] })
  models!: string[];

  @ApiProperty({
    type: [String],
    description: 'The subset of models this app recognises as accepting images.',
  })
  visionModels!: string[];
}

export class NutritionProviderCheckDto {
  @ApiProperty()
  ok!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  message!: string | null;
}
