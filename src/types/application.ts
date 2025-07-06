import { Application, Interview, Document, ApplicationStatus } from '@prisma/client';

export interface ApplicationWithDetails extends Application {
  interviews: Interview[];
  documents: Document[];
}

export interface ApplicationStats {
  total: number;
  byStatus: Record<ApplicationStatus, number>;
  thisMonth: number;
  thisWeek: number;
  averageResponseTime: number | null;
  successRate: number;
}

export interface PaginatedApplications {
  applications: ApplicationWithDetails[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApplicationFilters {
  status?: ApplicationStatus;
  company?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'appliedAt' | 'company' | 'position' | 'status' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}