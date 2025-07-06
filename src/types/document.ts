import { Document, Application, DocumentType } from '@prisma/client';

export interface DocumentWithApplication extends Document {
  application: {
    id: string;
    company: string;
    position: string;
    status: string;
  };
}

export interface DocumentStats {
  total: number;
  byType: Record<DocumentType, number>;
  totalSize: number;
  averageSize: number;
  thisMonth: number;
}

export interface PaginatedDocuments {
  documents: DocumentWithApplication[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface DocumentFilters {
  type?: DocumentType;
  applicationId?: string;
  search?: string;
  sortBy?: 'name' | 'type' | 'createdAt' | 'size';
  sortOrder?: 'asc' | 'desc';
}

export interface UploadResult {
  success: boolean;
  documents?: DocumentWithApplication[];
  errors?: string[];
}