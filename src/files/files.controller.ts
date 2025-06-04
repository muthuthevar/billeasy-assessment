import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { CreateFileDto } from './dto/create-file.dto';
import { User } from '../users/entities/user.entity';
import { File as MulterFile } from 'multer';

@ApiTags('Files')
@Controller('files')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseGuards(ThrottlerGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        title: {
          type: 'string',
          description: 'Optional file title',
        },
        description: {
          type: 'string',
          description: 'Optional file description',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    schema: {
      example: {
        id: 1,
        status: 'uploaded',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid file or missing required fields',
  })
  @ApiResponse({
    status: 413,
    description: 'File too large',
  })
  async uploadFile(
    @UploadedFile() file: MulterFile,
    @Body() createFileDto: CreateFileDto,
    @GetUser() user: User,
  ) {
    return await this.filesService.create(createFileDto, file, user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all files for the authenticated user' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 10)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Files retrieved successfully',
    schema: {
      example: {
        files: [
          {
            id: 1,
            originalFilename: 'document.pdf',
            title: 'Important Document',
            description: 'This is an important document',
            status: 'processed',
            extractedData: 'file_hash_12345',
            uploadedAt: '2023-12-01T10:00:00Z',
            jobs: [
              {
                id: 1,
                jobType: 'file_processing',
                status: 'completed',
                startedAt: '2023-12-01T10:00:01Z',
                completedAt: '2023-12-01T10:00:05Z',
              },
            ],
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      },
    },
  })
  async findAll(
    @GetUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.filesService.findAll(user, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file details by ID' })
  @ApiResponse({
    status: 200,
    description: 'File details retrieved successfully',
    schema: {
      example: {
        id: 1,
        originalFilename: 'document.pdf',
        title: 'Important Document',
        description: 'This is an important document',
        status: 'processed',
        extractedData: 'file_hash_12345',
        uploadedAt: '2023-12-01T10:00:00Z',
        jobs: [
          {
            id: 1,
            jobType: 'file_processing',
            status: 'completed',
            startedAt: '2023-12-01T10:00:01Z',
            completedAt: '2023-12-01T10:00:05Z',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'File not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - You can only access your own files',
  })
  async findOne(@Param('id', ParseIntPipe) id: number, @GetUser() user: User) {
    return this.filesService.findOne(id, user);
  }
}
