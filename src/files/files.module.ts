import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { FileProcessingProcessor } from './processors/file-processor';
import { File } from './entities/file.entity';
import { Job } from './entities/job.entity';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';

@Module({
  imports: [
    // File upload configuration
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const uploadPath = configService.get('UPLOAD_PATH', './uploads');

        // Create uploads directory if it doesn't exist
        if (!existsSync(uploadPath)) {
          mkdirSync(uploadPath, { recursive: true });
        }

        return {
          storage: diskStorage({
            destination: uploadPath,
            filename: (req, file, cb) => {
              const uniqueSuffix =
                Date.now() + '-' + Math.round(Math.random() * 1e9);
              cb(
                null,
                `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`,
              );
            },
          }),
          limits: {
            fileSize: configService.get('MAX_FILE_SIZE', 10 * 1024 * 1024), // 10MB default
          },
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([File, Job]),
    BullModule.registerQueue({
      name: 'file-processing',
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService, FileProcessingProcessor],
  exports: [FilesService],
})
export class FilesModule {}
