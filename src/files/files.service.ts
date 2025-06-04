import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { File, FileStatus } from './entities/file.entity';
import { Job, JobStatus, JobType } from './entities/job.entity';
import { CreateFileDto } from './dto/create-file.dto';
import { User } from '../users/entities/user.entity';
import { File as MulterFile } from 'multer';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectQueue('file-processing')
    private readonly fileProcessingQueue: Queue,
  ) {}

  async create(
    createFileDto: CreateFileDto,
    fileInfo: MulterFile,
    user: User,
  ): Promise<{ id: number; status: string }> {
    // Create file record
    const file = this.fileRepository.create({
      userId: user.id,
      originalFilename: fileInfo.originalname,
      storagePath: fileInfo.path,
      title: createFileDto.title,
      description: createFileDto.description,
      status: FileStatus.UPLOADED,
    });

    const savedFile = await this.fileRepository.save(file);

    // Create job record
    const job = this.jobRepository.create({
      fileId: savedFile.id,
      jobType: JobType.FILE_PROCESSING,
      status: JobStatus.QUEUED,
    });

    await this.jobRepository.save(job);

    // Add job to queue
    await this.fileProcessingQueue.add(
      'process-file',
      {
        fileId: savedFile.id,
        filePath: fileInfo.path,
        originalName: fileInfo.originalname,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    return {
      id: savedFile.id,
      status: savedFile.status,
    };
  }

  async findOne(id: number, user: User): Promise<File> {
    const file = await this.fileRepository.findOne({
      where: { id },
      relations: ['jobs'],
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check if user owns the file
    if (file.userId !== user.id) {
      throw new ForbiddenException('You can only access your own files');
    }

    return file;
  }

  async findAll(
    user: User,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    files: File[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [files, total] = await this.fileRepository.findAndCount({
      where: { userId: user.id },
      relations: ['jobs'],
      order: { uploadedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      files,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateFileStatus(
    fileId: number,
    status: FileStatus,
    extractedData?: string,
  ): Promise<void> {
    await this.fileRepository.update(fileId, {
      status,
      extractedData,
    });
  }

  async updateJobStatus(
    fileId: number,
    status: JobStatus,
    startedAt?: Date,
    completedAt?: Date,
    errorMessage?: string,
  ): Promise<void> {
    const updateData: Partial<Job> = { status };

    if (startedAt) updateData.startedAt = startedAt;
    if (completedAt) updateData.completedAt = completedAt;
    if (errorMessage) updateData.errorMessage = errorMessage;

    await this.jobRepository.update({ fileId }, updateData);
  }
}
