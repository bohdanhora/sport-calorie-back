import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

import { IsLocalDate } from '../validation/is-local-date.validator';

export class DateQueryDto {
  @ApiPropertyOptional({
    example: '2026-03-02',
    description: 'Defaults to today in the user timezone',
  })
  @IsOptional()
  @IsLocalDate()
  date?: string;
}

export class DateRangeQueryDto {
  @ApiPropertyOptional({ example: '2026-02-01' })
  @IsOptional()
  @IsLocalDate()
  from?: string;

  @ApiPropertyOptional({ example: '2026-03-02' })
  @IsOptional()
  @IsLocalDate()
  to?: string;
}
