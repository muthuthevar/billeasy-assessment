import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { readFile, stat } from 'fs/promises';
import { createHash } from 'crypto';
import { FilesService } from '../files.service';
import { FileStatus } from '../entities/file.entity';
import { JobStatus } from '../entities/job.entity';

interface FileProcessingJobData {
  fileId: number;
  filePath: string;
  originalName: string;
}

@Processor('file-processing')
export class FileProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(FileProcessingProcessor.name);

  constructor(private readonly filesService: FilesService) {
    super();
  }

  async process(job: Job<FileProcessingJobData>): Promise<void> {
    const { fileId, filePath, originalName } = job.data;

    this.logger.log(`Processing file ${fileId}: ${originalName}`);

    try {
      // Update job status to processing
      await this.filesService.updateJobStatus(
        fileId,
        JobStatus.PROCESSING,
        new Date(),
      );

      // Update file status to processing
      await this.filesService.updateFileStatus(fileId, FileStatus.PROCESSING);

      // Simulate file processing
      await this.processFile(filePath);

      // Extract file metadata
      const extractedData = await this.extractMetadata(filePath);

      // Update file status to processed with extracted data
      await this.filesService.updateFileStatus(
        fileId,
        FileStatus.PROCESSED,
        extractedData,
      );

      // Update job status to completed
      await this.filesService.updateJobStatus(
        fileId,
        JobStatus.COMPLETED,
        undefined,
        new Date(),
      );

      this.logger.log(`Successfully processed file ${fileId}`);
    } catch (error) {
      this.logger.error(`Failed to process file ${fileId}:`, error.stack);

      // Update file status to failed
      await this.filesService.updateFileStatus(fileId, FileStatus.FAILED);

      // Update job status to failed with error message
      await this.filesService.updateJobStatus(
        fileId,
        JobStatus.FAILED,
        undefined,
        new Date(),
        error.message,
      );

      throw error; // Re-throw to mark job as failed
    }
  }

  private async processFile(filePath: string): Promise<void> {
    // Simulate processing time (2-5 seconds)
    const processingTime = Math.random() * 3000 + 2000;
    await new Promise((resolve) => setTimeout(resolve, processingTime));

    // Verify file exists and is readable
    try {
      await stat(filePath);
    } catch (error) {
      throw new Error(`File not accessible: ${error.message}`);
    }
  }

  private async extractMetadata(filePath: string): Promise<string> {
    try {
      // Read file and calculate hash
      const fileBuffer = await readFile(filePath);
      const hash = createHash('sha256').update(fileBuffer).digest('hex');

      // Get file stats
      const stats = await stat(filePath);

      // Create metadata object
      const metadata = {
        fileSize: stats.size,
        sha256Hash: hash,
        processedAt: new Date().toISOString(),
        mimeTypeGuess: this.guessMimeType(filePath),
      };

      return JSON.stringify(metadata);
    } catch (error) {
      throw new Error(`Failed to extract metadata: ${error.message}`);
    }
  }

  private guessMimeType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();

    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      txt: 'text/plain',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      mp4: 'video/mp4',
      mp3: 'audio/mpeg',
      zip: 'application/zip',
    };

    return mimeTypes[extension as string] || 'application/octet-stream';
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<FileProcessingJobData>) {
    this.logger.log(`Job ${job.id} completed for file ${job.data.fileId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<FileProcessingJobData>, error: Error) {
    this.logger.error(
      `Job ${job.id} failed for file ${job.data.fileId}: ${error.message}`,
    );
  }

  @OnWorkerEvent('stalled')
  onStalled(job: Job<FileProcessingJobData>) {
    this.logger.warn(`Job ${job.id} stalled for file ${job.data.fileId}`);
  }
}
