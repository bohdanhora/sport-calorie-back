import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityCategory } from '@prisma/client';

export class ActivityTypeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'treadmill' })
  slug!: string;

  @ApiProperty({ example: 'Treadmill' })
  name!: string;

  @ApiProperty({ enum: ActivityCategory })
  category!: ActivityCategory;

  @ApiProperty({ example: 4.3, description: 'Metabolic equivalent at moderate intensity' })
  metModerate!: number;

  @ApiProperty()
  tracksDuration!: boolean;

  @ApiProperty()
  tracksDistance!: boolean;

  @ApiProperty()
  tracksIncline!: boolean;

  @ApiProperty()
  tracksReps!: boolean;

  @ApiProperty()
  tracksSets!: boolean;

  @ApiProperty()
  tracksIntensity!: boolean;

  @ApiPropertyOptional({ description: 'False for the shared catalog' })
  isOwned!: boolean;
}
