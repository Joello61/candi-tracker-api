import { Interview, Application, InterviewType } from '@prisma/client';

export interface InterviewWithApplication extends Interview {
  application: {
    id: string;
    company: string;
    position: string;
    status: string;
  };
}

export interface InterviewStats {
  total: number;
  upcoming: number;
  completed: number;
  byType: Record<InterviewType, number>;
  thisWeek: number;
  nextWeek: number;
  averageDuration: number | null;
}

export interface PaginatedInterviews {
  interviews: InterviewWithApplication[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface InterviewFilters {
  type?: InterviewType;
  applicationId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'scheduledAt' | 'type' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  upcoming?: boolean;
  past?: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: InterviewType;
  company: string;
  position: string;
  notes?: string;
  interviewers: string[];
}