import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'me@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'correct horse battery' })
  @IsString()
  @MinLength(1)
  password!: string;
}
