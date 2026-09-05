import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

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

  @ApiProperty({ example: 'sk-proj-...', description: 'Stored encrypted and never returned' })
  @IsString()
  @MinLength(8)
  @MaxLength(400)
  apiKey!: string;
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
      'Whether the configured vision model is one the app recognises as accepting images.',
  })
  supportsVision!: boolean;

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
