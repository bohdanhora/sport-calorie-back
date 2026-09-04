import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

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

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'sk-...4f2a',
    description: 'Masked key, the full value never leaves the server',
  })
  apiKeyHint!: string | null;
}

export class NutritionProviderCheckDto {
  @ApiProperty()
  ok!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  message!: string | null;
}
