import { ApiProperty } from '@nestjs/swagger';

export class AuthenticatedUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  displayName!: string | null;

  @ApiProperty({ example: 'Europe/Kyiv' })
  timezone!: string;

  @ApiProperty({ example: 'en' })
  locale!: string;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ description: 'Access token lifetime in seconds' })
  expiresIn!: number;

  @ApiProperty({ type: AuthenticatedUserDto })
  user!: AuthenticatedUserDto;

  /**
   * Also sent as the `sc_refresh` cookie. It is repeated here because Safari
   * drops that cookie when the API sits on an unrelated domain, and such a
   * client has to keep the token itself to survive a page reload.
   */
  @ApiProperty({ description: 'The refresh token, mirroring the sc_refresh cookie' })
  refreshToken!: string;
}
