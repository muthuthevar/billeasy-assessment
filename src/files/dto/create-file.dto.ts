import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFileDto {
  @ApiProperty({
    description: 'Optional title for the file',
    example: 'Important Document',
    required: false,
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    description: 'Optional description for the file',
    example: 'This is an important document for the project',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
